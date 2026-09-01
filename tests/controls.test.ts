import test from "node:test";
import assert from "node:assert/strict";
import { readControls, applyControls, activeCount, isFiltered, keepControls } from "../server/controls.ts";
import type { Case } from "../server/data.ts";

const RAIL = new Set(["40081216"]);

function tenderCase(over: Partial<Case> = {}): Case {
  return {
    tender_id: "t1", tender_ref: "UA-2026-01-01-000001-a", tender_date: "2026-01-01", title: "Електрична енергія", status: "active",
    method: "aboveThreshold", entity_edrpou: "111", entity_name: "КП Тест", region: "Харківська область",
    value_amount: 1_000_000, date_assessed: "2026-05-01T00:00:00+03:00", risks: ["ari-1-1"],
    officer_name: "Іваненко І.", officer_email: "i@x.ua", officer_phone: null, officer_key: "i@x.ua",
    winner_name: "ТОВ Переможець", winner_edrpou: "222", winner_amount: 900_000,
    bidders: 2, detailed: true, findings: [], audit: null,
    ...over,
  };
}

function controlsFrom(query: string) {
  return readControls(new URL(`https://x.example/${query}`));
}

test("defaults are empty and sort by value", () => {
  const c = controlsFrom("");
  assert.equal(c.sort, "value");
  assert.equal(c.group, "");
  assert.equal(c.page, 1);
  assert.equal(isFiltered(c), false);
  assert.equal(activeCount(c), 0);
});

test("an unknown grouping value is discarded rather than trusted", () => {
  assert.equal(controlsFrom("?group=nonsense").group, "");
  assert.equal(controlsFrom("?group=entity").group, "entity");
});

test("the active count reflects what is applied", () => {
  const c = controlsFrom("?rail=1&min=1000000&group=entity&sort=date");
  assert.equal(activeCount(c), 4);
});

test("search matches the buyer, the winner, the official and the reference", () => {
  const list = [tenderCase()];
  for (const q of ["кп тест", "переможець", "іваненко", "ua-2026-01-01"]) {
    assert.equal(applyControls(list, controlsFrom(`?q=${encodeURIComponent(q)}`), RAIL).length, 1, q);
  }
  assert.equal(applyControls(list, controlsFrom("?q=нічого"), RAIL).length, 0);
});

test("the amount range includes its own bounds", () => {
  const list = [tenderCase({ value_amount: 500 }), tenderCase({ value_amount: 1000 }), tenderCase({ value_amount: 1500 })];
  assert.equal(applyControls(list, controlsFrom("?min=1000&max=1000"), RAIL).length, 1);
  assert.equal(applyControls(list, controlsFrom("?min=1000"), RAIL).length, 2);
  assert.equal(applyControls(list, controlsFrom("?max=1000"), RAIL).length, 2);
});

test("the date range filters on the tender's own date, not the assessment", () => {
  // A 2024 tender assessed in 2026 must still be found by a 2024 date range.
  const old = tenderCase({ tender_date: "2024-07-11", date_assessed: "2026-04-14T00:00:00+03:00" });
  assert.equal(applyControls([old], controlsFrom("?from=2024-01-01&to=2024-12-31"), RAIL).length, 1);
  assert.equal(applyControls([old], controlsFrom("?from=2026-01-01"), RAIL).length, 0);
  assert.equal(applyControls([old], controlsFrom("?to=2024-07-11"), RAIL).length, 1);
});

test("sorting by date uses the tender date, and assessed order is separate", () => {
  const older = tenderCase({ tender_id: "old", tender_date: "2024-01-01", date_assessed: "2026-08-01" });
  const newer = tenderCase({ tender_id: "new", tender_date: "2026-01-01", date_assessed: "2026-01-01" });
  const order = (q: string) => applyControls([older, newer], controlsFrom(q), RAIL).map((x) => x.tender_id);
  assert.deepEqual(order("?sort=date"), ["new", "old"]);
  assert.deepEqual(order("?sort=date-asc"), ["old", "new"]);
  assert.deepEqual(order("?sort=assessed"), ["old", "new"]);
});

