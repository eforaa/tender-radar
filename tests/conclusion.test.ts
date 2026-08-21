import test from "node:test";
import assert from "node:assert/strict";
import { buildConclusion } from "../server/conclusion.ts";
import type { Case } from "../server/data.ts";
import type { FindingRow } from "../src/store/types.ts";

function tenderCase(over: Partial<Case> = {}): Case {
  return {
    tender_id: "t1", tender_ref: "UA-2026-01-01-000001-a", tender_date: "2026-01-01",
    title: "Електрична енергія", status: "active", method: "aboveThreshold",
    entity_edrpou: "111", entity_name: "КП Тест", region: "Харківська область",
    value_amount: 1_000_000, date_assessed: "2026-05-01", risks: ["ari-1-1"],
    officer_name: "Іваненко І.", officer_email: "i@x.ua", officer_phone: null, officer_key: "i@x.ua",
    winner_name: "ТОВ Переможець", winner_edrpou: "222", winner_amount: 900_000,
    bidders: 3, detailed: true, findings: [], audit: null,
    ...over,
  };
}

function finding(over: Partial<FindingRow> = {}): FindingRow {
  return {
    tender_id: "t1", detector_key: "peer_price", tier: "own_analysis", severity: "high",
    title: "t", explanation: "e",
    evidence: { unit_price: 30, peer_median: 10, peer_count: 114, overpayment: 2_000_000 },
    created_at: "2026-08-21",
    ...over,
  };
}

function inputFor(entry: Case, over: Partial<{ sameEntity: Case[]; sameOfficer: Case[]; sameWinner: Case[] }> = {}) {
  return { entry, sameEntity: [entry], sameOfficer: [entry], sameWinner: [entry], ...over };
}

test("a tender with nothing but the state flag says exactly that", () => {
  const out = buildConclusion(inputFor(tenderCase()));
  assert.equal(out.observations.length, 0);
  assert.equal(out.level, "low");
  assert.match(out.headline, /нічого не знайшли/);
  // It must still tell the reader what to do next.
  assert.ok(out.nextSteps.length > 0);
});

test("a price finding above the market is reported with both figures", () => {
  const out = buildConclusion(inputFor(tenderCase({ findings: [finding()] })));
  const o = out.observations.find((x) => x.title.includes("вища за ринкову"));
  assert.ok(o);
  assert.match(o.detail, /30/);
  assert.match(o.detail, /10/);
  assert.match(o.detail, /114/);
  assert.equal(out.level, "high");
});

test("a buyer raising its own price is called out separately", () => {
  const growth = finding({
    detector_key: "own_price_growth",
    evidence: { unit_price: 13.22, previous_price: 7.18, growth: 0.84, extra_cost: 93_649_512 },
  });
  const out = buildConclusion(inputFor(tenderCase({ findings: [growth] })));
  const o = out.observations.find((x) => x.title.includes("підняв ціну"));
  assert.ok(o);
  assert.match(o.detail, /7,18/);
  assert.match(o.detail, /84%/);
});

test("a single bidder on a large tender weighs heavily", () => {
  const out = buildConclusion(inputFor(tenderCase({ bidders: 1, value_amount: 50_000_000 })));
  const o = out.observations.find((x) => x.title.includes("Конкуренції не було"));
  assert.ok(o);
  assert.equal(o.weight, "high");
});

test("a single bidder on a small tender is noted but not alarming", () => {
  const out = buildConclusion(inputFor(tenderCase({ bidders: 1, value_amount: 200_000 })));
  const o = out.observations.find((x) => x.title.includes("Конкуренції не було"));
  assert.equal(o?.weight, "medium");
});

test("an auction that moved the price by nothing is flagged", () => {
  const out = buildConclusion(inputFor(tenderCase({ value_amount: 10_000_000, winner_amount: 9_990_000 })));
  assert.ok(out.observations.some((x) => x.title.includes("не збили ціну")));
});

test("a real discount is not flagged", () => {
  const out = buildConclusion(inputFor(tenderCase({ value_amount: 10_000_000, winner_amount: 8_000_000 })));
  assert.ok(!out.observations.some((x) => x.title.includes("не збили ціну")));
});

test("indicators from one group are read as a pattern", () => {
  // Both belong to "Ціну змінили після перемоги".
  const out = buildConclusion(inputFor(tenderCase({ risks: ["ari-1-1", "ari-1-2"] })));
  const o = out.observations.find((x) => x.title.includes("один сюжет"));
  assert.ok(o);
  assert.match(o.title, /ціну змінили після перемоги/i);
});

test("a recurring buyer-winner pair is surfaced with its count", () => {
  const entry = tenderCase();
  const pairTenders = Array.from({ length: 7 }, (_, i) => tenderCase({ tender_id: `p${i}` }));
  const out = buildConclusion(inputFor(entry, { sameWinner: pairTenders }));
  const o = out.observations.find((x) => x.title.includes("Постійна пара"));
  assert.ok(o);
  assert.equal(o.weight, "high");
  assert.match(o.detail, /7/);
});

test("a winner who happens to serve many different buyers is not called a pair", () => {
  const entry = tenderCase();
  const spread = Array.from({ length: 7 }, (_, i) => tenderCase({ tender_id: `p${i}`, entity_edrpou: `other${i}` }));
  const out = buildConclusion(inputFor(entry, { sameWinner: spread }));
  assert.ok(!out.observations.some((x) => x.title.includes("Постійна пара")));
});

