// The daily run. Refreshes every state risk indicator, picks up whatever is
// new for Kharkiv oblast and the railway branches, fetches the full card for
// each new tender, and records what changed.
//
// Safe to run at any hour and safe to run twice: everything is keyed, so a
// repeat run simply finds nothing new. A crash mid-way loses no data — the
// next run picks up the tenders whose cards are still missing.
import { listRiskRuleIds, fetchRiskReportCsv, fetchRisksPage } from "../src/sources/risks.ts";
import { normalizeRiskReport, normalizeRiskRules } from "../src/normalize/risk.ts";
import { fetchTender } from "../src/sources/openprocurement.ts";
import { normalizeTender } from "../src/normalize/tender.ts";
import { pricePoints, priceGroups, detectPeerPrice, detectOwnPriceGrowth } from "../src/analysis/peer-price.ts";
import { join } from "node:path";
import { loadTelegramConfig, buildMessage, sendTelegram, sendTelegramTo, postMessage, pickHighlights } from "../src/notify/telegram.ts";
import { loadSubscriberConfig, createSubscriberStore } from "../src/store/subscribers.ts";
import { broadcast } from "../src/notify/broadcast.ts";
import { openStore, REGION, RAILWAY_EDRPOU } from "../src/config.ts";
import type { RiskFlagRow, TenderRow, TenderItemRow, BidRow, AwardRow, RunRow, FindingRow } from "../src/store/types.ts";

const CONCURRENCY = Number(process.env.TR_CONCURRENCY ?? 6);
/** How many new ids one run stores; the count itself is kept in full. */
const MAX_STORED_IDS = 200;
/** How many past runs to keep, so the history file stays small. */
const KEEP_RUNS = 90;
const store = openStore();
const startedAt = new Date();
const runId = startedAt.toISOString();

function log(message: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
}

/**
 * Flags are kept for the whole country — the main list shows all of Ukraine.
 * Full tender cards are a different matter: fetching one per tender for every
 * region would be tens of thousands of requests, so those stay scoped.
 */
function wantsFullCard(row: RiskFlagRow): boolean {
  return row.region === REGION || RAILWAY_EDRPOU.has(row.entity_edrpou ?? "");
}

let errors = 0;
let newFlags = 0;
let detailsFetched = 0;
let newTenderIds: string[] = [];

