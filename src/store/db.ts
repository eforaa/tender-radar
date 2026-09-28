// The site's database: a Turso (libSQL) instance reached over its HTTP
// pipeline with plain fetch — no driver, so the zero-runtime-dependency rule
// holds on Vercel and in GitHub Actions alike. Silent when unconfigured, the
// same contract every optional service in this project follows.
//
// Why not Supabase any more: its free tier is 500 MB and the detail cards
// filled it. Turso's free tier is ten times that, and the cards themselves are
// now stored slimmer (see src/store/cards.ts).

export type DbConfig = { url: string; token: string };

export function loadDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig | null {
  const url = env.TURSO_DATABASE_URL;
  const token = env.TURSO_AUTH_TOKEN;
  return url && token ? { url, token } : null;
}

export type SqlValue = string | number | null;
export type Statement = { sql: string; args?: SqlValue[] };
export type Row = Record<string, SqlValue>;

/** A `libsql://` URL from the Turso dashboard is the same host over HTTPS. */
export function pipelineEndpoint(url: string): string {
  return url.replace(/^libsql:\/\//, "https://").replace(/\/$/, "") + "/v2/pipeline";
}

// Hrana's wire encoding. Integers travel as strings so 64-bit values survive
// JSON; we only ever store ids, amounts and timestamps, all of which fit.
type WireValue =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "float"; value: number }
  | { type: "text"; value: string }
  | { type: "blob"; base64: string };

function encode(value: SqlValue): WireValue {
  if (value === null) return { type: "null" };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer", value: String(value) } : { type: "float", value };
  }
  return { type: "text", value };
}

function decode(cell: WireValue): SqlValue {
  switch (cell.type) {
    case "null": return null;
    case "integer": return Number(cell.value);
    case "float": return cell.value;
    case "text": return cell.value;
    case "blob": return cell.base64;
  }
}

type PipelineResult =
  | { type: "ok"; response: { type: "execute"; result: { cols: { name: string }[]; rows: WireValue[][] } } | { type: "close" } }
  | { type: "error"; error: { message: string } };

/**
 * Runs the statements in order on one connection and returns each one's rows
 * as plain objects keyed by column name. A statement that fails throws with
 * the database's own message, so a bad query is diagnosable from the log.
 */
export async function query(
  config: DbConfig,
  statements: Statement[],
  fetchImpl: typeof fetch = fetch,
): Promise<Row[][]> {
  const res = await fetchImpl(pipelineEndpoint(config.url), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      requests: [
        ...statements.map((s) => ({ type: "execute", stmt: { sql: s.sql, args: (s.args ?? []).map(encode) } })),
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Database returned ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`);
  }
  const { results } = (await res.json()) as { results: PipelineResult[] };
  return statements.map((s, i) => {
    const r = results[i];
    if (!r) throw new Error(`Database returned no result for statement ${i + 1}`);
    if (r.type === "error") throw new Error(`Database error: ${r.error.message} — in: ${s.sql.slice(0, 80)}`);
    if (r.response.type !== "execute") return [];
    const { cols, rows } = r.response.result;
    return rows.map((row) => Object.fromEntries(cols.map((c, j) => [c.name, decode(row[j])])));
  });
}

/**
 * Everything the site keeps in the database. Idempotent, so the scripts that
 * write (daily, backfill, migrate) run it first and a fresh database just
 * works — nobody has to click through a SQL console.
 */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    tender_ref TEXT NOT NULL,
    card TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tg_subscribers (
    chat_id INTEGER PRIMARY KEY,
    subscribed_at TEXT NOT NULL,
    unsubscribed_at TEXT
  )`,
];

export async function ensureSchema(config: DbConfig, fetchImpl: typeof fetch = fetch): Promise<void> {
  await query(config, SCHEMA.map((sql) => ({ sql })), fetchImpl);
}
