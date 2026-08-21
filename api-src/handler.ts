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

  // A signed-in visitor sees the same HTML as any other, so a successful
  // page is safe to cache at the edge; auth redirects, denials and the
  // login screen itself must always be evaluated fresh.
  if (status === 200 && !headers["set-cookie"]) {
    res.setHeader("cache-control", "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
  } else {
    res.setHeader("cache-control", "no-store");
  }

  res.end(body);
}
