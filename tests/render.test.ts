import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../server/app.ts";
import { loadDataset } from "../server/data.ts";

// Real ids from the store, so the dossier routes are exercised rather than
// 404ing past the code they are meant to cover.
const db = await loadDataset();
const withEntity = db.cases.find((c) => c.entity_edrpou);
const withOfficer = db.cases.find((c) => c.officer_key);
const withWinner = db.cases.find((c) => c.winner_edrpou);
const anyCase = db.cases[0];

// Assert fixture preconditions before tests run
assert.ok(anyCase, "no case at index 0 in the dataset — fixture assumption broken");
assert.ok(anyCase.tender_ref, "first case has no tender_ref — fixture assumption broken");
assert.ok(withEntity, "no case with an entity_edrpou in the dataset — fixture assumption broken");
assert.ok(withOfficer, "no case with an officer_key in the dataset — fixture assumption broken");
assert.ok(withWinner, "no case with a winner_edrpou in the dataset — fixture assumption broken");

function page(path: string) {
  return render(new URL(`https://x.test${path}`));
}

const STATIC_ROUTES = [
  "/", "/entities", "/officers", "/suppliers", "/railway",
  "/updates", "/prices", "/indicators", "/about", "/starred",
  "/lookup",
];

for (const path of STATIC_ROUTES) {
  test(`${path} renders a page`, () => {
    const res = page(path);
    assert.equal(res.status, 200, `${path} did not answer 200`);
    assert.ok(res.body.includes("<!doctype html>") || res.body.includes("<!DOCTYPE html>"),
      `${path} did not return a document`);
    assert.ok(res.body.length > 500, `${path} returned a suspiciously short body`);
    assert.ok(!res.body.includes("undefined</"), `${path} rendered a literal undefined`);
  });
}

test("a tender dossier renders", () => {
  const res = page(`/tender/${encodeURIComponent(anyCase.tender_id)}`);
  assert.equal(res.status, 200);
  assert.ok(anyCase.tender_ref, "tender fixture has no tender_ref");
  assert.ok(res.body.includes(anyCase.tender_ref));
});

test("an entity dossier renders", () => {
  const res = page(`/entity/${withEntity!.entity_edrpou}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes(withEntity!.entity_edrpou), "entity page does not contain entity_edrpou");
  assert.ok(!res.body.includes("Такої сторінки немає"), "entity page rendered not-found");
});

test("an officer dossier renders", () => {
  const res = page(`/officer/${encodeURIComponent(withOfficer!.officer_key!)}`);
  assert.equal(res.status, 200);
  const identifyingText = withOfficer!.officer_name || withOfficer!.officer_key;
  assert.ok(res.body.includes(identifyingText), "officer page does not contain officer name or key");
  assert.ok(!res.body.includes("Такої сторінки немає"), "officer page rendered not-found");
});

test("a supplier dossier renders", () => {
  const res = page(`/supplier/${withWinner!.winner_edrpou}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes(withWinner!.winner_edrpou), "supplier page does not contain winner_edrpou");
  assert.ok(!res.body.includes("Такої сторінки немає"), "supplier page rendered not-found");
});

test("an unknown path is a 404, not a crash", () => {
  assert.equal(page("/no-such-page").status, 404);
});

test("an unknown tender id is a 404", () => {
  assert.equal(page("/tender/UA-0000-00-00-000000-x/report").status, 404);
});

test("the text report downloads as a file", () => {
  const res = page(`/tender/${encodeURIComponent(anyCase.tender_id)}/report.txt`);
  assert.equal(res.status, 200);
  assert.match(res.contentType ?? "", /text\/plain/);
  assert.ok(res.filename?.endsWith(".txt"));
});

test("the HTML report renders as a page", () => {
  const res = page(`/tender/${encodeURIComponent(anyCase.tender_id)}/report`);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes("<!doctype html>") || res.body.includes("<!DOCTYPE html>"),
    "HTML report did not return a document");
  assert.ok(res.body.length > 500, "HTML report returned a suspiciously short body");
});

test("an article page renders", () => {
  const res = page("/article/366");
  assert.equal(res.status, 200);
  assert.ok(res.body.includes("<!doctype html>") || res.body.includes("<!DOCTYPE html>"),
    "article page did not return a document");
  assert.ok(res.body.length > 500, "article page returned a suspiciously short body");
});

test("filters and grouping survive a round trip through the feed", () => {
  const res = page("/?sort=value_desc&group=entity&preset=proven");
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 500);
});
