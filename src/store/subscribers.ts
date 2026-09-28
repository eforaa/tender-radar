// Who receives the daily digest. Lives in the same database as the detail
// cards (src/store/db.ts); silent when unconfigured, the same contract as the
// Telegram notifier.
import { query, loadDbConfig, type DbConfig } from "./db.ts";

export type SubscriberConfig = DbConfig;

export function loadSubscriberConfig(env: NodeJS.ProcessEnv = process.env): SubscriberConfig | null {
  return loadDbConfig(env);
}

export type SubscriberStore = {
  add(chatId: number): Promise<void>;
  remove(chatId: number): Promise<void>;
  listActive(): Promise<number[]>;
};

export function createSubscriberStore(
  config: SubscriberConfig,
  fetchImpl: typeof fetch = fetch,
): SubscriberStore {
  return {
    // Upsert makes a repeat /start idempotent, and clearing unsubscribed_at
    // is what lets someone come back after /stop.
    async add(chatId) {
      await query(config, [{
        sql: `INSERT INTO tg_subscribers (chat_id, subscribed_at, unsubscribed_at) VALUES (?, ?, NULL)
              ON CONFLICT(chat_id) DO UPDATE SET unsubscribed_at = NULL`,
        args: [chatId, new Date().toISOString()],
      }], fetchImpl);
    },

    // Soft delete: the row stays so the history of who left survives.
    async remove(chatId) {
      await query(config, [{
        sql: "UPDATE tg_subscribers SET unsubscribed_at = ? WHERE chat_id = ?",
        args: [new Date().toISOString(), chatId],
      }], fetchImpl);
    },

    async listActive() {
      const [rows] = await query(config, [{
        sql: "SELECT chat_id FROM tg_subscribers WHERE unsubscribed_at IS NULL ORDER BY chat_id",
      }], fetchImpl);
      return rows.map((row) => Number(row.chat_id));
    },
  };
}
