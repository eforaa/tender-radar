// Server-rendered site over the local store. Zero dependencies.
import { REGION, RAILWAY_EDRPOU, SOUTHERN_RAILWAY_EDRPOU, railwayScope, dataDir, type RailwayScope } from "../src/config.ts";
import { RISK_LABELS, GROUP_ORDER, procedureLabel, readableName, type RiskGroup } from "../src/labels.ts";
import { layout, esc, money, unitMoney, shortMoney, date, trim, plural } from "./html.ts";
import { ARTICLES, INDICATOR_LEGAL, isJointStock } from "../src/legal.ts";
import { loadDataset, type Case, type Dataset } from "./data.ts";
import { DIMENSIONS, buildGroups, isDimension, type Dimension, type Group } from "./grouping.ts";
import { normaliseEdrpou, isStarred, type Favourite, type FavKind } from "./favourites.ts";
import { reportText, reportHtml, type ReportContext } from "./report.ts";
import { buildConclusion } from "./conclusion.ts";
import { buildQualification } from "./qualification.ts";
import {
  readControls, applyControls, activeCount, isFiltered, keepControls,
  type Controls, type ControlOptions,
} from "./controls.ts";

const PAGE_SIZE = 30;
/** Chips beyond this crowd the row; the rest are one click away. */
const MAX_ROW_FLAGS = 3;
/** Grouping the whole country by buyer produced 10608 blocks in one page. */
const MAX_GROUPS = 40;

let db: Dataset = await loadDataset();
console.log(
  `loaded ${db.flagCount} flags across ${db.cases.length} tenders ` +
    `(${db.cases.filter((c) => c.detailed).length} with full cards)`,
);

/* ---------- shared pieces ---------- */

function shortRisk(riskId: string): string {
  return RISK_LABELS[riskId]?.short ?? db.ruleById.get(riskId)?.name ?? riskId;
}

function riskFlag(riskId: string): string {
  return `<a class="flag" href="/?risk=${encodeURIComponent(riskId)}">${esc(shortRisk(riskId))}</a>`;
}

/**
 * A cheap severity for list rows. The full conclusion is too heavy to build
 * for 36000 rows, so this uses the same signals it leans on most.
 */
function rowSeverity(entry: Case): "high" | "medium" | "low" {
  if (entry.findings.length > 0) return "high";
  if (entry.bidders === 1 || entry.risks.length >= 3) return "medium";
  return "low";
}

const SEVERITY_TITLE: Record<string, string> = {
  high: "Ми знайшли розбіжність у ціні",
  medium: "Є на що подивитися: без конкурентів або кілька ознак",
  low: "Позначено державою",
};

/** The one-glance signals that make a case worth opening. */
function alarms(entry: Case): string[] {
  const out: string[] = [];
  for (const finding of entry.findings) out.push(finding.title);
  if (entry.detailed && entry.bidders === 1) out.push("Єдиний учасник");
  if ((entry.value_amount ?? 0) >= 1e9) out.push("Понад мільярд");
  if (entry.risks.length >= 3) out.push(`${entry.risks.length} індикатори одразу`);
  return out;
}

/** Star list for the request being rendered. Set once at the top of render(). */
let starred: Favourite[] = [];

/**
 * The star toggle. A plain form, so the site still needs no scripts.
 * `back` is where the visitor returns after the POST.
 */
function star(kind: FavKind, id: string, back: string, opts: { label?: boolean } = {}): string {
  if (!id) return "";
  const on = isStarred(starred, kind, id);
  const title = on ? "Прибрати з обраного" : "Додати до обраного";
  return `<form class="star-form" method="post" action="/starred/toggle">
  <input type="hidden" name="kind" value="${esc(kind)}">
  <input type="hidden" name="id" value="${esc(id)}">
  <input type="hidden" name="back" value="${esc(back)}">
  <button type="submit" class="star${on ? " on" : ""}" title="${title}" aria-label="${title}" aria-pressed="${on}">${on ? "★" : "☆"}${opts.label ? `<span>${on ? "В обраному" : "До обраного"}</span>` : ""}</button>
</form>`;
}

