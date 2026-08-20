// Downloads every active state risk indicator's export and keeps the
// Kharkiv-oblast rows, plus every railway branch wherever it is registered.
// One request per indicator: an unfiltered export does not complete.
import { listRiskRuleIds, fetchRiskReportCsv, fetchRisksPage } from "../src/sources/risks.ts";
import { normalizeRiskReport, filterByRegion, normalizeRiskRules } from "../src/normalize/risk.ts";
import { openStore, REGION, RAILWAY_EDRPOU } from "../src/config.ts";

const store = openStore();

const ruleIds = await listRiskRuleIds();
console.log(`active state indicators: ${ruleIds.length}`);

let kept = 0;
for (const riskId of ruleIds) {
  let csv: string;
  try {
    csv = await fetchRiskReportCsv(riskId);
  } catch (err) {
    console.log(`${riskId}: export failed (${(err as Error).message}) — skipped`);
    continue;
  }

  const all = normalizeRiskReport(csv);
  const rows = all.filter(
    (row) => row.region === REGION || RAILWAY_EDRPOU.has(row.entity_edrpou ?? ""),
  );
  await store.upsertRiskFlags(rows);
  kept += rows.length;
  console.log(`${riskId}: ${rows.length} kept of ${all.length} nationwide`);
}

const page = await fetchRisksPage(0);
const rules = normalizeRiskRules(page);
await store.upsertRiskRules(rules);
console.log(`indicator descriptions captured: ${rules.length}`);

const stored = await store.allRiskFlags();
const tenders = new Set(stored.map((r) => r.tender_id));
console.log(`kept ${kept} flags across ${tenders.size} distinct tenders`);
