# Tender Radar — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ingest and analysis core that collects Kharkiv-oblast procurement data from four Ukrainian state open-data sources, normalizes it, and produces price-gap findings — runnable end to end from the command line with no database credentials.

**Architecture:** A pure functional core wrapped in a thin I/O shell. HTTP clients only fetch; normalizers are pure functions from raw payloads to row objects; the detector is a pure function over rows. Storage sits behind a narrow `Store` interface with two adapters — a JSON-file adapter that works today, and a Supabase adapter wired when credentials arrive. This means every task below is fully testable offline against recorded fixtures of real payloads.

**Tech Stack:** Node 24 (native TypeScript type-stripping, no build step), `node:test` + `node:assert` (built in), zero runtime dependencies for the core. Postgres-compatible DDL in plain `.sql` files. Supabase adapter uses `fetch` against the PostgREST endpoint — no client library.

## Global Constraints

- **Node version floor:** 24.x. TypeScript files run directly via `node file.ts`; there is no build step and no bundler. Do not add `tsc`, `tsx`, `esbuild`, or `ts-node`.
- **Zero runtime dependencies in `src/`.** Anything under `src/` must import only from `node:*` and other project files. Dev-only tooling is also disallowed for now — `node --test` covers it.
- **All modules are ESM.** `package.json` has `"type": "module"`. Imports of local files must carry the `.ts` extension: `import { x } from "./y.ts"`.
- **Tests never touch the network.** Source modules that fetch are tested against a `node:http` server started inside the test, or against recorded fixtures. A test that reaches a real host is a plan violation.
- **Fixtures are real recorded payloads,** captured once by `scripts/capture-fixtures.ts` and committed. Do not hand-write fixture data.
- **Region string is exactly `Харківська область`.** This is the value the state APIs emit in `procuringEntityRegion` and `procuringEntity.address.region`. Match it exactly; do not normalize case or strip the word `область`.
- **Money is stored as a number of UAH,** not cents. Source APIs emit floats (e.g. `35496943.56`); keep them as JS numbers and never round during ingest.
- **Findings carry a tier.** Every finding row has `tier` set to one of `confirmed` | `state_indicator` | `own_analysis`. The detector in this plan produces only `own_analysis`.
- **Commit after every task** with a `feat:`, `test:`, or `chore:` prefix.

---

## File Structure

```
tender-radar/
  package.json                     # type: module, test script
  .gitignore
  db/
    001_schema.sql                 # portable Postgres DDL
  src/
    sources/
      http.ts                      # retrying fetch helpers, rate limiting
      risks.ts                     # risks.prozorro.gov.ua
      openprocurement.ts           # public.api.openprocurement.org
      audit.ts                     # audit-api.prozorro.gov.ua
      market.ts                    # market-api.prozorro.gov.ua
    normalize/
      csv.ts                       # RFC4180-ish CSV reader
      risk.ts                      # risk report CSV -> RiskFlagRow[]
      tender.ts                    # raw tender -> tables
      monitoring.ts                # raw monitoring -> MonitoringRow
      product.ts                   # market product+offer -> CatalogPriceRow
    analysis/
      unit-price.ts                # per-unit price with honest computability
      catalog-gap.ts               # the etap-1 detector
    store/
      types.ts                     # row types + Store interface
      json-store.ts                # file-backed adapter (works today)
      supabase-store.ts            # PostgREST adapter (needs credentials)
  scripts/
    capture-fixtures.ts            # one-off: record real payloads
    ingest-risks.ts
    ingest-tenders.ts
    ingest-monitorings.ts
    ingest-market.ts
    analyze.ts
    report.ts                      # prints findings to the terminal
  tests/
    fixtures/                      # committed real payloads
    *.test.ts
```

Rationale for the boundaries: `sources/` knows about HTTP and nothing about our
schema; `normalize/` knows about our schema and nothing about HTTP; `analysis/`
knows about rows only. Each can be understood and rejected in review on its own.

---

### Task 1: Project skeleton and recorded fixtures

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `scripts/capture-fixtures.ts`
- Create: `tests/fixtures.test.ts`
- Create (by running the script): `tests/fixtures/*.json`, `tests/fixtures/risks-report.csv`

**Interfaces:**
- Consumes: nothing.
- Produces: committed fixture files at the exact paths listed in `FIXTURES` below. Every later task's tests read from `tests/fixtures/`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tender-radar",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "node --test tests/",
    "capture-fixtures": "node scripts/capture-fixtures.ts"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.env
.env.local
data/
*.log
```

- [ ] **Step 3: Write `scripts/capture-fixtures.ts`**

```ts
// Records real payloads from the state open-data APIs into tests/fixtures/.
// Run once; commit the output. Tests never hit the network.
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT = join(import.meta.dirname, "..", "tests", "fixtures");

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "tender-radar/0.1 (fixture capture)" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