try {
  /* ---- 1. state risk indicators ---- */

  const before = await store.allRiskFlags();
  const knownFlagKeys = new Set(before.map((f) => `${f.tender_id}|${f.risk_id}`));
  const knownTenderIds = new Set(before.map((f) => f.tender_id));

  const ruleIds = await listRiskRuleIds();
  log(`active state indicators: ${ruleIds.length}`);

  const freshFlags: RiskFlagRow[] = [];
  for (const riskId of ruleIds) {
    try {
      const rows = normalizeRiskReport(await fetchRiskReportCsv(riskId));
      freshFlags.push(...rows);
      const added = rows.filter((r) => !knownFlagKeys.has(`${r.tender_id}|${r.risk_id}`)).length;
      log(`${riskId}: ${rows.length} nationwide${added ? `, ${added} new` : ""}`);
    } catch (err) {
      errors++;
      log(`${riskId}: export failed — ${(err as Error).message}`);
    }
  }

  const addedFlags = freshFlags.filter((r) => !knownFlagKeys.has(`${r.tender_id}|${r.risk_id}`));
  newFlags = addedFlags.length;
  await store.upsertRiskFlags(freshFlags);

  try {
    await store.upsertRiskRules(normalizeRiskRules(await fetchRisksPage(0)));
  } catch (err) {
    errors++;
    log(`indicator descriptions failed — ${(err as Error).message}`);
  }

  newTenderIds = [...new Set(addedFlags.map((r) => r.tender_id))].filter((id) => !knownTenderIds.has(id));
  log(`new flags: ${newFlags}, on ${newTenderIds.length} tenders not seen before`);

  /* ---- 2. full cards for anything still missing one ---- */

  const haveCards = new Set((await store.allTenders()).map((t) => t.id));
  const storedFlags = await store.allRiskFlags();
  const wanted = [...new Set(storedFlags.filter(wantsFullCard).map((f) => f.tender_id))];
  const missing = wanted.filter((id) => !haveCards.has(id));
  log(`tender cards wanted ${wanted.length}, missing ${missing.length}`);

  const tenders: TenderRow[] = [];
  const items: TenderItemRow[] = [];
  const bids: BidRow[] = [];
  const awards: AwardRow[] = [];

  async function flush(): Promise<void> {
    if (tenders.length === 0) return;
    await store.upsertTenders(tenders.splice(0));
    await store.upsertTenderItems(items.splice(0));
    await store.upsertBids(bids.splice(0));
    await store.upsertAwards(awards.splice(0));
  }

  const queue = [...missing];
  async function worker(): Promise<void> {
    for (;;) {
      const id = queue.pop();
      if (!id) return;
      try {
        const normalized = normalizeTender(await fetchTender(id));
        tenders.push(normalized.tender);
        items.push(...normalized.items);
        bids.push(...normalized.bids);
        awards.push(...normalized.awards);
        detailsFetched++;
      } catch (err) {
        errors++;
        if (errors <= 5) log(`  ${id}: ${(err as Error).message}`);
      }
      if (tenders.length >= 200) await flush();
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await flush();

  /* ---- 3. our own price analysis over the whole corpus ---- */

  const allTenders = await store.allTenders();
  const allItems = await store.allTenderItems();
  const allAwards = await store.allAwards();

  const itemsByTender = new Map<string, TenderItemRow[]>();
  for (const item of allItems) {
    const list = itemsByTender.get(item.tender_id) ?? [];
    list.push(item);
    itemsByTender.set(item.tender_id, list);
  }
  const awardsByTender = new Map<string, AwardRow[]>();
  for (const award of allAwards) {
    const list = awardsByTender.get(award.tender_id) ?? [];
    list.push(award);
    awardsByTender.set(award.tender_id, list);
  }

  const points = pricePoints(allTenders, itemsByTender, awardsByTender);
  const groups = priceGroups(points);
  const findings: FindingRow[] = [];
  for (const point of points) {
    const group = groups.get(`${point.cpv_code}|${point.unit_code}`);
    if (!group) continue;
    const peer = detectPeerPrice(point, group, new Date().toISOString());
    if (peer) findings.push(peer);
    const growth = detectOwnPriceGrowth(point, group, new Date().toISOString());
    if (growth) findings.push(growth);
  }
  await store.upsertFindings(findings);
  log(`price analysis: ${points.length} comparable prices, ${groups.size} groups, ${findings.length} findings`);

  /* ---- 3b. what the auditors concluded ---- */

  // The one source here that reports findings rather than suspicions. It runs
  // after the cards so it can be matched against the tenders we hold, and its
  // failure must not cost us the rest of the run.
  try {
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync(process.execPath, [join(import.meta.dirname, "ingest-monitorings.ts")], {
      encoding: "utf8",
      env: { ...process.env },
    });
    for (const line of out.trim().split("\n").slice(-2)) log(line.trim());
  } catch (err) {
    errors++;
    log(`audit monitorings failed — ${(err as Error).message}`);
  }

  /* ---- 4. record the run ---- */

  const run: RunRow = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    status: "ok",
    new_tenders: newTenderIds.length,
    new_flags: newFlags,
    details_fetched: detailsFetched,
    errors,
    message: null,
    new_tender_ids: newTenderIds.slice(0, MAX_STORED_IDS),
  };
  await store.upsertRuns([run]);

  // Trim the history in place; nothing downstream reads beyond the recent runs.
  const allRuns = await store.allRuns();
  if (allRuns.length > KEEP_RUNS) {
    const keep = [...allRuns].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, KEEP_RUNS);
    await store.replaceRuns(keep);
  }

  // Refresh the slim export the deployed site reads, so a redeploy ships
  // today's data rather than whatever was there when the site was last built.
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync(process.execPath, [join(import.meta.dirname, "build-web-data.ts")], { stdio: "pipe" });
    log("web-data export refreshed");
  } catch (err) {
    errors++;
    log(`web-data export failed — ${(err as Error).message}`);
  }

  const total = (await store.allRiskFlags()).length;
  const tenderCount = (await store.allTenders()).length;
  log(
    `done — ${newTenderIds.length} new tenders, ${newFlags} new flags, ` +
      `${detailsFetched} cards fetched, ${errors} errors. ` +
      `Store now holds ${tenderCount} tenders and ${total} flags.`,
  );

  /* ---- 5. tell Telegram what happened ---- */

  const telegram = loadTelegramConfig();
  if (!telegram) {
    log("telegram not configured — skipping the notification");
  } else {
    const { loadDataset } = await import("../server/data.ts");
    const dataset = await loadDataset();
    const freshIds = new Set(newTenderIds);
    // Built once: the digest is identical for everyone.
    const text = buildMessage({
      newTenders: newTenderIds.length,
      newFlags,
      cardsFetched: detailsFetched,
      errors,
      totalTenders: dataset.cases.length,
      totalFlags: dataset.flagCount,
      findings: dataset.findingCount,
      highlights: pickHighlights(dataset.cases.filter((c) => freshIds.has(c.tender_id))),
      siteUrl: process.env.SITE_URL ?? "https://tender-radar-five.vercel.app",
    });

    const supabase = loadSubscriberConfig();
    if (!supabase) {
      // No subscriber store configured: behave exactly as before.
      const result = await sendTelegram(telegram, text);
      log(result.sent ? "telegram notification sent" : `telegram notification failed — ${result.reason}`);
    } else {
      // Its own try/catch, mirroring ingest-monitorings and build-web-data
      // above: everything the ingest already did (tenders, flags, web-data
      // export) is committed by this point, so a Supabase hiccup here must
      // not flip step 4's "ok" run record to "failed" via the outer catch.
      try {
        const store = createSubscriberStore(supabase);
        const chatIds = await store.listActive();
        const outcome = await broadcast(chatIds, text, {
          send: (chatId, body) => postMessage(telegram, chatId, body),
        });

        // Logged right away, before touching the store again: a broadcast
        // that fully succeeded must leave a record even if an unsubscribe
        // below throws.
        log(
          `telegram broadcast — ${outcome.sent} delivered, ` +
            `${outcome.blocked.length} unsubscribed, ${outcome.failed} failed`,
        );

        for (const chatId of outcome.blocked) {
          try {
            await store.remove(chatId);
          } catch (err) {
            // One chat that won't unsubscribe must not cost the rest their
            // removal, nor the admin summary that follows.
            errors++;
            log(`unsubscribe ${chatId} failed — ${(err as Error).message}`);
          }
        }

        // The admin chat gets the delivery report. Without it a broken
        // broadcast is invisible: subscribers do not complain, they just
        // stop hearing from us.
        await sendTelegramTo(
          telegram,
          telegram.chatId,
          `<b>Розсилка</b>\nДоставлено: ${outcome.sent}\n` +
            `Відписалося: ${outcome.blocked.length}\nПомилок: ${outcome.failed}`,
        );
      } catch (err) {
        errors++;
        log(`telegram broadcast failed — ${(err as Error).message}`);
      }
    }
  }
} catch (err) {
  await store.upsertRuns([
    {
      run_id: runId,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      status: "failed",
      new_tenders: newTenderIds.length,
      new_flags: newFlags,
      details_fetched: detailsFetched,
      errors: errors + 1,
      message: (err as Error).message,
      new_tender_ids: newTenderIds.slice(0, MAX_STORED_IDS),
    },
  ]);
  log(`FAILED — ${(err as Error).message}`);
  process.exitCode = 1;
}
