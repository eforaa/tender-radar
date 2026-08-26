import test from "node:test";
import assert from "node:assert/strict";
import {
  loadSubscriberConfig, createSubscriberStore,
} from "../src/store/subscribers.ts";

const config = { url: "https://p.supabase.co", serviceKey: "svc" };

/** Records every call so a test can assert on the request the store made. */
function recorder(response: unknown = []) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(response), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

test("the store stays unconfigured unless both url and key are set", () => {
  assert.equal(loadSubscriberConfig({}), null);
  assert.equal(loadSubscriberConfig({ SUPABASE_URL: "u" }), null);
  assert.equal(loadSubscriberConfig({ SUPABASE_SERVICE_KEY: "k" }), null);
  assert.deepEqual(
    loadSubscriberConfig({ SUPABASE_URL: "u", SUPABASE_SERVICE_KEY: "k" }),
    { url: "u", serviceKey: "k" },
  );
});

test("adding a subscriber upserts and clears an earlier unsubscribe", async () => {
  const { calls, fetchImpl } = recorder();
  await createSubscriberStore(config, fetchImpl).add(42);

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rest\/v1\/tg_subscribers/);
  assert.equal(calls[0].init.method, "POST");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.apikey, "svc");
  assert.equal(headers.Authorization, "Bearer svc");
  assert.match(headers.Prefer, /resolution=merge-duplicates/);
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    chat_id: 42, unsubscribed_at: null,
  });
});

test("removing a subscriber stamps the row instead of deleting it", async () => {
  const { calls, fetchImpl } = recorder();
  await createSubscriberStore(config, fetchImpl).remove(42);

  assert.equal(calls[0].init.method, "PATCH");
  assert.match(calls[0].url, /chat_id=eq\.42/);
  const body = JSON.parse(calls[0].init.body as string) as { unsubscribed_at: string };
  assert.ok(Date.parse(body.unsubscribed_at) > 0, "stamps a timestamp");
});

test("listing returns only chats that have not unsubscribed", async () => {
  const { calls, fetchImpl } = recorder([{ chat_id: 1 }, { chat_id: 2 }]);
  const active = await createSubscriberStore(config, fetchImpl).listActive();

  assert.deepEqual(active, [1, 2]);
  assert.match(calls[0].url, /unsubscribed_at=is\.null/);
  assert.match(calls[0].url, /select=chat_id/);
});

test("a failed request throws with the status in the message", async () => {
  const fetchImpl = (async () =>
    new Response("nope", { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(
    () => createSubscriberStore(config, fetchImpl).listActive(),
    /401/,
  );
});
