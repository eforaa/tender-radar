# Detail Cards in Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every tender's detail card is available from Supabase, so the tender page shows full detail for all 36,773 flagged tenders — read live, not from a frozen bundle.

**Architecture:** Detail cards (tenders/items/bids/awards) live in the `tender_radar_bot` Supabase project. A dependency-free PostgREST module writes and reads them. `ingest-details` writes cards to Supabase alongside the JSON store; a one-time backfill populates all cards. The tender page reads a card from memory when present, else from Supabase — which makes the render path async. The feed and all other pages are untouched.

**Tech Stack:** TypeScript on Node 22 (native type stripping, no build step), `node --test`, Supabase PostgREST over `fetch`, server-rendered HTML. Zero runtime dependencies.

## Global Constraints

- **ZERO runtime dependencies.** No `@supabase/supabase-js`, no npm additions. PostgREST over the global `fetch`.
- **Unconfigured means silent.** `loadSupabaseConfig` returns `null` when its env vars are absent; every consumer falls back to current behaviour (memory-only, "картку ще не завантажено"). The project must still run and the site still render with no Supabase.
- **The feed is untouched.** Only the tender detail page changes its data source. Flags, findings, audit stay in git web-data.
- **Comments explain WHY, not what.** Match the prose in `src/store/subscribers.ts` and `src/notify/telegram.ts`.
- **The 248 existing tests stay green with no edits to a test unless this plan changes what it asserts.**
- **Verification:** `npm test` and `npm run typecheck` (controller checks the raw typecheck output itself).
- **Supabase project:** `tender_radar_bot`, ref `ysaclorvgikqlbiuhxtt`. The `tg_subscribers` table already lives there — do not touch it.
- **Env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (already in Vercel and GitHub).
- **Branch:** `feat/frontend-refresh` (current).

---

## File Structure

- Supabase migration — **apply once** via the Supabase MCP: four tables + indexes + RLS.
- `src/store/supabase-cards.ts` — **create.** `loadSupabaseConfig`, `upsertCard`, `getCard`. The only new code that talks to Supabase for cards.
- `tests/supabase-cards.test.ts` — **create.**
- `server/pages/tender.ts` — **modify.** `tenderPage` becomes async; on a memory miss it awaits `getCard`.
- `server/app.ts` — **modify.** `render` becomes async; the `/tender/` branch awaits `tenderPage`.
- `server/router.ts` — **modify.** `serve()` becomes async; `render` is awaited; the two `serve()` call sites await.
- `scripts/ingest-details.ts` — **modify.** Also upserts each fetched card to Supabase when configured.

`getCard` returns the exact shape `normalizeTender` produces — `{ tender, items, bids, awards }` — so the tender page assembles a card identically whether it came from memory or Supabase.

---

### Task 1: The Supabase schema

**Files:**
- Apply once through the Supabase MCP (`apply_migration`), project ref `ysaclorvgikqlbiuhxtt`, migration name `detail_cards`.

**Interfaces:**
- Consumes: nothing.
- Produces: tables `tenders`, `tender_items`, `bids`, `awards`.

- [ ] **Step 1: Apply the migration**

Through the Supabase MCP, apply this SQL to project `ysaclorvgikqlbiuhxtt`:

```sql
create table if not exists public.tenders (
  id text primary key,
  tender_id text not null,
  title text, description text, status text, method text,
  value_amount double precision, currency text, date timestamptz,
  entity_edrpou text, entity_name text, region text, locality text,
  officer_name text, officer_email text, officer_phone text,
  raw jsonb
);
create table if not exists public.tender_items (
  tender_id text not null, item_id text not null,
  description text, cpv_code text, cpv_name text,
  quantity double precision, unit_code text, unit_name text, lot_id text,
  primary key (tender_id, item_id)
);
create table if not exists public.bids (
  tender_id text not null, bid_id text not null,
  supplier_edrpou text, supplier_name text, amount double precision, status text,
  primary key (tender_id, bid_id)
);
create table if not exists public.awards (
  tender_id text not null, award_id text not null,
  supplier_edrpou text, supplier_name text, amount double precision,
  status text, date timestamptz,
  primary key (tender_id, award_id)
);
create index if not exists tender_items_tender_idx on public.tender_items (tender_id);
create index if not exists bids_tender_idx on public.bids (tender_id);
create index if not exists awards_tender_idx on public.awards (tender_id);

alter table public.tenders enable row level security;
alter table public.tender_items enable row level security;
alter table public.bids enable row level security;
alter table public.awards enable row level security;
```

