import test from "node:test";
import assert from "node:assert/strict";
import { ARTICLES, INDICATOR_LEGAL, isJointStock } from "../src/legal.ts";
import { RISK_LABELS } from "../src/labels.ts";

test("recognises joint-stock companies in every spelling the registers use", () => {
  // The register writes the same company several ways; all must match.
  assert.ok(isJointStock('АТ "Харківобленерго"'));
  assert.ok(isJointStock('АТ "ХАРКІВОБЛЕНЕРГО"'));
  assert.ok(isJointStock('АКЦІОНЕРНЕ ТОВАРИСТВО "ХАРКІВОБЛЕНЕРГО"'));
  assert.ok(isJointStock('Акціонерне товариство "Харківобленерго"'));
  assert.ok(isJointStock('ПАТ "ЗАВОД ФРУНЗЕ"'));
  assert.ok(isJointStock('ПрАТ "Укргідроенерго"'));
  assert.ok(isJointStock('РЕГІОНАЛЬНА ФІЛІЯ "ПІВДЕННА ЗАЛІЗНИЦЯ" АКЦІОНЕРНОГО ТОВАРИСТВА "УКРЗАЛІЗНИЦЯ"'));
});

test("does not mistake other legal forms for joint-stock", () => {
  assert.equal(isJointStock('ТОВ "Будівельник"'), false);
  assert.equal(isJointStock("КП «Харківські теплові мережі»"), false);
  assert.equal(isJointStock("Департамент капітального будівництва"), false);
  assert.equal(isJointStock(null), false);
});

test("does not match АТ buried inside a longer word", () => {
  assert.equal(isJointStock("АТЕСТАЦІЙНА комісія"), false);
  assert.equal(isJointStock("Комбінат АТЛАНТ"), false);
});

test("every article links only to indicators that exist", () => {
  for (const article of Object.values(ARTICLES)) {
    for (const link of article.links) {
      assert.ok(RISK_LABELS[link.risk_id], `${article.code} links to unknown indicator ${link.risk_id}`);
      assert.ok(link.why.length > 40, `${article.code} → ${link.risk_id} needs a real explanation`);
    }
  }
});

test("every article states what it cannot show and what must be proved", () => {
  for (const article of Object.values(ARTICLES)) {
    assert.ok(article.elements.length >= 3, `${article.code} must spell out the elements`);
    assert.match(article.caution, /суд/, `${article.code} caution must say a court decides`);
    assert.ok(article.title.length > 0 && article.summary.length > 40);
  }
});

test("the four articles a procurement case usually touches are present", () => {
  for (const code of ["191", "364", "366", "367"]) {
    assert.ok(ARTICLES[code], `article ${code} is missing`);
  }
});

test("every indicator has a legal reading, and it names only known articles", () => {
  for (const [riskId, legal] of Object.entries(INDICATOR_LEGAL)) {
    assert.ok(RISK_LABELS[riskId], `${riskId} is not a known indicator`);
    assert.ok(legal.criminal.length > 0, `${riskId} has no criminal direction`);
    for (const direction of legal.criminal) {
      assert.ok(ARTICLES[direction.code], `${riskId} points at unknown article ${direction.code}`);
      assert.ok(direction.why.length > 40, `${riskId} → ${direction.code} needs a real explanation`);
    }
  }
});

test("all fourteen indicators are covered", () => {
  assert.equal(Object.keys(INDICATOR_LEGAL).length, 14);
  for (const riskId of Object.keys(RISK_LABELS)) {
    assert.ok(INDICATOR_LEGAL[riskId], `${riskId} has no legal entry`);
  }
});

test("a norm we inferred always carries the note explaining why", () => {
  // Provenance is the whole point: an unsourced norm presented bare would
  // read as though the state had cited it.
  for (const [riskId, legal] of Object.entries(INDICATOR_LEGAL)) {
    if (legal.norm) {
      assert.ok(legal.normNote, `${riskId} states a norm without saying where it came from`);
      assert.ok(legal.normNote.length > 40, `${riskId} note is too thin to be honest`);
    }
  }
});

test("the quality-improvement indicator cites the condition that makes it a contradiction", () => {
  // Article 41 part 5 point 3 permits quality improvement only if the amount
  // does not rise, which is exactly what this indicator catches.
  const legal = INDICATOR_LEGAL["ari-1-2"];
  assert.match(legal.norm ?? "", /не призведе до збільшення суми/);
});
