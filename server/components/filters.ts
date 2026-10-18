import { readableName } from "../../src/labels.ts";
import { esc, shortMoney, plural } from "../html.ts";
import { type Case } from "../data.ts";
import { DIMENSIONS, buildGroups, type Dimension, type Group } from "../grouping.ts";
import {
  activeCount, isFiltered, keepControls, hiddenControls,
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
    { label: "Висновок ДАСУ", hint: "Держаудитслужба встановила порушення", query: "audit=violation" },
    { label: "Цінові сигнали", hint: "розбіжності цін, які потребують перевірки", query: "price=1" },
    { label: "Без конкурентів", hint: "подався один учасник", query: "solo=1" },
    { label: "Від 100 млн", hint: "найбільші суми", query: "min=100000000" },
    // "Кілька ознак" and "Найновіші" used to live here too, but they are sorts,
    // not filters — the sort bar already offers "більше ознак" and "новіші
    // закупівлі". Kept out of the presets so the row stays short and the chips
    // are all genuine filters.
  ];
  return action === "/prices" ? base.filter((p) => p.query !== "price=1") : base;
}

/**
 * Marks the preset that matches the current query, so the state is visible.
 *
 * A preset only owns the four controls the presets are made of; the search
 * text, region, sort and the rest carry over, so switching preset does not
 * throw away what the reader typed. A chip is "on" only when the whole query
 * equals what that chip would produce — with an extra filter set, no chip is
 * on, which is the truth.
 */
