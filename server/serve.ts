// Server-rendered site over the local store. Zero dependencies.
import { createServer } from "node:http";
import { openStore, REGION, RAILWAY_EDRPOU } from "../src/config.ts";
import { layout, esc, money, shortMoney, date } from "./html.ts";
import type { RiskFlagRow, RiskRuleRow } from "../src/store/types.ts";

const PORT = Number(process.env.PORT ?? 3120);
const PAGE_SIZE = 40;

const store = openStore();
const flags = await store.allRiskFlags();
const rules = await store.allRiskRules();
const ruleById = new Map(rules.map((r) => [r.risk_id, r]));

/** One entry per tender, carrying every indicator that fired on it. */
type Case = {
  tender_id: string;
  tender_ref: string;
  entity_edrpou: string | null;
  entity_name: string | null;
  region: string | null;
  value_amount: number | null;
  date_assessed: string | null;
  risks: string[];
};

function buildCases(rows: RiskFlagRow[]): Case[] {
  const byTender = new Map<string, Case>();
  for (const row of rows) {
    let entry = byTender.get(row.tender_id);
    if (!entry) {
      entry = {
        tender_id: row.tender_id,
        tender_ref: row.tender_ref,
        entity_edrpou: row.entity_edrpou,
        entity_name: row.entity_name,
        region: row.region,
        value_amount: row.value_amount,
        date_assessed: row.date_assessed,
        risks: [],
      };
      byTender.set(row.tender_id, entry);
    }
    if (!entry.tender_ref && row.tender_ref) entry.tender_ref = row.tender_ref;
    if (entry.value_amount === null) entry.value_amount = row.value_amount;
    if (!entry.risks.includes(row.risk_id)) entry.risks.push(row.risk_id);
  }
  return [...byTender.values()];
}

const cases = buildCases(flags);
const totalValue = cases.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);

console.log(`loaded ${flags.length} flags across ${cases.length} tenders`);

function riskChip(riskId: string, active = false): string {
  const rule = ruleById.get(riskId);
  const label = rule?.name ?? riskId;
  return `<a class="chip${active ? " on" : ""}" href="/?risk=${encodeURIComponent(riskId)}" title="${esc(label)}">${esc(riskId)}</a>`;
}

function caseRow(entry: Case): string {
  return `<div class="row">
  <div class="who">
    <div class="name"><a href="/tender/${encodeURIComponent(entry.tender_id)}">${esc(entry.entity_name ?? "Замовник не вказаний")}</a></div>
    <div class="meta">${esc(entry.tender_ref || entry.tender_id)} · ЄДРПОУ ${esc(entry.entity_edrpou ?? "—")} · ${date(entry.date_assessed)}</div>
  </div>
  <div class="amount">${money(entry.value_amount)}</div>
  <div class="chips">
    <span class="tier state">Державний індикатор</span>
    ${entry.risks.map((r) => riskChip(r)).join("")}
  </div>
</div>`;
}

