// Detail cards in Supabase, reached over PostgREST with plain fetch — no SDK,
// to keep the project's zero-runtime-dependency rule. Silent when unconfigured,
// the same contract as src/store/subscribers.ts.
import type { TenderRow, TenderItemRow, BidRow, AwardRow } from "./types.ts";

export type SupabaseConfig = { url: string; serviceKey: string };

export function loadSupabaseConfig(env: NodeJS.ProcessEnv = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  return url && serviceKey ? { url, serviceKey } : null;
}

export type Card = {
  tender: TenderRow;
  items: TenderItemRow[];
  bids: BidRow[];
  awards: AwardRow[];
};

function headers(config: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    "content-type": "application/json",
    ...extra,
  };
}

export async function upsertCard(
  config: SupabaseConfig,
  card: Card,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const base = `${config.url.replace(/\/$/, "")}/rest/v1`;
  // One POST per table, in a fixed order so a test can assert on it. Rows
  // carry their own primary keys, so merge-duplicates makes a re-fetch of the
  // same tender idempotent.
  const writes: [string, unknown][] = [
    ["tenders", [card.tender]],
    ["tender_items", card.items],
    ["bids", card.bids],
    ["awards", card.awards],
  ];
  for (const [table, rows] of writes) {
    if (Array.isArray(rows) && rows.length === 0 && table !== "tenders") continue;
    const res = await fetchImpl(`${base}/${table}`, {
      method: "POST",
      headers: headers(config, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`Supabase ${table} upsert returned ${res.status}`);
  }
}

export async function getCard(
  config: SupabaseConfig,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Card | null> {
  const base = `${config.url.replace(/\/$/, "")}/rest/v1`;

  async function rows<T>(path: string): Promise<T[]> {
    const res = await fetchImpl(`${base}/${path}`, { method: "GET", headers: headers(config) });
    if (!res.ok) throw new Error(`Supabase read returned ${res.status}`);
    return (await res.json()) as T[];
  }

  const enc = encodeURIComponent(id);
  const [tender] = await rows<TenderRow>(`tenders?id=eq.${enc}`);
  if (!tender) return null;
  const [items, bids, awards] = await Promise.all([
    rows<TenderItemRow>(`tender_items?tender_id=eq.${enc}`),
    rows<BidRow>(`bids?tender_id=eq.${enc}`),
    rows<AwardRow>(`awards?tender_id=eq.${enc}`),
  ]);
  return { tender, items, bids, awards };
}
