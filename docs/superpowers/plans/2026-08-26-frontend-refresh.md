# Frontend Split and Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the 1848-line `server/app.ts` into focused page and component modules, then refresh the visual system — one spacing scale, a warm neutral palette, and a mobile-first filter panel — without changing the site's editorial character.

**Architecture:** A render smoke test goes in first, so the move has a safety net. The two module-level bindings (`db`, `starred`) move to `server/context.ts`. Pages and components then move by cut-and-paste, with `app.ts` left holding only routing. Only after the structure settles do the design tokens change, and they live entirely in `html.ts`, so one edit reaches all thirteen pages.

**Tech Stack:** TypeScript on Node 22 (native type stripping, no build step), `node --test`, server-rendered HTML with hand-written CSS. No framework, no dependencies.

## Global Constraints

- **ZERO runtime dependencies.** `package.json` has only `devDependencies`. Do not add any npm package — no CSS framework, no template engine, no test library.
- **The move is mechanical.** Tasks 3 and 4 cut and paste code. Do NOT rename, reformat, "improve", or fix anything while moving. Behaviour changes land in later tasks where they are visible in a small diff.
- **The 223 existing tests stay green with no edits to the tests themselves.** If a test needs changing to pass, the move was not mechanical — revert and redo it.
- **Comments explain WHY, not what.** Match the prose style already in `server/html.ts` and `server/app.ts`.
- **Editorial character stays.** Literata remains the heading face, IBM Plex Sans the body. Do not swap fonts, and do not turn the list into a data table.
- **No dark theme.** Not requested; do not add one.
- **Test command:** `npm test`. Single file: `node --test tests/<name>.test.ts`. Typecheck: `npm run typecheck`.
- **Branch:** `feat/frontend-refresh`.

---

## File Structure

```
server/
  app.ts             — routing only, ~120 lines
  context.ts         — the dataset and the per-request starred list
  pages/
    feed.ts  tender.ts  entity.ts  officer.ts  supplier.ts
    entities.ts  officers.ts  suppliers.ts
    railway.ts  article.ts  updates.ts  prices.ts  lookup.ts  static.ts
  components/
    case-row.ts   — one result row, its alarms, the star control
    filters.ts    — presets, sort bar, grouping, the filter panel
    risk.ts       — risk chips and grouped risk cards
    verdict.ts    — the qualification and conclusion blocks
    directory.ts  — the machinery the three directory pages share
  html.ts          — layout, formatting helpers, and ALL styles
tests/
  render.test.ts   — every route renders
```

`directory.ts` and `filters.ts` are not inventions: `directoryPage`/`readDirControls`/`applyDirControls`/`dirBar` are already shared by three pages, and `presetsFor`/`presetBar`/`sortBar`/`filterPanel`/`groupBlock` already change together.

---

### Task 1: A safety net before anything moves

**Files:**
- Create: `tests/render.test.ts`

**Interfaces:**
- Consumes: `render(url: URL, saved?: Favourite[]): Rendered` and `type Rendered = { status: number; body: string; contentType?: string; filename?: string }` from `server/app.ts`; `loadDataset()` from `server/data.ts`.
- Produces: nothing. This test is the net every later task swings over.

- [ ] **Step 1: Write the test**

Create `tests/render.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../server/app.ts";
import { loadDataset } from "../server/data.ts";

// Real ids from the store, so the dossier routes are exercised rather than
// 404ing past the code they are meant to cover.
const db = await loadDataset();
const withEntity = db.cases.find((c) => c.entity_edrpou);
const withOfficer = db.cases.find((c) => c.officer_key);
const withWinner = db.cases.find((c) => c.winner_edrpou);
const anyCase = db.cases[0];

function page(path: string) {
  return render(new URL(`https://x.test${path}`));
}

const STATIC_ROUTES = [
  "/", "/entities", "/officers", "/suppliers", "/railway",
  "/updates", "/prices", "/indicators", "/about", "/starred",
  "/lookup",
];

