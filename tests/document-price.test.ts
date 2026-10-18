import test from "node:test";
import assert from "node:assert/strict";
import { compareDocumentPrices, documentPriceFindings, priceNumber, priceUnit, type ContractPriceContext } from "../src/analysis/document-price.ts";
import type { DocumentResult } from "../src/documents/types.ts";
import type { TenderItemRow } from "../src/store/types.ts";
import type { MarketPrice } from "../src/analysis/market-price.ts";
import { documentPriceSection } from "../server/components/document-prices.ts";

const now = "2026-10-18T12:00:00Z";
const item: TenderItemRow = { tender_id: "t", item_id: "api-1", description: "Молоко 2,5% ДСТУ 2661", cpv_code: "15510000-6", cpv_name: "Молоко", quantity: 10, unit_code: "KGM", unit_name: "кг", lot_id: null };
const reference: MarketPrice = { id: "p", product_id: "product", title: item.description!, cpv: item.cpv_code!, unit: "KGM", currency: "UAH", vat: false, date: "2026-10-17T00:00:00Z", observed_at: now, sample_size: 10, lower: 90, median: 100, upper: 110, source_url: "https://market-api.prozorro.gov.ua/api/prices/p", product_url: "https://market-api.prozorro.gov.ua/api/products/product" };
function doc(): DocumentResult {
  const row = "Молоко 2,5% ДСТУ 2661 | 10 кг | 200 грн без ПДВ";
  return { key: "d", tender_id: "t", document: { id: "d", title: "Договір.pdf", url: "https://public-docs.prozorro.gov.ua/get/d", format: "application/pdf", modified: now, kind: "Договір та додатки" }, status: "ready", updated_at: now, page_count: 1, processed_pages: 1, ocr_pages: [], rejected_count: 0, message: "", attempts: 1,
    claims: ([ ["description", item.description!], ["unit_price", "200"], ["quantity", "10"], ["unit", "кг"], ["currency", "грн"], ["vat", "без ПДВ"] ] as const).map(([field, value]) => ({ item_id: "row1", field, value, quote: row, page: 1, method: "text" })) };
}
test("document comparison computes unit and total differences with both sources", () => {
  const [r] = compareDocumentPrices([doc()], [item], [reference], now);
  assert.equal(r.status, "signal"); assert.equal(r.difference_per_unit, 100); assert.equal(r.comparison_difference, 1000); assert.equal(r.difference_percent, 100);
  const [finding] = documentPriceFindings([r]); assert.equal(finding.detector_key, "document_market_price");
  const html = documentPriceSection([r]); assert.ok(html.includes(reference.source_url)); assert.ok(html.includes(r.document_url)); assert.match(html, /не є встановленим збитком/);
});
test("no signal below the threshold, but comparison remains visible", () => {
  const [r] = compareDocumentPrices([doc()], [item], [{ ...reference, median: 190, lower: 180, upper: 210 }], now);
  assert.equal(r.status, "compared"); assert.equal(r.comparison_difference, 100); assert.equal(documentPriceFindings([r]).length, 0);
});
test("missing VAT, conflicting units and stale/future dates block arithmetic", () => {
  const d = doc(); d.claims = d.claims.filter(c => c.field !== "vat");
  assert.equal(compareDocumentPrices([d], [item], [reference], now)[0].status, "insufficient");
  for (const ref of [{ ...reference, vat: true }, { ...reference, unit: "H87" }, { ...reference, date: "2020-01-01" }, { ...reference, date: "2027-01-01" }, { ...reference, title: "Молоко 3,2% ДСТУ 2661" }]) {
    const [r] = compareDocumentPrices([doc()], [item], [ref], now); assert.equal(r.status, "insufficient"); assert.equal(r.comparison_difference, undefined);
  }
});
test("contract evidence corroborates three decimal price and VAT conversion without guessing tax rates", () => {
  const d = doc(); d.claims = d.claims.filter(c => c.field !== "currency");
  for (const c of d.claims) { if (c.field === "unit_price") c.value = "40,608"; if (c.field === "quantity") c.value = "2000"; if (c.field === "vat") c.value = "з ПДВ"; c.quote = "Молоко 2,5% ДСТУ 2661 | 2000 кг | 40,608 грн з ПДВ"; }
  const context: ContractPriceContext = { tender_id: "t", contract_id: "a".repeat(32), contract: { status: "active", documents: [{ id: "d" }], value: { amount: 81216, amountNet: 67680, currency: "UAH", valueAddedTaxIncluded: true }, items: [{ id: "api-1", product: "product", quantity: 2000, classification: { id: item.cpv_code! }, unit: { code: "KGM", value: { amount: 33.84, currency: "UAH", valueAddedTaxIncluded: false } } }] } };
  const ref = { ...reference, title: "Інша назва бренду того самого товару", lower: 29, median: 30, upper: 35 };
  const [r] = compareDocumentPrices([d], [{ ...item, quantity: 2000 }], [ref], now, [context]);
  assert.equal(r.document_unit_price, 40.608); assert.equal(r.unit_price, 33.84); assert.equal(r.vat, false);
  assert.equal(r.comparison_difference, 7680); assert.ok(r.normalization); assert.equal(r.reference?.product_id, "product");
  context.contract.value!.amount = 90000;
  assert.equal(compareDocumentPrices([d], [item], [ref], now, [context])[0].status, "insufficient");
});
test("small samples show arithmetic but can never create an overpricing signal", () => {
  const [r] = compareDocumentPrices([doc()], [item], [{ ...reference, sample_size: 2 }], now);
  assert.equal(r.status, "limited"); assert.equal(r.comparison_difference, 1000); assert.equal(documentPriceFindings([r]).length, 0);
});
test("ambiguous products and substring quantities do not create false overpricing", () => {
  assert.equal(compareDocumentPrices([doc()], [item], [reference, { ...reference, product_id: "other" }], now)[0].status, "insufficient");
  const d = doc(); d.claims.find(c => c.field === "quantity")!.value = "1";
  assert.equal(compareDocumentPrices([d], [item], [reference], now)[0].status, "insufficient");
});
test("newer document version replaces older price evidence", () => {
  const newer = doc(); newer.key = "new"; newer.document.modified = "2026-10-19"; newer.claims = [];
  assert.equal(compareDocumentPrices([doc(), newer], [item], [reference], now).length, 0);
});
test("locale numbers are strict and packages are not guessed as individual units", () => {
  assert.equal(priceNumber("1 234,56"), 1234.56); assert.equal(priceNumber("0,25"), .25);
  for (const s of ["1,234", "1.234", "1e5", "-3", "10 грн", "12 34"]) assert.equal(priceNumber(s), null);
  assert.equal(priceUnit("кг"), "KGM"); assert.equal(priceUnit("упаковка"), null);
});
