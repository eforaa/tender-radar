import test from "node:test";
import assert from "node:assert/strict";
import { signalLine } from "../server/components/case-row.ts";
import { loadDataset } from "../server/data.ts";

const db = await loadDataset();

test("a proven violation leads the line", () => {
  const proven = db.cases.find((c) => c.audit?.violation);
  if (!proven) { assert.ok(true, "no proven case in fixture — skipped"); return; }
  assert.match(signalLine(proven), /Порушення доведено/);
});

test("otherwise the line is a count plus the top risk, short", () => {
  const withRisks = db.cases.find((c) => !c.audit?.violation && c.risks.length >= 2);
  assert.ok(withRisks, "fixture has no multi-risk case — assumption broken");
  const line = signalLine(withRisks);
  // "N ознак · <short reason>" — a count, a separator, and a short label
  assert.match(line, /\d+\s+ознак/);
  assert.match(line, /·/);
  // the short reason must not be a full sentence dump: no more than one separator
  assert.equal((line.match(/·/g) || []).length, 1);
});

test("a single-risk case reads in the singular", () => {
  const one = db.cases.find((c) => !c.audit?.violation && c.risks.length === 1);
  if (!one) { assert.ok(true, "no single-risk case — skipped"); return; }
  assert.match(signalLine(one), /1 ознака/);
});

test("a case with no risks and no audit yields an empty line", () => {
  const bare = db.cases.find((c) => !c.audit?.violation && c.risks.length === 0);
  if (!bare) { assert.ok(true, "no bare case — skipped"); return; }
  assert.equal(signalLine(bare), "");
});