function feedPage(url: URL): string {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const risk = url.searchParams.get("risk") ?? "";
  const sort = url.searchParams.get("sort") ?? "value";
  const railOnly = url.searchParams.get("rail") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));

  let list = cases;
  if (q) {
    list = list.filter(
      (c) =>
        (c.entity_name ?? "").toLowerCase().includes(q) ||
        (c.entity_edrpou ?? "").includes(q) ||
        c.tender_ref.toLowerCase().includes(q),
    );
  }
  if (risk) list = list.filter((c) => c.risks.includes(risk));
  if (railOnly) list = list.filter((c) => RAILWAY_EDRPOU.has(c.entity_edrpou ?? ""));

  list = [...list].sort((a, b) =>
    sort === "date"
      ? String(b.date_assessed ?? "").localeCompare(String(a.date_assessed ?? ""))
      : sort === "risks"
        ? b.risks.length - a.risks.length
        : (b.value_amount ?? 0) - (a.value_amount ?? 0),
  );

  const shownValue = list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const keep = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (risk) p.set("risk", risk);
    if (sort !== "value") p.set("sort", sort);
    if (railOnly) p.set("rail", "1");
    for (const [k, v] of Object.entries(over)) v ? p.set(k, v) : p.delete(k);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const filtered = Boolean(q || risk || railOnly);
  const activeRule = risk ? ruleById.get(risk) : undefined;

  return layout({
    title: "Знахідки",
    nav: "feed",
    body: `
<h1>Закупівлі з ознаками ризику</h1>
<p class="sub">${esc(REGION)} та філії АТ «Українська залізниця». Дані державної системи ризик-індикаторів Prozorro.</p>

<div class="metrics">
  <div class="metric"><span class="v">${cases.length.toLocaleString("uk-UA")}</span><span class="k">закупівель із позначками</span></div>
  <div class="metric"><span class="v">${shortMoney(totalValue)}</span><span class="k">сукупна вартість</span></div>
  <div class="metric"><span class="v">${flags.length.toLocaleString("uk-UA")}</span><span class="k">спрацювань індикаторів</span></div>
  <div class="metric"><span class="v">${rules.length}</span><span class="k">діючих індикаторів</span></div>
</div>

<form class="filters" method="get" action="/">
  <input type="search" name="q" value="${esc(q)}" placeholder="Замовник, ЄДРПОУ або номер тендера" aria-label="Пошук">
  <select name="risk" aria-label="Індикатор">
    <option value="">Будь-який індикатор</option>
    ${rules
      .map((r) => `<option value="${esc(r.risk_id)}"${r.risk_id === risk ? " selected" : ""}>${esc(r.risk_id)} — ${esc((r.name ?? "").slice(0, 60))}</option>`)
      .join("")}
  </select>
  <select name="sort" aria-label="Сортування">
    <option value="value"${sort === "value" ? " selected" : ""}>За сумою</option>
    <option value="date"${sort === "date" ? " selected" : ""}>За датою</option>
    <option value="risks"${sort === "risks" ? " selected" : ""}>За кількістю індикаторів</option>
  </select>
  <label class="clear"><input type="checkbox" name="rail" value="1"${railOnly ? " checked" : ""}> лише залізниця</label>
  <button type="submit">Показати</button>
  ${filtered ? '<a class="clear" href="/">скинути</a>' : ""}
</form>

${
  activeRule
    ? `<div class="card">
  <h3>${esc(activeRule.risk_id)} — ${esc(activeRule.name ?? "")}</h3>
  ${activeRule.description ? `<p>${esc(activeRule.description)}</p>` : ""}
  ${activeRule.legitimateness ? `<p class="legal">${esc(activeRule.legitimateness)}</p>` : ""}
</div>`
    : ""
}

<p class="sub">${filtered ? `Відібрано ${list.length.toLocaleString("uk-UA")} закупівель на ${shortMoney(shownValue)}.` : `Показано найбільші за сумою.`}</p>

${
  slice.length === 0
    ? '<div class="empty">За цими умовами нічого не знайдено.</div>'
    : `<div class="rows">${slice.map(caseRow).join("")}</div>`
}

${
  pages > 1
    ? `<div class="pager">
  ${page > 1 ? `<a href="${keep({ page: String(page - 1) })}">← назад</a>` : ""}
  <span>сторінка ${page} з ${pages}</span>
  ${page < pages ? `<a href="${keep({ page: String(page + 1) })}">далі →</a>` : ""}
</div>`
    : ""
}

<p class="note">Позначка означає, що спрацював індикатор державної системи моніторингу закупівель. Це ознака ризику, яка потребує перевірки, а не встановлений факт порушення.</p>
`,
  });
}

