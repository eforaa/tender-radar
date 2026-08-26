import { RAILWAY_EDRPOU } from "../../src/config.ts";
import { readableName } from "../../src/labels.ts";
import { layout, esc, shortMoney, plural } from "../html.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { star } from "../components/case-row.ts";
import { rankRisks, groupedRiskCards } from "../components/risk.ts";
import { sortBar, filterPanel, listBody } from "../components/filters.ts";
import { notFound } from "./static.ts";

export function entityPage(edrpou: string, url: URL): string {
  const dossierAction = `/entity/${encodeURIComponent(edrpou)}`;
  const list = dataset().cases.filter((c) => c.entity_edrpou === edrpou);
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
