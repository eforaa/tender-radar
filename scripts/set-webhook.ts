// Registers the webhook with Telegram. Run once after deploying, and again
// only if the site URL or the secret changes.
//
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... SITE_URL=https://... \
//     node scripts/set-webhook.ts

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = process.env.SITE_URL;

if (!token || !secret || !site) {
  console.error("need TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and SITE_URL");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: `${site.replace(/\/$/, "")}/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
  }),
});

console.log(JSON.stringify(await res.json(), null, 2));

export {};
