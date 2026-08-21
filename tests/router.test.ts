import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../server/router.ts";
import { createSessionCookie } from "../server/auth.ts";

const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET", "ALLOWED_EMAILS"] as const;

function withEnv<T>(vars: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => T): T {
  const previous = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const key of ENV_KEYS) {
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const CONFIGURED = {
  GOOGLE_CLIENT_ID: "client-123",
  GOOGLE_CLIENT_SECRET: "secret-abc",
  SESSION_SECRET: "session-secret",
  ALLOWED_EMAILS: "owner@example.com",
};

test("with no Google credentials set, every request renders normally", async () => {
  await withEnv({}, async () => {
    const res = await handle({ url: new URL("https://x.example/"), cookieHeader: null });
    assert.equal(res.status, 200);
    assert.match(res.body, /Закупівлі/);
  });
});

test("an unauthenticated visitor sees the sign-in page, not the site", async () => {
  await withEnv(CONFIGURED, async () => {
    const res = await handle({ url: new URL("https://x.example/"), cookieHeader: null });
    assert.equal(res.status, 200);
    assert.match(res.body, /Увійти через Google/);
  });
});

test("/auth/login redirects to Google and drops a state cookie", async () => {
  await withEnv(CONFIGURED, async () => {
    const res = await handle({ url: new URL("https://x.example/auth/login"), cookieHeader: null });
    assert.equal(res.status, 302);
    assert.match(String(res.headers.location), /^https:\/\/accounts\.google\.com/);
    assert.match(String(res.headers["set-cookie"]), /tr_oauth_state=/);
  });
});

test("/auth/callback rejects a mismatched state", async () => {
  await withEnv(CONFIGURED, async () => {
    const res = await handle({
      url: new URL("https://x.example/auth/callback?code=abc&state=wrong"),
      cookieHeader: "tr_oauth_state=right",
    });
    assert.equal(res.status, 400);
    assert.match(res.body, /Недійсний запит/);
  });
});

test("/auth/callback rejects an email that is not on the allowlist", async () => {
  await withEnv(CONFIGURED, async () => {
    const originalFetch = globalThis.fetch;
    // Google's tokeninfo URL contains "/token" as a substring of "/tokeninfo",
    // so this must be checked before the plain token-exchange branch.
    globalThis.fetch = (async (url: string | URL) => {
      const href = String(url);
      if (href.includes("tokeninfo")) {
        return new Response(
          JSON.stringify({ aud: "client-123", email: "stranger@example.com", email_verified: "true" }),
          { status: 200 },
        );
      }
      if (href.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ id_token: "fake" }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${href}`);
    }) as typeof fetch;

    try {
      const res = await handle({
        url: new URL("https://x.example/auth/callback?code=abc&state=xyz"),
        cookieHeader: "tr_oauth_state=xyz",
      });
      assert.equal(res.status, 403);
      assert.match(res.body, /не надано/);
      assert.ok(!String(res.headers["set-cookie"]).includes("tr_session="));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("/auth/callback signs in an allowed email and redirects home", async () => {
  await withEnv(CONFIGURED, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL) => {
      const href = String(url);
      if (href.includes("tokeninfo")) {
        return new Response(
          JSON.stringify({ aud: "client-123", email: "Owner@example.com", email_verified: "true" }),
          { status: 200 },
        );
      }
      if (href.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ id_token: "fake" }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${href}`);
    }) as typeof fetch;

    try {
      const res = await handle({
        url: new URL("https://x.example/auth/callback?code=abc&state=xyz"),
        cookieHeader: "tr_oauth_state=xyz",
      });
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, "/");
      const cookies = Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"] : [res.headers["set-cookie"]];
      assert.ok(cookies.some((c) => String(c).startsWith("tr_session=")));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("a valid session cookie for an allowed email reaches the site", async () => {
  await withEnv(CONFIGURED, async () => {
    const cookie = createSessionCookie("owner@example.com", "session-secret", true).split(";")[0];
    const res = await handle({ url: new URL("https://x.example/"), cookieHeader: cookie });
    assert.equal(res.status, 200);
    assert.match(res.body, /Закупівлі/);
  });
});

test("a valid session cookie for an email later removed from the allowlist is refused", async () => {
  await withEnv(CONFIGURED, async () => {
    const cookie = createSessionCookie("removed@example.com", "session-secret", true).split(";")[0];
    const res = await handle({ url: new URL("https://x.example/"), cookieHeader: cookie });
    assert.match(res.body, /Увійти через Google/);
  });
});

test("/auth/logout clears the session and sends the visitor back to sign in", async () => {
  await withEnv(CONFIGURED, async () => {
    const res = await handle({ url: new URL("https://x.example/auth/logout"), cookieHeader: null });
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, "/auth/login");
    assert.match(String(res.headers["set-cookie"]), /tr_session=.*Max-Age=0/);
  });
});