function tenderPage(tenderId: string): string {
  const entry = cases.find((c) => c.tender_id === tenderId);
  if (!entry) return notFound();

  const sameEntity = cases.filter((c) => c.entity_edrpou && c.entity_edrpou === entry.entity_edrpou);
  const entityValue = sameEntity.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);

  return layout({
    title: entry.tender_ref || entry.tender_id,
    body: `
<h1>${esc(entry.entity_name ?? "Замовник не вказаний")}</h1>
<p class="sub">${esc(entry.tender_ref || entry.tender_id)}</p>

<div class="card">
  <dl class="facts">
    <dt>Сума</dt><dd><strong>${money(entry.value_amount)}</strong></dd>
    <dt>ЄДРПОУ</dt><dd><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(entry.entity_edrpou ?? "—")}</a></dd>
    <dt>Регіон</dt><dd>${esc(entry.region ?? "—")}</dd>
    <dt>Оцінено</dt><dd>${date(entry.date_assessed)}</dd>
    <dt>Першоджерело</dt><dd><a href="https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}" target="_blank" rel="noopener">Відкрити в Prozorro →</a></dd>
  </dl>
</div>

<h2>Спрацювали індикатори — ${entry.risks.length}</h2>
${entry.risks
  .map((riskId) => {
    const rule = ruleById.get(riskId);
    return `<div class="card">
  <h3><span class="tier state">Державний індикатор</span> &nbsp;${esc(riskId)}${rule?.name ? " — " + esc(rule.name) : ""}</h3>
  ${rule?.description ? `<p>${esc(rule.description)}</p>` : "<p>Опис індикатора не завантажено.</p>"}
  ${rule?.legitimateness ? `<p class="legal">${esc(rule.legitimateness)}</p>` : ""}
</div>`;
  })
  .join("")}

<h2>Цей замовник</h2>
<div class="card">
  <p>За ${esc(entry.entity_name ?? "цим замовником")} обліковано <strong>${sameEntity.length}</strong> закупівель із позначками на <strong>${shortMoney(entityValue)}</strong>.</p>
  <p><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">Відкрити досьє замовника →</a></p>
</div>

<p class="note">Наявність позначки не означає, що встановлено порушення. Це підстава для перевірки закупівлі людиною.</p>
`,
  });
}

function entityPage(edrpou: string): string {
  const list = cases.filter((c) => c.entity_edrpou === edrpou);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.entity_name)?.entity_name ?? edrpou;
  const value = list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);

  const byRisk = new Map<string, number>();
  for (const entry of list) for (const r of entry.risks) byRisk.set(r, (byRisk.get(r) ?? 0) + 1);
  const ranked = [...byRisk.entries()].sort((a, b) => b[1] - a[1]);

  const sorted = [...list].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0));

  return layout({
    title: name,
    nav: "entities",
    body: `
<h1>${esc(name)}</h1>
<p class="sub">ЄДРПОУ ${esc(edrpou)}${RAILWAY_EDRPOU.has(edrpou) ? " · філія АТ «Українська залізниця»" : ""}</p>

<div class="metrics">
  <div class="metric"><span class="v">${list.length}</span><span class="k">закупівель із позначками</span></div>
  <div class="metric"><span class="v">${shortMoney(value)}</span><span class="k">сукупна вартість</span></div>
  <div class="metric"><span class="v">${ranked.length}</span><span class="k">різних індикаторів</span></div>
</div>

<h2>Які індикатори спрацьовували</h2>
<div class="rows">
${ranked
  .map(([riskId, count]) => {
    const rule = ruleById.get(riskId);
    return `<div class="row">
  <div class="who">
    <div class="name">${esc(rule?.name ?? riskId)}</div>
    <div class="meta">${esc(riskId)}</div>
  </div>
  <div class="amount">${count}×</div>
</div>`;
  })
  .join("")}
</div>

<h2>Закупівлі</h2>
<div class="rows">${sorted.slice(0, 100).map(caseRow).join("")}</div>
${sorted.length > 100 ? `<p class="note">Показано 100 найбільших із ${sorted.length}.</p>` : ""}
`,
  });
}

