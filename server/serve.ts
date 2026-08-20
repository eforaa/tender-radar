// Server-rendered site over the local store. Zero dependencies.
import { createServer } from "node:http";
import { watch } from "node:fs";
import { REGION, RAILWAY_EDRPOU, SOUTHERN_RAILWAY_EDRPOU, railwayScope, dataDir, type RailwayScope } from "../src/config.ts";
import { RISK_LABELS, GROUP_ORDER, procedureLabel, readableName, type RiskGroup } from "../src/labels.ts";
import { layout, esc, money, unitMoney, shortMoney, date, trim, plural } from "./html.ts";
import { ARTICLES, isJointStock } from "../src/legal.ts";
import { loadDataset, type Case, type Dataset } from "./data.ts";

const PORT = Number(process.env.PORT ?? 3120);
const PAGE_SIZE = 30;

let db: Dataset = await loadDataset();
console.log(
  `loaded ${db.flagCount} flags across ${db.cases.length} tenders ` +
    `(${db.cases.filter((c) => c.detailed).length} with full cards)`,
);

/* ---------- shared pieces ---------- */

/**
 * The daily run rewrites the data files while the server is up, so watch the
 * directory and reload. Debounced: one run touches many files.
 */
let reloadTimer: NodeJS.Timeout | null = null;
watch(dataDir(), () => {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    db = await loadDataset();
    console.log(`data changed — reloaded ${db.cases.length} tenders`);
  }, 2000);
});

function shortRisk(riskId: string): string {
  return RISK_LABELS[riskId]?.short ?? db.ruleById.get(riskId)?.name ?? riskId;
}

function riskFlag(riskId: string): string {
  return `<a class="flag" href="/?risk=${encodeURIComponent(riskId)}">${esc(shortRisk(riskId))}</a>`;
}

/** The one-glance signals that make a case worth opening. */
function alarms(entry: Case): string[] {
  const out: string[] = [];
  for (const finding of entry.findings) out.push(finding.title);
  if (entry.detailed && entry.bidders === 1) out.push("Єдиний учасник");
  if ((entry.value_amount ?? 0) >= 1e9) out.push("Понад мільярд");
  if (entry.risks.length >= 3) out.push(`${entry.risks.length} індикатори одразу`);
  return out;
}

function caseRow(entry: Case, opts: { showOfficer?: boolean; showEntity?: boolean } = {}): string {
  const showOfficer = opts.showOfficer ?? true;
  const showEntity = opts.showEntity ?? true;
  const title = entry.title ? trim(entry.title) : readableName(entry.entity_name) || "Закупівля";

  const meta: string[] = [];
  if (showEntity && entry.entity_name) {
    meta.push(
      `<a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(readableName(entry.entity_name))}</a>`,
    );
  }
  if (showOfficer && entry.officer_name) {
    meta.push(`вів(ла) <a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a>`);
  }
  if (entry.winner_name) {
    meta.push(
      `виграв <a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a>`,
    );
  }

  return `<div class="row">
  <div class="who">
    <div class="name"><a href="/tender/${encodeURIComponent(entry.tender_id)}">${esc(title)}</a></div>
    ${meta.length ? `<div class="meta">${meta.join(" · ")}</div>` : ""}
    <div class="meta"><span class="ref">${esc(entry.tender_ref || entry.tender_id)}</span> · позначено ${date(entry.date_assessed)}</div>
  </div>
  <div class="amount">
    <span class="big">${shortMoney(entry.value_amount)}</span>
    <span class="exact">${money(entry.value_amount)}</span>
  </div>
  <div class="flags">
    ${alarms(entry).map((a) => `<span class="flag alarm">${esc(a)}</span>`).join("")}
    ${entry.risks.map(riskFlag).join("")}
  </div>
</div>`;
}

