# ТендоScope (repo `tender-radar`) — agent briefing

Read fully before changing anything. Facts below were verified on 2026-11-04
against the repository, GitHub and production, then cross-checked by a second
agent against the code (six corrections applied). When the project changes,
update this file in the same commit. Talk to the owner in Russian.
Site UI and data labels are Ukrainian.

## What it is

A public-procurement risk radar for Ukraine. It ingests Prozorro tenders and the
state's own risk indicators (DOZORRO/ДАСУ monitoring), runs its own price and
document checks, and renders a server-side website plus a daily Telegram digest.
Formerly "Tender Radar"; renamed **ТендоScope** on 2026-10-18 (identity "Vydno",
scanning-T monogram). Code identifiers and the repo name still say `tender-radar`.

Principle stated everywhere in the code: the site shows *signals that need a
human check*, never accusations. Three evidence tiers are kept apart and a lower
tier is never presented as a higher one: `confirmed` (ДАСУ established a
violation) › `state_indicator` (a state risk indicator fired) › `own_analysis`
(our price / document comparison). Every page links to the Prozorro source.

## Stack and rules

- TypeScript on **Node 22 native type stripping** (`.ts` imported directly, no
  build step for the server). Tests: `node --test "tests/**/*.test.ts"` (31
  files, 297 tests, all green). `npm run typecheck` = `tsc --noEmit`.
- Server-rendered HTML in `server/`, one `layout()` in `server/html.ts` holding
  ALL site CSS (design tokens in `:root`; dark theme default, light via
  `data-theme="light"`). Separate stylesheets: `server/auth-pages.ts`,
  `server/report.ts` (print report stays light), `server/radar-styles.ts`,
  `server/studio-styles.ts`, `server/review-client.ts`.
- Client-side JavaScript is minimal and progressive: theme toggle (inline, in
  `<head>`), favourites enhancement (`server/favourite-interaction.ts`, forms
  work without it), and the personal review queue (`server/review-client.ts`,
  localStorage only, `<noscript>` fallback). Everything else is CSS: drawers
  are checkbox-driven, folds are `<details>`.
- Runtime dependencies (added Oct 2026, scripts only — the web bundle keeps
  packages external): `pdfjs-dist`, `tesseract.js`, `@napi-rs/canvas`,
  `word-extractor`. Dev: `esbuild`, `typescript`. The server itself still
  needs nothing beyond Node. After `git pull` run `npm ci` or typecheck fails
  on these modules.
- Store: `src/store/json-store.ts` writes JSON files into `data/`
  (git-ignored, the full working store) and `scripts/build-web-data.ts`
  exports the slim `web-data/` (committed, shipped to Vercel via
  `vercel.json includeFiles`). `src/config.ts dataDir()` prefers `data/`,
  falls back to `web-data/`, override with `TR_DATA_DIR`.
- Database for detail cards + Telegram subscribers: **Turso (libSQL) over its
  HTTP pipeline with plain fetch** — `src/store/db.ts`, `cards.ts`,
  `subscribers.ts`. One JSON row per card, Prozorro `raw` stripped. Migrated
  off Supabase (free tier filled) on 2026-09-28. Env `TURSO_DATABASE_URL`,
  `TURSO_AUTH_TOKEN`. **Not yet provisioned** (see Open items).
