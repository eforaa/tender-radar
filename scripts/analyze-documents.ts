import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openStore, dataDir } from "../src/config.ts";
import { documentFormat, sourceDocuments, type DocumentResult } from "../src/documents/types.ts";
import { analyzeDocument } from "../src/documents/extract.ts";

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
  let contracts: { tender_id: string; contract: Record<string, unknown> }[] = [];
  try { contracts = JSON.parse(await readFile(join(directory, "contract-documents.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const candidates = tenders.flatMap(tender => [...sourceDocuments({ contracts: contracts.filter(c => c.tender_id === tender.id && c.contract.status === "active").map(c => c.contract) }), ...sourceDocuments(tender.raw)]
    .sort((a, b) => Number(b.kind === "Договір та додатки") - Number(a.kind === "Договір та додатки") || Number(/догов|специф|додатк/i.test(b.title)) - Number(/догов|специф|додатк/i.test(a.title)))
    .map(document => ({ tender, document, key: createHash("sha256").update(`${tender.id}|${document.id}|${document.url}|${document.modified}`).digest("hex") })));
  // Broken sources must not consume every daily slot and starve documents not yet tried.
  candidates.sort((a, b) => Number(rows.get(a.key)?.status === "error") - Number(rows.get(b.key)?.status === "error"));
  for (const { tender, document, key } of candidates) {
      if (used >= limit) break;
      if (process.env.TR_DOCUMENT_ID && document.id !== process.env.TR_DOCUMENT_ID) continue;
      const format = documentFormat(document);
      const old = rows.get(key);
      if (old?.analyzer_version === 4 && old.status !== "error") continue;
      if (process.env.TR_DOCUMENT_RETRY !== "1" && old?.analyzer_version === 4 && old.status === "error" && Date.now() - Date.parse(old.updated_at) < 60 * 60 * 1000) continue;
      const row: DocumentResult = { analyzer_version: 4, key, tender_id: tender.id, document, status: "error", updated_at: new Date().toISOString(),
        page_count: 0, processed_pages: 0, ocr_pages: [], claims: [], rejected_count: 0, message: "", attempts: (old?.attempts ?? 0) + 1 };
      if (!format) {
        row.status = "unsupported"; row.message = "Цей формат ще не обробляється. Відкрийте оригінал.";
      } else {
        used++;
        try {
          Object.assign(row, await analyzeDocument(document.url, directory, format));
          row.status = !row.truncated && row.processed_pages === row.page_count && row.page_count > 0 ? "ready" : "partial";
          row.message = row.status === "partial" ? "Витяг неповний: перевірте необроблену частину оригіналу." : "Витягнуті факти потребують перевірки людиною.";
          if (format !== "pdf") row.message += " Word: витягнуто текст; зображення та верстку не аналізовано.";
        } catch (error) { row.message = (error as Error).message; failed++; }
      }
      rows.set(key, row);
      await writeFile(`${path}.tmp`, JSON.stringify([...rows.values()])); await rename(`${path}.tmp`, path);
      console.log(`${tender.id} / ${document.title}: ${row.status}, ${row.claims.length} fields, ${row.processed_pages}/${row.page_count} ${row.locator_kind === "fragment" ? "fragments" : "pages"}`);
  }
  if (failed) process.exitCode = 1;
} finally { await lock.close(); await unlink(lockPath); }