test("the official's record is described as a flow, not an accusation", () => {
  const many = Array.from({ length: 25 }, (_, i) => tenderCase({ tender_id: `o${i}` }));
  const out = buildConclusion(inputFor(tenderCase(), { sameOfficer: many }));
  const o = out.observations.find((x) => x.title.includes("відповідальної особи"));
  assert.ok(o);
  assert.match(o.detail, /не звинувачення особи/);
});

test("the level rises only when something concrete was found", () => {
  assert.equal(buildConclusion(inputFor(tenderCase())).level, "low");
  assert.equal(
    buildConclusion(inputFor(tenderCase({ bidders: 1, value_amount: 200_000, risks: ["ari-1-1", "ari-1-2"] }))).level,
    "medium",
  );
  assert.equal(buildConclusion(inputFor(tenderCase({ findings: [finding()] }))).level, "high");
});

test("next steps never repeat themselves", () => {
  const out = buildConclusion(inputFor(tenderCase({ bidders: 1, findings: [finding(), finding()] })));
  assert.equal(new Set(out.nextSteps).size, out.nextSteps.length);
});

test("context about the buyer and winner never raises the priority alone", () => {
  // Three bidders, one indicator, no price finding: nothing wrong with this
  // tender itself, however busy its buyer happens to be.
  const entry = tenderCase({ bidders: 3, risks: ["ari-1-1"], findings: [], winner_amount: 700_000 });
  const busyPair = Array.from({ length: 9 }, (_, i) => tenderCase({ tender_id: `p${i}` }));
  const busyOfficer = Array.from({ length: 30 }, (_, i) => tenderCase({ tender_id: `o${i}` }));
  const busyBuyer = Array.from({ length: 40 }, (_, i) => tenderCase({ tender_id: `b${i}` }));

  const out = buildConclusion({ entry, sameEntity: busyBuyer, sameOfficer: busyOfficer, sameWinner: busyPair });

  assert.ok(out.observations.length >= 3, "context should still be shown");
  assert.equal(out.level, "low");
  assert.match(out.headline, /У самій закупівлі нічого не знайшли/);
});

test("one tender-specific medium finding is enough for medium priority", () => {
  const out = buildConclusion(inputFor(tenderCase({ bidders: 1, value_amount: 200_000 })));
  assert.equal(out.level, "medium");
});

test("every observation declares whether it is about this tender", () => {
  const entry = tenderCase({ bidders: 1, findings: [finding()] });
  const many = Array.from({ length: 30 }, (_, i) => tenderCase({ tender_id: `x${i}` }));
  const out = buildConclusion({ entry, sameEntity: many, sameOfficer: many, sameWinner: many });
  for (const o of out.observations) assert.equal(typeof o.aboutThisTender, "boolean");
  assert.ok(out.observations.some((o) => o.aboutThisTender));
  assert.ok(out.observations.some((o) => !o.aboutThisTender));
});

test("an established violation is the state's finding, not ours", () => {
  const entry = tenderCase({
    risks: ["ari-1-1"],
    findings: [],
    audit: {
      violation: true,
      text: "встановлено порушення частини першої статті 41 Закону",
      published: "2025-11-20T00:00:00+02:00",
      monitoring_id: "m1",
      count: 1,
      reasons: ["fiscal"],
      types: ["corruptionAwarded"],
    },
  });
  const c = buildConclusion({ entry, sameEntity: [entry], sameOfficer: [], sameWinner: [] });
  assert.equal(c.level, "high");
  assert.match(c.headline, /держава, а не ми/);
  assert.ok(c.observations.some((o) => o.title.includes("Держаудитслужба встановила порушення")));
  assert.ok(c.nextSteps.some((s) => s.includes("висновок")));
});

test("a clean audit says so plainly when nothing else is weighing in", () => {
  const entry = tenderCase({
    risks: ["ari-1-1"],
    findings: [],
    bidders: 3,
    audit: {
      violation: false,
      text: "Порушень не встановлено.",
      published: "2025-11-20T00:00:00+02:00",
      monitoring_id: "m2",
      count: 1,
      reasons: ["indicator"],
      types: [],
    },
  });
  const c = buildConclusion({ entry, sameEntity: [entry], sameOfficer: [], sameWinner: [] });
  assert.equal(c.level, "low");
  assert.match(c.headline, /порушень не встановила/);
});

test("a clean audit does not cancel a price finding", () => {
  // The auditors check the procedure. Whether the thing cost too much is a
  // separate question, and a clean monitoring is not an answer to it.
  const priceFinding = {
    tender_id: "t1",
    detector_key: "peer_price",
    tier: "own_analysis" as const,
    severity: "high" as const,
    title: "Ціна за одиницю у 3.4 раза вища за типову",
    explanation: "x",
    evidence: { unit_price: 14327, peer_median: 4248, peer_count: 114, overpayment: 6_047_304 },
    created_at: "2026-08-21T00:00:00Z",
  };
  const entry = tenderCase({
    risks: ["ari-1-1"],
    findings: [priceFinding],
    audit: {
      violation: false,
      text: "Порушень не встановлено.",
      published: "2025-11-20T00:00:00+02:00",
      monitoring_id: "m3",
      count: 1,
      reasons: ["indicator"],
      types: [],
    },
  });
  const c = buildConclusion({ entry, sameEntity: [entry], sameOfficer: [], sameWinner: [] });
  assert.equal(c.level, "high");
  assert.doesNotMatch(c.headline, /порушень не встановила/);
});