test("the region filter narrows to one oblast", () => {
  const list = [
    tenderCase({ tender_id: "kh", region: "Харківська область" }),
    tenderCase({ tender_id: "kyiv", region: "Київська область" }),
  ];
  const out = applyControls(list, controlsFrom("?region=" + encodeURIComponent("Київська область")), RAIL);
  assert.deepEqual(out.map((x) => x.tender_id), ["kyiv"]);
  assert.equal(applyControls(list, controlsFrom(""), RAIL).length, 2);
});

test("the region survives paging links", () => {
  const c = controlsFrom("?region=" + encodeURIComponent("Львівська область"));
  const url = new URL("https://x.example" + keepControls("/", c, { page: "2" }));
  assert.equal(url.searchParams.get("region"), "Львівська область");
});

test("the railway filter can be switched off where the page is already railway", () => {
  const list = [tenderCase({ entity_edrpou: "999" })];
  assert.equal(applyControls(list, controlsFrom("?rail=1"), RAIL).length, 0);
  assert.equal(applyControls(list, controlsFrom("?rail=1"), RAIL, { hideRail: true }).length, 1);
});

test("the price filter can be switched off where the page is already price findings", () => {
  const list = [tenderCase({ findings: [] })];
  assert.equal(applyControls(list, controlsFrom("?price=1"), RAIL).length, 0);
  assert.equal(applyControls(list, controlsFrom("?price=1"), RAIL, { hidePrice: true }).length, 1);
});

test("every sort order is honoured", () => {
  const list = [
    tenderCase({ tender_id: "a", value_amount: 10, tender_date: "2026-01-01", risks: ["x"] }),
    tenderCase({ tender_id: "b", value_amount: 100, tender_date: "2025-01-01", risks: ["x", "y", "z"] }),
  ];
  const order = (query: string) => applyControls(list, controlsFrom(query), RAIL).map((x) => x.tender_id);
  assert.deepEqual(order(""), ["b", "a"]);
  assert.deepEqual(order("?sort=value-asc"), ["a", "b"]);
  assert.deepEqual(order("?sort=date"), ["a", "b"]);
  assert.deepEqual(order("?sort=date-asc"), ["b", "a"]);
  assert.deepEqual(order("?sort=risks"), ["b", "a"]);
});

test("paging links carry every control forward", () => {
  const c = controlsFrom("?q=щебінь&risk=ari-1-1&min=5000&group=entity&sort=date&rail=1");
  const link = keepControls("/railway", c, { page: "3" });
  const url = new URL(`https://x.example${link}`);
  assert.equal(url.pathname, "/railway");
  assert.equal(url.searchParams.get("q"), "щебінь");
  assert.equal(url.searchParams.get("risk"), "ari-1-1");
  assert.equal(url.searchParams.get("min"), "5000");
  assert.equal(url.searchParams.get("group"), "entity");
  assert.equal(url.searchParams.get("sort"), "date");
  assert.equal(url.searchParams.get("rail"), "1");
  assert.equal(url.searchParams.get("page"), "3");
});

test("a link with nothing applied stays clean", () => {
  assert.equal(keepControls("/prices", controlsFrom("")), "/prices");
});

test("grouping the whole country does not render a page per buyer", async () => {
  // Grouping 36000 tenders by buyer produced 10608 blocks and a 51 MB page.
  const app = await import("../server/app.ts");
  const r = await app.render(new URL("http://x/?group=entity&then=supplier"));
  const blocks = (r.body.match(/class="group-block depth-0"/g) ?? []).length;
  assert.ok(blocks <= 40, `expected at most 40 top-level groups, got ${blocks}`);
  assert.ok(r.body.length < 3_000_000, `page is ${Math.round(r.body.length / 1024)} KB`);
  assert.match(r.body, /Звузьте вибірку фільтрами/);
});