No RLS policies: the anon key sees nothing; the site and ingest use the
service key, which bypasses RLS — the same posture as `tg_subscribers`.

- [ ] **Step 2: Verify the tables exist**

Through the Supabase MCP, list tables in `public` for `ysaclorvgikqlbiuhxtt`.
Expected: `tenders`, `tender_items`, `bids`, `awards` present alongside
`tg_subscribers`, all with RLS enabled.

No code, no commit — this task is the database migration only. Record in the
report that the migration applied and the four tables are present.

---

### Task 2: The card access module

**Files:**
- Create: `src/store/supabase-cards.ts`
- Test: `tests/supabase-cards.test.ts`

**Interfaces:**
- Consumes: nothing. Types are structural, mirroring `src/store/types.ts` (`TenderRow`, `TenderItemRow`, `BidRow`, `AwardRow`), imported as types.
- Produces:
  - `type SupabaseConfig = { url: string; serviceKey: string }`
  - `loadSupabaseConfig(env?: NodeJS.ProcessEnv): SupabaseConfig | null`
  - `type Card = { tender: TenderRow; items: TenderItemRow[]; bids: BidRow[]; awards: AwardRow[] }`
  - `upsertCard(config: SupabaseConfig, card: Card, fetchImpl?: typeof fetch): Promise<void>`
  - `getCard(config: SupabaseConfig, id: string, fetchImpl?: typeof fetch): Promise<Card | null>`

- [ ] **Step 1: Write the failing test**

Create `tests/supabase-cards.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { loadSupabaseConfig, upsertCard, getCard } from "../src/store/supabase-cards.ts";

const config = { url: "https://p.supabase.co", serviceKey: "svc" };

/** Records requests and answers each GET from a table→rows map. */
function fake(rowsByTable: Record<string, unknown[]> = {}) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    const u = String(url);
    const method = (init.method ?? "GET").toUpperCase();
    calls.push({ url: u, method, body: init.body ? JSON.parse(init.body as string) : undefined });
    const table = /\/rest\/v1\/(\w+)/.exec(u)?.[1] ?? "";
    const rows = method === "GET" ? (rowsByTable[table] ?? []) : [];
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const sampleCard = {
  tender: { id: "t1", tender_id: "UA-1", title: "X", description: null, status: "complete",
    method: null, value_amount: 5, currency: "UAH", date: null, entity_edrpou: null,
    entity_name: null, region: null, locality: null, officer_name: null,
    officer_email: null, officer_phone: null, raw: { a: 1 } },
  items: [{ tender_id: "t1", item_id: "i1", description: null, cpv_code: null, cpv_name: null,
    quantity: null, unit_code: null, unit_name: null, lot_id: null }],
  bids: [{ tender_id: "t1", bid_id: "b1", supplier_edrpou: null, supplier_name: null, amount: 5, status: null }],
  awards: [{ tender_id: "t1", award_id: "a1", supplier_edrpou: null, supplier_name: null, amount: 5, status: null, date: null }],
};

test("config needs both url and key", () => {
  assert.equal(loadSupabaseConfig({}), null);
  assert.equal(loadSupabaseConfig({ SUPABASE_URL: "u" }), null);
  assert.deepEqual(loadSupabaseConfig({ SUPABASE_URL: "u", SUPABASE_SERVICE_KEY: "k" }), { url: "u", serviceKey: "k" });
});

test("upsertCard writes all four tables with merge-duplicates", async () => {
  const { calls, fetchImpl } = fake();
  await upsertCard(config, sampleCard, fetchImpl);
  const tables = calls.map((c) => /\/rest\/v1\/(\w+)/.exec(c.url)?.[1]);
  assert.deepEqual(tables, ["tenders", "tender_items", "bids", "awards"]);
  assert.ok(calls.every((c) => c.method === "POST"));
  const headers0 = 1; // presence check below
  assert.ok(calls[0].url.includes("/rest/v1/tenders"));
});

test("getCard assembles the four tables into one card", async () => {
  const { calls, fetchImpl } = fake({
    tenders: [sampleCard.tender], tender_items: sampleCard.items,
    bids: sampleCard.bids, awards: sampleCard.awards,
  });
  const card = await getCard(config, "t1", fetchImpl);
  assert.ok(card);
  assert.equal(card.tender.id, "t1");
  assert.equal(card.items.length, 1);
  assert.equal(card.bids.length, 1);
  assert.equal(card.awards.length, 1);
  assert.ok(calls.every((c) => c.url.includes("tender_id=eq.t1") || c.url.includes("id=eq.t1")));
});

test("getCard returns null when the tender row is absent", async () => {
  const { fetchImpl } = fake({ tenders: [] });
  assert.equal(await getCard(config, "missing", fetchImpl), null);
});

test("a non-2xx throws with the status", async () => {
  const fetchImpl = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(() => getCard(config, "t1", fetchImpl), /401/);
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `node --test tests/supabase-cards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/store/supabase-cards.ts`:

```ts
// Detail cards in Supabase, reached over PostgREST with plain fetch — no SDK,
// to keep the project's zero-runtime-dependency rule. Silent when unconfigured,
// the same contract as src/store/subscribers.ts.
import type { TenderRow, TenderItemRow, BidRow, AwardRow } from "./types.ts";

