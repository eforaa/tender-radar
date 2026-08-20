// Local development server. Renders through the shared app and reloads
// whenever the daily job rewrites the data files.
import { createServer } from "node:http";
import { watch } from "node:fs";
import { dataDir } from "../src/config.ts";
import { render, reload } from "./app.ts";

const PORT = Number(process.env.PORT ?? 3120);

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

  if (url.pathname === "/reload") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`reloaded: ${await reload()} tenders`);
    return;
  }

  const { status, body } = render(url);
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
});

server.listen(PORT, () => console.log(`tender-radar on http://localhost:${PORT}`));
