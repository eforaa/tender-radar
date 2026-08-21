// Vercel entry point. Every route is rewritten here by vercel.json, and the
// page itself is rendered by the same code the local server uses.
import type { IncomingMessage, ServerResponse } from "node:http";
import { render } from "../server/app.ts";

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `https://${host}`);

  const { status, body } = render(url);

  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  // The dataset only changes when the daily job redeploys, so let the edge
  // hold pages for a minute and serve a stale one while it refreshes.
  res.setHeader("cache-control", "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
  res.end(body);
}
