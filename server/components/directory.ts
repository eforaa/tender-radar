import { layout, esc, shortMoney } from "../html.ts";
import { type FavKind } from "../favourites.ts";
import { star } from "./case-row.ts";

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

export type DirControls = { q: string; sort: DirSort };

export function readDirControls(url: URL): DirControls {
  const sort = url.searchParams.get("sort") ?? "";
  return {
    q: (url.searchParams.get("q") ?? "").trim().slice(0, 80),
    sort: DIR_SORTS.some((x) => x.value === sort) ? (sort as DirSort) : "value",
  };
}

export type DirRow = {
  href: string;
  name: string;
  meta: string;
  value: number;
  count: number;
  kind?: FavKind;
  id?: string;
};

export function applyDirControls(rows: DirRow[], c: DirControls): DirRow[] {
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

export function dirBar(action: string, c: DirControls): string {
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
export function directoryPage(opts: {
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
