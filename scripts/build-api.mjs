// Bundles the serverless handler into plain JavaScript.
//
// Vercel's Node builder ships an old TypeScript that rejects this project's
// tsconfig — it does not know allowImportingTsExtensions, and then refuses the
// .ts import extensions that Node itself requires. Rather than contort the
// source for it, we hand Vercel finished JavaScript and let it skip TypeScript
// entirely.
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = join(root, "api", "index.js");

await build({
  entryPoints: [join(root, "api-src", "handler.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // The store reads JSON from disk at runtime; keep node built-ins external.
  packages: "external",
  legalComments: "none",
  logLevel: "info",
});

const { size } = await stat(outfile);
console.log(`api/index.js: ${(size / 1024).toFixed(0)} KB`);
