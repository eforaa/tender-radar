import { parseCsv } from "./csv.ts";
import type { RiskFlagRow, RiskRuleRow } from "../store/types.ts";
import type { RisksPage, RawRiskItem } from "../sources/risks.ts";

/**
 * The CSV export writes the triggered indicators as a Python list literal,
 * e.g. "['ari-1-1', 'ari-1-2']". Pull the quoted identifiers out of it.
 */
export function parseWorkedRisks(field: string): string[] {
  const matches = field.match(/'([^']+)'/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

function toNumber(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Expands one CSV row into one row per triggered indicator. */
export function normalizeRiskReport(csv: string): RiskFlagRow[] {
  const rows: RiskFlagRow[] = [];
  for (const record of parseCsv(csv)) {
    for (const riskId of parseWorkedRisks(record.worked_risks ?? "")) {
      rows.push({
        tender_id: record._id,
        tender_ref: record.tenderID,
        risk_id: riskId,
        date_assessed: record.dateAssessed || null,
        region: record.procuringEntityRegion || null,
        entity_edrpou: record.procuringEntityEDRPOU || null,
        entity_name: record.procuringEntityName || null,
        value_amount: toNumber(record.valueAmount ?? ""),
      });
    }
  }
  return rows;
}

/** Keeps only rows whose procuring entity sits in the given region. */
export function filterByRegion(rows: RiskFlagRow[], region: string): RiskFlagRow[] {
  return rows.filter((row) => row.region === region);
}

/** Turns flagged-tender items from the JSON API into risk flag rows. */
export function normalizeRiskItems(items: RawRiskItem[]): RiskFlagRow[] {
  const rows: RiskFlagRow[] = [];
  for (const item of items) {
    const entity = item.procuringEntity;
    for (const riskId of Object.keys(item.risks ?? {})) {
      rows.push({
        tender_id: item._id,
        tender_ref: "",
        risk_id: riskId,
        date_assessed: item.dateAssessed ?? null,
        region: entity?.address?.region ?? null,
        entity_edrpou: entity?.identifier?.id ?? null,
        entity_name: entity?.name ?? entity?.identifier?.legalName ?? null,
        value_amount: null,
      });
    }
  }
  return rows;
}

/**
 * Harvests indicator descriptions from a page of flagged tenders.
 * The descriptions repeat across tenders, so deduplicate by identifier.
 */
export function normalizeRiskRules(page: RisksPage): RiskRuleRow[] {
  const byId = new Map<string, RiskRuleRow>();
  for (const item of page.items ?? []) {
    for (const [riskId, details] of Object.entries(item.risks ?? {})) {
      const detail = details?.[0];
      if (!detail) continue;
      byId.set(riskId, {
        risk_id: riskId,
        name: detail.name ?? null,
        description: detail.description ?? null,
        legitimateness: detail.legitimateness ?? null,
        status: "active",
      });
    }
  }
  return [...byId.values()];
}
