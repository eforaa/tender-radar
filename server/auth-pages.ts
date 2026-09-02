// The two screens a visitor sees before reaching the site: the sign-in
// prompt, and the refusal when their email is not on the allowlist.
import { esc } from "./html.ts";

const SHELL_STYLES = `
:root{
  color-scheme:dark;
  /* Same tokens as the site (server/html.ts) — kept local rather than shared
     because this shell has no import path back to that stylesheet. */
  --s1:.25rem; --s2:.5rem; --s3:.75rem; --s4:1rem;
  --s5:1.5rem; --s6:2rem;  --s7:3rem;   --s8:4rem;
  --paper:#0A0E1A;--surface:#10152A;--ink:#E2E8F0;--ink-soft:#9AA5B8;
  --line:#252C42;--accent:#4F7CFF;--accent-bg:#1B2547;--alarm:#FF6B6B;--alarm-bg:#2A1620;
  --shadow:0 16px 40px -20px rgba(0,0,0,.6);--radius:12px;
  --f-display:"DM Sans","Segoe UI",system-ui,sans-serif;--f-body:"DM Sans","Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:var(--paper);color:var(--ink);font-family:var(--f-body);padding:var(--s5)}
.box{max-width:26rem;width:100%;background:var(--surface);border:1px solid var(--line);
border-radius:var(--radius);box-shadow:var(--shadow);padding:var(--s6) var(--s5);text-align:center}
h1{font-family:var(--f-display);font-weight:700;font-size:1.4rem;margin:0 0 var(--s3)}
p{color:var(--ink-soft);font-size:.96rem;line-height:1.55;margin:0 0 var(--s5)}
p.denied{background:var(--alarm-bg);color:var(--alarm);border-radius:var(--radius);padding:var(--s3) var(--s4);font-size:.9rem}
a.btn{display:inline-flex;align-items:center;gap:var(--s3);background:var(--accent);color:#fff;
text-decoration:none;font-weight:500;padding:var(--s3) var(--s5);border-radius:var(--radius)}
a.btn:hover{filter:brightness(1.08)}
`;

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Tender Radar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${SHELL_STYLES}</style></head>
<body><div class="box">${body}</div></body></html>`;
}

export function loginPage(): string {
  return shell(
    "Вхід",
    `<h1>Tender Radar</h1>
<p>Доступ до сайту відкрито для перевірених облікових записів. Увійдіть через Google, щоб продовжити.</p>
<a class="btn" href="/auth/login">Увійти через Google</a>`,
  );
}

export function deniedPage(message: string): string {
  return shell(
    "Доступ не надано",
    `<h1>Доступ не надано</h1>
<p class="denied">${esc(message)}</p>
<a class="btn" href="/auth/login">Спробувати ще раз</a>`,
  );
}
