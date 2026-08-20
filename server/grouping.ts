// Grouping for the tender list: one or two levels, chosen by the reader.
import type { Case } from "./data.ts";

export type Dimension = "" | "entity" | "officer" | "supplier" | "risk" | "year" | "method" | "severity";

export const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "", label: "Без групування" },
  { value: "entity", label: "За замовником" },
  { value: "officer", label: "За відповідальним" },
  { value: "supplier", label: "За переможцем" },
  { value: "risk", label: "За ознакою" },
  { value: "year", label: "За роком" },
  { value: "method", label: "За процедурою" },
  { value: "severity", label: "За гостротою" },
];

export function isDimension(value: string): value is Dimension {
  return DIMENSIONS.some((d) => d.value === value);
}

export type Bucket = {
  /** Stable key, used for sorting and for the nested map. */
  key: string;
  /** What the reader sees. */
  label: string;
  /** Where the group's own page lives, when it has one. */
  href: string | null;
};

const SEVERITY_ORDER: Record<string, number> = { Гострі: 0, Помітні: 1, Звичайні: 2 };

/**
 * Which buckets one tender belongs to.
 *
 * Returns several for dimensions that are genuinely multi-valued: a tender with
 * three indicators appears under each of the three. That is the honest
 * rendering — collapsing it to the "main" indicator would hide two of them.
 */
export function bucketsOf(entry: Case, dimension: Dimension, riskLabel: (id: string) => string): Bucket[] {
  switch (dimension) {
    case "entity":
      return [
        {
          key: entry.entity_edrpou ?? "—",
          label: entry.entity_name ?? "Замовник не вказаний",
          href: entry.entity_edrpou ? `/entity/${encodeURIComponent(entry.entity_edrpou)}` : null,
        },
      ];
    case "officer":
      return entry.officer_key
        ? [{ key: entry.officer_key, label: entry.officer_name ?? entry.officer_key, href: `/officer/${encodeURIComponent(entry.officer_key)}` }]
        : [{ key: "—", label: "Відповідального не вказано", href: null }];
    case "supplier":
      return entry.winner_edrpou
        ? [{ key: entry.winner_edrpou, label: entry.winner_name ?? entry.winner_edrpou, href: `/supplier/${encodeURIComponent(entry.winner_edrpou)}` }]
        : [{ key: "—", label: "Переможця не визначено", href: null }];
    case "risk":
      return entry.risks.map((id) => ({ key: id, label: riskLabel(id), href: `/?risk=${encodeURIComponent(id)}` }));
    case "year": {
      const year = (entry.date_assessed ?? entry.tender_ref.slice(3, 7) ?? "").slice(0, 4);
      return [{ key: year || "—", label: year ? `${year} рік` : "Рік невідомий", href: null }];
    }
    case "method":
      return [{ key: entry.method ?? "—", label: entry.method ?? "Процедуру не вказано", href: null }];
    case "severity": {
      const label =
        entry.findings.some((f) => f.severity === "high") || entry.risks.length >= 3
          ? "Гострі"
          : entry.findings.length > 0 || entry.bidders === 1
            ? "Помітні"
            : "Звичайні";
      return [{ key: label, label, href: null }];
    }
    default:
      return [];
  }
}

export type Group = {
  bucket: Bucket;
  cases: Case[];
  value: number;
  children: Group[];
};

function sum(cases: Case[]): number {
  return cases.reduce((total, c) => total + (c.value_amount ?? 0), 0);
}

function sortGroups(groups: Group[], dimension: Dimension): Group[] {
  if (dimension === "year") return groups.sort((a, b) => b.bucket.key.localeCompare(a.bucket.key));
  if (dimension === "severity") {
    return groups.sort((a, b) => (SEVERITY_ORDER[a.bucket.key] ?? 9) - (SEVERITY_ORDER[b.bucket.key] ?? 9));
  }
  return groups.sort((a, b) => b.value - a.value || b.cases.length - a.cases.length);
}

/** Builds one or two levels of grouping over the filtered list. */
export function buildGroups(
  cases: Case[],
  first: Dimension,
  second: Dimension,
  riskLabel: (id: string) => string,
): Group[] {
  if (!first) return [];

  const byKey = new Map<string, { bucket: Bucket; cases: Case[] }>();
  for (const entry of cases) {
    for (const bucket of bucketsOf(entry, first, riskLabel)) {
      const group = byKey.get(bucket.key) ?? { bucket, cases: [] };
      group.cases.push(entry);
      byKey.set(bucket.key, group);
    }
  }

  const groups: Group[] = [...byKey.values()].map(({ bucket, cases: inner }) => ({
    bucket,
    cases: inner,
    value: sum(inner),
    children: second && second !== first ? buildGroups(inner, second, "", riskLabel) : [],
  }));

  return sortGroups(groups, first);
}
