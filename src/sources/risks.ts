import { getJson, getText, type HttpOptions } from "./http.ts";

const BASE = "https://risks.prozorro.gov.ua/api";

export type RawRiskDetail = {
  risk_id: string;
  name?: string;
  owner?: string;
  description?: string;
  legitimateness?: string;
};

export type RawRiskItem = {
  _id: string;
  dateAssessed?: string;
  procuringEntity?: {
    name?: string;
    identifier?: { id?: string; legalName?: string };
    address?: { region?: string; locality?: string };
  };
  risks?: Record<string, RawRiskDetail[]>;
};

export type RisksPage = { count: number; items: RawRiskItem[] };

/** Returns the identifiers of every currently active state risk indicator. */
export async function listRiskRuleIds(opts?: HttpOptions): Promise<string[]> {
  const body = await getJson<{ risk_rules: { identifier: string; status: string }[] }>(
    `${BASE}/filter-values`,
    opts,
  );
  return body.risk_rules.filter((r) => r.status === "active").map((r) => r.identifier);
}

/**
 * Downloads the CSV export for one indicator.
 * The export must be requested per indicator — an unfiltered request
 * does not complete.
 */
export async function fetchRiskReportCsv(riskId: string, opts?: HttpOptions): Promise<string> {
  const url = `${BASE}/risks-report?risks=${encodeURIComponent(riskId)}&risks_all=false`;
  return await getText(url, { timeoutMs: 240_000, ...opts });
}

/** Fetches one page of flagged tenders, 20 per page. */
export async function fetchRisksPage(skip: number, opts?: HttpOptions): Promise<RisksPage> {
  return await getJson<RisksPage>(`${BASE}/risks?skip=${skip}`, opts);
}

/** Fetches every flagged tender for one procuring entity, following pagination. */
export async function fetchRisksByEdrpou(edrpou: string, opts?: HttpOptions): Promise<RawRiskItem[]> {
  const items: RawRiskItem[] = [];
  for (let skip = 0; ; skip += 20) {
    const page = await getJson<RisksPage>(
      `${BASE}/risks?skip=${skip}&edrpou=${encodeURIComponent(edrpou)}&risks_all=false`,
      opts,
    );
    items.push(...page.items);
    if (items.length >= page.count || page.items.length === 0) return items;
  }
}
