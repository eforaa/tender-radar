import { REGION, RAILWAY_EDRPOU } from "../../src/config.ts";
import { RISK_LABELS } from "../../src/labels.ts";
import { layout, esc, plural, shortMoney } from "../html.ts";
import { ARTICLES, isJointStock } from "../../src/legal.ts";
import { type Case } from "../data.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { sortBar, filterPanel, listBody } from "../components/filters.ts";
import { notFound } from "./static.ts";

/* ---------- criminal-code screening ---------- */

export function articlePage(code: string, url: URL): string {
  const article = ARTICLES[code];
  if (!article) return notFound();

  const relevant = new Set(article.links.map((l) => l.risk_id));
  const jointOnly = url.searchParams.get("at") === "1";
  const articleAction = `/article/${article.code}`;
  const jointHidden = jointOnly ? '<input type="hidden" name="at" value="1">' : "";
  const ctrl = readControls(url);

  let list = dataset().cases.filter(
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
