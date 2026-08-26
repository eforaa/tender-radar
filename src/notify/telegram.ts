// Telegram notifications for the daily run.
//
// Silent by design when unconfigured: with no bot token in the environment the
// notifier reports that it did nothing, so the daily job keeps working on a
// machine that has no Telegram set up.
import type { Case } from "../../server/data.ts";

export type TelegramConfig = {
  token: string;
  chatId: string;
};

export function loadTelegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  return token && chatId ? { token, chatId } : null;
}

export type RunSummary = {
  newTenders: number;
  newFlags: number;
  cardsFetched: number;
  errors: number;
  totalTenders: number;
  totalFlags: number;
  findings: number;
  /** The most notable arrivals, already sorted by whatever matters. */
  highlights: Case[];
  siteUrl: string;
};

function money(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(".", ",") + " млрд ₴";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " млн ₴";
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(n) + " ₴";
}

/** Telegram's HTML mode accepts a small tag set; everything else must be escaped. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = mod100 % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * The message body. Kept short enough to read on a lock screen: what changed,
 * then at most a few arrivals worth opening.
 */
export function buildMessage(s: RunSummary): string {
  const lines: string[] = ["<b>Tender Radar — щоденне оновлення</b>", ""];

  if (s.newTenders === 0 && s.newFlags === 0) {
    lines.push("Нових закупівель із державними позначками сьогодні не додалося.");
  } else {
    lines.push(
      `Додалося <b>${s.newTenders}</b> ${plural(s.newTenders, "нова закупівля", "нові закупівлі", "нових закупівель")} ` +
        `та <b>${s.newFlags}</b> ${plural(s.newFlags, "нове спрацювання", "нові спрацювання", "нових спрацювань")} індикаторів.`,
    );
  }

  lines.push(
    "",
    `У базі: <b>${s.totalTenders.toLocaleString("uk-UA")}</b> закупівель, ` +
      `<b>${s.totalFlags.toLocaleString("uk-UA")}</b> позначок, ` +
      `<b>${s.findings}</b> ${plural(s.findings, "цінова знахідка", "цінові знахідки", "цінових знахідок")}.`,
  );

  if (s.cardsFetched > 0) lines.push(`Завантажено карток: ${s.cardsFetched}.`);
  if (s.errors > 0) lines.push(`⚠️ Помилок під час оновлення: ${s.errors}.`);

  if (s.highlights.length > 0) {
    lines.push("", "<b>Варто подивитися:</b>");
    for (const c of s.highlights) {
      const name = escapeHtml((c.title || c.entity_name || c.tender_ref).slice(0, 90));
      const url = `${s.siteUrl}/tender/${encodeURIComponent(c.tender_id)}`;
      lines.push(`• <a href="${url}">${name}</a> — ${money(c.value_amount)}`);
    }
  }

  lines.push("", `<a href="${s.siteUrl}/updates">Усі оновлення на сайті</a>`);
  return lines.join("\n");
}

export type SendResult = { sent: boolean; reason?: string };

/**
 * The raw call, shared by the single-chat notifier and the broadcaster. The
 * broadcaster needs the Response itself to tell a blocked chat from a
 * rejected message, so this returns it unwrapped.
 */
export function postMessage(
  config: TelegramConfig, chatId: string | number, text: string,
): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
    }),
  });
}

/** Posts to one chat. Never throws: a failed notification must not fail the run. */
export async function sendTelegramTo(
  config: TelegramConfig, chatId: string, text: string,
): Promise<SendResult> {
  try {
    const res = await postMessage(config, chatId, text);
    if (!res.ok) return { sent: false, reason: `Telegram returned ${res.status}` };
    const body = (await res.json()) as { ok?: boolean; description?: string };
    return body.ok ? { sent: true } : { sent: false, reason: body.description ?? "Telegram rejected the message" };
  } catch (err) {
    return { sent: false, reason: (err as Error).message };
  }
}

export async function sendTelegram(config: TelegramConfig, text: string): Promise<SendResult> {
  return sendTelegramTo(config, config.chatId, text);
}

/**
 * Picks what is worth putting in the message.
 *
 * Ranked by tier rather than by a blended score: adding a bonus for "no
 * competition" to the contract value let a large ordinary tender outrank a
 * small uncontested one, which is not the order a reader wants. Within a tier
 * the larger contract wins.
 */
export function pickHighlights(fresh: Case[], limit = 5): Case[] {
  const tier = (c: Case) => (c.findings.length > 0 ? 0 : c.bidders === 1 ? 1 : 2);
  return [...fresh]
    .sort((a, b) => tier(a) - tier(b) || (b.value_amount ?? 0) - (a.value_amount ?? 0))
    .slice(0, limit);
}
