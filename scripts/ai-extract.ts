import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openStore, dataDir } from "../src/config.ts";
import { extractWithClaude } from "../src/analysis/ai-extract.ts";

const id = process.argv[2];
if (!id) throw new Error("Usage: npm run ai:extract -- <Prozorro internal tender id>");
const tender = (await openStore().allTenders()).find(t => t.id === id);
if (!tender?.raw) throw new Error("Full public source missing: ingest the tender first");
// Deliberately send public procurement items only, no user notes or contact details.
const raw = tender.raw as { items?: unknown };
// Plain-text values avoid JSON escape sequences changing verbatim quotations.
function lines(value: unknown, path = "items"): string[] {
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, child]) => lines(child, `${path}.${key}`));
  return [`${path}: ${String(value)}`];
}
const source = [`tender_id: ${tender.id}`, ...lines(raw.items ?? [])].join("\n");
const result = await extractWithClaude(source);
const directory = join(dataDir(), "ai-review");
await mkdir(directory, { recursive: true });
const path = join(directory, `${result.source_sha256}.json`);
await writeFile(path, JSON.stringify({ ...result, tender_id: tender.id, source_url: `https://prozorro.gov.ua/tender/${tender.tender_id}`, source }, null, 2));
console.log(`Saved ${result.claims.length} quoted fields for review; rejected ${result.rejected.length} unsupported fields: ${path}`);
