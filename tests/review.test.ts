import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { validReviewRows, REVIEW_SCRIPT } from "../server/review-client.ts";
import { reviewEditor, reviewPage } from "../server/pages/review.ts";

const record = { id: "abc123", title: "Tender", ref: "UA-2026", status: "in_progress", note: "Check VAT", updated_at: "2026-10-18T12:00:00.000Z" };
test("queue import accepts round trips and rejects corrupt or oversized records", () => {
  assert.ok(validReviewRows(JSON.parse(JSON.stringify([record]))));
  for (const rows of [null, {}, [record, record], [{ ...record, id: "../../x" }], [{ ...record, status: "guilty" }], [{ ...record, note: "a".repeat(10001) }], [{ ...record, updated_at: "bad" }]]) assert.equal(validReviewRows(rows), false);
});
test("browser script is valid JS and harmless on pages without a queue", () => {
  const script = REVIEW_SCRIPT.replace(/^<script>\s*/, "").replace(/<\/script>$/, "");
  vm.runInNewContext(script, { document: { querySelector: () => null, getElementById: () => null } });
});
test("review editor escapes metadata and page explains local storage", () => {
  const html = reviewEditor({ id: "abc", title: '"><script>bad</script>', ref: "ref" });
  assert.ok(!html.includes("<script>bad</script>"));
  assert.match(reviewPage(), /лише у цьому браузері/);
});
test("queue saves without navigation, preserves other rows and blocks stale edits", () => {
  let stored = JSON.stringify([record]); let handler: (event: unknown) => void = () => {};
  const message = { textContent: "" };
  const editor = { dataset: { reviewEditor: JSON.stringify({ id: "new1", title: "New", ref: "UA-new" }) },
    elements: { status: { value: "" }, note: { value: "" } },
    addEventListener: (_name: string, fn: typeof handler) => { handler = fn; } };
  vm.runInNewContext(REVIEW_SCRIPT.replace(/^<script>\s*/, "").replace(/<\/script>$/, ""), {
    document: { querySelector: () => editor, getElementById: (id: string) => id === "review-message" ? message : null },
    localStorage: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } },
    window: { addEventListener: () => {} },
  });
  editor.elements.note.value = "My note"; editor.elements.status.value = "needs_documents";
  let prevented = false; handler({ preventDefault: () => { prevented = true; } });
  assert.ok(prevented); assert.equal(JSON.parse(stored).length, 2);
  assert.equal(JSON.parse(stored)[1].note, "My note"); assert.match(message.textContent, /Збережено/);
  const rows = JSON.parse(stored); rows[1].updated_at = "2099-01-01T00:00:00Z"; rows[1].note = "Another tab"; stored = JSON.stringify(rows);
  handler({ preventDefault() {} });
  assert.equal(JSON.parse(stored)[1].note, "Another tab"); assert.match(message.textContent, /іншій вкладці/);
});
