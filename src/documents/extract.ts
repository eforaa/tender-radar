import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractWord, textFragments } from "./word.ts";
import { allowedDocumentUrl } from "./types.ts";
import { extractWithClaude } from "../analysis/ai-extract.ts";

class TemporaryDownloadError extends Error {}
export async function downloadDocument(url: string, maxBytes = 50 * 1024 * 1024): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    try { return await downloadOnce(url, maxBytes); }
    catch (error) {
      if (!(error instanceof TemporaryDownloadError) || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}
async function downloadOnce(url: string, maxBytes: number): Promise<Uint8Array> {
  for (let redirect = 0; redirect < 4; redirect++) {
    if (!allowedDocumentUrl(url)) throw new Error("Document host is not allowed");
    let response: Response;
    try { response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(45000) }); }
    catch (error) { const e = error as Error & { cause?: { code?: string } }; throw new TemporaryDownloadError(`Document network error: ${e.cause?.code ?? e.name}`); }
    if (response.status === 429 || response.status >= 500) { await response.body?.cancel(); throw new TemporaryDownloadError(`Document download HTTP ${response.status}`); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location"); await response.body?.cancel();
      if (!location) throw new Error("Missing document redirect");
      url = new URL(location, url).href; continue;
    }
    if (!response.ok || !response.body) throw new Error(`Document download HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > maxBytes) { await response.body.cancel(); throw new Error(`Document exceeds ${Math.ceil(maxBytes / 1024 / 1024)} MB`); }
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break;
        length += value.length; if (length > maxBytes) throw new Error(`Document exceeds ${Math.ceil(maxBytes / 1024 / 1024)} MB`); chunks.push(value); }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks);
  }
  throw new Error("Too many document redirects");
}

export async function extractPdf(bytes: Uint8Array, directory: string, options: { maxPages?: number; maxOcrPages?: number } = {}) {
  if (!Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from("%PDF-"))) throw new Error("Not a PDF document");
  const maxPages = options.maxPages ?? 50, maxOcrPages = options.maxOcrPages ?? 50;
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const pdf = await task.promise;
  const pages: { page: number; text: string; method: "text" | "ocr" }[] = [];
  let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;
  let ocrCount = 0;
  try {
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      let method: "text" | "ocr" = "text";
      if (text.replace(/\s/g, "").length < 40) {
        if (ocrCount >= maxOcrPages) continue;
        if (!worker) {
          const { createWorker } = await import("tesseract.js");
          const cachePath = join(directory, "ocr-cache"); await mkdir(cachePath, { recursive: true });
          worker = await createWorker(["ukr", "eng"], undefined, { cachePath });
        }
        const { createCanvas } = await import("@napi-rs/canvas");
        const original = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1800 / Math.max(original.width, original.height));
        const viewport = page.getViewport({ scale }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvas: canvas as any, canvasContext: canvas.getContext("2d") as any, viewport }).promise;
        text = (await worker.recognize(canvas.toBuffer("image/png"))).data.text.trim(); method = "ocr"; ocrCount++;
      }
      if (text) pages.push({ page: n, text, method });
      page.cleanup();
    }
    return { page_count: pdf.numPages, pages };
  } finally { await worker?.terminate(); await task.destroy(); }
}

export async function analyzePdf(url: string, directory: string) { return analyzeDocument(url, directory, "pdf"); }

export async function analyzeDocument(url: string, directory: string, format: "pdf" | "doc" | "docx",
  extractor: (source: string) => Promise<{ claims: import("../analysis/ai-extract.ts").Claim[]; rejected: unknown[] }> = source => extractWithClaude(source, { timeoutMs: 300_000 })) {
  const bytes = await downloadDocument(url);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const sourceDir = join(directory, "documents"); await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, `${hash}.${format}`), bytes);
  const cachePath = join(sourceDir, `${hash}.text.json`);
  let extracted: Awaited<ReturnType<typeof extractPdf>> | undefined;
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    if ((cached.parser_version === 3 && cached.format === format) ||
      (cached.parser_version === undefined && format === "pdf" && cached.pages?.length === cached.page_count && cached.page_count > 0)) extracted = cached;
  } catch (error) { if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (!extracted) {
    const fragments = format === "pdf" ? null : textFragments(await extractWord(bytes));
    extracted = fragments ? { page_count: fragments.length, pages: fragments } : await extractPdf(bytes, directory);
    // Reuse expensive OCR if the subsequent Claude call fails and the job retries later.
    await writeFile(cachePath, JSON.stringify({ ...extracted, parser_version: 3, format }));
  }
  const locator_kind = format === "pdf" ? "page" as const : "fragment" as const;
  const selected: typeof extracted.pages = []; let length = 0; let truncated = false;
  for (const page of extracted.pages) {
    const available = 300000 - length;
    if (available <= 0) { truncated = true; break; }
    const text = page.text.slice(0, Math.min(available, 75000));
    selected.push({ ...page, text }); length += text.length;
    if (text.length < page.text.length) truncated = true;
  }
  // Independent bounded calls cover long documents rather than silently stopping at the first prompt.
  const batches: (typeof selected)[] = []; let batch: typeof selected = []; let batchLength = 0;
  for (const page of selected) {
    if (batch.length && batchLength + page.text.length > 75000) { batches.push(batch); batch = []; batchLength = 0; }
    batch.push(page); batchLength += page.text.length;
  }
  if (batch.length) batches.push(batch);
  const claims: import("./types.ts").DocumentResult["claims"] = []; let rejected_count = 0;
  for (const group of batches) {
    const source = group.map(p => `[${locator_kind.toUpperCase()} ${p.page}]\n${p.text}`).join("\n\n");
    const result = await extractor(source);
    rejected_count += result.rejected.length;
    for (const claim of result.claims) {
      const matches = selected.filter(p => p.text.includes(claim.quote));
      if (matches.length !== 1) { rejected_count++; continue; }
      if (!claims.some(c => c.field === claim.field && c.quote === claim.quote && c.value === claim.value))
        claims.push({ ...claim, page: matches[0].page, method: matches[0].method });
    }
  }
  return { format, locator_kind, truncated, source_sha256: hash, page_count: extracted.page_count, processed_pages: selected.length,
    ocr_pages: selected.filter(p => p.method === "ocr").map(p => p.page), claims,
    rejected_count };
}
