# Telegram Subscriber Broadcast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the daily digest to everyone who pressed /start, instead of the single chat in `TELEGRAM_CHAT_ID`.

**Architecture:** Subscribers live in a Supabase table reached over PostgREST with plain `fetch`. A webhook route registered ahead of the Google auth gate records `/start` and `/stop`. The daily job builds the message once and loops over active subscribers, pruning chats that blocked the bot.

**Tech Stack:** TypeScript on Node 22 (native type stripping, no build step for scripts), `node --test`, Supabase PostgREST, Telegram Bot API, Vercel serverless.

## Global Constraints

- **Zero runtime dependencies.** `package.json` has only `devDependencies`. Do not add `@supabase/supabase-js` or any other runtime package. Use `fetch`.
- **Unconfigured means silent.** Every new loader returns `null` when its env vars are absent, and callers skip the step. The project must still run on a machine with no Supabase and no Telegram.
- **Comments explain why, not what.** Match the existing prose style in `src/notify/telegram.ts`.
- **Existing env vars keep their meaning:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (now the admin chat).
- **New env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TELEGRAM_WEBHOOK_SECRET`.
- **Supabase project:** `tender_radar_bot`, ref `ysaclorvgikqlbiuhxtt`, URL `https://ysaclorvgikqlbiuhxtt.supabase.co`. Table `public.tg_subscribers` already exists — do not re-create it.
- **Test command:** `npm test` runs `node --test "tests/**/*.test.ts"`. A single file: `node --test tests/<name>.test.ts`.
- **Branch:** `feat/telegram-subscribers`.

---

## File Structure

- `src/store/subscribers.ts` — **create.** Supabase-backed subscriber list. Knows nothing about Telegram.
- `src/notify/webhook.ts` — **create.** Pure parsing of a Telegram update into a command. No I/O.
- `src/notify/broadcast.ts` — **create.** Sends one text to many chats, with pacing and outcome classification. No Supabase.
- `server/router.ts` — **modify.** Add the `/telegram/webhook` route ahead of the gate; add `headers` to `HttpRequest`.
- `api-src/handler.ts`, `server/serve.ts` — **modify.** Pass request headers through.
- `scripts/daily.ts` — **modify.** Replace the single send with the broadcast.
- `scripts/set-webhook.ts` — **create.** One-off registration helper.
- `tests/subscribers.test.ts`, `tests/webhook.test.ts`, `tests/broadcast.test.ts` — **create.**

The split keeps each unit testable without the others: the store needs no Telegram, the broadcaster needs no database, the parser needs neither.

---

### Task 1: Subscriber store

**Files:**
- Create: `src/store/subscribers.ts`
- Test: `tests/subscribers.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SubscriberConfig = { url: string; serviceKey: string }`
  - `loadSubscriberConfig(env?: NodeJS.ProcessEnv): SubscriberConfig | null`
  - `type SubscriberStore = { add(chatId: number): Promise<void>; remove(chatId: number): Promise<void>; listActive(): Promise<number[]> }`
  - `createSubscriberStore(config: SubscriberConfig, fetchImpl?: typeof fetch): SubscriberStore`

- [ ] **Step 1: Write the failing test**

