// One-time (resumable) backfill of tender detail cards into Supabase.
//
// The daily job only fetches cards for the Kharkiv-oblast + railway subset —
// those are the ones committed to the git-backed JSON store, small enough to
// live in the repo. The rest of the country's flagged tenders (tens of
// thousands) have no card, so their pages show "not loaded". This fills that
// gap by fetching every flagged tender's card straight into Supabase, and
// NOTHING into the JSON store — 140 MB of detail cannot live in git, which is
// exactly why the cards belong in the database instead.
//
// Resumable: it asks Supabase which tender ids it already holds and fetches
// only the rest, so a re-run after an interruption (or the GitHub job's time
// limit) continues where it stopped.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... TR_CONCURRENCY=6 \
//     node scripts/backfill-cards.ts
import { fetchTender } from "../src/sources/openprocurement.ts";
import { normalizeTender } from "../src/normalize/tender.ts";
import { openStore } from "../src/config.ts";
import { loadSupabaseConfig, upsertCard } from "../src/store/supabase-cards.ts";

const config = loadSupabaseConfig();
if (!config) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set to back-fill.");
  process.exit(1);
}

const CONCURRENCY = Number(process.env.TR_CONCURRENCY ?? 6);
const store = openStore();

/** Every flagged tender id — the full nationwide set the feed already shows. */
const flags = await store.allRiskFlags();
const wanted = [...new Set(flags.map((f) => f.tender_id))];

/** Ids whose card is already in Supabase, so a re-run skips them. */
async function idsInSupabase(): Promise<Set<string>> {
  const have = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${config!.url.replace(/\/$/, "")}/rest/v1/tenders?select=id`, {
      headers: {
        apikey: config!.serviceKey,
        Authorization: `Bearer ${config!.serviceKey}`,
        Range: `${from}-${from + pageSize - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`Supabase id scan returned ${res.status}`);
    const rows = (await res.json()) as { id: string }[];
    for (const r of rows) have.add(r.id);
    if (rows.length < pageSize) return have;
  }
}

const have = await idsInSupabase();
const todo = wanted.filter((id) => !have.has(id));
console.log(`${wanted.length} flagged tenders, ${have.size} already in Supabase, ${todo.length} to fetch`);

let done = 0;
let failed = 0;

async function worker(queue: string[]): Promise<void> {
  for (;;) {
    const id = queue.pop();
    if (!id) return;
    try {
      const card = normalizeTender(await fetchTender(id));
      await upsertCard(config!, card);
    } catch (err) {
      failed++;
      if (failed <= 10) console.log(`  ${id}: ${(err as Error).message}`);
    }
    done++;
    if (done % 200 === 0) console.log(`  ${done}/${todo.length} done (${failed} failed)`);
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
console.log(`backfill finished — ${done} processed, ${failed} failed`);
