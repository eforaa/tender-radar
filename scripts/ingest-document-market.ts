import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { dataDir } from "../src/config.ts";
import { getJson } from "../src/sources/http.ts";
import { readMarketPrices } from "../src/ingest/market.ts";
import { normalizeMarketPrice } from "../src/analysis/market-price.ts";
import type { ContractPriceContext } from "../src/analysis/document-price.ts";
import type { DocumentResult } from "../src/documents/types.ts";

const dir = dataDir(); await mkdir(dir, { recursive: true });
async function read<T>(name: string, fallback: T): Promise<T> { try { return JSON.parse(await readFile(join(dir, name), "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw e; } }
const contracts = await read<ContractPriceContext[]>("contract-documents.json", []);
const docs = await read<DocumentResult[]>("document-extractions.json", []);
const refreshed = await read<Record<string, string>>("document-market-state.json", {});
const ids = [...new Set(contracts.filter(c => c.contract.status === "active" && docs.some(d => d.tender_id === c.tender_id && c.contract.documents?.some(cd => cd.id === d.document.id) && d.claims.some(cl => cl.field === "unit_price")))
  .flatMap(c => c.contract.items?.map(i => i.product).filter((id): id is string => typeof id === "string" && /^[a-f0-9]{32}$/.test(id)) ?? []))]
  .sort((a, b) => (refreshed[a] ?? "").localeCompare(refreshed[b] ?? "")).slice(0, 10);
const lockPath = join(dir, "market-ingest.lock"), lock = await open(lockPath, "wx");
try {
  const rows = new Map((await readMarketPrices(dir)).map(p => [p.id, p]));
  let count = 0;
  for (const id of ids) {
    if (refreshed[id] && Date.now() - Date.parse(refreshed[id]) < 3600000) continue;
    const base = `https://market-api.prozorro.gov.ua/api/products/${id}`;
    const { data: product } = await getJson<{ data: Record<string, unknown> }>(base);
    const { data: prices } = await getJson<{ data: Record<string, unknown>[] }>(base + "/prices?descending=1&limit=100");
    const now = new Date().toISOString();
    for (const price of prices) {
      const normalized = normalizeMarketPrice(price, product, now); rows.set(normalized.id, normalized);
      const body = JSON.stringify({ price, product }); const folder = join(dir, "market-sources"); await mkdir(folder, { recursive: true });
      await writeFile(join(folder, createHash("sha256").update(body).digest("hex") + ".json"), body); count++;
    }
    refreshed[id] = now;
  }
  for (const [name, value] of [["market-prices.json", [...rows.values()]], ["document-market-state.json", refreshed]] as const) {
    const path = join(dir, name); await writeFile(path + ".tmp", JSON.stringify(value)); await rename(path + ".tmp", path);
  }
  console.log(`Document products: ${ids.length}; price references refreshed: ${count}`);
} finally { await lock.close(); await unlink(lockPath); }
