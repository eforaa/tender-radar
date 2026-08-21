import test from "node:test";
import assert from "node:assert/strict";
import {
  loadTelegramConfig, buildMessage, escapeHtml, pickHighlights, sendTelegram,
  type RunSummary,
} from "../src/notify/telegram.ts";
import type { Case } from "../server/data.ts";

function tenderCase(over: Partial<Case> = {}): Case {
  return {
    tender_id: "t1", tender_ref: "UA-2026-01-01-000001-a", tender_date: "2026-01-01",
    title: "Електрична енергія", status: "active", method: "aboveThreshold",
    entity_edrpou: "111", entity_name: "КП", region: "Харківська область",
    value_amount: 1_000_000, date_assessed: "2026-05-01", risks: ["ari-1-1"],
    officer_name: null, officer_email: null, officer_phone: null, officer_key: null,
    winner_name: null, winner_edrpou: null, winner_amount: null,
    bidders: 3, detailed: true, findings: [], audit: null,
    ...over,
  };
}

function summary(over: Partial<RunSummary> = {}): RunSummary {
  return {
    newTenders: 12, newFlags: 34, cardsFetched: 12, errors: 0,
    totalTenders: 36_484, totalFlags: 47_376, findings: 32,
    highlights: [], siteUrl: "https://example.test",
    ...over,
  };
}

test("the notifier stays silent unless both token and chat are set", () => {
  assert.equal(loadTelegramConfig({}), null);
  assert.equal(loadTelegramConfig({ TELEGRAM_BOT_TOKEN: "t" }), null);
  assert.equal(loadTelegramConfig({ TELEGRAM_CHAT_ID: "c" }), null);
  assert.deepEqual(loadTelegramConfig({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" }), {
    token: "t", chatId: "c",
  });
});

test("a quiet day says so instead of reporting zeros", () => {
  const text = buildMessage(summary({ newTenders: 0, newFlags: 0 }));
  assert.match(text, /не додалося/);
  assert.ok(!text.includes("Додалося <b>0</b>"));
});

test("a busy day reports both counts with correct agreement", () => {
  assert.match(buildMessage(summary({ newTenders: 1, newFlags: 1 })), /1<\/b> нова закупівля/);
  assert.match(buildMessage(summary({ newTenders: 3, newFlags: 3 })), /3<\/b> нові закупівлі/);
  assert.match(buildMessage(summary({ newTenders: 11, newFlags: 11 })), /11<\/b> нових закупівель/);
});

test("errors are surfaced rather than buried", () => {
  assert.match(buildMessage(summary({ errors: 3 })), /⚠️ Помилок під час оновлення: 3/);
  assert.ok(!buildMessage(summary({ errors: 0 })).includes("Помилок"));
});

test("highlights link to the tender and show its amount", () => {
  const text = buildMessage(summary({ highlights: [tenderCase({ value_amount: 4_120_000_000 })] }));
  assert.match(text, /https:\/\/example\.test\/tender\/t1/);
  assert.match(text, /4,12 млрд ₴/);
});

test("a title with angle brackets cannot break Telegram's HTML mode", () => {
  const text = buildMessage(summary({ highlights: [tenderCase({ title: 'Ремонт <b>школи</b> & двору' })] }));
  assert.ok(!text.includes("<b>школи</b>"));
  assert.match(text, /&lt;b&gt;школи/);
  assert.match(text, /&amp; двору/);
});

test("escapeHtml handles the three characters Telegram cares about", () => {
  assert.equal(escapeHtml('a & b < c > d'), "a &amp; b &lt; c &gt; d");
});

test("highlights rank by tier: price findings, then uncontested, then the rest", () => {
  const finding = { tender_id: "x", detector_key: "peer_price", tier: "own_analysis", severity: "high",
    title: "t", explanation: "e", evidence: {}, created_at: "" } as Case["findings"][number];
  const picked = pickHighlights([
    tenderCase({ tender_id: "big", value_amount: 900_000_000 }),
    tenderCase({ tender_id: "solo", bidders: 1, value_amount: 1000 }),
    tenderCase({ tender_id: "priced", value_amount: 1, findings: [finding] }),
  ]);
  assert.deepEqual(picked.map((c) => c.tender_id), ["priced", "solo", "big"]);
});

test("within one tier the larger contract comes first", () => {
  const picked = pickHighlights([
    tenderCase({ tender_id: "small", value_amount: 1000 }),
    tenderCase({ tender_id: "large", value_amount: 900_000_000 }),
  ]);
  assert.deepEqual(picked.map((c) => c.tender_id), ["large", "small"]);
});

test("highlights are capped", () => {
  const many = Array.from({ length: 30 }, (_, i) => tenderCase({ tender_id: `t${i}` }));
  assert.equal(pickHighlights(many).length, 5);
  assert.equal(pickHighlights(many, 2).length, 2);
});

test("a failing Telegram call is reported, not thrown", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response("nope", { status: 401 })) as typeof fetch;
  try {
    const out = await sendTelegram({ token: "t", chatId: "c" }, "hi");
    assert.equal(out.sent, false);
    assert.match(out.reason ?? "", /401/);
  } finally {
    globalThis.fetch = original;
  }
});

test("a network error is reported, not thrown", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  try {
    const out = await sendTelegram({ token: "t", chatId: "c" }, "hi");
    assert.equal(out.sent, false);
    assert.match(out.reason ?? "", /offline/);
  } finally {
    globalThis.fetch = original;
  }
});

test("a successful call posts to the right bot with HTML mode", async () => {
  const original = globalThis.fetch;
  let seen: { url: string; body: unknown } | null = null;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    seen = { url: String(url), body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
    const out = await sendTelegram({ token: "SECRET", chatId: "42" }, "текст");
    assert.equal(out.sent, true);
    assert.match(seen!.url, /api\.telegram\.org\/botSECRET\/sendMessage/);
    const body = seen!.body as Record<string, unknown>;
    assert.equal(body.chat_id, "42");
    assert.equal(body.parse_mode, "HTML");
    assert.equal(body.text, "текст");
  } finally {
    globalThis.fetch = original;
  }
});