function rankRisks(list: Case[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const entry of list) for (const r of entry.risks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function riskCard(riskId: string, count?: number): string {
  const rule = db.ruleById.get(riskId);
  const label = RISK_LABELS[riskId];
  return `<div class="card">
  <h3><span class="tier state">Позначила держава</span> &nbsp;${esc(label?.short ?? rule?.name ?? riskId)}${count ? ` <span class="faint">— ${count} ${plural(count, "раз", "рази", "разів")}</span>` : ""}</h3>
  ${label ? `<p class="lead">${esc(label.means)}</p>` : ""}
  ${rule?.name && label ? `<p class="faint"><strong>Офіційне формулювання:</strong> ${esc(rule.name)}</p>` : ""}
  ${rule?.legitimateness ? `<p class="legal"><strong>Норма закону:</strong> ${esc(rule.legitimateness)}</p>` : ""}
  <p class="code">Індикатор ${esc(riskId)} · державна система моніторингу закупівель</p>
</div>`;
}

/** Groups indicator cards so a dossier reads as a pattern, not a list. */
function groupedRiskCards(ranked: [string, number][]): string {
  const byGroup = new Map<RiskGroup, [string, number][]>();
  const ungrouped: [string, number][] = [];

  for (const pair of ranked) {
    const group = RISK_LABELS[pair[0]]?.group;
    if (!group) {
      ungrouped.push(pair);
      continue;
    }
    const list = byGroup.get(group) ?? [];
    list.push(pair);
    byGroup.set(group, list);
  }

  const parts: string[] = [];
  for (const group of GROUP_ORDER) {
    const list = byGroup.get(group);
    if (!list) continue;
    const total = list.reduce((sum, [, n]) => sum + n, 0);
    parts.push(
      `<div class="group"><h3>${esc(group)}</h3><span class="count">${total} ${plural(total, "спрацювання", "спрацювання", "спрацювань")}</span></div>`,
      ...list.map(([riskId, count]) => riskCard(riskId, count)),
    );
  }
  parts.push(...ungrouped.map(([riskId, count]) => riskCard(riskId, count)));
  return parts.join("");
}

const HELP = `<details class="help">
  <summary>Як читати цю сторінку</summary>
  <div class="inner">
    <p>Кожен рядок — це закупівля, у якій спрацював індикатор державної системи моніторингу. Держава сама позначає такі закупівлі; ми лише збираємо позначки по ${esc(REGION)} та філіях залізниці й показуємо їх зрозуміло.</p>
    <p>Червоні позначки — те, на що варто глянути першим: єдиний учасник на великих торгах, сума понад мільярд, кілька індикаторів одразу.</p>
    <p>Сірі позначки — що саме запідозрила держава. Натисніть на будь-яку, щоб побачити всі закупівлі з тією самою ознакою.</p>
    <p><strong>Позначка не означає, що встановлено порушення.</strong> Це підстава відкрити закупівлю й перевірити її людиною.</p>
  </div>
</details>`;

/* ---------- pages ---------- */

function feedPage(url: URL): string {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const risk = url.searchParams.get("risk") ?? "";
  const sort = url.searchParams.get("sort") ?? "value";
  const railOnly = url.searchParams.get("rail") === "1";
  const soloOnly = url.searchParams.get("solo") === "1";
  const priceOnly = url.searchParams.get("price") === "1";
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
  if (soloOnly) list = list.filter((c) => c.bidders === 1);
  if (priceOnly) list = list.filter((c) => c.findings.length > 0);

  list = [...list].sort((a, b) =>
    sort === "date"
      ? String(b.date_assessed ?? "").localeCompare(String(a.date_assessed ?? ""))
      : sort === "risks"
        ? b.risks.length - a.risks.length || (b.value_amount ?? 0) - (a.value_amount ?? 0)
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
    if (soloOnly) p.set("solo", "1");
    if (priceOnly) p.set("price", "1");
    for (const [k, v] of Object.entries(over)) p.set(k, v);
    return `/?${p.toString()}`;
  };

  const filtered = Boolean(q || risk || railOnly || soloOnly || priceOnly);

  return layout({
    title: "Знахідки",
    nav: "feed",
    body: `
<h1>Закупівлі, які варто перевірити</h1>
<p class="sub">Харківська область і залізниця. Держава сама позначає підозрілі закупівлі — ми збираємо ці позначки в одному місці, пояснюємо їх звичайною мовою і додаємо власний розрахунок цін.</p>

<div class="metrics">
  <div class="metric"><span class="v">${db.cases.length.toLocaleString("uk-UA")}</span><span class="k">закупівель під питанням</span></div>
  <div class="metric"><span class="v">${shortMoney(db.totalValue)}</span><span class="k">загальна сума</span></div>
  <div class="metric"><span class="v">${db.flagCount.toLocaleString("uk-UA")}</span><span class="k">виявлених ознак</span></div>
  <div class="metric"><span class="v">${db.findingCount.toLocaleString("uk-UA")}</span><span class="k">де ми знайшли переплату</span></div>
</div>

${HELP}

<form class="filters" method="get" action="/">
  <input type="search" name="q" value="${esc(q)}" placeholder="Назва, замовник, посадовець, переможець, ЄДРПОУ або номер тендера" aria-label="Пошук">
  <select name="risk" aria-label="Ознака">
    <option value="">Будь-яка ознака</option>
    ${db.rules
      .map((r) => `<option value="${esc(r.risk_id)}"${r.risk_id === risk ? " selected" : ""}>${esc(shortRisk(r.risk_id))}</option>`)
      .join("")}
  </select>
  <select name="sort" aria-label="Сортування">
    <option value="value"${sort === "value" ? " selected" : ""}>Спочатку найдорожчі</option>
    <option value="date"${sort === "date" ? " selected" : ""}>Спочатку найновіші</option>
    <option value="risks"${sort === "risks" ? " selected" : ""}>Спочатку з найбільшою кількістю ознак</option>
  </select>
  <label class="check"><input type="checkbox" name="rail" value="1"${railOnly ? " checked" : ""}> лише залізниця</label>
  <label class="check"><input type="checkbox" name="solo" value="1"${soloOnly ? " checked" : ""}> лише без конкурентів</label>
  <label class="check"><input type="checkbox" name="price" value="1"${priceOnly ? " checked" : ""}> лише де ціна завищена</label>
  <button type="submit">Показати</button>
  ${filtered ? '<a class="reset" href="/">скинути все</a>' : ""}
</form>

<p class="hint">${filtered ? `Знайдено <strong>${list.length.toLocaleString("uk-UA")}</strong> закупівель на ${shortMoney(shownValue)}.` : "Показано всі, найдорожчі згори."}</p>

${risk ? riskCard(risk) : ""}

${slice.length === 0 ? '<div class="empty">За цими умовами нічого не знайшлося. Спробуйте прибрати частину фільтрів.</div>' : `<div class="rows">${slice.map((c) => caseRow(c)).join("")}</div>`}

${
  pages > 1
    ? `<div class="pager">
  ${page > 1 ? `<a href="${keep({ page: String(page - 1) })}">← попередні</a>` : ""}
  <span>сторінка ${page} з ${pages}</span>
  ${page < pages ? `<a href="${keep({ page: String(page + 1) })}">наступні →</a>` : ""}
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
  const winnerValue = sameWinner.reduce((sum, c) => sum + (c.winner_amount ?? c.value_amount ?? 0), 0);

  const title = entry.title || readableName(entry.entity_name) || "Закупівля";
  const signals = alarms(entry);

  return layout({
    title: entry.tender_ref || entry.tender_id,
    body: `
<a class="back" href="/">← до переліку знахідок</a>
<h1 class="long">${esc(title)}</h1>
<p class="sub">${esc(readableName(entry.entity_name))} · <span class="ref">${esc(entry.tender_ref || entry.tender_id)}</span></p>

${signals.length ? `<div class="flags" style="margin-bottom:1.5rem">${signals.map((s) => `<span class="flag alarm">${esc(s)}</span>`).join("")}</div>` : ""}

<div class="card">
  <dl class="facts">
    <dt>Сума</dt><dd><strong>${money(entry.value_amount)}</strong> <span class="faint">(${shortMoney(entry.value_amount)})</span></dd>
    <dt>Замовник</dt><dd><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(readableName(entry.entity_name))}</a><br><span class="faint">ЄДРПОУ ${esc(entry.entity_edrpou ?? "—")}</span></dd>
    <dt>Регіон</dt><dd>${esc(entry.region ?? "—")}</dd>
    ${entry.method ? `<dt>Процедура</dt><dd>${esc(procedureLabel(entry.method) ?? "—")}</dd>` : ""}
    ${entry.detailed ? `<dt>Учасників</dt><dd>${entry.bidders === 1 ? "<strong>один</strong> — конкуренції не було" : entry.bidders || "—"}</dd>` : ""}
    <dt>Позначено</dt><dd>${date(entry.date_assessed)}</dd>
    <dt>Першоджерело</dt><dd><a href="https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}" target="_blank" rel="noopener">Відкрити картку в Prozorro →</a></dd>
  </dl>
</div>

<h2>Хто відповідав за закупівлю</h2>
${
  entry.officer_name
    ? `<div class="card">
  <h3><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a></h3>
  <p class="lead">Ця особа вказана відповідальною ще у <strong>${sameOfficer.length}</strong> закупівлях із позначками, разом на <strong>${shortMoney(officerValue)}</strong>.</p>
  <dl class="facts">
    <dt>Пошта</dt><dd>${esc(entry.officer_email ?? "—")}</dd>
    <dt>Телефон</dt><dd>${esc(entry.officer_phone ?? "—")}</dd>
  </dl>
  <p style="margin-top:.9rem"><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">Відкрити досьє посадовця →</a></p>
</div>`
    : `<div class="card"><p>Картку цієї закупівлі ще не завантажено, тому відповідальна особа невідома.</p></div>`
}

<h2>Хто виграв</h2>
${
  entry.winner_name
    ? `<div class="card">
  <h3><a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a></h3>
  <p class="lead">Ця компанія перемогла ще у <strong>${sameWinner.length}</strong> закупівлях із позначками, разом на <strong>${shortMoney(winnerValue)}</strong>.</p>
  <dl class="facts">
    <dt>ЄДРПОУ</dt><dd>${esc(entry.winner_edrpou ?? "—")}</dd>
    <dt>Сума договору</dt><dd>${money(entry.winner_amount)}</dd>
  </dl>
</div>`
    : `<div class="card"><p>Переможця не визначено або картку ще не завантажено.</p></div>`
}

${
  entry.findings.length
    ? `<h2>Скільки це коштує в інших</h2>
<p class="hint">Порівняння виконала ця система, а не держава. Нижче — числа, з яких зроблено висновок.</p>
${entry.findings
  .map((f) => {
    const e = f.evidence as Record<string, number | string | null>;
    const rows = Object.entries({
      "Ціна за одиницю": typeof e.unit_price === "number" ? `${unitMoney(e.unit_price)}` : null,
      "Типова ціна (медіана)": typeof e.peer_median === "number" ? `${unitMoney(e.peer_median)}` : null,
      "Середня половина цін": typeof e.peer_p25 === "number" && typeof e.peer_p75 === "number" ? `${unitMoney(e.peer_p25)} — ${unitMoney(e.peer_p75)}` : null,
      "Порівняно із закупівлями": typeof e.peer_count === "number" ? String(e.peer_count) : null,
      "Попередня ціна цього замовника": typeof e.previous_price === "number" ? `${unitMoney(e.previous_price)}` : null,
      "Зростання": typeof e.growth === "number" ? `${Math.round(e.growth * 100)}%` : null,
      "Кількість": typeof e.quantity === "number" ? `${e.quantity.toLocaleString("uk-UA")} ${esc(String(e.unit_code ?? ""))}` : null,
      "Різниця на всю закупівлю": typeof e.overpayment === "number" ? money(e.overpayment) : typeof e.extra_cost === "number" ? money(e.extra_cost) : null,
      "Розрахунок від": e.basis === "award" ? "суми договору" : e.basis === "expected" ? "очікуваної вартості" : null,
    }).filter(([, v]) => v !== null);
    return `<div class="card">
  <h3><span class="tier own">Порахували ми</span> &nbsp;${esc(f.title)}</h3>
  <p class="lead">${esc(f.explanation)}</p>
  <dl class="facts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>
</div>`;
  })
  .join("")}`
    : ""
}

<h2>Що тут не так</h2>
<p class="hint">Спрацювало ${entry.risks.length} ${plural(entry.risks.length, "індикатор", "індикатори", "індикаторів")} із чотирнадцяти чинних.</p>
${entry.risks.map((r) => riskCard(r)).join("")}

<h2>Цей замовник загалом</h2>
<div class="card">
  <p class="lead">За ${esc(readableName(entry.entity_name))} обліковано <strong>${sameEntity.length}</strong> закупівель із позначками.</p>
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
  const solo = list.filter((c) => c.bidders === 1).length;
  const ranked = rankRisks(list);
  const sorted = [...list].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0));

  return layout({
    title: name,
    nav: "officers",
    body: `
<a class="back" href="/officers">← до переліку посадовців</a>
<h1>${esc(name)}</h1>
<p class="sub">Відповідальна особа в закупівлях${entity ? ` — ${esc(readableName(entity))}` : ""}.</p>

<div class="metrics">
  <div class="metric"><span class="v">${list.length}</span><span class="k">закупівель під питанням</span></div>
  <div class="metric"><span class="v">${shortMoney(value)}</span><span class="k">загальна сума</span></div>
  <div class="metric"><span class="v">${solo}</span><span class="k">з єдиним учасником</span></div>
  <div class="metric"><span class="v">${ranked.length}</span><span class="k">різних ознак</span></div>
</div>

<div class="card">
  <dl class="facts">
    <dt>Пошта</dt><dd>${esc(email ?? "—")}</dd>
    <dt>Телефон</dt><dd>${esc(phone ?? "—")}</dd>
    <dt>Установа</dt><dd><a href="/entity/${encodeURIComponent(entityEdrpou)}">${esc(readableName(entity))}</a></dd>
  </dl>
  <p class="faint" style="margin-top:.9rem">Дані взято з карток закупівель у Prozorro, де замовник сам публікує контактну особу. Одну людину між закупівлями зіставлено за поштою — вона стабільніша за написання імені.</p>
</div>

<h2>Що держава запідозрила в її закупівлях</h2>
<p class="hint">Це перелік ознак, які спрацювали. <strong>Це не судимість і не встановлена вина.</strong></p>
${groupedRiskCards(ranked)}

<h2>Закупівлі</h2>
<div class="rows">${sorted.slice(0, 60).map((c) => caseRow(c, { showOfficer: false })).join("")}</div>
${sorted.length > 60 ? `<p class="note">Показано 60 найдорожчих із ${sorted.length}.</p>` : ""}

<p class="note">Ця сторінка не є твердженням про правопорушення з боку названої особи. Вона показує, що державна система моніторингу позначила закупівлі, у яких цю особу вказано відповідальною контактною особою.</p>
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
  const solo = list.filter((c) => c.bidders === 1).length;
  const sorted = [...list].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0));

  return layout({
    title: name,
    nav: "suppliers",
    body: `
<a class="back" href="/suppliers">← до переліку переможців</a>
<h1>${esc(readableName(name))}</h1>
<p class="sub">Постачальник · ЄДРПОУ ${esc(edrpou)}</p>

<div class="metrics">
  <div class="metric"><span class="v">${list.length}</span><span class="k">перемог у закупівлях із позначками</span></div>
  <div class="metric"><span class="v">${shortMoney(value)}</span><span class="k">сума договорів</span></div>
  <div class="metric"><span class="v">${solo}</span><span class="k">де був єдиним учасником</span></div>
  <div class="metric"><span class="v">${buyers.size}</span><span class="k">різних замовників</span></div>
</div>

<h2>Що держава запідозрила в цих закупівлях</h2>
${groupedRiskCards(ranked)}

<h2>Закупівлі</h2>
<div class="rows">${sorted.slice(0, 60).map((c) => caseRow(c)).join("")}</div>
${sorted.length > 60 ? `<p class="note">Показано 60 найдорожчих із ${sorted.length}.</p>` : ""}

<p class="note">Перелік охоплює лише закупівлі ${esc(REGION)} та філій залізниці, які вже завантажено. Це не повна історія компанії по Україні.</p>
`,
  });
}

function entityPage(edrpou: string): string {
  const list = db.cases.filter((c) => c.entity_edrpou === edrpou);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.entity_name)?.entity_name ?? edrpou;
  const value = list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
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
<a class="back" href="/entities">← до переліку замовників</a>
<h1 class="long">${esc(readableName(name))}</h1>
<p class="sub">ЄДРПОУ ${esc(edrpou)}${RAILWAY_EDRPOU.has(edrpou) ? " · філія АТ «Українська залізниця»" : ""}</p>

<div class="metrics">
  <div class="metric"><span class="v">${list.length}</span><span class="k">закупівель під питанням</span></div>
  <div class="metric"><span class="v">${shortMoney(value)}</span><span class="k">загальна сума</span></div>
  <div class="metric"><span class="v">${solo}</span><span class="k">з єдиним учасником</span></div>
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
    <div class="meta">${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")} із позначками</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`,
  )
  .join("")}
</div>`
    : ""
}

<h2>Що держава запідозрила</h2>
${groupedRiskCards(ranked)}

<h2>Закупівлі</h2>
<div class="rows">${sorted.slice(0, 60).map((c) => caseRow(c, { showEntity: false })).join("")}</div>
${sorted.length > 60 ? `<p class="note">Показано 60 найдорожчих із ${sorted.length}.</p>` : ""}
`,
  });
}

