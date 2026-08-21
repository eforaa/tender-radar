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

/**
 * Money that must keep its kopiykas: a unit price of 13.22 UAH per kWh becomes
 * meaningless when rounded to 13.
 */
export function unitMoney(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  const digits = Math.abs(amount) < 1000 ? 2 : 0;
  return new Intl.NumberFormat("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount) + " ₴";
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
  color-scheme: light;

  --paper:#F6F8F9; --surface:#FFFFFF; --surface-2:#EEF3F5; --surface-3:#FAFCFC;
  --ink:#17222B; --ink-soft:#4A5966; --ink-faint:#7C8B96;
  --line:#DDE4E8; --line-soft:#EBF0F2;
  --accent:#17607F; --accent-bg:#E6F0F4;
  --alarm:#A03A2B; --alarm-bg:#FBE9E5;
  --warn:#87621F; --warn-bg:#FAF0DC;
  --calm:#276B4C; --calm-bg:#E4F1EA;
  --shadow:0 1px 2px rgba(23,34,43,.04), 0 8px 24px -18px rgba(23,34,43,.26);
  --radius:5px;
  --f-display:"Literata",Georgia,serif;
  --f-body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;
  --f-mono:"IBM Plex Mono",Consolas,monospace;
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

/* Slide-in drawer. CSS only — a checkbox drives it, because <details>
   cannot animate between display:none and shown. The checkbox is hidden
   visually rather than with display:none, which keeps it keyboard-reachable
   and keeps the sibling selectors working. */
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.burger{border-radius:var(--radius);flex:none;cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:4px;width:2.4rem;height:2.4rem;padding:.55rem;border:1px solid var(--line);background:var(--surface)}
.burger span{display:block;height:2px;background:var(--ink);border-radius:1px;transition:background .2s ease}
.burger:hover{border-color:var(--accent)}
.burger:hover span{background:var(--accent)}
#menu-toggle:focus-visible + .top .burger{border-radius:var(--radius);outline:2px solid var(--accent);outline-offset:2px}

.scrim{position:fixed;inset:0;background:rgba(10,18,24,.42);opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s ease;z-index:40;cursor:pointer}
#menu-toggle:checked ~ .scrim{opacity:1;visibility:visible}

.drawer{position:fixed;top:0;right:0;bottom:0;width:min(20rem,86vw);background:var(--surface);border-left:1px solid var(--line);box-shadow:-18px 0 40px -24px rgba(10,18,24,.55);z-index:50;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.32,.72,.32,1);overflow-y:auto}
#menu-toggle:checked ~ .drawer{transform:translateX(0)}

.drawer-head{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.15rem;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface)}
.drawer-head strong{font-family:var(--f-display);font-size:1.02rem;font-weight:700}
.drawer-close{cursor:pointer;font-size:1.5rem;line-height:1;color:var(--ink-faint);padding:.1rem .45rem;border:1px solid transparent}
.drawer-close:hover{color:var(--accent);border-color:var(--line)}
.drawer a{display:flex;flex-direction:column;gap:.05rem;padding:.8rem 1.15rem;text-decoration:none;color:var(--ink);border-bottom:1px solid var(--line-soft);font-size:.99rem}
.drawer a:last-child{border-bottom:0}
.drawer a:hover{background:var(--surface-2);color:var(--accent)}
.drawer a[aria-current]{background:var(--accent-bg);color:var(--accent);font-weight:500;box-shadow:inset 3px 0 0 var(--accent)}
.drawer small{color:var(--ink-faint);font-size:.82rem;font-weight:400}

@media (prefers-reduced-motion: reduce){.drawer,.scrim{transition-duration:.01ms}}
@media (max-width:30rem){.nav a:not([href="/"]):not([href="/railway"]){display:none}}

.wrap{max-width:72rem;margin:0 auto;padding:clamp(1.5rem,4vw,2.75rem) clamp(1rem,3vw,2rem) 6rem}

