// One-time (resumable) backfill of tender detail cards into the database.
//
// The daily job only fetches cards for the Kharkiv-oblast + railway subset —
// those are the ones committed to the git-backed JSON store, small enough to
// live in the repo. The rest of the country's flagged tenders (tens of
// thousands) have no card, so their pages show "not loaded". This fills that
// gap by fetching every flagged tender's card straight into the database, and
// NOTHING into the JSON store — 140 MB of detail cannot live in git.
//
// Resumable: it asks the database which tender ids it already holds and
// fetches only the rest, so a re-run after an interruption (or the GitHub
// job's time limit) continues where it stopped.
//
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... TR_CONCURRENCY=6 \
//     node scripts/backfill-cards.ts
import { fetchTender } from "../src/sources/openprocurement.ts";
import { normalizeTender } from "../src/normalize/tender.ts";
import { openStore } from "../src/config.ts";
import { loadDbConfig, ensureSchema } from "../src/store/db.ts";
import { upsertCard, listCardIds } from "../src/store/cards.ts";

const config = loadDbConfig();
if (!config) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set to back-fill.");
  process.exit(1);
}

const CONCURRENCY = Number(process.env.TR_CONCURRENCY ?? 6);
const store = openStore();

await ensureSchema(config);

/** Every flagged tender id — the full nationwide set the feed already shows. */
const flags = await store.allRiskFlags();
const wanted = [...new Set(flags.map((f) => f.tender_id))];

const have = await listCardIds(config);
const todo = wanted.filter((id) => !have.has(id));
console.log(`${wanted.length} flagged tenders, ${have.size} already stored, ${todo.length} to fetch`);

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