/** Shared renderer for the three directory pages. */
function directoryPage(opts: {
  title: string;
  nav: string;
  heading: string;
  intro: string;
  rows: { href: string; name: string; meta: string; value: number }[];
}): string {
  return layout({
    title: opts.title,
    nav: opts.nav,
    body: `
<h1>${esc(opts.heading)}</h1>
<p class="sub">${opts.intro}</p>
${
  opts.rows.length === 0
    ? '<div class="empty">Даних поки немає.</div>'
    : `<div class="rows">
${opts.rows
  .slice(0, 150)
  .map(
    (r) => `<div class="row">
  <div class="who">
    <div class="name"><a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">${r.meta}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`,
  )
  .join("")}
</div>`
}
${opts.rows.length > 150 ? `<p class="note">Показано 150 найбільших із ${opts.rows.length}.</p>` : ""}
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

  return directoryPage({
    title: "Замовники",
    nav: "entities",
    heading: "Замовники",
    intro: `Установи ${esc(REGION)} та філії залізниці, у закупівлях яких спрацювали державні індикатори. Найбільші за сумою — згори.`,
    rows: [...byEntity.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([edrpou, acc]) => ({
        href: `/entity/${encodeURIComponent(edrpou)}`,
        name: readableName(acc.name),
        meta: `ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")}${RAILWAY_EDRPOU.has(edrpou) ? " · залізниця" : ""}`,
        value: acc.value,
      })),
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

  return directoryPage({
    title: "Посадовці",
    nav: "officers",
    heading: "Відповідальні посадовці",
    intro:
      "Особи, яких замовники вказали контактними в закупівлях із позначками. Це не перелік підозрюваних — це перелік тих, чиї закупівлі варто перевірити.",
    rows: [...byOfficer.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([key, acc]) => ({
        href: `/officer/${encodeURIComponent(key)}`,
        name: acc.name,
        meta: `${esc(readableName(acc.entity))} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")}`,
        value: acc.value,
      })),
  });
}

