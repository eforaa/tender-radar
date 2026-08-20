import test from "node:test";
import assert from "node:assert/strict";
import { unitPrice, isComparableUnit } from "../src/analysis/unit-price.ts";
import {
  quantile, pricePoints, priceGroups, detectPeerPrice, detectOwnPriceGrowth,
  describesSameThing, MIN_PEERS,
  type PricePoint,
} from "../src/analysis/peer-price.ts";
import type { TenderRow, TenderItemRow, AwardRow } from "../src/store/types.ts";

/* ---------- fixtures ---------- */

function tender(id: string, amount: number | null, edrpou = "111", date = "2026-01-01"): TenderRow {
  return {
    id, tender_id: `UA-${id}`, title: "t", description: null, status: "active", method: null,
    value_amount: amount, currency: "UAH", date, entity_edrpou: edrpou, entity_name: "КП",
    region: "Харківська область", locality: null,
    officer_name: null, officer_email: null, officer_phone: null, raw: {},
  };
}
function item(tid: string, quantity: number | null, unit = "KWH", cpv: string | null = "09310000-5"): TenderItemRow {
  return {
    tender_id: tid, item_id: "i1", description: "електроенергія", cpv_code: cpv, cpv_name: null,
    quantity, unit_code: unit, unit_name: "кіловат-година", lot_id: null,
  };
}
function award(tid: string, amount: number, status = "active"): AwardRow {
  return { tender_id: tid, award_id: "a", supplier_edrpou: "9", supplier_name: "ТОВ", amount, status, date: null };
}
function point(
  id: string, price: number, edrpou = "111", date = "2026-01-01",
  description = "електрична енергія активна",
): PricePoint {
  return {
    tender_id: id, cpv_code: "09310000-5", cpv_name: null, unit_code: "KWH", unit_name: "кіловат-година",
    description, price, quantity: 100, basis: "award", entity_edrpou: edrpou, date,
  };
}

/* ---------- unit price ---------- */

test("divides the contract amount by the quantity", () => {
  const out = unitPrice({ tender: tender("t", 1000), items: [item("t", 100)], awards: [award("t", 900)] });
  assert.equal(out.computable, true);
  if (!out.computable) return;
  assert.equal(out.price, 9);
  assert.equal(out.basis, "award");
});

test("falls back to the expected value when no award is active", () => {
  const out = unitPrice({ tender: tender("t", 1000), items: [item("t", 100)], awards: [award("t", 900, "cancelled")] });
  assert.equal(out.computable, true);
  if (!out.computable) return;
  assert.equal(out.price, 10);
  assert.equal(out.basis, "expected");
});

test("refuses a multi-item tender", () => {
  const out = unitPrice({ tender: tender("t", 1000), items: [item("t", 1), { ...item("t", 2), item_id: "i2" }], awards: [] });
  assert.equal(out.computable, false);
});

test("refuses missing quantity or amount", () => {
  assert.equal(unitPrice({ tender: tender("t", 1000), items: [item("t", 0)], awards: [] }).computable, false);
  assert.equal(unitPrice({ tender: tender("t", null), items: [item("t", 10)], awards: [] }).computable, false);
});

test("only measurable units are comparable", () => {
  assert.ok(isComparableUnit("KWH"));
  assert.ok(isComparableUnit("H87"));
  // "робота" and "послуга" carry quantity 1, so a unit price is just the total.
  assert.equal(isComparableUnit("E51"), false);
  assert.equal(isComparableUnit("E48"), false);
  assert.equal(isComparableUnit("E50"), false);
  assert.equal(isComparableUnit(null), false);
});

/* ---------- grouping ---------- */

test("quantile handles the ordinary cases", () => {
  assert.equal(quantile([1, 2, 3], 0.5), 2);
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([5], 0.5), 5);
  assert.equal(quantile([], 0.5), 0);
});

test("price points skip tenders whose unit is not comparable", () => {
  const tenders = [tender("a", 1000), tender("b", 1000)];
  const items = new Map([
    ["a", [item("a", 100, "KWH")]],
    ["b", [item("b", 1, "E51")]],
  ]);
  const points = pricePoints(tenders, items, new Map());
  assert.equal(points.length, 1);
  assert.equal(points[0].tender_id, "a");
});

test("groups split by both subject and unit", () => {
  const groups = priceGroups([
    point("a", 10), point("b", 12),
    { ...point("c", 3), unit_code: "MWH" },
  ]);
  assert.equal(groups.size, 2);
  assert.equal(groups.get("09310000-5|KWH")?.points.length, 2);
});

/* ---------- peer comparison ---------- */

test("stays silent when there are too few tenders to compare against", () => {
  const points = [point("x", 100), point("b", 10), point("c", 10)];
  const group = priceGroups(points).get("09310000-5|KWH")!;
  assert.equal(detectPeerPrice(points[0], group, "now"), null);
});

test("stays silent when the price sits near the median", () => {
  const points = [point("x", 10.5), ...Array.from({ length: MIN_PEERS }, (_, i) => point(`p${i}`, 10))];
  const group = priceGroups(points).get("09310000-5|KWH")!;
  assert.equal(detectPeerPrice(points[0], group, "now"), null);
});