Create `tests/subscribers.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  loadSubscriberConfig, createSubscriberStore,
} from "../src/store/subscribers.ts";

const config = { url: "https://p.supabase.co", serviceKey: "svc" };

/** Records every call so a test can assert on the request the store made. */
function recorder(response: unknown = []) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(response), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

test("the store stays unconfigured unless both url and key are set", () => {
  assert.equal(loadSubscriberConfig({}), null);
  assert.equal(loadSubscriberConfig({ SUPABASE_URL: "u" }), null);
  assert.equal(loadSubscriberConfig({ SUPABASE_SERVICE_KEY: "k" }), null);
  assert.deepEqual(
    loadSubscriberConfig({ SUPABASE_URL: "u", SUPABASE_SERVICE_KEY: "k" }),
    { url: "u", serviceKey: "k" },
  );
});

test("adding a subscriber upserts and clears an earlier unsubscribe", async () => {
  const { calls, fetchImpl } = recorder();
  await createSubscriberStore(config, fetchImpl).add(42);

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rest\/v1\/tg_subscribers/);
  assert.equal(calls[0].init.method, "POST");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.apikey, "svc");
  assert.equal(headers.Authorization, "Bearer svc");
  assert.match(headers.Prefer, /resolution=merge-duplicates/);
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    chat_id: 42, unsubscribed_at: null,
  });
});

test("removing a subscriber stamps the row instead of deleting it", async () => {
  const { calls, fetchImpl } = recorder();
  await createSubscriberStore(config, fetchImpl).remove(42);

  assert.equal(calls[0].init.method, "PATCH");
  assert.match(calls[0].url, /chat_id=eq\.42/);
  const body = JSON.parse(calls[0].init.body as string) as { unsubscribed_at: string };
  assert.ok(Date.parse(body.unsubscribed_at) > 0, "stamps a timestamp");
});

test("listing returns only chats that have not unsubscribed", async () => {
  const { calls, fetchImpl } = recorder([{ chat_id: 1 }, { chat_id: 2 }]);
  const active = await createSubscriberStore(config, fetchImpl).listActive();

  assert.deepEqual(active, [1, 2]);
  assert.match(calls[0].url, /unsubscribed_at=is\.null/);
  assert.match(calls[0].url, /select=chat_id/);
});

test("a failed request throws with the status in the message", async () => {
  const fetchImpl = (async () =>
    new Response("nope", { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(
    () => createSubscriberStore(config, fetchImpl).listActive(),
    /401/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/subscribers.test.ts`
Expected: FAIL — cannot find module `../src/store/subscribers.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/store/subscribers.ts`:

