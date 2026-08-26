import { readableName } from "../../src/labels.ts";
import { esc, shortMoney, plural } from "../html.ts";
import { type Case } from "../data.ts";
import { DIMENSIONS, buildGroups, type Dimension, type Group } from "../grouping.ts";
import {
  activeCount, isFiltered, keepControls,
  type Controls, type ControlOptions,
} from "../controls.ts";
import { dataset } from "../context.ts";
import { caseRow } from "./case-row.ts";
import { shortRisk } from "./risk.ts";

const PAGE_SIZE = 30;
/** Grouping the whole country by buyer produced 10608 blocks in one page. */
const MAX_GROUPS = 40;

/**
 * One-click starting points. A newcomer should not have to understand the
 * filter vocabulary before seeing anything useful, so the common questions
 * are pre-written as links.
 */
type Preset = { label: string; hint: string; query: string };

export function presetsFor(action: string): Preset[] {
  const base: Preset[] = [
    { label: "Усі", hint: "повний перелік", query: "" },
    { label: "Порушення доведено", hint: "Держаудитслужба встановила порушення", query: "audit=violation" },
    { label: "Завищена ціна", hint: "ми порахували переплату", query: "price=1" },
    { label: "Без конкурентів", hint: "подався один учасник", query: "solo=1" },
    { label: "Від 100 млн", hint: "найбільші суми", query: "min=100000000" },
    { label: "Кілька ознак", hint: "спрацювало 2 і більше", query: "sort=risks" },
    { label: "Найновіші", hint: "свіжі закупівлі", query: "sort=date" },
  ];
  return action === "/prices" ? base.filter((p) => p.query !== "price=1") : base;
}

/** Marks the preset that matches the current query, so the state is visible. */
export function presetBar(action: string, url: URL, c: Controls): string {
  const current = new URLSearchParams();
  if (c.audit) current.set("audit", c.audit);
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
export function sortBar(action: string, c: Controls, extra = ""): string {
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
  ${c.audit ? `<input type="hidden" name="audit" value="${esc(c.audit)}">` : ""}

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

/** Renders one group, and its nested groups, as a collapsible block. */
export function groupBlock(group: Group, depth: number): string {
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

/**
 * The filter panel. Identical on every page that shows tenders; `action` is
 * where it submits, so each tab filters its own scope.
 */
export function filterPanel(action: string, c: Controls, opts: ControlOptions = {}, extra = ""): string {
  const dimensionOptions = (selected: Dimension, skip?: Dimension) =>
    DIMENSIONS.filter((d) => d.value !== skip || d.value === "")
      .map((d) => `<option value="${d.value}"${d.value === selected ? " selected" : ""}>${esc(d.label)}</option>`)
      .join("");

  const stamps = dataset().cases.map((x) => x.tender_date ?? "").filter(Boolean).sort();
  const earliest = stamps[0] ?? "";
  const latest = stamps[stamps.length - 1] ?? "";
  const regions = [...new Set(dataset().cases.map((x) => x.region ?? "").filter(Boolean))].sort();
  const amounts = dataset().cases.map((x) => x.value_amount ?? 0).filter((n) => n > 0);
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
          ${dataset().rules
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
        <select name="audit" aria-label="Висновок Держаудитслужби">
          <option value="">Будь-який висновок ДАСУ</option>
          <option value="violation"${c.audit === "violation" ? " selected" : ""}>порушення доведено</option>
          <option value="clear"${c.audit === "clear" ? " selected" : ""}>перевірено, порушень немає</option>
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

/**
 * Presets, sort/group and the filter panel, wrapped as one unit.
 *
 * On a wide screen this renders in place, exactly as the three pieces did
 * before. Below 44rem the CSS turns the same markup into a checkbox-driven
 * sheet — the same mechanism as the nav drawer in html.ts, just scoped to
 * this component so the two do not fight over one checkbox. Reusing that
 * pattern here (instead of a second one) is what step 1 of the phone task
 * asked for: one interaction model for the whole site.
 */
export function controlBar(
  action: string,
  c: Controls,
  opts: ControlOptions = {},
  params: { url?: URL; extra?: string } = {},
): string {
  const active = activeCount(c);
  const presets = params.url ? presetBar(action, params.url, c) : "";
  const extra = params.extra ?? "";

  return `<div class="filter-sheet">
  <input type="checkbox" id="filters-toggle" class="sr-only" aria-label="Фільтри">
  <label class="filters-trigger" for="filters-toggle">Фільтри${active > 0 ? ` <span class="badge">${active}</span>` : ""}</label>
  <label class="scrim filters-scrim" for="filters-toggle" aria-hidden="true"></label>
  <div class="drawer filters-drawer" aria-label="Фільтри">
    <div class="drawer-head">
      <strong>Фільтри</strong>
      <label class="drawer-close" for="filters-toggle" role="button" aria-label="Закрити">&times;</label>
    </div>
    <div class="filters-drawer-body">
      ${presets}
      ${sortBar(action, c, extra)}
      ${filterPanel(action, c, opts, extra)}
    </div>
  </div>
</div>`;
}

/** The result count line, so a folded panel never hides what was applied. */
export function resultLine(list: Case[], c: Controls, groupCount: number): string {
  const value = list.reduce((sum, x) => sum + (x.value_amount ?? 0), 0);
  const base = isFiltered(c)
    ? `Знайдено <strong>${list.length.toLocaleString("uk-UA")}</strong> ${plural(list.length, "закупівлю", "закупівлі", "закупівель")} на ${shortMoney(value)}.`
    : `Показано <strong>${list.length.toLocaleString("uk-UA")}</strong> ${plural(list.length, "закупівлю", "закупівлі", "закупівель")} на ${shortMoney(value)}.`;
  return `<p class="hint">${base}${c.group ? ` Згруповано у <strong>${groupCount}</strong> ${plural(groupCount, "групу", "групи", "груп")}.` : ""}</p>`;
}

/** Rows, or collapsible groups, plus the pager. Shared by every list page. */
export function listBody(
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
