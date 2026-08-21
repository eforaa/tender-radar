import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  loadAuthConfig, readCookie, createSessionCookie, readSessionEmail,
  clearSessionCookie, setStateCookie, randomState, authorizeUrl,
  SESSION_COOKIE, STATE_COOKIE,
} from "../server/auth.ts";

const ENV = {
  GOOGLE_CLIENT_ID: "client-123",
  GOOGLE_CLIENT_SECRET: "secret-abc",
  SESSION_SECRET: "session-secret",
  ALLOWED_EMAILS: "Owner@Example.com, second@example.com",
} as NodeJS.ProcessEnv;

test("the gate is off when any required env var is missing", () => {
  assert.equal(loadAuthConfig({}), null);
  assert.equal(loadAuthConfig({ ...ENV, SESSION_SECRET: undefined }), null);
  assert.equal(loadAuthConfig({ ...ENV, ALLOWED_EMAILS: undefined }), null);
});

test("the gate is off when the allowlist is present but empty", () => {
  assert.equal(loadAuthConfig({ ...ENV, ALLOWED_EMAILS: " , ," }), null);
});

test("allowed emails are normalised to lower case and trimmed", () => {
  const config = loadAuthConfig(ENV);
  assert.ok(config);
  assert.ok(config.allowedEmails.has("owner@example.com"));
  assert.ok(config.allowedEmails.has("second@example.com"));
  assert.equal(config.allowedEmails.size, 2);
});

test("reads one cookie out of a header carrying several", () => {
  assert.equal(readCookie("a=1; b=2; c=3", "b"), "2");
  assert.equal(readCookie("a=1", "missing"), null);
  assert.equal(readCookie(null, "a"), null);
});

test("a session cookie round-trips to the same email", () => {
  const cookie = createSessionCookie("user@example.com", "secret", true);
  const header = cookie.split(";")[0];
  assert.equal(readSessionEmail(header, "secret"), "user@example.com");
});

test("a session cookie signed with a different secret is rejected", () => {
  const cookie = createSessionCookie("user@example.com", "secret-a", true);
  const header = cookie.split(";")[0];
  assert.equal(readSessionEmail(header, "secret-b"), null);
});

test("a tampered email is rejected even though the signature was otherwise valid", () => {
  const cookie = createSessionCookie("user@example.com", "secret", true);
  const value = decodeURIComponent(cookie.split(";")[0].split("=")[1]);
  const [, expires, signature] = value.split("|");
  const tampered = `${SESSION_COOKIE}=${encodeURIComponent(`attacker@evil.com|${expires}|${signature}`)}`;
  assert.equal(readSessionEmail(tampered, "secret"), null);
});

test("an expired session is rejected", () => {
  // Build a cookie whose expiry is already in the past, signed correctly.
  const past = Date.now() - 1000;
  const payload = `user@example.com|${past}`;
  const sig = createHmac("sha256", "secret").update(payload).digest("base64url");
  const value = encodeURIComponent(`${payload}|${sig}`);
  assert.equal(readSessionEmail(`${SESSION_COOKIE}=${value}`, "secret"), null);
});

test("no cookie means no session", () => {
  assert.equal(readSessionEmail(null, "secret"), null);
  assert.equal(readSessionEmail("unrelated=1", "secret"), null);
});

test("clearing the session cookie sets Max-Age=0", () => {
  assert.match(clearSessionCookie(true), /Max-Age=0/);
  assert.match(clearSessionCookie(true), new RegExp(`^${SESSION_COOKIE}=;`));
});

test("state cookie carries the given nonce and expires in ten minutes", () => {
  const state = randomState();
  const cookie = setStateCookie(state, true);
  assert.match(cookie, new RegExp(`^${STATE_COOKIE}=${state};`));
  assert.match(cookie, /Max-Age=600/);
});

test("two random states are not the same and are reasonably long", () => {
  const a = randomState();
  const b = randomState();
  assert.notEqual(a, b);
  assert.ok(a.length >= 16);
});

test("the authorize URL carries the client, redirect and state", () => {
  const config = loadAuthConfig(ENV);
  assert.ok(config);
  const url = new URL(authorizeUrl(config, "https://example.com/auth/callback", "xyz"));
  assert.equal(url.hostname, "accounts.google.com");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://example.com/auth/callback");
  assert.equal(url.searchParams.get("state"), "xyz");
  assert.equal(url.searchParams.get("scope"), "openid email");
});
