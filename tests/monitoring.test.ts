import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMonitoring,
  violationEstablished,
  conclusionText,
  conclusionPublished,
  findingFromMonitoring,
} from "../src/normalize/monitoring.ts";
import { CONCLUDED_STATUSES } from "../src/sources/audit.ts";

const withViolation = {
  id: "7b025c21aa1a458e94b4dc6ad98930e1",
  tender_id: "f97b452aedea426db483861256dd0f19",
  status: "addressed",
  reasons: ["fiscal"],
  dateCreated: "2026-08-01T10:00:00+03:00",
  dateModified: "2026-08-21T16:52:34+03:00",
  decision: { description: "Рішення про початок моніторингу" },
  conclusion: {
    violationOccurred: true,
    violationType: ["other"],
    datePublished: "2026-08-20T09:00:00+03:00",
    description: "  За результатами аналізу\n\nвстановлено порушення вимог частини дев'ятої статті 26 Закону.  ",
  },
};

const cleared = { ...withViolation, id: "clean", conclusion: { violationOccurred: false, description: "Порушень не встановлено." } };
const stillOpen = { id: "open", tender_id: "t", status: "active", dateModified: "2026-08-21T00:00:00+03:00" };

test("flattens a monitoring into a store row", () => {
  const row = normalizeMonitoring(withViolation);
  assert.equal(row.monitoring_id, "7b025c21aa1a458e94b4dc6ad98930e1");
  assert.equal(row.tender_id, "f97b452aedea426db483861256dd0f19");
  assert.equal(row.status, "addressed");
  // The decision that opens a monitoring is pages of statute and came to
  // 3.7 MB across the set; `reasons` carries the same ground as a code.
  assert.equal(row.decision_text, null);
  assert.deepEqual(row.reasons, ["fiscal"]);
  assert.equal(row.date_created, "2026-08-01T10:00:00+03:00");
});

test("a missing conclusion is not the same as a clean one", () => {
  // "not checked" and "checked, nothing found" print differently next to a
  // named organisation, so they must not collapse into one value.
  assert.equal(violationEstablished(normalizeMonitoring(withViolation)), true);
  assert.equal(violationEstablished(normalizeMonitoring(cleared)), false);
  assert.equal(violationEstablished(normalizeMonitoring(stillOpen)), null);
});

test("the auditors' wording is collapsed but not reworded", () => {
  const text = conclusionText(normalizeMonitoring(withViolation));
  assert.equal(text, "За результатами аналізу встановлено порушення вимог частини дев'ятої статті 26 Закону.");
});

test("a long conclusion is cut on a word boundary with an ellipsis", () => {
  const long = { ...withViolation, conclusion: { ...withViolation.conclusion, description: "слово ".repeat(400) } };
  const text = conclusionText(normalizeMonitoring(long), 100);
  assert.ok(text.length <= 101, `got ${text.length}`);
  assert.ok(text.endsWith("…"));
  assert.ok(!text.includes("сло…"), "should not cut mid-word");
});

test("publication date falls back through the fields that carry it", () => {
  assert.equal(conclusionPublished(normalizeMonitoring(withViolation)), "2026-08-20T09:00:00+03:00");
  assert.equal(conclusionPublished(normalizeMonitoring(stillOpen)), "2026-08-21T00:00:00+03:00");
});

test("only an established violation becomes a finding", () => {
  assert.equal(findingFromMonitoring(normalizeMonitoring(cleared)), null);
  assert.equal(findingFromMonitoring(normalizeMonitoring(stillOpen)), null);

  const finding = findingFromMonitoring(normalizeMonitoring(withViolation));
  assert.ok(finding);
  assert.equal(finding.tier, "confirmed");
  assert.equal(finding.severity, "high");
  assert.equal(finding.tender_id, "f97b452aedea426db483861256dd0f19");
  assert.ok(finding.detector_key.includes(withViolation.id), "keyed by the monitoring, so two do not collide");
  assert.ok(finding.explanation.includes("статті 26"));
});

test("a violation with no published text still says what happened", () => {
  const silent = { ...withViolation, conclusion: { violationOccurred: true } };
  const finding = findingFromMonitoring(normalizeMonitoring(silent));
  assert.ok(finding);
  assert.ok(finding.explanation.length > 0);
});

test("in-progress statuses are not worth a second request", () => {
  assert.ok(!CONCLUDED_STATUSES.has("active"));
  assert.ok(!CONCLUDED_STATUSES.has("draft"));
  assert.ok(CONCLUDED_STATUSES.has("addressed"));
  assert.ok(CONCLUDED_STATUSES.has("completed"));
});