async function save(name: string, body: string): Promise<void> {
  const path = join(OUT, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
  console.log(`saved ${name} (${body.length} bytes)`);
}

async function main(): Promise<void> {
  // 1. Risk indicator catalogue and one report.
  await save("risk-filter-values.json", await get("https://risks.prozorro.gov.ua/api/filter-values"));
  await save("risks-page.json", await get("https://risks.prozorro.gov.ua/api/risks?skip=0"));
  const csv = await get("https://risks.prozorro.gov.ua/api/risks-report?risks=sas24-3-13&risks_all=false");
  await save("risks-report.csv", csv);

  // 2. Tender feed page and one full tender card.
  const feed = await get(
    "https://public.api.openprocurement.org/api/2.5/tenders?descending=1&limit=20&opt_fields=tenderID,procuringEntity",
  );
  await save("tender-feed.json", feed);
  const feedIds = await get("https://public.api.openprocurement.org/api/2.5/tenders?descending=1&limit=1");
  const tenderId = JSON.parse(feedIds).data[0].id as string;
  await save("tender-detail.json", await get(`https://public.api.openprocurement.org/api/2.5/tenders/${tenderId}`));

  // 3. One audit monitoring card.
  const mons = await get("https://audit-api.prozorro.gov.ua/api/2.5/monitorings?descending=1&limit=1");
  const monId = JSON.parse(mons).data[0].id as string;
  await save("monitoring-detail.json", await get(`https://audit-api.prozorro.gov.ua/api/2.5/monitorings/${monId}`));

  // 4. One catalogue product and one offer.
  const prods = await get("https://market-api.prozorro.gov.ua/api/products?descending=1&limit=1");
  const prodId = JSON.parse(prods).data[0].id as string;
  await save("market-product.json", await get(`https://market-api.prozorro.gov.ua/api/products/${prodId}`));
  const offers = await get("https://market-api.prozorro.gov.ua/api/offers?limit=1");
  const offerId = JSON.parse(offers).data[0].id as string;
  await save("market-offer.json", await get(`https://market-api.prozorro.gov.ua/api/offers/${offerId}`));
}

await main();
```

- [ ] **Step 4: Run the capture script**

Run: `node scripts/capture-fixtures.ts`
Expected: eight `saved …` lines, no errors. `tests/fixtures/` now contains
`risk-filter-values.json`, `risks-page.json`, `risks-report.csv`,
`tender-feed.json`, `tender-detail.json`, `monitoring-detail.json`,
`market-product.json`, `market-offer.json`.

- [ ] **Step 5: Write the fixture smoke test**

```ts
// tests/fixtures.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "fixtures");

const JSON_FIXTURES = [
  "risk-filter-values.json",
  "risks-page.json",
  "tender-feed.json",
  "tender-detail.json",
  "monitoring-detail.json",
  "market-product.json",
  "market-offer.json",
];

test("every JSON fixture is present and parses", () => {
  for (const name of JSON_FIXTURES) {
    const raw = readFileSync(join(DIR, name), "utf8");
    assert.ok(raw.length > 0, `${name} is empty`);
    assert.doesNotThrow(() => JSON.parse(raw), `${name} is not valid JSON`);
  }
});

test("the risk report fixture has the expected header", () => {
  const csv = readFileSync(join(DIR, "risks-report.csv"), "utf8");
  const header = csv.split("\n")[0].trim();
  assert.equal(
    header,
    "_id,tenderID,dateAssessed,dateModified,procuringEntityRegion,procuringEntityEDRPOU,procuringEntityName,valueAmount,valueCurrency,worked_risks",
  );
});
```

- [ ] **Step 6: Run the test**

Run: `npm test`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore scripts/capture-fixtures.ts tests/
git commit -m "chore: project skeleton and recorded API fixtures"
```

---

### Task 2: CSV reader

The risk report CSV has a quoted field containing commas — `worked_risks` looks
like `"['ari-1-1', 'ari-1-2']"`. A naive `split(",")` corrupts every row that has
more than one indicator, which is most of them. This needs a real parser.

**Files:**
- Create: `src/normalize/csv.ts`
- Test: `tests/csv.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseCsv(text: string): Record<string, string>[]` — returns one object per data row, keyed by the header names, with quotes unwrapped and doubled quotes (`""`) collapsed to one.

- [ ] **Step 1: Write the failing test**

```ts
// tests/csv.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../src/normalize/csv.ts";

test("parses a plain row", () => {
  const rows = parseCsv("a,b\n1,2\n");
  assert.deepEqual(rows, [{ a: "1", b: "2" }]);
});

test("keeps commas that live inside quotes", () => {
  const rows = parseCsv(`a,b\n1,"['x', 'y']"\n`);
  assert.equal(rows[0].b, "['x', 'y']");
});

test("collapses a doubled quote into one", () => {
  const rows = parseCsv(`a\n"say ""hi"""\n`);
  assert.equal(rows[0].a, 'say "hi"');
});

test("tolerates CRLF line endings and a missing trailing newline", () => {
  const rows = parseCsv("a,b\r\n1,2");
  assert.deepEqual(rows, [{ a: "1", b: "2" }]);
});

test("ignores a blank final line", () => {
  const rows = parseCsv("a\n1\n\n");
  assert.equal(rows.length, 1);
});

test("reads the real risk report fixture", () => {
  const csv = readFileSync(join(import.meta.dirname, "fixtures", "risks-report.csv"), "utf8");
  const rows = parseCsv(csv);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.match(row.tenderID, /^UA-\d{4}-\d{2}-\d{2}-\d{6}/);
    assert.match(row.worked_risks, /^\[/);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/csv.test.ts`
Expected: FAIL — cannot find module `../src/normalize/csv.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/normalize/csv.ts

/** Splits one CSV line into fields, honouring quoted sections. */
function splitLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Reads CSV text into row objects keyed by the header names.
 * Assumes no field contains a raw newline, which holds for every
 * state export this project consumes.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const header = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = splitLine(lines[i]);
    const row: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = fields[c] ?? "";
    }
    rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/csv.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/normalize/csv.ts tests/csv.test.ts
git commit -m "feat: CSV reader that handles quoted fields"
```

---

### Task 3: HTTP client with retry and pacing

**Files:**
- Create: `src/sources/http.ts`
- Test: `tests/http.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `getText(url: string, opts?: HttpOptions): Promise<string>`
  - `getJson<T>(url: string, opts?: HttpOptions): Promise<T>`
  - `type HttpOptions = { retries?: number; retryDelayMs?: number; timeoutMs?: number }`
  - `class HttpError extends Error { status: number; url: string }`

  Defaults: `retries: 3`, `retryDelayMs: 500`, `timeoutMs: 30000`. Retries on
  network failure, timeout, and status ≥ 500. Does not retry on 4xx.

- [ ] **Step 1: Write the failing test**

```ts
// tests/http.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { getText, getJson, HttpError } from "../src/sources/http.ts";

async function serve(handler: (n: number) => { status: number; body: string }): Promise<{ url: string; close: () => Promise<void>; calls: () => number }> {
  let calls = 0;
  const server: Server = createServer((req, res) => {
    calls++;
    const { status, body } = handler(calls);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    calls: () => calls,
  };
}

test("returns the body on success", async () => {
  const s = await serve(() => ({ status: 200, body: "hello" }));
  assert.equal(await getText(s.url), "hello");
  await s.close();
});

test("parses JSON", async () => {
  const s = await serve(() => ({ status: 200, body: '{"n":7}' }));
  const out = await getJson<{ n: number }>(s.url);
  assert.equal(out.n, 7);
  await s.close();
});

test("retries a 500 and then succeeds", async () => {
  const s = await serve((n) => (n < 3 ? { status: 500, body: "boom" } : { status: 200, body: "ok" }));
  assert.equal(await getText(s.url, { retryDelayMs: 1 }), "ok");
  assert.equal(s.calls(), 3);
  await s.close();
});

test("does not retry a 404 and reports the status", async () => {
  const s = await serve(() => ({ status: 404, body: "nope" }));
  await assert.rejects(
    () => getText(s.url, { retryDelayMs: 1 }),
    (err: unknown) => err instanceof HttpError && err.status === 404,
  );
  assert.equal(s.calls(), 1);
  await s.close();
});

test("gives up after the retry budget", async () => {
  const s = await serve(() => ({ status: 503, body: "down" }));
  await assert.rejects(() => getText(s.url, { retries: 2, retryDelayMs: 1 }), HttpError);
  assert.equal(s.calls(), 2);
  await s.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/http.test.ts`
Expected: FAIL — cannot find module `../src/sources/http.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/sources/http.ts

export type HttpOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

export class HttpError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

const UA = "tender-radar/0.1 (+public procurement analysis)";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetches a URL as text, retrying transient failures with linear backoff. */
export async function getText(url: string, opts: HttpOptions = {}): Promise<string> {
  const retries = opts.retries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  let lastError: Error = new HttpError(0, url, "no attempt was made");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 500) {
        lastError = new HttpError(res.status, url, `server returned ${res.status}`);
      } else if (!res.ok) {
        throw new HttpError(res.status, url, `request failed with ${res.status}`);
      } else {
        return await res.text();
      }
    } catch (err) {
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < retries) await sleep(retryDelayMs * attempt);
  }
  throw lastError;
}

/** Fetches a URL and parses the body as JSON. */
export async function getJson<T>(url: string, opts: HttpOptions = {}): Promise<T> {
  return JSON.parse(await getText(url, opts)) as T;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/http.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/sources/http.ts tests/http.test.ts
git commit -m "feat: retrying HTTP client"
```

---

### Task 4: Row types and the Store interface

**Files:**
- Create: `src/store/types.ts`
- Test: none — this file declares types only and has no runtime behaviour to test. The next task's tests exercise it.

**Interfaces:**
- Consumes: nothing.
- Produces: the row types below and `interface Store`. Every later task imports from here. Field names match the SQL columns in Task 10 exactly.

- [ ] **Step 1: Write the types**

```ts
// src/store/types.ts

export type TenderRow = {
  id: string;                 // openprocurement uuid
  tender_id: string;          // UA-YYYY-MM-DD-NNNNNN-x
  title: string;
  description: string | null;
  status: string;
  method: string | null;
  value_amount: number | null;
  currency: string | null;
  date: string | null;        // ISO 8601
  entity_edrpou: string | null;
  entity_name: string | null;
  region: string | null;
  locality: string | null;
  raw: unknown;
};

export type TenderItemRow = {
  tender_id: string;          // openprocurement uuid, matches TenderRow.id
  item_id: string;
  description: string | null;
  cpv_code: string | null;
  cpv_name: string | null;
  quantity: number | null;
  unit_code: string | null;
  unit_name: string | null;
  lot_id: string | null;
};

export type BidRow = {
  tender_id: string;
  bid_id: string;
  supplier_edrpou: string | null;
  supplier_name: string | null;
  amount: number | null;
  status: string | null;
};

export type AwardRow = {
  tender_id: string;
  award_id: string;
  supplier_edrpou: string | null;
  supplier_name: string | null;
  amount: number | null;
  status: string | null;
  date: string | null;
};

export type RiskFlagRow = {
  tender_id: string;          // openprocurement uuid (the `_id` column)
  tender_ref: string;         // UA-… human-readable id
  risk_id: string;            // e.g. "ari-1-1"
  date_assessed: string | null;
  region: string | null;
  entity_edrpou: string | null;
  entity_name: string | null;
  value_amount: number | null;
};

export type RiskRuleRow = {
  risk_id: string;
  name: string | null;
  description: string | null;
  legitimateness: string | null;
  status: string | null;
};

export type MonitoringRow = {
  monitoring_id: string;
  tender_id: string;
  status: string;
  decision_text: string | null;
  reasons: unknown;
  conclusion: unknown;
  date_created: string | null;
  date_modified: string | null;
};

export type CatalogPriceRow = {
  product_id: string;
  title: string | null;
  cpv_code: string | null;
  offer_id: string;
  offer_price: number | null;
  currency: string | null;
  vat_included: boolean | null;
  fetched_at: string;
};

export type FindingTier = "confirmed" | "state_indicator" | "own_analysis";

export type FindingRow = {
  tender_id: string;
  detector_key: string;
  tier: FindingTier;
  severity: "low" | "medium" | "high";
  title: string;
  explanation: string;
  evidence: unknown;
  created_at: string;
};

/** Narrow persistence surface. Adapters implement it; nothing else may. */
export interface Store {
  upsertTenders(rows: TenderRow[]): Promise<void>;
  upsertTenderItems(rows: TenderItemRow[]): Promise<void>;
  upsertBids(rows: BidRow[]): Promise<void>;
  upsertAwards(rows: AwardRow[]): Promise<void>;
  upsertRiskFlags(rows: RiskFlagRow[]): Promise<void>;
  upsertRiskRules(rows: RiskRuleRow[]): Promise<void>;
  upsertMonitorings(rows: MonitoringRow[]): Promise<void>;
  upsertCatalogPrices(rows: CatalogPriceRow[]): Promise<void>;
  upsertFindings(rows: FindingRow[]): Promise<void>;

  allTenderItems(): Promise<TenderItemRow[]>;
  allTenders(): Promise<TenderRow[]>;
  allAwards(): Promise<AwardRow[]>;
  allCatalogPrices(): Promise<CatalogPriceRow[]>;
  allFindings(): Promise<FindingRow[]>;

  getCursor(worker: string): Promise<string | null>;
  setCursor(worker: string, cursor: string): Promise<void>;
}
```

- [ ] **Step 2: Verify the file type-checks by importing it**

Run: `node -e "import('./src/store/types.ts').then(() => console.log('types ok'))"`
Expected: prints `types ok`. (Node strips types; this confirms the syntax parses.)

- [ ] **Step 3: Commit**

```bash
git add src/store/types.ts
git commit -m "feat: row types and Store interface"
```

---

### Task 5: JSON-file Store adapter

This adapter makes the whole pipeline runnable today, with no database and no
credentials. It is not a throwaway: it stays as the offline test double.

**Files:**
- Create: `src/store/json-store.ts`
- Test: `tests/json-store.test.ts`

**Interfaces:**
- Consumes: `Store` and the row types from `src/store/types.ts`.
- Produces: `class JsonStore implements Store`, constructed as `new JsonStore(dir: string)`. Each table is one file, `<dir>/<table>.json`, holding an array. Upserts are keyed as follows — later rows with the same key replace earlier ones:
  - `tenders` → `id`
  - `tender_items` → `tender_id` + `item_id`
  - `bids` → `tender_id` + `bid_id`
  - `awards` → `tender_id` + `award_id`
  - `risk_flags` → `tender_id` + `risk_id`
  - `risk_rules` → `risk_id`
  - `monitorings` → `monitoring_id`
  - `catalog_prices` → `offer_id`
  - `findings` → `tender_id` + `detector_key`
  - cursors live in `<dir>/cursors.json` as an object

- [ ] **Step 1: Write the failing test**

```ts
// tests/json-store.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../src/store/json-store.ts";
import type { TenderRow } from "../src/store/types.ts";

function tender(id: string, title: string): TenderRow {
  return {
    id, tender_id: `UA-${id}`, title, description: null, status: "active",
    method: null, value_amount: 1, currency: "UAH", date: null,
    entity_edrpou: null, entity_name: null, region: "Харківська область",
    locality: null, raw: {},
  };
}

test("writes rows and reads them back", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tr-"));
  const store = new JsonStore(dir);
  await store.upsertTenders([tender("a", "first")]);
  const rows = await store.allTenders();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "first");
  await rm(dir, { recursive: true, force: true });
});

test("a second upsert with the same key replaces the first", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tr-"));
  const store = new JsonStore(dir);
  await store.upsertTenders([tender("a", "first")]);
  await store.upsertTenders([tender("a", "second")]);
  const rows = await store.allTenders();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "second");
  await rm(dir, { recursive: true, force: true });
});

test("rows with different keys accumulate", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tr-"));
  const store = new JsonStore(dir);
  await store.upsertTenders([tender("a", "first"), tender("b", "other")]);
  assert.equal((await store.allTenders()).length, 2);
  await rm(dir, { recursive: true, force: true });
});

test("reading an empty store yields an empty array, not an error", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tr-"));
  const store = new JsonStore(dir);
  assert.deepEqual(await store.allTenders(), []);
  await rm(dir, { recursive: true, force: true });
});

test("cursors round-trip and default to null", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tr-"));
  const store = new JsonStore(dir);
  assert.equal(await store.getCursor("tenders"), null);
  await store.setCursor("tenders", "offset-1");
  assert.equal(await store.getCursor("tenders"), "offset-1");
  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/json-store.test.ts`
Expected: FAIL — cannot find module `../src/store/json-store.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/store/json-store.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  Store, TenderRow, TenderItemRow, BidRow, AwardRow, RiskFlagRow,
  RiskRuleRow, MonitoringRow, CatalogPriceRow, FindingRow,
} from "./types.ts";

/** File-backed Store. One JSON array per table; adequate for the volumes here. */
export class JsonStore implements Store {
  #dir: string;

  constructor(dir: string) {
    this.#dir = dir;
  }

