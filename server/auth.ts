// Google sign-in with an email allowlist. No dependencies beyond node:crypto —
// the ID token is verified through Google's tokeninfo endpoint rather than a
// JWT/JWKS library, which is enough for a low-traffic gated site.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tr_session";
export const STATE_COOKIE = "tr_oauth_state";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const STATE_TTL_SECONDS = 600;

export type AuthConfig = {
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  allowedEmails: Set<string>;
};

/**
 * Reads the four required env vars. Returns null when any is missing, which
 * turns the whole gate off — local development stays open without a Google
 * project configured.
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = env.SESSION_SECRET;
  const allowedRaw = env.ALLOWED_EMAILS;
  if (!clientId || !clientSecret || !sessionSecret || !allowedRaw) return null;

  const allowedEmails = new Set(
    allowedRaw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allowedEmails.size === 0) return null;

  return { clientId, clientSecret, sessionSecret, allowedEmails };
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function cookieAttrs(secure: boolean): string {
  return `HttpOnly; SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
}

export function randomState(): string {
  return randomBytes(16).toString("base64url");
}

export function setStateCookie(state: string, secure: boolean): string {
  return `${STATE_COOKIE}=${state}; ${cookieAttrs(secure)}; Max-Age=${STATE_TTL_SECONDS}`;
}

export function clearStateCookie(secure: boolean): string {
  return `${STATE_COOKIE}=; ${cookieAttrs(secure)}; Max-Age=0`;
}

/** Signed `email|expiry|signature` cookie. No server-side session store. */
export function createSessionCookie(email: string, secret: string, secure: boolean): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${email}|${expires}`;
  const value = encodeURIComponent(`${payload}|${sign(payload, secret)}`);
  return `${SESSION_COOKIE}=${value}; ${cookieAttrs(secure)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; ${cookieAttrs(secure)}; Max-Age=0`;
}

/** Verifies the signature and expiry, and returns the email if both hold. */
export function readSessionEmail(cookieHeader: string | null, secret: string): string | null {
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  if (!raw) return null;

  const parts = raw.split("|");
  if (parts.length !== 3) return null;
  const [email, expiresStr, signature] = parts;

  const expected = sign(`${email}|${expiresStr}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (!Number.isFinite(Number(expiresStr)) || Date.now() > Number(expiresStr)) return null;
  return email;
}

export function authorizeUrl(config: AuthConfig, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleIdentity = { email: string; emailVerified: boolean };

/** Exchanges the authorization code for an ID token, then verifies it. */
export async function exchangeCode(
  config: AuthConfig,
  code: string,
  redirectUri: string,
): Promise<GoogleIdentity | null> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return null;

  const token = (await tokenRes.json()) as { id_token?: string };
  if (!token.id_token) return null;

  // tokeninfo checks the signature and expiry server-side; we only need to
  // additionally confirm the token was issued for this client.
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`);
  if (!infoRes.ok) return null;

  const claims = (await infoRes.json()) as { aud?: string; email?: string; email_verified?: string };
  if (claims.aud !== config.clientId || !claims.email) return null;

  return { email: claims.email.toLowerCase(), emailVerified: claims.email_verified === "true" };
}
