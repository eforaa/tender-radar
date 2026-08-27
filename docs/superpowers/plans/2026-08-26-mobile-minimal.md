# Mobile Minimal Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a phone, the feed opens straight to tenders — the chrome above it stripped, each row collapsed to amount-first with one short signal line — while desktop is untouched.

**Architecture:** Everything happens inside `@media (max-width:44rem)` plus one new server-rendered element. The row markup is shared between phone and desktop, so the compact one-line signal is emitted always and toggled against the full chip list by CSS — no viewport detection on the server. No JavaScript.

**Tech Stack:** TypeScript on Node 22 (native type stripping, no build step), `node --test`, server-rendered HTML with hand-written CSS. Zero dependencies.

## Global Constraints

- **ZERO runtime dependencies.** Do not add any npm package.
- **NO JAVASCRIPT.** The site is server-rendered; keep it so.
- **Desktop is untouched.** Every visual change lives in `@media (max-width:44rem)`. The one markup addition (the signal line) is `display:none` on desktop.
- **The 244 existing tests pass.** A test may change only if it asserts something about the row that this plan deliberately changes (the row still shows the amount and still links to the tender).
- **Comments explain WHY, not what.** Match the prose style in `server/html.ts` and `server/components/case-row.ts`.
- **Verification is by rendered output and a real browser at 375px**, plus `npm run typecheck` whose raw output the controller checks itself.
- **Test command:** `npm test`. Single file: `node --test tests/<name>.test.ts`. Typecheck: `npm run typecheck`.
- **Branch:** `feat/frontend-refresh` (already checked out).

---

## File Structure

- `server/components/case-row.ts` — **modify.** Add `signalLine(entry)` and emit one `.signal` element in the row.
- `server/html.ts` — **modify.** In the `@media (max-width:44rem)` block: hide the pre-feed chrome, hide the full `.flags` and the `.exact` ref, show `.signal`, colour the severity dot.
- `tests/signal-line.test.ts` — **create.** Unit-cover `signalLine`.

`feed.ts` needs no change: the chrome it renders (`.sub`, `.primer`, `details.help`, `.statline`) is hidden by CSS selectors that already exist on those elements.

---

### Task 1: The compact signal line

**Files:**
- Modify: `server/components/case-row.ts`
- Test: `tests/signal-line.test.ts`

**Interfaces:**
- Consumes: `shortRisk(riskId: string): string` and `rankRisks(list: Case[]): [string, number][]` from `server/components/risk.ts`; `plural(n, one, few, many): string` from `server/html.ts`; `type Case` from `server/data.ts`; `rowSeverity(entry): "proven"|"high"|"medium"|"clear"|"low"` already in this file.
- Produces: `signalLine(entry: Case): string` — the inner text of the one-line signal, HTML-escaped where needed. Also a new `.signal` element inside the row markup.

- [ ] **Step 1: Write the failing test**

Create `tests/signal-line.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/signal-line.test.ts`
Expected: FAIL — `signalLine` is not exported.

- [ ] **Step 3: Implement `signalLine` and emit the element**

In `server/components/case-row.ts`, add the function (place it near `rowSeverity`, and import `rankRisks` alongside the existing `shortRisk`/`riskFlag` import, and `plural` from `html.ts`):

```ts
/**
 * The one-line signal the phone shows in place of the full chip list. A proven
 * violation is the whole story; otherwise it is a count and the single most
 * common risk, short — the detail lives on the tender page behind a tap.
 */
export function signalLine(entry: Case): string {
  if (entry.audit?.violation) return "Порушення доведено";
  const n = entry.risks.length;
  if (n === 0) return "";
  const [topRisk] = rankRisks([entry])[0] ?? [entry.risks[0]];
  const count = `${n} ${plural(n, "ознака", "ознаки", "ознак")}`;
  return `${count} · ${esc(shortRisk(topRisk))}`;
}
```

Then, inside the `return` markup of `caseRow`, add the signal element right after the closing `</div>` of `.flags`:

```ts
  <div class="signal">${signalLine(entry)}</div>
```

