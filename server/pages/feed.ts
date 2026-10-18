import { REGION, RAILWAY_EDRPOU } from "../../src/config.ts";
import { layout, esc, shortMoney, shortDate } from "../html.ts";
import { readControls, applyControls, keepControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { riskCard } from "../components/risk.ts";
import { controlBar, listBody } from "../components/filters.ts";

export function feedPage(url: URL): string {
  const c = readControls(url);
  const ds = dataset();
  const list = applyControls(ds.cases, c, RAILWAY_EDRPOU);
  const latest = [...ds.runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  const scope = c.railOnly ? "Залізниця" : c.region || "Уся Україна";
  const scopes = [
    { label: "Харківщина", region: REGION, rail: "", active: c.region === REGION && !c.railOnly },
    { label: "Укрзалізниця", region: "", rail: "1", active: c.railOnly && !c.region },
    { label: "Уся Україна", region: "", rail: "", active: !c.region && !c.railOnly },
  ];
  const full = list.filter((x) => x.detailed).length;
  const signals = list.reduce((n, x) => n + x.findings.length, 0);
  return layout({ title: "Закупівлі", nav: "feed", body: `
<section class="studio-hero">
 <div class="studio-copy"><span class="studio-eyebrow">ВИДНО / МОНІТОРИНГ ЗАКУПІВЕЛЬ</span><h1>Публічні кошти.<br><span>Прозорі рішення.</span></h1><p>Знайдіть закупівлю, перевірте сигнали ризику та відкрийте першоджерело.</p><a class="studio-help" href="/about">Як працює радар <span aria-hidden="true">↗</span></a></div>
 <div class="studio-visual" aria-label="Дані поточної вибірки"><div class="studio-orbit" aria-hidden="true"></div><div class="studio-stat"><span>ЗАКУПІВЛІ В ПОТОЧНІЙ ВИБІРЦІ</span><strong>${list.length.toLocaleString("uk-UA")}</strong><small>Відкриті дані для вашої перевірки</small><div class="studio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="studio-signal"><span class="studio-dot" aria-hidden="true"></span><div><strong>${signals.toLocaleString("uk-UA")} цінових сигналів</strong><small>Сигнал — привід перевірити, а не звинувачення</small></div></div></div>
</section>
<section class="studio-workspace" aria-label="Пошук закупівель">
<div class="results-heading"><h2 id="results-heading">Знайдіть закупівлю</h2><span>Від пошуку до першоджерела</span></div>
<nav class="scope-nav" aria-label="Територія моніторингу">${scopes.map((s) => `<a href="${esc(keepControls("/", c, { region: s.region, rail: s.rail, page: "1" }))}"${s.active ? ' aria-current="page"' : ""}>${s.label}</a>`).join("")}</nav>
<div class="scope-caption"><span>${esc(scope)} · поточна вибірка</span><a href="/updates">${latest ? `Останній запуск: ${shortDate(latest.started_at)}${latest.status !== "ok" || latest.errors ? " · є помилки" : ""}` : "Історія оновлень"}</a></div>

<section class="radar-results" aria-labelledby="results-heading">

${controlBar("/", c, {}, { url })}
<details class="data-overview"><summary>Огляд даних: суми, сигнали та повнота карток</summary><section class="radar-metrics" aria-label="Показники поточної вибірки">
 <div><span>Закупівлі з ознаками ризику</span><strong>${list.length.toLocaleString("uk-UA")}</strong><small>Не всі закупівлі регіону</small></div>
 <div><span>Загальна сума закупівель</span><strong>${shortMoney(list.reduce((n, x) => n + (x.value_amount ?? 0), 0))}</strong><small>Обсяг закупівель, не збитки</small></div>
 <div><span>Цінові сигнали</span><strong>${signals.toLocaleString("uk-UA")}</strong><small>Потребують перевірки аналогів</small></div>
 <div><span>З деталями у списку</span><strong>${full.toLocaleString("uk-UA")} <em>/ ${list.length.toLocaleString("uk-UA")}</em></strong><small>${full === list.length ? "Деталі є для всієї вибірки" : "Решта можуть мати неповні дані"}</small></div>
</section></details>
${c.risk ? riskCard(c.risk) : ""}
${listBody(list, c, "/")}
</section></section>` });
}
