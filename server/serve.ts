// Server-rendered site over the local store. Zero dependencies.
import { createServer } from "node:http";
import { REGION, RAILWAY_EDRPOU } from "../src/config.ts";
import { layout, esc, money, shortMoney, date } from "./html.ts";
import { loadDataset, type Case, type Dataset } from "./data.ts";

const PORT = Number(process.env.PORT ?? 3120);
const PAGE_SIZE = 40;

let db: Dataset = await loadDataset();
console.log(
  `loaded ${db.flagCount} flags across ${db.cases.length} tenders ` +
    `(${db.cases.filter((c) => c.detailed).length} with full cards)`,
);

function riskChip(riskId: string): string {
  const rule = db.ruleById.get(riskId);
  return `<a class="chip" href="/?risk=${encodeURIComponent(riskId)}" title="${esc(rule?.name ?? riskId)}">${esc(riskId)}</a>`;
}

function caseRow(entry: Case): string {
  return `<div class="row">
  <div class="who">
    <div class="name"><a href="/tender/${encodeURIComponent(entry.tender_id)}">${esc(entry.title || entry.entity_name || "Закупівля")}</a></div>
    <div class="meta">${esc(entry.entity_name ?? "—")} · ${esc(entry.tender_ref || entry.tender_id)} · ${date(entry.date_assessed)}</div>
    ${entry.officer_name ? `<div class="meta">вів: <a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a></div>` : ""}
  </div>
  <div class="amount">${money(entry.value_amount)}</div>
  <div class="chips">
    <span class="tier state">Державний індикатор</span>
    ${entry.risks.map(riskChip).join("")}
  </div>
</div>`;
}

