import test from "node:test";
import assert from "node:assert/strict";
import { validateExtraction } from "../src/analysis/ai-extract.ts";
test("AI extraction accepts quoted facts, rejects invented quotes and unquoted values", () => {
  const claim = { item_id: "a", field: "quantity", value: "100", quote: "quantity: 100" };
  assert.equal(validateExtraction({ claims: [claim] }, "quantity: 100").length, 1);
  assert.throws(() => validateExtraction({ claims: [{ ...claim, value: "200" }] }, "quantity: 100"));
  assert.throws(() => validateExtraction({ claims: [claim] }, "quantity: 200"));
  assert.throws(() => validateExtraction({ claims: [claim, claim] }, "quantity: 100"));
  assert.throws(() => validateExtraction({ claims: [{ ...claim, field: "guilty" }] }, "quantity: 100"));
});