function entitiesPage(): string {
  const byEntity = new Map<string, { name: string; count: number; value: number }>();
  for (const entry of cases) {
    const key = entry.entity_edrpou ?? "";
    if (!key) continue;
    const acc = byEntity.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    if (entry.entity_name && acc.name === key) acc.name = entry.entity_name;
    byEntity.set(key, acc);
  }
  const ranked = [...byEntity.entries()].sort((a, b) => b[1].value - a[1].value);

  return layout({
    title: "Замовники",
    nav: "entities",
    body: `
<h1>Замовники</h1>
<p class="sub">Установи ${esc(REGION)} та філії залізниці, у закупівлях яких спрацювали державні індикатори. Відсортовано за сукупною сумою.</p>
<div class="rows">
${ranked
  .slice(0, 200)
  .map(
    ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/entity/${encodeURIComponent(edrpou)}">${esc(acc.name)}</a></div>
    <div class="meta">ЄДРПОУ ${esc(edrpou)} · ${acc.count} закупівель${RAILWAY_EDRPOU.has(edrpou) ? " · залізниця" : ""}</div>
  </div>
  <div class="amount">${shortMoney(acc.value)}</div>
</div>`,
  )
  .join("")}
</div>
${ranked.length > 200 ? `<p class="note">Показано 200 найбільших із ${ranked.length}.</p>` : ""}
`,
  });
}

function indicatorsPage(): string {
  const counts = new Map<string, number>();
  for (const flag of flags) counts.set(flag.risk_id, (counts.get(flag.risk_id) ?? 0) + 1);

  const sorted = [...rules].sort((a, b) => (counts.get(b.risk_id) ?? 0) - (counts.get(a.risk_id) ?? 0));

  return layout({
    title: "Індикатори",
    nav: "indicators",
    body: `
<h1>Державні індикатори ризику</h1>
<p class="sub">Чинний перелік автоматичних індикаторів, за якими держава перевіряє кожну закупівлю. Разом із кожним — норма закону, на якій він побудований.</p>
${sorted
  .map((rule: RiskRuleRow) => {
    const n = counts.get(rule.risk_id) ?? 0;
    return `<div class="card">
  <h3>${esc(rule.risk_id)}${rule.name ? " — " + esc(rule.name) : ""}</h3>
  <p><a class="chip" href="/?risk=${encodeURIComponent(rule.risk_id)}">спрацював у ${n} закупівлях регіону →</a></p>
  ${rule.description ? `<p>${esc(rule.description)}</p>` : ""}
  ${rule.legitimateness ? `<p class="legal">${esc(rule.legitimateness)}</p>` : ""}
</div>`;
  })
  .join("")}
`,
  });
}

function aboutPage(): string {
  return layout({
    title: "Про систему",
    nav: "about",
    body: `
<h1>Про систему</h1>
<p class="sub">Що показує цей сайт, звідки бере дані і чого не робить.</p>

<div class="card">
  <h3>Джерело даних</h3>
  <p>Державна система автоматичних індикаторів ризику Prozorro — наказ Мінфіну № 476 від 27.09.2024. Держава перевіряє кожну закупівлю за чинним переліком індикаторів і публікує результат відкрито.</p>
  <p>Ми завантажуємо цей масив, відбираємо ${esc(REGION)} та філії АТ «Українська залізниця» і подаємо так, щоб з ним можна було працювати.</p>
</div>

<div class="card">
  <h3>Три рівні достовірності</h3>
  <p><span class="tier confirmed">Підтверджено</span> &nbsp;Держаудитслужба провела моніторинг і встановила порушення.</p>
  <p><span class="tier state">Державний індикатор</span> &nbsp;Спрацював індикатор державної системи. Це підозра держави з посиланням на норму закону — саме це показано на цьому сайті сьогодні.</p>
  <p><span class="tier own">Власний аналіз</span> &nbsp;Наш розрахунок: ціна за одиницю проти каталожної. Підключається наступним етапом.</p>
</div>

<div class="card">
  <h3>Чого система не робить</h3>
  <p>Вона не оголошує вину і не називає жодну фірму чи людину злочинцем. Вона показує ознаки ризику, які потребують перевірки, і завжди дає посилання на першоджерело, щоб висновок можна було перевірити вручну.</p>
</div>
`,
  });
}

function notFound(): string {
  return layout({
    title: "Не знайдено",
    body: `<h1>Не знайдено</h1><p class="sub">Такої сторінки немає. <a href="/">До переліку знахідок →</a></p>`,
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = decodeURIComponent(url.pathname);

  let body: string;
  let status = 200;

  if (path === "/") body = feedPage(url);
  else if (path === "/entities") body = entitiesPage();
  else if (path === "/indicators") body = indicatorsPage();
  else if (path === "/about") body = aboutPage();
  else if (path.startsWith("/tender/")) body = tenderPage(path.slice("/tender/".length));
  else if (path.startsWith("/entity/")) body = entityPage(path.slice("/entity/".length));
  else if (path === "/api/cases") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(cases));
    return;
  } else {
    body = notFound();
    status = 404;
  }

  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
});

server.listen(PORT, () => console.log(`tender-radar on http://localhost:${PORT}`));
