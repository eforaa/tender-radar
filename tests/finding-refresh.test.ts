import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../src/store/json-store.ts";
import type { FindingRow } from "../src/store/types.ts";
import { loadDataset } from "../server/data.ts";
import { applyControls, readControls } from "../server/controls.ts";
import { normalizeTender } from "../src/normalize/tender.ts";

function finding(id: string, detector = "peer_price"): FindingRow {
  return { tender_id: id, detector_key: detector, tier: "own_analysis",
    severity: "low", title: id, explanation: "test", evidence: {}, created_at: "2026-10-18" };
}

test("audit monitoring conclusions never appear in the price-only results", async () => {
  const dir = await mkdtemp(join(tmpdir(), "radar-price-filter-"));
  const previous = process.env.TR_DATA_DIR;
  process.env.TR_DATA_DIR = dir;
  try {
  const store = new JsonStore(dir);
  await store.replaceTenderCards(["priced", "audit"].map(id => normalizeTender({ id, tenderID: `UA-2026-01-01-${id}`, title: id })));
  await store.upsertFindings([finding("priced"), finding("audit", "monitoring")]);
  await store.upsertMonitorings([{ monitoring_id: "m", tender_id: "audit", status: "completed", decision_text: "test",
    reasons: [], conclusion: { violationOccurred: true, description: "test", date: "2026-01-01" }, date_created: "2026-01-01", date_modified: "2026-01-01" }]);
  const ds = await loadDataset();
  assert.equal(ds.cases.length, 2, "unflagged tenders appear without synthetic risk flags");
  assert.ok(ds.cases.some((entry) => entry.audit), "fixture includes audit conclusions");
  const priced = applyControls(ds.cases, readControls(new URL("http://localhost/?price=1")), new Set());
  assert.ok(priced.length > 0, "fixture includes price signals");
  for (const entry of priced) {
    assert.ok(entry.findings.every((row) => ["peer_price", "own_price_growth"].includes(row.detector_key)));
  }
  assert.equal(ds.findingCount, ds.cases.reduce((n, entry) => n + entry.findings.length, 0));
  } finally {
    if (previous === undefined) delete process.env.TR_DATA_DIR; else process.env.TR_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test("completed price run withdraws stale findings, preserves other detectors and can clear all price signals", async () => {
  const dir = await mkdtemp(join(tmpdir(), "radar-findings-"));
  try {
    const store = new JsonStore(dir);
    const unrelated = finding("external", "other_detector");
    await store.upsertFindings([finding("stale"), finding("old-growth", "own_price_growth"), unrelated]);
    await store.replaceDetectorFindings(["peer_price", "own_price_growth"], [finding("current")]);
    assert.deepEqual(await store.allFindings(), [unrelated, finding("current")]);
    await store.replaceDetectorFindings(["peer_price", "own_price_growth"], []);
    assert.deepEqual(await store.allFindings(), [unrelated]);
    await assert.rejects(store.replaceDetectorFindings(["peer_price"], [finding("bad", "other_detector")]));
    assert.deepEqual(await store.allFindings(), [unrelated]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
