import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { allowedDocumentUrl } from "./types.ts";
import { extractWithClaude } from "../analysis/ai-extract.ts";

export async function downloadDocument(url: string, maxBytes = 15 * 1024 * 1024): Promise<Uint8Array> {
  for (let redirect = 0; redirect < 4; redirect++) {
    if (!allowedDocumentUrl(url)) throw new Error("Document host is not allowed");
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(45000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location"); await response.body?.cancel();
      if (!location) throw new Error("Missing document redirect");
      url = new URL(location, url).href; continue;
    }
    if (!response.ok || !response.body) throw new Error(`Document download HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > maxBytes) { await response.body.cancel(); throw new Error("Document exceeds 15 MB"); }
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break;
        length += value.length; if (length > maxBytes) throw new Error("Document exceeds 15 MB"); chunks.push(value); }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks);
  }
  throw new Error("Too many document redirects");
}

export async function extractPdf(bytes: Uint8Array, directory: string, options: { maxPages?: number; maxOcrPages?: number } = {}) {
  if (!Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from("%PDF-"))) throw new Error("Not a PDF document");
  const maxPages = options.maxPages ?? 8, maxOcrPages = options.maxOcrPages ?? 4;
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

export async function analyzePdf(url: string, directory: string) {
  const bytes = await downloadDocument(url);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const sourceDir = join(directory, "documents"); await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, `${hash}.pdf`), bytes);
  const extracted = await extractPdf(bytes, directory);
  // Retain extracted pages locally; only verified claim quotations are exported to the site.
  await writeFile(join(sourceDir, `${hash}.text.json`), JSON.stringify(extracted));
  const selected: typeof extracted.pages = []; let length = 0;
  for (const page of extracted.pages) { if (length + page.text.length > 85000) break; selected.push(page); length += page.text.length; }
  const source = selected.map(p => `[PAGE ${p.page}]\n${p.text}`).join("\n\n");
  if (!source) return { source_sha256: hash, page_count: extracted.page_count, processed_pages: 0, ocr_pages: [], claims: [], rejected_count: 0 };
  const result = await extractWithClaude(source);
  const claims = result.claims.flatMap(claim => {
    const matches = selected.filter(p => p.text.includes(claim.quote));
    // A quote spanning pages or occurring on several pages has no unambiguous page citation.
    return matches.length === 1 ? [{ ...claim, page: matches[0].page, method: matches[0].method }] : [];
  });
  return { source_sha256: hash, page_count: extracted.page_count, processed_pages: selected.length,
    ocr_pages: selected.filter(p => p.method === "ocr").map(p => p.page), claims,
    rejected_count: result.rejected.length + result.claims.length - claims.length };
}
