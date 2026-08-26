import { REGION, RAILWAY_EDRPOU } from "../../src/config.ts";
import { readableName } from "../../src/labels.ts";
import { layout, esc, shortMoney } from "../html.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { star } from "../components/case-row.ts";
import { rankRisks, groupedRiskCards } from "../components/risk.ts";
import { sortBar, filterPanel, listBody } from "../components/filters.ts";
import { notFound } from "./static.ts";

export function supplierPage(edrpou: string, url: URL): string {
  const dossierAction = `/supplier/${encodeURIComponent(edrpou)}`;
  const list = dataset().cases.filter((c) => c.winner_edrpou === edrpou);
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
