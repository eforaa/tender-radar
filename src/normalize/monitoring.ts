import type { RawMonitoring } from "../sources/audit.ts";
import type { MonitoringRow, FindingRow } from "../store/types.ts";

type Conclusion = {
  violationOccurred?: boolean;
  violationType?: string[];
  otherViolationType?: string;
  description?: string;
  datePublished?: string;
  dateCreated?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** The conclusion, minus everything the site does not read. */
function slimConclusion(conclusion: Conclusion): Conclusion | null {
  if (typeof conclusion.violationOccurred !== "boolean" && !conclusion.description) return null;
  // Half the conclusions run past a thousand characters and one reaches
  // fourteen thousand. The page shows six hundred; the cap leaves headroom
  // and keeps the tail from doubling the dataset.
  const description = (conclusion.description ?? "").replace(/\s+/g, " ").trim();
  return {
    violationOccurred: conclusion.violationOccurred,
    violationType: conclusion.violationType,
    otherViolationType: conclusion.otherViolationType,
    description: description.length > 1200 ? description.slice(0, 1200) + "…" : description,
    datePublished: conclusion.datePublished,
    dateCreated: conclusion.dateCreated,
  };
}

/**
 * Flattens one monitoring into the row the store keeps.
 *
 * Kept deliberately narrow. A full conclusion averages 16 KB, almost all of it
 * `auditFinding` — the structured per-question audit trail — and the decision
 * that opened the monitoring runs to pages of statute. Stored whole, 7193
 * monitorings came to 124 MB, and in CI the store *is* the deployed dataset:
 * there is no fat working copy to slim afterwards. Both can be re-fetched from
 * the API by id if a later feature wants them.
 */
export function normalizeMonitoring(raw: RawMonitoring): MonitoringRow {
  const conclusion = asRecord(raw.conclusion) as Conclusion;

  return {
    monitoring_id: String(raw.id),
    tender_id: String(raw.tender_id ?? ""),
    status: String(raw.status ?? ""),
    // The decision that opens a monitoring is pages of statute and came to
    // 3.7 MB across the set. `reasons` carries the same ground as a code.
    decision_text: null,
    reasons: raw.reasons ?? null,
    conclusion: slimConclusion(conclusion),
    date_created: asString(raw.dateCreated),
    date_modified: asString(raw.dateModified),
  };
}

/**
 * Did the auditors establish a violation?
 *
 * `null` means they have not said either way — the monitoring is still open,
 * or it ended without a published conclusion. That is deliberately distinct
 * from `false`: "not checked" and "checked, nothing found" are different
 * things to print next to a named organisation.
 */
export function violationEstablished(row: MonitoringRow): boolean | null {
  const conclusion = asRecord(row.conclusion) as Conclusion;
  return typeof conclusion.violationOccurred === "boolean" ? conclusion.violationOccurred : null;
}

/** The auditors' own wording, trimmed to something a person will read. */
export function conclusionText(row: MonitoringRow, max = 600): string {
  const conclusion = asRecord(row.conclusion) as Conclusion;
  const text = (conclusion.description ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = cut.lastIndexOf(" ");
  return (stop > max * 0.6 ? cut.slice(0, stop) : cut) + "…";
}

export function conclusionPublished(row: MonitoringRow): string | null {
  const conclusion = asRecord(row.conclusion) as Conclusion;
  return asString(conclusion.datePublished) ?? asString(conclusion.dateCreated) ?? row.date_modified;
}

/**
 * A monitoring that established a violation is the strongest thing this site
 * can show: not an indicator that fired, but the state's own finding. It
 * becomes a `confirmed` finding so it outranks everything else on the tender.
 */
export function findingFromMonitoring(row: MonitoringRow): FindingRow | null {
  if (violationEstablished(row) !== true) return null;

  const text = conclusionText(row);
  return {
    tender_id: row.tender_id,
    detector_key: `dasu-monitoring:${row.monitoring_id}`,
    tier: "confirmed",
    severity: "high",
    title: "Держаудитслужба встановила порушення",
    explanation: text || "Моніторинг завершено висновком про порушення. Текст висновку не опубліковано в API.",
    evidence: {
      monitoring_id: row.monitoring_id,
      status: row.status,
      published: conclusionPublished(row),
      source: `https://audit-api.prozorro.gov.ua/api/2.5/monitorings/${row.monitoring_id}`,
    },
    created_at: conclusionPublished(row) ?? new Date().toISOString(),
  };
}