  async #read<T>(table: string): Promise<T[]> {
    try {
      return JSON.parse(await readFile(join(this.#dir, `${table}.json`), "utf8")) as T[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  async #write<T>(table: string, rows: T[]): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    await writeFile(join(this.#dir, `${table}.json`), JSON.stringify(rows, null, 1), "utf8");
  }

  async #upsert<T>(table: string, rows: T[], key: (row: T) => string): Promise<void> {
    const existing = await this.#read<T>(table);
    const byKey = new Map(existing.map((row) => [key(row), row]));
    for (const row of rows) byKey.set(key(row), row);
    await this.#write(table, [...byKey.values()]);
  }

  upsertTenders(rows: TenderRow[]) {
    return this.#upsert("tenders", rows, (r) => r.id);
  }
  upsertTenderItems(rows: TenderItemRow[]) {
    return this.#upsert("tender_items", rows, (r) => `${r.tender_id}|${r.item_id}`);
  }
  upsertBids(rows: BidRow[]) {
    return this.#upsert("bids", rows, (r) => `${r.tender_id}|${r.bid_id}`);
  }
  upsertAwards(rows: AwardRow[]) {
    return this.#upsert("awards", rows, (r) => `${r.tender_id}|${r.award_id}`);
  }
  upsertRiskFlags(rows: RiskFlagRow[]) {
    return this.#upsert("risk_flags", rows, (r) => `${r.tender_id}|${r.risk_id}`);
  }
  upsertRiskRules(rows: RiskRuleRow[]) {
    return this.#upsert("risk_rules", rows, (r) => r.risk_id);
  }
  upsertMonitorings(rows: MonitoringRow[]) {
    return this.#upsert("monitorings", rows, (r) => r.monitoring_id);
  }
  upsertCatalogPrices(rows: CatalogPriceRow[]) {
    return this.#upsert("catalog_prices", rows, (r) => r.offer_id);
  }
  upsertFindings(rows: FindingRow[]) {
    return this.#upsert("findings", rows, (r) => `${r.tender_id}|${r.detector_key}`);
  }

  allTenders() { return this.#read<TenderRow>("tenders"); }
  allTenderItems() { return this.#read<TenderItemRow>("tender_items"); }
  allAwards() { return this.#read<AwardRow>("awards"); }
  allCatalogPrices() { return this.#read<CatalogPriceRow>("catalog_prices"); }
  allFindings() { return this.#read<FindingRow>("findings"); }

  async getCursor(worker: string): Promise<string | null> {
    const all = await this.#read<Record<string, string>>("cursors");
    const map = all[0] ?? {};
    return map[worker] ?? null;
  }

  async setCursor(worker: string, cursor: string): Promise<void> {
    const all = await this.#read<Record<string, string>>("cursors");
    const map = all[0] ?? {};
    map[worker] = cursor;
    await this.#write("cursors", [map]);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/json-store.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/store/json-store.ts tests/json-store.test.ts
git commit -m "feat: file-backed Store adapter"
```

---

### Task 6: Risk indicators — source and normalizer

**Files:**
- Create: `src/sources/risks.ts`
- Create: `src/normalize/risk.ts`
- Test: `tests/risk.test.ts`

**Interfaces:**
- Consumes: `getText`, `getJson`, `HttpOptions` from `src/sources/http.ts`; `parseCsv` from `src/normalize/csv.ts`; `RiskFlagRow`, `RiskRuleRow` from `src/store/types.ts`.
- Produces:
  - `src/sources/risks.ts`: `listRiskRuleIds(opts?): Promise<string[]>`, `fetchRiskReportCsv(riskId: string, opts?): Promise<string>`, `fetchRisksPage(skip: number, opts?): Promise<RisksPage>`, and `type RisksPage = { count: number; items: RawRiskItem[] }`.
  - `src/normalize/risk.ts`: `parseWorkedRisks(field: string): string[]`, `normalizeRiskReport(csv: string): RiskFlagRow[]`, `filterByRegion(rows: RiskFlagRow[], region: string): RiskFlagRow[]`, `normalizeRiskRules(page: RisksPage): RiskRuleRow[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/risk.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWorkedRisks, normalizeRiskReport, filterByRegion, normalizeRiskRules } from "../src/normalize/risk.ts";

const DIR = join(import.meta.dirname, "fixtures");
const csv = readFileSync(join(DIR, "risks-report.csv"), "utf8");
const page = JSON.parse(readFileSync(join(DIR, "risks-page.json"), "utf8"));

test("reads the python-style list the export emits", () => {
  assert.deepEqual(parseWorkedRisks("['ari-1-1', 'ari-1-2']"), ["ari-1-1", "ari-1-2"]);
  assert.deepEqual(parseWorkedRisks("['sas24-3-13']"), ["sas24-3-13"]);
  assert.deepEqual(parseWorkedRisks("[]"), []);
  assert.deepEqual(parseWorkedRisks(""), []);
});

test("emits one row per tender per triggered indicator", () => {
  const rows = normalizeRiskReport(`_id,tenderID,dateAssessed,dateModified,procuringEntityRegion,procuringEntityEDRPOU,procuringEntityName,valueAmount,valueCurrency,worked_risks
abc,UA-2026-01-01-000001-a,2026-01-02T00:00:00+02:00,2026-01-01T00:00:00+02:00,Харківська область,12345678,КП ТЕСТ,1000.5,UAH,"['ari-1-1', 'ari-1-2']"`);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.risk_id), ["ari-1-1", "ari-1-2"]);
  assert.equal(rows[0].tender_id, "abc");
  assert.equal(rows[0].tender_ref, "UA-2026-01-01-000001-a");
  assert.equal(rows[0].value_amount, 1000.5);
  assert.equal(rows[0].entity_edrpou, "12345678");
});

test("normalizes the real report fixture without losing rows", () => {
  const rows = normalizeRiskReport(csv);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(row.risk_id.length > 0);
    assert.ok(row.tender_id.length > 0);
  }
});

test("region filter matches the exact state string", () => {
  const rows = normalizeRiskReport(csv);
  const kharkiv = filterByRegion(rows, "Харківська область");
  for (const row of kharkiv) assert.equal(row.region, "Харківська область");
  assert.ok(kharkiv.length <= rows.length);
});

test("extracts indicator descriptions with their legal basis", () => {
  const rules = normalizeRiskRules(page);
  assert.ok(rules.length > 0);
  for (const rule of rules) assert.ok(rule.risk_id.length > 0);
  assert.ok(rules.some((r) => (r.legitimateness ?? "").length > 0), "expected at least one rule to carry legitimateness");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/risk.test.ts`
Expected: FAIL — cannot find module `../src/normalize/risk.ts`.

- [ ] **Step 3: Write `src/sources/risks.ts`**

```ts
// src/sources/risks.ts
import { getJson, getText, type HttpOptions } from "./http.ts";

const BASE = "https://risks.prozorro.gov.ua/api";

export type RawRiskDetail = {
  risk_id: string;
  name?: string;
  owner?: string;
  description?: string;
  legitimateness?: string;
};

export type RawRiskItem = {
  _id: string;
  dateAssessed?: string;
  procuringEntity?: {
    name?: string;
    identifier?: { id?: string; legalName?: string };
    address?: { region?: string; locality?: string };
  };
  risks?: Record<string, RawRiskDetail[]>;
};

export type RisksPage = { count: number; items: RawRiskItem[] };

/** Returns the identifiers of every currently active state risk indicator. */
export async function listRiskRuleIds(opts?: HttpOptions): Promise<string[]> {
  const body = await getJson<{ risk_rules: { identifier: string; status: string }[] }>(
    `${BASE}/filter-values`,
    opts,
  );
  return body.risk_rules.filter((r) => r.status === "active").map((r) => r.identifier);
}

/**
 * Downloads the CSV export for one indicator.
 * The export must be requested per indicator — an unfiltered request
 * does not complete.
 */
export async function fetchRiskReportCsv(riskId: string, opts?: HttpOptions): Promise<string> {
  const url = `${BASE}/risks-report?risks=${encodeURIComponent(riskId)}&risks_all=false`;
  return await getText(url, { timeoutMs: 180_000, ...opts });
}

/** Fetches one page of flagged tenders, 20 per page. */
export async function fetchRisksPage(skip: number, opts?: HttpOptions): Promise<RisksPage> {
  return await getJson<RisksPage>(`${BASE}/risks?skip=${skip}`, opts);
}
```

- [ ] **Step 4: Write `src/normalize/risk.ts`**

```ts
// src/normalize/risk.ts
import { parseCsv } from "./csv.ts";
import type { RiskFlagRow, RiskRuleRow } from "../store/types.ts";
import type { RisksPage } from "../sources/risks.ts";

/**
 * The CSV export writes the triggered indicators as a Python list literal,
 * e.g. "['ari-1-1', 'ari-1-2']". Pull the quoted identifiers out of it.
 */
export function parseWorkedRisks(field: string): string[] {
  const matches = field.match(/'([^']+)'/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

function toNumber(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Expands one CSV row into one row per triggered indicator. */
export function normalizeRiskReport(csv: string): RiskFlagRow[] {
  const rows: RiskFlagRow[] = [];
  for (const record of parseCsv(csv)) {
    for (const riskId of parseWorkedRisks(record.worked_risks ?? "")) {
      rows.push({
        tender_id: record._id,
        tender_ref: record.tenderID,
        risk_id: riskId,
        date_assessed: record.dateAssessed || null,
        region: record.procuringEntityRegion || null,
        entity_edrpou: record.procuringEntityEDRPOU || null,
        entity_name: record.procuringEntityName || null,
        value_amount: toNumber(record.valueAmount ?? ""),
      });
    }
  }
  return rows;
}

/** Keeps only rows whose procuring entity sits in the given region. */
export function filterByRegion(rows: RiskFlagRow[], region: string): RiskFlagRow[] {
  return rows.filter((row) => row.region === region);
}

/**
 * Harvests indicator descriptions from a page of flagged tenders.
 * The descriptions repeat across tenders, so deduplicate by identifier.
 */
export function normalizeRiskRules(page: RisksPage): RiskRuleRow[] {
  const byId = new Map<string, RiskRuleRow>();
  for (const item of page.items ?? []) {
    for (const [riskId, details] of Object.entries(item.risks ?? {})) {
      const detail = details?.[0];
      if (!detail) continue;
      byId.set(riskId, {
        risk_id: riskId,
        name: detail.name ?? null,
        description: detail.description ?? null,
        legitimateness: detail.legitimateness ?? null,
        status: "active",
      });
    }
  }
  return [...byId.values()];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/risk.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/sources/risks.ts src/normalize/risk.ts tests/risk.test.ts
git commit -m "feat: state risk indicator source and normalizer"
```

---

### Task 7: Tender source and normalizer

**Files:**
- Create: `src/sources/openprocurement.ts`
- Create: `src/normalize/tender.ts`
- Test: `tests/tender.test.ts`

**Interfaces:**
- Consumes: `getJson`, `HttpOptions` from `src/sources/http.ts`; row types from `src/store/types.ts`.
- Produces:
  - `src/sources/openprocurement.ts`: `fetchFeedPage(url: string | null, opts?): Promise<FeedPage>`, `fetchTender(id: string, opts?): Promise<RawTender>`, `FEED_START` constant, and `type FeedPage = { data: FeedEntry[]; nextUri: string }`, `type FeedEntry = { id: string; dateModified: string; tenderID?: string; procuringEntity?: { address?: { region?: string }; identifier?: { id?: string } } }`.
  - `src/normalize/tender.ts`: `normalizeTender(raw: RawTender): { tender: TenderRow; items: TenderItemRow[]; bids: BidRow[]; awards: AwardRow[] }` and `regionOf(entry: FeedEntry): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tender.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeTender, regionOf } from "../src/normalize/tender.ts";

const DIR = join(import.meta.dirname, "fixtures");
const detail = JSON.parse(readFileSync(join(DIR, "tender-detail.json"), "utf8")).data;
const feed = JSON.parse(readFileSync(join(DIR, "tender-feed.json"), "utf8"));

test("maps the tender header fields", () => {
  const { tender } = normalizeTender(detail);
  assert.equal(tender.id, detail.id);
  assert.equal(tender.tender_id, detail.tenderID);
  assert.equal(typeof tender.title, "string");
  assert.equal(tender.status, detail.status);
  assert.deepEqual(tender.raw, detail);
});

test("maps every item with its CPV code and quantity", () => {
  const { items } = normalizeTender(detail);
  assert.equal(items.length, (detail.items ?? []).length);
  for (const item of items) {
    assert.equal(item.tender_id, detail.id);
    assert.ok(item.item_id.length > 0);
  }
});

test("maps bids and awards when the tender has them", () => {
  const { bids, awards } = normalizeTender(detail);
  assert.equal(bids.length, (detail.bids ?? []).length);
  assert.equal(awards.length, (detail.awards ?? []).length);
});

test("a tender with no items, bids or awards yields empty arrays", () => {
  const bare = { id: "x", tenderID: "UA-x", title: "t", status: "active" };
  const out = normalizeTender(bare as never);
  assert.deepEqual(out.items, []);
  assert.deepEqual(out.bids, []);
  assert.deepEqual(out.awards, []);
  assert.equal(out.tender.value_amount, null);
});

test("reads the region out of a feed entry", () => {
  const entry = feed.data[0];
  const region = regionOf(entry);
  assert.ok(region === null || typeof region === "string");
  assert.equal(regionOf({ id: "a", dateModified: "x" }), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/tender.test.ts`
Expected: FAIL — cannot find module `../src/normalize/tender.ts`.

- [ ] **Step 3: Write `src/sources/openprocurement.ts`**

```ts
// src/sources/openprocurement.ts
import { getJson, type HttpOptions } from "./http.ts";

const BASE = "https://public.api.openprocurement.org/api/2.5";

/**
 * Scanning the feed with opt_fields is cheap — 100 entries per request.
 * procuringEntity comes back (and carries the region); items, value and
 * awards do not, so anything we keep needs a second, full fetch.
 *
 * `descending=1` matters: without it the feed starts in 2015 and the first
 * run would crawl a decade of history before reaching anything current.
 */
export const FEED_START = `${BASE}/tenders?limit=100&descending=1&opt_fields=tenderID,procuringEntity`;

export type FeedEntry = {
  id: string;
  dateModified: string;
  tenderID?: string;
  procuringEntity?: {
    name?: string;
    identifier?: { id?: string; legalName?: string };
    address?: { region?: string; locality?: string };
  };
};

export type FeedPage = { data: FeedEntry[]; nextUri: string };

export type RawTender = Record<string, unknown> & { id: string; tenderID: string };

/** Fetches one feed page; pass the previous page's nextUri to continue. */
export async function fetchFeedPage(url: string | null, opts?: HttpOptions): Promise<FeedPage> {
  const body = await getJson<{ data: FeedEntry[]; next_page: { uri: string } }>(url ?? FEED_START, opts);
  return { data: body.data, nextUri: body.next_page.uri };
}

/** Fetches the full tender card, including items, bids, awards and contracts. */
export async function fetchTender(id: string, opts?: HttpOptions): Promise<RawTender> {
  const body = await getJson<{ data: RawTender }>(`${BASE}/tenders/${id}`, opts);
  return body.data;
}
```

- [ ] **Step 4: Write `src/normalize/tender.ts`**

```ts
// src/normalize/tender.ts
import type { RawTender, FeedEntry } from "../sources/openprocurement.ts";
import type { TenderRow, TenderItemRow, BidRow, AwardRow } from "../store/types.ts";

type Dict = Record<string, unknown>;

function dict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function arr(value: unknown): Dict[] {
  return Array.isArray(value) ? value.map(dict) : [];
}

/** Reads the procuring entity's region from a feed entry, if present. */
export function regionOf(entry: FeedEntry): string | null {
  return entry.procuringEntity?.address?.region ?? null;
}

/** Splits a full tender card into the rows of our tables. */
export function normalizeTender(raw: RawTender): {
  tender: TenderRow;
  items: TenderItemRow[];
  bids: BidRow[];
  awards: AwardRow[];
} {
  const entity = dict(raw.procuringEntity);
  const identifier = dict(entity.identifier);
  const address = dict(entity.address);
  const value = dict(raw.value);

  const tender: TenderRow = {
    id: raw.id,
    tender_id: raw.tenderID,
    title: str(raw.title) ?? "",
    description: str(raw.description),
    status: str(raw.status) ?? "unknown",
    method: str(raw.procurementMethodType),
    value_amount: num(value.amount),
    currency: str(value.currency),
    date: str(raw.date) ?? str(raw.dateCreated),
    entity_edrpou: str(identifier.id),
    entity_name: str(entity.name) ?? str(identifier.legalName),
    region: str(address.region),
    locality: str(address.locality),
    raw,
  };

  const items: TenderItemRow[] = arr(raw.items).map((item) => {
    const classification = dict(item.classification);
    const unit = dict(item.unit);
    return {
      tender_id: raw.id,
      item_id: str(item.id) ?? "",
      description: str(item.description),
      cpv_code: str(classification.id),
      cpv_name: str(classification.description),
      quantity: num(item.quantity),
      unit_code: str(unit.code),
      unit_name: str(unit.name),
      lot_id: str(item.relatedLot),
    };
  });

  const bids: BidRow[] = arr(raw.bids).map((bid) => {
    const tenderer = dict(arr(bid.tenderers)[0]);
    const tendererId = dict(tenderer.identifier);
    const bidValue = dict(bid.value);
    return {
      tender_id: raw.id,
      bid_id: str(bid.id) ?? "",
      supplier_edrpou: str(tendererId.id),
      supplier_name: str(tenderer.name) ?? str(tendererId.legalName),
      amount: num(bidValue.amount),
      status: str(bid.status),
    };
  });

  const awards: AwardRow[] = arr(raw.awards).map((award) => {
    const supplier = dict(arr(award.suppliers)[0]);
    const supplierId = dict(supplier.identifier);
    const awardValue = dict(award.value);
    return {
      tender_id: raw.id,
      award_id: str(award.id) ?? "",
      supplier_edrpou: str(supplierId.id),
      supplier_name: str(supplier.name) ?? str(supplierId.legalName),
      amount: num(awardValue.amount),
      status: str(award.status),
      date: str(award.date),
    };
  });

  return { tender, items, bids, awards };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/tender.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/sources/openprocurement.ts src/normalize/tender.ts tests/tender.test.ts
git commit -m "feat: tender source and normalizer"
```

---

### Task 8: Per-unit price with honest computability

This is the correctness heart of the project, and the place where a careless
implementation would produce confident nonsense. Tender items carry a
`quantity` but **no price of their own** — price lives at the tender, lot or
award level. Dividing a multi-item lot's total by one item's quantity produces
a meaningless number. So the function must refuse to answer when the data does
not support an answer.

**Files:**
- Create: `src/analysis/unit-price.ts`
- Test: `tests/unit-price.test.ts`

**Interfaces:**
- Consumes: `TenderRow`, `TenderItemRow`, `AwardRow` from `src/store/types.ts`.
- Produces: `unitPrice(input: UnitPriceInput): UnitPriceResult` where
  - `type UnitPriceInput = { tender: TenderRow; items: TenderItemRow[]; awards: AwardRow[] }`
  - `type UnitPriceResult = { computable: false; reason: string } | { computable: true; item: TenderItemRow; price: number; basis: "award" | "expected"; quantity: number }`

  Rules, in order: the tender must have exactly one item (otherwise not
  computable — we cannot attribute a total across different goods); that item's
  quantity must be a positive number; the amount is the first active award's
  amount when one exists, otherwise the tender's expected value; the amount must
  be a positive number. `basis` records which amount was used, because an award
  is what was actually paid and an expected value is only what was asked for.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit-price.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { unitPrice } from "../src/analysis/unit-price.ts";
import type { TenderRow, TenderItemRow, AwardRow } from "../src/store/types.ts";

function tender(amount: number | null): TenderRow {
  return {
    id: "t1", tender_id: "UA-t1", title: "x", description: null, status: "active",
    method: null, value_amount: amount, currency: "UAH", date: null,
    entity_edrpou: null, entity_name: null, region: "Харківська область",
    locality: null, raw: {},
  };
}
function item(quantity: number | null, id = "i1"): TenderItemRow {
  return {
    tender_id: "t1", item_id: id, description: "холодильник", cpv_code: "39711130-9",
    cpv_name: null, quantity, unit_code: "H87", unit_name: "штуки", lot_id: null,
  };
}
function award(amount: number, status = "active"): AwardRow {
  return { tender_id: "t1", award_id: "a1", supplier_edrpou: "1", supplier_name: "ТОВ", amount, status, date: null };
}

test("divides the expected value by the quantity when there is no award", () => {
  const out = unitPrice({ tender: tender(4_000_000), items: [item(200)], awards: [] });
  assert.equal(out.computable, true);
  if (!out.computable) return;
  assert.equal(out.price, 20_000);
  assert.equal(out.basis, "expected");
  assert.equal(out.quantity, 200);
});

test("prefers the award amount, because that is what was actually paid", () => {
  const out = unitPrice({ tender: tender(4_000_000), items: [item(200)], awards: [award(3_000_000)] });
  assert.equal(out.computable, true);
  if (!out.computable) return;
  assert.equal(out.price, 15_000);
  assert.equal(out.basis, "award");
});

test("ignores a cancelled award and falls back to the expected value", () => {
  const out = unitPrice({ tender: tender(4_000_000), items: [item(200)], awards: [award(3_000_000, "cancelled")] });
  assert.equal(out.computable, true);
  if (!out.computable) return;
  assert.equal(out.basis, "expected");
});

test("refuses a tender with more than one item", () => {
  const out = unitPrice({ tender: tender(4_000_000), items: [item(200), item(5, "i2")], awards: [] });
  assert.equal(out.computable, false);
  if (out.computable) return;
  assert.match(out.reason, /more than one item/i);
});

test("refuses a tender with no items", () => {
  const out = unitPrice({ tender: tender(4_000_000), items: [], awards: [] });
  assert.equal(out.computable, false);
});

test("refuses a zero or missing quantity", () => {
  assert.equal(unitPrice({ tender: tender(1000), items: [item(0)], awards: [] }).computable, false);
  assert.equal(unitPrice({ tender: tender(1000), items: [item(null)], awards: [] }).computable, false);
});

test("refuses a missing or zero amount", () => {
  assert.equal(unitPrice({ tender: tender(null), items: [item(10)], awards: [] }).computable, false);
  assert.equal(unitPrice({ tender: tender(0), items: [item(10)], awards: [] }).computable, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/unit-price.test.ts`
Expected: FAIL — cannot find module `../src/analysis/unit-price.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/analysis/unit-price.ts
import type { TenderRow, TenderItemRow, AwardRow } from "../store/types.ts";

export type UnitPriceInput = {
  tender: TenderRow;
  items: TenderItemRow[];
  awards: AwardRow[];
};

export type UnitPriceResult =
  | { computable: false; reason: string }
  | { computable: true; item: TenderItemRow; price: number; basis: "award" | "expected"; quantity: number };

const ACTIVE_AWARD_STATUSES = new Set(["active", "pending"]);

/**
 * Works out the price of one unit.
 *
 * Tender items carry a quantity but no price of their own, so the only
 * defensible division is a single-item tender's total by that item's quantity.
 * Anything else would attribute one total across different goods, so we
 * decline rather than guess.
 */
export function unitPrice(input: UnitPriceInput): UnitPriceResult {
  const { tender, items, awards } = input;

  if (items.length === 0) return { computable: false, reason: "the tender has no items" };
  if (items.length > 1) {
    return { computable: false, reason: "the tender has more than one item, so a total cannot be attributed to one of them" };
  }

  const item = items[0];
  const quantity = item.quantity;
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return { computable: false, reason: "the item has no positive quantity" };
  }

  const activeAward = awards.find((a) => a.status !== null && ACTIVE_AWARD_STATUSES.has(a.status) && a.amount !== null && a.amount > 0);
  const amount = activeAward?.amount ?? tender.value_amount;
  const basis: "award" | "expected" = activeAward ? "award" : "expected";

  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return { computable: false, reason: "the tender has no positive amount" };
  }

  return { computable: true, item, price: amount / quantity, basis, quantity };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/unit-price.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/analysis/unit-price.ts tests/unit-price.test.ts
git commit -m "feat: per-unit price that declines when data does not support it"
```

---

### Task 9: Catalogue source, normalizer, and the catalog_gap detector

**Files:**
- Create: `src/sources/market.ts`
- Create: `src/normalize/product.ts`
- Create: `src/analysis/catalog-gap.ts`
- Test: `tests/catalog-gap.test.ts`

**Interfaces:**
- Consumes: `getJson`, `HttpOptions`; `CatalogPriceRow`, `FindingRow`, `TenderRow`, `TenderItemRow`, `AwardRow` from `src/store/types.ts`; `unitPrice` from `src/analysis/unit-price.ts`.
- Produces:
  - `src/sources/market.ts`: `fetchProductPage(url: string | null, opts?): Promise<{ data: { id: string }[]; nextUri: string }>`, `fetchProduct(id, opts?): Promise<RawProduct>`, `fetchOfferPage(url: string | null, opts?)`, `fetchOffer(id, opts?): Promise<RawOffer>`, `PRODUCT_START`, `OFFER_START`.
  - `src/normalize/product.ts`: `normalizeCatalogPrice(product: RawProduct, offer: RawOffer, fetchedAt: string): CatalogPriceRow`.
  - `src/analysis/catalog-gap.ts`: `catalogMedians(rows: CatalogPriceRow[]): Map<string, number>` and `detectCatalogGap(input: CatalogGapInput): FindingRow | null` where `type CatalogGapInput = { tender: TenderRow; items: TenderItemRow[]; awards: AwardRow[]; medians: Map<string, number>; now: string }`.

  Detector rules: skip when the unit price is not computable; skip when the item has no CPV code or the CPV is absent from `medians`; compute `ratio = price / median`; emit nothing below `1.3`; severity is `low` below `2`, `medium` below `3`, `high` at `3` and above. `tier` is always `own_analysis`. `evidence` carries `{ unit_price, catalog_median, ratio, quantity, basis, cpv_code, overpayment }` where `overpayment = (price − median) × quantity`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/catalog-gap.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeCatalogPrice } from "../src/normalize/product.ts";
import { catalogMedians, detectCatalogGap } from "../src/analysis/catalog-gap.ts";
import type { TenderRow, TenderItemRow, CatalogPriceRow } from "../src/store/types.ts";

const DIR = join(import.meta.dirname, "fixtures");
const product = JSON.parse(readFileSync(join(DIR, "market-product.json"), "utf8")).data;
const offer = JSON.parse(readFileSync(join(DIR, "market-offer.json"), "utf8")).data;

function price(cpv: string, amount: number, offerId: string): CatalogPriceRow {
  return {
    product_id: "p", title: "t", cpv_code: cpv, offer_id: offerId,
    offer_price: amount, currency: "UAH", vat_included: true, fetched_at: "2026-08-20T00:00:00Z",
  };
}
function tender(amount: number): TenderRow {
  return {
    id: "t1", tender_id: "UA-t1", title: "холодильники", description: null, status: "active",
    method: null, value_amount: amount, currency: "UAH", date: null,
    entity_edrpou: "123", entity_name: "КП", region: "Харківська область", locality: null, raw: {},
  };
}
function item(quantity: number, cpv: string | null): TenderItemRow {
  return {
    tender_id: "t1", item_id: "i1", description: "холодильник", cpv_code: cpv,
    cpv_name: null, quantity, unit_code: "H87", unit_name: "штуки", lot_id: null,
  };
}

test("maps a real catalogue product and offer into a price row", () => {
  const row = normalizeCatalogPrice(product, offer, "2026-08-20T00:00:00Z");
  assert.equal(row.product_id, product.id);
  assert.equal(row.offer_id, offer.id);
  assert.equal(row.cpv_code, product.classification?.id ?? null);
  assert.equal(row.offer_price, offer.value?.amount ?? null);
});

test("takes the median of the catalogue prices per CPV", () => {
  const medians = catalogMedians([price("A", 10, "1"), price("A", 20, "2"), price("A", 90, "3"), price("B", 5, "4")]);
  assert.equal(medians.get("A"), 20);
  assert.equal(medians.get("B"), 5);
});

test("averages the two middle prices when the count is even", () => {
  const medians = catalogMedians([price("A", 10, "1"), price("A", 20, "2")]);
  assert.equal(medians.get("A"), 15);
});

test("ignores rows with no price or no CPV", () => {
  const rows = [price("A", 10, "1"), { ...price("A", 0, "2"), offer_price: null }, { ...price("A", 30, "3"), cpv_code: null }];
  const medians = catalogMedians(rows);
  assert.equal(medians.get("A"), 10);
});

test("emits a finding with the arithmetic when the price is well above the catalogue", () => {
  const medians = new Map([["39711130-9", 12_000]]);
  const finding = detectCatalogGap({
    tender: tender(4_000_000), items: [item(200, "39711130-9")], awards: [], medians, now: "2026-08-20T00:00:00Z",
  });
  assert.ok(finding);
  assert.equal(finding.detector_key, "catalog_gap");
  assert.equal(finding.tier, "own_analysis");
  assert.equal(finding.severity, "low");
  const evidence = finding.evidence as Record<string, number | string>;
  assert.equal(evidence.unit_price, 20_000);
  assert.equal(evidence.catalog_median, 12_000);
  assert.equal(evidence.overpayment, 1_600_000);
});

test("grades severity by how far above the catalogue the price sits", () => {
  const medians = new Map([["C", 100]]);
  const at = (amount: number) =>
    detectCatalogGap({ tender: tender(amount), items: [item(1, "C")], awards: [], medians, now: "n" });
  assert.equal(at(129)?.severity, undefined);
  assert.equal(at(150)?.severity, "low");
  assert.equal(at(250)?.severity, "medium");
  assert.equal(at(400)?.severity, "high");
});

test("stays silent when there is nothing to compare against", () => {
  const medians = new Map([["C", 100]]);
  assert.equal(detectCatalogGap({ tender: tender(1000), items: [item(1, null)], awards: [], medians, now: "n" }), null);
  assert.equal(detectCatalogGap({ tender: tender(1000), items: [item(1, "UNKNOWN")], awards: [], medians, now: "n" }), null);
  assert.equal(detectCatalogGap({ tender: tender(1000), items: [], awards: [], medians, now: "n" }), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/catalog-gap.test.ts`
Expected: FAIL — cannot find module `../src/normalize/product.ts`.

- [ ] **Step 3: Write `src/sources/market.ts`**

```ts
// src/sources/market.ts
import { getJson, type HttpOptions } from "./http.ts";

const BASE = "https://market-api.prozorro.gov.ua/api";

export const PRODUCT_START = `${BASE}/products?limit=100`;
export const OFFER_START = `${BASE}/offers?limit=100`;

export type RawProduct = {
  id: string;
  title?: string;
  status?: string;
  classification?: { id?: string; description?: string; scheme?: string };
  relatedCategory?: string;
};

export type RawOffer = {
  id: string;
  status?: string;
  relatedProduct?: string;
  value?: { amount?: number; currency?: string; valueAddedTaxIncluded?: boolean };
};

type Page = { data: { id: string }[]; next_page: { uri: string } };

export async function fetchProductPage(url: string | null, opts?: HttpOptions): Promise<{ data: { id: string }[]; nextUri: string }> {
  const body = await getJson<Page>(url ?? PRODUCT_START, opts);
  return { data: body.data, nextUri: body.next_page.uri };
}

export async function fetchProduct(id: string, opts?: HttpOptions): Promise<RawProduct> {
  return (await getJson<{ data: RawProduct }>(`${BASE}/products/${id}`, opts)).data;
}

export async function fetchOfferPage(url: string | null, opts?: HttpOptions): Promise<{ data: { id: string }[]; nextUri: string }> {
  const body = await getJson<Page>(url ?? OFFER_START, opts);
  return { data: body.data, nextUri: body.next_page.uri };
}

export async function fetchOffer(id: string, opts?: HttpOptions): Promise<RawOffer> {
  return (await getJson<{ data: RawOffer }>(`${BASE}/offers/${id}`, opts)).data;
}
```

- [ ] **Step 4: Write `src/normalize/product.ts`**

```ts
// src/normalize/product.ts
import type { RawProduct, RawOffer } from "../sources/market.ts";
import type { CatalogPriceRow } from "../store/types.ts";

/** Joins a catalogue product with one of its offers into a price row. */
export function normalizeCatalogPrice(product: RawProduct, offer: RawOffer, fetchedAt: string): CatalogPriceRow {
  return {
    product_id: product.id,
    title: product.title ?? null,
    cpv_code: product.classification?.id ?? null,
    offer_id: offer.id,
    offer_price: typeof offer.value?.amount === "number" ? offer.value.amount : null,
    currency: offer.value?.currency ?? null,
    vat_included: typeof offer.value?.valueAddedTaxIncluded === "boolean" ? offer.value.valueAddedTaxIncluded : null,
    fetched_at: fetchedAt,
  };
}
```

- [ ] **Step 5: Write `src/analysis/catalog-gap.ts`**

```ts
// src/analysis/catalog-gap.ts
import { unitPrice } from "./unit-price.ts";
import type { CatalogPriceRow, FindingRow, TenderRow, TenderItemRow, AwardRow } from "../store/types.ts";

const MIN_RATIO = 1.3;
const MEDIUM_RATIO = 2;
const HIGH_RATIO = 3;

/** Median catalogue price per CPV code. */
export function catalogMedians(rows: CatalogPriceRow[]): Map<string, number> {
  const byCpv = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.cpv_code) continue;
    if (row.offer_price === null || !Number.isFinite(row.offer_price) || row.offer_price <= 0) continue;
    const list = byCpv.get(row.cpv_code) ?? [];
    list.push(row.offer_price);
    byCpv.set(row.cpv_code, list);
  }

  const medians = new Map<string, number>();
  for (const [cpv, prices] of byCpv) {
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    medians.set(cpv, prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2);
  }
  return medians;
}

export type CatalogGapInput = {
  tender: TenderRow;
  items: TenderItemRow[];
  awards: AwardRow[];
  medians: Map<string, number>;
  now: string;
};

function severityFor(ratio: number): "low" | "medium" | "high" {
  if (ratio >= HIGH_RATIO) return "high";
  if (ratio >= MEDIUM_RATIO) return "medium";
  return "low";
}

/**
 * Compares the price of one unit against the state catalogue.
 * Returns null whenever the comparison cannot be made honestly.
 */
export function detectCatalogGap(input: CatalogGapInput): FindingRow | null {
  const { tender, items, awards, medians, now } = input;

  const priced = unitPrice({ tender, items, awards });
  if (!priced.computable) return null;

  const cpv = priced.item.cpv_code;
  if (!cpv) return null;

  const median = medians.get(cpv);
  if (median === undefined || median <= 0) return null;

  const ratio = priced.price / median;
  if (ratio < MIN_RATIO) return null;

  const overpayment = (priced.price - median) * priced.quantity;
  const times = ratio.toFixed(1);

  return {
    tender_id: tender.id,
    detector_key: "catalog_gap",
    tier: "own_analysis",
    severity: severityFor(ratio),
    title: `Ціна за одиницю вища за каталожну у ${times} раза`,
    explanation:
      `Ціна за одиницю — ${priced.price.toFixed(2)} грн, ` +
      `медіанна каталожна ціна за кодом ${cpv} — ${median.toFixed(2)} грн. ` +
      `Кількість — ${priced.quantity}. Різниця на всю закупівлю — ${overpayment.toFixed(2)} грн. ` +
      `Розрахунок зроблено від ${priced.basis === "award" ? "суми договору" : "очікуваної вартості"}. ` +
      `Це ознака ризику, що потребує перевірки.`,
    evidence: {
      unit_price: priced.price,
      catalog_median: median,
      ratio,
      quantity: priced.quantity,
      basis: priced.basis,
      cpv_code: cpv,
      overpayment,
    },
    created_at: now,
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tests/catalog-gap.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add src/sources/market.ts src/normalize/product.ts src/analysis/catalog-gap.ts tests/catalog-gap.test.ts
git commit -m "feat: catalogue prices and the catalog_gap detector"
```

---

### Task 10: Monitoring source and normalizer

**Files:**
- Create: `src/sources/audit.ts`
- Create: `src/normalize/monitoring.ts`
- Test: `tests/monitoring.test.ts`

**Interfaces:**
- Consumes: `getJson`, `HttpOptions`; `MonitoringRow` from `src/store/types.ts`.
- Produces:
  - `src/sources/audit.ts`: `fetchMonitoringFeedPage(url: string | null, opts?): Promise<{ data: { id: string; dateModified: string }[]; nextUri: string }>`, `fetchMonitoring(id, opts?): Promise<RawMonitoring>`, `MONITORING_START`.
  - `src/normalize/monitoring.ts`: `normalizeMonitoring(raw: RawMonitoring): MonitoringRow`, `hasViolation(row: MonitoringRow): boolean`.

  `hasViolation` returns true only when the conclusion carries a non-empty
  `violationType` array. That is the only signal that separates a completed
  monitoring that found something from one that did not.

- [ ] **Step 1: Write the failing test**

```ts
// tests/monitoring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeMonitoring, hasViolation } from "../src/normalize/monitoring.ts";

const raw = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "monitoring-detail.json"), "utf8")).data;

test("maps the real monitoring fixture", () => {
  const row = normalizeMonitoring(raw);
  assert.equal(row.monitoring_id, raw.id);
  assert.equal(row.tender_id, raw.tender_id);
  assert.equal(row.status, raw.status);
  assert.equal(typeof row.decision_text, raw.decision?.description ? "string" : "object");
});

test("a monitoring with no conclusion is not a violation", () => {
  const row = normalizeMonitoring({ id: "m", tender_id: "t", status: "active" } as never);
  assert.equal(hasViolation(row), false);
});

test("an empty violationType array is not a violation", () => {
  const row = normalizeMonitoring({ id: "m", tender_id: "t", status: "completed", conclusion: { violationType: [] } } as never);
  assert.equal(hasViolation(row), false);
});

test("a populated violationType array is a violation", () => {
  const row = normalizeMonitoring({ id: "m", tender_id: "t", status: "completed", conclusion: { violationType: ["other"] } } as never);
  assert.equal(hasViolation(row), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/monitoring.test.ts`
Expected: FAIL — cannot find module `../src/normalize/monitoring.ts`.

- [ ] **Step 3: Write `src/sources/audit.ts`**

```ts
// src/sources/audit.ts
import { getJson, type HttpOptions } from "./http.ts";

const BASE = "https://audit-api.prozorro.gov.ua/api/2.5";

export const MONITORING_START = `${BASE}/monitorings?limit=100`;

export type RawMonitoring = {
  id: string;
  tender_id: string;
  status: string;
  dateCreated?: string;
  dateModified?: string;
  decision?: { description?: string };
  reasons?: unknown;
  conclusion?: { violationType?: string[]; description?: string };
};

export async function fetchMonitoringFeedPage(
  url: string | null,
  opts?: HttpOptions,
): Promise<{ data: { id: string; dateModified: string }[]; nextUri: string }> {
  const body = await getJson<{ data: { id: string; dateModified: string }[]; next_page: { uri: string } }>(
    url ?? MONITORING_START,
    opts,
  );
  return { data: body.data, nextUri: body.next_page.uri };
}

export async function fetchMonitoring(id: string, opts?: HttpOptions): Promise<RawMonitoring> {
  return (await getJson<{ data: RawMonitoring }>(`${BASE}/monitorings/${id}`, opts)).data;
}
```

- [ ] **Step 4: Write `src/normalize/monitoring.ts`**

```ts
// src/normalize/monitoring.ts
import type { RawMonitoring } from "../sources/audit.ts";
import type { MonitoringRow } from "../store/types.ts";

export function normalizeMonitoring(raw: RawMonitoring): MonitoringRow {
  return {
    monitoring_id: raw.id,
    tender_id: raw.tender_id,
    status: raw.status,
    decision_text: raw.decision?.description ?? null,
    reasons: raw.reasons ?? null,
    conclusion: raw.conclusion ?? null,
    date_created: raw.dateCreated ?? null,
    date_modified: raw.dateModified ?? null,
  };
}

/**
 * True only when the auditors recorded a violation type.
 * This is what separates the "confirmed" tier from everything else,
 * so it must not be inferred from status alone.
 */
export function hasViolation(row: MonitoringRow): boolean {
  const conclusion = row.conclusion as { violationType?: unknown } | null;
  const types = conclusion?.violationType;
  return Array.isArray(types) && types.length > 0;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/monitoring.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/sources/audit.ts src/normalize/monitoring.ts tests/monitoring.test.ts
git commit -m "feat: audit monitoring source and normalizer"
```

---

### Task 11: Database schema

**Files:**
- Create: `db/001_schema.sql`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consumes: the row types from `src/store/types.ts` — column names must match the TypeScript field names exactly.
- Produces: a `.sql` file that runs unmodified in the Supabase SQL editor.

- [ ] **Step 1: Write the failing test**

The test guards the one thing that silently breaks later: a column name in SQL
drifting from a field name in TypeScript.

```ts
// tests/schema.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(import.meta.dirname, "..", "db", "001_schema.sql"), "utf8");

/** Pulls the column names out of one CREATE TABLE block. */
function columnsOf(table: string): string[] {
  const match = sql.match(new RegExp(`create table if not exists ${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i"));
  assert.ok(match, `no create table for ${table}`);
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^(primary key|unique|constraint|foreign key)/i.test(line))
    .map((line) => line.split(/\s+/)[0].replace(/,$/, ""));
}

const EXPECTED: Record<string, string[]> = {
  tenders: ["id", "tender_id", "title", "description", "status", "method", "value_amount", "currency", "date", "entity_edrpou", "entity_name", "region", "locality", "raw"],
  tender_items: ["tender_id", "item_id", "description", "cpv_code", "cpv_name", "quantity", "unit_code", "unit_name", "lot_id"],
  bids: ["tender_id", "bid_id", "supplier_edrpou", "supplier_name", "amount", "status"],
  awards: ["tender_id", "award_id", "supplier_edrpou", "supplier_name", "amount", "status", "date"],
  risk_flags: ["tender_id", "tender_ref", "risk_id", "date_assessed", "region", "entity_edrpou", "entity_name", "value_amount"],
  risk_rules: ["risk_id", "name", "description", "legitimateness", "status"],
  monitorings: ["monitoring_id", "tender_id", "status", "decision_text", "reasons", "conclusion", "date_created", "date_modified"],
  catalog_prices: ["product_id", "title", "cpv_code", "offer_id", "offer_price", "currency", "vat_included", "fetched_at"],
  findings: ["tender_id", "detector_key", "tier", "severity", "title", "explanation", "evidence", "created_at"],
  ingest_cursors: ["worker", "cursor", "updated_at"],
};

for (const [table, expected] of Object.entries(EXPECTED)) {
  test(`${table} has exactly the columns the row type declares`, () => {
    assert.deepEqual(columnsOf(table), expected);
  });
}

test("findings.tier is constrained to the three levels", () => {
  assert.match(sql, /tier\s+text\s+not null\s+check \(tier in \('confirmed', 'state_indicator', 'own_analysis'\)\)/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/schema.test.ts`
Expected: FAIL — `ENOENT` for `db/001_schema.sql`.

- [ ] **Step 3: Write the schema**

```sql
-- db/001_schema.sql
-- Tender Radar, stage 1. Runs as-is in the Supabase SQL editor.

create table if not exists tenders (
  id text primary key,
  tender_id text not null,
  title text not null,
  description text,
  status text not null,
  method text,
  value_amount double precision,
  currency text,
  date timestamptz,
  entity_edrpou text,
  entity_name text,
  region text,
  locality text,
  raw jsonb
);

create index if not exists tenders_region_idx on tenders (region);
create index if not exists tenders_entity_idx on tenders (entity_edrpou);

create table if not exists tender_items (
  tender_id text not null references tenders (id) on delete cascade,
  item_id text not null,
  description text,
  cpv_code text,
  cpv_name text,
  quantity double precision,
  unit_code text,
  unit_name text,
  lot_id text,
  primary key (tender_id, item_id)
);

create index if not exists tender_items_cpv_idx on tender_items (cpv_code);

create table if not exists bids (
  tender_id text not null references tenders (id) on delete cascade,
  bid_id text not null,
  supplier_edrpou text,
  supplier_name text,
  amount double precision,
  status text,
  primary key (tender_id, bid_id)
);

create table if not exists awards (
  tender_id text not null references tenders (id) on delete cascade,
  award_id text not null,
  supplier_edrpou text,
  supplier_name text,
  amount double precision,
  status text,
  date timestamptz,
  primary key (tender_id, award_id)
);

create index if not exists awards_supplier_idx on awards (supplier_edrpou);

create table if not exists risk_flags (
  tender_id text not null,
  tender_ref text not null,
  risk_id text not null,
  date_assessed timestamptz,
  region text,
  entity_edrpou text,
  entity_name text,
  value_amount double precision,
  primary key (tender_id, risk_id)
);

create index if not exists risk_flags_region_idx on risk_flags (region);
create index if not exists risk_flags_entity_idx on risk_flags (entity_edrpou);

create table if not exists risk_rules (
  risk_id text primary key,
  name text,
  description text,
  legitimateness text,
  status text
);

create table if not exists monitorings (
  monitoring_id text primary key,
  tender_id text not null,
  status text not null,
  decision_text text,
  reasons jsonb,
  conclusion jsonb,
  date_created timestamptz,
  date_modified timestamptz
);

create index if not exists monitorings_tender_idx on monitorings (tender_id);

create table if not exists catalog_prices (
  product_id text not null,
  title text,
  cpv_code text,
  offer_id text primary key,
  offer_price double precision,
  currency text,
  vat_included boolean,
  fetched_at timestamptz not null
);

create index if not exists catalog_prices_cpv_idx on catalog_prices (cpv_code);

create table if not exists findings (
  tender_id text not null,
  detector_key text not null,
  tier text not null check (tier in ('confirmed', 'state_indicator', 'own_analysis')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  explanation text not null,
  evidence jsonb,
  created_at timestamptz not null,
  primary key (tender_id, detector_key)
);

create index if not exists findings_tier_idx on findings (tier);

create table if not exists ingest_cursors (
  worker text primary key,
  cursor text not null,
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/schema.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add db/001_schema.sql tests/schema.test.ts
git commit -m "feat: database schema with column names locked to row types"
```

---

### Task 12: Ingest scripts and the terminal report

This task wires the pieces into runnable commands and produces the first real
output: findings printed to the terminal from live state data.

**Files:**
- Create: `src/config.ts`
- Create: `scripts/ingest-risks.ts`
- Create: `scripts/ingest-tenders.ts`
- Create: `scripts/ingest-monitorings.ts`
- Create: `scripts/ingest-market.ts`
- Create: `scripts/analyze.ts`
- Create: `scripts/report.ts`
- Modify: `package.json` — add the scripts below
- Test: `tests/config.test.ts`

**Interfaces:**
- Consumes: every module built so far.
- Produces: `src/config.ts` exporting `REGION = "Харківська область"`, `RAILWAY_EDRPOU: Set<string>`, `dataDir(): string` (reads `TR_DATA_DIR`, defaults to `./data`), and `openStore(): Store` (returns `JsonStore` for now).

- [ ] **Step 1: Write the failing test**

```ts
// tests/config.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { REGION, RAILWAY_EDRPOU, dataDir } from "../src/config.ts";

test("the region string matches what the state APIs emit", () => {
  assert.equal(REGION, "Харківська область");
});

test("the Kharkiv railway branch is in the railway set", () => {
  assert.ok(RAILWAY_EDRPOU.has("40081216"), "Південна залізниця must be present");
  assert.ok(RAILWAY_EDRPOU.size >= 6);
});

test("the data directory honours the environment override", () => {
  const previous = process.env.TR_DATA_DIR;
  process.env.TR_DATA_DIR = "/tmp/example";
  assert.equal(dataDir(), "/tmp/example");
  if (previous === undefined) delete process.env.TR_DATA_DIR;
  else process.env.TR_DATA_DIR = previous;
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/config.test.ts`
Expected: FAIL — cannot find module `../src/config.ts`.

- [ ] **Step 3: Write `src/config.ts`**

```ts
// src/config.ts
import { join } from "node:path";
import { JsonStore } from "./store/json-store.ts";
import type { Store } from "./store/types.ts";

/** Exactly the string the state APIs emit. Do not normalise. */
export const REGION = "Харківська область";

/** Branches of AT "Ukrainian Railways" tracked regardless of their region. */
export const RAILWAY_EDRPOU = new Set([
  "40081216", // РФ "Південна залізниця" — the Kharkiv branch
  "40081347", // Філія "Центр забезпечення виробництва"
  "41022900", // Філія "Пасажирська компанія"
  "40123454", // Філія "Центр з ремонту та експлуатації колійних машин"
  "45462724", // Філія "УЗ Вагон-Сервіс"
  "45246390", // Філія "Приміська пасажирська компанія"
]);

export function dataDir(): string {
  return process.env.TR_DATA_DIR ?? join(process.cwd(), "data");
}

export function openStore(): Store {
  return new JsonStore(dataDir());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/config.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write `scripts/ingest-risks.ts`**

```ts
// scripts/ingest-risks.ts
// Downloads every active state risk indicator's export and keeps the
// Kharkiv-oblast rows. One request per indicator: an unfiltered export
// does not complete.
import { listRiskRuleIds, fetchRiskReportCsv, fetchRisksPage } from "../src/sources/risks.ts";
import { normalizeRiskReport, filterByRegion, normalizeRiskRules } from "../src/normalize/risk.ts";
import { openStore, REGION } from "../src/config.ts";

const store = openStore();

const ruleIds = await listRiskRuleIds();
console.log(`active indicators: ${ruleIds.length}`);

let kept = 0;
for (const riskId of ruleIds) {
  const csv = await fetchRiskReportCsv(riskId);
  const rows = filterByRegion(normalizeRiskReport(csv), REGION);
  await store.upsertRiskFlags(rows);
  kept += rows.length;
  console.log(`${riskId}: ${rows.length} rows in ${REGION}`);
}

const page = await fetchRisksPage(0);
await store.upsertRiskRules(normalizeRiskRules(page));

console.log(`kept ${kept} risk flags`);
```

- [ ] **Step 6: Write `scripts/ingest-tenders.ts`**

```ts
// scripts/ingest-tenders.ts
// Scans the national feed cheaply, then fetches full cards only for the
// tenders we keep: Kharkiv oblast plus the railway branches.
import { fetchFeedPage, fetchTender } from "../src/sources/openprocurement.ts";
import { normalizeTender, regionOf } from "../src/normalize/tender.ts";
import { openStore, REGION, RAILWAY_EDRPOU } from "../src/config.ts";

const PAGES = Number(process.env.TR_FEED_PAGES ?? 20);
const store = openStore();

let url = await store.getCursor("tenders");
let scanned = 0;
let kept = 0;

for (let page = 0; page < PAGES; page++) {
  const { data, nextUri } = await fetchFeedPage(url);
  if (data.length === 0) break;

  for (const entry of data) {
    scanned++;
    const edrpou = entry.procuringEntity?.identifier?.id ?? "";
    if (regionOf(entry) !== REGION && !RAILWAY_EDRPOU.has(edrpou)) continue;

    const raw = await fetchTender(entry.id);
    const { tender, items, bids, awards } = normalizeTender(raw);
    await store.upsertTenders([tender]);
    await store.upsertTenderItems(items);
    await store.upsertBids(bids);
    await store.upsertAwards(awards);
    kept++;
  }

  url = nextUri;
  await store.setCursor("tenders", nextUri);
}

console.log(`scanned ${scanned} feed entries, kept ${kept} tenders`);
```

- [ ] **Step 7: Write `scripts/ingest-monitorings.ts`**

```ts
// scripts/ingest-monitorings.ts
// Records state audit monitorings for tenders already in the store.
import { fetchMonitoringFeedPage, fetchMonitoring } from "../src/sources/audit.ts";
import { normalizeMonitoring } from "../src/normalize/monitoring.ts";
import { openStore } from "../src/config.ts";

const PAGES = Number(process.env.TR_MONITORING_PAGES ?? 10);
const store = openStore();

const known = new Set((await store.allTenders()).map((t) => t.id));
let url = await store.getCursor("monitorings");
let kept = 0;

for (let page = 0; page < PAGES; page++) {
  const { data, nextUri } = await fetchMonitoringFeedPage(url);
  if (data.length === 0) break;

  for (const entry of data) {
    const raw = await fetchMonitoring(entry.id);
    if (!known.has(raw.tender_id)) continue;
    await store.upsertMonitorings([normalizeMonitoring(raw)]);
    kept++;
  }

  url = nextUri;
  await store.setCursor("monitorings", nextUri);
}

console.log(`kept ${kept} monitorings for known tenders`);
```

- [ ] **Step 8: Write `scripts/ingest-market.ts`**

```ts
// scripts/ingest-market.ts
// Builds the catalogue price reference: offers carry the price, products
// carry the CPV code, so both are needed.
import { fetchOfferPage, fetchOffer, fetchProduct } from "../src/sources/market.ts";
import { normalizeCatalogPrice } from "../src/normalize/product.ts";
import { openStore } from "../src/config.ts";
import type { RawProduct } from "../src/sources/market.ts";

const PAGES = Number(process.env.TR_MARKET_PAGES ?? 20);
const store = openStore();
const now = new Date().toISOString();
const products = new Map<string, RawProduct>();

let url = await store.getCursor("market");
let kept = 0;

for (let page = 0; page < PAGES; page++) {
  const { data, nextUri } = await fetchOfferPage(url);
  if (data.length === 0) break;

  for (const entry of data) {
    const offer = await fetchOffer(entry.id);
    if (offer.status !== "active" || !offer.relatedProduct) continue;

    let product = products.get(offer.relatedProduct);
    if (!product) {
      product = await fetchProduct(offer.relatedProduct);
      products.set(offer.relatedProduct, product);
    }
    await store.upsertCatalogPrices([normalizeCatalogPrice(product, offer, now)]);
    kept++;
  }

  url = nextUri;
  await store.setCursor("market", nextUri);
}

console.log(`kept ${kept} catalogue prices`);
```

- [ ] **Step 9: Write `scripts/analyze.ts`**

```ts
// scripts/analyze.ts
// Runs the catalog_gap detector over everything in the store.
import { catalogMedians, detectCatalogGap } from "../src/analysis/catalog-gap.ts";
import { openStore } from "../src/config.ts";

const store = openStore();
const now = new Date().toISOString();

const medians = catalogMedians(await store.allCatalogPrices());
console.log(`catalogue medians for ${medians.size} CPV codes`);

const items = await store.allTenderItems();
const awards = await store.allAwards();
const byTender = new Map<string, typeof items>();
for (const item of items) {
  const list = byTender.get(item.tender_id) ?? [];
  list.push(item);
  byTender.set(item.tender_id, list);
}

let found = 0;
for (const tender of await store.allTenders()) {
  const finding = detectCatalogGap({
    tender,
    items: byTender.get(tender.id) ?? [],
    awards: awards.filter((a) => a.tender_id === tender.id),
    medians,
    now,
  });
  if (!finding) continue;
  await store.upsertFindings([finding]);
  found++;
}

console.log(`wrote ${found} findings`);
```

- [ ] **Step 10: Write `scripts/report.ts`**

```ts
// scripts/report.ts
// Prints what is in the store, so the pipeline can be judged without a UI.
import { openStore, REGION } from "../src/config.ts";

const store = openStore();

const tenders = await store.allTenders();
const findings = await store.allFindings();

console.log(`region: ${REGION}`);
console.log(`tenders stored: ${tenders.length}`);
console.log(`findings: ${findings.length}`);
console.log("");

const order = { high: 0, medium: 1, low: 2 } as const;
for (const finding of [...findings].sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 20)) {
  const tender = tenders.find((t) => t.id === finding.tender_id);
  console.log(`[${finding.severity.toUpperCase()}] ${finding.title}`);
  console.log(`  ${tender?.tender_id ?? finding.tender_id} — ${tender?.entity_name ?? "?"}`);
  console.log(`  ${finding.explanation}`);
  console.log(`  https://prozorro.gov.ua/tender/${tender?.tender_id ?? ""}`);
  console.log("");
}
```

- [ ] **Step 11: Add the scripts to `package.json`**

Replace the `"scripts"` block with:

```json
  "scripts": {
    "test": "node --test tests/",
    "capture-fixtures": "node scripts/capture-fixtures.ts",
    "ingest:risks": "node scripts/ingest-risks.ts",
    "ingest:tenders": "node scripts/ingest-tenders.ts",
    "ingest:monitorings": "node scripts/ingest-monitorings.ts",
    "ingest:market": "node scripts/ingest-market.ts",
    "analyze": "node scripts/analyze.ts",
    "report": "node scripts/report.ts"
  },
```

- [ ] **Step 12: Run the full test suite**

Run: `npm test`
Expected: PASS, all tests across every file.

- [ ] **Step 13: Run the pipeline against live data**

```bash
npm run ingest:risks
npm run ingest:tenders
npm run ingest:market
npm run analyze
npm run report
```

Expected: `ingest:risks` prints one line per indicator and a total in the
thousands; `ingest:tenders` reports scanned and kept counts with kept > 0;
`ingest:market` reports kept catalogue prices; `analyze` prints how many CPV
codes have medians and how many findings were written; `report` prints the
stored counts and any findings.

A run that finds zero price gaps is a legitimate outcome, not a failure —
the detector stays silent whenever the comparison cannot be made honestly.
What must not happen is a crash or a finding without evidence numbers.

- [ ] **Step 14: Commit**

```bash
git add src/config.ts scripts/ package.json tests/config.test.ts
git commit -m "feat: ingest scripts, detector run and terminal report"
```

---

### Task 13: Supabase adapter

Wired last because it is the only part that needs credentials. Everything
above already works without it.

**Files:**
- Create: `src/store/supabase-store.ts`
- Modify: `src/config.ts` — `openStore()` picks the adapter from the environment
- Test: `tests/supabase-store.test.ts`

**Interfaces:**
- Consumes: `Store` and the row types.
- Produces: `class SupabaseStore implements Store`, constructed as `new SupabaseStore(url: string, serviceKey: string)`. Writes go to `${url}/rest/v1/${table}` with `Prefer: resolution=merge-duplicates` so upserts collapse on the primary key. Reads use `select=*` with `Range` paging at 1000 rows.
- `openStore()` returns `SupabaseStore` when both `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set, otherwise `JsonStore`.

- [ ] **Step 1: Write the failing test**

The test runs a local `node:http` server standing in for PostgREST — no
credentials and no network required.

```ts
// tests/supabase-store.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { SupabaseStore } from "../src/store/supabase-store.ts";
import type { TenderRow } from "../src/store/types.ts";

type Captured = { method: string; url: string; headers: IncomingMessage["headers"]; body: string };

async function serve(respond: () => string) {
  const captured: Captured[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      captured.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers, body });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(respond());
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    captured,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const row: TenderRow = {
  id: "t1", tender_id: "UA-t1", title: "x", description: null, status: "active",
  method: null, value_amount: 1, currency: "UAH", date: null, entity_edrpou: null,
  entity_name: null, region: "Харківська область", locality: null, raw: {},
};

test("posts rows to the table endpoint as an upsert", async () => {
  const s = await serve(() => "[]");
  await new SupabaseStore(s.url, "service-key").upsertTenders([row]);
  assert.equal(s.captured.length, 1);
  const call = s.captured[0];
  assert.equal(call.method, "POST");
  assert.equal(call.url, "/rest/v1/tenders");
  assert.match(String(call.headers["prefer"]), /merge-duplicates/);
  assert.equal(call.headers["apikey"], "service-key");
  assert.deepEqual(JSON.parse(call.body), [row]);
  await s.close();
});

test("an empty batch makes no request", async () => {
  const s = await serve(() => "[]");
  await new SupabaseStore(s.url, "k").upsertTenders([]);
  assert.equal(s.captured.length, 0);
  await s.close();
});

test("reads rows back with a select", async () => {
  const s = await serve(() => JSON.stringify([row]));
  const rows = await new SupabaseStore(s.url, "k").allTenders();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "t1");
  assert.match(s.captured[0].url, /^\/rest\/v1\/tenders\?select=\*/);
  await s.close();
});

test("reads a cursor from the cursor table", async () => {
  const s = await serve(() => JSON.stringify([{ worker: "tenders", cursor: "offset-1" }]));
  const store = new SupabaseStore(s.url, "k");
  assert.equal(await store.getCursor("tenders"), "offset-1");
  await s.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/supabase-store.test.ts`
Expected: FAIL — cannot find module `../src/store/supabase-store.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/store/supabase-store.ts
import type {
  Store, TenderRow, TenderItemRow, BidRow, AwardRow, RiskFlagRow,
  RiskRuleRow, MonitoringRow, CatalogPriceRow, FindingRow,
} from "./types.ts";

const PAGE = 1000;

/** PostgREST-backed Store. No client library — plain fetch against the REST endpoint. */
export class SupabaseStore implements Store {
  #url: string;
  #key: string;

  constructor(url: string, serviceKey: string) {
    this.#url = url.replace(/\/$/, "");
    this.#key = serviceKey;
  }

  #headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.#key,
      authorization: `Bearer ${this.#key}`,
      "content-type": "application/json",
      ...extra,
    };
  }

  async #upsert<T>(table: string, rows: T[]): Promise<void> {
    if (rows.length === 0) return;
    for (let i = 0; i < rows.length; i += PAGE) {
      const batch = rows.slice(i, i + PAGE);
      const res = await fetch(`${this.#url}/rest/v1/${table}`, {
        method: "POST",
        headers: this.#headers({ prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(`upsert into ${table} failed: ${res.status} ${await res.text()}`);
    }
  }

  async #all<T>(table: string): Promise<T[]> {
    const out: T[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const res = await fetch(`${this.#url}/rest/v1/${table}?select=*`, {
        headers: this.#headers({ range: `${offset}-${offset + PAGE - 1}` }),
      });
      if (!res.ok) throw new Error(`select from ${table} failed: ${res.status} ${await res.text()}`);
      const batch = (await res.json()) as T[];
      out.push(...batch);
      if (batch.length < PAGE) return out;
    }
  }

  upsertTenders(rows: TenderRow[]) { return this.#upsert("tenders", rows); }
  upsertTenderItems(rows: TenderItemRow[]) { return this.#upsert("tender_items", rows); }
  upsertBids(rows: BidRow[]) { return this.#upsert("bids", rows); }
  upsertAwards(rows: AwardRow[]) { return this.#upsert("awards", rows); }
  upsertRiskFlags(rows: RiskFlagRow[]) { return this.#upsert("risk_flags", rows); }
  upsertRiskRules(rows: RiskRuleRow[]) { return this.#upsert("risk_rules", rows); }
  upsertMonitorings(rows: MonitoringRow[]) { return this.#upsert("monitorings", rows); }
  upsertCatalogPrices(rows: CatalogPriceRow[]) { return this.#upsert("catalog_prices", rows); }
  upsertFindings(rows: FindingRow[]) { return this.#upsert("findings", rows); }

  allTenders() { return this.#all<TenderRow>("tenders"); }
  allTenderItems() { return this.#all<TenderItemRow>("tender_items"); }
  allAwards() { return this.#all<AwardRow>("awards"); }
  allCatalogPrices() { return this.#all<CatalogPriceRow>("catalog_prices"); }
  allFindings() { return this.#all<FindingRow>("findings"); }

  async getCursor(worker: string): Promise<string | null> {
    const res = await fetch(
      `${this.#url}/rest/v1/ingest_cursors?select=cursor&worker=eq.${encodeURIComponent(worker)}`,
      { headers: this.#headers() },
    );
    if (!res.ok) throw new Error(`cursor read failed: ${res.status}`);
    const rows = (await res.json()) as { cursor: string }[];
    return rows[0]?.cursor ?? null;
  }

  async setCursor(worker: string, cursor: string): Promise<void> {
    const res = await fetch(`${this.#url}/rest/v1/ingest_cursors`, {
      method: "POST",
      headers: this.#headers({ prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify([{ worker, cursor, updated_at: new Date().toISOString() }]),
    });
    if (!res.ok) throw new Error(`cursor write failed: ${res.status} ${await res.text()}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/supabase-store.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Switch `openStore()` to pick the adapter**

Replace the `openStore` function in `src/config.ts` with:

```ts
export function openStore(): Store {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) return new SupabaseStore(url, key);
  return new JsonStore(dataDir());
}
```

and add the import at the top of the file:

```ts
import { SupabaseStore } from "./store/supabase-store.ts";
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, every test across every file.

- [ ] **Step 7: Commit**

```bash
git add src/store/supabase-store.ts src/config.ts tests/supabase-store.test.ts
git commit -m "feat: Supabase adapter selected by environment"
```

---

## Out of scope for this plan

These belong to later plans and must not be attempted here.

- **Web interface.** The Next.js pages are a separate plan; this one ends at a terminal report.
- **ЄДР founders ingest.** The 327 MB `UO.zip` needs streaming extraction and its own plan; supplier dossiers depend on it.
- **National price medians.** Requires the accumulated national corpus described in stage 2 of the spec.
- **The remaining detectors** — `single_bidder`, `threshold_split`, `cosmetic_discount`, `new_supplier_big_win`, `repeat_pair`, `contract_inflation`.
- **Court decisions register.** Stage 3.

## Spec coverage check

| Spec requirement | Task |
|---|---|
| State risk indicators, filtered to Kharkiv | 6, 12 |
| Risk indicator legal basis (`legitimateness`) | 6 |
| Audit monitorings, confirmed-violation signal | 10 |
| Catalogue reference prices | 9, 12 |
| Tender cards with items, bids, awards | 7, 12 |
| Railway branch EDRPOU tracking | 12 |
| Per-unit price | 8 |
| `catalog_gap` detector | 9 |
| Three-tier finding model | 4, 9, 11 |
| Resumable ingest cursors | 5, 12, 13 |
| Postgres schema for Supabase | 11 |
| Supabase persistence | 13 |
