import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkedRisks, normalizeRiskReport, filterByRegion } from "../src/normalize/risk.ts";

const HEADER =
  "_id,tenderID,dateAssessed,dateModified,procuringEntityRegion,procuringEntityEDRPOU,procuringEntityName,valueAmount,valueCurrency,worked_risks";

test("reads the python-style list the export emits", () => {
  assert.deepEqual(parseWorkedRisks("['ari-1-1', 'ari-1-2']"), ["ari-1-1", "ari-1-2"]);
  assert.deepEqual(parseWorkedRisks("['sas24-3-13']"), ["sas24-3-13"]);
  assert.deepEqual(parseWorkedRisks("[]"), []);
  assert.deepEqual(parseWorkedRisks(""), []);
});

test("emits one row per tender per triggered indicator", () => {
  const rows = normalizeRiskReport(
    `${HEADER}\nabc,UA-2026-01-01-000001-a,2026-01-02T00:00:00+02:00,2026-01-01T00:00:00+02:00,Харківська область,12345678,КП ТЕСТ,1000.5,UAH,"['ari-1-1', 'ari-1-2']"`,
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.risk_id), ["ari-1-1", "ari-1-2"]);
  assert.equal(rows[0].tender_id, "abc");
  assert.equal(rows[0].tender_ref, "UA-2026-01-01-000001-a");
  assert.equal(rows[0].value_amount, 1000.5);
  assert.equal(rows[0].entity_edrpou, "12345678");
});

test("a row with no triggered indicators produces nothing", () => {
  const rows = normalizeRiskReport(`${HEADER}\nabc,UA-1,,,Харківська область,1,КП,1,UAH,[]`);
  assert.equal(rows.length, 0);
});

test("an unparsable amount becomes null rather than NaN", () => {
  const rows = normalizeRiskReport(`${HEADER}\nabc,UA-1,,,Харківська область,1,КП,,UAH,"['x']"`);
  assert.equal(rows[0].value_amount, null);
});

test("region filter matches the exact state string", () => {
  const rows = normalizeRiskReport(
    `${HEADER}\na,UA-1,,,Харківська область,1,КП,1,UAH,"['x']"\n` +
      `b,UA-2,,,Київська область,2,КП2,1,UAH,"['x']"`,
  );
  const kharkiv = filterByRegion(rows, "Харківська область");
  assert.equal(kharkiv.length, 1);
  assert.equal(kharkiv[0].tender_id, "a");
});
