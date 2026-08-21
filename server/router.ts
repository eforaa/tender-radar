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

export type HttpRequest = {
  url: URL;
  cookieHeader: string | null;
  method?: string;
  /** Form body, for the saved-companies toggle. */
  body?: string;
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

/**
 * Resolves one request to a response, enforcing the Google sign-in gate when
 * it is configured. With no Google credentials in the environment the gate
 * is off entirely — this is what keeps local development working without a
 * Google Cloud project set up.
 */
export async function handle(req: HttpRequest): Promise<HttpResponse> {
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

    const { status, body } = render(req.url, saved);
    return page(status, body);
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