/** Counts how often each indicator fired across a set of tenders. */
function rankRisks(list: Case[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const entry of list) for (const r of entry.risks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function riskCard(riskId: string, count?: number): string {
  const rule = db.ruleById.get(riskId);
  return `<div class="card">
  <h3><span class="tier state">Державний індикатор</span> &nbsp;${esc(riskId)}${rule?.name ? " — " + esc(rule.name) : ""}${count ? ` &nbsp;<span class="chip">${count}×</span>` : ""}</h3>
  ${rule?.description ? `<p>${esc(rule.description)}</p>` : ""}
  ${rule?.legitimateness ? `<p class="legal"><strong>Норма закону:</strong> ${esc(rule.legitimateness)}</p>` : `<p class="note" style="margin:0">Текст норми в державному переліку не наведено.</p>`}
</div>`;
}

function feedPage(url: URL): string {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const risk = url.searchParams.get("risk") ?? "";
  const sort = url.searchParams.get("sort") ?? "value";
  const railOnly = url.searchParams.get("rail") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));

  let list = db.cases;
  if (q) {
    list = list.filter(
      (c) =>
        (c.entity_name ?? "").toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q) ||
        (c.officer_name ?? "").toLowerCase().includes(q) ||
        (c.winner_name ?? "").toLowerCase().includes(q) ||
        (c.entity_edrpou ?? "").includes(q) ||
        (c.winner_edrpou ?? "").includes(q) ||
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
    for (const [k, v] of Object.entries(over)) p.set(k, v);
    return `/?${p.toString()}`;
  };

  const filtered = Boolean(q || risk || railOnly);

  return layout({
    title: "Знахідки",
    nav: "feed",
    body: `
<h1>Закупівлі з ознаками ризику</h1>
<p class="sub">${esc(REGION)} та філії АТ «Українська залізниця». Дані державної системи ризик-індикаторів Prozorro.</p>

<div class="metrics">
  <div class="metric"><span class="v">${db.cases.length.toLocaleString("uk-UA")}</span><span class="k">закупівель із позначками</span></div>
  <div class="metric"><span class="v">${shortMoney(db.totalValue)}</span><span class="k">сукупна вартість</span></div>
  <div class="metric"><span class="v">${db.flagCount.toLocaleString("uk-UA")}</span><span class="k">спрацювань індикаторів</span></div>
  <div class="metric"><span class="v">${db.rules.length}</span><span class="k">діючих індикаторів</span></div>
</div>

<form class="filters" method="get" action="/">
  <input type="search" name="q" value="${esc(q)}" placeholder="Замовник, посадовець, переможець, ЄДРПОУ або номер тендера" aria-label="Пошук">
  <select name="risk" aria-label="Індикатор">
    <option value="">Будь-який індикатор</option>
    ${db.rules
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

${risk ? riskCard(risk) : ""}

<p class="sub">${filtered ? `Відібрано ${list.length.toLocaleString("uk-UA")} закупівель на ${shortMoney(shownValue)}.` : "Показано найбільші за сумою."}</p>

${slice.length === 0 ? '<div class="empty">За цими умовами нічого не знайдено.</div>' : `<div class="rows">${slice.map(caseRow).join("")}</div>`}

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
  const entry = db.byTender.get(tenderId);
  if (!entry) return notFound();

  const sameEntity = db.cases.filter((c) => c.entity_edrpou && c.entity_edrpou === entry.entity_edrpou);
  const sameOfficer = entry.officer_key ? db.cases.filter((c) => c.officer_key === entry.officer_key) : [];
  const officerValue = sameOfficer.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const sameWinner = entry.winner_edrpou ? db.cases.filter((c) => c.winner_edrpou === entry.winner_edrpou) : [];

  return layout({
    title: entry.tender_ref || entry.tender_id,
    body: `
<h1>${esc(entry.title || entry.entity_name || "Закупівля")}</h1>
<p class="sub">${esc(entry.tender_ref || entry.tender_id)}</p>

<div class="card">
  <dl class="facts">
    <dt>Сума</dt><dd><strong>${money(entry.value_amount)}</strong></dd>
    <dt>Замовник</dt><dd><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(entry.entity_name ?? "—")}</a> · ЄДРПОУ ${esc(entry.entity_edrpou ?? "—")}</dd>
    <dt>Регіон</dt><dd>${esc(entry.region ?? "—")}</dd>
    ${entry.method ? `<dt>Процедура</dt><dd>${esc(entry.method)}</dd>` : ""}
    ${entry.bidders ? `<dt>Учасників</dt><dd>${entry.bidders}</dd>` : ""}
    <dt>Оцінено</dt><dd>${date(entry.date_assessed)}</dd>
    <dt>Першоджерело</dt><dd><a href="https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}" target="_blank" rel="noopener">Відкрити в Prozorro →</a></dd>
  </dl>
</div>

<h2>Хто вів цю закупівлю</h2>
${
  entry.officer_name
    ? `<div class="card">
  <h3><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a></h3>
  <dl class="facts">
    <dt>Пошта</dt><dd>${esc(entry.officer_email ?? "—")}</dd>
    <dt>Телефон</dt><dd>${esc(entry.officer_phone ?? "—")}</dd>
    <dt>Установа</dt><dd>${esc(entry.entity_name ?? "—")}</dd>
  </dl>
  <p style="margin-top:.9rem">Ця посадова особа вказана відповідальною ще у <strong>${sameOfficer.length}</strong> закупівлях із позначками на <strong>${shortMoney(officerValue)}</strong>.</p>
  <p><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">Відкрити досьє посадовця →</a></p>
</div>`
    : `<div class="card"><p>Картку цієї закупівлі ще не завантажено, тому відповідальна особа невідома.</p></div>`
}

<h2>Хто виграв</h2>
${
  entry.winner_name
    ? `<div class="card">
  <h3><a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(entry.winner_name)}</a></h3>
  <dl class="facts">
    <dt>ЄДРПОУ</dt><dd>${esc(entry.winner_edrpou ?? "—")}</dd>
    <dt>Сума договору</dt><dd>${money(entry.winner_amount)}</dd>
  </dl>
  <p style="margin-top:.9rem">Ця компанія перемогла ще у <strong>${sameWinner.length}</strong> закупівлях із позначками.</p>
</div>`
    : `<div class="card"><p>Переможця не визначено або картку ще не завантажено.</p></div>`
}

<h2>Спрацювали індикатори — ${entry.risks.length}</h2>
${entry.risks.map((r) => riskCard(r)).join("")}

<h2>Цей замовник</h2>
<div class="card">
  <p>За ${esc(entry.entity_name ?? "цим замовником")} обліковано <strong>${sameEntity.length}</strong> закупівель із позначками.</p>
  <p><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">Відкрити досьє замовника →</a></p>
</div>

<p class="note">Наявність позначки не означає, що встановлено порушення, і не є звинуваченням названих осіб. Це підстава для перевірки закупівлі людиною.</p>
`,
  });
}

function officerPage(key: string): string {
  const list = db.cases.filter((c) => c.officer_key === key);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.officer_name)?.officer_name ?? key;
  const email = list.find((c) => c.officer_email)?.officer_email ?? null;
  const phone = list.find((c) => c.officer_phone)?.officer_phone ?? null;
  const entity = list.find((c) => c.entity_name)?.entity_name ?? null;
  const entityEdrpou = list.find((c) => c.entity_edrpou)?.entity_edrpou ?? "";
  const value = list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const ranked = rankRisks(list);
  const sorted = [...list].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0));

  return layout({
    title: name,
    body: `
<h1>${esc(name)}</h1>
<p class="sub">Посадова особа, вказана відповідальною в закупівлях${entity ? ` — ${esc(entity)}` : ""}.</p>

<div class="metrics">
  <div class="metric"><span class="v">${list.length}</span><span class="k">закупівель із позначками</span></div>
  <div class="metric"><span class="v">${shortMoney(value)}</span><span class="k">сукупна вартість</span></div>
  <div class="metric"><span class="v">${ranked.length}</span><span class="k">різних індикаторів</span></div>
</div>

<div class="card">
  <dl class="facts">
    <dt>Пошта</dt><dd>${esc(email ?? "—")}</dd>
    <dt>Телефон</dt><dd>${esc(phone ?? "—")}</dd>
    <dt>Установа</dt><dd><a href="/entity/${encodeURIComponent(entityEdrpou)}">${esc(entity ?? "—")}</a></dd>
  </dl>
  <p style="margin-top:.9rem">Дані взято з карток закупівель у Prozorro, де цю особу вказано контактною. Зіставлення виконано за поштою — вона стабільніша за написання імені.</p>
</div>

<h2>За якими нормами спрацьовували індикатори</h2>
<p class="sub">Це перелік норм закону, порушення яких державна система запідозрила в закупівлях цієї особи. Не судимість і не встановлена вина.</p>
${ranked.map(([riskId, count]) => riskCard(riskId, count)).join("")}

<h2>Закупівлі</h2>
<div class="rows">${sorted.slice(0, 100).map(caseRow).join("")}</div>
${sorted.length > 100 ? `<p class="note">Показано 100 найбільших із ${sorted.length}.</p>` : ""}

<p class="note">Ця сторінка не є твердженням про правопорушення з боку названої особи. Вона показує, що державна система моніторингу позначила закупівлі, у яких ця особа вказана відповідальною контактною особою.</p>
`,
  });
}

function supplierPage(edrpou: string): string {
  const list = db.cases.filter((c) => c.winner_edrpou === edrpou);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.winner_name)?.winner_name ?? edrpou;
  const value = list.reduce((sum, c) => sum + (c.winner_amount ?? c.value_amount ?? 0), 0);
  const ranked = rankRisks(list);
  const buyers = new Set(list.map((c) => c.entity_edrpou).filter(Boolean));
  const sorted = [...list].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0));

  return layout({
    title: name,
    body: `
<h1>${esc(name)}</h1>
<p class="sub">Постачальник, ЄДРПОУ ${esc(edrpou)}</p>

<div class="metrics">
  <div class="metric"><span class="v">${list.length}</span><span class="k">перемог у закупівлях із позначками</span></div>
  <div class="metric"><span class="v">${shortMoney(value)}</span><span class="k">сума договорів</span></div>
  <div class="metric"><span class="v">${buyers.size}</span><span class="k">різних замовників</span></div>
</div>

<h2>Які індикатори спрацьовували на його перемогах</h2>
${ranked.map(([riskId, count]) => riskCard(riskId, count)).join("")}

<h2>Закупівлі</h2>
<div class="rows">${sorted.slice(0, 100).map(caseRow).join("")}</div>
${sorted.length > 100 ? `<p class="note">Показано 100 найбільших із ${sorted.length}.</p>` : ""}

<p class="note">Перелік охоплює лише закупівлі ${esc(REGION)} та філій залізниці, які вже завантажено. Це не повна історія компанії по Україні.</p>
`,
  });
}

function entityPage(edrpou: string): string {
  const list = db.cases.filter((c) => c.entity_edrpou === edrpou);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.entity_name)?.entity_name ?? edrpou;
  const value = list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const ranked = rankRisks(list);
  const sorted = [...list].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0));

  const officers = new Map<string, { name: string; count: number; value: number }>();
  for (const entry of list) {
    if (!entry.officer_key) continue;
    const acc = officers.get(entry.officer_key) ?? { name: entry.officer_name ?? entry.officer_key, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    officers.set(entry.officer_key, acc);
  }
  const rankedOfficers = [...officers.entries()].sort((a, b) => b[1].value - a[1].value);

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
  <div class="metric"><span class="v">${rankedOfficers.length}</span><span class="k">відповідальних осіб</span></div>
</div>

${
  rankedOfficers.length > 0
    ? `<h2>Хто вів ці закупівлі</h2>
<div class="rows">
${rankedOfficers
  .map(
    ([key, acc]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/officer/${encodeURIComponent(key)}">${esc(acc.name)}</a></div>
    <div class="meta">${acc.count} закупівель із позначками</div>
  </div>
  <div class="amount">${shortMoney(acc.value)}</div>
</div>`,
  )
  .join("")}
</div>`
    : ""
}

<h2>Які індикатори спрацьовували</h2>
${ranked.map(([riskId, count]) => riskCard(riskId, count)).join("")}

<h2>Закупівлі</h2>
<div class="rows">${sorted.slice(0, 100).map(caseRow).join("")}</div>
${sorted.length > 100 ? `<p class="note">Показано 100 найбільших із ${sorted.length}.</p>` : ""}
`,
  });
}

function entitiesPage(): string {
  const byEntity = new Map<string, { name: string; count: number; value: number }>();
  for (const entry of db.cases) {
    const key = entry.entity_edrpou ?? "";
    if (!key) continue;
    const acc = byEntity.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
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

function officersPage(): string {
  const byOfficer = new Map<string, { name: string; entity: string; count: number; value: number }>();
  for (const entry of db.cases) {
    if (!entry.officer_key) continue;
    const acc = byOfficer.get(entry.officer_key) ?? {
      name: entry.officer_name ?? entry.officer_key,
      entity: entry.entity_name ?? "",
      count: 0,
      value: 0,
    };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    byOfficer.set(entry.officer_key, acc);
  }
  const ranked = [...byOfficer.entries()].sort((a, b) => b[1].value - a[1].value);

  return layout({
    title: "Посадовці",
    nav: "officers",
    body: `
<h1>Відповідальні посадовці</h1>
<p class="sub">Особи, вказані контактними в закупівлях, на яких спрацювали державні індикатори. Це не перелік підозрюваних — це перелік тих, чиї закупівлі варто перевірити.</p>
${
  ranked.length === 0
    ? '<div class="empty">Картки закупівель ще не завантажено — запустіть <code>npm run ingest:details</code>.</div>'
    : `<div class="rows">
${ranked
  .slice(0, 200)
  .map(
    ([key, acc]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/officer/${encodeURIComponent(key)}">${esc(acc.name)}</a></div>
    <div class="meta">${esc(acc.entity)} · ${acc.count} закупівель</div>
  </div>
  <div class="amount">${shortMoney(acc.value)}</div>
</div>`,
  )
  .join("")}
</div>`
}
${ranked.length > 200 ? `<p class="note">Показано 200 із ${ranked.length}.</p>` : ""}
`,
  });
}

