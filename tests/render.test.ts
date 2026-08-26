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
  assert.ok(res.body.includes(anyCase.tender_ref));
});

test("an entity dossier renders", () => {
  assert.equal(page(`/entity/${withEntity!.entity_edrpou}`).status, 200);
});

test("an officer dossier renders", () => {
  assert.equal(page(`/officer/${encodeURIComponent(withOfficer!.officer_key!)}`).status, 200);
});

test("a supplier dossier renders", () => {
  assert.equal(page(`/supplier/${withWinner!.winner_edrpou}`).status, 200);
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

test("filters and grouping survive a round trip through the feed", () => {
  const res = page("/?sort=value_desc&group=entity&preset=proven");
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 500);
});
