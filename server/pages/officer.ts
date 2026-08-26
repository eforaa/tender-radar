import { RAILWAY_EDRPOU } from "../../src/config.ts";
import { readableName } from "../../src/labels.ts";
import { layout, esc, shortMoney } from "../html.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { star } from "../components/case-row.ts";
import { rankRisks, groupedRiskCards } from "../components/risk.ts";
import { controlBar, listBody } from "../components/filters.ts";
import { notFound } from "./static.ts";

export function officerPage(key: string, url: URL): string {
  const dossierAction = `/officer/${encodeURIComponent(key)}`;
  const list = dataset().cases.filter((c) => c.officer_key === key);
  if (list.length === 0) return notFound();

  const name = list.find((c) => c.officer_name)?.officer_name ?? key;
  const email = list.find((c) => c.officer_email)?.officer_email ?? null;
  const phone = list.find((c) => c.officer_phone)?.officer_phone ?? null;
  const entity = list.find((c) => c.entity_name)?.entity_name ?? null;
  const entityEdrpou = list.find((c) => c.entity_edrpou)?.entity_edrpou ?? "";
  const value = list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const ranked = rankRisks(list);
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);

  return layout({
    title: name,
    nav: "officers",
    body: `
<a class="back" href="/officers">← до переліку посадовців</a>
${star("officer", key, "/officer/" + encodeURIComponent(key), { label: true })}
<h1>${esc(name)}</h1>
<p class="sub">Відповідальна особа в закупівлях${entity ? ` — ${esc(readableName(entity))}` : ""}.</p>

<p class="statline">
  <b>${list.length}</b> закупівель під питанням ·
  <b>${shortMoney(value)}</b> загальна сума ·
  <b>${solo}</b> з єдиним учасником ·
  <b>${ranked.length}</b> різних ознак
</p>

<div class="card">
  <dl class="facts">
    <dt>Пошта</dt><dd>${esc(email ?? "—")}</dd>
    <dt>Телефон</dt><dd>${esc(phone ?? "—")}</dd>
    <dt>Установа</dt><dd><a href="/entity/${encodeURIComponent(entityEdrpou)}">${esc(readableName(entity))}</a></dd>
  </dl>
  <p class="faint" style="margin-top:.9rem">Дані взято з карток закупівель у Prozorro, де замовник сам публікує контактну особу. Одну людину між закупівлями зіставлено за поштою — вона стабільніша за написання імені.</p>
</div>

<h2>Що держава запідозрила в її закупівлях</h2>
<p class="hint">Перелік ознак, що спрацювали. <strong>Не судимість і не встановлена вина.</strong></p>
${groupedRiskCards(ranked)}

<h2>Закупівлі</h2>
${controlBar(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction, { showOfficer: false })}

<p class="note">Ця сторінка не є твердженням про правопорушення з боку названої особи. Вона показує, що державна система моніторингу позначила закупівлі, у яких цю особу вказано відповідальною контактною особою.</p>
`,
  });
}
