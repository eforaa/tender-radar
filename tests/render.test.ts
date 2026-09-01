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

// Capture non-null fixture values for TypeScript type narrowing
const entityEdrpou = withEntity.entity_edrpou;
const officerKey = withOfficer.officer_key;
const winnerEdrpou = withWinner.winner_edrpou;
assert.ok(entityEdrpou, "entity has no entity_edrpou despite precondition");
assert.ok(officerKey, "officer has no officer_key despite precondition");
assert.ok(winnerEdrpou, "winner has no winner_edrpou despite precondition");

async function page(path: string) {
  return await render(new URL(`https://x.test${path}`));
}

// Each route has a distinctive marker that only it renders. Markers found in server/app.ts:
// "/" - "Закупівлі, які варто перевірити" (feedPage line 544)
// "/entities" - "Замовники" (directoryPage heading for entitiesPage line 1071)
// "/officers" - "Відповідальні посадовці" (directoryPage heading for officersPage line 1104)
// "/suppliers" - "Переможці закупівель" (directoryPage heading for suppliersPage line 1138)
// "/railway" - "Залізниця Харківської області" (railwayPage line 1221)
// "/updates" - "Що змінилося" (updatesPage line 1421)
// "/prices" - "Де ціна виглядає завищеною" (pricesPage line 1491)
// "/indicators" - "Що ми шукаємо" (indicatorsPage line 1720)
// "/about" - "Звідки дані" (aboutPage body line 1736, verified absent from server/html.ts)
// "/starred" - "Список зберігається у вашому браузері" (starredPage body line 1649, verified absent from server/html.ts)
// "/lookup" - "Пошук підприємства за ЄДРПОУ" (lookupPage line 1551)
const STATIC_ROUTES = [
  ["/", "Закупівлі, які варто перевірити"],
  ["/entities", "Замовники"],
  ["/officers", "Відповідальні посадовці"],
  ["/suppliers", "Переможці закупівель"],
  ["/railway", "Залізниця Харківської області"],
  ["/updates", "Що змінилося"],
  ["/prices", "Де ціна виглядає завищеною"],
  ["/indicators", "Що ми шукаємо"],
  ["/about", "Звідки дані"],
  ["/starred", "Список зберігається у вашому браузері"],
  ["/lookup", "Пошук підприємства за ЄДРПОУ"],
] as const;

for (const [path, marker] of STATIC_ROUTES) {
  test(`${path} renders a page`, async () => {
    const res = await page(path);
    assert.equal(res.status, 200, `${path} did not answer 200`);
    assert.ok(res.body.includes("<!doctype html>") || res.body.includes("<!DOCTYPE html>"),
      `${path} did not return a document`);
    assert.ok(res.body.length > 500, `${path} returned a suspiciously short body`);
    assert.ok(!res.body.includes("undefined</"), `${path} rendered a literal undefined`);
    assert.ok(res.body.includes(marker), `${path} does not contain distinctive marker: "${marker}"`);
  });
}

test("a tender dossier renders", async () => {
  const res = await page(`/tender/${encodeURIComponent(anyCase.tender_id)}`);
  assert.equal(res.status, 200);
  assert.ok(anyCase.tender_ref, "tender fixture has no tender_ref");
  assert.ok(res.body.includes(anyCase.tender_ref));
});

test("an entity dossier renders", async () => {
  const res = await page(`/entity/${encodeURIComponent(entityEdrpou)}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes(entityEdrpou), "entity page does not contain entity_edrpou");
  assert.ok(!res.body.includes("Такої сторінки немає"), "entity page rendered not-found");
});

test("an officer dossier renders", async () => {
  const res = await page(`/officer/${encodeURIComponent(officerKey)}`);
  assert.equal(res.status, 200);
  const identifyingText = withOfficer.officer_name || officerKey;
  assert.ok(res.body.includes(identifyingText), "officer page does not contain officer name or key");
  assert.ok(!res.body.includes("Такої сторінки немає"), "officer page rendered not-found");
});

test("a supplier dossier renders", async () => {
  const res = await page(`/supplier/${encodeURIComponent(winnerEdrpou)}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes(winnerEdrpou), "supplier page does not contain winner_edrpou");
  assert.ok(!res.body.includes("Такої сторінки немає"), "supplier page rendered not-found");
});

test("an unknown path is a 404, not a crash", async () => {
  assert.equal((await page("/no-such-page")).status, 404);
});

test("an unknown tender id is a 404", async () => {
  assert.equal((await page("/tender/UA-0000-00-00-000000-x/report")).status, 404);
});

test("the text report downloads as a file", async () => {
  const res = await page(`/tender/${encodeURIComponent(anyCase.tender_id)}/report.txt`);
  assert.equal(res.status, 200);
  assert.match(res.contentType ?? "", /text\/plain/);
  assert.ok(res.filename?.endsWith(".txt"));
});

test("the HTML report renders as a page", async () => {
  const res = await page(`/tender/${encodeURIComponent(anyCase.tender_id)}/report`);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes("<!doctype html>") || res.body.includes("<!DOCTYPE html>"),
    "HTML report did not return a document");
  assert.ok(res.body.length > 500, "HTML report returned a suspiciously short body");
});

test("an article page renders", async () => {
  const res = await page("/article/366");
  assert.equal(res.status, 200);
  assert.ok(res.body.includes("<!doctype html>") || res.body.includes("<!DOCTYPE html>"),
    "article page did not return a document");
  assert.ok(res.body.length > 500, "article page returned a suspiciously short body");
  assert.ok(res.body.includes("за статтею 366"), "article page does not contain article marker");
  assert.ok(!res.body.includes("Такої сторінки немає"), "article page rendered not-found");
});

test("filters and grouping survive a round trip through the feed", async () => {
  const res = await page("/?sort=value_desc&group=entity&preset=proven");
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 500);
});
