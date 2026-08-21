// Shared list controls: the filter panel, the filtering itself, sorting and
// grouping. One implementation, used by every page that shows a list of
// tenders, so the panel cannot behave differently depending on which tab you
// are standing in.
import type { Case } from "./data.ts";
import { isDimension, type Dimension } from "./grouping.ts";

export type Controls = {
  q: string;
  risk: string;
  region: string;
  sort: string;
  railOnly: boolean;
  soloOnly: boolean;
  priceOnly: boolean;
  /** "" any · "violation" auditors found something · "clear" they did not. */
  audit: string;
  dateFrom: string;
  dateTo: string;
  min: number;
  max: number;
  group: Dimension;
  then: Dimension;
  page: number;
};

export function readControls(url: URL): Controls {
  const rawGroup = url.searchParams.get("group") ?? "";
  const rawThen = url.searchParams.get("then") ?? "";
  return {
    q: (url.searchParams.get("q") ?? "").trim().toLowerCase(),
    risk: url.searchParams.get("risk") ?? "",
    region: url.searchParams.get("region") ?? "",
    sort: url.searchParams.get("sort") ?? "value",
    railOnly: url.searchParams.get("rail") === "1",
    soloOnly: url.searchParams.get("solo") === "1",
    priceOnly: url.searchParams.get("price") === "1",
    audit: ["violation", "clear"].includes(url.searchParams.get("audit") ?? "")
      ? (url.searchParams.get("audit") as string)
      : "",
    dateFrom: (url.searchParams.get("from") ?? "").trim(),
    dateTo: (url.searchParams.get("to") ?? "").trim(),
    min: Number(url.searchParams.get("min") ?? "") || 0,
    max: Number(url.searchParams.get("max") ?? "") || 0,
    group: isDimension(rawGroup) ? rawGroup : "",
    then: isDimension(rawThen) ? rawThen : "",
    page: Math.max(1, Number(url.searchParams.get("page") ?? 1)),
  };
}

/** How many controls are actually doing something — shown on the folded panel. */
export function activeCount(c: Controls): number {
  return [
    c.risk,
    c.region,
    c.railOnly,
    c.soloOnly,
    c.priceOnly,
    c.audit,
    c.dateFrom,
    c.dateTo,
    c.min > 0,
    c.max > 0,
    c.group,
    c.sort !== "value",
  ].filter(Boolean).length;
}

export function isFiltered(c: Controls): boolean {
  return Boolean(
    c.q || c.risk || c.region || c.railOnly || c.soloOnly || c.priceOnly || c.dateFrom || c.dateTo || c.min > 0 || c.max > 0,
  );
}

export type ControlOptions = {
  /** Hidden where the whole page is already that scope. */
  hideRail?: boolean;
  hidePrice?: boolean;
};

/** Applies every filter, then the chosen order. */
export function applyControls(cases: Case[], c: Controls, railwayCodes: Set<string>, opts: ControlOptions = {}): Case[] {
  let list = cases;

  if (c.q) {
    list = list.filter(
      (x) =>
        (x.entity_name ?? "").toLowerCase().includes(c.q) ||
        (x.title ?? "").toLowerCase().includes(c.q) ||
        (x.officer_name ?? "").toLowerCase().includes(c.q) ||
        (x.winner_name ?? "").toLowerCase().includes(c.q) ||
        (x.entity_edrpou ?? "").includes(c.q) ||
        (x.winner_edrpou ?? "").includes(c.q) ||
        x.tender_ref.toLowerCase().includes(c.q),
    );
  }
  if (c.risk) list = list.filter((x) => x.risks.includes(c.risk));
  if (c.region) list = list.filter((x) => x.region === c.region);
  if (c.railOnly && !opts.hideRail) list = list.filter((x) => railwayCodes.has(x.entity_edrpou ?? ""));
  if (c.soloOnly) list = list.filter((x) => x.bidders === 1);
  if (c.priceOnly && !opts.hidePrice) list = list.filter((x) => x.findings.length > 0);
  if (c.audit === "violation") list = list.filter((x) => x.audit?.violation === true);
  if (c.audit === "clear") list = list.filter((x) => x.audit !== null && !x.audit.violation);

  // The date range is the tender's own publication date, not the date the
  // state assessed it: assessments are nearly all recent, so filtering by them
  // would hide every older procurement. Both are plain YYYY-MM-DD strings, so
  // a string comparison is correct and needs no parsing.
  if (c.dateFrom) list = list.filter((x) => (x.tender_date ?? "") >= c.dateFrom);
  if (c.dateTo) list = list.filter((x) => (x.tender_date ?? "") <= c.dateTo);
  if (c.min > 0) list = list.filter((x) => (x.value_amount ?? 0) >= c.min);
  if (c.max > 0) list = list.filter((x) => (x.value_amount ?? 0) <= c.max);

  return [...list].sort((a, b) =>
    c.sort === "date"
      ? String(b.tender_date ?? "").localeCompare(String(a.tender_date ?? ""))
      : c.sort === "date-asc"
        ? String(a.tender_date ?? "").localeCompare(String(b.tender_date ?? ""))
        : c.sort === "assessed"
          ? String(b.date_assessed ?? "").localeCompare(String(a.date_assessed ?? ""))
        : c.sort === "value-asc"
          ? (a.value_amount ?? 0) - (b.value_amount ?? 0)
          : c.sort === "risks"
            ? b.risks.length - a.risks.length || (b.value_amount ?? 0) - (a.value_amount ?? 0)
            : (b.value_amount ?? 0) - (a.value_amount ?? 0),
  );
}

/** Rebuilds the query string, so paging and links keep every control. */
export function keepControls(action: string, c: Controls, over: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (c.q) p.set("q", c.q);
  if (c.risk) p.set("risk", c.risk);
  if (c.region) p.set("region", c.region);
  if (c.sort !== "value") p.set("sort", c.sort);
  if (c.railOnly) p.set("rail", "1");
  if (c.soloOnly) p.set("solo", "1");
  if (c.priceOnly) p.set("price", "1");
  if (c.audit) p.set("audit", c.audit);
  if (c.dateFrom) p.set("from", c.dateFrom);
  if (c.dateTo) p.set("to", c.dateTo);
  if (c.min > 0) p.set("min", String(c.min));
  if (c.max > 0) p.set("max", String(c.max));
  if (c.group) p.set("group", c.group);
  if (c.then) p.set("then", c.then);
  for (const [k, v] of Object.entries(over)) p.set(k, v);
  const query = p.toString();
  return query ? `${action}?${query}` : action;
}
