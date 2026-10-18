import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../src/store/json-store.ts";
import { ingestTenders, scopeReasons, INGEST_KEY } from "../src/ingest/tenders.ts";
import { FEED_START, type RawTender } from "../src/sources/openprocurement.ts";

const raw = (id: string): RawTender => ({ id, tenderID: `UA-2026-10-18-${id}`, title: "Test",
  procuringEntity: { name: "Лікарня", identifier: { id: "12345678" }, address: { region: "Харківська область" } },
  items: [{ id: "old", quantity: 3 }], bids: [{ id: "old-bid" }], awards: [] });
test("scope includes railway root, named branches and delivery, excludes unrelated rail suppliers", () => {
  assert.deepEqual(scopeReasons({ procuringEntity: { identifier: { id: "40075815" } } }), ["railway"]);
  assert.deepEqual(scopeReasons({ procuringEntity: { name: 'Філія АТ «Українська залізниця»' } }), ["railway"]);
  assert.deepEqual(scopeReasons({ procuringEntity: { name: 'ТОВ Вагон', address: { region: "Київська область" } } }), []);
  assert.deepEqual(scopeReasons({ items: [{ deliveryAddress: { region: "Харківська область" } }] }), ["kharkiv_delivery"]);
});
test("unflagged feed tender is ingested; live refresh replaces deleted children", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tendoscope-"));
  try {
    const store = new JsonStore(directory);
    let changed = false;
    const dependencies = {
      page: async (url: string | null) => url === FEED_START
        ? { data: [{ id: "a", dateModified: "2026-01-01" }], nextUri: "history", prevUri: "live" }
        : url === "live" && changed
        ? { data: [{ id: "a", dateModified: "2026-01-02" }], nextUri: "live2" }
        : { data: [], nextUri: url },
      tender: async () => changed ? { ...raw("a"), items: [], bids: [] } : raw("a"),
    };
    const first = await ingestTenders(store, { directory, dependencies, maxPages: 2 });
    assert.equal(first.state.historyComplete, true);
    assert.deepEqual(first.newIds, ["a"]);
    assert.equal((await store.allRiskFlags()).length, 0);
    changed = true;
    await ingestTenders(store, { directory, dependencies, maxPages: 2 });
    assert.equal((await store.allTenderItems()).length, 0);
    assert.equal((await store.allBids()).length, 0);
    assert.equal((await store.allTenders()).length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("a failed card never advances cursor; next run retries the page", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tendoscope-"));
  try {
    const store = new JsonStore(directory);
    let fail = true;
    const dependencies = {
      page: async (url: string | null) => url === FEED_START
        ? { data: [{ id: "a", dateModified: "x" }], nextUri: "end", prevUri: "live" }
        : { data: [], nextUri: url },
      tender: async () => { if (fail) throw new Error("503"); return raw("a"); },
    };
    await assert.rejects(ingestTenders(store, { directory, dependencies }), /not committed/);
    assert.equal(JSON.parse((await store.getCursor(INGEST_KEY))!).historyNext, FEED_START);
    fail = false;
    assert.equal((await ingestTenders(store, { directory, dependencies })).fetched, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("a busy forward feed cannot starve history and overlapping runs are rejected", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tendoscope-budget-"));
  try {
    const store = new JsonStore(directory);
    await store.setCursor(INGEST_KEY, JSON.stringify({ version: 1, historyNext: "history", historyComplete: false,
      liveNext: "live", liveCaughtUp: false, pages: 0, scanned: 0, stored: 0, startedAt: "now", updatedAt: "now", error: null }));
    const urls: (string | null)[] = [];
    const dependencies = {
      page: async (url: string | null) => { urls.push(url); return { data: [{ id: "a", dateModified: "x" }], nextUri: `${url}2` }; },
      tender: async () => raw("a"),
    };
    await ingestTenders(store, { directory, maxPages: 2, dependencies });
    assert.deepEqual(urls, ["live", "history"]);
    await assert.rejects(ingestTenders(store, { directory, maxPages: 1, dependencies }), /Invalid/);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(directory, "tender-ingest.lock"), "occupied");
    await assert.rejects(ingestTenders(store, { directory, dependencies }), /EEXIST/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
