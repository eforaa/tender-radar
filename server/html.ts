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

export function shortMoney(amount: number): string {
  if (amount >= 1e9) return (amount / 1e9).toFixed(1).replace(".", ",") + " млрд ₴";
  if (amount >= 1e6) return (amount / 1e6).toFixed(1).replace(".", ",") + " млн ₴";
  if (amount >= 1e3) return Math.round(amount / 1e3) + " тис ₴";
  return Math.round(amount) + " ₴";
}

export function date(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STYLES = `
:root {
  --paper:#F3F5F6; --surface:#FFFFFF; --surface-2:#EDF1F3;
  --ink:#16202B; --ink-soft:#45555F; --ink-faint:#74858F;
  --line:#D5DDE2; --line-soft:#E5EBEE;
  --accent:#1E5A72; --accent-bg:#E2EDF1;
  --ok:#2C6B4E; --ok-bg:#E0EFE7;
  --wait:#8A6420; --wait-bg:#F5EBD7;
  --out:#7C3B3B; --out-bg:#F2E3E3;
  --shadow:0 1px 2px rgba(22,32,43,.06), 0 8px 24px -16px rgba(22,32,43,.30);
  --f-display:"Literata",Georgia,serif;
  --f-body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;
  --f-mono:"IBM Plex Mono",Consolas,monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper:#10171E; --surface:#17212A; --surface-2:#1D2932;
    --ink:#E4EAEE; --ink-soft:#A2B0BB; --ink-faint:#7A8994;
    --line:#2B3944; --line-soft:#222E38;
    --accent:#74B6D1; --accent-bg:#1A303C;
    --ok:#7FC6A0; --ok-bg:#162C23;
    --wait:#DBB46C; --wait-bg:#2E2718;
    --out:#DA9797; --out-bg:#2E1E1E;
    --shadow:0 1px 2px rgba(0,0,0,.40), 0 8px 24px -16px rgba(0,0,0,.80);
  }
}
:root[data-theme="dark"] {
  --paper:#10171E; --surface:#17212A; --surface-2:#1D2932;
  --ink:#E4EAEE; --ink-soft:#A2B0BB; --ink-faint:#7A8994;
  --line:#2B3944; --line-soft:#222E38;
  --accent:#74B6D1; --accent-bg:#1A303C;
  --ok:#7FC6A0; --ok-bg:#162C23;
  --wait:#DBB46C; --wait-bg:#2E2718;
  --out:#DA9797; --out-bg:#2E1E1E;
  --shadow:0 1px 2px rgba(0,0,0,.40), 0 8px 24px -16px rgba(0,0,0,.80);
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-underline-offset:2px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.top{border-bottom:1px solid var(--line);background:var(--surface)}
.top .inner{max-width:74rem;margin:0 auto;padding:1rem clamp(1rem,3vw,2rem);display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 1.5rem}
.brand{font-family:var(--f-display);font-weight:700;font-size:1.15rem;letter-spacing:-.01em;text-decoration:none;color:var(--ink);white-space:nowrap}
.brand span{color:var(--accent)}
.nav{display:flex;gap:1.1rem;font-size:.92rem;margin-left:auto}
.nav a{text-decoration:none;color:var(--ink-soft)}
.nav a:hover,.nav a[aria-current]{color:var(--accent)}

.wrap{max-width:74rem;margin:0 auto;padding:clamp(1.5rem,4vw,2.75rem) clamp(1rem,3vw,2rem) 5rem}

h1{font-family:var(--f-display);font-weight:700;font-size:clamp(1.6rem,4vw,2.4rem);line-height:1.12;letter-spacing:-.015em;margin:0 0 .5rem;text-wrap:balance}
h2{font-family:var(--f-display);font-weight:700;font-size:1.3rem;line-height:1.2;margin:2.25rem 0 .75rem}
.sub{color:var(--ink-soft);max-width:62ch;margin:0 0 1.5rem}

.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1px;background:var(--line);border:1px solid var(--line);box-shadow:var(--shadow);margin-bottom:1.75rem}
.metric{background:var(--surface);padding:1rem 1.15rem;display:flex;flex-direction:column;gap:.2rem}
.metric .v{font-family:var(--f-display);font-weight:700;font-size:1.6rem;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.metric .k{font-size:.82rem;color:var(--ink-soft)}

form.filters{display:flex;flex-wrap:wrap;gap:.6rem;margin-bottom:1.25rem;align-items:stretch}
input,select{font-family:inherit;font-size:.92rem;color:var(--ink);background:var(--surface);border:1px solid var(--line);padding:.5rem .7rem;min-width:0}
input[type=search]{flex:1 1 18rem}
button{font-family:inherit;font-size:.92rem;font-weight:500;color:var(--surface);background:var(--accent);border:1px solid var(--accent);padding:.5rem 1rem;cursor:pointer}
button:hover{opacity:.9}
.clear{color:var(--ink-soft);align-self:center;font-size:.88rem}

.rows{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);box-shadow:var(--shadow)}
.row{background:var(--surface);padding:1rem 1.2rem;display:grid;grid-template-columns:1fr auto;gap:.5rem 1.5rem;align-items:start}
.row .who{min-width:0}
.row .name{font-weight:600;line-height:1.35}
.row .name a{color:var(--ink);text-decoration:none}
.row .name a:hover{color:var(--accent)}
.row .meta{font-family:var(--f-mono);font-size:.76rem;color:var(--ink-faint);margin-top:.2rem}
.row .amount{font-family:var(--f-mono);font-size:1rem;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.row .chips{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.15rem}
@media (max-width:36rem){.row{grid-template-columns:1fr}.row .amount{text-align:left}}

.chip{font-family:var(--f-mono);font-size:.68rem;font-weight:500;letter-spacing:.03em;padding:.22rem .45rem;border:1px solid var(--line);background:var(--surface-2);color:var(--ink-soft);text-decoration:none;white-space:nowrap}
.chip:hover{border-color:var(--accent);color:var(--accent)}
.chip.on{border-color:var(--accent);background:var(--accent-bg);color:var(--accent)}

.tier{font-family:var(--f-mono);font-size:.66rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;padding:.24rem .5rem;border:1px solid currentColor;white-space:nowrap}
.tier.confirmed{color:var(--ok);background:var(--ok-bg)}
.tier.state{color:var(--wait);background:var(--wait-bg)}
.tier.own{color:var(--ink-faint);background:var(--surface-2)}

.card{background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow);padding:1.35rem 1.5rem;margin-bottom:1rem}
.card h3{margin:0 0 .4rem;font-size:1.02rem;font-weight:600}
.card p{margin:0 0 .6rem;color:var(--ink-soft);max-width:70ch}
.card p:last-child{margin-bottom:0}
.legal{border-left:3px solid var(--accent);background:var(--accent-bg);padding:.7rem .9rem;font-size:.9rem;color:var(--ink);max-width:none}

dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:.4rem 1.25rem;margin:0}
dl.facts dt{font-family:var(--f-mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);padding-top:.15rem}
dl.facts dd{margin:0}
@media (max-width:34rem){dl.facts{grid-template-columns:1fr;gap:.1rem}dl.facts dd{margin-bottom:.5rem}}

.pager{display:flex;gap:.5rem;align-items:center;margin-top:1.5rem;font-size:.9rem}
.pager a{padding:.4rem .8rem;border:1px solid var(--line);background:var(--surface);text-decoration:none}
.pager span{color:var(--ink-faint)}

.empty{background:var(--surface);border:1px dashed var(--line);padding:2.5rem 1.5rem;text-align:center;color:var(--ink-soft)}
.note{font-size:.86rem;color:var(--ink-faint);max-width:70ch;margin-top:2rem;padding-top:1rem;border-top:1px solid var(--line)}
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>${STYLES}</style>
</head>
<body>
<header class="top"><div class="inner">
  <a class="brand" href="/">Tender<span>&nbsp;Radar</span></a>
  <nav class="nav">
    <a href="/"${opts.nav === "feed" ? ' aria-current="page"' : ""}>Знахідки</a>
    <a href="/entities"${opts.nav === "entities" ? ' aria-current="page"' : ""}>Замовники</a>
    <a href="/officers"${opts.nav === "officers" ? ' aria-current="page"' : ""}>Посадовці</a>
    <a href="/indicators"${opts.nav === "indicators" ? ' aria-current="page"' : ""}>Індикатори</a>
    <a href="/about"${opts.nav === "about" ? ' aria-current="page"' : ""}>Про систему</a>
  </nav>
</div></header>
<main class="wrap">
${opts.body}
</main>
</body>
</html>`;
}
