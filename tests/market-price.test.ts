import test from "node:test";
import assert from "node:assert/strict";
import { detectMarketPrice, normalizeMarketPrice, type MarketPrice } from "../src/analysis/market-price.ts";
import type { PricePoint } from "../src/analysis/peer-price.ts";
const point: PricePoint = { tender_id: "t", cpv_code: "30197630-1", cpv_name: null, unit_code: "PK", unit_name: "пачка",
  description: "Папір A4 80 г 500 аркушів Brand X", price: 250, quantity: 100, basis: "award", entity_edrpou: "1",
  date: "2026-10-17", currency: "UAH", vat_included: true };
const reference: MarketPrice = { id: "p", product_id: "product", title: point.description!, cpv: point.cpv_code, unit: "PK",
  currency: "UAH", vat: true, date: "2026-10-10", observed_at: "2026-10-18", sample_size: 8, lower: 90, median: 100, upper: 110,
  source_url: "https://market-api.prozorro.gov.ua/api/prices/p", product_url: "https://market-api.prozorro.gov.ua/api/products/product" };
test("market candidate retains source, historical date, range and review requirement", () => {
  const finding = detectMarketPrice(point, [reference], "2026-10-18");
  assert.ok(finding); assert.equal(finding.detector_key, "market_price");
  const e = finding.evidence as Record<string, unknown>;
  assert.equal(e.comparison_difference, 15000); assert.equal(e.source_url, reference.source_url);
  assert.equal(e.requires_review, true); assert.equal(e.overpayment, undefined);
});
test("no market signal for future, stale, sparse, wrong VAT, units, currency or generic product match", () => {
  for (const patch of [{ date: "2026-10-18" }, { date: "2026-08-01" }, { sample_size: 4 }, { vat: false },
    { currency: "EUR" }, { unit: "H87" }, { title: "Папір A4" }]) assert.equal(detectMarketPrice(point, [{ ...reference, ...patch }], "now"), null);
  assert.equal(detectMarketPrice(point, [reference, { ...reference, product_id: "other" }], "now"), null);
  assert.equal(detectMarketPrice({ ...point, basis: "expected" }, [reference], "now"), null);
});
test("market parser rejects mismatched product and impossible quartiles", () => {
  const price = { id: "a", productId: "p", currency: "UAH", valueAddedTaxIncluded: true, unitCode: "PK", date: "2026-10-10",
    sampleSize: 8, lowerQuartile: "90", medianQuartile: "100", upperQuartile: "110" };
  const product = { id: "p", title: "paper", classification: { id: "30197630-1" } };
  assert.equal(normalizeMarketPrice(price, product, "now").median, 100);
  assert.throws(() => normalizeMarketPrice({ ...price, medianQuartile: 80 }, product, "now"));
  assert.throws(() => normalizeMarketPrice(price, { ...product, id: "other" }, "now"));
});
