import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { dataDir, openStore } from "../src/config.ts";
import { readMarketPrices } from "../src/ingest/market.ts";
import { compareDocumentPrices, documentPriceFindings, type ContractPriceContext } from "../src/analysis/document-price.ts";
import type { DocumentResult } from "../src/documents/types.ts";

const dir = dataDir(), store = openStore();
let docs: DocumentResult[] = [];
try { docs = JSON.parse(await readFile(join(dir, "document-extractions.json"), "utf8")); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
let contracts: ContractPriceContext[] = [];
try { contracts = JSON.parse(await readFile(join(dir, "contract-documents.json"), "utf8")); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
const checks = compareDocumentPrices(docs, await store.allTenderItems(), await readMarketPrices(dir), new Date().toISOString(), contracts);
await store.replaceDetectorFindings(["document_market_price"], documentPriceFindings(checks));
const path = join(dir, "document-price-checks.json");
await writeFile(path + ".tmp", JSON.stringify(checks)); await rename(path + ".tmp", path);
console.log(JSON.stringify({ positions: checks.length, compared: checks.filter(r => r.status !== "insufficient").length,
  signals: checks.filter(r => r.status === "signal").length, insufficient: checks.filter(r => r.status === "insufficient").length }));
