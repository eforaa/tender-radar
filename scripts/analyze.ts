// Runs our own price analysis over everything in the store: each tender against
// other tenders that bought the same thing, and against the same buyer's own
// earlier purchase.
import { pricePoints, priceGroups, detectPeerPrice, detectOwnPriceGrowth } from "../src/analysis/peer-price.ts";
import { openStore } from "../src/config.ts";
import type { FindingRow, TenderItemRow, AwardRow } from "../src/store/types.ts";

const store = openStore();
const now = new Date().toISOString();

const tenders = await store.allTenders();
const items = await store.allTenderItems();
const awards = await store.allAwards();

const itemsByTender = new Map<string, TenderItemRow[]>();
for (const item of items) {
  const list = itemsByTender.get(item.tender_id) ?? [];
  list.push(item);
  itemsByTender.set(item.tender_id, list);
}

const awardsByTender = new Map<string, AwardRow[]>();
for (const award of awards) {
  const list = awardsByTender.get(award.tender_id) ?? [];
  list.push(award);
  awardsByTender.set(award.tender_id, list);
}

const points = pricePoints(tenders, itemsByTender, awardsByTender);
const groups = priceGroups(points);

console.log(`${tenders.length} tenders → ${points.length} with a comparable unit price`);
console.log(`grouped into ${groups.size} subject/unit buckets`);

const findings: FindingRow[] = [];
for (const point of points) {
  const group = groups.get(`${point.cpv_code}|${point.unit_code}`);
  if (!group) continue;
  const peer = detectPeerPrice(point, group, now);
  if (peer) findings.push(peer);
  const growth = detectOwnPriceGrowth(point, group, now);
  if (growth) findings.push(growth);
}

await store.upsertFindings(findings);

const bySeverity = { high: 0, medium: 0, low: 0 };
const byDetector: Record<string, number> = {};
let overpayment = 0;
for (const finding of findings) {
  bySeverity[finding.severity]++;
  byDetector[finding.detector_key] = (byDetector[finding.detector_key] ?? 0) + 1;
  const evidence = finding.evidence as { overpayment?: number; extra_cost?: number };
  overpayment += evidence.overpayment ?? evidence.extra_cost ?? 0;
}

console.log(`findings: ${findings.length}`);
for (const [key, n] of Object.entries(byDetector)) console.log(`  ${key}: ${n}`);
console.log(`  severity — high ${bySeverity.high}, medium ${bySeverity.medium}, low ${bySeverity.low}`);
console.log(`estimated difference against the comparison base: ${Math.round(overpayment).toLocaleString("uk-UA")} UAH`);