```ts
// Who receives the daily digest.
//
// PostgREST over plain fetch rather than the Supabase SDK: the project ships
// with no runtime dependencies, and three requests do not justify breaking
// that. Silent when unconfigured, the same contract as the Telegram notifier.

export type SubscriberConfig = { url: string; serviceKey: string };

export function loadSubscriberConfig(
  env: NodeJS.ProcessEnv = process.env,
): SubscriberConfig | null {
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  return url && serviceKey ? { url, serviceKey } : null;
}

export type SubscriberStore = {
  add(chatId: number): Promise<void>;
  remove(chatId: number): Promise<void>;
  listActive(): Promise<number[]>;
};

export function createSubscriberStore(
  config: SubscriberConfig,
  fetchImpl: typeof fetch = fetch,
): SubscriberStore {
  const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/tg_subscribers`;
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    "content-type": "application/json",
  };

  async function call(url: string, init: RequestInit): Promise<Response> {
    const res = await fetchImpl(url, init);
    if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
    return res;
  }

  return {
    // merge-duplicates makes a repeat /start idempotent, and resetting
    // unsubscribed_at is what lets someone come back after /stop.
    async add(chatId) {
      await call(endpoint, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ chat_id: chatId, unsubscribed_at: null }),
      });
    },

    // Soft delete: the row stays so the history of who left survives.
    async remove(chatId) {
      await call(`${endpoint}?chat_id=eq.${chatId}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
      });
    },

    async listActive() {
      const res = await call(`${endpoint}?select=chat_id&unsubscribed_at=is.null`, {
        method: "GET",
        headers,
      });
      const rows = (await res.json()) as { chat_id: number }[];
      return rows.map((row) => row.chat_id);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/subscribers.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/store/subscribers.ts tests/subscribers.test.ts
git commit -m "feat(telegram): keep the subscriber list in Supabase"
```

---

### Task 2: Parsing a Telegram update

**Files:**
- Create: `src/notify/webhook.ts`
- Test: `tests/webhook.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Command = { chatId: number; kind: "start" | "stop" }`
  - `parseCommand(payload: unknown): Command | null`
  - `START_REPLY: string`, `STOP_REPLY: string`

- [ ] **Step 1: Write the failing test**

Create `tests/webhook.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../src/notify/webhook.ts";

test("/start and /stop are recognised with the chat they came from", () => {
  assert.deepEqual(
    parseCommand({ message: { chat: { id: 7 }, text: "/start" } }),
    { chatId: 7, kind: "start" },
  );
  assert.deepEqual(
    parseCommand({ message: { chat: { id: 7 }, text: "/stop" } }),
    { chatId: 7, kind: "stop" },
  );
});

test("Telegram's group suffix and payload arguments are tolerated", () => {
  assert.deepEqual(
    parseCommand({ message: { chat: { id: 7 }, text: "/start@TenderRadarBot" } }),
    { chatId: 7, kind: "start" },
  );
  assert.deepEqual(
    parseCommand({ message: { chat: { id: 7 }, text: "  /STOP  " } }),
    { chatId: 7, kind: "stop" },
  );
});

test("anything that is not a known command is ignored", () => {
  assert.equal(parseCommand({ message: { chat: { id: 7 }, text: "привіт" } }), null);
  assert.equal(parseCommand({ message: { chat: { id: 7 } } }), null);
  assert.equal(parseCommand({ message: { text: "/start" } }), null);
  assert.equal(parseCommand({ edited_message: { chat: { id: 7 }, text: "/start" } }), null);
  assert.equal(parseCommand({}), null);
  assert.equal(parseCommand(null), null);
  assert.equal(parseCommand("/start"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/webhook.test.ts`
Expected: FAIL — cannot find module `../src/notify/webhook.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/notify/webhook.ts`:

```ts
// Turning one Telegram update into a command, and nothing else. Kept free of
// I/O so the router can be tested without a network or a database.

export type Command = { chatId: number; kind: "start" | "stop" };

export const START_REPLY =
  "Готово — ви підписані на щоденний огляд Tender Radar.\n\n" +
  "Щодня надсилатиму коротку зведення: що нового додалося та кілька " +
  "найпомітніших закупівель. Щоб відписатися, надішліть /stop.";

export const STOP_REPLY =
  "Ви відписані. Щоб повернутися, надішліть /start.";

/** Returns null for anything we do not act on — edits, other chats, chatter. */
export function parseCommand(payload: unknown): Command | null {
  if (typeof payload !== "object" || payload === null) return null;
  const message = (payload as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;

  const chatId = (message as { chat?: { id?: unknown } }).chat?.id;
  const text = (message as { text?: unknown }).text;
  if (typeof chatId !== "number" || typeof text !== "string") return null;

  // Telegram appends @BotName in groups, and clients may add arguments.
  const word = text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if (word === "/start") return { chatId, kind: "start" };
  if (word === "/stop") return { chatId, kind: "stop" };
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/webhook.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/notify/webhook.ts tests/webhook.test.ts
git commit -m "feat(telegram): read /start and /stop out of an update"
```

---

### Task 3: The webhook route

**Files:**
- Modify: `server/router.ts` (add `headers` to `HttpRequest`; add the route at the top of `handle`)
- Modify: `api-src/handler.ts:17-22` (pass headers)
- Modify: `server/serve.ts:35-40` (pass headers)
- Test: `tests/webhook.test.ts` (append)

**Interfaces:**
- Consumes: `parseCommand`, `START_REPLY`, `STOP_REPLY` from Task 2; `loadSubscriberConfig`, `createSubscriberStore`, `type SubscriberStore` from Task 1.
- Produces:
  - `HttpRequest` gains `headers?: Record<string, string | undefined>`
  - `type WebhookDeps = { store: SubscriberStore | null; secret: string | undefined; reply?: (chatId: number, text: string) => Promise<void> }`
  - `handleTelegramWebhook(req: HttpRequest, deps: WebhookDeps): Promise<HttpResponse>` exported from `server/router.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/webhook.test.ts`:

```ts
import { handleTelegramWebhook, type HttpRequest } from "../server/router.ts";
import type { SubscriberStore } from "../src/store/subscribers.ts";

function fakeStore() {
  const added: number[] = [], removed: number[] = [];
  const store: SubscriberStore = {
    async add(id) { added.push(id); },
    async remove(id) { removed.push(id); },
    async listActive() { return []; },
  };
  return { store, added, removed };
}

function post(body: unknown, secret = "s3cret"): HttpRequest {
  return {
    url: new URL("https://site.test/telegram/webhook"),
    cookieHeader: null,
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-telegram-bot-api-secret-token": secret },
  };
}

test("a /start subscribes the chat and answers it", async () => {
  const { store, added } = fakeStore();
  const replies: { chatId: number; text: string }[] = [];
  const res = await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/start" } }),
    { store, secret: "s3cret", reply: async (chatId, text) => { replies.push({ chatId, text }); } },
  );

  assert.equal(res.status, 200);
  assert.deepEqual(added, [7]);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].chatId, 7);
});

test("a /stop unsubscribes the chat", async () => {
  const { store, removed } = fakeStore();
  await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/stop" } }),
    { store, secret: "s3cret", reply: async () => {} },
  );
  assert.deepEqual(removed, [7]);
});

test("a wrong or missing secret is rejected without touching the store", async () => {
  const { store, added } = fakeStore();
  const deps = { store, secret: "s3cret", reply: async () => {} };

  const wrong = await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/start" } }, "guess"), deps);
  assert.equal(wrong.status, 401);

  const bare = await handleTelegramWebhook(
    { url: new URL("https://site.test/telegram/webhook"), cookieHeader: null,
      method: "POST", body: "{}", headers: {} }, deps);
  assert.equal(bare.status, 401);
  assert.deepEqual(added, []);
});

test("a store failure still answers 200, so Telegram stops retrying", async () => {
  const store: SubscriberStore = {
    async add() { throw new Error("supabase down"); },
    async remove() {}, async listActive() { return []; },
  };
  const res = await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/start" } }),
    { store, secret: "s3cret", reply: async () => {} },
  );
  assert.equal(res.status, 200);
});

test("with no store configured the webhook accepts and drops the update", async () => {
  const res = await handleTelegramWebhook(
    post({ message: { chat: { id: 7 }, text: "/start" } }),
    { store: null, secret: "s3cret", reply: async () => {} },
  );
  assert.equal(res.status, 200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/webhook.test.ts`
Expected: FAIL — `handleTelegramWebhook` is not exported from `server/router.ts`.

- [ ] **Step 3: Write minimal implementation**

In `server/router.ts`, extend the request type:

```ts
export type HttpRequest = {
  url: URL;
  cookieHeader: string | null;
  method?: string;
  /** Form body, for the saved-companies toggle; JSON body, for the webhook. */
  body?: string;
  /** Lower-cased request headers. The webhook authenticates with one. */
  headers?: Record<string, string | undefined>;
};
```

Add the imports and the handler above `handle`:

```ts
import { parseCommand, START_REPLY, STOP_REPLY } from "../src/notify/webhook.ts";
import {
  loadSubscriberConfig, createSubscriberStore, type SubscriberStore,
} from "../src/store/subscribers.ts";
import { loadTelegramConfig, sendTelegramTo } from "../src/notify/telegram.ts";

export type WebhookDeps = {
  store: SubscriberStore | null;
  secret: string | undefined;
  reply?: (chatId: number, text: string) => Promise<void>;
};

/**
 * Telegram's end of the subscription. Always answers 200 once the caller is
 * authenticated: a non-2xx makes Telegram retry with backoff and eventually
 * drop the webhook altogether, which would silently break signups.
 */
export async function handleTelegramWebhook(
  req: HttpRequest,
  deps: WebhookDeps,
): Promise<HttpResponse> {
  const ok = { status: 200, body: "", headers: { "content-type": "text/plain" } };
  const offered = req.headers?.["x-telegram-bot-api-secret-token"];
  if (!deps.secret || offered !== deps.secret) {
    return { status: 401, body: "", headers: { "content-type": "text/plain" } };
  }
  if (!deps.store) return ok;

  try {
    const command = parseCommand(JSON.parse(req.body ?? "null"));
    if (!command) return ok;

    if (command.kind === "start") {
      await deps.store.add(command.chatId);
      await deps.reply?.(command.chatId, START_REPLY);
    } else {
      await deps.store.remove(command.chatId);
      await deps.reply?.(command.chatId, STOP_REPLY);
    }
  } catch (err) {
    console.error(`telegram webhook failed — ${(err as Error).message}`);
  }
  return ok;
}
```

Register it as the **first** thing inside `handle`, before `loadAuthConfig()`:

```ts
export async function handle(req: HttpRequest): Promise<HttpResponse> {
  // Ahead of the Google gate on purpose: Telegram cannot sign in, and a
  // login page returned here would silently swallow every update.
  if (req.url.pathname === "/telegram/webhook") {
    if ((req.method ?? "GET").toUpperCase() !== "POST") {
      return { status: 405, body: "", headers: { "content-type": "text/plain" } };
    }
    const supabase = loadSubscriberConfig();
    const telegram = loadTelegramConfig();
    return handleTelegramWebhook(req, {
      store: supabase ? createSubscriberStore(supabase) : null,
      secret: process.env.TELEGRAM_WEBHOOK_SECRET,
      reply: telegram
        ? (chatId, text) => sendTelegramTo(telegram, String(chatId), text).then(() => {})
        : undefined,
    });
  }

  const config = loadAuthConfig();
  // ...rest unchanged
```

In `src/notify/telegram.ts`, expose sending to an arbitrary chat. Replace the body of `sendTelegram` with a delegation so the existing signature and tests keep working:

```ts
/**
 * The raw call, shared by the single-chat notifier and the broadcaster. The
 * broadcaster needs the Response itself to tell a blocked chat from a
 * rejected message, so this returns it unwrapped.
 */
export function postMessage(
  config: TelegramConfig, chatId: string | number, text: string,
): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
    }),
  });
}

/** Posts to one chat. Never throws: a failed notification must not fail the run. */
export async function sendTelegramTo(
  config: TelegramConfig, chatId: string, text: string,
): Promise<SendResult> {
  try {
    const res = await postMessage(config, chatId, text);
    if (!res.ok) return { sent: false, reason: `Telegram returned ${res.status}` };
    const body = (await res.json()) as { ok?: boolean; description?: string };
    return body.ok ? { sent: true } : { sent: false, reason: body.description ?? "Telegram rejected the message" };
  } catch (err) {
    return { sent: false, reason: (err as Error).message };
  }
}

export async function sendTelegram(config: TelegramConfig, text: string): Promise<SendResult> {
  return sendTelegramTo(config, config.chatId, text);
}
```

In `api-src/handler.ts`, pass the headers into `handle`:

```ts
  const { status, body, headers } = await handle({
    url,
    cookieHeader: req.headers.cookie ?? null,
    method: req.method,
    body: payload,
    headers: req.headers as Record<string, string | undefined>,
  });
```

Make the same addition in `server/serve.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/webhook.test.ts && npm run typecheck`
Expected: PASS, 8 tests; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add server/router.ts api-src/handler.ts server/serve.ts src/notify/telegram.ts tests/webhook.test.ts
git commit -m "feat(telegram): accept /start on a webhook ahead of the auth gate"
```

---

### Task 4: Broadcasting to many chats

**Files:**
- Create: `src/notify/broadcast.ts`
- Test: `tests/broadcast.test.ts`

**Interfaces:**
- Consumes: nothing. The sender is injected, so this file imports no Telegram code.
- Produces:
  - `type BroadcastResult = { sent: number; blocked: number[]; failed: number }`
  - `type BroadcastDeps = { send: (chatId: number, text: string) => Promise<Response>; sleep?: (ms: number) => Promise<void> }`
  - `broadcast(chatIds: number[], text: string, deps: BroadcastDeps): Promise<BroadcastResult>`
  - `PACE_MS = 40`

- [ ] **Step 1: Write the failing test**

Create `tests/broadcast.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { broadcast, PACE_MS } from "../src/notify/broadcast.ts";

function reply(status: number, body: unknown = { ok: status === 200 }) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

test("every chat gets the message, paced apart", async () => {
  const seen: number[] = [], slept: number[] = [];
  const result = await broadcast([1, 2, 3], "hi", {
    send: async (chatId) => { seen.push(chatId); return reply(200); },
    sleep: async (ms) => { slept.push(ms); },
  });

  assert.deepEqual(seen, [1, 2, 3]);
  assert.deepEqual(result, { sent: 3, blocked: [], failed: 0 });
  assert.ok(slept.every((ms) => ms === PACE_MS), "paces at PACE_MS");
});

test("a chat that blocked the bot is reported for unsubscribing", async () => {
  const result = await broadcast([1, 2], "hi", {
    send: async (chatId) => (chatId === 2 ? reply(403, { ok: false }) : reply(200)),
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 1, blocked: [2], failed: 0 });
});

test("a rate limit is waited out and retried once", async () => {
  const attempts: number[] = [], slept: number[] = [];
  let first = true;
  const result = await broadcast([9], "hi", {
    send: async (chatId) => {
      attempts.push(chatId);
      if (first) { first = false; return reply(429, { parameters: { retry_after: 3 } }); }
      return reply(200);
    },
    sleep: async (ms) => { slept.push(ms); },
  });

  assert.deepEqual(attempts, [9, 9], "tried twice");
  assert.ok(slept.includes(3000), "waited retry_after seconds");
  assert.deepEqual(result, { sent: 1, blocked: [], failed: 0 });
});

test("a chat that keeps failing counts as an error and does not stop the rest", async () => {
  const result = await broadcast([1, 2], "hi", {
    send: async (chatId) => (chatId === 1 ? reply(500, { ok: false }) : reply(200)),
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 1, blocked: [], failed: 1 });
});

test("a 400 about a missing chat unsubscribes it", async () => {
  const result = await broadcast([1], "hi", {
    send: async () => reply(400, { ok: false, description: "Bad Request: chat not found" }),
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 0, blocked: [1], failed: 0 });
});

// Guards the worst failure mode in this feature: one malformed tender title
// makes Telegram reject the message for EVERY chat with a 400. Counting that
// as "blocked" would unsubscribe the entire audience in a single run.
test("a 400 about the message itself is an error, never an unsubscribe", async () => {
  const result = await broadcast([1, 2], "hi", {
    send: async () =>
      reply(400, { ok: false, description: "Bad Request: can't parse entities" }),
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 0, blocked: [], failed: 2 });
});

test("a thrown network error is counted, not propagated", async () => {
  const result = await broadcast([1], "hi", {
    send: async () => { throw new Error("socket hang up"); },
    sleep: async () => {},
  });
  assert.deepEqual(result, { sent: 0, blocked: [], failed: 1 });
});

test("an empty list does no work", async () => {
  let calls = 0;
  const result = await broadcast([], "hi", {
    send: async () => { calls++; return reply(200); },
    sleep: async () => {},
  });
  assert.equal(calls, 0);
  assert.deepEqual(result, { sent: 0, blocked: [], failed: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/broadcast.test.ts`
Expected: FAIL — cannot find module `../src/notify/broadcast.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/notify/broadcast.ts`:

```ts
// One text to many chats.
//
// Kept apart from the Supabase store and from message building so it can be
// tested with a fake sender: the interesting behaviour here is what happens
// when Telegram says no, and that should not need a network to exercise.

/** Telegram allows roughly 30 messages a second; 40 ms leaves headroom. */
export const PACE_MS = 40;

export type BroadcastResult = {
  sent: number;
  /** Chats that blocked the bot — the caller unsubscribes these. */
  blocked: number[];
  failed: number;
};

export type BroadcastDeps = {
  send: (chatId: number, text: string) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function broadcast(
  chatIds: number[],
  text: string,
  deps: BroadcastDeps,
): Promise<BroadcastResult> {
  const sleep = deps.sleep ?? wait;
  const result: BroadcastResult = { sent: 0, blocked: [], failed: 0 };

  for (const [index, chatId] of chatIds.entries()) {
    if (index > 0) await sleep(PACE_MS);

    try {
      let res = await deps.send(chatId, text);

      // 429 carries the seconds to wait. One retry only: a chat that is still
      // throttled after that must not hold up everyone behind it.
      if (res.status === 429) {
        const body = (await res.clone().json().catch(() => ({}))) as {
          parameters?: { retry_after?: number };
        };
        await sleep((body.parameters?.retry_after ?? 1) * 1000);
        res = await deps.send(chatId, text);
      }

      if (res.ok) { result.sent++; continue; }

      // 403 always means the user blocked the bot or deleted the chat.
      // 400 is ambiguous and must be read: Telegram returns it both for a
      // chat that no longer exists AND for a message it could not parse. A
      // single malformed tender title would otherwise return 400 for every
      // recipient and unsubscribe the whole audience in one run, so only
      // the chat-specific descriptions count as gone.
      const description = ((await res.clone().json().catch(() => ({}))) as {
        description?: string;
      }).description ?? "";
      const chatIsGone =
        res.status === 403 ||
        (res.status === 400 && /chat not found|group chat was (upgraded|deactivated)|user is deactivated|bot was kicked/i.test(description));

      if (chatIsGone) result.blocked.push(chatId);
      else result.failed++;
    } catch {
      result.failed++;
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/broadcast.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/notify/broadcast.ts tests/broadcast.test.ts
git commit -m "feat(telegram): send one digest to many chats, pruning blocked ones"
```

---

### Task 5: Wire the broadcast into the daily job

**Files:**
- Modify: `scripts/daily.ts:217-241` (step 5)

**Interfaces:**
- Consumes: `loadSubscriberConfig`, `createSubscriberStore` (Task 1); `broadcast` (Task 4); `sendTelegramTo` (Task 3); existing `loadTelegramConfig`, `buildMessage`, `pickHighlights`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Replace step 5 of the run**

In `scripts/daily.ts`, add to the imports at the top:

```ts
import { loadTelegramConfig, buildMessage, sendTelegram, sendTelegramTo, postMessage, pickHighlights } from "../src/notify/telegram.ts";
import { loadSubscriberConfig, createSubscriberStore } from "../src/store/subscribers.ts";
import { broadcast } from "../src/notify/broadcast.ts";
```

Replace the body of the `else` branch in step 5 with:

```ts
    const { loadDataset } = await import("../server/data.ts");
    const dataset = await loadDataset();
    const freshIds = new Set(newTenderIds);
    // Built once: the digest is identical for everyone.
    const text = buildMessage({
      newTenders: newTenderIds.length,
      newFlags,
      cardsFetched: detailsFetched,
      errors,
      totalTenders: dataset.cases.length,
      totalFlags: dataset.flagCount,
      findings: dataset.findingCount,
      highlights: pickHighlights(dataset.cases.filter((c) => freshIds.has(c.tender_id))),
      siteUrl: process.env.SITE_URL ?? "https://tender-radar-five.vercel.app",
    });

    const supabase = loadSubscriberConfig();
    if (!supabase) {
      // No subscriber store configured: behave exactly as before.
      const result = await sendTelegram(telegram, text);
      log(result.sent ? "telegram notification sent" : `telegram notification failed — ${result.reason}`);
    } else {
      const store = createSubscriberStore(supabase);
      const chatIds = await store.listActive();
      const outcome = await broadcast(chatIds, text, {
        send: (chatId, body) => postMessage(telegram, chatId, body),
      });

      for (const chatId of outcome.blocked) await store.remove(chatId);

      log(
        `telegram broadcast — ${outcome.sent} delivered, ` +
          `${outcome.blocked.length} unsubscribed, ${outcome.failed} failed`,
      );

      // The admin chat gets the delivery report. Without it a broken
      // broadcast is invisible: subscribers do not complain, they just
      // stop hearing from us.
      await sendTelegramTo(
        telegram,
        telegram.chatId,
        `<b>Розсилка</b>\nДоставлено: ${outcome.sent}\n` +
          `Відписалося: ${outcome.blocked.length}\nПомилок: ${outcome.failed}`,
      );
    }
```

- [ ] **Step 2: Run the whole suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS, all suites; typecheck clean.

- [ ] **Step 3: Verify the unconfigured path by hand**

Run: `node scripts/daily.ts` with neither `SUPABASE_URL` nor `TELEGRAM_BOT_TOKEN` set.
Expected: the log line `telegram not configured — skipping the notification`, and the run finishes normally.

- [ ] **Step 4: Commit**

```bash
git add scripts/daily.ts
git commit -m "feat(telegram): send the daily digest to every subscriber"
```

---

### Task 6: Webhook registration and documentation

**Files:**
- Create: `scripts/set-webhook.ts`
- Modify: `.github/workflows/daily.yml:38-42` (add the Supabase secrets)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Write the registration script**

Create `scripts/set-webhook.ts`:

```ts
// Registers the webhook with Telegram. Run once after deploying, and again
// only if the site URL or the secret changes.
//
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... SITE_URL=https://... \
//     node scripts/set-webhook.ts

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = process.env.SITE_URL;

if (!token || !secret || !site) {
  console.error("need TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and SITE_URL");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: `${site.replace(/\/$/, "")}/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
  }),
});

console.log(JSON.stringify(await res.json(), null, 2));
```

- [ ] **Step 2: Add the script entry**

In `package.json`, under `scripts`, add:

```json
    "set-webhook": "node scripts/set-webhook.ts",
```

- [ ] **Step 3: Pass the Supabase secrets to the daily job**

In `.github/workflows/daily.yml`, alongside the existing `TELEGRAM_*` entries:

```yaml
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/set-webhook.ts package.json .github/workflows/daily.yml
git commit -m "chore(telegram): add webhook registration and job secrets"
```

---

## Manual steps for the operator

These cannot be done from the repository and must happen before the bot works:

1. **Vercel env** — add `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, then redeploy.
2. **GitHub Secrets** — add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.
3. **Register the webhook** — `npm run set-webhook` with the three variables set.
4. **Smoke test** — press Start in the bot, then confirm the row landed:
   `select * from public.tg_subscribers;`
