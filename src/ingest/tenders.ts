import { createHash } from "node:crypto";
import { mkdir, writeFile, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { FEED_START, fetchFeedPage, fetchTender, type FeedEntry, type RawTender } from "../sources/openprocurement.ts";
import { normalizeTender } from "../normalize/tender.ts";
import { railwayScope } from "../config.ts";
import type { Store } from "../store/types.ts";

export const INGEST_KEY = "public-tenders-v1";
export type IngestState = {
  version: 1; historyNext: string | null; historyComplete: boolean;
  liveNext: string | null; liveCaughtUp: boolean;
  pages: number; scanned: number; stored: number;
  startedAt: string; updatedAt: string; error: string | null;
};
type Dependencies = { page: typeof fetchFeedPage; tender: typeof fetchTender };
const kharkiv = (s?: string) => /^(харківськ|харьковск|kharkiv|kharkov)/i.test((s ?? "").trim());

/** Registration and delivery are independent reasons; never infer location from a title. */
export function scopeReasons(raw: { procuringEntity?: FeedEntry["procuringEntity"]; items?: unknown }): string[] {
  const e = raw.procuringEntity;
  const reasons: string[] = [];
  if (kharkiv(e?.address?.region)) reasons.push("kharkiv_buyer");
  if (railwayScope({ entity_edrpou: e?.identifier?.id ?? null,
    entity_name: e?.name ?? e?.identifier?.legalName ?? null, region: e?.address?.region ?? null })) reasons.push("railway");
  if (Array.isArray(raw.items) && raw.items.some(i => kharkiv(i?.deliveryAddress?.region))) reasons.push("kharkiv_delivery");
  return reasons;
}

export async function ingestTenders(store: Store, options: {
  directory: string; maxPages?: number; concurrency?: number;
  log?: (message: string) => void; dependencies?: Dependencies;
}): Promise<{ state: IngestState; fetched: number; newIds: string[] }> {
  const maxPages = options.maxPages ?? 20;
  const concurrency = options.concurrency ?? 4;
  if (!Number.isInteger(maxPages) || maxPages < 2 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16)
    throw new Error("Invalid ingest page/concurrency limit");
  await mkdir(options.directory, { recursive: true });
  // Both CLI and daily use this lock. Do not silently run overlapping writers.
  const lockPath = join(options.directory, "tender-ingest.lock");
  const lock = await open(lockPath, "wx");
  await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  try {
    const deps = options.dependencies ?? { page: fetchFeedPage, tender: fetchTender };
    const checkpoint = await store.getCursor(INGEST_KEY);
    const now = new Date().toISOString();
    const state: IngestState = checkpoint ? JSON.parse(checkpoint) : {
      version: 1, historyNext: FEED_START, historyComplete: false,
      liveNext: null, liveCaughtUp: false, pages: 0, scanned: 0, stored: 0,
      startedAt: now, updatedAt: now, error: null,
    };
    if (state.version !== 1) throw new Error("Unsupported ingest checkpoint version");
    const known = new Set((await store.allTenders()).map(t => t.id));
    const newIds: string[] = [];
    let fetched = 0;
    let used = 0;
    const save = async () => { state.updatedAt = new Date().toISOString(); await store.setCursor(INGEST_KEY, JSON.stringify(state)); };
    async function scan(direction: "live" | "history", budget: number) {
      for (let n = 0; n < budget; n++) {
        const uri = direction === "live" ? state.liveNext : state.historyNext;
        if (!uri) break;
        const page = await deps.page(uri);
        used++;
        if (!page.data.length) {
          if (direction === "live") state.liveCaughtUp = true;
          else state.historyComplete = true;
          await save();
          break;
        }
        const raws: RawTender[] = [];
        const queue = [...new Map(page.data.map(e => [e.id, e])).values()];
        const failures: string[] = [];
        await Promise.all(Array.from({ length: concurrency }, async () => {
          while (queue.length) {
            const entry = queue.shift()!;
            try {
              // Fetch even non-local buyers: items are needed to detect delivery to Kharkiv.
              // opt_fields cannot be assumed to expose delivery addresses.
              const raw = await deps.tender(entry.id);
              if (scopeReasons(raw).length) raws.push(raw);
            } catch (error) { failures.push(`${entry.id}: ${(error as Error).message}`); }
          }
        }));
        if (failures.length) throw new Error(`Page not committed; ${failures.length} fetch failures. ${failures[0]}`);
        if (page.nextUri === uri) throw new Error("Non-empty feed page did not advance its cursor");
        const cards = raws.map(raw => { const normalized = normalizeTender(raw); return ({ ...normalized, tender: {
          ...normalized.tender,
          fetched_at: new Date().toISOString(),
          source_modified: typeof raw.dateModified === "string" ? raw.dateModified : null,
          scope_reasons: scopeReasons(raw),
        }}); });
        for (const raw of raws) {
          const body = JSON.stringify(raw);
          const hash = createHash("sha256").update(body).digest("hex");
          // Content-addressed versions retain the exact public source used by analysis.
          const dir = join(options.directory, "source-versions", createHash("sha256").update(raw.id).digest("hex"));
          await mkdir(dir, { recursive: true });
          try { await writeFile(join(dir, `${hash}.json`), body, { flag: "wx" }); }
          catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
        }
        await store.replaceTenderCards(cards);
        for (const c of cards) {
          if (!known.has(c.tender.id)) { known.add(c.tender.id); newIds.push(c.tender.id); }
        }
        fetched += cards.length;
        state.pages++; state.scanned += page.data.length; state.stored += cards.length;
        if (!state.liveNext && direction === "history") {
          if (!page.prevUri) throw new Error("Feed lacks forward cursor; cannot guarantee future updates");
          state.liveNext = page.prevUri;
        }
        if (direction === "history") {
          state.historyNext = page.nextUri;
          state.historyComplete = !page.nextUri;
        } else {
          if (!page.nextUri) throw new Error("Forward feed lacks continuation cursor");
          state.liveNext = page.nextUri; state.liveCaughtUp = false;
        }
        state.error = null;
        await save();
        options.log?.(`${direction}: ${state.scanned} feed records scanned, ${cards.length} scoped cards refreshed; history ${state.historyComplete ? "complete" : "in progress"}`);
      }
    }
    try {
      // Reserve at least one page for history so a busy live stream cannot starve backfill.
      if (state.liveNext) {
        state.liveCaughtUp = false;
        await scan("live", state.historyComplete ? maxPages : Math.max(1, Math.floor(maxPages / 2)));
      }
      if (!state.historyComplete && used < maxPages) await scan("history", maxPages - used);
      state.error = null;
      await save();
    } catch (error) {
      state.error = (error as Error).message;
      await save();
      throw error;
    }
    return { state, fetched, newIds };
  } finally { await lock.close(); await unlink(lockPath); }
}
