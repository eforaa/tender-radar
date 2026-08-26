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

const MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

/**
 * Formats the calendar day the source published, without touching timezones.
 *
 * Parsing "2026-04-14T00:00:00+03:00" into a Date and formatting it renders
 * the previous day wherever the server does not sit in Kyiv — and Vercel runs
 * in UTC. These are Ukrainian dates published by Ukrainian systems, so the
 * date part of the string is the answer; converting it can only be wrong.
 */
export function date(value: string | null): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return "—";
  const [, year, month, day] = m;
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day)} ${name} ${year} р.` : `${day}.${month}.${year}`;
}

/** The same day, in the short numeric form used in documents. */
export function shortDate(value: string | null): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
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
:root{
  color-scheme: light;

  /* Rhythm. Every spacing value in this file comes from here — the old file
     had twenty ad-hoc values, and that irregularity is what read as clutter. */
  --s1:.25rem; --s2:.5rem;  --s3:.75rem; --s4:1rem;
  --s5:1.5rem; --s6:2rem;   --s7:3rem;   --s8:4rem;

  /* Paper, not screen: the old palette had a cold blue cast that dated it. */
  --paper:#FCFCFA; --surface:#FFFFFF; --surface-2:#F3F3EF;
  --ink:#14181A; --ink-soft:#565B60; --ink-faint:#8B9096;
  --line:#E4E3DD; --line-soft:#EFEEE9;

  --accent:#0F5C8C; --accent-bg:#E8F0F7;
  --alarm:#B02418; --alarm-bg:#FBEAE7;
  --warn:#8A6100;  --warn-bg:#FAF2DE;
  --calm:#1E6B43;  --calm-bg:#E6F1EA;

  /* One shadow, for the drawer that genuinely floats. Cards use their border. */
  --shadow:0 12px 32px -20px rgba(20,24,26,.45);
  --radius:8px; --radius-sm:4px;

  /* One voice instead of the safe serif-plus-grotesque pair. Ysabeau is a
     Garamond-boned sans that carries both display sizes and body copy. */
  --f-display:"Ysabeau","Segoe UI",system-ui,sans-serif;
  --f-body:"Ysabeau","Segoe UI",system-ui,sans-serif;
  --f-mono:"IBM Plex Mono",Consolas,monospace;
}
*{box-sizing:border-box}
pre,table{overflow-x:auto;max-width:100%}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-underline-offset:3px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* ---------- chrome ---------- */
.top{border-bottom:1px solid var(--line);background:var(--surface);position:sticky;top:0;z-index:10}
.top .inner{max-width:72rem;margin:0 auto;padding:var(--s4) clamp(var(--s4),3vw,var(--s6));display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5)}
.brand{display:flex;align-items:center;gap:var(--s2);font-family:var(--f-display);font-weight:700;font-size:1.1rem;letter-spacing:-.01em;text-decoration:none;color:var(--ink);white-space:nowrap}
.brand span{color:var(--accent)}
/* radius-sm, not the standard radius: the mark carries its own near-black
   backdrop, and square-cornered on a light header it reads as a black
   rectangle rather than a logo. */
.brand-mark{width:28px;height:28px;border-radius:var(--radius-sm);flex:none}
.nav{display:flex;flex-wrap:wrap;gap:var(--s1);margin-left:auto}
.nav a{text-decoration:none;color:var(--ink-soft);font-size:.94rem;padding:var(--s1) var(--s3);border-radius:2px}
.nav a:hover{color:var(--accent);background:var(--surface-2)}
.nav a[aria-current]{color:var(--accent);background:var(--accent-bg);font-weight:500}

/* Slide-in drawer. CSS only — a checkbox drives it, because <details>
   cannot animate between display:none and shown. The checkbox is hidden
   visually rather than with display:none, which keeps it keyboard-reachable
   and keeps the sibling selectors working. */
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.burger{border-radius:var(--radius);flex:none;cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:4px;width:2.4rem;height:2.4rem;padding:var(--s2);border:1px solid var(--line);background:var(--surface)}
.burger span{display:block;height:2px;background:var(--ink);border-radius:1px;transition:background .2s ease}
.burger:hover{border-color:var(--accent)}
.burger:hover span{background:var(--accent)}
#menu-toggle:focus-visible + .top .burger{border-radius:var(--radius);outline:2px solid var(--accent);outline-offset:2px}

.scrim{position:fixed;inset:0;background:rgba(10,18,24,.42);opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s ease;z-index:40;cursor:pointer}
#menu-toggle:checked ~ .scrim{opacity:1;visibility:visible}

.drawer{position:fixed;top:0;right:0;bottom:0;width:min(20rem,86vw);background:var(--surface);border-left:1px solid var(--line);box-shadow:-18px 0 40px -24px rgba(10,18,24,.55);z-index:50;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.32,.72,.32,1);overflow-y:auto}
#menu-toggle:checked ~ .drawer{transform:translateX(0)}

.drawer-head{display:flex;align-items:center;justify-content:space-between;padding:var(--s4) var(--s4);border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface)}
.drawer-head strong{font-family:var(--f-display);font-size:1.02rem;font-weight:700}
.drawer-close{cursor:pointer;font-size:1.5rem;line-height:1;color:var(--ink-faint);padding:var(--s1) var(--s2);border:1px solid transparent}
.drawer-close:hover{color:var(--accent);border-color:var(--line)}
.drawer a{display:flex;flex-direction:column;gap:var(--s1);padding:var(--s3) var(--s4);text-decoration:none;color:var(--ink);border-bottom:1px solid var(--line-soft);font-size:.99rem}
.drawer a:last-child{border-bottom:0}
.drawer a:hover{background:var(--surface-2);color:var(--accent)}
.drawer a[aria-current]{background:var(--accent-bg);color:var(--accent);font-weight:500;box-shadow:inset 3px 0 0 var(--accent)}
.drawer small{color:var(--ink-faint);font-size:.82rem;font-weight:400}

@media (prefers-reduced-motion: reduce){.drawer,.scrim,.filters-drawer,.filters-scrim{transition-duration:.01ms}}

.wrap{max-width:72rem;margin:0 auto;padding:clamp(var(--s4),2.5vw,var(--s5)) clamp(var(--s4),3vw,var(--s6)) var(--s8)}

/* ---------- type ---------- */
h1{font-family:var(--f-display);font-weight:700;font-size:clamp(1.5rem,3vw,1.95rem);line-height:1.18;letter-spacing:-.015em;margin:0 0 var(--s2);text-wrap:balance;max-width:30ch}
h1.long{font-size:clamp(1.35rem,3vw,1.9rem);max-width:32ch}
h2{font-family:var(--f-display);font-weight:700;font-size:1.35rem;line-height:1.25;margin:var(--s7) 0 var(--s2);text-wrap:balance}
h2:first-of-type{margin-top:var(--s6)}
.sub{color:var(--ink-soft);max-width:80ch;margin:0 0 var(--s2);font-size:.95rem}
.hint{color:var(--ink-faint);font-size:.89rem;max-width:70ch;margin:var(--s1) 0 var(--s3)}
.statline{display:flex;flex-wrap:wrap;gap:var(--s1) var(--s2);align-items:baseline;font-size:.88rem;color:var(--ink-soft);margin:0 0 var(--s3);max-width:none}
.statline b{font-family:var(--f-body);font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.caution{font-size:.88rem;line-height:1.5;color:var(--alarm);background:var(--alarm-bg);border:1px solid var(--alarm);border-radius:var(--radius);padding:var(--s2) var(--s3);margin:0 0 var(--s5);max-width:72ch}

/* ---------- breadcrumb ---------- */
.back{display:inline-block;font-size:.9rem;color:var(--ink-soft);text-decoration:none;margin-bottom:var(--s4)}
.back:hover{color:var(--accent)}


/* ---------- filters ---------- */
form.filters{display:flex;flex-wrap:wrap;gap:var(--s2);margin-bottom:var(--s4);align-items:center}
input,select{border-radius:var(--radius);font-family:inherit;font-size:.95rem;color:var(--ink);background:var(--surface);border:1px solid var(--line);padding:var(--s2) var(--s3);min-width:0}
input[type=search]{flex:1 1 20rem}
select{max-width:24rem}
button{border-radius:var(--radius);font-family:inherit;font-size:.95rem;font-weight:500;color:#fff;background:var(--accent);border:1px solid var(--accent);padding:var(--s2) var(--s4);cursor:pointer}
button:hover{filter:brightness(1.08)}
.check{display:flex;align-items:center;gap:var(--s2);font-size:.93rem;color:var(--ink-soft);white-space:nowrap}
.check input{min-width:auto}
.reset{font-size:.9rem;color:var(--ink-faint)}
form.filters{flex-direction:column;align-items:stretch;gap:var(--s3)}
.filter-row{display:flex;flex-wrap:wrap;gap:var(--s2);align-items:center}
/* Inputs must not stretch vertically: the form itself is a column, so a
   bare flex-grow on a child would grow it down the page. */
.filter-row input,.filter-row select,.filter-row button{align-self:center}
.filter-row input[type=search]{flex:1 1 22rem;max-width:38rem}
.filter-row input[type=date]{flex:0 0 auto;width:10.5rem}
.filter-row input.num{flex:0 0 auto;width:9rem;font-variant-numeric:tabular-nums}
.filter-label.faint{color:var(--ink-faint);font-size:.85rem}

/* the collapsed filter panel */
.filters-more{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.filters-more summary{cursor:pointer;list-style:none;padding:var(--s3) var(--s4);font-size:.95rem;font-weight:500;color:var(--accent);display:flex;align-items:center;gap:var(--s2)}
.filters-more summary::-webkit-details-marker{display:none}
.filters-more summary::before{content:"▸";color:var(--ink-faint);font-size:.8rem;transition:transform .15s ease;display:inline-block}
.filters-more[open] summary::before{transform:rotate(90deg)}
.filters-more[open] summary{border-bottom:1px solid var(--line-soft)}
.filters-more summary:hover{background:var(--surface)}
.filters-more .inner{padding:var(--s4);display:flex;flex-direction:column;gap:var(--s3)}
.verdict{border-left:4px solid var(--ink-faint)}
.verdict.high{border-left-color:var(--alarm)}
.verdict.medium{border-left-color:var(--warn)}
.verdict.low{border-left-color:var(--ink-faint)}
.verdict-tag{display:inline-block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:var(--s1) var(--s2);border-radius:2px;margin-right:var(--s2);vertical-align:middle}
.verdict.high .verdict-tag{color:var(--alarm);background:var(--alarm-bg);border:1px solid var(--alarm)}
.verdict.medium .verdict-tag{color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn)}
.verdict.low .verdict-tag{color:var(--ink-faint);background:var(--surface-2);border:1px solid var(--line)}
ol.findings{margin:var(--s2) 0 var(--s4);padding-left:var(--s5);display:flex;flex-direction:column;gap:var(--s3)}
ol.findings li{max-width:68ch}
ol.findings li strong{display:block;margin-bottom:var(--s1)}
ol.findings li span{color:var(--ink-soft);font-size:.96rem}
ol.findings li.w-high::marker{color:var(--alarm);font-weight:700}
ol.findings li.w-medium::marker{color:var(--warn);font-weight:700}
/* the three-line explainer a newcomer reads once */
.primer{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s1) var(--s4);margin:0 0 var(--s3);padding:var(--s2) var(--s3);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);font-size:.85rem;color:var(--ink-soft)}
.primer b{display:inline-flex;align-items:center;justify-content:center;width:1.15rem;height:1.15rem;border-radius:50%;background:var(--accent);color:#fff;font-size:.7rem;margin-right:var(--s2)}
.primer span{display:inline-flex;align-items:center;white-space:nowrap}
.primer a{margin-left:auto;font-size:.88rem}

/* the mobile filter sheet: presets, sort/group and the filter panel share
   one checkbox-driven drawer, the same mechanism the nav drawer already
   uses in this file. Above 44rem there is room for all of it inline, so
   these rules just put the drawer back in normal flow and hide the trigger
   that only exists for the cramped case. */
.filters-trigger{display:none}
.filters-scrim{display:none}
.filters-drawer{position:static;transform:none;width:auto;box-shadow:none;border:0;background:transparent;overflow:visible}
.filters-drawer .drawer-head{display:none}
.filters-drawer-body{padding:0}

/* one-click starting points */
.presets{display:flex;flex-wrap:wrap;gap:var(--s2);margin:0 0 var(--s3)}
.preset{text-decoration:none;font-size:.88rem;color:var(--ink-soft);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:var(--s2) var(--s4);white-space:nowrap}
.preset:hover{border-color:var(--accent);color:var(--accent)}
.preset.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}

/* sorting and grouping, always in view */
.sortbar{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s3);align-items:center;margin:0 0 var(--s3);padding:var(--s2) var(--s3);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
.sortbar label{display:inline-flex;align-items:center;gap:var(--s2);font-size:.86rem;color:var(--ink-faint);white-space:nowrap}
.sortbar select{font-size:.88rem;padding:var(--s1) var(--s2);max-width:12.5rem}
.sortbar input[type=search]{flex:1 1 14rem;min-width:10rem;font-size:.9rem;padding:var(--s2) var(--s2)}
.sortbar .go{font-size:.9rem;padding:var(--s2) var(--s4)}
.filters{margin-bottom:var(--s4)}
.filters-more summary .reset{margin-left:auto}

.actions{display:flex;flex-wrap:wrap;gap:var(--s2);margin:0 0 var(--s5)}
.action{display:inline-flex;align-items:center;gap:var(--s2);text-decoration:none;font-size:.95rem;color:var(--accent);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:var(--s2) var(--s4)}
.action:hover{border-color:var(--accent);background:var(--accent-bg)}
.action.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}
.action.primary:hover{filter:brightness(1.08);background:var(--accent)}
.action.primary::before{content:"⤓";font-size:1.05rem}
.block-head{font-family:var(--f-display);font-weight:700;font-size:1.1rem;margin:var(--s5) 0 var(--s2)}
.badge{background:var(--accent);color:#fff;font-size:.75rem;font-weight:600;min-width:1.3rem;height:1.3rem;border-radius:1rem;display:inline-flex;align-items:center;justify-content:center;padding:0 var(--s2)}
/* star toggle — a form so the site still needs no scripts */
.star-form{display:inline;margin:0}
.star{background:none;border:0;padding:0 var(--s2) 0 0;margin:0;cursor:pointer;font-size:1.15rem;line-height:1;color:var(--ink-faint);border-radius:var(--radius);vertical-align:baseline}
.star:hover{color:var(--warn)}
.star.on{color:#D9A21B}
.star span{display:none}
.name .star{float:left}

/* the labelled variant, used at the top of a dossier */
.star-form:has(.star span){display:inline-block;margin:0 0 var(--s4)}
.star:has(span){display:inline-flex;align-items:center;gap:var(--s2);font-size:1rem;border:1px solid var(--line);background:var(--surface);padding:var(--s2) var(--s4);color:var(--accent)}
.star:has(span) span{display:inline}
.star.on:has(span){background:var(--accent-bg);border-color:var(--accent);font-weight:500}
.name .star:has(span){float:none}

.starred-btn{display:inline-flex;align-items:center;gap:var(--s2);text-decoration:none;color:var(--ink-soft);font-size:.94rem;padding:var(--s1) var(--s3);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.starred-btn:hover{color:var(--accent);border-color:var(--accent)}
.starred-btn.on{color:var(--accent);background:var(--accent-bg);border-color:var(--accent);font-weight:500}
.filter-label{font-size:.92rem;color:var(--ink-faint);white-space:nowrap}
select:disabled{opacity:.5;cursor:not-allowed}

/* grouped results */
.group-block{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow);margin-bottom:var(--s3)}
.group-block summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:var(--s2) var(--s4);padding:var(--s4) var(--s4)}
.group-block summary::-webkit-details-marker{display:none}
.group-block summary::before{content:"▸";color:var(--ink-faint);margin-right:var(--s2);font-size:.8rem;transition:transform .15s ease;display:inline-block}
.group-block[open] > summary::before{transform:rotate(90deg)}
.group-block[open] > summary{border-bottom:1px solid var(--line-soft)}
.group-block summary:hover{background:var(--surface)}
.g-name{font-weight:600;font-size:1.02rem;flex:1 1 18rem;min-width:0}
.g-meta{font-size:.9rem;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
.g-body{padding:var(--s4) var(--s4) var(--s4)}
.group-block .depth-1{background:var(--surface);box-shadow:none}
.group-block .rows{box-shadow:none}

/* ---------- result rows ---------- */
.rows{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
.row{background:var(--surface);padding:var(--s3) var(--s4);display:grid;grid-template-columns:auto 1fr minmax(6.5rem,auto);gap:var(--s1) var(--s4);align-items:start}
.row:hover{background:var(--surface)}

/* severity, readable at a glance and on hover */
.dot{grid-row:1 / span 2;width:.55rem;height:.55rem;border-radius:50%;margin-top:var(--s2);flex:none;background:var(--line)}
.sev-proven .dot{background:var(--alarm);box-shadow:0 0 0 3px var(--alarm-bg)}
.sev-high .dot{background:var(--alarm)}
.sev-medium .dot{background:var(--warn)}
.sev-clear .dot{background:var(--calm)}
.sev-low .dot{background:#C4D0D6}

.row .who{min-width:0}
.row .name{font-size:1rem;font-weight:600;line-height:1.4;letter-spacing:-.005em;overflow-wrap:anywhere}
.row .name a{color:var(--ink);text-decoration:none}
.row .name a:hover{color:var(--accent);text-decoration:underline}
.row .meta{font-size:.85rem;color:var(--ink-soft);line-height:1.4;overflow-wrap:anywhere}
.row .meta a{color:var(--ink-soft)}
.row .meta a:hover{color:var(--accent)}
.row .amount{text-align:right}
.row .amount .big{font-family:var(--f-display);font-weight:700;font-size:1.05rem;line-height:1.3;font-variant-numeric:tabular-nums;white-space:nowrap}
.row .amount .exact{font-family:var(--f-mono);font-size:.72rem;color:var(--ink-faint);white-space:nowrap;display:block;margin-top:var(--s1)}
.row .flags{grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:var(--s1);margin-top:var(--s1)}

a.flag:hover{border-color:var(--accent);color:var(--accent)}
.flag.alarm{border-color:var(--alarm);background:var(--alarm-bg);color:var(--alarm);font-weight:500}
.flag.warn{border-color:var(--warn);background:var(--warn-bg);color:var(--warn)}
.flag.more{color:var(--ink-faint);border-style:dashed}
.flag.proven{border-color:var(--alarm);background:var(--alarm);color:#fff;font-weight:600}
.flag.clear{border-color:var(--calm);background:var(--calm-bg);color:var(--calm);font-weight:500}
.tier{font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:var(--s1) var(--s2);border:1px solid currentColor;white-space:nowrap;border-radius:2px}
.tier.confirmed{color:var(--calm);background:var(--calm-bg)}
.tier.state{color:var(--warn);background:var(--warn-bg)}
.tier.own{color:var(--ink-faint);background:var(--surface-2)}
.code{font-family:var(--f-mono);font-size:.74rem;color:var(--ink-faint)}

/* ---------- cards ---------- */
.card{background:var(--surface);border-radius:var(--radius);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:var(--s5) var(--s5);margin-bottom:var(--s4)}
.card h3{margin:0 0 var(--s2);font-size:1.08rem;font-weight:600;line-height:1.4;letter-spacing:-.005em}
.card p{margin:0 0 var(--s3);color:var(--ink-soft);max-width:68ch}
.card p:last-child{margin-bottom:0}
.card p.lead{color:var(--ink);font-size:1.02rem}
.legal{border-left:3px solid var(--accent);background:var(--accent-bg);padding:var(--s3) var(--s4);font-size:.94rem;color:var(--ink);max-width:none;border-radius:0 var(--radius) var(--radius) 0}
.legal.reading{border-left-color:var(--warn);background:var(--warn-bg)}
details.sub{margin:var(--s4) 0 var(--s1);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
details.sub summary{cursor:pointer;list-style:none;padding:var(--s3) var(--s4);font-size:.93rem;font-weight:500;color:var(--accent)}
details.sub summary::-webkit-details-marker{display:none}
details.sub summary::before{content:"+";display:inline-block;width:1.1rem;color:var(--ink-faint);font-weight:600}
details.sub[open] summary::before{content:"−"}
details.sub[open] summary{border-bottom:1px solid var(--line-soft)}
details.sub .inner{padding:var(--s3) var(--s4) var(--s4)}
details.sub p{margin:0 0 var(--s3);font-size:.93rem;max-width:68ch}
details.sub p:last-child{margin-bottom:0}
.faint{color:var(--ink-faint);font-size:.9rem}

.group{margin:var(--s6) 0 var(--s3);display:flex;align-items:baseline;gap:var(--s3);flex-wrap:wrap}
.group h3{font-family:var(--f-display);font-weight:700;font-size:1.12rem;margin:0}
.group .count{font-size:.88rem;color:var(--ink-faint)}

dl.facts{display:grid;grid-template-columns:minmax(8rem,max-content) 1fr;gap:var(--s2) var(--s5);margin:0}
dl.facts dt{font-size:.86rem;color:var(--ink-faint);padding-top:var(--s1)}
dl.facts dd{margin:0;font-size:1rem}
dl.facts dd strong{font-weight:600}

/* ---------- misc ---------- */
.pager{display:flex;gap:var(--s3);align-items:center;margin-top:var(--s5);font-size:.94rem}
.pager a{padding:var(--s2) var(--s4);border:1px solid var(--line);background:var(--surface);text-decoration:none}
.pager a:hover{border-color:var(--accent)}
.pager span{color:var(--ink-faint)}
.empty{background:var(--surface);border:1px dashed var(--line);padding:var(--s7) var(--s5);text-align:center;color:var(--ink-soft)}
.card ul{margin:var(--s1) 0 var(--s4);padding-left:var(--s4);color:var(--ink-soft);max-width:68ch}
.card li{margin-bottom:var(--s2)}
.note{font-size:.9rem;color:var(--ink-faint);max-width:68ch;margin-top:var(--s7);padding-top:var(--s4);border-top:1px solid var(--line)}

details.help{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:var(--s5)}
details.help summary{cursor:pointer;padding:var(--s4) var(--s4);font-weight:500;font-size:.97rem;list-style:none;display:flex;align-items:center;gap:var(--s2)}
details.help summary::-webkit-details-marker{display:none}
details.help summary::before{content:"?";display:inline-flex;align-items:center;justify-content:center;width:1.35rem;height:1.35rem;border:1px solid var(--accent);color:var(--accent);font-size:.82rem;font-weight:600;flex:none}
details.help[open] summary{border-bottom:1px solid var(--line-soft)}
details.help .inner{padding:var(--s4) var(--s4) var(--s4)}
details.help p{margin:0 0 var(--s3);color:var(--ink-soft);max-width:68ch}
details.help p:last-child{margin-bottom:0}
details.help ul{margin:var(--s1) 0 var(--s4);padding-left:var(--s4);color:var(--ink-soft);max-width:68ch}
details.help li{margin-bottom:var(--s2)}
details.help p.lead{color:var(--ink)}
details.help p strong{color:var(--ink)}
details.help + details.help{margin-top:calc(-1 * var(--s4))}
/* ---------- screens ----------
   Every size decision lives here rather than beside the rule it overrides.
   Phones get a single column, thumb-sized hit areas and 16px form text:
   anything smaller and iOS zooms the whole page the moment a field is
   focused, which then leaves the layout scrolled sideways. Tablets keep the
   desktop shape with tighter spacing. */

@media (max-width:64rem){
  .card{padding:var(--s4) var(--s4)}
  h2{margin-top:var(--s6)}
  .wrap{padding-bottom:var(--s8)}
  /* Below a wide desktop the third column is gone and the chips wrap. Let
     them: a flag nobody can see is a flag that may as well not be there. */
  .row .flags .flag{font-size:.76rem;padding:var(--s1) var(--s2)}
}

@media (max-width:44rem){
  body{font-size:16px}

  /* header: the drawer already lists every section, so the inline links are
     duplication that costs a whole row on a narrow screen */
  .nav{display:none}
  .top .inner{padding:var(--s2) max(var(--s4),env(safe-area-inset-right)) var(--s2) max(var(--s4),env(safe-area-inset-left));gap:var(--s2) var(--s3)}
  .brand{font-size:1rem}
  .burger{width:2.75rem;height:2.75rem}
  .starred-btn{min-height:2.75rem;padding:var(--s2) var(--s3)}
  .starred-btn span{display:none}
  .drawer{width:min(20rem,88vw)}
  .drawer a{padding:var(--s4) var(--s4);min-height:2.75rem}

  .wrap{padding:var(--s4) var(--s4) var(--s8)}
  h1{font-size:1.25rem;max-width:none;margin-bottom:var(--s1)}
  h2{font-size:1.15rem;margin-top:var(--s5)}
  .sub{font-size:.88rem;margin-bottom:var(--s2)}
  .statline{display:none}
  .presets{margin-bottom:var(--s2)}
  .sortbar{margin-bottom:var(--s2)}
  .sub,.hint,.card p,.card ul,.note,details.sub p{max-width:none}

  /* iOS zoom guard — every control a finger can land in */
  input,select,button{font-size:16px}

  .sortbar{padding:var(--s2) var(--s2);gap:var(--s2)}
  /* two rows, not four: search shares its row with the button, the two
     selects share the next one with their captions stacked above them.
     Every control here is a tap target, so none goes below 44px. */
  .sortbar input[type=search]{flex:1 1 58%;min-width:0;min-height:2.75rem;font-size:16px}
  .sortbar .go{flex:0 0 auto;width:auto;min-height:2.75rem;padding:var(--s2) var(--s4);font-size:16px}
  .sortbar label{order:1;flex:1 1 calc(50% - .2rem);flex-direction:column;align-items:stretch;gap:var(--s1);font-size:.72rem;letter-spacing:.02em}
  .sortbar.dir label{flex:1 1 100%}
  .sortbar select{width:100%;max-width:none;min-height:2.75rem;font-size:16px}

  /* every chip visible: a hidden one may as well not exist */
  .presets{flex-wrap:wrap;gap:var(--s1)}
  .preset{flex:none;min-height:2.75rem;display:inline-flex;align-items:center;padding:var(--s2) var(--s3);font-size:.86rem}
  .primer{display:none}

  /* the filter sheet: presets, sort/group and the filter panel collapse
     behind one full-width trigger. The count stays on the trigger itself —
     state that hides itself is worse than state that crowds. */
  .filters-trigger{display:flex;align-items:center;justify-content:center;gap:var(--s2);width:100%;min-height:2.75rem;margin:0 0 var(--s3);padding:var(--s2) var(--s4);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--accent);font-size:.95rem;font-weight:500;cursor:pointer}
  .filters-scrim{display:block}
  #filters-toggle:checked ~ .filters-scrim{opacity:1;visibility:visible}
  .filters-drawer{position:fixed;top:0;right:0;bottom:0;left:auto;width:min(22rem,88vw);background:var(--surface);border-left:1px solid var(--line);box-shadow:-18px 0 40px -24px rgba(10,18,24,.55);z-index:50;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.32,.72,.32,1);overflow-y:auto}
  #filters-toggle:checked ~ .filters-drawer{transform:translateX(0)}
  .filters-drawer .drawer-head{display:flex}
  .filters-drawer-body{padding:var(--s4)}

  /* full-bleed lists: on a phone the card frame is noise, the content is not */
  .rows,.group-block{border-radius:0;border-left:0;border-right:0;margin-inline:calc(-1 * var(--s4));box-shadow:none}
  /* the amount is what a reader scans for, so it leads the stack; the dot
     rides along with it instead of floating on its own line. Buyer/title
     comes next, flags last — nobody scrolls to a chip before the number. */
  .row{display:flex;flex-direction:column;gap:var(--s1);position:relative;padding:var(--s3) var(--s4) var(--s3) calc(var(--s4) + var(--s4));}
  .row .dot{position:absolute;left:var(--s4);top:1.1rem;grid-row:auto;margin-top:0}
  .row .amount{order:-2;text-align:left;margin-top:0;display:flex;align-items:baseline;gap:var(--s2)}
  .row .amount .big{font-size:1.05rem;font-variant-numeric:tabular-nums}
  .row .amount .exact{display:inline;margin-left:0}
  .row .who{order:-1}
  .row .name{font-size:.98rem;display:flex;align-items:flex-start;gap:var(--s1)}
  .row .name a{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .row .meta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row .flags{order:0;margin-top:var(--s1);gap:var(--s1)}
  .row .flags .flag{font-size:.74rem;padding:var(--s1) var(--s2);line-height:1.35}
  /* the worst tap target on the page before this: a 1.15rem glyph with no
     hit-box padding. It now clears 44px on both sides; float is dropped so
     the extra hit area does not overlap the title text next to it. No
     negative margin: the 44px box already sets .name's own line height (it
     is the tallest flex item in that row), so pulling it up with a
     negative margin only ever bleeds into the block above (.amount) —
     there is no slack to reclaim without doing that. */
  .row .name .star{float:none}
  .row .star{display:inline-flex;align-items:center;justify-content:center;min-width:2.75rem;min-height:2.75rem;padding:0;margin:0;font-size:1.3rem;flex:none}

  .group-block summary{padding:var(--s4) var(--s4)}
  .g-name{flex:1 1 100%}
  .g-body{padding:var(--s3) var(--s4) var(--s4)}

  .card{padding:var(--s4) var(--s4);box-shadow:none}
  .actions{gap:var(--s2)}
  .action{flex:1 1 100%;justify-content:center;min-height:2.75rem}
  .pager a{min-height:2.75rem;display:inline-flex;align-items:center}

  .filters-more summary{padding:var(--s3) var(--s4)}
  .filter-row input[type=search],.filter-row input[type=date],.filter-row input.num,.filter-row select{flex:1 1 100%;width:100%;max-width:none}

  dl.facts{grid-template-columns:1fr;gap:var(--s1)}
  dl.facts dd{margin-bottom:var(--s3)}

  details.help summary,details.sub summary{padding:var(--s4) var(--s4)}
  .legal{padding:var(--s3) var(--s4)}
}

@media (max-width:22rem){
  .brand span{display:none}
}

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

/**
 * What a link to this site looks like when it is pasted somewhere. The daily
 * notifier posts links to Telegram, which renders whatever these say; without
 * them a link arrives as a bare URL.
 */
const SITE_DESCRIPTION =
  "Публічні закупівлі України з позначками державної системи моніторингу: " +
  "висновки Держаудитслужби, власний розрахунок цін і правова кваліфікація по кожній закупівлі.";

export function layout(opts: { title: string; nav?: string; body: string; description?: string }): string {
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)} — Tender Radar</title>
<meta name="description" content="${esc(opts.description ?? SITE_DESCRIPTION)}">
<meta property="og:site_name" content="Tender Radar">
<meta property="og:type" content="website">
<meta property="og:locale" content="uk_UA">
<meta property="og:title" content="${esc(opts.title)} — Tender Radar">
<meta property="og:description" content="${esc(opts.description ?? SITE_DESCRIPTION)}">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-180.png">
<meta property="og:image" content="/icon-512.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ysabeau:wght@300..800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${STYLES}</style>
</head>
<body>
<input type="checkbox" id="menu-toggle" class="sr-only" aria-label="Показати всі розділи">
<header class="top"><div class="inner">
  <a class="brand" href="/"><img class="brand-mark" src="/icon-192.png" alt="" width="28" height="28" decoding="async">Tender<span>&nbsp;Radar</span></a>
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