for (const path of STATIC_ROUTES) {
  test(`${path} renders a page`, () => {
    const res = page(path);
    assert.equal(res.status, 200, `${path} did not answer 200`);
    assert.ok(res.body.includes("<!doctype html>") || res.body.includes("<!DOCTYPE html>"),
      `${path} did not return a document`);
    assert.ok(res.body.length > 500, `${path} returned a suspiciously short body`);
    assert.ok(!res.body.includes("undefined</"), `${path} rendered a literal undefined`);
  });
}

test("a tender dossier renders", () => {
  const res = page(`/tender/${encodeURIComponent(anyCase.tender_id)}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes(anyCase.tender_ref));
});

test("an entity dossier renders", () => {
  assert.equal(page(`/entity/${withEntity!.entity_edrpou}`).status, 200);
});

test("an officer dossier renders", () => {
  assert.equal(page(`/officer/${encodeURIComponent(withOfficer!.officer_key!)}`).status, 200);
});

test("a supplier dossier renders", () => {
  assert.equal(page(`/supplier/${withWinner!.winner_edrpou}`).status, 200);
});

test("an unknown path is a 404, not a crash", () => {
  assert.equal(page("/no-such-page").status, 404);
});

test("an unknown tender id is a 404", () => {
  assert.equal(page("/tender/UA-0000-00-00-000000-x/report").status, 404);
});

test("the text report downloads as a file", () => {
  const res = page(`/tender/${encodeURIComponent(anyCase.tender_id)}/report.txt`);
  assert.equal(res.status, 200);
  assert.match(res.contentType ?? "", /text\/plain/);
  assert.ok(res.filename?.endsWith(".txt"));
});

test("filters and grouping survive a round trip through the feed", () => {
  const res = page("/?sort=value_desc&group=entity&preset=proven");
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 500);
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/render.test.ts`
Expected: PASS. This test pins CURRENT behaviour — it is a net, not a red-green cycle. If any case fails now, stop and report: that is a live bug, not something to code around.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS, 223 existing plus the new ones.

- [ ] **Step 4: Commit**

```bash
git add tests/render.test.ts
git commit -m "test(server): cover every route before the split"
```

---

### Task 2: Move the shared state into server/context.ts

**Files:**
- Create: `server/context.ts`
- Modify: `server/app.ts` (remove the two module-level bindings, import them instead)

**Interfaces:**
- Consumes: `loadDataset()`, `type Dataset` from `server/data.ts`; `type Favourite` from `server/favourites.ts`.
- Produces:
  - `dataset(): Dataset`
  - `reloadDataset(): Promise<number>`
  - `setStarred(list: Favourite[]): void`
  - `starredList(): Favourite[]`

- [ ] **Step 1: Write server/context.ts**

```ts
// The two pieces of state the pages share.
//
// The dataset is loaded once per process and swapped by the dev server when
// the daily job rewrites the files. The starred list is per request: caseRow
// is called from a dozen places, and threading the list through every one of
// them would add a parameter to each.
import { loadDataset, type Dataset } from "./data.ts";
import type { Favourite } from "./favourites.ts";

let db: Dataset = await loadDataset();
let starred: Favourite[] = [];

export function dataset(): Dataset {
  return db;
}

/** Re-reads the store. The local server calls this when the data files change. */
export async function reloadDataset(): Promise<number> {
  db = await loadDataset();
  return db.cases.length;
}

export function setStarred(list: Favourite[]): void {
  starred = list;
}

export function starredList(): Favourite[] {
  return starred;
}
```

- [ ] **Step 2: Rewire app.ts**

Delete from `server/app.ts`: the `let db: Dataset = await loadDataset();` binding, the `console.log` that follows it, and the `let starred` binding. Add to its imports:

```ts
import { dataset, reloadDataset, setStarred, starredList } from "./context.ts";
```

Then substitute throughout the file, textually:
- every `db.` becomes `dataset().` (43 occurrences)
- the read of `starred` inside `star()`/`caseRow` becomes `starredList()`
- `starred = saved;` in `render()` becomes `setStarred(saved);`

Replace the body of the exported `reload` so the dev server keeps its entry point:

```ts
export async function reload(): Promise<number> {
  return reloadDataset();
}
```

Move the startup `console.log` into `context.ts` right after the initial load, unchanged, so the local server still prints what it loaded.

- [ ] **Step 3: Verify nothing changed**

Run: `npm test && npm run typecheck`
Expected: PASS, all tests including `tests/render.test.ts`, typecheck clean. No test file may be edited.

- [ ] **Step 4: Commit**

```bash
git add server/context.ts server/app.ts
git commit -m "refactor(server): give the dataset and starred list their own module"
```

---

### Task 3: Move the components out

**Files:**
- Create: `server/components/case-row.ts`, `server/components/risk.ts`, `server/components/filters.ts`, `server/components/verdict.ts`, `server/components/directory.ts`
- Modify: `server/app.ts` (remove the moved functions, import them)

**Interfaces:**
- Consumes: `dataset()`, `starredList()` from `server/context.ts` (Task 2).
- Produces, exported from the files named:
  - `case-row.ts`: `caseRow(entry: Case, opts?: { showOfficer?: boolean; showEntity?: boolean }): string`, `star(kind: FavKind, id: string, back: string, opts?: { label?: boolean }): string`, `alarms(entry: Case): string[]`, `rowSeverity(entry: Case): "proven" | "high" | "medium" | "clear" | "low"`, `auditSection(entry: Case): string`, `auditFlag(entry: Case): string`
  - `risk.ts`: `shortRisk(riskId: string): string`, `riskFlag(riskId: string): string`, `riskCard(riskId: string, count?: number): string`, `rankRisks(list: Case[]): [string, number][]`, `groupedRiskCards(ranked: [string, number][]): string`
  - `filters.ts`: `presetsFor(action: string): Preset[]`, `presetBar(action: string, url: URL, c: Controls): string`, `sortBar(action: string, c: Controls, extra?: string): string`, `filterPanel(action: string, c: Controls, opts?: ControlOptions, extra?: string): string`, `groupBlock(group: Group, depth: number): string`, `resultLine(list: Case[], c: Controls, groupCount: number): string`, `listBody(list: Case[], c: Controls, action: string, rowOpts?: { showOfficer?: boolean; showEntity?: boolean }): string`
  - `verdict.ts`: `qualificationBlock(entry: Case): string`, `conclusionBlock(entry: Case, sameEntity: Case[], sameOfficer: Case[], sameWinner: Case[]): string`
  - `directory.ts`: `readDirControls(url: URL): DirControls`, `applyDirControls(rows: DirRow[], c: DirControls): DirRow[]`, `dirBar(action: string, c: DirControls): string`, `directoryPage(opts: { title: string; nav: string; heading: string; intro: string; action: string; url: URL; rows: DirRow[] }): string`, plus the `DirControls` and `DirRow` types

- [ ] **Step 1: Move, without changing a character of logic**

For each file above, cut the named functions out of `server/app.ts` and paste them into the new module. Add the imports each module needs — read the import block at the top of `app.ts` and take only what that module actually uses. Export exactly the names listed. Move each function's existing comments with it.

Constants move with their only user: `MAX_ROW_FLAGS` goes to `case-row.ts`, `MAX_GROUPS` and `PAGE_SIZE` to `filters.ts`. If a moved constant turns out to be used by a page too, export it rather than duplicating it.

Do NOT rename anything. Do NOT reformat. Do NOT fix anything you notice — note it in your report instead.

- [ ] **Step 2: Import them back into app.ts**

Add the five import statements to `server/app.ts`. The remaining page functions call the components exactly as before.

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck`
Expected: PASS, no test edited.

- [ ] **Step 4: Commit**

```bash
git add server/components server/app.ts
git commit -m "refactor(server): move the shared render components into their own files"
```

---

### Task 4: Move the pages out

**Files:**
- Create: `server/pages/feed.ts`, `tender.ts`, `entity.ts`, `officer.ts`, `supplier.ts`, `entities.ts`, `officers.ts`, `suppliers.ts`, `railway.ts`, `article.ts`, `updates.ts`, `prices.ts`, `lookup.ts`, `static.ts`
- Modify: `server/app.ts` — after this task it holds only imports, `reload`, `Rendered`, and `render`

**Interfaces:**
- Consumes: everything Task 3 exported, plus `dataset()`/`setStarred()` from `server/context.ts`.
- Produces: one exported page function per file, keeping its current name and signature exactly — `feedPage(url: URL): string`, `tenderPage(tenderId: string): string`, `entityPage(edrpou: string, url: URL): string`, `officerPage(key: string, url: URL): string`, `supplierPage(edrpou: string, url: URL): string`, `entitiesPage(url: URL): string`, `officersPage(url: URL): string`, `suppliersPage(url: URL): string`, `railwayPage(url: URL): string`, `articlePage(code: string, url: URL): string`, `updatesPage(url: URL): string`, `pricesPage(url: URL): string`, `lookupPage(code: string | null, typed: string): string`. `static.ts` exports `indicatorsPage(): string`, `aboutPage(): string`, `notFound(): string`, `starredPage(saved: Favourite[], url: URL): string`.

- [ ] **Step 1: Move each page**

Cut each page function from `app.ts` into its file, with its helpers that nothing else uses — `railwayBlocks()` goes with `railway.ts`, `profileOf()` and `saveControl()` with the page that calls them, `feedPage`'s local helpers with `feed.ts`. Again: cut and paste only.

- [ ] **Step 2: Reduce app.ts to routing**

What remains in `server/app.ts` is the import block, `reload()`, `type Rendered`, and `render()`. The body of `render()` does not change — it now calls imported functions instead of local ones.

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck`
Expected: PASS, no test edited.

Then confirm the goal was actually met:

```bash
wc -l server/app.ts
```

Expected: under 200 lines. If it is much larger, something that belongs in a page is still sitting in the router — move it.

- [ ] **Step 4: Commit**

```bash
git add server/pages server/app.ts
git commit -m "refactor(server): give every page its own file, leaving app.ts to route"
```

---

### Task 5: The design tokens

**Files:**
- Modify: `server/html.ts` — the `:root` block and every rule that uses an off-scale value

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. The tokens are CSS custom properties consumed by the stylesheet in the same file.

- [ ] **Step 1: Replace the token block**

In `server/html.ts`, replace the current `:root` declarations with:

```css
:root{
  /* Rhythm. Every spacing value in this file comes from here — the old file
     had twenty ad-hoc values, and that irregularity is what read as clutter. */
  --s1:.25rem; --s2:.5rem;  --s3:.75rem; --s4:1rem;
  --s5:1.5rem; --s6:2rem;   --s7:3rem;   --s8:4rem;

  /* Paper, not screen: the old palette had a cold blue cast that dated it. */
  --paper:#FCFCFA; --surface:#FFFFFF; --surface-2:#F3F3EF;
  --ink:#14181A; --ink-soft:#565B60; --ink-faint:#8B9096;
  --line:#E4E3DD; --line-soft:#EFEEE9;

  --accent:#0F5C8C; --accent-bg:#E8F0F7;
  --alarm:#B02418; --alarm-bg:#FBEAE7;
  --warn:#8A6100;  --warn-bg:#FAF2DE;
  --calm:#1E6B43;  --calm-bg:#E6F1EA;

  /* One shadow, for the drawer that genuinely floats. Cards use their border. */
  --shadow:0 12px 32px -20px rgba(20,24,26,.45);
  --radius:8px; --radius-sm:4px;

  --f-display:"Literata",Georgia,serif;
  --f-body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;
  --f-mono:"IBM Plex Mono",Consolas,monospace;
}
```

`--surface-3` is gone: it was within two points of `--surface`, invisible in use. Replace its every occurrence with `var(--surface)`.

- [ ] **Step 2: Put every spacing value on the scale**

Walk the whole stylesheet and replace each hard-coded `rem` spacing in `margin`, `padding` and `gap` with the nearest scale token. The mapping to apply:

| was | becomes |
|---|---|
| `.2rem`, `.25rem`, `.3rem` | `var(--s1)` |
| `.35rem`, `.45rem`, `.5rem`, `.55rem` | `var(--s2)` |
| `.6rem`, `.65rem`, `.7rem`, `.75rem`, `.8rem` | `var(--s3)` |
| `.9rem`, `1rem`, `1.15rem`, `1.25rem` | `var(--s4)` |
| `1.5rem`, `1.75rem` | `var(--s5)` |
| `2rem`, `2.25rem` | `var(--s6)` |
| `2.75rem`, `3rem` | `var(--s7)` |
| `4rem` and above | `var(--s8)` |

Leave `font-size`, `line-height`, `width`, `max-width`, `border-radius` and `top`/`left`-style offsets alone — this table is for spacing only.

Two rhythm rules to apply while you are in there, because they are what actually creates the air: a heading sits `var(--s2)` above its text, and a section sits `var(--s7)` below the block before it. Adjust `h1`, `h2` and `.sub` margins to match.

- [ ] **Step 3: Take Literata off the numbers**

`.statline b` currently uses `var(--f-display)`. A display serif is not built for dense figures and it makes the stat line ripple. Change it to `var(--f-body)` with `font-weight:600` and keep `font-variant-numeric:tabular-nums`. Headings keep the serif.

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck`
Expected: PASS. The render test proves every page still produces a document.

Then prove the scale is actually honoured:

```bash
grep -nE '(margin|padding|gap):[^;}]*[0-9]\.?[0-9]*rem' server/html.ts
```

Expected: no output. Any hit is a spacing value that escaped the scale — convert it.

- [ ] **Step 5: Commit**

```bash
git add server/html.ts
git commit -m "style(web): one spacing scale and a warmer paper palette"
```

---

### Task 6: The phone

**Files:**
- Modify: `server/html.ts` — the media-query blocks and the filter/row rules

**Interfaces:**
- Consumes: the tokens from Task 5.
- Produces: nothing importable.

- [ ] **Step 1: Collapse the filter bar into a sheet**

On a narrow screen the presets, sort bar, grouping bar and "Більше фільтрів" stack into four rows of controls above the list, so the reader never reaches the data. Inside `@media (max-width:44rem)`, hide those bars and show a single full-width `<summary>`-style trigger labelled `Фільтри`; the panel itself reuses the `.drawer` pattern already in the file for navigation, so no new interaction model is introduced.

The trigger must carry the active-filter count — `activeCount()` already computes it and `filterPanel` already receives it. State that hides itself is worse than state that crowds.

- [ ] **Step 2: Re-stack the result row**

Inside the same media query, make `.row` a column with the amount first, the buyer second and the flags last. Today the amount comes last and is the first thing a reader looks for. Give the amount `font-size:1.05rem` and `font-variant-numeric:tabular-nums` so a column of them lines up.

- [ ] **Step 3: Tap targets**

Every interactive element gets at least 44px on its smaller side inside `@media (max-width:44rem)`: the star control, the nav links in the drawer, the preset chips and the sort controls. The star is presently the worst offender.

- [ ] **Step 4: Stop the page from sliding sideways**

Wide tables on the prices and article pages get their own scroll container rather than pushing the document:

```css
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
```

Apply it to the table wrappers on those two pages. Add `body{overflow-x:hidden}` only if a table still escapes — prefer fixing the container.

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/html.ts
git commit -m "style(web): make the phone layout the base, not an afterthought"
```

---

### Task 7: See it before calling it done

**Files:**
- None. This task changes nothing; it verifies.

**Interfaces:**
- Consumes: everything.
- Produces: a report.

- [ ] **Step 1: Start the dev server**

Use the preview tooling with the launch configuration named `tender-radar` (`.claude/launch.json`, port 3120). Do not start it with a raw shell command.

- [ ] **Step 2: Walk every page at two widths**

At 1440px and at 375px, load each of: `/`, `/entities`, `/officers`, `/suppliers`, `/railway`, `/updates`, `/prices`, `/indicators`, `/about`, `/starred`, plus one tender dossier, one entity, one officer and one supplier.

For each, confirm through the page's accessibility tree or its text that the heading, the controls and the first rows are present, and check the console for errors.

- [ ] **Step 3: Check the horizontal overflow specifically**

At 375px, on each page, evaluate:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Expected: `true` everywhere. A `false` means something is pushing the page sideways — find it and fix it in `html.ts`.

- [ ] **Step 4: Report**

Write down, per page, what you saw at each width and anything that looked wrong. Do not commit anything unless a fix was needed; if one was, commit it with a message naming the page and the problem.