export function presetBar(action: string, url: URL, c: Controls): string {
  const cleared: Controls = { ...c, audit: "", priceOnly: false, soloOnly: false, min: 0, page: 1 };
  const current = keepControls(action, { ...c, page: 1 });

  return `<div class="presets">
  ${presetsFor(action)
    .map((p) => {
      const href = keepControls(action, cleared, Object.fromEntries(new URLSearchParams(p.query)));
      const active = href === current;
      return `<a class="preset${active ? " on" : ""}" href="${esc(href)}" title="${esc(p.hint)}"${active ? ' aria-current="true"' : ""}>${esc(p.label)}</a>`;
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
  <input type="search" name="q" value="${esc(c.q)}" placeholder="Назва або ЄДРПОУ" aria-label="Пошук">
  ${extra}
  ${hidden("risk", c.risk)}${hidden("region", c.region)}
  ${hidden("from", c.dateFrom)}${hidden("to", c.dateTo)}
  ${hidden("min", c.min > 0 ? String(c.min) : "")}${hidden("max", c.max > 0 ? String(c.max) : "")}
  ${c.railOnly ? '<input type="hidden" name="rail" value="1">' : ""}
  ${c.soloOnly ? '<input type="hidden" name="solo" value="1">' : ""}
  ${c.priceOnly ? '<input type="hidden" name="price" value="1">' : ""}
  ${c.audit ? `<input type="hidden" name="audit" value="${esc(c.audit)}">` : ""}

  <details class="sort-options">
  <summary>Сортування та групування</summary><div class="sort-options-fields">
  <label>Сортування
    <select name="sort">
      <option value="value"${c.sort === "value" ? " selected" : ""}>за сумою, спадання</option>
      <option value="value-asc"${c.sort === "value-asc" ? " selected" : ""}>за сумою, зростання</option>
      <option value="date"${c.sort === "date" ? " selected" : ""}>новіші закупівлі</option>
      <option value="date-asc"${c.sort === "date-asc" ? " selected" : ""}>старіші закупівлі</option>
      <option value="assessed"${c.sort === "assessed" ? " selected" : ""}>нещодавно позначені</option>
      <option value="risks"${c.sort === "risks" ? " selected" : ""}>більше ознак</option>
    </select>
  </label>

  <label>Групування
    <select name="group">${dimensionOptions(c.group)}</select>
  </label>

  ${
    c.group
      ? `<label>потім
    <select name="then">${dimensionOptions(c.then, c.group)}</select>
  </label>`
      : ""
  }

  </div><button type="submit" class="sort-apply">Застосувати</button></details>
  <button type="submit" class="go">Знайти закупівлі <span aria-hidden="true">→</span></button>
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
 * The date span, the region list and the amount range of the whole dataset.
 * Computed once per dataset load, not per request: every list page used to
 * sort 36k dates and spread 36k amounts into Math.min on each render.
 */
let bounds: { of: unknown; earliest: string; latest: string; regions: string[]; rangeHint: string } | null = null;
function datasetBounds() {
  const ds = dataset();
  if (bounds && bounds.of === ds) return bounds;
  let earliest = "";
  let latest = "";
  let lo = Infinity;
  let hi = 0;
  const regionSet = new Set<string>();
  for (const x of ds.cases) {
    const d = x.tender_date ?? "";
    if (d) {
      if (!earliest || d < earliest) earliest = d;
      if (d > latest) latest = d;
    }
    if (x.region) regionSet.add(x.region);
    const n = x.value_amount ?? 0;
    if (n > 0) {
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    }
  }
  bounds = {
    of: ds,
    earliest,
    latest,
    regions: [...regionSet].sort(),
    rangeHint: hi > 0 ? `у базі від ${shortMoney(lo)} до ${shortMoney(hi)}` : "",
  };
  return bounds;
}

/**
 * The filter panel. Identical on every page that shows tenders; `action` is
 * where it submits, so each tab filters its own scope.
 */
export function filterPanel(action: string, c: Controls, opts: ControlOptions = {}, extra = ""): string {
 const {earliest,latest,regions}=datasetBounds();
 const selected=(v:string,current:string)=>v===current?' selected':'';
 const active=activeCount(c);
 return `<form class="filters" method="get" action="${esc(action)}">
 <input type="hidden" name="q" value="${esc(c.q)}"><input type="hidden" name="sort" value="${esc(c.sort)}"><input type="hidden" name="group" value="${esc(c.group)}"><input type="hidden" name="then" value="${esc(c.then)}">${extra}
 <details class="filters-more"><summary>Уточнити пошук${active?` <span class="badge">${active}</span>`:''}</summary>
 <div class="filter-fieldsets">
 <fieldset><legend>Де шукати</legend><label>Область<select name="region"><option value="">Уся Україна</option>${regions.map(r=>`<option value="${esc(r)}"${selected(r,c.region)}>${esc(r)}</option>`).join('')}</select></label>
 ${opts.hideRail?'':`<label class="check"><input type="checkbox" name="rail" value="1"${c.railOnly?' checked':''}>Лише залізничні організації</label>`}</fieldset>
 <fieldset><legend>Що перевірити</legend><label>Ознака ризику<select name="risk"><option value="">Будь-яка ознака</option>${dataset().rules.map(r=>`<option value="${esc(r.risk_id)}"${selected(r.risk_id,c.risk)}>${esc(shortRisk(r.risk_id))}</option>`).join('')}</select></label>
 <label>Висновок Держаудитслужби<select name="audit"><option value="">Будь-який або відсутній</option><option value="violation"${selected('violation',c.audit)}>ДАСУ встановила порушення</option><option value="clear"${selected('clear',c.audit)}>ДАСУ не встановила порушень</option></select></label>
 <label class="check"><input type="checkbox" name="solo" value="1"${c.soloOnly?' checked':''}>Один учасник</label>${opts.hidePrice?'':`<label class="check"><input type="checkbox" name="price" value="1"${c.priceOnly?' checked':''}>Є ціновий сигнал</label>`}</fieldset>
 <fieldset><legend>Коли опубліковано закупівлю</legend><label>Від дати<input type="date" name="from" value="${esc(c.dateFrom)}" min="${esc(earliest)}" max="${esc(latest)}"></label><label>До дати<input type="date" name="to" value="${esc(c.dateTo)}" min="${esc(earliest)}" max="${esc(latest)}"></label></fieldset>
 <fieldset><legend>Сума закупівлі, грн</legend><label>Мінімальна сума<input type="number" name="min" min="0" step="any" inputmode="decimal" value="${c.min||''}" placeholder="Без обмеження"></label><label>Максимальна сума<input type="number" name="max" min="0" step="any" inputmode="decimal" value="${c.max||''}" placeholder="Без обмеження"></label></fieldset>
 </div><div class="filter-actions"><button type="submit">Застосувати фільтри</button><a href="${esc(action)}">Скинути всі фільтри</a></div>
 </details></form>`;
}

/** Each selected condition can be removed without clearing other choices. */
function appliedFilters(action:string,c:Controls):string {
 const chips:[string,Record<string,string>][]=[];
 if(c.q)chips.push([`Пошук: ${c.q}`,{q:''}]);
 if(c.region)chips.push([c.region,{region:''}]);
 if(c.railOnly)chips.push(['Залізниця',{rail:''}]);
 if(c.risk)chips.push([shortRisk(c.risk),{risk:''}]);
 if(c.audit)chips.push([c.audit==='violation'?'Висновок ДАСУ: порушення':'Висновок ДАСУ: без порушень',{audit:''}]);
 if(c.priceOnly)chips.push(['Ціновий сигнал',{price:''}]);
 if(c.soloOnly)chips.push(['Один учасник',{solo:''}]);
 if(c.dateFrom||c.dateTo)chips.push([`${c.dateFrom||'Початок'} — ${c.dateTo||'сьогодні'}`,{from:'',to:''}]);
 if(c.min||c.max)chips.push([`Сума: ${c.min||0} — ${c.max||'без межі'} грн`,{min:'',max:''}]);
 return chips.length?`<div class="applied-filters" aria-label="Застосовані фільтри"><span>Ви обрали:</span>${chips.map(([label,over])=>`<a href="${esc(keepControls(action,c,{...over,page:'1'}))}" aria-label="${esc('Прибрати фільтр: '+label)}">${esc(label)} <span aria-hidden="true"> ×</span></a>`).join('')}</div>`:'';
}

/** Search, sorting, presets and expandable filters share one panel. */
export function controlBar(
  action: string,
  c: Controls,
  opts: ControlOptions = {},
  params: { url?: URL; extra?: string } = {},
): string {
  const active = activeCount(c);
  const presets = params.url ? presetBar(action, params.url, c) : "";
  const extra = params.extra ?? "";

  return `<div class="control-panel">
  ${sortBar(action, c, extra)}
  ${presets}
  ${appliedFilters(action,c)}
  ${filterPanel(action, c, opts, extra)}
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
  /** Page-specific parameters the pager must carry too (the article page's `at`). */
  extra: Record<string, string> = {},
): string {
  const link = (over: Record<string, string>) => keepControls(action, c, { ...extra, ...over });
  const extraHidden = Object.entries(extra)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  if (list.length === 0) {
    // A dead end with a way out: one link that clears everything, and, when
    // the search text is the likely culprit, one that drops only it.
    const dropSearch = c.q
      ? ` <a href="${esc(keepControls(action, c, { q: "" }))}">Прибрати пошук «${esc(c.q)}»</a> ·`
      : "";
    return `<div class="empty">За цими умовами нічого не знайшлося.<br>${dropSearch} <a href="${esc(action)}">Скинути всі фільтри</a></div>`;
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
  ${page > 1 ? `<a href="${link({})}" title="Перша сторінка" aria-label="Перша сторінка">«</a><a href="${link({ page: String(page - 1) })}">← попередні</a>` : ""}
  <form class="jump" method="get" action="${esc(action)}">${hiddenControls(c, esc)}${extraHidden}<label>сторінка <input type="number" name="page" value="${page}" min="1" max="${pages}" aria-label="Номер сторінки"> з ${pages.toLocaleString("uk-UA")}</label><button type="submit">Перейти</button></form>
  ${page < pages ? `<a href="${link({ page: String(page + 1) })}">наступні →</a><a href="${link({ page: String(pages) })}" title="Остання сторінка" aria-label="Остання сторінка">»</a>` : ""}
</div>`
    : ""
}`;
}
