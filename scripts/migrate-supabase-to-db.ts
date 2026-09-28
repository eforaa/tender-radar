// One-off: copies what the old Supabase project holds — detail cards and the
// Telegram subscribers — into the database, so the hours the backfill already
// spent are not spent again. Supabase keeps serving reads after its free
// quota is exhausted, which is all this needs.
//
// Safe to re-run: every write is an upsert. Runs with both sets of secrets:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate-supabase-to-db.ts
import type { TenderRow, TenderItemRow, BidRow, AwardRow } from "../src/store/types.ts";
import { loadDbConfig, ensureSchema, query } from "../src/store/db.ts";
import { upsertCards, type Card } from "../src/store/cards.ts";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const db = loadDbConfig();
if (!supabaseUrl || !supabaseKey || !db) {
  console.error("Needs SUPABASE_URL, SUPABASE_SERVICE_KEY, TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  process.exit(1);
}

/** Reads a whole PostgREST table, a page at a time, in a stable order. */
async function readAll<T>(table: string, order: string): Promise<T[]> {
  const out: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${supabaseUrl!.replace(/\/$/, "")}/rest/v1/${table}?select=*&order=${order}`, {
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${supabaseKey}`,
        Range: `${from}-${from + pageSize - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`Supabase ${table} read returned ${res.status}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    process.stdout.write(`\r  ${table}: ${out.length} rows`);
    if (rows.length < pageSize) break;
  }
  process.stdout.write("\n");
  return out;
}

function groupBy<T extends { tender_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.tender_id) ?? [];
    list.push(row);
    map.set(row.tender_id, list);
  }
  return map;
}

await ensureSchema(db);

console.log("reading Supabase…");
const tenders = await readAll<TenderRow>("tenders", "id");
const items = groupBy(await readAll<TenderItemRow>("tender_items", "tender_id,item_id"));
const bids = groupBy(await readAll<BidRow>("bids", "tender_id,bid_id"));
const awards = groupBy(await readAll<AwardRow>("awards", "tender_id,award_id"));

console.log(`writing ${tenders.length} cards…`);
const BATCH = 200;
for (let i = 0; i < tenders.length; i += BATCH) {
  const cards: Card[] = tenders.slice(i, i + BATCH).map((tender) => ({
    tender,
    items: items.get(tender.id) ?? [],
    bids: bids.get(tender.id) ?? [],
    awards: awards.get(tender.id) ?? [],
  }));
  await upsertCards(db, cards);
  process.stdout.write(`\r  ${Math.min(i + BATCH, tenders.length)}/${tenders.length}`);
}
process.stdout.write("\n");

const subscribers = await readAll<{ chat_id: number; subscribed_at: string | null; unsubscribed_at: string | null }>(
  "tg_subscribers",
  "chat_id",
);
if (subscribers.length) {
  await query(db, subscribers.map((s) => ({
    sql: `INSERT INTO tg_subscribers (chat_id, subscribed_at, unsubscribed_at) VALUES (?, ?, ?)
          ON CONFLICT(chat_id) DO UPDATE SET unsubscribed_at = excluded.unsubscribed_at`,
    args: [s.chat_id, s.subscribed_at ?? new Date().toISOString(), s.unsubscribed_at],
  })));
}
console.log(`migrated ${tenders.length} cards and ${subscribers.length} subscribers`);
