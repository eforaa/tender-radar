/** Layout, styles and small rendering helpers. No template engine, no deps. */

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function money(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(amount) + " ₴";
}

export function shortMoney(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  if (amount >= 1e9) return (amount / 1e9).toFixed(2).replace(".", ",") + " млрд ₴";
  if (amount >= 1e6) return (amount / 1e6).toFixed(1).replace(".", ",") + " млн ₴";
  if (amount >= 1e3) return Math.round(amount / 1e3).toLocaleString("uk-UA") + " тис ₴";
  return Math.round(amount) + " ₴";
}

export function date(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Ukrainian noun agreement: 1 закупівля, 2 закупівлі, 5 закупівель.
 * Pass the three forms; the teens exception is handled here.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = mod100 % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** Trims a long procurement title to something a person will actually read. */
export function trim(text: string, max = 130): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
}

const STYLES = `
:root {
  --paper:#F2F5F6; --surface:#FFFFFF; --surface-2:#EBF0F2; --surface-3:#F7F9FA;
  --ink:#141E28; --ink-soft:#42525D; --ink-faint:#6F818C;
  --line:#D3DCE1; --line-soft:#E6ECEF;
  --accent:#1B5670; --accent-bg:#E0EBF0; --accent-ink:#134156;
  --alarm:#8C3A2E; --alarm-bg:#F6E4E1;
  --warn:#8A6420; --warn-bg:#F6ECD9;
  --calm:#2C6B4E; --calm-bg:#E0EFE7;
  --shadow:0 1px 2px rgba(20,30,40,.05), 0 10px 28px -20px rgba(20,30,40,.35);
  --f-display:"Literata",Georgia,serif;
  --f-body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;
  --f-mono:"IBM Plex Mono",Consolas,monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper:#0E151B; --surface:#161F27; --surface-2:#1C2831; --surface-3:#131C23;
    --ink:#E6ECF0; --ink-soft:#A6B4BE; --ink-faint:#7C8B96;
    --line:#293641; --line-soft:#202C35;
    --accent:#7CBBD5; --accent-bg:#182D39; --accent-ink:#A8D5E7;
    --alarm:#E09B90; --alarm-bg:#2D1C19;
    --warn:#DBB46C; --warn-bg:#2C2617;
    --calm:#7FC6A0; --calm-bg:#152B22;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 28px -20px rgba(0,0,0,.9);
  }
}
:root[data-theme="dark"] {
  --paper:#0E151B; --surface:#161F27; --surface-2:#1C2831; --surface-3:#131C23;
  --ink:#E6ECF0; --ink-soft:#A6B4BE; --ink-faint:#7C8B96;
  --line:#293641; --line-soft:#202C35;
  --accent:#7CBBD5; --accent-bg:#182D39; --accent-ink:#A8D5E7;
  --alarm:#E09B90; --alarm-bg:#2D1C19;
  --warn:#DBB46C; --warn-bg:#2C2617;
  --calm:#7FC6A0; --calm-bg:#152B22;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 28px -20px rgba(0,0,0,.9);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-underline-offset:3px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* ---------- chrome ---------- */
.top{border-bottom:1px solid var(--line);background:var(--surface);position:sticky;top:0;z-index:10}
.top .inner{max-width:72rem;margin:0 auto;padding:.9rem clamp(1rem,3vw,2rem);display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1.6rem}
.brand{font-family:var(--f-display);font-weight:700;font-size:1.1rem;letter-spacing:-.01em;text-decoration:none;color:var(--ink);white-space:nowrap}
.brand span{color:var(--accent)}
.nav{display:flex;flex-wrap:wrap;gap:.25rem;margin-left:auto}
.nav a{text-decoration:none;color:var(--ink-soft);font-size:.94rem;padding:.3rem .65rem;border-radius:2px}
.nav a:hover{color:var(--accent);background:var(--surface-2)}
.nav a[aria-current]{color:var(--accent);background:var(--accent-bg);font-weight:500}

.wrap{max-width:72rem;margin:0 auto;padding:clamp(1.5rem,4vw,2.75rem) clamp(1rem,3vw,2rem) 6rem}

/* ---------- type ---------- */
h1{font-family:var(--f-display);font-weight:700;font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.14;letter-spacing:-.015em;margin:0 0 .6rem;text-wrap:balance;max-width:24ch}
h1.long{font-size:clamp(1.35rem,3vw,1.9rem);max-width:32ch}
h2{font-family:var(--f-display);font-weight:700;font-size:1.35rem;line-height:1.25;margin:2.75rem 0 .35rem;text-wrap:balance}
h2:first-of-type{margin-top:2rem}
.sub{color:var(--ink-soft);max-width:64ch;margin:0 0 1.5rem;font-size:1.02rem}
.hint{color:var(--ink-faint);font-size:.92rem;max-width:64ch;margin:.15rem 0 1.25rem}

/* ---------- breadcrumb ---------- */
.back{display:inline-block;font-size:.9rem;color:var(--ink-soft);text-decoration:none;margin-bottom:1.1rem}
.back:hover{color:var(--accent)}

/* ---------- metrics ---------- */
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr));gap:1px;background:var(--line);border:1px solid var(--line);box-shadow:var(--shadow);margin-bottom:2rem}
.metric{background:var(--surface);padding:1.1rem 1.25rem;display:flex;flex-direction:column;gap:.15rem}
.metric .v{font-family:var(--f-display);font-weight:700;font-size:1.7rem;line-height:1.05;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.metric .k{font-size:.86rem;color:var(--ink-soft);line-height:1.4}

/* ---------- filters ---------- */
form.filters{display:flex;flex-wrap:wrap;gap:.55rem;margin-bottom:.9rem;align-items:center}
input,select{font-family:inherit;font-size:.95rem;color:var(--ink);background:var(--surface);border:1px solid var(--line);padding:.55rem .75rem;min-width:0}
input[type=search]{flex:1 1 20rem}
select{max-width:24rem}
button{font-family:inherit;font-size:.95rem;font-weight:500;color:#fff;background:var(--accent);border:1px solid var(--accent);padding:.55rem 1.15rem;cursor:pointer}
:root[data-theme="dark"] button,:root:not([data-theme="light"]) button{color:#0E151B}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]) button{color:#fff}}
button:hover{filter:brightness(1.08)}
.check{display:flex;align-items:center;gap:.4rem;font-size:.93rem;color:var(--ink-soft);white-space:nowrap}
.check input{min-width:auto}
.reset{font-size:.9rem;color:var(--ink-faint)}

/* ---------- result rows ---------- */
.rows{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);box-shadow:var(--shadow)}
.row{background:var(--surface);padding:1.15rem 1.35rem;display:grid;grid-template-columns:1fr minmax(7rem,auto);gap:.55rem 1.75rem;align-items:start}
.row:hover{background:var(--surface-3)}
.row .who{min-width:0}
.row .name{font-size:1.06rem;font-weight:600;line-height:1.4;letter-spacing:-.005em}
.row .name a{color:var(--ink);text-decoration:none}
.row .name a:hover{color:var(--accent);text-decoration:underline}
.row .meta{font-size:.9rem;color:var(--ink-soft);margin-top:.25rem;line-height:1.5}
.row .meta a{color:var(--ink-soft)}
.row .meta a:hover{color:var(--accent)}
.row .ref{font-family:var(--f-mono);font-size:.78rem;color:var(--ink-faint)}
.row .amount{text-align:right}
.row .amount .big{font-family:var(--f-display);font-weight:700;font-size:1.2rem;line-height:1.2;font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:-.01em}
.row .amount .exact{font-family:var(--f-mono);font-size:.74rem;color:var(--ink-faint);white-space:nowrap;display:block;margin-top:.15rem}
.row .flags{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.3rem}
@media (max-width:40rem){.row{grid-template-columns:1fr}.row .amount{text-align:left}.row .amount .exact{display:inline;margin-left:.5rem}}

/* ---------- badges ---------- */
.flag{font-size:.84rem;line-height:1.35;padding:.28rem .6rem;border:1px solid var(--line);background:var(--surface-2);color:var(--ink-soft);text-decoration:none;border-radius:2px}
a.flag:hover{border-color:var(--accent);color:var(--accent)}
.flag.alarm{border-color:var(--alarm);background:var(--alarm-bg);color:var(--alarm);font-weight:500}
.flag.warn{border-color:var(--warn);background:var(--warn-bg);color:var(--warn)}
.tier{font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:.24rem .55rem;border:1px solid currentColor;white-space:nowrap;border-radius:2px}
.tier.confirmed{color:var(--calm);background:var(--calm-bg)}
.tier.state{color:var(--warn);background:var(--warn-bg)}
.tier.own{color:var(--ink-faint);background:var(--surface-2)}
.code{font-family:var(--f-mono);font-size:.74rem;color:var(--ink-faint)}

/* ---------- cards ---------- */
.card{background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow);padding:1.4rem 1.55rem;margin-bottom:1rem}
.card h3{margin:0 0 .5rem;font-size:1.08rem;font-weight:600;line-height:1.4;letter-spacing:-.005em}
.card p{margin:0 0 .7rem;color:var(--ink-soft);max-width:68ch}
.card p:last-child{margin-bottom:0}
.card p.lead{color:var(--ink);font-size:1.02rem}
.legal{border-left:3px solid var(--accent);background:var(--accent-bg);padding:.75rem 1rem;font-size:.94rem;color:var(--ink);max-width:none}
.faint{color:var(--ink-faint);font-size:.9rem}

.group{margin:2rem 0 .75rem;display:flex;align-items:baseline;gap:.75rem;flex-wrap:wrap}
.group h3{font-family:var(--f-display);font-weight:700;font-size:1.12rem;margin:0}
.group .count{font-size:.88rem;color:var(--ink-faint)}

dl.facts{display:grid;grid-template-columns:minmax(8rem,max-content) 1fr;gap:.55rem 1.5rem;margin:0}
dl.facts dt{font-size:.86rem;color:var(--ink-faint);padding-top:.1rem}
dl.facts dd{margin:0;font-size:1rem}
dl.facts dd strong{font-weight:600}
@media (max-width:34rem){dl.facts{grid-template-columns:1fr;gap:.05rem}dl.facts dd{margin-bottom:.7rem}}

/* ---------- misc ---------- */
.pager{display:flex;gap:.6rem;align-items:center;margin-top:1.75rem;font-size:.94rem}
.pager a{padding:.5rem 1rem;border:1px solid var(--line);background:var(--surface);text-decoration:none}
.pager a:hover{border-color:var(--accent)}
.pager span{color:var(--ink-faint)}
.empty{background:var(--surface);border:1px dashed var(--line);padding:3rem 1.5rem;text-align:center;color:var(--ink-soft)}
.note{font-size:.9rem;color:var(--ink-faint);max-width:68ch;margin-top:2.5rem;padding-top:1.15rem;border-top:1px solid var(--line)}

details.help{background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow);margin-bottom:1.75rem}
details.help summary{cursor:pointer;padding:.85rem 1.25rem;font-weight:500;font-size:.97rem;list-style:none;display:flex;align-items:center;gap:.5rem}
details.help summary::-webkit-details-marker{display:none}
details.help summary::before{content:"?";display:inline-flex;align-items:center;justify-content:center;width:1.35rem;height:1.35rem;border:1px solid var(--accent);color:var(--accent);font-size:.82rem;font-weight:600;flex:none}
details.help[open] summary{border-bottom:1px solid var(--line-soft)}
details.help .inner{padding:1.1rem 1.25rem 1.35rem}
details.help p{margin:0 0 .7rem;color:var(--ink-soft);max-width:68ch}
details.help p:last-child{margin-bottom:0}
`;

export function layout(opts: { title: string; nav?: string; body: string }): string {
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)} — Tender Radar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>${STYLES}</style>
</head>
<body>
<header class="top"><div class="inner">
  <a class="brand" href="/">Tender<span>&nbsp;Radar</span></a>
  <nav class="nav">
    <a href="/"${opts.nav === "feed" ? ' aria-current="page"' : ""}>Знахідки</a>
    <a href="/entities"${opts.nav === "entities" ? ' aria-current="page"' : ""}>Замовники</a>
    <a href="/officers"${opts.nav === "officers" ? ' aria-current="page"' : ""}>Посадовці</a>
    <a href="/suppliers"${opts.nav === "suppliers" ? ' aria-current="page"' : ""}>Переможці</a>
    <a href="/indicators"${opts.nav === "indicators" ? ' aria-current="page"' : ""}>Що ми шукаємо</a>
    <a href="/about"${opts.nav === "about" ? ' aria-current="page"' : ""}>Про систему</a>
  </nav>
</div></header>
<main class="wrap">
${opts.body}
</main>
</body>
</html>`;
}
