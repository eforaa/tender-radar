import test from "node:test";
import assert from "node:assert/strict";
import { bucketsOf, buildGroups, isDimension, DIMENSIONS } from "../server/grouping.ts";
import type { Case } from "../server/data.ts";

const label = (id: string) => `ознака ${id}`;

function tenderCase(over: Partial<Case> = {}): Case {
  return {
    tender_id: "t1", tender_ref: "UA-2026-01-01-000001-a", tender_date: "2026-01-01", title: "Закупівля", status: "active",
    method: "aboveThreshold", entity_edrpou: "111", entity_name: "КП Тест", region: "Харківська область",
    value_amount: 100, date_assessed: "2026-05-01T00:00:00+03:00", risks: ["ari-1-1"],
    officer_name: "Іваненко І.", officer_email: "i@x.ua", officer_phone: null, officer_key: "i@x.ua",
    winner_name: "ТОВ Переможець", winner_edrpou: "222", winner_amount: 90,
    bidders: 2, detailed: true, findings: [], audit: null,
    ...over,
  };
}

test("every offered dimension is recognised", () => {
  for (const d of DIMENSIONS) assert.ok(isDimension(d.value), `${d.value} should be a dimension`);
  assert.equal(isDimension("nonsense"), false);
});

test("a tender with several indicators lands in every one of their groups", () => {
  const buckets = bucketsOf(tenderCase({ risks: ["ari-1-1", "sas24-3-7"] }), "risk", label);
  assert.deepEqual(buckets.map((b) => b.key), ["ari-1-1", "sas24-3-7"]);
});

test("missing values get an explicit bucket rather than being dropped", () => {
  assert.equal(bucketsOf(tenderCase({ officer_key: null, officer_name: null }), "officer", label)[0].label, "Відповідального не вказано");
  assert.equal(bucketsOf(tenderCase({ winner_edrpou: null, winner_name: null }), "supplier", label)[0].label, "Переможця не визначено");
});

test("the year comes from the date the state assessed the tender", () => {
  assert.equal(bucketsOf(tenderCase(), "year", label)[0].key, "2026");
});

test("severity reflects our findings and the lack of competition", () => {
  const sharp = tenderCase({ risks: ["a", "b", "c"] });
  const notable = tenderCase({ bidders: 1 });
  const plain = tenderCase();
  assert.equal(bucketsOf(sharp, "severity", label)[0].key, "Гострі");
  assert.equal(bucketsOf(notable, "severity", label)[0].key, "Помітні");
  assert.equal(bucketsOf(plain, "severity", label)[0].key, "Звичайні");
});

test("groups are ordered by total value, largest first", () => {
  const groups = buildGroups(
    [
      tenderCase({ tender_id: "a", entity_edrpou: "1", entity_name: "Малий", value_amount: 10 }),
      tenderCase({ tender_id: "b", entity_edrpou: "2", entity_name: "Великий", value_amount: 500 }),
    ],
    "entity", "", label,
  );
  assert.deepEqual(groups.map((g) => g.bucket.label), ["Великий", "Малий"]);
  assert.equal(groups[0].value, 500);
});

test("years are ordered newest first rather than by money", () => {
  const groups = buildGroups(
    [
      tenderCase({ tender_id: "a", date_assessed: "2024-01-01", value_amount: 999 }),
      tenderCase({ tender_id: "b", date_assessed: "2026-01-01", value_amount: 1 }),
    ],
    "year", "", label,
  );
  assert.deepEqual(groups.map((g) => g.bucket.key), ["2026", "2024"]);
});

test("a second level nests inside the first", () => {
  const groups = buildGroups(
    [
      tenderCase({ tender_id: "a", entity_edrpou: "1", entity_name: "КП", winner_edrpou: "x", winner_name: "Перший", value_amount: 100 }),
      tenderCase({ tender_id: "b", entity_edrpou: "1", entity_name: "КП", winner_edrpou: "y", winner_name: "Другий", value_amount: 50 }),
    ],
    "entity", "supplier", label,
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].children.length, 2);
  assert.deepEqual(groups[0].children.map((c) => c.bucket.label), ["Перший", "Другий"]);
});

test("asking for the same dimension twice does not nest it into itself", () => {
  const groups = buildGroups([tenderCase()], "entity", "entity", label);
  assert.equal(groups[0].children.length, 0);
});

test("no grouping yields no groups", () => {
  assert.deepEqual(buildGroups([tenderCase()], "", "", label), []);
});
