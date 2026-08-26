import test from "node:test";
import assert from "node:assert/strict";
import { broadcast, PACE_MS } from "../src/notify/broadcast.ts";

function reply(status: number, body: unknown = { ok: status === 200 }) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

test("every chat gets the message, paced apart", async () => {
  const seen: number[] = [], slept: number[] = [];
  const result = await broadcast([1, 2, 3], "hi", {
    send: async (chatId) => { seen.push(chatId); return reply(200); },
    sleep: async (ms) => { slept.push(ms); },
  });

  assert.deepEqual(seen, [1, 2, 3]);
  assert.deepEqual(result, { sent: 3, blocked: [], failed: 0 });
  assert.ok(slept.every((ms) => ms === PACE_MS), "paces at PACE_MS");
});

test("a chat that blocked the bot is reported for unsubscribing", async () => {
  const result = await broadcast([1, 2], "hi", {
    send: async (chatId) => (chatId === 2 ? reply(403, { ok: false }) : reply(200)),
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 1, blocked: [2], failed: 0 });
});

test("a rate limit is waited out and retried once", async () => {
  const attempts: number[] = [], slept: number[] = [];
  let first = true;
  const result = await broadcast([9], "hi", {
    send: async (chatId) => {
      attempts.push(chatId);
      if (first) { first = false; return reply(429, { parameters: { retry_after: 3 } }); }
      return reply(200);
    },
    sleep: async (ms) => { slept.push(ms); },
  });

  assert.deepEqual(attempts, [9, 9], "tried twice");
  assert.ok(slept.includes(3000), "waited retry_after seconds");
  assert.deepEqual(result, { sent: 1, blocked: [], failed: 0 });
});

test("a chat that keeps failing counts as an error and does not stop the rest", async () => {
  const result = await broadcast([1, 2], "hi", {
    send: async (chatId) => (chatId === 1 ? reply(500, { ok: false }) : reply(200)),
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 1, blocked: [], failed: 1 });
});

test("a 400 about a missing chat unsubscribes it", async () => {
  const result = await broadcast([1], "hi", {
    send: async () => reply(400, { ok: false, description: "Bad Request: chat not found" }),
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 0, blocked: [1], failed: 0 });
});

// Guards the worst failure mode in this feature: one malformed tender title
// makes Telegram reject the message for EVERY chat with a 400. Counting that
// as "blocked" would unsubscribe the entire audience in a single run.
test("a 400 about the message itself is an error, never an unsubscribe", async () => {
  const result = await broadcast([1, 2], "hi", {
    send: async () =>
      reply(400, { ok: false, description: "Bad Request: can't parse entities" }),
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 0, blocked: [], failed: 2 });
});

test("a thrown network error is counted, not propagated", async () => {
  const result = await broadcast([1], "hi", {
    send: async () => { throw new Error("socket hang up"); },
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 0, blocked: [], failed: 1 });
});

test("an empty list does no work", async () => {
  let calls = 0;
  const result = await broadcast([], "hi", {
    send: async () => { calls++; return reply(200); },
    sleep: async () => {},
  });
  assert.equal(calls, 0);
  assert.deepEqual(result, { sent: 0, blocked: [], failed: 0 });
});
