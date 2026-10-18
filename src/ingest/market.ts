import { readFile, writeFile, rename, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { getJson } from "../sources/http.ts";
import { normalizeMarketPrice, type MarketPrice } from "../analysis/market-price.ts";

const BASE = "https://market-api.prozorro.gov.ua";
const START = `${BASE}/api/prices?limit=100&descending=1`;
export async function readMarketPrices(directory: string): Promise<MarketPrice[]> {
  try { return JSON.parse(await readFile(join(directory, "market-prices.json"), "utf8")); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
}
async function save(path: string, value: unknown) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value)); await rename(temp, path);
}
type State = { history: string | null; recent: string | null; boundary: string | null; newHead: string | null; head: string | null; historyComplete: boolean };
export async function ingestMarket(directory: string, maxPages = 6) {
  if (!Number.isInteger(maxPages) || maxPages < 2) throw new Error("Market pages must be >= 2");
  await mkdir(directory, { recursive: true });
  const lockPath = join(directory, "market-ingest.lock"); const lock = await open(lockPath, "wx");
  try {
    const statePath = join(directory, "market-cursor.json");
    let state: State;
    try { state = JSON.parse(await readFile(statePath, "utf8")); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      state = { history: START, recent: null, boundary: null, newHead: null, head: null, historyComplete: false }; }
    const rows = new Map((await readMarketPrices(directory)).map(p => [p.id, p]));
    const products = new Map<string, Record<string, unknown>>();
    let fetched = 0;
    if (state.head && !state.recent) { state.recent = START; state.boundary = state.head; state.newHead = null; }
    for (const direction of ["recent", "history"] as const) {
      const budget = direction === "recent" ? Math.floor(maxPages / 2) : Math.ceil(maxPages / 2);
      for (let n = 0; n < budget && state[direction]; n++) {
        const uri = state[direction]!;
        if (new URL(uri).origin !== BASE) throw new Error("Untrusted market cursor");
        const page = await getJson<{ data: Record<string, unknown>[]; next_page?: { uri: string } }>(uri);
        if (!Array.isArray(page.data)) throw new Error("Invalid market feed");
        const boundary = direction === "recent" ? page.data.findIndex(p => p.id === state.boundary) : -1;
        const batch = boundary >= 0 ? page.data.slice(0, boundary) : page.data;
        const normalized: MarketPrice[] = [];
        // A page is committed only after all products and prices are validated.
        const queue = [...batch];
        const workers = await Promise.allSettled(Array.from({ length: 4 }, async () => {
          while (queue.length) {
            const price = queue.shift()!;
            if (typeof price.productId !== "string") throw new Error("Missing market product ID");
            let product = products.get(price.productId);
            if (!product) { product = (await getJson<{ data: Record<string, unknown> }>(`${BASE}/api/products/${encodeURIComponent(price.productId)}`)).data; products.set(price.productId, product); }
            normalized.push(normalizeMarketPrice(price, product, new Date().toISOString()));
            const body = JSON.stringify({ price, product });
            const sourceDir = join(directory, "market-sources");
            await mkdir(sourceDir, { recursive: true });
            await writeFile(join(sourceDir, `${createHash("sha256").update(body).digest("hex")}.json`), body);
          }
        }));
        const failed = workers.find(r => r.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
        for (const price of normalized) rows.set(price.id, price);
        await save(join(directory, "market-prices.json"), [...rows.values()]);
        fetched += normalized.length;
        if (direction === "recent" && !state.newHead && page.data.length) state.newHead = String(page.data[0].id);
        if (!state.head && page.data.length) state.head = String(page.data[0].id);
        if (!page.data.length || boundary >= 0 || !page.next_page?.uri) {
          state[direction] = null;
          if (direction === "history") state.historyComplete = true;
          else { state.head = state.newHead ?? state.head; state.newHead = null; state.boundary = null; }
        } else {
          if (page.next_page.uri === uri) throw new Error("Market cursor did not advance");
          state[direction] = page.next_page.uri;
        }
        await save(statePath, state);
      }
    }
    return { fetched, total: rows.size, historyComplete: state.historyComplete };
  } finally { await lock.close(); await unlink(lockPath); }
}