function indicatorsPage(): string {
  const counts = new Map<string, number>();
  for (const entry of db.cases) for (const r of entry.risks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const sorted = [...db.rules].sort((a, b) => (counts.get(b.risk_id) ?? 0) - (counts.get(a.risk_id) ?? 0));

  return layout({
    title: "Індикатори",
    nav: "indicators",
    body: `
<h1>Державні індикатори ризику</h1>
<p class="sub">Чинний перелік автоматичних індикаторів, за якими держава перевіряє кожну закупівлю. Разом із кожним — норма закону, на якій він побудований.</p>
${sorted.map((rule) => riskCard(rule.risk_id, counts.get(rule.risk_id) ?? 0)).join("")}
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
  <p>Ми завантажуємо цей масив, відбираємо ${esc(REGION)} та філії АТ «Українська залізниця», доповнюємо картками закупівель із Prozorro і подаємо так, щоб з ним можна було працювати.</p>
</div>

<div class="card">
  <h3>Три рівні достовірності</h3>
  <p><span class="tier confirmed">Підтверджено</span> &nbsp;Держаудитслужба провела моніторинг і встановила порушення.</p>
  <p><span class="tier state">Державний індикатор</span> &nbsp;Спрацював індикатор державної системи. Це підозра держави з посиланням на норму закону — саме це показано на цьому сайті сьогодні.</p>
  <p><span class="tier own">Власний аналіз</span> &nbsp;Наш розрахунок: ціна за одиницю проти каталожної. Підключається наступним етапом.</p>
</div>

<div class="card">
  <h3>Про сторінки посадовців</h3>
  <p>Ім'я, пошта й телефон відповідальної особи взяті з картки закупівлі в Prozorro, де замовник сам їх публікує. Зіставлення однієї особи між закупівлями виконано за поштою, бо написання імені різниться.</p>
  <p>Сторінка посадовця показує, у скількох його закупівлях спрацювали державні індикатори і за якими нормами закону. <strong>Це не судимість і не встановлена вина.</strong></p>
</div>

<div class="card">
  <h3>Чому тут немає судимостей</h3>
  <p>Єдиний державний реєстр судових рішень закритий CAPTCHA, а в текстах кримінальних рішень імена замінені на «ОСОБА_1» відповідно до законодавства про захист персональних даних. Зіставити судимість із людиною за збігом прізвища неможливо надійно, а помилка тут — це звинувачення невинного.</p>
  <p>Тому система показує лише те, що можна довести: які норми закону державна система запідозрила в конкретних закупівлях конкретної особи.</p>
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = decodeURIComponent(url.pathname);

  let body: string;
  let status = 200;

  if (path === "/") body = feedPage(url);
  else if (path === "/entities") body = entitiesPage();
  else if (path === "/officers") body = officersPage();
  else if (path === "/indicators") body = indicatorsPage();
  else if (path === "/about") body = aboutPage();
  else if (path.startsWith("/tender/")) body = tenderPage(path.slice("/tender/".length));
  else if (path.startsWith("/entity/")) body = entityPage(path.slice("/entity/".length));
  else if (path.startsWith("/officer/")) body = officerPage(path.slice("/officer/".length));
  else if (path.startsWith("/supplier/")) body = supplierPage(path.slice("/supplier/".length));
  else if (path === "/reload") {
    db = await loadDataset();
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`reloaded: ${db.cases.length} tenders, ${db.cases.filter((c) => c.detailed).length} with full cards`);
    return;
  } else {
    body = notFound();
    status = 404;
  }

  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
});

server.listen(PORT, () => console.log(`tender-radar on http://localhost:${PORT}`));
