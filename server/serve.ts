// Local development server. Renders through the shared app and reloads
// whenever the daily job rewrites the data files.
import { createServer } from "node:http";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { dataDir } from "../src/config.ts";
import { reload } from "./app.ts";
import { handle } from "./router.ts";

const PORT = Number(process.env.PORT ?? 3120);

// On Vercel, vercel.json rewrites every route to api/index, but the platform
// serves public/ from the filesystem *before* applying rewrites — so
// production gets these files for free. Nothing plays that role locally: the
// dev server routes everything through handle(). Without this, the logo and
// favicon 404 in dev even though they'd work once deployed.
const PUBLIC_DIR = resolve(import.meta.dirname, "..", "public");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/**
 * Serves a single file from public/ if the request maps to one, else null.
 * The path is resolved and checked against PUBLIC_DIR's prefix so a request
 * like /../server/auth.ts can't walk out of the directory it's allowed to
 * read from.
 */
async function servePublic(pathname: string): Promise<{ body: Buffer; contentType: string } | null> {
  const ext = extname(pathname);
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return null;

  const candidate = resolve(join(PUBLIC_DIR, pathname));
  if (candidate !== PUBLIC_DIR && !candidate.startsWith(PUBLIC_DIR + sep)) return null;

  try {
    const body = await readFile(candidate);
    return { body, contentType };
  } catch {
    return null;
  }
}

// One daily run touches many files, so debounce before re-reading.
let reloadTimer: NodeJS.Timeout | null = null;
watch(dataDir(), () => {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    console.log(`data changed — reloaded ${await reload()} tenders`);
  }, 2000);
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  const asset = await servePublic(url.pathname);
  if (asset) {
    res.writeHead(200, { "content-type": asset.contentType });
    res.end(asset.body);
    return;
  }

  if (url.pathname === "/reload") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`reloaded: ${await reload()} tenders`);
    return;
  }

  // The saved-companies toggle posts a form; everything else is a GET.
  let payload = "";
  if (req.method === "POST") {
    for await (const chunk of req) payload += chunk;
  }

  const { status, body, headers } = await handle({
    url,
    cookieHeader: req.headers.cookie ?? null,
    method: req.method,
    body: payload,
    headers: req.headers as Record<string, string | undefined>,
  });
  res.writeHead(status, headers);
  res.end(body);
});

server.listen(PORT, () => console.log(`tender-radar on http://localhost:${PORT}`));
