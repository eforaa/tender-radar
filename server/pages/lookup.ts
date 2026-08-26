import { readableName } from "../../src/labels.ts";
import { layout, esc, plural } from "../html.ts";
import { type Case } from "../data.ts";
import { dataset } from "../context.ts";
import { caseRow, star } from "../components/case-row.ts";

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
  const asBuyer = dataset().cases.filter((c) => c.entity_edrpou === edrpou);
  const asWinner = dataset().cases.filter((c) => c.winner_edrpou === edrpou);
  const name =
    asBuyer.find((c) => c.entity_name)?.entity_name ?? asWinner.find((c) => c.winner_name)?.winner_name ?? null;
  return { asBuyer, asWinner, name };
}

export function lookupPage(code: string | null, typed: string): string {
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