/* ---------- type ---------- */
h1{font-family:var(--f-display);font-weight:700;font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.14;letter-spacing:-.015em;margin:0 0 .6rem;text-wrap:balance;max-width:24ch}
h1.long{font-size:clamp(1.35rem,3vw,1.9rem);max-width:32ch}
h2{font-family:var(--f-display);font-weight:700;font-size:1.35rem;line-height:1.25;margin:2.75rem 0 .35rem;text-wrap:balance}
h2:first-of-type{margin-top:2rem}
.sub{color:var(--ink-soft);max-width:64ch;margin:0 0 1.5rem;font-size:1.02rem}
.hint{color:var(--ink-faint);font-size:.92rem;max-width:64ch;margin:.15rem 0 1.25rem}
.statline{display:flex;flex-wrap:wrap;gap:.3rem .55rem;align-items:baseline;font-size:.95rem;color:var(--ink-soft);margin:0 0 .5rem;max-width:none}
.statline b{font-family:var(--f-display);font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.caution{font-size:.88rem;line-height:1.5;color:var(--alarm);background:var(--alarm-bg);border:1px solid var(--alarm);border-radius:var(--radius);padding:.5rem .75rem;margin:0 0 1.5rem;max-width:72ch}

/* ---------- breadcrumb ---------- */
.back{display:inline-block;font-size:.9rem;color:var(--ink-soft);text-decoration:none;margin-bottom:1.1rem}
.back:hover{color:var(--accent)}


/* ---------- filters ---------- */
form.filters{display:flex;flex-wrap:wrap;gap:.55rem;margin-bottom:.9rem;align-items:center}
input,select{border-radius:var(--radius);font-family:inherit;font-size:.95rem;color:var(--ink);background:var(--surface);border:1px solid var(--line);padding:.55rem .75rem;min-width:0}
input[type=search]{flex:1 1 20rem}
select{max-width:24rem}
button{border-radius:var(--radius);font-family:inherit;font-size:.95rem;font-weight:500;color:#fff;background:var(--accent);border:1px solid var(--accent);padding:.55rem 1.15rem;cursor:pointer}
button:hover{filter:brightness(1.08)}
.check{display:flex;align-items:center;gap:.4rem;font-size:.93rem;color:var(--ink-soft);white-space:nowrap}
.check input{min-width:auto}
.reset{font-size:.9rem;color:var(--ink-faint)}
form.filters{flex-direction:column;align-items:stretch;gap:.6rem}
.filter-row{display:flex;flex-wrap:wrap;gap:.55rem;align-items:center}
/* Inputs must not stretch vertically: the form itself is a column, so a
   bare flex-grow on a child would grow it down the page. */
.filter-row input,.filter-row select,.filter-row button{align-self:center}
.filter-row input[type=search]{flex:1 1 22rem;max-width:38rem}
.filter-row input[type=date]{flex:0 0 auto;width:10.5rem}
.filter-row input.num{flex:0 0 auto;width:9rem;font-variant-numeric:tabular-nums}
.filter-label.faint{color:var(--ink-faint);font-size:.85rem}

/* the collapsed filter panel */
.filters-more{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.filters-more summary{cursor:pointer;list-style:none;padding:.6rem .9rem;font-size:.95rem;font-weight:500;color:var(--accent);display:flex;align-items:center;gap:.5rem}
.filters-more summary::-webkit-details-marker{display:none}
.filters-more summary::before{content:"▸";color:var(--ink-faint);font-size:.8rem;transition:transform .15s ease;display:inline-block}
.filters-more[open] summary::before{transform:rotate(90deg)}
.filters-more[open] summary{border-bottom:1px solid var(--line-soft)}
.filters-more summary:hover{background:var(--surface-3)}
.filters-more .inner{padding:.9rem;display:flex;flex-direction:column;gap:.6rem}
.block-head{font-family:var(--f-display);font-weight:700;font-size:1.1rem;margin:1.75rem 0 .35rem}
.badge{background:var(--accent);color:#fff;font-size:.75rem;font-weight:600;min-width:1.3rem;height:1.3rem;border-radius:1rem;display:inline-flex;align-items:center;justify-content:center;padding:0 .4rem}
/* star toggle — a form so the site still needs no scripts */
.star-form{display:inline;margin:0}
.star{background:none;border:0;padding:0 .4rem 0 0;margin:0;cursor:pointer;font-size:1.15rem;line-height:1;color:var(--ink-faint);border-radius:var(--radius);vertical-align:baseline}
.star:hover{color:var(--warn)}
.star.on{color:#D9A21B}
.star span{display:none}
.name .star{float:left}

/* the labelled variant, used at the top of a dossier */
.star-form:has(.star span){display:inline-block;margin:0 0 1.25rem}
.star:has(span){display:inline-flex;align-items:center;gap:.5rem;font-size:1rem;border:1px solid var(--line);background:var(--surface);padding:.45rem .9rem;color:var(--accent)}
.star:has(span) span{display:inline}
.star.on:has(span){background:var(--accent-bg);border-color:var(--accent);font-weight:500}
.name .star:has(span){float:none}

.starred-btn{display:inline-flex;align-items:center;gap:.4rem;text-decoration:none;color:var(--ink-soft);font-size:.94rem;padding:.3rem .65rem;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.starred-btn:hover{color:var(--accent);border-color:var(--accent)}
.starred-btn.on{color:var(--accent);background:var(--accent-bg);border-color:var(--accent);font-weight:500}
@media (max-width:34rem){.starred-btn span{display:none}}
.filter-label{font-size:.92rem;color:var(--ink-faint);white-space:nowrap}
select:disabled{opacity:.5;cursor:not-allowed}

/* grouped results */
.group-block{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow);margin-bottom:.6rem}
.group-block summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.4rem 1rem;padding:.85rem 1.15rem}
.group-block summary::-webkit-details-marker{display:none}
.group-block summary::before{content:"▸";color:var(--ink-faint);margin-right:.5rem;font-size:.8rem;transition:transform .15s ease;display:inline-block}
.group-block[open] > summary::before{transform:rotate(90deg)}
.group-block[open] > summary{border-bottom:1px solid var(--line-soft)}
.group-block summary:hover{background:var(--surface-3)}
.g-name{font-weight:600;font-size:1.02rem;flex:1 1 18rem;min-width:0}
.g-meta{font-size:.9rem;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
.g-body{padding:.9rem 1.15rem 1.15rem}
.group-block .depth-1{background:var(--surface-3);box-shadow:none}
.group-block .rows{box-shadow:none}

/* ---------- result rows ---------- */
.rows{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
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
.card{background:var(--surface);border-radius:var(--radius);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:1.4rem 1.55rem;margin-bottom:1rem}
.card h3{margin:0 0 .5rem;font-size:1.08rem;font-weight:600;line-height:1.4;letter-spacing:-.005em}
.card p{margin:0 0 .7rem;color:var(--ink-soft);max-width:68ch}
.card p:last-child{margin-bottom:0}
.card p.lead{color:var(--ink);font-size:1.02rem}
.legal{border-left:3px solid var(--accent);background:var(--accent-bg);padding:.75rem 1rem;font-size:.94rem;color:var(--ink);max-width:none;border-radius:0 var(--radius) var(--radius) 0}
.legal.reading{border-left-color:var(--warn);background:var(--warn-bg)}
details.sub{margin:.9rem 0 .2rem;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface-3)}
details.sub summary{cursor:pointer;list-style:none;padding:.6rem .9rem;font-size:.93rem;font-weight:500;color:var(--accent)}
details.sub summary::-webkit-details-marker{display:none}
details.sub summary::before{content:"+";display:inline-block;width:1.1rem;color:var(--ink-faint);font-weight:600}
details.sub[open] summary::before{content:"−"}
details.sub[open] summary{border-bottom:1px solid var(--line-soft)}
details.sub .inner{padding:.85rem .9rem 1rem}
details.sub p{margin:0 0 .8rem;font-size:.93rem;max-width:68ch}
details.sub p:last-child{margin-bottom:0}
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
.card ul{margin:.2rem 0 .9rem;padding-left:1.2rem;color:var(--ink-soft);max-width:68ch}
.card li{margin-bottom:.4rem}
.note{font-size:.9rem;color:var(--ink-faint);max-width:68ch;margin-top:2.5rem;padding-top:1.15rem;border-top:1px solid var(--line)}

details.help{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:1.75rem}
details.help summary{cursor:pointer;padding:.85rem 1.25rem;font-weight:500;font-size:.97rem;list-style:none;display:flex;align-items:center;gap:.5rem}
details.help summary::-webkit-details-marker{display:none}
details.help summary::before{content:"?";display:inline-flex;align-items:center;justify-content:center;width:1.35rem;height:1.35rem;border:1px solid var(--accent);color:var(--accent);font-size:.82rem;font-weight:600;flex:none}
details.help[open] summary{border-bottom:1px solid var(--line-soft)}
details.help .inner{padding:1.1rem 1.25rem 1.35rem}
details.help p{margin:0 0 .7rem;color:var(--ink-soft);max-width:68ch}
details.help p:last-child{margin-bottom:0}
details.help ul{margin:.2rem 0 .9rem;padding-left:1.2rem;color:var(--ink-soft);max-width:68ch}
details.help li{margin-bottom:.35rem}
details.help p.lead{color:var(--ink)}
details.help p strong{color:var(--ink)}
details.help + details.help{margin-top:-1rem}
`;

/** Everything reachable from the burger menu, with a line of orientation. */
const MENU = [
  { href: "/", nav: "feed", label: "Усі закупівлі", hint: "повний перелік, з пошуком і фільтрами" },
  { href: "/railway", nav: "railway", label: "Залізниця", hint: "закупівлі залізниці Харківщини" },
  { href: "/prices", nav: "prices", label: "Завищені ціни", hint: "де ми самі порахували переплату" },
  { href: "/starred", nav: "starred", label: "Обране", hint: "усе, що ви позначили зірочкою" },
  { href: "/lookup", nav: "lookup", label: "Пошук за ЄДРПОУ", hint: "перевірити будь-яке підприємство" },
  { href: "/article/366", nav: "article-366", label: "Підроблення документів", hint: "розбіжності в договорах і звітах" },
  { href: "/entities", nav: "entities", label: "Хто купує", hint: "установи-замовники" },
  { href: "/suppliers", nav: "suppliers", label: "Хто продає", hint: "компанії-переможці" },
  { href: "/officers", nav: "officers", label: "Хто відповідає", hint: "посадовці, що вели закупівлі" },
  { href: "/indicators", nav: "indicators", label: "Що ми перевіряємо", hint: "усі ознаки простими словами" },
  { href: "/updates", nav: "updates", label: "Що нового", hint: "останнє оновлення бази" },
  { href: "/about", nav: "about", label: "Про систему", hint: "звідки дані і чого вона не робить" },
];

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
<input type="checkbox" id="menu-toggle" class="sr-only" aria-label="Показати всі розділи">
<header class="top"><div class="inner">
  <a class="brand" href="/">Tender<span>&nbsp;Radar</span></a>
  <nav class="nav">
    <a href="/"${opts.nav === "feed" ? ' aria-current="page"' : ""}>Закупівлі</a>
    <a href="/railway"${opts.nav === "railway" ? ' aria-current="page"' : ""}>Залізниця</a>
    <a href="/about"${opts.nav === "about" ? ' aria-current="page"' : ""}>Про систему</a>
  </nav>
  <a class="starred-btn${opts.nav === "starred" ? " on" : ""}" href="/starred" title="Обране">★<span>Обране</span></a>
  <label class="burger" for="menu-toggle" role="button" aria-label="Усі розділи" title="Усі розділи"><span></span><span></span><span></span></label>
</div></header>
<label class="scrim" for="menu-toggle" aria-hidden="true"></label>
<nav class="drawer" aria-label="Усі розділи">
  <div class="drawer-head">
    <strong>Розділи</strong>
    <label class="drawer-close" for="menu-toggle" role="button" aria-label="Закрити">&times;</label>
  </div>
  ${MENU.map(
    (item) =>
      `<a href="${item.href}"${opts.nav === item.nav ? ' aria-current="page"' : ""}>${item.label}<small>${item.hint}</small></a>`,
  ).join("")}
</nav>
<main class="wrap">
${opts.body}
</main>
</body>
</html>`;
}
