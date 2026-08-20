import type { TenderRow, TenderItemRow, AwardRow } from "../store/types.ts";

export type UnitPriceInput = {
  tender: TenderRow;
  items: TenderItemRow[];
  awards: AwardRow[];
};

export type UnitPriceResult =
  | { computable: false; reason: string }
  | {
      computable: true;
      item: TenderItemRow;
      price: number;
      basis: "award" | "expected";
      quantity: number;
    };

const ACTIVE_AWARD_STATUSES = new Set(["active", "pending"]);

/**
 * Units that describe a measurable quantity, so a price per unit means the
 * same thing across two different tenders.
 *
 * Deliberately excludes E51 (робота), E48 (послуга) and E50 (одиниця): there
 * the quantity is almost always 1, so "price per unit" is just the contract
 * total, and comparing two unrelated construction jobs would manufacture
 * findings out of nothing.
 */
export const COMPARABLE_UNITS = new Set([
  "KWH", // кіловат-година
  "KWT", // кіловат
  "E11", // гігакалорія
  "H87", // штука
  "MTQ", // метр кубічний
  "MTR", // метр
  "MTK", // метр квадратний
  "LTR", // літр
  "TNE", // тонна
  "KGM", // кілограм
  "GRM", // грам
  "HUR", // година
  "KMT", // кілометр
  "SET", // набір
  "KT",  // комплект
  "PR",  // пара
  "MWH", // мегават-година
]);

export function isComparableUnit(unitCode: string | null): boolean {
  return unitCode !== null && COMPARABLE_UNITS.has(unitCode);
}

/**
 * Works out the price of one unit.
 *
 * Tender items carry a quantity but no price of their own, so the only
 * defensible division is a single-item tender's total by that item's quantity.
 * Anything else would attribute one total across different goods, so we
 * decline rather than guess.
 */
export function unitPrice(input: UnitPriceInput): UnitPriceResult {
  const { tender, items, awards } = input;

  if (items.length === 0) return { computable: false, reason: "у закупівлі немає позицій" };
  if (items.length > 1) {
    return { computable: false, reason: "у закупівлі кілька позицій, тому загальну суму не можна віднести до однієї з них" };
  }

  const item = items[0];
  const quantity = item.quantity;
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return { computable: false, reason: "у позиції немає додатної кількості" };
  }

  const activeAward = awards.find(
    (a) => a.status !== null && ACTIVE_AWARD_STATUSES.has(a.status) && a.amount !== null && a.amount > 0,
  );
  const amount = activeAward?.amount ?? tender.value_amount;
  const basis: "award" | "expected" = activeAward ? "award" : "expected";

  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return { computable: false, reason: "у закупівлі немає додатної суми" };
  }

  return { computable: true, item, price: amount / quantity, basis, quantity };
}
