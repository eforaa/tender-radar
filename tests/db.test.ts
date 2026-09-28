import test from "node:test";
import assert from "node:assert/strict";
import { loadDbConfig, pipelineEndpoint, query, ensureSchema, SCHEMA } from "../src/store/db.ts";

const config = { url: "libsql://radar-org.turso.io", token: "tok" };

type Wire = { type: string; value?: unknown; base64?: string };

/** Answers each execute with the given rows and records what was sent. */
function fake(answers: { cols: string[]; rows: Wire[][] }[] = [], status = 200) {
  const calls: { url: string; init: RequestInit; body: any }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    const body = JSON.parse(init.body as string);
    calls.push({ url: String(url), init, body });
    if (status !== 200) return new Response("nope", { status });
    const executes = body.requests.filter((r: any) => r.type === "execute");
    const results = executes.map((_: unknown, i: number) => ({
      type: "ok",
      response: { type: "execute", result: { cols: (answers[i]?.cols ?? []).map((name) => ({ name })), rows: answers[i]?.rows ?? [] } },
    }));
    results.push({ type: "ok", response: { type: "close" } });
    return new Response(JSON.stringify({ results }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

test("config needs both url and token", () => {
  assert.equal(loadDbConfig({}), null);
  assert.equal(loadDbConfig({ TURSO_DATABASE_URL: "u" }), null);
  assert.deepEqual(loadDbConfig({ TURSO_DATABASE_URL: "u", TURSO_AUTH_TOKEN: "t" }), { url: "u", token: "t" });
});

test("a libsql:// url becomes the https pipeline endpoint", () => {
  assert.equal(pipelineEndpoint("libsql://radar-org.turso.io"), "https://radar-org.turso.io/v2/pipeline");
  assert.equal(pipelineEndpoint("https://radar-org.turso.io/"), "https://radar-org.turso.io/v2/pipeline");
});

test("query sends bearer auth, encodes args and closes the connection", async () => {
  const { calls, fetchImpl } = fake([{ cols: ["n"], rows: [[{ type: "integer", value: "7" }]] }]);
  await query(config, [{ sql: "SELECT ? AS a, ? AS b, ? AS c, ? AS d", args: ["x", 42, 1.5, null] }], fetchImpl);

  assert.equal(calls[0].url, "https://radar-org.turso.io/v2/pipeline");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer tok");
  const [exec, close] = calls[0].body.requests;
  assert.equal(exec.type, "execute");
  assert.deepEqual(exec.stmt.args, [
    { type: "text", value: "x" },
    { type: "integer", value: "42" },
    { type: "float", value: 1.5 },
    { type: "null" },
  ]);
  assert.deepEqual(close, { type: "close" });
});

test("rows come back as objects keyed by column, with integers as numbers", async () => {
  const { fetchImpl } = fake([
    { cols: ["id", "n", "t"], rows: [[{ type: "text", value: "a" }, { type: "integer", value: "3" }, { type: "null" }]] },
  ]);
  const [rows] = await query(config, [{ sql: "SELECT 1" }], fetchImpl);
  assert.deepEqual(rows, [{ id: "a", n: 3, t: null }]);
});

test("a statement error surfaces the database's message", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ results: [{ type: "error", error: { message: "no such table: cards" } }] }), { status: 200 })
  ) as unknown as typeof fetch;
  await assert.rejects(() => query(config, [{ sql: "SELECT * FROM cards" }], fetchImpl), /no such table: cards/);
});

test("a non-2xx throws with the status", async () => {
  const { fetchImpl } = fake([], 401);
  await assert.rejects(() => query(config, [{ sql: "SELECT 1" }], fetchImpl), /401/);
});

test("ensureSchema creates every table with IF NOT EXISTS", async () => {
  const { calls, fetchImpl } = fake(SCHEMA.map(() => ({ cols: [], rows: [] })));
  await ensureSchema(config, fetchImpl);
  const sqls = calls[0].body.requests.filter((r: any) => r.type === "execute").map((r: any) => r.stmt.sql);
  assert.equal(sqls.length, SCHEMA.length);
  assert.ok(sqls.every((s: string) => /CREATE TABLE IF NOT EXISTS/.test(s)));
  assert.ok(sqls.some((s: string) => /cards/.test(s)) && sqls.some((s: string) => /tg_subscribers/.test(s)));
});