test("reports a price well above the peer median, with the arithmetic", () => {
  const points = [point("x", 30), ...Array.from({ length: 6 }, (_, i) => point(`p${i}`, 10))];
  const group = priceGroups(points).get("09310000-5|KWH")!;
  const finding = detectPeerPrice(points[0], group, "now");
  assert.ok(finding);
  assert.equal(finding.detector_key, "peer_price");
  assert.equal(finding.tier, "own_analysis");
  assert.equal(finding.severity, "high");
  const e = finding.evidence as Record<string, number>;
  assert.equal(e.peer_median, 10);
  assert.equal(e.peer_count, 6);
  assert.equal(e.ratio, 3);
  assert.equal(e.overpayment, 2000); // (30 − 10) × 100
});

test("a tender is not part of its own benchmark", () => {
  // Six identical outliers: if self-inclusion happened the median would be the
  // outlier price and nothing would ever be reported.
  const points = [point("x", 30), ...Array.from({ length: 6 }, (_, i) => point(`p${i}`, 10))];
  const group = priceGroups(points).get("09310000-5|KWH")!;
  const e = detectPeerPrice(points[0], group, "now")!.evidence as Record<string, number>;
  assert.equal(e.peer_count, 6);
  assert.equal(e.peer_median, 10);
});

/* ---------- a buyer against itself ---------- */

test("reports a buyer whose own price jumped", () => {
  const older = point("old", 10, "555", "2025-01-01");
  const newer = point("new", 20, "555", "2026-01-01");
  const group = priceGroups([older, newer]).get("09310000-5|KWH")!;
  const finding = detectOwnPriceGrowth(newer, group, "now");
  assert.ok(finding);
  assert.equal(finding.detector_key, "own_price_growth");
  const e = finding.evidence as Record<string, number | string>;
  assert.equal(e.previous_price, 10);
  assert.equal(e.previous_tender_id, "old");
  assert.equal(e.growth, 1);
});

test("ignores a different buyer's earlier price", () => {
  const other = point("old", 10, "999", "2025-01-01");
  const mine = point("new", 20, "555", "2026-01-01");
  const group = priceGroups([other, mine]).get("09310000-5|KWH")!;
  assert.equal(detectOwnPriceGrowth(mine, group, "now"), null);
});

test("ignores a later tender when looking for the previous one", () => {
  const later = point("later", 40, "555", "2026-06-01");
  const mine = point("new", 20, "555", "2026-01-01");
  const group = priceGroups([later, mine]).get("09310000-5|KWH")!;
  assert.equal(detectOwnPriceGrowth(mine, group, "now"), null);
});

test("a modest rise is not reported", () => {
  const older = point("old", 10, "555", "2025-01-01");
  const newer = point("new", 11, "555", "2026-01-01");
  const group = priceGroups([older, newer]).get("09310000-5|KWH")!;
  assert.equal(detectOwnPriceGrowth(newer, group, "now"), null);
});

/* ---------- guards against comparing unlike things ---------- */

test("recognises the same product described slightly differently", () => {
  assert.ok(describesSameThing("Щебінь фракції 20-40", "щебінь фракції 5-20") >= 0.34);
  assert.ok(describesSameThing("Електрична енергія активна", "електрична енергія") >= 0.34);
});

test("does not confuse two different railway parts under one code", () => {
  // The pairing that produced a "price rose 263754%" finding.
  const overlap = describesSameThing(
    "Редуктор від середньої частини вісі типу ВБА 32/2",
    "Прокладка гумова ущільнювальна",
  );
  assert.ok(overlap < 0.34, `expected a low overlap, got ${overlap}`);
});

test("an empty description never counts as a match", () => {
  assert.equal(describesSameThing(null, "щебінь"), 0);
  assert.equal(describesSameThing("щебінь", null), 0);
});

test("a price group whose own prices are wildly spread is not comparable", () => {
  // One code covering a 400 ₴ part and a million-hryvnia gearbox.
  const wild = priceGroups([
    point("a", 400), point("b", 450), point("c", 500),
    point("d", 900_000), point("e", 1_000_000), point("f", 1_100_000),
    point("g", 1_200_000),
  ]).get("09310000-5|KWH")!;
  assert.equal(wild.homogeneous, false);
  assert.equal(detectPeerPrice(wild.points[6], wild, "now"), null);
});

test("a commodity group stays comparable", () => {
  const tight = priceGroups([
    point("a", 9), point("b", 9.5), point("c", 10), point("d", 10.5),
    point("e", 11), point("f", 11.5), point("g", 30),
  ]).get("09310000-5|KWH")!;
  assert.equal(tight.homogeneous, true);
  assert.ok(detectPeerPrice(tight.points[6], tight, "now"));
});

test("skips an earlier purchase that was a different product", () => {
  const other = point("old", 415, "555", "2025-01-01", "Прокладка гумова ущільнювальна");
  const mine = point("new", 1_094_993, "555", "2026-01-01", "Редуктор від середньої частини вісі типу ВБА 32/2");
  const group = priceGroups([other, mine]).get("09310000-5|KWH")!;
  assert.equal(detectOwnPriceGrowth(mine, group, "now"), null);
});

test("walks back past an unrelated purchase to the matching one", () => {
  const same = point("older", 800, "555", "2024-01-01", "Щебінь фракції 20-40");
  const noise = point("mid", 5, "555", "2025-01-01", "Пісок будівельний річковий");
  const mine = point("new", 1900, "555", "2026-01-01", "Щебінь фракції 20-40");
  const group = priceGroups([same, noise, mine]).get("09310000-5|KWH")!;
  const finding = detectOwnPriceGrowth(mine, group, "now");
  assert.ok(finding);
  const e = finding.evidence as Record<string, unknown>;
  assert.equal(e.previous_tender_id, "older");
});