function caseRow(entry: Case, opts: { showOfficer?: boolean; showEntity?: boolean } = {}): string {
  const showOfficer = opts.showOfficer ?? true;
  const showEntity = opts.showEntity ?? true;

  // Tenders without a full card have no title of their own. Falling back to
  // the buyer's name printed it twice: once as the heading, once in the meta.
  const buyer = readableName(entry.entity_name);
  const hasOwnTitle = Boolean(entry.title);
  const title = hasOwnTitle ? trim(entry.title as string, 110) : buyer || "Закупівля";

  const meta: string[] = [];
  if (showEntity && buyer && hasOwnTitle) {
    meta.push(`<a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(buyer)}</a>`);
  }
  if (entry.region) meta.push(esc(entry.region));
  if (entry.tender_date) meta.push(date(entry.tender_date));

  const people: string[] = [];
  if (showOfficer && entry.officer_name) {
    people.push(`вів(ла) <a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a>`);
  }
  if (entry.winner_name) {
    people.push(
      `виграв <a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a>`,
    );
  }

  const severity = rowSeverity(entry);

  return `<div class="row sev-${severity}">
  <span class="dot" title="${esc(SEVERITY_TITLE[severity])}" aria-label="${esc(SEVERITY_TITLE[severity])}"></span>
  <div class="who">
    <div class="name">${star("tender", entry.tender_id, "/tender/" + encodeURIComponent(entry.tender_id))}<a href="/tender/${encodeURIComponent(entry.tender_id)}">${esc(title)}</a></div>
    <div class="meta">${meta.join(" · ")}</div>
    ${people.length ? `<div class="meta">${people.join(" · ")}</div>` : ""}
  </div>
  <div class="amount">
    <span class="big">${shortMoney(entry.value_amount)}</span>
    <span class="exact">${esc(entry.tender_ref || entry.tender_id)}</span>
  </div>
  <div class="flags">
    ${alarms(entry).map((a) => `<span class="flag alarm">${esc(a)}</span>`).join("")}
    ${entry.risks.slice(0, MAX_ROW_FLAGS).map(riskFlag).join("")}
    ${
      entry.risks.length > MAX_ROW_FLAGS
        ? `<a class="flag more" href="/tender/${encodeURIComponent(entry.tender_id)}">ще ${entry.risks.length - MAX_ROW_FLAGS}</a>`
        : ""
    }
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
  const legal = INDICATOR_LEGAL[riskId];

  // The state publishes the norm for eight of the fourteen indicators. Where
  // it does, that citation is authoritative and is shown as the state's own;
  // where it does not, our reading is shown and labelled as ours.
  const stateNorm = rule?.legitimateness?.trim();
  const norm = stateNorm
    ? `<p class="legal"><strong>Норма, яку наводить держава:</strong> ${esc(stateNorm)}</p>`
    : legal?.norm
      ? `<p class="legal reading"><strong>Норма — наше зіставлення:</strong> ${esc(legal.norm)}</p>
  <p class="faint">${esc(legal.normNote ?? "")}</p>`
      : `<p class="faint">Держава не наводить норму для цього індикатора, і ми не беремося її добудувати.</p>`;

  const criminal = legal?.criminal.length
    ? `<details class="sub">
  <summary>Що це може означати за кримінальним законом — ${legal.criminal.length} ${plural(legal.criminal.length, "напрям", "напрями", "напрямів")}</summary>
  <div class="inner">
    <p class="faint">Це напрями перевірки для юриста, а не кваліфікація дій. Умисел встановлює лише суд.</p>
    ${legal.criminal
      .map((direction) => {
        const article = ARTICLES[direction.code];
        return `<p><strong>Стаття ${esc(direction.code)} ККУ — ${esc(article?.title ?? "")}</strong><br>${esc(direction.why)}<br><a href="/article/${esc(direction.code)}">Усі закупівлі за цим напрямом →</a></p>`;
      })
      .join("")}
  </div>
</details>`
    : "";

  return `<div class="card">
  <h3><span class="tier state">Позначила держава</span> &nbsp;${esc(label?.short ?? rule?.name ?? riskId)}${count ? ` <span class="faint">— ${count} ${plural(count, "раз", "рази", "разів")}</span>` : ""}</h3>
  ${label ? `<p class="lead">${esc(label.means)}</p>` : ""}
  ${rule?.name && label ? `<p class="faint"><strong>Офіційне формулювання:</strong> ${esc(rule.name)}</p>` : ""}
  ${norm}
  ${criminal}
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

/**
 * One-click starting points. A newcomer should not have to understand the
 * filter vocabulary before seeing anything useful, so the common questions
 * are pre-written as links.
 */
type Preset = { label: string; hint: string; query: string };

function presetsFor(action: string): Preset[] {
  const base: Preset[] = [
    { label: "Усі", hint: "повний перелік", query: "" },
    { label: "Завищена ціна", hint: "ми порахували переплату", query: "price=1" },
    { label: "Без конкурентів", hint: "подався один учасник", query: "solo=1" },
    { label: "Від 100 млн", hint: "найбільші суми", query: "min=100000000" },
    { label: "Кілька ознак", hint: "спрацювало 2 і більше", query: "sort=risks" },
    { label: "Найновіші", hint: "свіжі закупівлі", query: "sort=date" },
  ];
  return action === "/prices" ? base.filter((p) => p.query !== "price=1") : base;
}

/** Marks the preset that matches the current query, so the state is visible. */
function presetBar(action: string, url: URL, c: Controls): string {
  const current = new URLSearchParams();
  if (c.priceOnly) current.set("price", "1");
  if (c.soloOnly) current.set("solo", "1");
  if (c.min > 0) current.set("min", String(c.min));
  if (c.sort !== "value") current.set("sort", c.sort);
  const currentKey = current.toString();

  return `<div class="presets">
  ${presetsFor(action)
    .map((p) => {
      const active = p.query === currentKey;
      const href = p.query ? `${action}?${p.query}` : action;
      return `<a class="preset${active ? " on" : ""}" href="${esc(href)}" title="${esc(p.hint)}">${esc(p.label)}</a>`;
    })
    .join("")}
</div>`;
}

/** Sort and grouping, always visible — they are the two controls people use. */
function sortBar(action: string, c: Controls, extra = ""): string {
  const dimensionOptions = (selected: Dimension, skip?: Dimension) =>
    DIMENSIONS.filter((d) => d.value !== skip || d.value === "")
      .map((d) => `<option value="${d.value}"${d.value === selected ? " selected" : ""}>${esc(d.label)}</option>`)
      .join("");

  const hidden = (name: string, value: string) =>
    value ? `<input type="hidden" name="${name}" value="${esc(value)}">` : "";

  return `<form class="sortbar" method="get" action="${esc(action)}">
  <input type="search" name="q" value="${esc(c.q)}" placeholder="Пошук за назвою, замовником, ЄДРПОУ" aria-label="Пошук">
  ${extra}
  ${hidden("risk", c.risk)}${hidden("region", c.region)}
  ${hidden("from", c.dateFrom)}${hidden("to", c.dateTo)}
  ${hidden("min", c.min > 0 ? String(c.min) : "")}${hidden("max", c.max > 0 ? String(c.max) : "")}
  ${c.railOnly ? '<input type="hidden" name="rail" value="1">' : ""}
  ${c.soloOnly ? '<input type="hidden" name="solo" value="1">' : ""}
  ${c.priceOnly ? '<input type="hidden" name="price" value="1">' : ""}

  <label>Сорт.
    <select name="sort" onchange="this.form.submit()">
      <option value="value"${c.sort === "value" ? " selected" : ""}>за сумою, спадання</option>
      <option value="value-asc"${c.sort === "value-asc" ? " selected" : ""}>за сумою, зростання</option>
      <option value="date"${c.sort === "date" ? " selected" : ""}>новіші закупівлі</option>
      <option value="date-asc"${c.sort === "date-asc" ? " selected" : ""}>старіші закупівлі</option>
      <option value="assessed"${c.sort === "assessed" ? " selected" : ""}>нещодавно позначені</option>
      <option value="risks"${c.sort === "risks" ? " selected" : ""}>більше ознак</option>
    </select>
  </label>

  <label>Групи
    <select name="group" onchange="this.form.submit()">${dimensionOptions(c.group)}</select>
  </label>

  ${
    c.group
      ? `<label>потім
    <select name="then" onchange="this.form.submit()">${dimensionOptions(c.then, c.group)}</select>
  </label>`
      : ""
  }

  <button type="submit" class="go">Показати</button>
</form>`;
}

/** One compact line, not a panel: a newcomer needs it once, a returning
 *  reader needs the screen. The detail lives behind the link. */
const PRIMER = `<div class="primer">
  <span><b>1</b> держава позначає підозрілі</span>
  <span><b>2</b> ми пояснюємо і рахуємо ціну</span>
  <span><b>3</b> у кожній — висновок і звіт</span>
  <a href="/about">Докладніше</a>
</div>`;

/** Renders one group, and its nested groups, as a collapsible block. */
function groupBlock(group: Group, depth: number): string {
  const inner =
    group.children.length > 0
      ? group.children.map((child) => groupBlock(child, depth + 1)).join("")
      : `<div class="rows">${group.cases.slice(0, 20).map((c) => caseRow(c)).join("")}</div>${
          group.cases.length > 20
            ? `<p class="hint" style="margin:.6rem 0 0">Показано 20 найдорожчих із ${group.cases.length}.</p>`
            : ""
        }`;

  return `<details class="group-block depth-${depth}"${depth === 0 && group.cases.length <= 40 ? " open" : ""}>
  <summary>
    <span class="g-name">${esc(readableName(group.bucket.label))}</span>
    <span class="g-meta">${group.cases.length} ${plural(group.cases.length, "закупівля", "закупівлі", "закупівель")} · ${shortMoney(group.value)}</span>
  </summary>
  <div class="g-body">
    ${group.bucket.href ? `<p class="hint" style="margin:0 0 .6rem"><a href="${esc(group.bucket.href)}">Відкрити повне досьє →</a></p>` : ""}
    ${inner}
  </div>
</details>`;
}

/* ---------- shared list controls ---------- */

/**
 * The filter panel. Identical on every page that shows tenders; `action` is
 * where it submits, so each tab filters its own scope.
 */
function filterPanel(action: string, c: Controls, opts: ControlOptions = {}, extra = ""): string {
  const dimensionOptions = (selected: Dimension, skip?: Dimension) =>
    DIMENSIONS.filter((d) => d.value !== skip || d.value === "")
      .map((d) => `<option value="${d.value}"${d.value === selected ? " selected" : ""}>${esc(d.label)}</option>`)
      .join("");

  const stamps = db.cases.map((x) => x.tender_date ?? "").filter(Boolean).sort();
  const earliest = stamps[0] ?? "";
  const latest = stamps[stamps.length - 1] ?? "";
  const regions = [...new Set(db.cases.map((x) => x.region ?? "").filter(Boolean))].sort();
  const amounts = db.cases.map((x) => x.value_amount ?? 0).filter((n) => n > 0);
  const rangeHint = amounts.length
    ? `у базі від ${shortMoney(Math.min(...amounts))} до ${shortMoney(Math.max(...amounts))}`
    : "";

  const active = activeCount(c);
  const anything = isFiltered(c) || Boolean(c.group);

  return `<form class="filters" method="get" action="${esc(action)}">
  <input type="hidden" name="q" value="${esc(c.q)}">
  ${extra}
  <details class="filters-more"${anything ? " open" : ""}>
    <summary>Більше фільтрів${active > 0 ? ` <span class="badge">${active}</span>` : ""}${anything ? ` <a class="reset" href="${esc(action)}">скинути все</a>` : ""}</summary>
    <div class="inner">
      <div class="filter-row">
        <select name="risk" aria-label="Ознака">
          <option value="">Будь-яка ознака</option>
          ${db.rules
            .map(
              (r) =>
                `<option value="${esc(r.risk_id)}"${r.risk_id === c.risk ? " selected" : ""}>${esc(shortRisk(r.risk_id))}</option>`,
            )
            .join("")}
        </select>
        <select name="region" aria-label="Область">
          <option value="">Уся Україна</option>
          ${regions
            .map((r) => `<option value="${esc(r)}"${r === c.region ? " selected" : ""}>${esc(r)}</option>`)
            .join("")}
        </select>
        <input type="hidden" name="sort" value="${esc(c.sort)}">
        <input type="hidden" name="group" value="${esc(c.group)}">
        <input type="hidden" name="then" value="${esc(c.then)}">
      </div>

      <div class="filter-row">
        <span class="filter-label">Дата закупівлі</span>
        <input type="date" name="from" value="${esc(c.dateFrom)}" aria-label="Дата від" min="${esc(earliest)}" max="${esc(latest)}">
        <span class="filter-label">по</span>
        <input type="date" name="to" value="${esc(c.dateTo)}" aria-label="Дата по" min="${esc(earliest)}" max="${esc(latest)}">
      </div>

      <div class="filter-row">
        <span class="filter-label">Сума, ₴</span>
        <input type="number" name="min" value="${c.min > 0 ? c.min : ""}" placeholder="від" aria-label="Сума від" min="0" step="100000" class="num">
        <span class="filter-label">по</span>
        <input type="number" name="max" value="${c.max > 0 ? c.max : ""}" placeholder="до" aria-label="Сума до" min="0" step="100000" class="num">
        <span class="filter-label faint">${esc(rangeHint)}</span>
      </div>

      <div class="filter-row">
        ${opts.hideRail ? "" : `<label class="check"><input type="checkbox" name="rail" value="1"${c.railOnly ? " checked" : ""}> лише залізниця</label>`}
        <label class="check"><input type="checkbox" name="solo" value="1"${c.soloOnly ? " checked" : ""}> лише без конкурентів</label>
        ${opts.hidePrice ? "" : `<label class="check"><input type="checkbox" name="price" value="1"${c.priceOnly ? " checked" : ""}> лише де ціна завищена</label>`}
        <button type="submit">Показати</button>
      </div>
    </div>
  </details>
</form>`;
}

/** The result count line, so a folded panel never hides what was applied. */
function resultLine(list: Case[], c: Controls, groupCount: number): string {
  const value = list.reduce((sum, x) => sum + (x.value_amount ?? 0), 0);
  const base = isFiltered(c)
    ? `Знайдено <strong>${list.length.toLocaleString("uk-UA")}</strong> ${plural(list.length, "закупівлю", "закупівлі", "закупівель")} на ${shortMoney(value)}.`
    : `Показано <strong>${list.length.toLocaleString("uk-UA")}</strong> ${plural(list.length, "закупівлю", "закупівлі", "закупівель")} на ${shortMoney(value)}.`;
  return `<p class="hint">${base}${c.group ? ` Згруповано у <strong>${groupCount}</strong> ${plural(groupCount, "групу", "групи", "груп")}.` : ""}</p>`;
}

/** Rows, or collapsible groups, plus the pager. Shared by every list page. */
function listBody(
  list: Case[],
  c: Controls,
  action: string,
  rowOpts: { showOfficer?: boolean; showEntity?: boolean } = {},
): string {
  if (list.length === 0) {
    return '<div class="empty">За цими умовами нічого не знайшлося. Спробуйте прибрати частину фільтрів.</div>';
  }

  if (c.group) {
    const groups = buildGroups(list, c.group, c.then, shortRisk);
    const shown = groups.slice(0, MAX_GROUPS);
    const hidden = groups.length - shown.length;
    return `${resultLine(list, c, groups.length)}${shown.map((g) => groupBlock(g, 0)).join("")}${
      hidden > 0
        ? `<p class="note">Показано ${MAX_GROUPS} найбільших ${plural(MAX_GROUPS, "групу", "групи", "груп")} із ${groups.length.toLocaleString("uk-UA")}. Звузьте вибірку фільтрами, щоб побачити решту.</p>`
        : ""
    }`;
  }

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(c.page, pages);
  const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return `${resultLine(list, c, 0)}
<div class="rows">${slice.map((x) => caseRow(x, rowOpts)).join("")}</div>
${
  pages > 1
    ? `<div class="pager">
  ${page > 1 ? `<a href="${keepControls(action, c, { page: String(page - 1) })}">← попередні</a>` : ""}
  <span>сторінка ${page} з ${pages}</span>
  ${page < pages ? `<a href="${keepControls(action, c, { page: String(page + 1) })}">наступні →</a>` : ""}
</div>`
    : ""
}`;
}

function feedPage(url: URL): string {
  const c = readControls(url);
  const list = applyControls(db.cases, c, RAILWAY_EDRPOU);

  return layout({
    title: "Закупівлі",
    nav: "feed",
    body: `
<h1>Закупівлі, які варто перевірити</h1>
<p class="sub">Публічні закупівлі всієї України, які держава позначила як підозрілі.</p>

<p class="statline">
  <b>${db.cases.length.toLocaleString("uk-UA")}</b> закупівель ·
  <b>${shortMoney(db.totalValue)}</b> ·
  <b>${db.flagCount.toLocaleString("uk-UA")}</b> ознак ·
  <b>${db.findingCount.toLocaleString("uk-UA")}</b> переплат
</p>

${PRIMER}

${presetBar("/", url, c)}
${sortBar("/", c)}
${filterPanel("/", c)}

${c.risk ? riskCard(c.risk) : ""}

${listBody(list, c, "/")}

<p class="note">Позначка означає, що спрацював індикатор державної системи моніторингу закупівель. Це ознака ризику, яка потребує перевірки, а не встановлений факт порушення.</p>
`,
  });
}

/** The expanded legal qualification for one tender. */
function qualificationBlock(entry: Case): string {
  const q = buildQualification(entry, db.ruleById);

  return `<p class="caution">${esc(q.caution)}</p>

<h3 class="block-head">Норми, які зачеплені</h3>
${q.norms
  .map(
    (n) => `<div class="card">
  <p class="${n.source === "state" ? "legal" : "legal reading"}"><strong>${n.source === "state" ? "Норма, яку наводить держава" : "Норма — наше зіставлення"}:</strong> ${esc(n.norm)}</p>
  ${n.note ? `<p class="faint">${esc(n.note)}</p>` : ""}
  <p class="faint">Підстава: ${n.from.map((f) => esc(f)).join(" · ")}</p>
</div>`,
  )
  .join("")}

<h3 class="block-head">Що з цього випливає за законом про закупівлі</h3>
${q.consequences
  .map(
    (c) => `<div class="card">
  <h3>${esc(c.norm)}</h3>
  <p class="lead">${esc(c.effect)}</p>
</div>`,
  )
  .join("")}

<h3 class="block-head">Адміністративна відповідальність</h3>
${q.admin
  .map(
    (a) => `<div class="card">
  <h3>Стаття 164-14 КУпАП, ${esc(a.part)}</h3>
  <p class="lead">${esc(a.conduct)}</p>
  <dl class="facts">
    <dt>Санкція</dt><dd><strong>${esc(a.fine)}</strong> на службових та уповноважених осіб замовника</dd>
    <dt>Підстава</dt><dd>${a.from.map((f) => esc(f)).join(" · ")}</dd>
  </dl>
  <p class="faint">Розмір наведено в неоподатковуваних мінімумах доходів громадян; для штрафів ця одиниця становить 17 грн.</p>
</div>`,
  )
  .join("")}

<h3 class="block-head">Кримінально-правові напрями</h3>
<p class="hint">Для кожного напряму — що доводити і якими документами.</p>
${q.criminal
  .map(
    (c) => `<div class="card">
  <h3>Стаття ${esc(c.code)} ККУ — ${esc(c.title)}</h3>
  <p class="lead">${esc(c.summary)}</p>
  <p><strong>Чому цей напрям виникає саме тут:</strong></p>
  <ul>${c.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
  <details class="sub">
    <summary>Що має бути доведено та які документи витребувати</summary>
    <div class="inner">
      <p><strong>Склад:</strong></p>
      <ul>${c.elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      <p><strong>Докази:</strong></p>
      <ul>${c.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>
  </details>
</div>`,
  )
  .join("")}`;
}

/** The system's own reading of one tender, rendered for the page. */
function conclusionBlock(entry: Case, sameEntity: Case[], sameOfficer: Case[], sameWinner: Case[]): string {
  const c = buildConclusion({ entry, sameEntity, sameOfficer, sameWinner });
  // The tag states the priority; the headline says why. They must not repeat.
  const levelLabel = c.level === "high" ? "Високий пріоритет" : c.level === "medium" ? "Середній пріоритет" : "Низький пріоритет";

  return `<div class="card verdict ${esc(c.level)}">
  <h3><span class="verdict-tag">${esc(levelLabel)}</span> ${esc(c.headline)}</h3>
  ${
    c.observations.length > 0
      ? `<ol class="findings">${c.observations
          .map(
            (o) => `<li class="w-${esc(o.weight)}">
    <strong>${esc(o.title)}</strong>
    <span>${esc(o.detail)}</span>
  </li>`,
          )
          .join("")}</ol>`
      : `<p class="lead">Державна система позначила цю закупівлю, але наші власні перевірки — ціна проти ринку, конкуренція, повторюваність зв'язків — нічого додаткового не показали.</p>`
  }
  <p><strong>Що перевірити далі:</strong></p>
  <ul>${c.nextSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
  <p class="faint">Цей висновок склала система з чисел, наведених вище. Він не встановлює порушення і не є кваліфікацією дій будь-якої особи.</p>
</div>`;
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
${star("tender", entry.tender_id, "/tender/" + encodeURIComponent(entry.tender_id), { label: true })}
<h1 class="long">${esc(title)}</h1>
<p class="sub">${esc(readableName(entry.entity_name))} · <span class="ref">${esc(entry.tender_ref || entry.tender_id)}</span></p>

${signals.length ? `<div class="flags" style="margin-bottom:1.25rem">${signals.map((s) => `<span class="flag alarm">${esc(s)}</span>`).join("")}</div>` : ""}

<div class="actions">
  <a class="action primary" href="/tender/${encodeURIComponent(entry.tender_id)}/report">Завантажити звіт — PDF або друк</a>
  <a class="action" href="/tender/${encodeURIComponent(entry.tender_id)}/report.txt">Текстовим файлом</a>
  <a class="action" href="https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}" target="_blank" rel="noopener">Першоджерело в Prozorro</a>
</div>

<div class="card">
  <dl class="facts">
    <dt>Сума</dt><dd><strong>${money(entry.value_amount)}</strong> <span class="faint">(${shortMoney(entry.value_amount)})</span></dd>
    <dt>Замовник</dt><dd><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(readableName(entry.entity_name))}</a><br><span class="faint">ЄДРПОУ ${esc(entry.entity_edrpou ?? "—")}</span></dd>
    <dt>Регіон</dt><dd>${esc(entry.region ?? "—")}</dd>
    ${entry.method ? `<dt>Процедура</dt><dd>${esc(procedureLabel(entry.method) ?? "—")}</dd>` : ""}
    ${entry.detailed ? `<dt>Учасників</dt><dd>${entry.bidders === 1 ? "<strong>один</strong> — конкуренції не було" : entry.bidders || "—"}</dd>` : ""}
    <dt>Дата закупівлі</dt><dd>${date(entry.tender_date)}</dd>
    <dt>Позначено державою</dt><dd>${date(entry.date_assessed)}</dd>
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
<p class="hint">Рахувала система, не держава. Нижче — числа.</p>
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

<h2>Правова кваліфікація</h2>
${qualificationBlock(entry)}

<h2>Наш висновок</h2>
${conclusionBlock(entry, sameEntity, sameOfficer, sameWinner)}

<h2>Цей замовник загалом</h2>
<div class="card">
  <p class="lead">За ${esc(readableName(entry.entity_name))} обліковано <strong>${sameEntity.length}</strong> закупівель із позначками.</p>
  <p><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">Відкрити досьє замовника →</a></p>
</div>

<p class="note">Наявність позначки не означає, що встановлено порушення, і не є звинуваченням названих осіб. Це підстава для перевірки закупівлі людиною.</p>
`,
  });
}

function officerPage(key: string, url: URL): string {
  const dossierAction = `/officer/${encodeURIComponent(key)}`;
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
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);

  return layout({
    title: name,
    nav: "officers",
    body: `
<a class="back" href="/officers">← до переліку посадовців</a>
${star("officer", key, "/officer/" + encodeURIComponent(key), { label: true })}
<h1>${esc(name)}</h1>
<p class="sub">Відповідальна особа в закупівлях${entity ? ` — ${esc(readableName(entity))}` : ""}.</p>

<p class="statline">
  <b>${list.length}</b> закупівель під питанням ·
  <b>${shortMoney(value)}</b> загальна сума ·
  <b>${solo}</b> з єдиним учасником ·
  <b>${ranked.length}</b> різних ознак
</p>

<div class="card">
  <dl class="facts">
    <dt>Пошта</dt><dd>${esc(email ?? "—")}</dd>
    <dt>Телефон</dt><dd>${esc(phone ?? "—")}</dd>
    <dt>Установа</dt><dd><a href="/entity/${encodeURIComponent(entityEdrpou)}">${esc(readableName(entity))}</a></dd>
  </dl>
  <p class="faint" style="margin-top:.9rem">Дані взято з карток закупівель у Prozorro, де замовник сам публікує контактну особу. Одну людину між закупівлями зіставлено за поштою — вона стабільніша за написання імені.</p>
</div>

<h2>Що держава запідозрила в її закупівлях</h2>
<p class="hint">Перелік ознак, що спрацювали. <strong>Не судимість і не встановлена вина.</strong></p>
${groupedRiskCards(ranked)}

<h2>Закупівлі</h2>
${sortBar(dossierAction, ctrl)}
${filterPanel(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction, { showOfficer: false })}

<p class="note">Ця сторінка не є твердженням про правопорушення з боку названої особи. Вона показує, що державна система моніторингу позначила закупівлі, у яких цю особу вказано відповідальною контактною особою.</p>
`,
  });
}

function supplierPage(edrpou: string, url: URL): string {
  const dossierAction = `/supplier/${encodeURIComponent(edrpou)}`;
  const list = db.cases.filter((c) => c.winner_edrpou === edrpou);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.winner_name)?.winner_name ?? edrpou;
  const value = list.reduce((sum, c) => sum + (c.winner_amount ?? c.value_amount ?? 0), 0);
  const ranked = rankRisks(list);
  const buyers = new Set(list.map((c) => c.entity_edrpou).filter(Boolean));
  const solo = list.filter((c) => c.bidders === 1).length;
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);

  return layout({
    title: name,
    nav: "suppliers",
    body: `
<a class="back" href="/suppliers">← до переліку переможців</a>
<h1>${esc(readableName(name))}</h1>
<p class="sub">Постачальник · ЄДРПОУ ${esc(edrpou)}</p>
${star("supplier", edrpou, "/supplier/" + encodeURIComponent(edrpou), { label: true })}

<p class="statline">
  <b>${list.length}</b> перемог у закупівлях із позначками ·
  <b>${shortMoney(value)}</b> сума договорів ·
  <b>${solo}</b> де був єдиним учасником ·
  <b>${buyers.size}</b> різних замовників
</p>

<h2>Що держава запідозрила в цих закупівлях</h2>
${groupedRiskCards(ranked)}

<h2>Закупівлі</h2>
${sortBar(dossierAction, ctrl)}
${filterPanel(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction)}

<p class="note">Перелік охоплює лише закупівлі ${esc(REGION)} та філій залізниці, які вже завантажено. Це не повна історія компанії по Україні.</p>
`,
  });
}

