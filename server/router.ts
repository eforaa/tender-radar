// Composes the Google auth gate with page rendering. One function, used by
// both the local dev server and the Vercel handler, so the gate can't drift
// between environments.
import { render } from "./app.ts";
import { loginPage, deniedPage } from "./auth-pages.ts";
import {
  loadAuthConfig,
  readCookie,
  readSessionEmail,
  createSessionCookie,
  clearSessionCookie,
  setStateCookie,
  clearStateCookie,
  randomState,
  authorizeUrl,
  exchangeCode,
  STATE_COOKIE,
} from "./auth.ts";
import {
  FAVOURITES_COOKIE,
  parseFavourites,
  toggleFavourite,
  favouritesCookie,
  isFavKind,
} from "./favourites.ts";
import { parseCommand, START_REPLY, STOP_REPLY } from "../src/notify/webhook.ts";
import {
  loadSubscriberConfig, createSubscriberStore, type SubscriberStore,
} from "../src/store/subscribers.ts";
import { loadTelegramConfig, sendTelegramTo } from "../src/notify/telegram.ts";

export type HttpRequest = {
  url: URL;
  cookieHeader: string | null;
  method?: string;
  /** Form body, for the saved-companies toggle; JSON body, for the webhook. */
  body?: string;
  /** Lower-cased request headers. The webhook authenticates with one. */
  headers?: Record<string, string | undefined>;
};

export type HttpResponse = { status: number; body: string; headers: Record<string, string | string[]> };

function page(status: number, body: string, headers: Record<string, string | string[]> = {}): HttpResponse {
  return { status, body, headers: { "content-type": "text/html; charset=utf-8", ...headers } };
}

function redirect(location: string, setCookie?: string | string[]): HttpResponse {
  const headers: Record<string, string | string[]> = { location };
  if (setCookie) headers["set-cookie"] = setCookie;
  return { status: 302, body: "", headers };
}

/** Keeps a redirect target on this site, so a form cannot bounce elsewhere. */
function safeBack(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/starred";
  return value;
}

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
  if (!deps.secret) {
    // Fail-closed is correct here — reject regardless — but doing it silently
    // makes a missing env var indistinguishable from a live attack, and hard
    // to diagnose from the logs alone.
    console.error("telegram webhook rejected — TELEGRAM_WEBHOOK_SECRET is not configured");
    return { status: 401, body: "", headers: { "content-type": "text/plain" } };
  }
  if (offered !== deps.secret) {
    console.error("telegram webhook rejected — wrong secret token offered");
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

/**
 * Resolves one request to a response, enforcing the Google sign-in gate when
 * it is configured. With no Google credentials in the environment the gate
 * is off entirely — this is what keeps local development working without a
 * Google Cloud project set up.
 */
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
  const secure = req.url.protocol === "https:";
  const saved = parseFavourites(readCookie(req.cookieHeader, FAVOURITES_COOKIE));

  /** Everything past the gate — shared by the gated and ungated paths. */
  function serve(): HttpResponse {
    if (req.url.pathname === "/starred/toggle" && (req.method ?? "GET").toUpperCase() === "POST") {
      const form = new URLSearchParams(req.body ?? "");
      const kind = form.get("kind") ?? "";
      const id = (form.get("id") ?? "").trim();
      const back = safeBack(form.get("back"));
      if (!isFavKind(kind) || !id) return redirect(back);
      return redirect(back, favouritesCookie(toggleFavourite(saved, kind, id), secure));
    }

    const rendered = render(req.url, saved);
    if (rendered.contentType) {
      return {
        status: rendered.status,
        body: rendered.body,
        headers: {
          "content-type": rendered.contentType,
          ...(rendered.filename
            ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(rendered.filename)}` }
            : {}),
        },
      };
    }
    return page(rendered.status, rendered.body);
  }

  if (!config) return serve();

  const redirectUri = `${req.url.origin}/auth/callback`;

  if (req.url.pathname === "/auth/login") {
    const state = randomState();
    return redirect(authorizeUrl(config, redirectUri, state), setStateCookie(state, secure));
  }

  if (req.url.pathname === "/auth/logout") {
    return redirect("/auth/login", clearSessionCookie(secure));
  }

  if (req.url.pathname === "/auth/callback") {
    const code = req.url.searchParams.get("code");
    const returnedState = req.url.searchParams.get("state");
    const expectedState = readCookie(req.cookieHeader, STATE_COOKIE);

    if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
      return page(400, deniedPage("Недійсний запит на вхід. Спробуйте ще раз."), {
        "set-cookie": clearStateCookie(secure),
      });
    }

    const identity = await exchangeCode(config, code, redirectUri);
    const clearState = clearStateCookie(secure);

    if (!identity || !identity.emailVerified) {
      return page(403, deniedPage("Не вдалося підтвердити пошту Google."), { "set-cookie": clearState });
    }
    if (!config.allowedEmails.has(identity.email)) {
      return page(403, deniedPage(`Доступ для ${identity.email} не надано. Зверніться до власника сайту.`), {
        "set-cookie": clearState,
      });
    }

    return redirect("/", [createSessionCookie(identity.email, config.sessionSecret, secure), clearState]);
  }

  const email = readSessionEmail(req.cookieHeader, config.sessionSecret);
  if (!email || !config.allowedEmails.has(email)) {
    return page(200, loginPage());
  }

  return serve();
}
