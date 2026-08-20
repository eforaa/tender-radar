// Fetches the full card for every flagged tender we hold, so the site can
// show the responsible official, the items and the winner.
// Resumable: tenders already stored are skipped.
import { fetchTender } from "../src/sources/openprocurement.ts";
import { normalizeTender } from "../src/normalize/tender.ts";
import { openStore } from "../src/config.ts";
import type { TenderRow, TenderItemRow, BidRow, AwardRow } from "../src/store/types.ts";

const CONCURRENCY = Number(process.env.TR_CONCURRENCY ?? 6);
const store = openStore();

const flags = await store.allRiskFlags();
const wanted = [...new Set(flags.map((f) => f.tender_id))];
const have = new Set((await store.allTenders()).map((t) => t.id));
const todo = wanted.filter((id) => !have.has(id));

console.log(`${wanted.length} flagged tenders, ${have.size} already stored, ${todo.length} to fetch`);

const tenders: TenderRow[] = [];
const items: TenderItemRow[] = [];
const bids: BidRow[] = [];
const awards: AwardRow[] = [];
let done = 0;
let failed = 0;

/** Writes what has been collected so far, then clears the buffers. */
async function flush(): Promise<void> {
  if (tenders.length === 0) return;
  await store.upsertTenders(tenders.splice(0));
  await store.upsertTenderItems(items.splice(0));
  await store.upsertBids(bids.splice(0));
  await store.upsertAwards(awards.splice(0));
}

async function worker(queue: string[]): Promise<void> {
  for (;;) {
    const id = queue.pop();
    if (!id) return;
    try {
      const normalized = normalizeTender(await fetchTender(id));
      tenders.push(normalized.tender);
      items.push(...normalized.items);
      bids.push(...normalized.bids);
      awards.push(...normalized.awards);
    } catch (err) {
      failed++;
      if (failed <= 5) console.log(`  ${id}: ${(err as Error).message}`);
    }
    done++;
    if (done % 200 === 0) {
      await flush();
      console.log(`  ${done}/${todo.length} fetched (${failed} failed)`);
    }
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
await flush();

const stored = await store.allTenders();
const withOfficer = stored.filter((t) => t.officer_name).length;
console.log(`stored ${stored.length} tenders, ${withOfficer} name a responsible official, ${failed} failed`);
