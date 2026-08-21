import test from "node:test";
import assert from "node:assert/strict";
import { reportText, reportHtml, type ReportContext } from "../server/report.ts";
import { buildConclusion } from "../server/conclusion.ts";
import type { Case } from "../server/data.ts";
import type { RiskRuleRow, FindingRow } from "../src/store/types.ts";

const rules = new Map<string, RiskRuleRow>([
  ["sas24-3-1", {
    risk_id: "sas24-3-1",
    name: "Невиконання замовником рішення Органу оскарження у встановлений термін",
    description: "опис",
    legitimateness: "Стаття 18 частина 22 Закону України «Про публічні закупівлі».",
    status: "active",
  }],
  ["ari-1-2", {
    risk_id: "ari-1-2",
    name: "Публікація 2х і більше додаткових угод по причині Покращення якості",
    description: "опис",
    legitimateness: null,
    status: "active",
  }],
]);

const finding: FindingRow = {
  tender_id: "t1",
  detector_key: "peer_price",
  tier: "own_analysis",
  severity: "high",
  title: "Ціна за одиницю у 3.4 раза вища за типову",
  explanation: "Ціна — 14 327 грн за гігакалорію.",
  evidence: { unit_price: 14327, peer_median: 4248, peer_count: 114, quantity: 600, overpayment: 6047304 },
  created_at: "2026-08-21T00:00:00Z",
};

function ctx(over: Partial<Case> = {}): ReportContext {
  const entry: Case = {
    tender_id: "t1", tender_ref: "UA-2024-07-11-005265-a", tender_date: "2024-07-11",
    title: "Постачання теплової енергії", status: "active", method: "aboveThreshold",
    entity_edrpou: "00131954", entity_name: 'АТ "ХАРКІВОБЛЕНЕРГО"', region: "Харківська область",
    value_amount: 8_596_206, date_assessed: "2026-04-14T00:00:00+03:00",
    risks: ["sas24-3-1", "ari-1-2"],
    officer_name: "Науменко Дмитро", officer_email: "n@x.ua", officer_phone: "380000000000", officer_key: "n@x.ua",
    winner_name: 'ПрАТ "Харківенергозбут"', winner_edrpou: "42206328", winner_amount: 8_500_000,
    bidders: 1, detailed: true, findings: [finding], audit: null,
    ...over,
  };
  return {
    entry,
    rules,
    sameEntity: 38,
    sameOfficer: 12,
    sameWinner: 171,
    conclusion: buildConclusion({ entry, sameEntity: [entry], sameOfficer: [entry], sameWinner: [entry] }),
    generatedAt: "2026-08-21T00:00:00Z",
  };
}

test("the text report carries the tender, buyer, official and winner", () => {
  const text = reportText(ctx());
  for (const needle of [
    "UA-2024-07-11-005265-a", "Постачання теплової енергії", "00131954",
    "Науменко Дмитро", "Харківенергозбут", "8 596 206",
  ]) {
    assert.ok(text.includes(needle), `missing ${needle}`);
  }
});

test("the report shows the tender's own date, not only the assessment", () => {
  const text = reportText(ctx());
  assert.match(text, /Дата закупівлі: 11\.07\.2024/);
  assert.match(text, /Дата позначки держави: 14\.04\.2026/);
});

test("a state-published norm is attributed to the state", () => {
  const text = reportText(ctx());
  assert.match(text, /Норма, яку наводить держава:.*Стаття 18/s);
});

test("our own reading is labelled as ours, never as the state's", () => {
  const text = reportText(ctx());
  assert.match(text, /Норма — зіставлення цієї системи/);
  // The provenance line for our reading must not claim state authorship.
  const ours = text.slice(text.indexOf("Норма — зіставлення цієї системи"));
  assert.ok(!ours.slice(0, 400).includes("яку наводить держава"));
});

test("criminal directions name the article and its title", () => {
  const text = reportText(ctx());
  assert.match(text, /Стаття 366 ККУ — Службове підроблення/);
});

test("the price calculation is included with its numbers", () => {
  const text = reportText(ctx());
  assert.match(text, /Ціна за одиницю у 3\.4 раза вища за типову/);
  assert.match(text, /Типова ціна \(медіана\): 4 248/);
  assert.match(text, /Порівняно із закупівлями: 114/);
});

test("the limits of the report are always stated", () => {
  // Line wrapping may split the sentence, so compare on normalised whitespace.
  const flat = reportText(ctx()).replace(/\s+/g, " ");
  assert.match(flat, /не встановлений факт порушення/);
  assert.match(flat, /Умисел і завідомість встановлює виключно суд/);
  assert.match(flat, /не кваліфікація дій будь-якої особи/);
});

test("the text file carries no non-breaking spaces", () => {
  // They survive a copy-paste into a case file as invisible junk.
  assert.ok(!reportText(ctx()).includes(" "));
});

test("a tender with no price finding simply omits that section", () => {
  const text = reportText(ctx({ findings: [] }));
  assert.ok(!text.includes("РОЗРАХУНОК ЦІНИ"));
  assert.ok(text.includes("ЩО ЗАПІДОЗРИЛА ДЕРЖАВА"));
});

test("a tender with no official omits that section rather than printing blanks", () => {
  const text = reportText(ctx({ officer_name: null }));
  assert.ok(!text.includes("ВІДПОВІДАЛЬНА ОСОБА"));
});

test("the printable report escapes the data it renders", () => {
  const html = reportHtml(ctx({ title: 'Ремонт <script>alert(1)</script> "школи"' }));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("the printable report offers printing and the text download", () => {
  const html = reportHtml(ctx());
  assert.match(html, /window\.print\(\)/);
  assert.match(html, /\/report\.txt/);
  assert.match(html, /@media print/);
});

test("the report opens with the system's own conclusion", () => {
  const text = reportText(ctx());
  assert.ok(text.indexOf("ВИСНОВОК СИСТЕМИ") < text.indexOf("ЗАКУПІВЛЯ"));
  const flat = text.replace(/\s+/g, " ");
  // The tender in this fixture has a single bidder and a price finding.
  assert.match(flat, /Конкуренції не було/);
  assert.match(flat, /Що перевірити далі/);
  assert.match(flat, /не встановлює порушення/);
});

test("the report carries the auditors' verdict, in their words", () => {
  const text = reportText(
    ctx({
      audit: {
        violation: true,
        text: "встановлено порушення частини першої статті 41 Закону",
        published: "2025-11-20T00:00:00+02:00",
        monitoring_id: "m1",
        count: 1,
        reasons: ["fiscal"],
        types: ["corruptionAwarded"],
      },
    }),
  );
  assert.match(text, /ВИСНОВОК ДЕРЖАУДИТСЛУЖБИ — ПОРУШЕННЯ ВСТАНОВЛЕНО/);
  assert.match(text, /звернення органів державного фінансового контролю/);
  assert.match(text, /порушення при визначенні переможця/);
  assert.match(text, /статті 41 Закону/);
  assert.match(text, /audit-api\.prozorro\.gov\.ua/);
  // The distinction the whole tier rests on must survive into the document.
  assert.match(text, /не встановлює, чи\s+ціна відповідає ринковій/);
});

test("a tender nobody audited gets no audit section", () => {
  assert.doesNotMatch(reportText(ctx({})), /ВИСНОВОК ДЕРЖАУДИТСЛУЖБИ/);
});
