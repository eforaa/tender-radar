import test from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../src/notify/webhook.ts";
import { handleTelegramWebhook, type HttpRequest } from "../server/router.ts";
import type { SubscriberStore } from "../src/store/subscribers.ts";

test("/start and /stop are recognised with the chat they came from", () => {
  assert.deepEqual(
    parseCommand({ message: { chat: { id: 7 }, text: "/start" } }),
    { chatId: 7, kind: "start" },
  );
  assert.deepEqual(
    parseCommand({ message: { chat: { id: 7 }, text: "/stop" } }),
    { chatId: 7, kind: "stop" },
  );
});

test("Telegram's group suffix and payload arguments are tolerated", () => {
  assert.deepEqual(
    parseCommand({ message: { chat: { id: 7 }, text: "/start@TenderRadarBot" } }),
    { chatId: 7, kind: "start" },
  );
  assert.deepEqual(
    parseCommand({ message: { chat: { id: 7 }, text: "  /STOP  " } }),
    { chatId: 7, kind: "stop" },
  );
});

test("anything that is not a known command is ignored", () => {
  assert.equal(parseCommand({ message: { chat: { id: 7 }, text: "привіт" } }), null);
  assert.equal(parseCommand({ message: { chat: { id: 7 } } }), null);
  assert.equal(parseCommand({ message: { text: "/start" } }), null);
  assert.equal(parseCommand({ edited_message: { chat: { id: 7 }, text: "/start" } }), null);
  assert.equal(parseCommand({}), null);
  assert.equal(parseCommand(null), null);
  assert.equal(parseCommand("/start"), null);
});

function fakeStore() {
  const added: number[] = [], removed: number[] = [];
  const store: SubscriberStore = {
    async add(id) { added.push(id); },
    async remove(id) { removed.push(id); },
    async listActive() { return []; },
  };
  return { store, added, removed };
}

function post(body: unknown, secret = "s3cret"): HttpRequest {
  return {
    url: new URL("https://site.test/telegram/webhook"),
    cookieHeader: null,
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-telegram-bot-api-secret-token": secret },
  };
}

test("a /start subscribes the chat and answers it", async () => {
  const { store, added } = fakeStore();
  const replies: { chatId: number; text: string }[] = [];
  const res = await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/start" } }),
    { store, secret: "s3cret", reply: async (chatId, text) => { replies.push({ chatId, text }); } },
  );

  assert.equal(res.status, 200);
  assert.deepEqual(added, [7]);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].chatId, 7);
});

test("a /stop unsubscribes the chat", async () => {
  const { store, removed } = fakeStore();
  await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/stop" } }),
    { store, secret: "s3cret", reply: async () => {} },
  );
  assert.deepEqual(removed, [7]);
});

test("a wrong or missing secret is rejected without touching the store", async () => {
  const { store, added } = fakeStore();
  const deps = { store, secret: "s3cret", reply: async () => {} };

  const wrong = await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/start" } }, "guess"), deps);
  assert.equal(wrong.status, 401);

  const bare = await handleTelegramWebhook(
    { url: new URL("https://site.test/telegram/webhook"), cookieHeader: null,
      method: "POST", body: "{}", headers: {} }, deps);
  assert.equal(bare.status, 401);
  assert.deepEqual(added, []);
});

test("a store failure still answers 200, so Telegram stops retrying", async () => {
  const store: SubscriberStore = {
    async add() { throw new Error("supabase down"); },
    async remove() {}, async listActive() { return []; },
  };
  const res = await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/start" } }),
    { store, secret: "s3cret", reply: async () => {} },
  );
  assert.equal(res.status, 200);
});

test("with no store configured the webhook accepts and drops the update", async () => {
  const res = await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/start" } }),
    { store: null, secret: "s3cret", reply: async () => {} },
  );
  assert.equal(res.status, 200);
});
