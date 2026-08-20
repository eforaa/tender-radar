// Compares every tender's unit price against other tenders that bought the
// same thing, and against the same buyer's own earlier purchases.
//
// This is the system doing its own analysis rather than repeating the state's
// verdict, so the bar for speaking up is deliberately high: a comparison is
// made only when the goods are genuinely comparable, and stays silent otherwise.

import { unitPrice, isComparableUnit } from "./unit-price.ts";
import type { TenderRow, TenderItemRow, AwardRow, FindingRow } from "../store/types.ts";

/** One tender reduced to a comparable price point. */
export type PricePoint = {
  tender_id: string;
  cpv_code: string;
  cpv_name: string | null;
  unit_code: string;
  unit_name: string | null;
  description: string | null;
  price: number;
  quantity: number;
  basis: "award" | "expected";
  entity_edrpou: string | null;
  date: string | null;
};

export type PriceGroup = {
  key: string;
  cpv_code: string;
  unit_code: string;
  unit_name: string | null;
  points: PricePoint[];
  median: number;
  p25: number;
  p75: number;
  /** p75 / p25. Large means the code covers unlike goods. */
  spread: number;
  /** Whether prices inside this code are close enough to compare at all. */
  homogeneous: boolean;
};

/** At least this many other tenders must exist before we compare against them. */
export const MIN_PEERS = 5;

/** Below this multiple of the peer median we say nothing. */
export const MIN_RATIO = 1.5;

/** A buyer's own price has to grow by this much before it is worth reporting. */
export const MIN_GROWTH = 0.4;

/**
 * How much the prices inside one CPV group are allowed to spread before we
 * treat the code as lumping unlike goods together.
 *
 * A code like 09310000-5 (electricity) buys one commodity, so its prices sit
 * close. A code like 34631000-9 (railway parts) covers everything from a
 * 415 ₴ fitting to a million-hryvnia gearbox — comparing across it produced a
 * "price rose 263754%" finding that was really two different products.
 */
export const MAX_GROUP_SPREAD = 6;

/** Words too common in procurement titles to carry meaning. */
const STOPWORDS = new Set([
  "для", "та", "і", "й", "з", "із", "на", "до", "по", "від", "у", "в", "the", "of",
  "дк", "код", "згідно", "тип", "типу", "шт", "штук", "послуги", "послуга", "роботи",
]);

