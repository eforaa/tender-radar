import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allowedDocumentUrl, sourceDocuments, documentFormat } from "../src/documents/types.ts";
import { extractWord, textFragments } from "../src/documents/word.ts";
import { analyzeDocument, downloadDocument, extractPdf } from "../src/documents/extract.ts";
import { documentSection } from "../server/components/documents.ts";

test("document allowlist rejects private hosts, credentials and misleading suffixes", () => {
  assert.ok(allowedDocumentUrl("https://public-docs.prozorro.gov.ua/get/123?Signature=abc"));
  for (const url of ["http://public-docs.prozorro.gov.ua/x", "https://127.0.0.1/x", "https://public-docs.prozorro.gov.ua.evil.test/x", "https://x@public-docs.prozorro.gov.ua/x", "https://public-docs.prozorro.gov.ua:8080/x", "file:///etc/passwd"])
    assert.equal(allowedDocumentUrl(url), false);
});
test("follows the real Prozorro storage redirect and retries temporary server failures", async t => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    if (urls.length === 1) return new Response(null, { status: 503 });
    if (url.includes("public-docs")) return new Response(null, { status: 302, headers: { location: "https://swift-prod.prozorro.gov.ua/file" } });
    return new Response("%PDF-test");
  });
  assert.equal(Buffer.from(await downloadDocument("https://public-docs.prozorro.gov.ua/get/x")).toString(), "%PDF-test");
  assert.equal(urls.length, 3);
  assert.equal(allowedDocumentUrl("https://swift-prod.prozorro.gov.ua.evil.test/x"), false);
});
test("recognizes Word formats from names and MIME; rejects unrelated files", () => {
  assert.equal(documentFormat({ title: "Специфікація.DOCX", format: "text/plain" }), "docx");
  assert.equal(documentFormat({ title: "Документ", format: "application/msword" }), "doc");
  assert.equal(documentFormat({ title: "sign.p7s", format: "application/octet-stream" }), null);
});
test("Word worker extracts Cyrillic text and table cells without normalizing quotes", async () => {
  const text = await extractWord(await readFile(new URL("fixtures/documents/specification.docx", import.meta.url)));
  assert.match(text, /Товар «Кабель»/); assert.match(text, /100 м/); assert.match(text, /200 грн з ПДВ/);
  await assert.rejects(extractWord(Buffer.from("<html>not Word</html>")), /Not a binary DOC or DOCX/);
});
test("Word fragment numbers are deterministic and text is not silently truncated", () => {
  const text = ("Текст договору та специфікації\n").repeat(1200);
  const parts = textFragments(text);
  assert.ok(parts.length > 2); assert.ok(parts.every((p, i) => p.page === i + 1 && p.text.length <= 12000));
  assert.equal(parts.map(p => p.text).join("").replace(/\s/g, ""), text.replace(/\s/g, ""));
});
test("long Word document reaches Claude in batches including its final item", async t => {
  const bytes = await readFile(new URL("fixtures/documents/long-specification.docx", import.meta.url));
  t.mock.method(globalThis, "fetch", async () => new Response(bytes));
  const dir = await mkdtemp(join(tmpdir(), "tendoscope-long-word-"));
  let calls = 0;
  try {
    const result = await analyzeDocument("https://public-docs.prozorro.gov.ua/doc", dir, "docx", async source => {
      calls++; assert.ok(source.length < 100000);
      return { rejected: [], claims: source.includes("Остання позиція: 987 метрів") ? [{ item_id: "last", field: "quantity", value: "987", quote: "Остання позиція: 987 метрів" }] : [] };
    });
    assert.ok(calls > 1); assert.equal(result.truncated, false);
    assert.equal(result.processed_pages, result.page_count); assert.equal(result.locator_kind, "fragment");
    assert.equal(result.claims[0].value, "987"); assert.equal(result.claims[0].page, result.page_count);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("collects amendments and award documents, deduplicates repeated sources", () => {
  const doc = { id: "one", title: "Contract.pdf", url: "https://public-docs.prozorro.gov.ua/one" };
  assert.equal(sourceDocuments({ documents: [doc], contracts: [{ documents: [doc], changes: [{ documents: [{ ...doc, id: "two" }] }] }], awards: [{ documents: [{ ...doc, id: "three" }] }] }).length, 3);
  assert.deepEqual(sourceDocuments(null), []);
});
test("redirect to a private host is rejected before a second request", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }); });
  await assert.rejects(downloadDocument("https://public-docs.prozorro.gov.ua/x"), /not allowed/);
  assert.equal(calls, 1);
});
test("download rejects oversized body even without content length", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("123456789"));
  await assert.rejects(downloadDocument("https://public-docs.prozorro.gov.ua/x", 5), /exceeds/);
});
function fixturePdf(): Uint8Array {
  const text = "BT /F1 12 Tf 20 100 Td (Contract quantity 100 units and unit price 200 UAH including VAT.) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test("real PDF parser extracts text with a page citation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tendoscope-pdf-"));
  try {
    const result = await extractPdf(fixturePdf(), dir, { maxOcrPages: 0 });
    assert.equal(result.page_count, 1); assert.equal(result.pages[0].page, 1);
    assert.equal(result.pages[0].method, "text"); assert.match(result.pages[0].text, /quantity 100/);
    await assert.rejects(extractPdf(Buffer.from("not pdf"), dir), /Not a PDF/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("document HTML escapes source titles and quotes, rejects unsafe links", () => {
  const html = documentSection([{ key: "x", tender_id: "x", document: { id: "x", title: "<script>bad</script>", url: "javascript:alert(1)", format: "application/pdf", modified: "", kind: "" }, status: "partial", updated_at: "", page_count: 10, processed_pages: 1, ocr_pages: [1], claims: [{ item_id: "1", field: "quantity", value: "10", quote: "<img>10", page: 1, method: "ocr" }], rejected_count: 0, message: "Partial", attempts: 1 }]);
  assert.ok(!html.includes("javascript:")); assert.ok(!html.includes("<script>bad"));
  assert.match(html, /&lt;img&gt;10/); assert.match(html, /1\/10/); assert.match(html, /OCR/);
});
