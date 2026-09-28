import { REGION, RAILWAY_EDRPOU } from "../../src/config.ts";
import { readableName } from "../../src/labels.ts";
import { layout, esc, shortMoney, plural } from "../html.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { star } from "../components/case-row.ts";
import { rankRisks, groupedRiskCards } from "../components/risk.ts";
import { controlBar, listBody } from "../components/filters.ts";
import { notFound } from "./static.ts";

export function supplierPage(edrpou: string, url: URL): string {
  const dossierAction = `/supplier/${encodeURIComponent(edrpou)}`;
  const list = dataset().cases.filter((c) => c.winner_edrpou === edrpou);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.winner_name)?.winner_name ?? edrpou;
  const value = list.reduce((sum, c) => sum + (c.winner_amount ?? c.value_amount ?? 0), 0);
  const ranked = rankRisks(list);
  const solo = list.filter((c) => c.bidders === 1).length;
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);

  // Who this company sells to: the pattern a reader is here for. One buyer
  // taking every contract is a different story from twenty.
  const buyers = new Map<string, { name: string; count: number; value: number }>();
  for (const entry of list) {
    if (!entry.entity_edrpou) continue;
    const acc = buyers.get(entry.entity_edrpou) ?? { name: entry.entity_name ?? entry.entity_edrpou, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    buyers.set(entry.entity_edrpou, acc);
  }
  const rankedBuyers = [...buyers.entries()].sort((a, b) => b[1].value - a[1].value);
  const SHOW_BUYERS = 8;
  const buyerRow = ([code, acc]: [string, { name: string; count: number; value: number }]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/entity/${encodeURIComponent(code)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")} · ЄДРПОУ ${esc(code)}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`;

  return layout({
    title: readableName(name),
    nav: "suppliers",
    description: `Постачальник · ЄДРПОУ ${edrpou} · ${list.length} ${plural(list.length, "перемога", "перемоги", "перемог")} у закупівлях із позначками на ${shortMoney(value)}`,
    body: `
<a class="back" href="/suppliers">← до переліку переможців</a>
<h1>${esc(readableName(name))}</h1>
<p class="sub">Постачальник · ЄДРПОУ ${esc(edrpou)}</p>
${star("supplier", edrpou, "/supplier/" + encodeURIComponent(edrpou), { label: true })}

<p class="statline">
  <b>${list.length}</b> перемог у закупівлях із позначками ·
  <b>${shortMoney(value)}</b> сума договорів ·
  <b>${solo}</b> де був єдиним учасником ·
  <b>${rankedBuyers.length}</b> різних замовників
</p>

${
  rankedBuyers.length
    ? `<h2>Кому продає</h2>
<div class="rows">${rankedBuyers.slice(0, SHOW_BUYERS).map(buyerRow).join("")}</div>
${
  rankedBuyers.length > SHOW_BUYERS
    ? `<details class="sub"><summary>Ще ${rankedBuyers.length - SHOW_BUYERS} ${plural(rankedBuyers.length - SHOW_BUYERS, "замовник", "замовники", "замовників")}</summary>
  <div class="inner"><div class="rows">${rankedBuyers.slice(SHOW_BUYERS).map(buyerRow).join("")}</div></div>
</details>`
    : ""
}`
    : ""
}

<h2>Закупівлі</h2>
${controlBar(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction)}

<h2>Що держава запідозрила в цих закупівлях</h2>
${groupedRiskCards(ranked)}

<p class="note">Переможець відомий лише там, де завантажено повну картку закупівлі — сьогодні це ${esc(REGION)} та філії залізниці, решта країни довантажується. Це не повна історія компанії по Україні.</p>
`,
  });
}
