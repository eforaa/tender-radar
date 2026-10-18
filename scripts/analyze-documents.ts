import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openStore, dataDir } from "../src/config.ts";
import { sourceDocuments, type DocumentResult } from "../src/documents/types.ts";
import { analyzePdf } from "../src/documents/extract.ts";

const limit = Number(process.env.TR_DOCUMENT_LIMIT ?? 2);
if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("Document limit must be 1–20");
const directory = dataDir(); await mkdir(directory, { recursive: true });
const path = join(directory, "document-extractions.json");
const lockPath = join(directory, "documents.lock"); const lock = await open(lockPath, "wx");
try {
  let previous: DocumentResult[] = [];
  try { previous = JSON.parse(await readFile(path, "utf8")); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  const rows = new Map(previous.map(r => [r.key, r]));
  const tenders = (await openStore().allTenders()).filter(t => t.raw && (process.argv[2] ? t.id === process.argv[2] : t.scope_reasons?.length))
    .sort((a, b) => (b.source_modified ?? "").localeCompare(a.source_modified ?? ""));
  if (process.argv[2] && !tenders.length) throw new Error("Tender raw data not found");
  let used = 0; let failed = 0;
  for (const tender of tenders) {
    for (const document of sourceDocuments(tender.raw).sort((a, b) => Number(/догов|специф|додатк/i.test(b.title)) - Number(/догов|специф|додатк/i.test(a.title)))) {
      if (used >= limit) break;
      const key = createHash("sha256").update(`${tender.id}|${document.id}|${document.url}|${document.modified}`).digest("hex");
      const old = rows.get(key);
      if (old && (old.status !== "error" || old.attempts >= 3)) continue;
      const row: DocumentResult = { key, tender_id: tender.id, document, status: "error", updated_at: new Date().toISOString(),
        page_count: 0, processed_pages: 0, ocr_pages: [], claims: [], rejected_count: 0, message: "", attempts: (old?.attempts ?? 0) + 1 };
      if (document.format !== "application/pdf" && !/\.pdf$/i.test(document.title)) {
        row.status = "unsupported"; row.message = "Цей формат ще не обробляється. Відкрийте оригінал.";
      } else {
        used++;
        try {
          Object.assign(row, await analyzePdf(document.url, directory));
          row.status = row.processed_pages === row.page_count && row.page_count > 0 ? "ready" : "partial";
          row.message = row.status === "partial" ? "Оброблено не всі сторінки: потрібна ручна перевірка оригіналу." : "Витягнуті факти потребують перевірки людиною.";
        } catch (error) { row.message = (error as Error).message; failed++; }
      }
      rows.set(key, row);
      await writeFile(`${path}.tmp`, JSON.stringify([...rows.values()])); await rename(`${path}.tmp`, path);
      console.log(`${tender.id} / ${document.title}: ${row.status}, ${row.claims.length} fields, ${row.processed_pages}/${row.page_count} pages`);
    }
    if (used >= limit) break;
  }
  if (failed) process.exitCode = 1;
} finally { await lock.close(); await unlink(lockPath); }
