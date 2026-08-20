import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../src/normalize/csv.ts";

test("parses a plain row", () => {
  assert.deepEqual(parseCsv("a,b\n1,2\n"), [{ a: "1", b: "2" }]);
});

test("keeps commas that live inside quotes", () => {
  // This is the one that matters: worked_risks is a quoted list.
  assert.equal(parseCsv(`a,b\n1,"['x', 'y']"\n`)[0].b, "['x', 'y']");
});

test("collapses a doubled quote into one", () => {
  assert.equal(parseCsv(`a\n"say ""hi"""\n`)[0].a, 'say "hi"');
});

test("tolerates CRLF and a missing trailing newline", () => {
  assert.deepEqual(parseCsv("a,b\r\n1,2"), [{ a: "1", b: "2" }]);
});

test("ignores a blank final line", () => {
  assert.equal(parseCsv("a\n1\n\n").length, 1);
});

test("fills missing trailing fields with empty strings", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,2"), [{ a: "1", b: "2", c: "" }]);
});
