// Fetches the State Audit Service's monitorings for the tenders we hold.
//
// The listing carries the tender id, so the whole feed is scanned cheaply and
// only monitorings that touch our tenders — and that have actually finished —
// are fetched in full. Resumable: a monitoring already stored at the same
// status is not fetched again.
import { AUDIT_FEED_START, CONCLUDED_STATUSES, fetchMonitoringPage, fetchMonitoring } from "../src/sources/audit.ts";
import { normalizeMonitoring, findingFromMonitoring, violationEstablished } from "../src/normalize/monitoring.ts";
import { openStore } from "../src/config.ts";
import type { MonitoringRow, FindingRow } from "../src/store/types.ts";

const CONCURRENCY = Number(process.env.TR_CONCURRENCY ?? 6);
const store = openStore();

const flags = await store.allRiskFlags();
const ours = new Set(flags.map((f) => f.tender_id));
console.log(`tenders we track: ${ours.size}`);

const stored = await store.allMonitorings();
// Status can change after we first see it — an active monitoring becomes
// addressed — so the status is part of what makes a stored copy current.
const seen = new Map(stored.map((m) => [m.monitoring_id, m.status]));

const wanted: string[] = [];
let scanned = 0;
let pages = 0;
let uri = AUDIT_FEED_START;

while (uri) {
  const page = await fetchMonitoringPage(uri);
  if (page.data.length === 0) break;
  pages++;
  scanned += page.data.length;

  for (const entry of page.data) {
    if (!entry.tender_id || !ours.has(entry.tender_id)) continue;
    if (!entry.status || !CONCLUDED_STATUSES.has(entry.status)) continue;
    if (seen.get(entry.id) === entry.status) continue;
    wanted.push(entry.id);
  }

  uri = page.nextUri;
  if (pages % 20 === 0) console.log(`  scanned ${scanned} monitorings, ${wanted.length} to fetch`);
}

console.log(`scanned ${scanned} monitorings across ${pages} pages; ${wanted.length} to fetch`);

const rows: MonitoringRow[] = [];
let done = 0;
let failed = 0;

async function flush(): Promise<void> {
  if (rows.length === 0) return;
  await store.upsertMonitorings(rows.splice(0));
}

async function worker(queue: string[]): Promise<void> {
  for (;;) {
    const id = queue.pop();
    if (!id) return;
    try {
      rows.push(normalizeMonitoring(await fetchMonitoring(id)));
    } catch (err) {
      failed++;
      if (failed <= 5) console.log(`  ${id}: ${(err as Error).message}`);
    }
    done++;
    if (done % 250 === 0) {
      await flush();
      console.log(`  ${done}/${wanted.length} fetched (${failed} failed)`);
    }
  }
}

const queue = [...wanted];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
await flush();

// Every established violation becomes a finding of the highest tier. The
// monitorings that found nothing are kept too: "checked, nothing found" is
// worth printing next to an organisation's name, and it is not a finding.
const all = await store.allMonitorings();
const findings: FindingRow[] = [];
let confirmed = 0;
let cleared = 0;
let undecided = 0;

for (const row of all) {
  const verdict = violationEstablished(row);
  if (verdict === true) {
    confirmed++;
    const finding = findingFromMonitoring(row);
    if (finding) findings.push(finding);
  } else if (verdict === false) {
    cleared++;
  } else {
    undecided++;
  }
}

await store.upsertFindings(findings);

const tenders = new Set(all.map((m) => m.tender_id));
console.log(
  `stored ${all.length} monitorings on ${tenders.size} tenders — ` +
    `${confirmed} with an established violation, ${cleared} cleared, ${undecided} without a published conclusion`,
);
console.log(`${failed} fetches failed`);
