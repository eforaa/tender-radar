// The two screens a visitor sees before reaching the site: the sign-in
// prompt, and the refusal when their email is not on the allowlist.
import { esc } from "./html.ts";

const SHELL_STYLES = `
:root{color-scheme:light;--paper:#F6F8F9;--surface:#FFFFFF;--ink:#17222B;--ink-soft:#4A5966;
--line:#DDE4E8;--accent:#17607F;--accent-bg:#E6F0F4;--alarm:#A03A2B;--alarm-bg:#FBE9E5;
--shadow:0 1px 2px rgba(23,34,43,.04),0 8px 24px -18px rgba(23,34,43,.26);--radius:5px;
--f-display:"Literata",Georgia,serif;--f-body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:var(--paper);color:var(--ink);font-family:var(--f-body);padding:1.5rem}
.box{max-width:26rem;width:100%;background:var(--surface);border:1px solid var(--line);
border-radius:var(--radius);box-shadow:var(--shadow);padding:2rem 1.75rem;text-align:center}
h1{font-family:var(--f-display);font-weight:700;font-size:1.4rem;margin:0 0 .6rem}
p{color:var(--ink-soft);font-size:.96rem;line-height:1.55;margin:0 0 1.5rem}
p.denied{background:var(--alarm-bg);color:var(--alarm);border-radius:var(--radius);padding:.7rem 1rem;font-size:.9rem}
a.btn{display:inline-flex;align-items:center;gap:.6rem;background:var(--accent);color:#fff;
text-decoration:none;font-weight:500;padding:.7rem 1.4rem;border-radius:var(--radius)}
a.btn:hover{filter:brightness(1.08)}
`;

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Tender Radar</title><style>${SHELL_STYLES}</style></head>
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
