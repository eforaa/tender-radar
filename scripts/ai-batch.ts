import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { dataDir, openStore } from "../src/config.ts";
import { extractWithClaude } from "../src/analysis/ai-extract.ts";

const limit = Number(process.env.TR_AI_BATCH_LIMIT ?? 10);
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("AI batch limit must be 1–100");
const directory = join(dataDir(), "ai-review");
await mkdir(directory, { recursive: true });
const lockPath = join(directory, "batch.lock"); const lock = await open(lockPath, "wx");
function lines(value: unknown, path = "items"): string[] {
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, child]) => lines(child, `${path}.${key}`));
  return [`${path}: ${String(value)}`];
}
try {
  const tenders = (await openStore().allTenders()).filter(t => t.raw && t.scope_reasons?.length)
    .sort((a, b) => (b.source_modified ?? "").localeCompare(a.source_modified ?? ""));
  let processed = 0;
  for (const tender of tenders) {
    if (processed >= limit) break;
    const raw = tender.raw as { items?: unknown[] };
    if (!raw.items?.length) continue;
    const source = [`tender_id: ${tender.id}`, ...lines(raw.items)].join("\n");
    if (source.length > 100_000) { console.log(`Skipped oversized source ${tender.id}`); continue; }
    const hash = createHash("sha256").update(source).digest("hex");
    const path = join(directory, `${hash}.json`);
    try { JSON.parse(await readFile(path, "utf8")); continue; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    const result = await extractWithClaude(source);
    await writeFile(`${path}.tmp`, JSON.stringify({ ...result, tender_id: tender.id,
      source_url: `https://prozorro.gov.ua/tender/${tender.tender_id}`, source }, null, 2));
    await rename(`${path}.tmp`, path);
    processed++;
    console.log(`${tender.id}: ${result.claims.length} quoted fields, ${result.rejected.length} rejected; human review required`);
  }
  console.log(`AI processed: ${processed}; unchanged sources skipped`);
} finally { await lock.close(); await unlink(lockPath); }