- Google sign-in gate with an email allowlist: `server/auth.ts`
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`). The
  Telegram webhook route is registered before the gate.

## Layout

```
api-src/handler.ts        Vercel entry; esbuild → api/index.js (COMMITTED, rebuild with `npm run build:api`)
server/router.ts          auth gate, routes, /telegram/webhook, /starred/toggle
server/app.ts             URL → page (async; unknown dossiers answer a real 404)
server/html.ts            layout(), all CSS, MENU, tab bar, canonical/og (needs SITE_URL)
server/navigation.ts      menu groups: Закупівлі/Залізниця/Обране · Моя перевірка/Знайти компанію/Цінові сигнали/Розбіжності · Замовники/Постачальники/Контактні особи · about/indicators/updates
server/pages/*            feed, railway, prices, starred, lookup, article/366, tender, entity, officer, supplier,
                          entities, officers, suppliers, updates, review, static (indicators, about, 404)
server/components/*       case-row, filters (presets, sort bar, filter panel, listBody+pager), directory,
                          risk, verdict, documents, document-prices
server/data.ts            loadDataset(): Case[] from web-data; mergeCardDetail(); byTender map
server/context.ts         dataset(), per-request starred list + current path, perDataset() memo
server/controls.ts        list controls: readControls/applyControls/keepControls/hiddenControls
server/conclusion.ts, qualification.ts, grouping.ts, favourites.ts, report.ts
src/sources/*             openprocurement (feed + tender cards), risks, audit (monitorings), http
src/ingest/tenders.ts     independent scoped feed scan (Kharkiv buyer / Kharkiv delivery / railway), resumable state
src/ingest/market.ts      Prozorro Market benchmark prices
src/normalize/*           tender, risk, monitoring, csv
src/analysis/*            unit-price, peer-price, market-price, document-price, ai-extract (Claude CLI)
src/documents/*           contract document download + text extraction (PDF via pdfjs, OCR via tesseract, DOC/DOCX via word-extractor worker)
src/notify/*              telegram (digest, postMessage), broadcast (pacing, retry_after), webhook (/start, /stop)
scripts/*                 see "Pipelines"
tests/*                   node:test; render.test.ts asserts a distinctive marker per page — update it when you rename an H1
docs/superpowers/*        original specs/plans (Aug 2026): design, frontend refresh, mobile minimal, telegram subscribers, supabase cards
```

## Pipelines

- **`npm run daily`** (`scripts/daily.ts`) — what GitHub Actions runs every day
  (`.github/workflows/daily.yml`, cron 05:20 UTC, **timeout 50 min**; the
  workflow runs typecheck+tests first). Inside `daily.ts`: (0) independent
  public feed scan via `src/ingest/tenders.ts` — `scopeReasons()` keeps
  Kharkiv buyers, Kharkiv delivery addresses and railway organisations, full
  cards go to the JSON store with `store.replaceTenderCards()`, exact source
  bodies to `data/source-versions/` (content-addressed); (1) state risk
  indicators; monitorings; own detectors; (4) `web-data/` export; (5) Telegram
  digest (owner `TELEGRAM_CHAT_ID` always; subscribers/channel when the DB is
  configured — Turso is used here **only for `tg_subscribers`**). The
  **workflow**, not the script, then rebuilds `api/index.js`, commits
  `data: щоденне оновлення YYYY-MM-DD` and uploads `data/source-versions/`
  as an artifact (90 days). Idempotent except the broadcast, which has no
  dedupe — a manual run beside the schedule sends the digest twice.
  **`daily.ts` does not write detail cards to Turso**; only
  `backfill-cards.ts`, `ingest-details.ts` and `migrate-supabase-to-db.ts`
  do, while the tender page reads Turso for any case without a committed card.
- **`npm run scheduled:run`** (`scripts/scheduled-run.ts`) — the LOCAL daily
  pipeline (no Telegram, no git): ingest-tenders → ingest-market → analyze →
  ai-batch → ingest-contract-documents → analyze-documents →
  ingest-document-market → analyze-document-prices → build-web-data. Lock
  file in `data/`, logs in `logs/`, status in `data/scheduled-status.json`.
  Env: `TR_FEED_MAX_PAGES` (500), `TR_AI_BATCH_LIMIT` (10), `TR_CONCURRENCY`.
- **AI extraction** (`src/analysis/ai-extract.ts`, `scripts/ai-extract.ts`,
  `ai-batch.ts`) spawns the local **Claude CLI** (`TR_CLAUDE_BIN` or `claude`)
  with `--output-format json --json-schema …`, tools disabled, hooks
  disabled, no session persistence. Only public item text is sent. Each
  claim must contain an exact verbatim quote found in the source and the
  quote must contain the value; claims are validated **one by one** — the
  valid ones land in `claims`, the rest in `rejected` with a reason, and the
  result is stamped `status: "needs_review"` (a human decides; nothing is
  auto-published). Never let it infer unit prices, VAT or guilt.
- **Documents** (`scripts/ingest-contract-documents.ts`, `analyze-documents.ts`,
  `analyze-document-prices.ts`): download contract documents, extract text
  (PDF/OCR/DOC/DOCX), compare printed prices against sourced Prozorro Market
  benchmarks → `web-data/document-extractions.json`,
  `document-price-checks.json`. Rendered by `server/components/documents.ts`
  and `document-prices.ts`.
- One-off: `npm run backfill:cards` (resumable, Turso), `npm run db:init`,
  `npm run migrate:supabase` (copies old Supabase cards → Turso; workflow
  `migrate.yml`), `backfill.yml` (workflow_dispatch, 6 h limit, re-run to
  continue), `npm run set-webhook`.

## Data scope (as of 2026-11-04)

55 037 risk flags nationwide; 5 498 tenders with full cards (Kharkiv oblast +
railway); last daily run 2026-11-04 ok. `REGION = "Харківська область"` and
the railway ЄДРПОУ set live in `src/config.ts` (`railwayScope()`); do not
loosen the railway name regex — an earlier looser one swept in a power plant
and a poultry station.

## Deployment

- Vercel project `tender-radar` (team `acmeeeeeeeeeeee788`, `.vercel/project.json`
  is git-ignored). `vercel.json` rewrites every route to `api/index.js`
  (prebuilt bundle, so **always run `npm run build:api` and commit
  `api/index.js` after server changes**). `public/` is served by the
  platform before rewrites.
- Production domains: `https://tender-radar-delta.vercel.app` (manual alias,
  moved by CLI deploys) and `https://tender-radar-i7ka.vercel.app` (= GitHub
  var `SITE_URL`, canonical/og base). Both served the current code on
  2026-11-04.
- **Git pushes build on Vercel but are NOT auto-promoted to production.**
  Promote with `npx vercel deploy --prod --yes` from the repo (the CLI cannot
  see git-integration deploys), or enable auto-promotion of `master` in the
  Vercel project's Git settings. Deployment Protection, when on, answers 302
  to non-production deploy URLs.
- Local preview: `npm run serve` (port 3120, `server/serve.ts`, reloads data
  on file change, not code).
- Locally never run `npm run bundle` to rebuild just the code: `build:web`
  regenerates `web-data/` from the stale local `data/` store and dirties the
  files CI owns. Use `npm run build:api`; `git restore web-data/` if touched.

## Secrets and config (GitHub → Settings → Secrets/Variables)

Present: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY` (legacy, needed once by `migrate.yml`), var
`SITE_URL=https://tender-radar-i7ka.vercel.app`.
Missing: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (also needed in Vercel env
for the site to fetch cards; and `SITE_URL` in Vercel env for canonical/og).
Vercel env must also carry the Google auth trio for the sign-in gate and
`TELEGRAM_WEBHOOK_SECRET` — the webhook is fail-closed and answers 401
without it (`server/router.ts handleTelegramWebhook`); `TELEGRAM_BOT_TOKEN`
there too, so /start and /stop get replies.
Never paste or commit credentials; the owner sets them in the dashboards.

## Open items (owner-dependent unless noted)

1. Provision Turso (free 5 GB) and set the two secrets in GitHub + Vercel,
   then run workflow `migrate.yml` once, then `backfill.yml` (resumable, its
   own 6 h limit) so every flagged tender gets a detail card. Open design
   question after that: `daily.ts` ingests cards into the JSON store only,
   so new cards never reach Turso day to day — either `upsertCard` them in
   `src/ingest/tenders.ts` (mind the 50 min daily budget) or re-run the
   backfill periodically. Decide with the owner before coding.
2. Decide on Vercel auto-promotion of `master` (otherwise every push needs a
   manual `vercel deploy --prod`).
3. Known cosmetic: menu label "Хто продає" vs page H1 "Переможці" style
   differences were partly unified in Oct; `onchange="this.form.submit()"` on
   sort selects is a documented inline-JS exception.
4. Deferred minors are logged in `.superpowers/sdd/*/progress.md` ledgers
   when present.

## How to work here

- Keep the zero-dependency rule for the web server; new runtime deps belong
  to scripts only and must stay external to the bundle.
- Surgical changes; match the comment density and idiom of the file. Comments
  explain *why* (the codebase relies on this heavily).
- Before claiming done: `npm run typecheck` (paste raw output), `npm test`,
  and for visible changes render the page (`node -e` with `render()` from
  `server/app.ts`, or `npm run serve`) and check at 375 px and 1280 px.
- Never write the owner's boss's first name into any output.
- Do not touch other Supabase projects (`zoom_sorting_project` is live).
- Commit messages: imperative subject, body explains the why; data commits
  are produced by CI only.