Leave `.flags` exactly as it is — desktop still renders the full chips; the CSS in Task 2 hides one or the other by viewport.

- [ ] **Step 4: Run the test to see it pass**

Run: `node --test tests/signal-line.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm the full suite and the types**

Run: `npm test && npm run typecheck`
Expected: 245 pass (244 + the new file's cases), typecheck clean. Paste both raw outputs into the report.

- [ ] **Step 6: Commit**

```bash
git add server/components/case-row.ts tests/signal-line.test.ts
git commit -m "feat(feed): a one-line signal for each row, for the phone"
```

---

### Task 2: The mobile stylesheet

**Files:**
- Modify: `server/html.ts` — the base `.signal` rule and the `@media (max-width:44rem)` block

**Interfaces:**
- Consumes: the `.signal` element from Task 1; the severity classes `sev-proven|sev-high|sev-medium|sev-clear|sev-low` already on `.row`; the tokens in `:root`.
- Produces: nothing importable.

- [ ] **Step 1: Hide the signal on desktop by default**

In `server/html.ts`, near the other `.row` rules (outside any media query), add:

```css
.signal{display:none}
```

Desktop never shows it; the full `.flags` chips stay.

- [ ] **Step 2: Strip the pre-feed chrome on the phone**

Inside `@media (max-width:44rem)`, add:

```css
  /* The phone job is scanning the feed; the explainer and the stat block are
     onboarding a returning reader has already seen. The link to /about keeps
     them one tap away. */
  .sub,.primer,details.help{display:none}
  h1{font-size:1.3rem}
  .statline{font-size:.8rem;color:var(--ink-faint)}
```

- [ ] **Step 3: Swap the chip list for the signal line, and drop the ref**

Still inside `@media (max-width:44rem)`:

```css
  .row .flags{display:none}
  .row .amount .exact{display:none}
  .row .signal{display:block;order:0;margin-top:var(--s1);font-size:.85rem;color:var(--ink-soft)}
```

- [ ] **Step 4: Colour the severity dot**

The dot is already positioned on mobile (`.row .dot{position:absolute…}`). Give it its colour from the row's severity class. Add, inside the media query:

```css
  .row .dot{width:.5rem;height:.5rem;border-radius:50%;background:var(--ink-faint)}
  .row.sev-proven .dot,.row.sev-high .dot{background:var(--alarm)}
  .row.sev-medium .dot{background:var(--warn)}
  .row.sev-clear .dot,.row.sev-low .dot{background:var(--ink-faint)}
```

If a `.row .dot` sizing rule already exists in the media query, merge these declarations into it rather than duplicating the selector.

- [ ] **Step 5: Verify in a real browser at 375px**

Run `npm test && npm run typecheck` first; paste both raw outputs.

Then start the dev server through the preview tooling with the `tender-radar` launch configuration (not a raw shell command), emulate a 375px viewport, load `/`, and confirm through the page's accessibility tree or text and a screenshot:
- the first tender row is visible without scrolling past the explainer strip;
- the row shows the amount, the buyer, and one short signal line — not a stack of sentence chips;
- the `UA-...` ref is not visible in the row;
- the severity dot carries a colour.

Then evaluate `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and confirm it is `true`.

Reset the viewport to desktop and confirm the explainer strip, the stat line, the full chips and the `UA-...` ref are all back.

- [ ] **Step 6: Commit**

```bash
git add server/html.ts
git commit -m "style(feed): strip the phone feed to the row, chrome behind a tap"
```

---

### Task 3: Rebuild the deployable bundle

**Files:**
- Modify: `api/index.js` (generated)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

`vercel.json` rewrites every route to `api/index.js`; it must be rebuilt or the change never ships.

- [ ] **Step 1: Rebuild**

Run: `npm run bundle`

- [ ] **Step 2: Confirm the new markup is in the bundle**

Run: `grep -c 'signal' api/index.js`
Expected: non-zero. Put the number in the report.

- [ ] **Step 3: Commit**

```bash
git add api/index.js
git commit -m "chore(web): rebuild the bundle with the minimal phone feed"
```
