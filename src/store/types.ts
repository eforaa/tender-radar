export type TenderRow = {
  id: string;
  tender_id: string;
  title: string;
  description: string | null;
  status: string;
  method: string | null;
  value_amount: number | null;
  currency: string | null;
  date: string | null;
  entity_edrpou: string | null;
  entity_name: string | null;
  region: string | null;
  locality: string | null;
  /** The official named in the tender as the responsible contact. */
  officer_name: string | null;
  officer_email: string | null;
  officer_phone: string | null;
  raw: unknown;
};

export type TenderItemRow = {
  tender_id: string;
  item_id: string;
  description: string | null;
  cpv_code: string | null;
  cpv_name: string | null;
  quantity: number | null;
  unit_code: string | null;
  unit_name: string | null;
  lot_id: string | null;
};

export type BidRow = {
  tender_id: string;
  bid_id: string;
  supplier_edrpou: string | null;
  supplier_name: string | null;
  amount: number | null;
  status: string | null;
};

export type AwardRow = {
  tender_id: string;
  award_id: string;
  supplier_edrpou: string | null;
  supplier_name: string | null;
  amount: number | null;
  status: string | null;
  date: string | null;
};

export type RiskFlagRow = {
  tender_id: string;
  tender_ref: string;
  risk_id: string;
  date_assessed: string | null;
  region: string | null;
  entity_edrpou: string | null;
  entity_name: string | null;
  value_amount: number | null;
};

export type RiskRuleRow = {
  risk_id: string;
  name: string | null;
  description: string | null;
  legitimateness: string | null;
  status: string | null;
};

export type MonitoringRow = {
  monitoring_id: string;
  tender_id: string;
  status: string;
  decision_text: string | null;
  reasons: unknown;
  conclusion: unknown;
  date_created: string | null;
  date_modified: string | null;
};

export type CatalogPriceRow = {
  product_id: string;
  title: string | null;
  cpv_code: string | null;
  offer_id: string;
  offer_price: number | null;
  currency: string | null;
  vat_included: boolean | null;
  fetched_at: string;
};

/** One record per daily run, so the site can show what changed and when. */
export type RunRow = {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  status: "ok" | "failed";
  new_tenders: number;
  new_flags: number;
  details_fetched: number;
  errors: number;
  message: string | null;
  /** Tender ids first seen in this run, so "what's new" is exact. */
  new_tender_ids: string[];
};

export type FindingTier = "confirmed" | "state_indicator" | "own_analysis";

export type FindingRow = {
  tender_id: string;
  detector_key: string;
  tier: FindingTier;
  severity: "low" | "medium" | "high";
  title: string;
  explanation: string;
  evidence: unknown;
  created_at: string;
};

/** Narrow persistence surface. Adapters implement it; nothing else may. */
export interface Store {
  upsertTenders(rows: TenderRow[]): Promise<void>;
  upsertTenderItems(rows: TenderItemRow[]): Promise<void>;
  upsertBids(rows: BidRow[]): Promise<void>;
  upsertAwards(rows: AwardRow[]): Promise<void>;
  upsertRiskFlags(rows: RiskFlagRow[]): Promise<void>;
  upsertRiskRules(rows: RiskRuleRow[]): Promise<void>;
  upsertMonitorings(rows: MonitoringRow[]): Promise<void>;
  upsertCatalogPrices(rows: CatalogPriceRow[]): Promise<void>;
  upsertFindings(rows: FindingRow[]): Promise<void>;
  upsertRuns(rows: RunRow[]): Promise<void>;

  allTenders(): Promise<TenderRow[]>;
  allTenderItems(): Promise<TenderItemRow[]>;
  allBids(): Promise<BidRow[]>;
  allAwards(): Promise<AwardRow[]>;
  allRiskFlags(): Promise<RiskFlagRow[]>;
  allRiskRules(): Promise<RiskRuleRow[]>;
  allMonitorings(): Promise<MonitoringRow[]>;
  allCatalogPrices(): Promise<CatalogPriceRow[]>;
  allFindings(): Promise<FindingRow[]>;
  allRuns(): Promise<RunRow[]>;

  getCursor(worker: string): Promise<string | null>;
  setCursor(worker: string, cursor: string): Promise<void>;
}