function entityPage(edrpou: string, url: URL): string {
  const dossierAction = `/entity/${encodeURIComponent(edrpou)}`;
  const list = db.cases.filter((c) => c.entity_edrpou === edrpou);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.entity_name)?.entity_name ?? edrpou;
  const value = list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const ranked = rankRisks(list);
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);

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
${star("entity", edrpou, "/entity/" + encodeURIComponent(edrpou), { label: true })}

<p class="statline">
  <b>${list.length}</b> закупівель під питанням ·
  <b>${shortMoney(value)}</b> загальна сума ·
  <b>${solo}</b> з єдиним учасником ·
  <b>${rankedOfficers.length}</b> відповідальних осіб
</p>

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
${sortBar(dossierAction, ctrl)}
${filterPanel(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction, { showEntity: false })}
`,
  });
}

/**
 * Search and sorting for the three directory pages. They hold aggregates,
 * not tenders, so the tender filters have nothing to bite on — a name, a
 * count and a total are the whole of it.
 */
type DirSort = "value" | "value-asc" | "count" | "name";

const DIR_SORTS: { value: DirSort; label: string }[] = [
  { value: "value", label: "за сумою, спадання" },
  { value: "value-asc", label: "за сумою, зростання" },
  { value: "count", label: "за кількістю закупівель" },
  { value: "name", label: "за назвою, А–Я" },
];

type DirControls = { q: string; sort: DirSort };

function readDirControls(url: URL): DirControls {
  const sort = url.searchParams.get("sort") ?? "";
  return {
    q: (url.searchParams.get("q") ?? "").trim().slice(0, 80),
    sort: DIR_SORTS.some((x) => x.value === sort) ? (sort as DirSort) : "value",
  };
}

type DirRow = {
  href: string;
  name: string;
  meta: string;
  value: number;
  count: number;
  kind?: FavKind;
  id?: string;
};

function applyDirControls(rows: DirRow[], c: DirControls): DirRow[] {
  const needle = c.q.toLowerCase();
  // The meta line carries the EDRPOU, which is what someone actually pastes.
  const kept = needle ? rows.filter((r) => `${r.name} ${r.meta}`.toLowerCase().includes(needle)) : rows;
  const out = [...kept];
  switch (c.sort) {
    case "value-asc":
      out.sort((a, b) => a.value - b.value);
      break;
    case "count":
      out.sort((a, b) => b.count - a.count || b.value - a.value);
      break;
    case "name":
      out.sort((a, b) => a.name.localeCompare(b.name, "uk"));
      break;
    default:
      out.sort((a, b) => b.value - a.value);
  }
  return out;
}

function dirBar(action: string, c: DirControls): string {
  const dirty = c.q !== "" || c.sort !== "value";
  return `<form class="sortbar dir" method="get" action="${esc(action)}">
  <input type="search" name="q" value="${esc(c.q)}" placeholder="Назва або ЄДРПОУ" aria-label="Пошук">
  <button class="go" type="submit">Показати</button>
  <label>Сорт.
    <select name="sort" onchange="this.form.submit()">${DIR_SORTS.map(
      (x) => `<option value="${x.value}"${x.value === c.sort ? " selected" : ""}>${esc(x.label)}</option>`,
    ).join("")}</select>
  </label>
  ${dirty ? `<a class="reset" href="${esc(action)}">скинути</a>` : ""}
