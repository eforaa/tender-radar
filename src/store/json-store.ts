import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  Store, TenderRow, TenderItemRow, BidRow, AwardRow, RiskFlagRow,
  RiskRuleRow, MonitoringRow, CatalogPriceRow, FindingRow, RunRow,
} from "./types.ts";

/** File-backed Store. One JSON array per table; adequate for the volumes here. */
export class JsonStore implements Store {
  #dir: string;

  constructor(dir: string) {
    this.#dir = dir;
  }

  async #read<T>(table: string): Promise<T[]> {
    try {
      return JSON.parse(await readFile(join(this.#dir, `${table}.json`), "utf8")) as T[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  async #write<T>(table: string, rows: T[]): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    await writeFile(join(this.#dir, `${table}.json`), JSON.stringify(rows), "utf8");
  }

  async #upsert<T>(table: string, rows: T[], key: (row: T) => string): Promise<void> {
    if (rows.length === 0) return;
    const existing = await this.#read<T>(table);
    const byKey = new Map(existing.map((row) => [key(row), row]));
    for (const row of rows) byKey.set(key(row), row);
    await this.#write(table, [...byKey.values()]);
  }

  upsertTenders(rows: TenderRow[]) {
    return this.#upsert("tenders", rows, (r) => r.id);
  }
  upsertTenderItems(rows: TenderItemRow[]) {
    return this.#upsert("tender_items", rows, (r) => `${r.tender_id}|${r.item_id}`);
  }
  upsertBids(rows: BidRow[]) {
    return this.#upsert("bids", rows, (r) => `${r.tender_id}|${r.bid_id}`);
  }
  upsertAwards(rows: AwardRow[]) {
    return this.#upsert("awards", rows, (r) => `${r.tender_id}|${r.award_id}`);
  }
  upsertRiskFlags(rows: RiskFlagRow[]) {
    return this.#upsert("risk_flags", rows, (r) => `${r.tender_id}|${r.risk_id}`);
  }
  upsertRiskRules(rows: RiskRuleRow[]) {
    return this.#upsert("risk_rules", rows, (r) => r.risk_id);
  }
  upsertMonitorings(rows: MonitoringRow[]) {
    return this.#upsert("monitorings", rows, (r) => r.monitoring_id);
  }
  upsertCatalogPrices(rows: CatalogPriceRow[]) {
    return this.#upsert("catalog_prices", rows, (r) => r.offer_id);
  }
  upsertFindings(rows: FindingRow[]) {
    return this.#upsert("findings", rows, (r) => `${r.tender_id}|${r.detector_key}`);
  }
  upsertRuns(rows: RunRow[]) {
    return this.#upsert("runs", rows, (r) => r.run_id);
  }
  replaceRuns(rows: RunRow[]) {
    return this.#write("runs", rows);
  }

  allTenders() { return this.#read<TenderRow>("tenders"); }
  allTenderItems() { return this.#read<TenderItemRow>("tender_items"); }
  allBids() { return this.#read<BidRow>("bids"); }
  allAwards() { return this.#read<AwardRow>("awards"); }
  allRiskFlags() { return this.#read<RiskFlagRow>("risk_flags"); }
  allRiskRules() { return this.#read<RiskRuleRow>("risk_rules"); }
  allMonitorings() { return this.#read<MonitoringRow>("monitorings"); }
  allCatalogPrices() { return this.#read<CatalogPriceRow>("catalog_prices"); }
  allFindings() { return this.#read<FindingRow>("findings"); }
  allRuns() { return this.#read<RunRow>("runs"); }

  async getCursor(worker: string): Promise<string | null> {
    const all = await this.#read<Record<string, string>>("cursors");
    return all[0]?.[worker] ?? null;
  }

  async setCursor(worker: string, cursor: string): Promise<void> {
    const all = await this.#read<Record<string, string>>("cursors");
    const map = all[0] ?? {};
    map[worker] = cursor;
    await this.#write("cursors", [map]);
  }
}
