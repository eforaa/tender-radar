// One text to many chats.
//
// Kept apart from the Supabase store and from message building so it can be
// tested with a fake sender: the interesting behaviour here is what happens
// when Telegram says no, and that should not need a network to exercise.

/** Telegram allows roughly 30 messages a second; 40 ms leaves headroom. */
export const PACE_MS = 40;

export type BroadcastResult = {
  sent: number;
  /** Chats that blocked the bot — the caller unsubscribes these. */
  blocked: number[];
  failed: number;
};

export type BroadcastDeps = {
  send: (chatId: number, text: string) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function broadcast(
  chatIds: number[],
  text: string,
  deps: BroadcastDeps,
): Promise<BroadcastResult> {
  const sleep = deps.sleep ?? wait;
  const result: BroadcastResult = { sent: 0, blocked: [], failed: 0 };

  for (const [index, chatId] of chatIds.entries()) {
    if (index > 0) await sleep(PACE_MS);

    try {
      let res = await deps.send(chatId, text);

      // 429 carries the seconds to wait. One retry only: a chat that is still
      // throttled after that must not hold up everyone behind it.
      if (res.status === 429) {
        const body = (await res.clone().json().catch(() => ({}))) as {
          parameters?: { retry_after?: number };
        };
        await sleep((body.parameters?.retry_after ?? 1) * 1000);
        res = await deps.send(chatId, text);
      }

      if (res.ok) { result.sent++; continue; }

      // 403 always means the user blocked the bot or deleted the chat.
      // 400 is ambiguous and must be read: Telegram returns it both for a
      // chat that no longer exists AND for a message it could not parse. A
      // single malformed tender title would otherwise return 400 for every
      // recipient and unsubscribe the whole audience in one run, so only
      // the chat-specific descriptions count as gone.
      const description = ((await res.clone().json().catch(() => ({}))) as {
        description?: string;
      }).description ?? "";
      const chatIsGone =
        res.status === 403 ||
        (res.status === 400 && /chat not found|group chat was (upgraded|deactivated)|user is deactivated|bot was kicked/i.test(description));

      if (chatIsGone) result.blocked.push(chatId);
      else result.failed++;
    } catch {
      result.failed++;
    }
  }

  return result;
}