</form>`;
}

/** Shared renderer for the three directory pages. */
function directoryPage(opts: {
  title: string;
  nav: string;
  heading: string;
  intro: string;
  action: string;
  url: URL;
  rows: DirRow[];
}): string {
  const c = readDirControls(opts.url);
  const rows = applyDirControls(opts.rows, c);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return layout({
    title: opts.title,
    nav: opts.nav,
    body: `
<h1>${esc(opts.heading)}</h1>
<p class="sub">${opts.intro}</p>
${dirBar(opts.action, c)}
<p class="hint">${c.q ? "Знайдено" : "Показано"} <strong>${rows.length.toLocaleString("uk-UA")}</strong> на ${shortMoney(total)}.</p>
${
  rows.length === 0
    ? '<div class="empty">За цим запитом нічого не знайшлося.</div>'
    : `<div class="rows">
${rows
  .slice(0, 150)
  .map(
    (r) => `<div class="row">
  <div class="who">
    <div class="name">${r.kind && r.id ? star(r.kind, r.id, r.href) : ""}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">${r.meta}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`,
  )
  .join("")}
</div>`
}
${rows.length > 150 ? `<p class="note">Показано перші 150 із ${rows.length.toLocaleString("uk-UA")}. Звузьте пошуком, щоб побачити решту.</p>` : ""}
`,
  });
}

