import type { RawTender, FeedEntry } from "../sources/openprocurement.ts";
import type { TenderRow, TenderItemRow, BidRow, AwardRow } from "../store/types.ts";

type Dict = Record<string, unknown>;

function dict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function arr(value: unknown): Dict[] {
  return Array.isArray(value) ? value.map(dict) : [];
}

/** Reads the procuring entity's region from a feed entry, if present. */
export function regionOf(entry: FeedEntry): string | null {
  return entry.procuringEntity?.address?.region ?? null;
}

/**
 * A stable key for the official who ran the tender.
 * Email first: people are recorded under spelling variants of their name,
 * but the mailbox stays the same. Falls back to name plus entity, which is
 * weaker but still better than nothing.
 */
export function officerKey(row: Pick<TenderRow, "officer_email" | "officer_name" | "entity_edrpou">): string | null {
  if (row.officer_email) return row.officer_email.trim().toLowerCase();
  if (row.officer_name && row.entity_edrpou) return `${row.officer_name.trim().toLowerCase()}@@${row.entity_edrpou}`;
  return null;
}

/** Splits a full tender card into the rows of our tables. */
export function normalizeTender(raw: RawTender): {
  tender: TenderRow;
  items: TenderItemRow[];
  bids: BidRow[];
  awards: AwardRow[];
} {
  const entity = dict(raw.procuringEntity);
  const identifier = dict(entity.identifier);
  const address = dict(entity.address);
  const contact = dict(entity.contactPoint);
  const value = dict(raw.value);

  const tender: TenderRow = {
    id: raw.id,
    tender_id: raw.tenderID,
    title: str(raw.title) ?? "",
    description: str(raw.description),
    status: str(raw.status) ?? "unknown",
    method: str(raw.procurementMethodType),
    value_amount: num(value.amount),
    currency: str(value.currency),
    date: str(raw.date) ?? str(raw.dateCreated),
    entity_edrpou: str(identifier.id),
    entity_name: str(entity.name) ?? str(identifier.legalName),
    region: str(address.region),
    locality: str(address.locality),
    officer_name: str(contact.name),
    officer_email: str(contact.email),
    officer_phone: str(contact.telephone),
    raw,
  };

  const items: TenderItemRow[] = arr(raw.items).map((item) => {
    const classification = dict(item.classification);
    const unit = dict(item.unit);
    return {
      tender_id: raw.id,
      item_id: str(item.id) ?? "",
      description: str(item.description),
      cpv_code: str(classification.id),
      cpv_name: str(classification.description),
      quantity: num(item.quantity),
      unit_code: str(unit.code),
      unit_name: str(unit.name),
      lot_id: str(item.relatedLot),
    };
  });

  const bids: BidRow[] = arr(raw.bids).map((bid) => {
    const tenderer = dict(arr(bid.tenderers)[0]);
    const tendererId = dict(tenderer.identifier);
    const bidValue = dict(bid.value);
    return {
      tender_id: raw.id,
      bid_id: str(bid.id) ?? "",
      supplier_edrpou: str(tendererId.id),
      supplier_name: str(tenderer.name) ?? str(tendererId.legalName),
      amount: num(bidValue.amount),
      status: str(bid.status),
    };
  });

  const awards: AwardRow[] = arr(raw.awards).map((award) => {
    const supplier = dict(arr(award.suppliers)[0]);
    const supplierId = dict(supplier.identifier);
    const awardValue = dict(award.value);
    return {
      tender_id: raw.id,
      award_id: str(award.id) ?? "",
      supplier_edrpou: str(supplierId.id),
      supplier_name: str(supplier.name) ?? str(supplierId.legalName),
      amount: num(awardValue.amount),
      status: str(award.status),
      date: str(award.date),
    };
  });

  return { tender, items, bids, awards };
}
