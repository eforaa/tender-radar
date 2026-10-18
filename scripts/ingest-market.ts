import { dataDir } from "../src/config.ts";
import { ingestMarket } from "../src/ingest/market.ts";
console.log(await ingestMarket(dataDir(), Number(process.env.TR_MARKET_MAX_PAGES ?? 6)));
