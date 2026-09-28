import test from "node:test";
import assert from "node:assert/strict";
import { upsertCard, upsertCards, getCard, listCardIds, slimCard, type Card } from "../src/store/cards.ts";

const config = { url: "libsql://radar-org.turso.io", token: "tok" };

type Wire = { type: string; value?: unknown };

/** Answers execute i with answers[i]; records each request body. */
function fake(answers: { cols: string[]; rows: Wire[][] }[] | ((i: number, sql: string, args: Wire[]) => { cols: string[]; rows: Wire[][] })) {
  const bodies: any[] = [];
  let n = 0;
  const fetchImpl = (async (_url: string | URL, init: RequestInit = {}) => {
    const body = JSON.parse(init.body as string);
    bodies.push(body);
    const executes = body.requests.filter((r: any) => r.type === "execute");
    const results = executes.map((r: any) => {
      const a = typeof answers === "function" ? answers(n++, r.stmt.sql, r.stmt.args) : (answers[n++] ?? { cols: [], rows: [] });
      return { type: "ok", response: { type: "execute", result: { cols: a.cols.map((name) => ({ name })), rows: a.rows } } };
    });
    results.push({ type: "ok", response: { type: "close" } });
    return new Response(JSON.stringify({ results }), { status: 200 });
  }) as unknown as typeof fetch;
  return { bodies, fetchImpl };
}

const sampleCard: Card = {
  tender: { id: "t1", tender_id: "UA-1", title: "X", description: null, status: "complete",
    method: null, value_amount: 5, currency: "UAH", date: null, entity_edrpou: null,
    entity_name: null, region: null, locality: null, officer_name: "Іваненко І. І.",
    officer_email: null, officer_phone: null, raw: { huge: "x".repeat(1000) } },
  items: [{ tender_id: "t1", item_id: "i1", description: null, cpv_code: null, cpv_name: null,
    quantity: null, unit_code: null, unit_name: null, lot_id: null }],
  bids: [{ tender_id: "t1", bid_id: "b1", supplier_edrpou: null, supplier_name: null, amount: 5, status: null }],
  awards: [{ tender_id: "t1", award_id: "a1", supplier_edrpou: null, supplier_name: null, amount: 5, status: null, date: null }],
};

test("slimCard drops Prozorro's raw record and nothing else", () => {
  const slim = slimCard(sampleCard);
  assert.equal(slim.tender.raw, null);
  assert.equal(slim.tender.officer_name, "Іваненко І. І.");
  assert.equal(slim.bids.length, 1);
  assert.deepEqual(sampleCard.tender.raw, { huge: "x".repeat(1000) }, "the input is not mutated");
});

test("upsertCard writes one row keyed by id, with the raw record stripped", async () => {
  const { bodies, fetchImpl } = fake([]);
  await upsertCard(config, sampleCard, fetchImpl);

  assert.equal(bodies.length, 1, "one request");
  const [exec] = bodies[0].requests;
  assert.match(exec.stmt.sql, /INSERT INTO cards/);
  assert.match(exec.stmt.sql, /ON CONFLICT\(id\) DO UPDATE/);
  const [id, ref, json] = exec.stmt.args;
  assert.deepEqual(id, { type: "text", value: "t1" });
  assert.deepEqual(ref, { type: "text", value: "UA-1" });
  const stored = JSON.parse(json.value);
  assert.equal(stored.tender.raw, null);
  assert.ok(!json.value.includes("xxxxxxxxxx"), "the raw blob is not stored");
  assert.equal(stored.awards[0].award_id, "a1");
});

test("upsertCards sends every card in a single request", async () => {
  const { bodies, fetchImpl } = fake([]);
  await upsertCards(config, [sampleCard, { ...sampleCard, tender: { ...sampleCard.tender, id: "t2" } }], fetchImpl);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].requests.filter((r: any) => r.type === "execute").length, 2);
});

test("upsertCards with nothing to write makes no request", async () => {
  const { bodies, fetchImpl } = fake([]);
  await upsertCards(config, [], fetchImpl);
  assert.equal(bodies.length, 0);
});

test("getCard parses the stored JSON back into a card", async () => {
  const { bodies, fetchImpl } = fake([{ cols: ["card"], rows: [[{ type: "text", value: JSON.stringify(slimCard(sampleCard)) }]] }]);
  const card = await getCard(config, "t1", fetchImpl);
  assert.ok(card);
  assert.equal(card.tender.id, "t1");
  assert.equal(card.tender.officer_name, "Іваненко І. І.");
  assert.equal(card.items.length, 1);
  assert.deepEqual(bodies[0].requests[0].stmt.args, [{ type: "text", value: "t1" }]);
});

test("getCard returns null when the tender is absent", async () => {
  const { fetchImpl } = fake([{ cols: ["card"], rows: [] }]);
  assert.equal(await getCard(config, "missing", fetchImpl), null);
});

test("listCardIds pages on the primary key until a short page", async () => {
  // Page size is 5000; answer a full page then a short one.
  const full = Array.from({ length: 5000 }, (_, i) => [{ type: "text", value: `id${String(i).padStart(5, "0")}` }]);
  const { bodies, fetchImpl } = fake((i) => (i === 0 ? { cols: ["id"], rows: full } : { cols: ["id"], rows: [[{ type: "text", value: "zz" }]] }));
  const ids = await listCardIds(config, fetchImpl);
  assert.equal(ids.size, 5001);
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[1].requests[0].stmt.args[0], { type: "text", value: "id04999" }, "second page starts after the last id");
});
