// Who receives the daily digest.
//
// PostgREST over plain fetch rather than the Supabase SDK: the project ships
// with no runtime dependencies, and three requests do not justify breaking
// that. Silent when unconfigured, the same contract as the Telegram notifier.

export type SubscriberConfig = { url: string; serviceKey: string };

export function loadSubscriberConfig(
  env: NodeJS.ProcessEnv = process.env,
): SubscriberConfig | null {
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  return url && serviceKey ? { url, serviceKey } : null;
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
  const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/tg_subscribers`;
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    "content-type": "application/json",
  };

  async function call(url: string, init: RequestInit): Promise<Response> {
    const res = await fetchImpl(url, init);
    if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
    return res;
  }

  return {
    // merge-duplicates makes a repeat /start idempotent, and resetting
    // unsubscribed_at is what lets someone come back after /stop.
    async add(chatId) {
      await call(endpoint, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ chat_id: chatId, unsubscribed_at: null }),
      });
    },

    // Soft delete: the row stays so the history of who left survives.
    async remove(chatId) {
      await call(`${endpoint}?chat_id=eq.${chatId}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
      });
    },

    async listActive() {
      const res = await call(`${endpoint}?select=chat_id&unsubscribed_at=is.null`, {
        method: "GET",
        headers,
      });
      const rows = (await res.json()) as { chat_id: number }[];
      return rows.map((row) => row.chat_id);
    },
  };
}
