import type { FindingRow } from "../store/types.ts";
import type { PricePoint } from "./peer-price.ts";

export type MarketPrice = {
  id: string; product_id: string; title: string; cpv: string; unit: string;
  currency: string; vat: boolean; date: string; observed_at: string;
  sample_size: number; lower: number; median: number; upper: number;
  source_url: string; product_url: string;
};

export function normalizeMarketPrice(price: Record<string, unknown>, product: Record<string, unknown>, now: string): MarketPrice {
  const lower = Number(price.lowerQuartile), median = Number(price.medianQuartile), upper = Number(price.upperQuartile);
  const cpv = (product.classification as { id?: string })?.id;
  if (typeof price.id !== "string" || typeof price.productId !== "string" || product.id !== price.productId ||
    typeof product.title !== "string" || !cpv || typeof price.unitCode !== "string" ||
    typeof price.currency !== "string" || typeof price.valueAddedTaxIncluded !== "boolean" ||
    !Number.isInteger(price.sampleSize) || Number(price.sampleSize) < 1 ||
    ![lower, median, upper].every(n => Number.isFinite(n) && n > 0) || lower > median || median > upper ||
    typeof price.date !== "string" || !Number.isFinite(Date.parse(price.date))) throw new Error("Invalid market price record");
  return { id: price.id, product_id: price.productId, title: product.title, cpv, unit: price.unitCode,
    currency: price.currency, vat: price.valueAddedTaxIncluded, date: price.date, observed_at: now,
    sample_size: Number(price.sampleSize), lower, median, upper,
    source_url: `https://market-api.prozorro.gov.ua/api/prices/${encodeURIComponent(price.id)}`,
    product_url: `https://market-api.prozorro.gov.ua/api/products/${encodeURIComponent(price.productId)}` };
}

export function detectMarketPrice(point: PricePoint, prices: MarketPrice[], now: string): FindingRow | null {
  const normalized = (s: string | null) => (s ?? "").toLocaleLowerCase("uk-UA").replace(/\s+/g, " ").trim();
  if (point.basis !== "award" || point.currency !== "UAH" || typeof point.vat_included !== "boolean" || !point.description) return null;
  const matching = prices.filter(p => p.cpv === point.cpv_code && p.unit === point.unit_code &&
    p.currency === point.currency && p.vat === point.vat_included && normalized(p.title) === normalized(point.description));
  // A shared generic title is not a unique product match.
  if (new Set(matching.map(p => p.product_id)).size !== 1) return null;
  const historical = matching.filter(p => {
    const age = Date.parse(point.date ?? "") - Date.parse(p.date);
    return Number.isFinite(age) && age >= 0 && age <= 30 * 86400000 && p.sample_size >= 5;
  }).sort((a, b) => b.date.localeCompare(a.date));
  const reference = historical[0];
  if (!reference || point.price < reference.upper * 1.5) return null;
  const ratio = point.price / reference.median;
  return { tender_id: point.tender_id, detector_key: "market_price", tier: "own_analysis", severity: "low",
    title: "Ціна вища за орієнтир Prozorro Market — перевірте умови",
    explanation: `Ціна одиниці — ${point.price.toFixed(2)} ₴. Каталог: медіана ${reference.median.toFixed(2)} ₴, ` +
      `середні 50% цін — ${reference.lower.toFixed(2)}–${reference.upper.toFixed(2)} ₴; вибірка ${reference.sample_size}, дата ${reference.date.slice(0, 10)}. ` +
      "Збігаються назва, код, одиниця, валюта та ПДВ. Комплектацію, обсяг, доставку та оплату ще треба звірити. Це статистика каталогу, не експертиза ринкової вартості і не встановлений збиток.",
    evidence: { unit_price: point.price, market_median: reference.median, market_lower: reference.lower, market_upper: reference.upper,
      comparison_difference: (point.price - reference.median) * point.quantity, ratio, quantity: point.quantity,
      source_url: reference.source_url, product_url: reference.product_url, product_id: reference.product_id,
      reference_date: reference.date, observed_at: reference.observed_at, sample_size: reference.sample_size,
      match_basis: "exact_title_candidate", requires_review: true, comparison_version: 1 }, created_at: now };
}
