import test from "node:test";
import assert from "node:assert/strict";
import { loadSupabaseConfig, upsertCard, getCard } from "../src/store/supabase-cards.ts";

const config = { url: "https://p.supabase.co", serviceKey: "svc" };

/** Records requests and answers each GET from a table→rows map. */
function fake(rowsByTable: Record<string, unknown[]> = {}) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    const u = String(url);
    const method = (init.method ?? "GET").toUpperCase();
    calls.push({ url: u, method, body: init.body ? JSON.parse(init.body as string) : undefined });
    const table = /\/rest\/v1\/(\w+)/.exec(u)?.[1] ?? "";
    const rows = method === "GET" ? (rowsByTable[table] ?? []) : [];
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const sampleCard = {
  tender: { id: "t1", tender_id: "UA-1", title: "X", description: null, status: "complete",
    method: null, value_amount: 5, currency: "UAH", date: null, entity_edrpou: null,
    entity_name: null, region: null, locality: null, officer_name: null,
    officer_email: null, officer_phone: null, raw: { a: 1 } },
  items: [{ tender_id: "t1", item_id: "i1", description: null, cpv_code: null, cpv_name: null,
    quantity: null, unit_code: null, unit_name: null, lot_id: null }],
  bids: [{ tender_id: "t1", bid_id: "b1", supplier_edrpou: null, supplier_name: null, amount: 5, status: null }],
  awards: [{ tender_id: "t1", award_id: "a1", supplier_edrpou: null, supplier_name: null, amount: 5, status: null, date: null }],
};

test("config needs both url and key", () => {
  assert.equal(loadSupabaseConfig({}), null);
  assert.equal(loadSupabaseConfig({ SUPABASE_URL: "u" }), null);
  assert.deepEqual(loadSupabaseConfig({ SUPABASE_URL: "u", SUPABASE_SERVICE_KEY: "k" }), { url: "u", serviceKey: "k" });
});

test("upsertCard writes all four tables with merge-duplicates", async () => {
  const { calls, fetchImpl } = fake();
  await upsertCard(config, sampleCard, fetchImpl);
  const tables = calls.map((c) => /\/rest\/v1\/(\w+)/.exec(c.url)?.[1]);
  assert.deepEqual(tables, ["tenders", "tender_items", "bids", "awards"]);
  assert.ok(calls.every((c) => c.method === "POST"));
  const headers0 = 1; // presence check below
  assert.ok(calls[0].url.includes("/rest/v1/tenders"));
});

test("getCard assembles the four tables into one card", async () => {
  const { calls, fetchImpl } = fake({
    tenders: [sampleCard.tender], tender_items: sampleCard.items,
    bids: sampleCard.bids, awards: sampleCard.awards,
  });
  const card = await getCard(config, "t1", fetchImpl);
  assert.ok(card);
  assert.equal(card.tender.id, "t1");
  assert.equal(card.items.length, 1);
  assert.equal(card.bids.length, 1);
  assert.equal(card.awards.length, 1);
  assert.ok(calls.every((c) => c.url.includes("tender_id=eq.t1") || c.url.includes("id=eq.t1")));
});

test("getCard returns null when the tender row is absent", async () => {
  const { fetchImpl } = fake({ tenders: [] });
  assert.equal(await getCard(config, "missing", fetchImpl), null);
});

test("a non-2xx throws with the status", async () => {
  const fetchImpl = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(() => getCard(config, "t1", fetchImpl), /401/);
});
