// Turning one Telegram update into a command, and nothing else. Kept free of
// I/O so the router can be tested without a network or a database.

export type Command = { chatId: number; kind: "start" | "stop" };

export const START_REPLY =
  "Готово — ви підписані на щоденний огляд Tender Radar.\n\n" +
  "Щодня надсилатиму коротку зведення: що нового додалося та кілька " +
  "найпомітніших закупівель. Щоб відписатися, надішліть /stop.";

export const STOP_REPLY =
  "Ви відписані. Щоб повернутися, надішліть /start.";

/** Returns null for anything we do not act on — edits, other chats, chatter. */
export function parseCommand(payload: unknown): Command | null {
  if (typeof payload !== "object" || payload === null) return null;
  const message = (payload as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;

  const chatId = (message as { chat?: { id?: unknown } }).chat?.id;
  const text = (message as { text?: unknown }).text;
  if (typeof chatId !== "number" || typeof text !== "string") return null;

  // Telegram appends @BotName in groups, and clients may add arguments.
  const word = text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if (word === "/start") return { chatId, kind: "start" };
  if (word === "/stop") return { chatId, kind: "stop" };
  return null;
}
