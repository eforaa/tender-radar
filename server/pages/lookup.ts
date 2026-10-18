import { readableName } from "../../src/labels.ts";
import { layout, esc, plural } from "../html.ts";
import { type Case } from "../data.ts";
import { dataset } from "../context.ts";
import { caseRow, star } from "../components/case-row.ts";

/* ---------- saved companies and EDRPOU lookup ---------- */

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

  const cases = profile ? [...new Map([...profile.asBuyer, ...profile.asWinner].map(c => [c.tender_id, c])).values()].sort((a,b)=>(b.value_amount ?? 0)-(a.value_amount ?? 0)) : [];
  const invalid = Boolean(typed && !code);
  return layout({
    title: "Знайти компанію", nav: "lookup",
    body: `<section class="company-search">
<header class="company-search-heading"><span class="company-eyebrow">КОМПАНІЇ</span><h1>Знайти компанію</h1><p>Перевірте її закупівлі та перемоги за кодом ЄДРПОУ.</p></header>
<form class="company-search-form" method="get" action="/lookup">
<label for="company-code">Код ЄДРПОУ</label><div class="company-search-input"><input id="company-code" type="search" name="edrpou" value="${esc(typed)}" placeholder="Наприклад, 40081347" inputmode="numeric" autocomplete="off" aria-describedby="company-code-hint${invalid ? ' company-error' : ''}"${invalid ? ' aria-invalid="true"' : ''}><button type="submit">Знайти <span aria-hidden="true">→</span></button></div>
<p id="company-code-hint">Від 6 до 10 цифр. Пошук за назвою поки не підтримується.</p>
${invalid ? '<p class="company-error" id="company-error" role="alert">Перевірте код: потрібно від 6 до 10 цифр.</p>' : ''}
</form>
${!typed ? `<div class="company-search-guide"><h2>Що можна побачити</h2><div><p><strong>Як замовник</strong><span>Що компанія закуповує та які є сигнали ризику.</span></p><p><strong>Як постачальник</strong><span>У яких закупівлях вона перемогла.</span></p></div><a href="/lookup?edrpou=40081347">Переглянути приклад компанії →</a></div>` : ''}
${code && !found ? `<section class="company-empty" aria-live="polite"><h2>У поточних даних компанію не знайдено</h2><p>Код <strong>${esc(code)}</strong>. Наша база охоплює лише частину закупівель. Відсутність запису не підтверджує відсутність порушень.</p><a href="https://prozorro.gov.ua/search/tenders?edrpou=${encodeURIComponent(code)}" target="_blank" rel="noopener">Перевірити в Prozorro ↗</a></section>` : ''}
</section>
${found && profile ? `<section class="company-results" aria-label="Результат пошуку"><header class="company-profile"><div><p class="company-eyebrow">ЄДРПОУ ${esc(code)}</p><h2>${esc(readableName(profile.name))}</h2></div>${star(profile.asBuyer.length ? 'entity' : 'supplier',code as string,'/lookup?edrpou='+encodeURIComponent(code as string),{label:true})}</header>
<div class="company-roles">${profile.asBuyer.length ? `<a href="/entity/${encodeURIComponent(code as string)}"><span>Замовник</span><strong>${profile.asBuyer.length} ${plural(profile.asBuyer.length,'закупівля','закупівлі','закупівель')}</strong><span>Відкрити досьє →</span></a>` : ''}${profile.asWinner.length ? `<a href="/supplier/${encodeURIComponent(code as string)}"><span>Постачальник</span><strong>${profile.asWinner.length} ${plural(profile.asWinner.length,'перемога','перемоги','перемог')}</strong><span>Відкрити досьє →</span></a>` : ''}</div>
<div class="company-list-heading"><h2>Закупівлі компанії</h2><span>${cases.length > 6 ? '6 найбільших за сумою · повний список у досьє' : cases.length + ' у поточних даних'}</span></div><div class="rows">${cases.slice(0,6).map(c=>caseRow(c)).join('')}</div></section>` : ''}`,
  });
}
