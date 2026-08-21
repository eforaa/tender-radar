// Loads the store once and joins it into the shapes the pages need.
import { openStore } from "../src/config.ts";
import { officerKey } from "../src/normalize/tender.ts";
import type { RiskFlagRow, RiskRuleRow, TenderRow, AwardRow, RunRow, FindingRow } from "../src/store/types.ts";

/** One entry per tender: the flags that fired plus whatever the card added. */
export type Case = {
  tender_id: string;
  tender_ref: string;
  /** The date the tender was published, taken from its own number. */
  tender_date: string | null;
  title: string | null;
  status: string | null;
  method: string | null;
  entity_edrpou: string | null;
  entity_name: string | null;
  region: string | null;
  value_amount: number | null;
  date_assessed: string | null;
  risks: string[];
  officer_name: string | null;
  officer_email: string | null;
  officer_phone: string | null;
  officer_key: string | null;
  winner_name: string | null;
  winner_edrpou: string | null;
  winner_amount: number | null;
  bidders: number;
  detailed: boolean;
  findings: FindingRow[];
};

export type Dataset = {
  cases: Case[];
  byTender: Map<string, Case>;
  rules: RiskRuleRow[];
  ruleById: Map<string, RiskRuleRow>;
  flagCount: number;
  totalValue: number;
  runs: RunRow[];
  findingCount: number;
};

/**
 * A Prozorro number carries its publication date: UA-2024-07-11-005265-a.
 * That is the date of the procurement itself, which differs from the date the
 * state assessed it — most assessments are recent even for old tenders.
 */
export function tenderDateOf(tenderRef: string): string | null {
  const m = /^UA-(\d{4}-\d{2}-\d{2})-/.exec(tenderRef);
  return m ? m[1] : null;
}

function activeAward(awards: AwardRow[]): AwardRow | undefined {
  return awards.find((a) => a.status === "active") ?? awards[0];
}

export async function loadDataset(): Promise<Dataset> {
  const store = openStore();
  const flags: RiskFlagRow[] = await store.allRiskFlags();
  const rules: RiskRuleRow[] = await store.allRiskRules();
  const tenders: TenderRow[] = await store.allTenders();
  const awards: AwardRow[] = await store.allAwards();
  const bids = await store.allBids();
  const runs: RunRow[] = await store.allRuns();
  const findings: FindingRow[] = await store.allFindings();

  const findingsByTender = new Map<string, FindingRow[]>();
  for (const finding of findings) {
    const list = findingsByTender.get(finding.tender_id) ?? [];
    list.push(finding);
    findingsByTender.set(finding.tender_id, list);
  }

  const tenderById = new Map(tenders.map((t) => [t.id, t]));

  const awardsByTender = new Map<string, AwardRow[]>();
  for (const award of awards) {
    const list = awardsByTender.get(award.tender_id) ?? [];
    list.push(award);
    awardsByTender.set(award.tender_id, list);
  }

  const bidCount = new Map<string, number>();
  for (const bid of bids) bidCount.set(bid.tender_id, (bidCount.get(bid.tender_id) ?? 0) + 1);

  const byTender = new Map<string, Case>();
  for (const flag of flags) {
    let entry = byTender.get(flag.tender_id);
    if (!entry) {
      const detail = tenderById.get(flag.tender_id);
      const won = activeAward(awardsByTender.get(flag.tender_id) ?? []);
      entry = {
        tender_id: flag.tender_id,
        tender_ref: flag.tender_ref || detail?.tender_id || "",
        tender_date: tenderDateOf(flag.tender_ref || detail?.tender_id || ""),
        title: detail?.title ?? null,
        status: detail?.status ?? null,
        method: detail?.method ?? null,
        entity_edrpou: flag.entity_edrpou ?? detail?.entity_edrpou ?? null,
        entity_name: flag.entity_name ?? detail?.entity_name ?? null,
        region: flag.region ?? detail?.region ?? null,
        value_amount: flag.value_amount ?? detail?.value_amount ?? null,
        date_assessed: flag.date_assessed,
        risks: [],
        officer_name: detail?.officer_name ?? null,
        officer_email: detail?.officer_email ?? null,
        officer_phone: detail?.officer_phone ?? null,
        officer_key: detail ? officerKey(detail) : null,
        winner_name: won?.supplier_name ?? null,
        winner_edrpou: won?.supplier_edrpou ?? null,
        winner_amount: won?.amount ?? null,
        bidders: bidCount.get(flag.tender_id) ?? 0,
        detailed: Boolean(detail),
        findings: findingsByTender.get(flag.tender_id) ?? [],
      };
      byTender.set(flag.tender_id, entry);
    }
    if (!entry.tender_ref && flag.tender_ref) {
      entry.tender_ref = flag.tender_ref;
      entry.tender_date = tenderDateOf(flag.tender_ref);
    }
    if (entry.value_amount === null) entry.value_amount = flag.value_amount;
    if (!entry.risks.includes(flag.risk_id)) entry.risks.push(flag.risk_id);
  }

  const cases = [...byTender.values()];
  return {
    cases,
    byTender,
    rules,
    ruleById: new Map(rules.map((r) => [r.risk_id, r])),
    runs,
    findingCount: findings.length,
    flagCount: flags.length,
    totalValue: cases.reduce((sum, c) => sum + (c.value_amount ?? 0), 0),
  };
}