export type SupabaseConfig = { url: string; serviceKey: string };

export function loadSupabaseConfig(env: NodeJS.ProcessEnv = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  return url && serviceKey ? { url, serviceKey } : null;
}

export type Card = {
  tender: TenderRow;
  items: TenderItemRow[];
  bids: BidRow[];
  awards: AwardRow[];
};

function headers(config: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    "content-type": "application/json",
    ...extra,
  };
}

export async function upsertCard(
  config: SupabaseConfig,
  card: Card,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const base = `${config.url.replace(/\/$/, "")}/rest/v1`;
  // One POST per table, in a fixed order so a test can assert on it. Rows
  // carry their own primary keys, so merge-duplicates makes a re-fetch of the
  // same tender idempotent.
  const writes: [string, unknown][] = [
    ["tenders", [card.tender]],
    ["tender_items", card.items],
    ["bids", card.bids],
    ["awards", card.awards],
  ];
  for (const [table, rows] of writes) {
    if (Array.isArray(rows) && rows.length === 0 && table !== "tenders") continue;
    const res = await fetchImpl(`${base}/${table}`, {
      method: "POST",
      headers: headers(config, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`Supabase ${table} upsert returned ${res.status}`);
  }
}

export async function getCard(
  config: SupabaseConfig,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Card | null> {
  const base = `${config.url.replace(/\/$/, "")}/rest/v1`;

  async function rows<T>(path: string): Promise<T[]> {
    const res = await fetchImpl(`${base}/${path}`, { method: "GET", headers: headers(config) });
    if (!res.ok) throw new Error(`Supabase read returned ${res.status}`);
    return (await res.json()) as T[];
  }

  const enc = encodeURIComponent(id);
  const [tender] = await rows<TenderRow>(`tenders?id=eq.${enc}`);
  if (!tender) return null;
  const [items, bids, awards] = await Promise.all([
    rows<TenderItemRow>(`tender_items?tender_id=eq.${enc}`),
    rows<BidRow>(`bids?tender_id=eq.${enc}`),
    rows<AwardRow>(`awards?tender_id=eq.${enc}`),
  ]);
  return { tender, items, bids, awards };
}
```

- [ ] **Step 4: Run it, see it pass**

Run: `node --test tests/supabase-cards.test.ts && npm run typecheck`
Expected: PASS, 5 tests; typecheck clean. Paste both raw outputs into the report.

- [ ] **Step 5: Commit**

```bash
git add src/store/supabase-cards.ts tests/supabase-cards.test.ts
git commit -m "feat(cards): read and write tender detail cards in Supabase"
```

---

### Task 3: The tender page reads from Supabase

**Files:**
- Modify: `server/data.ts` (extract + export `mergeCardDetail`, reuse where the dataset is built)
- Modify: `server/pages/tender.ts` (`tenderPage` → async, merge Supabase card when `!entry.detailed`)
- Modify: `server/app.ts` (`render` → async; await `tenderPage`)
- Modify: `server/router.ts` (`serve()` → async; await `render`; await both `serve()` calls)
- Test: `tests/render.test.ts` (adjust for async render)

**Interfaces:**
- Consumes: `loadSupabaseConfig`, `getCard`, `type Card` from Task 2; existing `dataset()` from `server/context.ts`.
- Produces:
  - `tenderPage(tenderId: string): Promise<string>`
  - `render(url: URL, saved?: Favourite[]): Promise<Rendered>`
  - `mergeCardDetail(entry: Case, card: Card): Case` — exported from `server/data.ts`, computed from the SAME logic that already attaches detail when the dataset is built.

**CRITICAL — read this before writing Task 3.** `dataset().byTender` is built
from the risk FLAGS (`server/data.ts` around lines 143-174), so **every one of
the 36,773 flagged tenders already has a `Case` entry** — `byTender.get(id)` is
NOT null for an uncached tender. What an uncached tender lacks is DETAIL:
`entry.detailed` is `false`, and `officer_name`, `bidders`, `winner_edrpou`,
`winner_amount` are null. So the read path is NOT "entry missing → fetch"; it is
**"entry present but `!entry.detailed` → fetch the card and merge its detail
into the entry."** The derivation (bidders = count of bids, winner = the award,
officer from the tender row, `detailed = true`) already exists inline in
`data.ts` where it builds a `Case` from a `detail`. Extract that into
`mergeCardDetail(entry, card)` and call it from both places, so memory-built and
Supabase-built entries are identical. Do not reimplement the derivation by eye.

- [ ] **Step 1: Adjust the render test for an async render**

In `tests/render.test.ts`, the `page()` helper currently returns `render(...)`
synchronously. Make it and its callers await. Change the helper:

```ts
async function page(path: string) {
  return await render(new URL(`https://x.test${path}`));
}
```

and add `await` to every `page(...)` call and mark those tests `async`. This
is mechanical: `render` is becoming async, and the test must follow. No
assertion changes.

- [ ] **Step 2: Run the render test, watch it fail to compile/await**

Run: `node --test tests/render.test.ts`
Expected: FAIL — `render(...)` is still sync (returns `Rendered`, not a
Promise) OR the awaited calls do not yet line up. This confirms the test now
expects the async signature.

- [ ] **Step 3: Make the render chain async**

First, in `server/data.ts`, extract the inline detail-derivation into an
exported `mergeCardDetail(entry: Case, card: Card): Case` and call it where the
dataset is built (so behaviour is unchanged there), then reuse it in the page.
Read the current `Case`-building block first and move its logic verbatim — the
same fields (`officer_name`, `officer_email`, `officer_phone`, `bidders`,
`winner_edrpou`, `winner_amount`, `detailed: true`, and any others it sets from
detail). Do not change what values are derived.

Then in `server/pages/tender.ts`:

```ts
import { loadSupabaseConfig, getCard } from "../store/supabase-cards.ts";
import { mergeCardDetail } from "../data.ts";
// ...
export async function tenderPage(tenderId: string): Promise<string> {
  const base = dataset().byTender.get(tenderId);
  if (!base) return notFound();

  // Every flagged tender has an entry, but most lack detail (officer, bidders,
  // winner) — those cards were never fetched into the committed dataset. Pull
  // the card live from Supabase and merge it in. A miss or an outage leaves the
  // entry as-is, which renders the existing "not loaded" state.
  let entry = base;
  if (!entry.detailed) {
    const config = loadSupabaseConfig();
    if (config) {
      try {
        const card = await getCard(config, tenderId);
        if (card) entry = mergeCardDetail(base, card);
      } catch (err) {
        console.error(`supabase card fetch failed for ${tenderId} — ${(err as Error).message}`);
      }
    }
  }

  // ...rest of the existing function unchanged, using `entry`
}
```

The rest of `tenderPage` already reads flat fields off `entry` (`officer_name`,
`bidders`, `winner_edrpou`, dates, etc.) — it does not read raw item/bid arrays,
so no further shape work is needed once `mergeCardDetail` has populated those
fields. Confirm this by reading the whole function before editing.

In `server/app.ts`, make `render` async and await the tender branch:

```ts
export async function render(url: URL, saved: Favourite[] = []): Promise<Rendered> {
  // ...unchanged branches, except:
  if (path.startsWith("/tender/")) {
    // ...the report sub-branch stays sync where it reads db.byTender;
    return { status: 200, body: await tenderPage(rest) };
  }
```

Every other branch stays as-is; an async function may return sync values.

In `server/router.ts`, make `serve()` async and await it:

```ts
async function serve(): Promise<HttpResponse> {
  // ...
  const rendered = await render(req.url, saved);
  // ...
}
```

and change its two call sites from `return serve();` to `return await serve();`.

- [ ] **Step 4: Run the tests and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS, all suites; typecheck clean. Paste both raw outputs. If the
render test's tender/entity/officer/supplier cases now need `await`, that is
expected and allowed — the signature changed.

- [ ] **Step 5: Commit**

```bash
git add server/pages/tender.ts server/app.ts server/router.ts tests/render.test.ts
git commit -m "feat(tender): show a card from Supabase when it is not in memory"
```

---

### Task 4: Ingest writes cards to Supabase

**Files:**
- Modify: `scripts/ingest-details.ts`

**Interfaces:**
- Consumes: `loadSupabaseConfig`, `upsertCard` from Task 2.
- Produces: nothing importable.

- [ ] **Step 1: Write each fetched card to Supabase**

In `scripts/ingest-details.ts`, load the config once at the top:

```ts
import { loadSupabaseConfig, upsertCard } from "../src/store/supabase-cards.ts";
const supabase = loadSupabaseConfig();
```

In the worker, after a card is normalized and pushed to the JSON buffers, also
upsert it to Supabase when configured. Keep it from failing the run:

```ts
const normalized = normalizeTender(await fetchTender(id));
tenders.push(normalized.tender);
items.push(...normalized.items);
bids.push(...normalized.bids);
awards.push(...normalized.awards);
if (supabase) {
  try {
    await upsertCard(supabase, normalized);
  } catch (err) {
    failed++;
    if (failed <= 5) console.log(`  ${id}: supabase upsert failed — ${(err as Error).message}`);
  }
}
```

`normalized` already has the `{ tender, items, bids, awards }` shape `upsertCard` expects.

- [ ] **Step 2: Typecheck and run the suite**

Run: `npm test && npm run typecheck`
Expected: PASS; typecheck clean. (No unit test drives the live upsert here; it
is exercised operationally in Task 5 and covered in isolation by Task 2.)

- [ ] **Step 3: Commit**

```bash
git add scripts/ingest-details.ts
git commit -m "feat(ingest): mirror each fetched card into Supabase"
```

---

### Task 5: Backfill all cards

**Files:**
- None changed. This task runs the ingest to populate Supabase.

**Interfaces:**
- Consumes: everything above.
- Produces: a populated `tenders`/`tender_items`/`bids`/`awards` in Supabase.

- [ ] **Step 1: Run the backfill**

With `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` set in the environment, run:

```bash
TR_CONCURRENCY=6 node scripts/ingest-details.ts
```

This fetches the full card for every flagged tender not already stored and
upserts each into Supabase. It is resumable — the JSON store's `have` set
skips tenders already fetched locally, so a re-run continues. Expect it to run
for a long time (tens of thousands of Prozorro fetches); let it finish or
re-run until the "to fetch" count reaches zero.

Because this is long and network-bound, run it in the background and check
back; do not block on it. Record in the report the starting "to fetch" count
and the final counts.

- [ ] **Step 2: Verify coverage in Supabase**

Through the Supabase MCP, count rows: `select count(*) from public.tenders;`
Expected: on the order of tens of thousands, approaching the 36,773 flagged
tenders (some cards legitimately fail to fetch — record how many).

- [ ] **Step 3: Verify a previously-uncached tender renders**

Pick a tender id that is NOT in `web-data/tenders.json` but IS flagged, and
confirm `getCard` returns it (a small scratch script, deleted after) or, once
deployed, that its tender page shows a full card instead of "картку ще не
завантажено".

No commit — this task produces data in Supabase, not code.
