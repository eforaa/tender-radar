// Detail cards — the responsible official, the bidders, the winner, the items
// — for every flagged tender in the country. Too much for the git-backed JSON
// store, so they live in the database and the tender page fetches one on
// demand.
//
// One row per tender holding the whole card as JSON. The site only ever reads
// a card by id and merges it whole (server/data.ts mergeCardDetail), so four
// normalised tables bought nothing and cost space; a single row is also one
// round trip instead of four.
import type { TenderRow, TenderItemRow, BidRow, AwardRow } from "./types.ts";
import { query, type DbConfig } from "./db.ts";

export type Card = {
  tender: TenderRow;
  items: TenderItemRow[];
  bids: BidRow[];
  awards: AwardRow[];
};

/**
 * What actually gets stored. `raw` is Prozorro's full record — most of the
 * bytes of a card and read by nothing on the site (the JSON export nulls it
 * too). Keeping it is what filled the previous database.
 */
export function slimCard(card: Card): Card {
  return { ...card, tender: { ...card.tender, raw: null } };
}

const UPSERT = `INSERT INTO cards (id, tender_ref, card, updated_at) VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET tender_ref = excluded.tender_ref, card = excluded.card, updated_at = excluded.updated_at`;

function upsertStatement(card: Card) {
  const slim = slimCard(card);
  return { sql: UPSERT, args: [slim.tender.id, slim.tender.tender_id, JSON.stringify(slim), new Date().toISOString()] };
}

export async function upsertCard(config: DbConfig, card: Card, fetchImpl: typeof fetch = fetch): Promise<void> {
  await query(config, [upsertStatement(card)], fetchImpl);
}

/** Many cards in one request — for the migration and any bulk load. */
export async function upsertCards(config: DbConfig, cards: Card[], fetchImpl: typeof fetch = fetch): Promise<void> {
  if (cards.length === 0) return;
  await query(config, cards.map(upsertStatement), fetchImpl);
}

export async function getCard(config: DbConfig, id: string, fetchImpl: typeof fetch = fetch): Promise<Card | null> {
  const [rows] = await query(config, [{ sql: "SELECT card FROM cards WHERE id = ?", args: [id] }], fetchImpl);
  const row = rows[0];
  return row ? (JSON.parse(String(row.card)) as Card) : null;
}

/**
 * Every stored id, so a backfill can skip what it already has. Keyset-paged
 * on the primary key: tens of thousands of ids, but each page is small.
 */
export async function listCardIds(config: DbConfig, fetchImpl: typeof fetch = fetch): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 5000;
  let after = "";
  for (;;) {
    const [rows] = await query(
      config,
      [{ sql: "SELECT id FROM cards WHERE id > ? ORDER BY id LIMIT ?", args: [after, pageSize] }],
      fetchImpl,
    );
    for (const r of rows) ids.add(String(r.id));
    if (rows.length < pageSize) return ids;
    after = String(rows[rows.length - 1].id);
  }
}
