import test from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../src/notify/webhook.ts";

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
