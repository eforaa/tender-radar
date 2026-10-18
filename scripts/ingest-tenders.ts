import { openStore, dataDir } from "../src/config.ts";
import { ingestTenders } from "../src/ingest/tenders.ts";

const result = await ingestTenders(openStore(), {
  directory: dataDir(), maxPages: Number(process.env.TR_FEED_MAX_PAGES ?? 20),
  concurrency: Number(process.env.TR_CONCURRENCY ?? 4), log: console.log,
});
console.log(JSON.stringify(result, null, 2));
