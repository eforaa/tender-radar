import test from "node:test";
import assert from "node:assert/strict";
import { ARTICLES, isJointStock } from "../src/legal.ts";
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

test("article 366 links only to indicators that exist", () => {
  for (const link of ARTICLES["366"].links) {
    assert.ok(RISK_LABELS[link.risk_id], `${link.risk_id} is not a known indicator`);
    assert.ok(link.why.length > 40, `${link.risk_id} needs a real explanation`);
  }
});

test("article 366 states what it cannot show", () => {
  const article = ARTICLES["366"];
  assert.ok(article.caution.length > 0);
  assert.ok(article.elements.length >= 3, "the elements of the offence must be spelled out");
  assert.match(article.caution, /суд/, "the caution must say a court decides");
});
