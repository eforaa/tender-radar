import test from "node:test";
import assert from "node:assert/strict";
import { readableName, procedureLabel, RISK_LABELS, GROUP_ORDER } from "../src/labels.ts";

test("folds shouting organisation names to sentence case", () => {
  assert.equal(
    readableName("ДЕПАРТАМЕНТ КАПІТАЛЬНОГО БУДІВНИЦТВА ХАРКІВСЬКОЇ ОБЛАСНОЇ ДЕРЖАВНОЇ АДМІНІСТРАЦІЇ"),
    "Департамент капітального будівництва харківської обласної державної адміністрації",
  );
});

test("keeps short abbreviations shouting and capitalises inside quotes", () => {
  assert.equal(readableName('КП "ХАРКІВСЬКІ ТЕПЛОВІ МЕРЕЖІ"'), 'КП "Харківські теплові мережі"');
});

test("leaves an already mixed-case name alone", () => {
  const name = 'Філія "Центр забезпечення виробництва" АТ "Укрзалізниця"';
  assert.equal(readableName(name), name);
});

test("handles empty input", () => {
  assert.equal(readableName(null), "");
  assert.equal(readableName(""), "");
});

test("translates known procedure codes and passes unknown ones through", () => {
  assert.equal(procedureLabel("aboveThreshold"), "Відкриті торги");
  assert.equal(procedureLabel("reporting"), "Звіт про укладений договір");
  assert.equal(procedureLabel("somethingNew"), "somethingNew");
  assert.equal(procedureLabel(null), null);
});

test("every labelled indicator belongs to a known group", () => {
  for (const [id, label] of Object.entries(RISK_LABELS)) {
    assert.ok(GROUP_ORDER.includes(label.group), `${id} has an unknown group`);
    assert.ok(label.short.length > 0 && label.means.length > 0, `${id} is missing text`);
  }
});

test("covers all fourteen active indicators", () => {
  assert.equal(Object.keys(RISK_LABELS).length, 14);
});
