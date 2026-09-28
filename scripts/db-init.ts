// Creates the tables in a fresh database. Idempotent; the writing scripts
// call the same thing themselves, so this exists for a first sanity check:
//
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/db-init.ts
import { loadDbConfig, ensureSchema, query } from "../src/store/db.ts";

const config = loadDbConfig();
if (!config) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.");
  process.exit(1);
}
await ensureSchema(config);
const [[cards], [subs]] = await query(config, [
  { sql: "SELECT count(*) AS n FROM cards" },
  { sql: "SELECT count(*) AS n FROM tg_subscribers" },
]);
console.log(`database ready — ${cards.n} cards, ${subs.n} subscribers`);
