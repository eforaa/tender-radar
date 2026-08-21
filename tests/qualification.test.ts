import test from "node:test";
import assert from "node:assert/strict";
import { buildQualification } from "../server/qualification.ts";
import { INDICATOR_LEGAL, ADMIN_ARTICLE } from "../src/legal.ts";
import type { Case } from "../server/data.ts";
import type { RiskRuleRow } from "../src/store/types.ts";

const rules = new Map<string, RiskRuleRow>([
  ["sas24-3-1", {
    risk_id: "sas24-3-1", name: "Невиконання рішення Органу оскарження", description: "d",
    legitimateness: "Стаття 18 частина 22 Закону України «Про публічні закупівлі».", status: "active",
  }],
  ["ari-1-1", { risk_id: "ari-1-1", name: "Три і більше додаткових угод", description: "d", legitimateness: null, status: "active" }],
  ["ari-1-2", { risk_id: "ari-1-2", name: "Дві і більше угод за якість", description: "d", legitimateness: null, status: "active" }],
]);

function tenderCase(risks: string[]): Case {
  return {
    tender_id: "t1", tender_ref: "UA-2026-01-01-000001-a", tender_date: "2026-01-01",
    title: "t", status: "active", method: "aboveThreshold",
    entity_edrpou: "111", entity_name: "КП", region: "Харківська область",
    value_amount: 1_000_000, date_assessed: "2026-05-01", risks,
    officer_name: null, officer_email: null, officer_phone: null, officer_key: null,
    winner_name: null, winner_edrpou: null, winner_amount: null,
    bidders: 2, detailed: true, findings: [], audit: null,
  };
}

test("a state-cited norm is marked as the state's", () => {
  const q = buildQualification(tenderCase(["sas24-3-1"]), rules);
  const norm = q.norms[0];
  assert.equal(norm.source, "state");
  assert.match(norm.norm, /Стаття 18/);
  assert.equal(norm.note, undefined);
});

test("our own reading is marked as ours and carries its justification", () => {
  const q = buildQualification(tenderCase(["ari-1-1"]), rules);
  const norm = q.norms[0];
  assert.equal(norm.source, "reading");
  assert.ok(norm.note && norm.note.length > 40);
});

test("two indicators pointing at the same norm are merged, not repeated", () => {
  // ari-1-1 and ari-1-2 both cite article 41; the second is more specific.
  const q = buildQualification(tenderCase(["ari-1-1", "ari-1-2"]), rules);
  const texts = q.norms.map((n) => n.norm);
  assert.equal(new Set(texts).size, texts.length);
});

test("an indicator listed twice contributes one entry with both sources named", () => {
  const q = buildQualification(tenderCase(["ari-1-1", "ari-1-1"]), rules);
  assert.equal(q.norms.length, 1);
  assert.equal(q.norms[0].from.length, 2);
});

test("consequences under the procurement law are collected without duplicates", () => {
  const q = buildQualification(tenderCase(["ari-1-1", "ari-1-2"]), rules);
  const norms = q.consequences.map((c) => c.norm);
  assert.equal(new Set(norms).size, norms.length);
  assert.ok(norms.some((n) => /Стаття 43/.test(n)), "nullity must be raised for contract changes");
  assert.ok(norms.some((n) => /Стаття 5/.test(n)), "the principles must be raised");
});

test("administrative exposure names the part and a real fine range", () => {
  const q = buildQualification(tenderCase(["ari-1-1"]), rules);
  assert.equal(q.admin.length, 1);
  assert.match(q.admin[0].part, /частина 3/);
  assert.match(q.admin[0].fine, /1500/);
  // 1500 нмдг at 17 UAH is 25 500 UAH; the hryvnia figure must be shown too.
  assert.match(q.admin[0].fine, /25\s?500/);
});

test("ignoring the appeal body maps to a different part than contract changes", () => {
  const changes = buildQualification(tenderCase(["ari-1-1"]), rules).admin[0].part;
  const appeal = buildQualification(tenderCase(["sas24-3-1"]), rules).admin[0].part;
  assert.notEqual(changes, appeal);
  assert.match(appeal, /частина 5/);
});

test("criminal directions are merged across indicators with their reasons kept", () => {
  const q = buildQualification(tenderCase(["ari-1-1", "ari-1-2"]), rules);
  const a366 = q.criminal.find((c) => c.code === "366");
  assert.ok(a366);
  assert.equal(a366.title, "Службове підроблення");
  assert.ok(a366.reasons.length >= 2, "both indicators give their own reason");
  assert.ok(a366.elements.length >= 3, "what must be proved is carried through");
  assert.ok(a366.evidence.length > 0, "the evidence to request is listed");
});

test("every indicator has an administrative part and at least one consequence", () => {
  for (const [id, legal] of Object.entries(INDICATOR_LEGAL)) {
    assert.ok(legal.admin, `${id} has no administrative part`);
    assert.ok(ADMIN_ARTICLE.parts[legal.admin], `${id} points at an unknown part`);
    assert.ok((legal.consequences ?? []).length > 0, `${id} has no consequence`);
  }
});

test("the qualification always states that it qualifies nothing", () => {
  const q = buildQualification(tenderCase(["ari-1-1"]), rules);
  assert.match(q.caution, /не кваліфікація дій/);
  assert.match(q.caution, /суд/);
});