function suppliersPage(): string {
  const bySupplier = new Map<string, { name: string; count: number; value: number; solo: number }>();
  for (const entry of db.cases) {
    const key = entry.winner_edrpou ?? "";
    if (!key) continue;
    const acc = bySupplier.get(key) ?? { name: entry.winner_name ?? key, count: 0, value: 0, solo: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    if (entry.bidders === 1) acc.solo++;
    bySupplier.set(key, acc);
  }

  return directoryPage({
    title: "Переможці",
    nav: "suppliers",
    heading: "Переможці закупівель",
    intro: "Компанії, які виграли закупівлі з позначками. Найбільші за сумою договорів — згори.",
    rows: [...bySupplier.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([edrpou, acc]) => ({
        href: `/supplier/${encodeURIComponent(edrpou)}`,
        name: readableName(acc.name),
        meta: `ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "перемога", "перемоги", "перемог")}${acc.solo ? ` · ${acc.solo} без конкурентів` : ""}`,
        value: acc.value,
      })),
  });
}


/* ---------- railway ---------- */

type RailwayBlock = { scope: RailwayScope; heading: string; note: string; list: Case[] };

function railwayBlocks(): RailwayBlock[] {
  const by = new Map<RailwayScope, Case[]>();
  for (const entry of db.cases) {
    const scope = railwayScope(entry);
    if (!scope) continue;
    const list = by.get(scope) ?? [];
    list.push(entry);
    by.set(scope, list);
  }

  const blocks: RailwayBlock[] = [
    {
      scope: "southern",
      heading: "Регіональна філія «Південна залізниця»",
      note: `Власне залізниця Харківщини — регіональна філія АТ «Українська залізниця» з осідком у Харкові, ЄДРПОУ ${SOUTHERN_RAILWAY_EDRPOU}.`,
      list: by.get("southern") ?? [],
    },
    {
      scope: "branch",
      heading: "Інші філії АТ «Українська залізниця»",
      note:
        "Централізовані філії, які закуповують для всієї мережі, зокрема й для Харківського вузла. " +
        "Зареєстровані поза межами області, тому ми показуємо їх окремо, а не змішуємо з харківськими.",
      list: by.get("branch") ?? [],
    },
    {
      scope: "local",
      heading: "Залізничні заклади Харківщини",
      note: "Організації залізничного профілю, зареєстровані в області: університет, ліцей, центр професійної освіти.",
      list: by.get("local") ?? [],
    },
  ];
  return blocks.filter((b) => b.list.length > 0);
}

function railwayPage(): string {
  const blocks = railwayBlocks();
  const all = blocks.flatMap((b) => b.list);
  const value = all.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const solo = all.filter((c) => c.bidders === 1).length;
  const southern = blocks.find((b) => b.scope === "southern")?.list ?? [];

  const suppliers = new Map<string, { name: string; count: number; value: number; solo: number }>();
  for (const entry of all) {
    const key = entry.winner_edrpou ?? "";
    if (!key) continue;
    const acc = suppliers.get(key) ?? { name: entry.winner_name ?? key, count: 0, value: 0, solo: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    if (entry.bidders === 1) acc.solo++;
    suppliers.set(key, acc);
  }
  const topSuppliers = [...suppliers.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 15);

  return layout({
    title: "Залізниця Харківської області",
    nav: "railway",
    body: `
<h1>Залізниця Харківської області</h1>
<p class="sub">Закупівлі залізничної галузі з позначками державної системи моніторингу. Нижче — три різні за природою групи, і ми їх не змішуємо.</p>

<div class="metrics">
  <div class="metric"><span class="v">${all.length.toLocaleString("uk-UA")}</span><span class="k">закупівель під питанням</span></div>
  <div class="metric"><span class="v">${shortMoney(value)}</span><span class="k">загальна сума</span></div>
  <div class="metric"><span class="v">${solo}</span><span class="k">з єдиним учасником</span></div>
  <div class="metric"><span class="v">${southern.length}</span><span class="k">у «Південної залізниці»</span></div>
</div>

<details class="help">
  <summary>Що саме входить у цей розділ</summary>
  <div class="inner">
    <p><strong>Південна залізниця</strong> — регіональна філія АТ «Українська залізниця», що обслуговує Харківщину. Це і є залізниця області у прямому значенні.</p>
    <p><strong>Інші філії Укрзалізниці</strong> зареєстровані в Києві, але закуповують централізовано для всієї мережі, зокрема й для харківських підрозділів. Ми відстежуємо їх окремо й не видаємо за харківські.</p>
    <p><strong>Залізничні заклади Харківщини</strong> — освітні та наукові організації галузі, зареєстровані в області.</p>
    <p>Відбір за назвою навмисно вузький. Ширший шаблон помилково зараховував до залізниці Зміївську теплову електростанцію та дослідну станцію птахівництва.</p>
  </div>
</details>

${blocks
  .map((block) => {
    const blockValue = block.list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
    const entities = new Map<string, { name: string; count: number; value: number }>();
    for (const entry of block.list) {
      const key = entry.entity_edrpou ?? "";
      const acc = entities.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
      acc.count++;
      acc.value += entry.value_amount ?? 0;
      entities.set(key, acc);
    }
    const sorted = [...block.list].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0));

    return `
<h2>${esc(block.heading)}</h2>
<p class="hint">${esc(block.note)}</p>
<p class="hint"><strong>${block.list.length}</strong> ${plural(block.list.length, "закупівля", "закупівлі", "закупівель")} на ${shortMoney(blockValue)}, ${entities.size} ${plural(entities.size, "замовник", "замовники", "замовників")}.</p>
<div class="rows">
${[...entities.entries()]
  .sort((a, b) => b[1].value - a[1].value)
  .map(
    ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/entity/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")} із позначками</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`,
  )
  .join("")}
</div>
<div class="rows" style="margin-top:1rem">${sorted.slice(0, 20).map((c) => caseRow(c)).join("")}</div>
${sorted.length > 20 ? `<p class="hint" style="margin-top:.8rem">Показано 20 найдорожчих із ${sorted.length}.</p>` : ""}
`;
  })
  .join("")}

<h2>Що держава запідозрила в залізничних закупівлях</h2>
${groupedRiskCards(rankRisks(all))}

<h2>Хто виграє залізничні тендери</h2>
<p class="hint">П'ятнадцять найбільших переможців за сумою договорів.</p>
<div class="rows">
${topSuppliers
  .map(
    ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/supplier/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "перемога", "перемоги", "перемог")}${acc.solo ? ` · ${acc.solo} без конкурентів` : ""}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`,
  )
  .join("")}
</div>

<p class="note">Позначка означає, що спрацював індикатор державної системи моніторингу закупівель. Це ознака ризику, яка потребує перевірки, а не встановлений факт порушення.</p>
`,
  });
}


/* ---------- criminal-code screening ---------- */

function articlePage(code: string, url: URL): string {
  const article = ARTICLES[code];
  if (!article) return notFound();

  const relevant = new Set(article.links.map((l) => l.risk_id));
  const jointOnly = url.searchParams.get("at") === "1";

  let list = db.cases.filter(
    (c) => c.region === REGION && c.risks.some((r) => relevant.has(r)),
  );
  if (jointOnly) list = list.filter((c) => isJointStock(c.entity_name) || isJointStock(c.winner_name));

  const value = list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const officers = new Set(list.map((c) => c.officer_key).filter(Boolean));

  /** How many of this article's indicators fired — the screening priority. */
  const score = (entry: Case) => entry.risks.filter((r) => relevant.has(r)).length;
  const sorted = [...list].sort(
    (a, b) => score(b) - score(a) || (b.value_amount ?? 0) - (a.value_amount ?? 0),
  );

  return layout({
    title: `Стаття ${article.code}`,
    nav: `article-${article.code}`,
    body: `
<h1>Ознаки за статтею ${esc(article.code)} — ${esc(article.title)}</h1>
<p class="sub">Закупівлі ${esc(REGION)}, у яких державна система виявила документальні розбіжності того типу, який перевіряють за цією статтею.</p>

<div class="card" style="border-left:3px solid var(--alarm)">
  <h3>Це список для перевірки, а не звинувачення</h3>
  <p class="lead">${esc(article.caution)}</p>
</div>

<div class="metrics">
  <div class="metric"><span class="v">${list.length.toLocaleString("uk-UA")}</span><span class="k">закупівель для перевірки</span></div>
  <div class="metric"><span class="v">${shortMoney(value)}</span><span class="k">загальна сума</span></div>
  <div class="metric"><span class="v">${solo}</span><span class="k">з єдиним учасником</span></div>
  <div class="metric"><span class="v">${officers.size}</span><span class="k">відповідальних осіб</span></div>
</div>

<h2>Що каже стаття</h2>
<div class="card">
  <p class="lead">${esc(article.summary)}</p>
  <p><strong>Що має бути доведено:</strong></p>
  <ul>
    ${article.elements.map((e) => `<li>${esc(e)}</li>`).join("")}
  </ul>
  <p class="faint">Наведено як довідку для юриста. Це не правова консультація і не кваліфікація чиїхось дій.</p>
</div>

<h2>Чому саме ці ознаки</h2>
<p class="hint">Із чотирнадцяти державних індикаторів для цієї статті релевантні ${article.links.length}. Решта стосуються конкуренції та процедури, а не змісту документів.</p>
${article.links
  .map((link) => {
    const label = RISK_LABELS[link.risk_id];
    const hits = list.filter((c) => c.risks.includes(link.risk_id)).length;
    return `<div class="card">
  <h3>${esc(label?.short ?? link.risk_id)} <span class="faint">— ${hits} ${plural(hits, "закупівля", "закупівлі", "закупівель")}</span></h3>
  <p class="lead">${esc(link.why)}</p>
  <p class="code">Індикатор ${esc(link.risk_id)}</p>
</div>`;
  })
  .join("")}

<h2>Закупівлі для перевірки</h2>
<form class="filters" method="get" action="/article/${esc(article.code)}">
  <label class="check"><input type="checkbox" name="at" value="1"${jointOnly ? " checked" : ""}> лише акціонерні товариства (АТ)</label>
  <button type="submit">Показати</button>
  ${jointOnly ? `<a class="reset" href="/article/${esc(article.code)}">скинути</a>` : ""}
</form>
<p class="hint">Спочатку ті, де збіглося найбільше релевантних ознак.</p>
${sorted.length === 0 ? '<div class="empty">За цими умовами нічого не знайшлося.</div>' : `<div class="rows">${sorted.slice(0, 60).map((c) => caseRow(c)).join("")}</div>`}
${sorted.length > 60 ? `<p class="hint" style="margin-top:.8rem">Показано 60 із ${sorted.length}.</p>` : ""}

<p class="note">Перелік сформовано автоматично за індикаторами державної системи моніторингу закупівель. Він не встановлює факт правопорушення і не є твердженням щодо будь-якої названої особи чи компанії. Наступний крок — витребувати самі документи й перевірити їх.</p>
`,
  });
}


/* ---------- what changed ---------- */

function updatesPage(): string {
  const runs = [...db.runs].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const latest = runs[0];
  const newIds = new Set(latest?.new_tender_ids ?? []);
  const fresh = db.cases.filter((c) => newIds.has(c.tender_id)).sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0));

  return layout({
    title: "Оновлення",
    nav: "updates",
    body: `
<h1>Що змінилося</h1>
<p class="sub">Система щодня перевіряє державний масив ризик-індикаторів і підтягує нові закупівлі ${esc(REGION)} та філій залізниці.</p>

${
  latest
    ? `<div class="metrics">
  <div class="metric"><span class="v">${latest.new_tenders}</span><span class="k">нових закупівель востаннє</span></div>
  <div class="metric"><span class="v">${latest.new_flags}</span><span class="k">нових спрацювань</span></div>
  <div class="metric"><span class="v">${date(latest.started_at)}</span><span class="k">останнє оновлення</span></div>
  <div class="metric"><span class="v">${runs.length}</span><span class="k">${plural(runs.length, "запуск", "запуски", "запусків")}</span></div>
</div>`
    : '<div class="empty">Жодного запуску ще не було. Виконайте <code>npm run daily</code>.</div>'
}

${
  fresh.length > 0
    ? `<h2>Нові закупівлі з останнього оновлення</h2>
<div class="rows">${fresh.slice(0, 40).map((c) => caseRow(c)).join("")}</div>
${fresh.length > 40 ? `<p class="hint" style="margin-top:.8rem">Показано 40 найдорожчих із ${fresh.length}.</p>` : ""}`
    : latest
      ? `<h2>Нові закупівлі з останнього оновлення</h2><div class="empty">Нових закупівель не з’явилося. Це нормальний результат — держава не щодня додає позначки.</div>`
      : ""
}

<h2>Історія запусків</h2>
<div class="rows">
${runs
  .slice(0, 30)
  .map(
    (r) => `<div class="row">
  <div class="who">
    <div class="name">${date(r.started_at)}${r.status === "failed" ? ' <span class="flag alarm">збій</span>' : ""}</div>
    <div class="meta">${r.new_tenders} ${plural(r.new_tenders, "нова закупівля", "нові закупівлі", "нових закупівель")} · ${r.new_flags} ${plural(r.new_flags, "нове спрацювання", "нові спрацювання", "нових спрацювань")} · ${r.details_fetched} ${plural(r.details_fetched, "картка", "картки", "карток")} завантажено${r.errors ? ` · ${r.errors} ${plural(r.errors, "помилка", "помилки", "помилок")}` : ""}</div>
    ${r.message ? `<div class="meta">${esc(r.message)}</div>` : ""}
  </div>
  <div class="amount"><span class="big">${r.status === "ok" ? "✓" : "✕"}</span></div>
</div>`,
  )
  .join("")}
</div>

<p class="note">Оновлення виконує скрипт <code>npm run daily</code>. Він безпечний до повторного запуску: усе, що вже є, не дублюється, а перерваний запуск довантажується наступного разу.</p>
`,
  });
}


/* ---------- our own price findings ---------- */

function pricesPage(): string {
  const withFindings = db.cases.filter((c) => c.findings.length > 0);
  const sum = (c: (typeof withFindings)[number]) =>
    c.findings.reduce((total, f) => {
      const e = f.evidence as { overpayment?: number; extra_cost?: number };
      return total + (e.overpayment ?? e.extra_cost ?? 0);
    }, 0);

  const sorted = [...withFindings].sort((a, b) => sum(b) - sum(a));
  const totalGap = withFindings.reduce((t, c) => t + sum(c), 0);
  const peer = withFindings.filter((c) => c.findings.some((f) => f.detector_key === "peer_price")).length;
  const growth = withFindings.filter((c) => c.findings.some((f) => f.detector_key === "own_price_growth")).length;

  return layout({
    title: "Завищені ціни",
    nav: "prices",
    body: `
<h1>Де ціна виглядає завищеною</h1>
<p class="sub">Тут система рахує сама, а не переказує висновок держави. Вона бере ціну за одиницю й порівнює з тим, скільки те саме коштувало іншим — і скільки коштувало цьому ж замовнику раніше.</p>

<div class="metrics">
  <div class="metric"><span class="v">${withFindings.length}</span><span class="k">закупівель із завищеною ціною</span></div>
  <div class="metric"><span class="v">${shortMoney(totalGap)}</span><span class="k">різниця проти звичайної ціни</span></div>
  <div class="metric"><span class="v">${peer}</span><span class="k">дорожче, ніж в інших</span></div>
  <div class="metric"><span class="v">${growth}</span><span class="k">дорожче, ніж було торік</span></div>
</div>

<details class="help">
  <summary>Як ми це рахуємо</summary>
  <div class="inner">
    <p>Спочатку рахуємо <strong>ціну за одиницю</strong>: суму договору ділимо на кількість. Наприклад, 4 млн грн за 200 холодильників — це 20 тисяч за штуку.</p>
    <p>Далі шукаємо, за скільки те саме купували інші, і беремо середину. Якщо ціна помітно вища за середину — показуємо.</p>
    <p>Окремо порівнюємо замовника з ним самим: скільки він платив за це раніше. Тут місцеві умови однакові, тож стрибок ціни складніше пояснити.</p>
    <p><strong>Ми мовчимо, коли порівняти чесно не можна.</strong> Ремонти й послуги не порівнюємо — кожен об'єкт свій. Не порівнюємо й товари всередині надто широкого коду: під одним кодом можуть бути і прокладка за 400 грн, і редуктор за мільйон.</p>
  </div>
</details>

${
  sorted.length === 0
    ? '<div class="empty">Поки що завищених цін не знайдено.</div>'
    : `<div class="rows">${sorted.map((c) => caseRow(c)).join("")}</div>`
}

<p class="note">Різниця в ціні — це ще не порушення. Вона може мати пояснення: інші умови постачання, інший час, інша якість. Наше завдання — показати, де це пояснення варто запитати.</p>
`,
  });
}

function indicatorsPage(): string {
  // Every active indicator is listed, including those that never fired here —
  // a zero is information too.
  const counted = new Map(rankRisks(db.cases));
  const ranked: [string, number][] = db.rules
    .map((r) => [r.risk_id, counted.get(r.risk_id) ?? 0] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  return layout({
    title: "Що ми шукаємо",
    nav: "indicators",
    body: `
<h1>Що ми шукаємо</h1>
<p class="sub">Чотирнадцять ознак, за якими держава перевіряє кожну закупівлю. Нижче — що кожна означає звичайною мовою і скільки разів вона спрацювала в ${esc(REGION)} та на залізниці.</p>
${groupedRiskCards(ranked)}
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
  <h3>Звідки дані</h3>
  <p class="lead">Державна система автоматичних індикаторів ризику Prozorro — наказ Мінфіну № 476 від 27 вересня 2024 року. Держава перевіряє кожну закупівлю за чинним переліком ознак і публікує результат відкрито.</p>
  <p>Ми завантажуємо цей масив, відбираємо ${esc(REGION)} та філії АТ «Українська залізниця», доповнюємо картками закупівель із Prozorro — звідки беремо відповідальну особу, кількість учасників і переможця — і подаємо так, щоб з цим можна було працювати.</p>
</div>

<div class="card">
  <h3>Три рівні достовірності</h3>
  <p><span class="tier confirmed">Перевірила держава</span> &nbsp;Держаудитслужба провела моніторинг і встановила порушення.</p>
  <p><span class="tier state">Позначила держава</span> &nbsp;Спрацював індикатор державної системи. Це підозра держави з посиланням на норму закону — саме це показано на сайті сьогодні.</p>
  <p><span class="tier own">Порахували ми</span> &nbsp;Наш розрахунок: ціна за одиницю проти каталожної. Підключається наступним етапом.</p>
  <p>Нижчий рівень ніколи не подається як вищий.</p>
</div>

<div class="card">
  <h3>Про сторінки посадовців</h3>
  <p>Ім'я, пошта й телефон відповідальної особи взяті з картки закупівлі в Prozorro, де замовник сам їх публікує. Одну людину між закупівлями зіставлено за поштою, бо написання імені різниться.</p>
  <p>Сторінка посадовця показує, у скількох його закупівлях спрацювали державні індикатори і за якими нормами закону. <strong>Це не судимість і не встановлена вина.</strong></p>
</div>

<div class="card">
  <h3>Чому тут немає судимостей</h3>
  <p>Єдиний державний реєстр судових рішень закритий CAPTCHA, а в текстах кримінальних рішень імена замінені на «ОСОБА_1» відповідно до законодавства про захист персональних даних. Зіставити судимість із людиною за збігом прізвища неможливо надійно, а помилка тут — це звинувачення невинного.</p>
  <p>Тому система показує лише те, що можна довести: які ознаки державна система виявила в конкретних закупівлях конкретної особи.</p>
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
  else if (path === "/suppliers") body = suppliersPage();
  else if (path === "/railway") body = railwayPage();
  else if (path === "/updates") body = updatesPage();
  else if (path === "/prices") body = pricesPage();
  else if (path.startsWith("/article/")) body = articlePage(path.slice("/article/".length), url);
  else if (path === "/indicators") body = indicatorsPage();
  else if (path === "/about") body = aboutPage();
  else if (path.startsWith("/tender/")) body = tenderPage(path.slice("/tender/".length));
  else if (path.startsWith("/entity/")) body = entityPage(path.slice("/entity/".length));
  else if (path.startsWith("/officer/")) body = officerPage(path.slice("/officer/".length));
  else if (path.startsWith("/supplier/")) body = supplierPage(path.slice("/supplier/".length));
  else if (path === "/reload") {
    db = await loadDataset();
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`reloaded: ${db.cases.length} tenders`);
    return;
  } else {
    body = notFound();
    status = 404;
  }

  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
});

server.listen(PORT, () => console.log(`tender-radar on http://localhost:${PORT}`));