function tokens(text: string | null): Set<string> {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

/**
 * Jaccard overlap between two item descriptions, 0 to 1.
 * Used to check that two purchases really are the same thing before calling
 * a price difference a price rise.
 */
export function describesSameThing(a: string | null, b: string | null): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

/** Below this overlap we do not claim two purchases are the same product. */
export const MIN_DESCRIPTION_OVERLAP = 0.34;

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Reduces the corpus to the tenders whose price can honestly be compared. */
export function pricePoints(
  tenders: TenderRow[],
  itemsByTender: Map<string, TenderItemRow[]>,
  awardsByTender: Map<string, AwardRow[]>,
): PricePoint[] {
  const points: PricePoint[] = [];
  for (const tender of tenders) {
    const items = itemsByTender.get(tender.id) ?? [];
    const priced = unitPrice({ tender, items, awards: awardsByTender.get(tender.id) ?? [] });
    if (!priced.computable) continue;

    const item = priced.item;
    if (!item.cpv_code || !isComparableUnit(item.unit_code)) continue;

    points.push({
      tender_id: tender.id,
      cpv_code: item.cpv_code,
      cpv_name: item.cpv_name,
      unit_code: item.unit_code as string,
      unit_name: item.unit_name,
      description: item.description,
      price: priced.price,
      quantity: priced.quantity,
      basis: priced.basis,
      entity_edrpou: tender.entity_edrpou,
      date: tender.date,
    });
  }
  return points;
}

/** Groups price points by what was bought and in which unit. */
export function priceGroups(points: PricePoint[]): Map<string, PriceGroup> {
  const buckets = new Map<string, PricePoint[]>();
  for (const point of points) {
    const key = `${point.cpv_code}|${point.unit_code}`;
    const list = buckets.get(key) ?? [];
    list.push(point);
    buckets.set(key, list);
  }

  const groups = new Map<string, PriceGroup>();
  for (const [key, list] of buckets) {
    const sorted = list.map((p) => p.price).sort((a, b) => a - b);
    const p25 = quantile(sorted, 0.25);
    const p75 = quantile(sorted, 0.75);
    const spread = p25 > 0 ? p75 / p25 : Infinity;
    groups.set(key, {
      key,
      cpv_code: list[0].cpv_code,
      unit_code: list[0].unit_code,
      unit_name: list[0].unit_name,
      points: list,
      median: quantile(sorted, 0.5),
      p25,
      p75,
      spread,
      homogeneous: list.length < 2 ? false : spread <= MAX_GROUP_SPREAD,
    });
  }
  return groups;
}

function severityFor(ratio: number): "low" | "medium" | "high" {
  if (ratio >= 3) return "high";
  if (ratio >= 2) return "medium";
  return "low";
}

function fmt(n: number): string {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(n);
}

/**
 * Compares one tender against every other tender that bought the same thing.
 * The tender itself is excluded from its own benchmark.
 */
export function detectPeerPrice(point: PricePoint, group: PriceGroup, now: string): FindingRow | null {
  // A code whose own prices are all over the place is not one product.
  if (!group.homogeneous) return null;

  const peers = group.points.filter((p) => p.tender_id !== point.tender_id);
  if (peers.length < MIN_PEERS) return null;

  const sorted = peers.map((p) => p.price).sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  if (median <= 0) return null;

  const ratio = point.price / median;
  if (ratio < MIN_RATIO) return null;

  const overpayment = (point.price - median) * point.quantity;
  const unit = point.unit_name ?? point.unit_code;

  return {
    tender_id: point.tender_id,
    detector_key: "peer_price",
    tier: "own_analysis",
    severity: severityFor(ratio),
    title: `Ціна за одиницю у ${ratio.toFixed(1)} раза вища за типову`,
    explanation:
      `Ціна — ${fmt(point.price)} ₴ за ${unit}. ` +
      `Інші ${peers.length} закупівель того самого предмета (код ${point.cpv_code}) мають медіану ${fmt(median)} ₴, ` +
      `середню половину — від ${fmt(quantile(sorted, 0.25))} до ${fmt(quantile(sorted, 0.75))} ₴. ` +
      `Кількість — ${fmt(point.quantity)} ${unit}, тож різниця на всю закупівлю — ${fmt(overpayment)} ₴. ` +
      `Розрахунок від ${point.basis === "award" ? "суми договору" : "очікуваної вартості"}. ` +
      `Це ознака ризику, що потребує перевірки.`,
    evidence: {
      unit_price: point.price,
      peer_median: median,
      peer_p25: quantile(sorted, 0.25),
      peer_p75: quantile(sorted, 0.75),
      peer_count: peers.length,
      ratio,
      quantity: point.quantity,
      overpayment,
      basis: point.basis,
      cpv_code: point.cpv_code,
      unit_code: point.unit_code,
    },
    created_at: now,
  };
}

/**
 * Compares a buyer's newest purchase against its own earlier purchase of the
 * same thing. Buyer-specific circumstances stay constant, so a jump here is
 * harder to explain away than a difference between two different buyers.
 */
export function detectOwnPriceGrowth(point: PricePoint, group: PriceGroup, now: string): FindingRow | null {
  if (!point.entity_edrpou || !point.date) return null;

  const earlier = group.points
    .filter(
      (p) =>
        p.entity_edrpou === point.entity_edrpou &&
        p.tender_id !== point.tender_id &&
        p.date !== null &&
        p.date < point.date!,
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // Walk back to the most recent purchase that is recognisably the same thing.
  // Without this, one CPV code covering many different railway parts produced
  // a "price rose 263754%" finding that was simply a different component.
  const previous = earlier.find(
    (p) => describesSameThing(p.description, point.description) >= MIN_DESCRIPTION_OVERLAP,
  );
  if (!previous || previous.price <= 0) return null;

  const growth = point.price / previous.price - 1;
  if (growth < MIN_GROWTH) return null;

  const unit = point.unit_name ?? point.unit_code;
  const extra = (point.price - previous.price) * point.quantity;

  return {
    tender_id: point.tender_id,
    detector_key: "own_price_growth",
    tier: "own_analysis",
    severity: growth >= 2 ? "high" : growth >= 1 ? "medium" : "low",
    title: `Той самий замовник підняв ціну на ${Math.round(growth * 100)}%`,
    explanation:
      `Цей замовник раніше купував те саме (код ${point.cpv_code}) по ${fmt(previous.price)} ₴ за ${unit}, ` +
      `тепер — по ${fmt(point.price)} ₴. Зростання на ${Math.round(growth * 100)}%. ` +
      `На обсяг ${fmt(point.quantity)} ${unit} це ${fmt(extra)} ₴ різниці. ` +
      `Порівняння всередині одного замовника, тож місцеві умови однакові. ` +
      `Це ознака ризику, що потребує перевірки.`,
    evidence: {
      unit_price: point.price,
      previous_price: previous.price,
      previous_tender_id: previous.tender_id,
      previous_date: previous.date,
      previous_description: previous.description,
      description_overlap: describesSameThing(previous.description, point.description),
      growth,
      quantity: point.quantity,
      extra_cost: extra,
      basis: point.basis,
      cpv_code: point.cpv_code,
      unit_code: point.unit_code,
    },
    created_at: now,
  };
}