function entitiesPage(url: URL): string {
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
    intro: "Установи, у закупівлях яких спрацювали державні індикатори.",
    action: "/entities",
    url,
    rows: [...byEntity.entries()].map(([edrpou, acc]) => ({
      kind: "entity" as FavKind,
      id: edrpou,
      href: `/entity/${encodeURIComponent(edrpou)}`,
      name: readableName(acc.name),
      meta: `ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")}${RAILWAY_EDRPOU.has(edrpou) ? " · залізниця" : ""}`,
      value: acc.value,
      count: acc.count,
    })),
  });
}

function officersPage(url: URL): string {
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
    intro: "Контактні особи закупівель із позначками. Не перелік підозрюваних — перелік того, що варто перевірити.",
    action: "/officers",
    url,
    rows: [...byOfficer.entries()].map(([key, acc]) => ({
      kind: "officer" as FavKind,
      id: key,
      href: `/officer/${encodeURIComponent(key)}`,
      name: acc.name,
      meta: `${esc(readableName(acc.entity))} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")}`,
      value: acc.value,
      count: acc.count,
    })),
  });
}

function suppliersPage(url: URL): string {
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
    intro: "Компанії, які виграли закупівлі з позначками.",
    action: "/suppliers",
    url,
    rows: [...bySupplier.entries()].map(([edrpou, acc]) => ({
      kind: "supplier" as FavKind,
      id: edrpou,
      href: `/supplier/${encodeURIComponent(edrpou)}`,
      name: readableName(acc.name),
      meta: `ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "перемога", "перемоги", "перемог")}${acc.solo ? ` · ${acc.solo} без конкурентів` : ""}`,
      value: acc.value,
      count: acc.count,
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

function railwayPage(url: URL): string {
  const blocks = railwayBlocks();
  const all = blocks.flatMap((b) => b.list);
  const value = all.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const solo = all.filter((c) => c.bidders === 1).length;
  const southern = blocks.find((b) => b.scope === "southern")?.list ?? [];

  // The whole page is railway already, so that checkbox would do nothing.
  const c = readControls(url);
  const filtered = applyControls(all, c, RAILWAY_EDRPOU, { hideRail: true });

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
<p class="sub">Закупівлі залізниці. Три групи, які ми не змішуємо.</p>

<p class="statline">
  <b>${all.length.toLocaleString("uk-UA")}</b> закупівель із позначками ·
  <b>${shortMoney(value)}</b> на таку суму ·
  <b>${solo}</b> з єдиним учасником ·
  <b>${southern.length}</b> у «Південної залізниці»
</p>

<details class="help">
  <summary>Що саме входить у цей розділ</summary>
  <div class="inner">
    <p><strong>Південна залізниця</strong> — регіональна філія АТ «Українська залізниця», що обслуговує Харківщину. Це і є залізниця області у прямому значенні.</p>
    <p><strong>Інші філії Укрзалізниці</strong> зареєстровані в Києві, але закуповують централізовано для всієї мережі, зокрема й для харківських підрозділів. Ми відстежуємо їх окремо й не видаємо за харківські.</p>
    <p><strong>Залізничні заклади Харківщини</strong> — освітні та наукові організації галузі, зареєстровані в області.</p>
    <p>Відбір за назвою навмисно вузький. Ширший шаблон помилково зараховував до залізниці Зміївську теплову електростанцію та дослідну станцію птахівництва.</p>
  </div>
</details>

<h2>Хто закуповує</h2>
${blocks
  .map((block) => {
    const blockValue = block.list.reduce((sum, x) => sum + (x.value_amount ?? 0), 0);
    const entities = new Map<string, { name: string; count: number; value: number }>();
    for (const entry of block.list) {
      const key = entry.entity_edrpou ?? "";
      const acc = entities.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
      acc.count++;
      acc.value += entry.value_amount ?? 0;
      entities.set(key, acc);
    }

    return `
<details class="group-block">
  <summary>
    <span class="g-name">${esc(block.heading)}</span>
    <span class="g-meta">${block.list.length} ${plural(block.list.length, "закупівля", "закупівлі", "закупівель")} · ${shortMoney(blockValue)} · ${entities.size} ${plural(entities.size, "замовник", "замовники", "замовників")}</span>
  </summary>
  <div class="g-body">
<p class="hint">${esc(block.note)}</p>
<div class="rows">
${[...entities.entries()]
  .sort((a, b) => b[1].value - a[1].value)
  .map(
    ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name">${star("entity", edrpou, "/railway")}<a href="/entity/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")} із позначками</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`,
  )
  .join("")}
</div>
  </div>
</details>`;
  })
  .join("")}

<h2>Закупівлі залізниці</h2>
${presetBar("/railway", url, c)}
${sortBar("/railway", c)}
${filterPanel("/railway", c, { hideRail: true })}
${listBody(filtered, c, "/railway")}

<h2>Що держава запідозрила в залізничних закупівлях</h2>
${groupedRiskCards(rankRisks(all))}

<h2>Хто виграє залізничні тендери</h2>
<p class="hint">П'ятнадцять найбільших переможців.</p>
<div class="rows">
${topSuppliers
  .map(
    ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name">${star("supplier", edrpou, "/railway")}<a href="/supplier/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
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
  const articleAction = `/article/${article.code}`;
  const jointHidden = jointOnly ? '<input type="hidden" name="at" value="1">' : "";
  const ctrl = readControls(url);

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

  // applyControls re-sorts by amount. On this page the article's own ranking
  // — how many of its indicators fired — is the more useful order, so it
  // stands unless the visitor picks a sort themselves.
  let shown = applyControls(sorted, ctrl, RAILWAY_EDRPOU);
  if (!url.searchParams.get("sort")) {
    const keep = new Set(shown);
    shown = sorted.filter((x) => keep.has(x));
  }

  return layout({
    title: `Стаття ${article.code}`,
    nav: `article-${article.code}`,
    body: `
<h1>Підроблення документів</h1>
<p class="sub">Розбіжності в договорах, угодах і звітах — те, що перевіряють за статтею ${esc(article.code)}.</p>

<p class="statline">
  <b>${list.length.toLocaleString("uk-UA")}</b> ${plural(list.length, "закупівля", "закупівлі", "закупівель")} ·
  <b>${shortMoney(value)}</b> ·
  <b>${solo}</b> без конкурентів ·
  <b>${officers.size}</b> ${plural(officers.size, "відповідальна особа", "відповідальні особи", "відповідальних осіб")}
</p>

<p class="caution">Це список для перевірки, а не звинувачення: індикатори показують розбіжності в документах, а умисел встановлює лише суд.</p>

<details class="help">
  <summary>Що каже стаття ${esc(article.code)}</summary>
  <div class="inner">
    <p class="lead">${esc(article.summary)}</p>
    <p><strong>Що має бути доведено:</strong></p>
    <ul>
      ${article.elements.map((e) => `<li>${esc(e)}</li>`).join("")}
    </ul>
    <p class="faint">Наведено як довідку для юриста. Це не правова консультація і не кваліфікація чиїхось дій.</p>
  </div>
</details>

<details class="help">
  <summary>Чому саме ці ознаки, а не всі чотирнадцять</summary>
  <div class="inner">
    <p>Із чотирнадцяти державних індикаторів для цієї статті релевантні ${article.links.length}. Решта стосуються конкуренції та процедури, а не змісту документів.</p>
    ${article.links
      .map((link) => {
        const label = RISK_LABELS[link.risk_id];
        const hits = list.filter((c) => c.risks.includes(link.risk_id)).length;
        return `<p><strong>${esc(label?.short ?? link.risk_id)}</strong> <span class="faint">— ${hits} ${plural(hits, "закупівля", "закупівлі", "закупівель")}</span><br>${esc(link.why)}</p>`;
      })
      .join("")}
  </div>
</details>

<h2>Закупівлі для перевірки</h2>
<form class="filters" method="get" action="/article/${esc(article.code)}">
  <div class="filter-row">
    <label class="check"><input type="checkbox" name="at" value="1"${jointOnly ? " checked" : ""}> лише акціонерні товариства (АТ)</label>
    <button type="submit">Показати</button>
    ${jointOnly ? `<a class="reset" href="/article/${esc(article.code)}">скинути</a>` : ""}
  </div>
</form>
${sortBar(articleAction, ctrl, jointHidden)}
${filterPanel(articleAction, ctrl, {}, jointHidden)}
${listBody(shown, ctrl, articleAction)}

<p class="note">Перелік сформовано автоматично за індикаторами державної системи моніторингу закупівель. Він не встановлює факт правопорушення і не є твердженням щодо будь-якої названої особи чи компанії. Наступний крок — витребувати самі документи й перевірити їх.</p>
`,
  });
}


/* ---------- what changed ---------- */

function updatesPage(url: URL): string {
  const runs = [...db.runs].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const latest = runs[0];
  const newIds = new Set(latest?.new_tender_ids ?? []);
  const freshAll = db.cases.filter((x) => newIds.has(x.tender_id));
  const c = readControls(url);
  const fresh = applyControls(freshAll, c, RAILWAY_EDRPOU);

  return layout({
    title: "Оновлення",
    nav: "updates",
    body: `
<h1>Що змінилося</h1>
<p class="sub">Щодня звіряємося з державним масивом і додаємо нове.</p>

${
  latest
    ? `<p class="statline">
  <b>${latest.new_tenders}</b> нових закупівель востаннє ·
  <b>${latest.new_flags}</b> нових спрацювань ·
  <b>${date(latest.started_at)}</b> останнє оновлення ·
  <b>${runs.length}</b> ${plural(runs.length, "запуск", "запуски", "запусків")}
</p>`
    : '<div class="empty">Жодного запуску ще не було. Виконайте <code>npm run daily</code>.</div>'
}

${
  freshAll.length > 0
    ? `<h2>Нові закупівлі з останнього оновлення</h2>
${sortBar("/updates", c)}
${filterPanel("/updates", c)}
${listBody(fresh, c, "/updates")}`
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

function pricesPage(url: URL): string {
  const withFindings = db.cases.filter((c) => c.findings.length > 0);
  const gapOf = (c: Case) =>
    c.findings.reduce((total, f) => {
      const e = f.evidence as { overpayment?: number; extra_cost?: number };
      return total + (e.overpayment ?? e.extra_cost ?? 0);
    }, 0);

  const totalGap = withFindings.reduce((t, c) => t + gapOf(c), 0);
  const peer = withFindings.filter((c) => c.findings.some((f) => f.detector_key === "peer_price")).length;
  const growth = withFindings.filter((c) => c.findings.some((f) => f.detector_key === "own_price_growth")).length;

  // Every tender here already has a price finding, so that checkbox is moot.
  const c = readControls(url);
  const list = applyControls(withFindings, c, RAILWAY_EDRPOU, { hidePrice: true });

  return layout({
    title: "Завищені ціни",
    nav: "prices",
    body: `
<h1>Де ціна виглядає завищеною</h1>
<p class="sub">Рахуємо самі: ціна за одиницю проти інших закупівель і проти минулих цін цього замовника.</p>

<p class="statline">
  <b>${withFindings.length}</b> закупівель із завищеною ціною ·
  <b>${shortMoney(totalGap)}</b> різниця проти звичайної ціни ·
  <b>${peer}</b> дорожче, ніж в інших ·
  <b>${growth}</b> дорожче, ніж було торік
</p>

<details class="help">
  <summary>Як ми це рахуємо</summary>
  <div class="inner">
    <p>Спочатку рахуємо <strong>ціну за одиницю</strong>: суму договору ділимо на кількість. Наприклад, 4 млн грн за 200 холодильників — це 20 тисяч за штуку.</p>
    <p>Далі шукаємо, за скільки те саме купували інші, і беремо середину. Якщо ціна помітно вища за середину — показуємо.</p>
    <p>Окремо порівнюємо замовника з ним самим: скільки він платив за це раніше. Тут місцеві умови однакові, тож стрибок ціни складніше пояснити.</p>
    <p><strong>Ми мовчимо, коли порівняти чесно не можна.</strong> Ремонти й послуги не порівнюємо — кожен об'єкт свій. Не порівнюємо й товари всередині надто широкого коду: під одним кодом можуть бути і прокладка за 400 грн, і редуктор за мільйон.</p>
  </div>
</details>

${presetBar("/prices", url, c)}
${sortBar("/prices", c)}
${filterPanel("/prices", c, { hidePrice: true })}

${listBody(list, c, "/prices")}

<p class="note">Різниця в ціні — це ще не порушення. Вона може мати пояснення: інші умови постачання, інший час, інша якість. Наше завдання — показати, де це пояснення варто запитати.</p>
`,
  });
}

/* ---------- saved companies and EDRPOU lookup ---------- */

/** The save / unsave button. A plain form so the site still needs no scripts. */
function saveControl(edrpou: string, saved: string[], back: string): string {
  const isSaved = saved.includes(edrpou);
  return `<form class="save-form" method="post" action="/saved/toggle">
  <input type="hidden" name="edrpou" value="${esc(edrpou)}">
  <input type="hidden" name="back" value="${esc(back)}">
  <button type="submit" class="save-btn${isSaved ? " on" : ""}">${isSaved ? "★ У збережених" : "☆ Зберегти підприємство"}</button>
</form>`;
}

/** What we hold on one EDRPOU, from either side of a tender. */
function profileOf(edrpou: string): { asBuyer: Case[]; asWinner: Case[]; name: string | null } {
  const asBuyer = db.cases.filter((c) => c.entity_edrpou === edrpou);
  const asWinner = db.cases.filter((c) => c.winner_edrpou === edrpou);
  const name =
    asBuyer.find((c) => c.entity_name)?.entity_name ?? asWinner.find((c) => c.winner_name)?.winner_name ?? null;
  return { asBuyer, asWinner, name };
}

function lookupPage(code: string | null, typed: string): string {
  const profile = code ? profileOf(code) : null;
  const found = Boolean(profile && (profile.asBuyer.length > 0 || profile.asWinner.length > 0));

  return layout({
    title: "Пошук за ЄДРПОУ",
    nav: "lookup",
    body: `
<h1>Пошук підприємства за ЄДРПОУ</h1>
<p class="sub">Код підприємства — покажемо все, що про нього є в базі.</p>

<form class="filters" method="get" action="/lookup">
  <div class="filter-row">
    <input type="search" name="edrpou" value="${esc(typed)}" placeholder="Наприклад, 00131954 — АТ «Харківобленерго»" aria-label="ЄДРПОУ" inputmode="numeric">
    <button type="submit">Знайти</button>
  </div>
</form>

${
  typed && !code
    ? `<div class="empty">«${esc(typed)}» не схоже на код ЄДРПОУ. Це від шести до десяти цифр.</div>`
    : ""
}

${
  code && !found
    ? `<div class="empty">
  <p>Код <strong>${esc(code)}</strong> у нашій базі не зустрічається.</p>
  <p class="faint">Ми зберігаємо лише закупівлі Харківської області та філій залізниці, у яких спрацював державний індикатор. Підприємство може існувати й працювати в інших регіонах.</p>
  <p><a href="https://prozorro.gov.ua/search/tenders?edrpou=${encodeURIComponent(code)}" target="_blank" rel="noopener">Пошук цього коду в Prozorro →</a></p>
</div>`
    : ""
}

${
  found && profile
    ? `${star("entity", code as string, "/lookup?edrpou=" + encodeURIComponent(code as string), { label: true })}
<h2>${esc(readableName(profile.name))}</h2>
<p class="statline">
  <b>${profile.asBuyer.length}</b> ${plural(profile.asBuyer.length, "закупівля як замовник", "закупівлі як замовник", "закупівель як замовник")} ·
  <b>${profile.asWinner.length}</b> ${plural(profile.asWinner.length, "перемога як постачальник", "перемоги як постачальник", "перемог як постачальник")}
</p>
<div class="filter-row" style="margin-bottom:1.5rem">
  ${profile.asBuyer.length ? `<a class="flag" href="/entity/${encodeURIComponent(code as string)}">Досьє замовника →</a>` : ""}
  ${profile.asWinner.length ? `<a class="flag" href="/supplier/${encodeURIComponent(code as string)}">Досьє постачальника →</a>` : ""}
</div>
<div class="rows">${[...profile.asBuyer, ...profile.asWinner]
        .sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0))
        .slice(0, 30)
        .map((c) => caseRow(c))
        .join("")}</div>`
    : ""
}
`,
  });
}

function starredPage(saved: Favourite[], url: URL): string {
  const tenders = saved.filter((f) => f.kind === "tender").map((f) => db.byTender.get(f.id)).filter((c): c is Case => Boolean(c));
  const missingTenders = saved.filter((f) => f.kind === "tender").length - tenders.length;
  const c = readControls(url);
  const filteredTenders = applyControls(tenders, c, RAILWAY_EDRPOU);

  const companyRows = saved
    .filter((f) => f.kind === "entity" || f.kind === "supplier")
    .map((f) => {
      const list =
        f.kind === "entity"
          ? db.cases.filter((c) => c.entity_edrpou === f.id)
          : db.cases.filter((c) => c.winner_edrpou === f.id);
      const name =
        f.kind === "entity"
          ? list.find((c) => c.entity_name)?.entity_name
          : list.find((c) => c.winner_name)?.winner_name;
      return {
        fav: f,
        href: `/${f.kind === "entity" ? "entity" : "supplier"}/${encodeURIComponent(f.id)}`,
        name: readableName(name ?? "") || f.id,
        role: f.kind === "entity" ? "замовник" : "постачальник",
        count: list.length,
        value: list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0),
      };
    });

  const officerRows = saved
    .filter((f) => f.kind === "officer")
    .map((f) => {
      const list = db.cases.filter((c) => c.officer_key === f.id);
      return {
        fav: f,
        href: `/officer/${encodeURIComponent(f.id)}`,
        name: list.find((c) => c.officer_name)?.officer_name ?? f.id,
        entity: readableName(list.find((c) => c.entity_name)?.entity_name ?? ""),
        count: list.length,
        value: list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0),
      };
    });

  const section = (title: string, count: number, inner: string) =>
    count === 0 ? "" : `<h2>${esc(title)} — ${count}</h2>${inner}`;

  return layout({
    title: "Обране",
    nav: "starred",
    body: `
<h1>Обране</h1>
<p class="sub">Усе, що ви позначили зірочкою: закупівлі, замовники, постачальники, посадовці. Список зберігається у вашому браузері й не прив'язаний до облікового запису.</p>

<form class="filters" method="get" action="/lookup">
  <div class="filter-row">
    <input type="search" name="edrpou" placeholder="Знайти підприємство за ЄДРПОУ — наприклад, 00131954" aria-label="ЄДРПОУ" inputmode="numeric">
    <button type="submit">Знайти</button>
  </div>
</form>

${
  saved.length === 0
    ? `<div class="empty">Поки нічого не позначено. Натисніть ☆ біля будь-якої закупівлі, компанії чи посадовця.</div>`
    : ""
}

${section(
  "Закупівлі",
  tenders.length,
  `${sortBar("/starred", c)}${filterPanel("/starred", c)}${listBody(filteredTenders, c, "/starred")}${
    missingTenders > 0
      ? `<p class="note">${missingTenders} ${plural(missingTenders, "позначена закупівля більше не знайдена", "позначені закупівлі більше не знайдені", "позначених закупівель більше не знайдено")} в базі.</p>`
      : ""
  }`,
)}

${section(
  "Компанії",
  companyRows.length,
  `<div class="rows">${companyRows
    .map(
      (r) => `<div class="row">
  <div class="who">
    <div class="name">${star(r.fav.kind, r.fav.id, "/starred")}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">ЄДРПОУ ${esc(r.fav.id)} · ${esc(r.role)} · ${r.count} ${plural(r.count, "закупівля", "закупівлі", "закупівель")}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`,
    )
    .join("")}</div>`,
)}

${section(
  "Посадовці",
  officerRows.length,
  `<div class="rows">${officerRows
    .map(
      (r) => `<div class="row">
  <div class="who">
    <div class="name">${star("officer", r.fav.id, "/starred")}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">${esc(r.entity)} · ${r.count} ${plural(r.count, "закупівля", "закупівлі", "закупівель")}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`,
    )
    .join("")}</div>`,
)}
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

/** Re-reads the store. The local server calls this when the data files change. */
export async function reload(): Promise<number> {
  db = await loadDataset();
  return db.cases.length;
}

export type Rendered = { status: number; body: string; contentType?: string; filename?: string };

/**
 * Resolves one URL to a page. Pure with respect to I/O, so the same code
 * serves the local Node server and a serverless function.
 */
export function render(url: URL, saved: Favourite[] = []): Rendered {
  // caseRow is called from a dozen places; threading the list through every
  // one of them would add a parameter to each. Set it once per request.
  starred = saved;

  const path = decodeURIComponent(url.pathname);

  // A EDRPOU typed into the lookup box: send it to whichever dossier exists.
  if (path === "/lookup") {
    const code = normaliseEdrpou(url.searchParams.get("edrpou") ?? "");
    if (!code) return { status: 200, body: lookupPage(null, url.searchParams.get("edrpou") ?? "") };
    return { status: 200, body: lookupPage(code, code) };
  }
  if (path === "/starred") return { status: 200, body: starredPage(saved, url) };

  if (path === "/") return { status: 200, body: feedPage(url) };
  if (path === "/entities") return { status: 200, body: entitiesPage(url) };
  if (path === "/officers") return { status: 200, body: officersPage(url) };
  if (path === "/suppliers") return { status: 200, body: suppliersPage(url) };
  if (path === "/railway") return { status: 200, body: railwayPage(url) };
  if (path === "/updates") return { status: 200, body: updatesPage(url) };
  if (path === "/prices") return { status: 200, body: pricesPage(url) };
  if (path === "/indicators") return { status: 200, body: indicatorsPage() };
  if (path === "/about") return { status: 200, body: aboutPage() };
  if (path.startsWith("/article/")) return { status: 200, body: articlePage(path.slice("/article/".length), url) };
  if (path.startsWith("/tender/")) {
    const rest = path.slice("/tender/".length);
    if (rest.endsWith("/report") || rest.endsWith("/report.txt")) {
      const asText = rest.endsWith(".txt");
      const id = rest.slice(0, rest.lastIndexOf("/report"));
      const entry = db.byTender.get(id);
      if (!entry) return { status: 404, body: notFound() };
      const sameEntity = db.cases.filter((x) => x.entity_edrpou && x.entity_edrpou === entry.entity_edrpou);
      const sameOfficer = entry.officer_key ? db.cases.filter((x) => x.officer_key === entry.officer_key) : [];
      const sameWinner = entry.winner_edrpou ? db.cases.filter((x) => x.winner_edrpou === entry.winner_edrpou) : [];
      const ctx: ReportContext = {
        entry,
        rules: db.ruleById,
        sameEntity: sameEntity.length,
        sameOfficer: sameOfficer.length,
        sameWinner: sameWinner.length,
        conclusion: buildConclusion({ entry, sameEntity, sameOfficer, sameWinner }),
        generatedAt: new Date().toISOString(),
      };
      return asText
        ? {
            status: 200,
            body: reportText(ctx),
            contentType: "text/plain; charset=utf-8",
            filename: `${entry.tender_ref || entry.tender_id}.txt`,
          }
        : { status: 200, body: reportHtml(ctx) };
    }
    return { status: 200, body: tenderPage(rest) };
  }
  if (path.startsWith("/entity/")) return { status: 200, body: entityPage(path.slice("/entity/".length), url) };
  if (path.startsWith("/officer/")) return { status: 200, body: officerPage(path.slice("/officer/".length), url) };
  if (path.startsWith("/supplier/")) return { status: 200, body: supplierPage(path.slice("/supplier/".length), url) };

  return { status: 404, body: notFound() };
}
