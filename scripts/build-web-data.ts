// Builds the slim dataset the website actually needs.
//
// The working store keeps each tender's full Prozorro payload in `raw`, which
// is 302 MB of the 311 MB total — useful for adding a detector later without
// re-downloading, useless to the pages. This drops it, so the deployed bundle
// stays small enough to ship.
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { dataDir } from "../src/config.ts";
import type { TenderRow } from "../src/store/types.ts";

const source = dataDir();
const target = join(import.meta.dirname, "..", "web-data");

/** Tables that go across untouched — they are already small. */
const COPY = [
  "risk_flags.json",
  "risk_rules.json",
  "tender_items.json",
  "bids.json",
  "awards.json",
  "findings.json",
  "runs.json",
];

async function sizeOf(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

function mb(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1) + " MB";
}

await mkdir(target, { recursive: true });

const present = new Set(await readdir(source));
let written = 0;

for (const name of COPY) {
  if (!present.has(name)) continue;
  const body = await readFile(join(source, name), "utf8");
  await writeFile(join(target, name), body, "utf8");
  written += body.length;
  console.log(`${name}: ${mb(body.length)}`);
}

const tenders = JSON.parse(await readFile(join(source, "tenders.json"), "utf8")) as TenderRow[];
const slim = tenders.map(({ raw: _raw, ...rest }) => ({ ...rest, raw: null }));
const slimBody = JSON.stringify(slim);
await writeFile(join(target, "tenders.json"), slimBody, "utf8");

const before = await sizeOf(join(source, "tenders.json"));
console.log(`tenders.json: ${mb(before)} → ${mb(slimBody.length)} (${tenders.length} tenders, raw payloads dropped)`);
console.log(`web-data total: ${mb(written + slimBody.length)}`);
