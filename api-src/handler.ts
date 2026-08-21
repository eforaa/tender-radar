// Vercel entry point. Every route is rewritten here by vercel.json; the
// Google auth gate and page rendering both happen in server/router.ts, so
// this stays a thin adapter to the platform's request/response shapes.
import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "../server/router.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);

  let payload = "";
  if (req.method === "POST") {
    for await (const chunk of req) payload += chunk;
  }

  const { status, body, headers } = await handle({
    url,
    cookieHeader: req.headers.cookie ?? null,
    method: req.method,
    body: payload,
  });

  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);

  // Never cache at the edge. Every page now varies by cookie — stars are
  // rendered per visitor, and with the auth gate on, a shared copy could be
  // served to someone who never signed in. The edge caches by URL, not by
  // cookie, so a public copy is simply wrong here. Rendering is in-memory
  // and costs milliseconds, so there is nothing to gain by risking it.
  res.setHeader("cache-control", "private, no-store");
  res.setHeader("vary", "Cookie");

  res.end(body);
}
