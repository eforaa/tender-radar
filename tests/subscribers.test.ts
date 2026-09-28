import test from "node:test";
import assert from "node:assert/strict";
import { loadSubscriberConfig, createSubscriberStore } from "../src/store/subscribers.ts";

const config = { url: "libsql://radar-org.turso.io", token: "tok" };

/** Records the statements the store sends and answers with the given rows. */
function recorder(rows: { chat_id: number }[] = []) {
  const stmts: { sql: string; args: { type: string; value?: unknown }[] }[] = [];
  const fetchImpl = (async (_url: string | URL, init: RequestInit = {}) => {
    const body = JSON.parse(init.body as string);
    const executes = body.requests.filter((r: any) => r.type === "execute");
    for (const r of executes) stmts.push(r.stmt);
    const results = executes.map(() => ({
      type: "ok",
      response: { type: "execute", result: { cols: [{ name: "chat_id" }], rows: rows.map((r) => [{ type: "integer", value: String(r.chat_id) }]) } },
    }));
    results.push({ type: "ok", response: { type: "close" } });
    return new Response(JSON.stringify({ results }), { status: 200 });
  }) as unknown as typeof fetch;
  return { stmts, fetchImpl };
}

test("the store stays unconfigured unless both url and token are set", () => {
  assert.equal(loadSubscriberConfig({}), null);
  assert.equal(loadSubscriberConfig({ TURSO_DATABASE_URL: "u" }), null);
  assert.equal(loadSubscriberConfig({ TURSO_AUTH_TOKEN: "t" }), null);
  assert.deepEqual(loadSubscriberConfig({ TURSO_DATABASE_URL: "u", TURSO_AUTH_TOKEN: "t" }), { url: "u", token: "t" });
});

test("adding a subscriber upserts and clears an earlier unsubscribe", async () => {
  const { stmts, fetchImpl } = recorder();
  await createSubscriberStore(config, fetchImpl).add(42);

  assert.equal(stmts.length, 1);
  assert.match(stmts[0].sql, /INSERT INTO tg_subscribers/);
  assert.match(stmts[0].sql, /ON CONFLICT\(chat_id\) DO UPDATE SET unsubscribed_at = NULL/);
  assert.deepEqual(stmts[0].args[0], { type: "integer", value: "42" });
});

test("removing a subscriber stamps the row instead of deleting it", async () => {
  const { stmts, fetchImpl } = recorder();
  await createSubscriberStore(config, fetchImpl).remove(42);

  assert.match(stmts[0].sql, /UPDATE tg_subscribers SET unsubscribed_at = \?/);
  assert.doesNotMatch(stmts[0].sql, /DELETE/);
  const [stamp, chat] = stmts[0].args;
  assert.ok(Date.parse(String(stamp.value)) > 0, "stamps a timestamp");
  assert.deepEqual(chat, { type: "integer", value: "42" });
});

test("listing returns only chats that have not unsubscribed", async () => {
  const { stmts, fetchImpl } = recorder([{ chat_id: 1 }, { chat_id: 2 }]);
  const active = await createSubscriberStore(config, fetchImpl).listActive();

  assert.deepEqual(active, [1, 2]);
  assert.match(stmts[0].sql, /WHERE unsubscribed_at IS NULL/);
});

test("a failed request throws with the status in the message", async () => {
  const fetchImpl = (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(() => createSubscriberStore(config, fetchImpl).listActive(), /401/);
});
