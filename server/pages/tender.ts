import { buildConclusion } from "../conclusion.ts";
import { procedureLabel, readableName } from "../../src/labels.ts";
import { layout, esc, money, unitMoney, shortMoney, date, plural, trim } from "../html.ts";
import { dataset } from "../context.ts";
import { star, alarms, auditSection } from "../components/case-row.ts";
import { shortRisk } from "../components/risk.ts";
import { qualificationBlock } from "../components/verdict.ts";
import { notFound } from "./static.ts";
import { loadDbConfig } from "../../src/store/db.ts";
import { getCard } from "../../src/store/cards.ts";
import { mergeCardDetail } from "../data.ts";

export async function tenderPage(tenderId: string, url?: URL): Promise<string> {
  const base = dataset().byTender.get(tenderId);
  if (!base) return notFound();

  // Where the reader came from, so "back" returns to the filtered page, the
  // dossier or the section they were reading — not always to the bare feed.
  // Same-site paths only: an absolute URL here would be an open redirect.
  const from = url?.searchParams.get("from") ?? "";
  const back = /^\/(?!\/)[^\s]*$/.test(from) ? from : "/";

  // Every flagged tender has an entry, but most lack detail (officer, bidders,
  // winner) — those cards were never fetched into the committed dataset. Pull
  // the card live from the database and merge it in. A miss or an outage
  // leaves the entry as-is, which renders the existing "not loaded" state.
  let entry = base;
  if (!entry.detailed) {
    const config = loadDbConfig();
    if (config) {
      try {
        const card = await getCard(config, tenderId);
        if (card) entry = mergeCardDetail(base, card);
      } catch (err) {
        console.error(`card fetch failed for ${tenderId} — ${(err as Error).message}`);
      }
    }
  }

  const sameEntity = dataset().cases.filter((c) => c.entity_edrpou && c.entity_edrpou === entry.entity_edrpou);
  const sameOfficer = entry.officer_key ? dataset().cases.filter((c) => c.officer_key === entry.officer_key) : [];
  const sameWinner = entry.winner_edrpou ? dataset().cases.filter((c) => c.winner_edrpou === entry.winner_edrpou) : [];
  // "In N other tenders": the lists include this one, so the count is minus it.
  const others = (list: typeof sameOfficer) => list.filter((c) => c.tender_id !== entry.tender_id);
  const otherOfficer = others(sameOfficer);
  const otherWinner = others(sameWinner);
  const officerValue = otherOfficer.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const winnerValue = otherWinner.reduce((sum, c) => sum + (c.winner_amount ?? c.value_amount ?? 0), 0);

  const title = entry.title || readableName(entry.entity_name) || "Закупівля";
  const signals = alarms(entry);
  const prozorro = `https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}`;
  const buyer = readableName(entry.entity_name);
  const conclusion = buildConclusion({ entry, sameEntity, sameOfficer, sameWinner });

  return layout({
    // The tab and any link preview name the thing, not just its number.
    title: `${trim(title, 60)} · ${shortMoney(entry.value_amount)}`,
    description: `${buyer ? `${buyer} · ` : ""}${money(entry.value_amount)} · ${
      signals[0] ?? (entry.risks.length ? `${entry.risks.length} ${plural(entry.risks.length, "ознака", "ознаки", "ознак")} ризику` : "закупівля з позначками")
    } · ${entry.tender_ref || entry.tender_id}`,
    body: `
<article class="tender-detail">
<div class="detail-toolbar"><a class="back" href="${esc(back)}">← До переліку</a>${star("tender", entry.tender_id, url ? url.pathname + url.search : "/tender/" + encodeURIComponent(entry.tender_id), { label: true })}</div>
<header class="detail-heading"><p class="detail-ref">${esc(entry.tender_ref || entry.tender_id)}</p><h1>${esc(title)}</h1><p class="detail-buyer">${esc(buyer)}</p></header>
<section class="detail-overview" id="facts" aria-label="Основні дані"><div><span>Сума закупівлі</span><strong>${shortMoney(entry.value_amount)}</strong></div><div><span>Учасників</span><strong>${entry.detailed ? entry.bidders ?? 'Немає даних' : 'Немає даних'}</strong></div><div><span>Дата закупівлі</span><strong>${date(entry.tender_date)}</strong></div></section>
<div class="detail-source"><a href="${prozorro}" target="_blank" rel="noopener">Відкрити в Prozorro <span aria-hidden="true">↗</span></a><span>Документи та першоджерело</span></div>
<div class="detail-columns"><section class="detail-signals" id="signals"><h2>Що потребує уваги <span>${entry.risks.length + entry.findings.length}</span></h2><p class="detail-caution">Сигнал не доводить порушення.</p>
${entry.bidders === 1 ? '<p class="detail-competition">Один учасник — немає іншої пропозиції для порівняння.</p>' : ''}
${entry.risks.map(r => `<details class="detail-fold signal-fold"><summary><span><small>Державний індикатор</small><strong>${esc(shortRisk(r))}</strong></span></summary><div class="detail-fold-body"><p>${esc(dataset().ruleById.get(r)?.name ?? r)}</p><p class="detail-caution">Це автоматична ознака. Перевірте договір та зміни до нього в першоджерелі.</p><a href="${prozorro}" target="_blank" rel="noopener">Перевірити документи ↗</a><p class="detail-ref">Індикатор ${esc(r)} · <a href="/?risk=${encodeURIComponent(r)}">Інші закупівлі з цією ознакою</a></p></div></details>`).join('')}
${entry.findings.length ? `<details class="detail-fold"><summary><span><small>Розрахунок системи</small><strong>Порівняння цін · ${entry.findings.length}</strong></span></summary><div class="detail-fold-body">${
  entry.findings.length
    ? `<h2>Скільки це коштує в інших</h2>
<p class="hint">Рахувала система, не держава. Нижче — числа.</p>
${entry.findings
  .map((f) => {
    const e = f.evidence as Record<string, number | string | null>;
    const rows = Object.entries({
      "Ціна за одиницю": typeof e.unit_price === "number" ? `${unitMoney(e.unit_price)}` : null,
      "Типова ціна (медіана)": typeof e.peer_median === "number" ? `${unitMoney(e.peer_median)}` : null,
      "Середня половина цін": typeof e.peer_p25 === "number" && typeof e.peer_p75 === "number" ? `${unitMoney(e.peer_p25)} — ${unitMoney(e.peer_p75)}` : null,
      "Порівняно із закупівлями": typeof e.peer_count === "number" ? String(e.peer_count) : null,
      "Попередня ціна цього замовника": typeof e.previous_price === "number" ? `${unitMoney(e.previous_price)}` : null,
      "Зростання": typeof e.growth === "number" ? `${Math.round(e.growth * 100)}%` : null,
      "Кількість": typeof e.quantity === "number" ? `${e.quantity.toLocaleString("uk-UA")} ${esc(String(e.unit_code ?? ""))}` : null,
      "Різниця на всю закупівлю": typeof e.overpayment === "number" ? money(e.overpayment) : typeof e.extra_cost === "number" ? money(e.extra_cost) : null,
      "Розрахунок від": e.basis === "award" ? "суми договору" : e.basis === "expected" ? "очікуваної вартості" : null,
    }).filter(([, v]) => v !== null);
    return `<div class="card">
  <h3><span class="tier own">Порахували ми</span> &nbsp;${esc(f.title)}</h3>
  <p class="lead">${esc(f.explanation)}</p>
  ${typeof e.source_url === "string" && e.source_url.startsWith("https://market-api.prozorro.gov.ua/api/prices/") ? `<p><a href="${esc(e.source_url)}" target="_blank" rel="noopener noreferrer">Перевірити джерело ціни ↗</a></p>` : ""}
  <dl class="facts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>
</div>`;
  })
  .join("")}`
    : ""
}

</div></details>` : ''}
${!entry.risks.length && !entry.findings.length ? '<p>Додаткових сигналів у поточних даних немає.</p>' : ''}
${entry.audit ? `<details class="detail-fold"><summary><span><small>Держаудитслужба</small><strong>${entry.audit.violation ? 'Встановлено порушення' : 'Порушень не встановлено'}</strong></span></summary><div class="detail-fold-body">${auditSection(entry)}</div></details>` : ''}
</section><section class="detail-next" id="conclusion"><h2>Що перевірити далі</h2><ol>${conclusion.nextSteps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><details class="detail-fold"><summary>Чому система пропонує ці кроки</summary><div class="detail-fold-body">${conclusion.observations.map(o=>`<p><strong>${esc(o.title)}</strong><br>${esc(o.detail)}</p>`).join('')}<p class="detail-caution">Автоматичний аналіз не встановлює порушення.</p></div></details></section></div>
<section class="detail-reference" aria-label="Додаткові відомості">
<details class="detail-fold" id="participants"><summary><span><strong>Учасники та контакти</strong><small>${entry.winner_name ? 'Переможець: ' + esc(readableName(entry.winner_name)) : 'Замовник, переможець, контактна особа'}</small></span></summary><div class="detail-fold-body"><h3>Контактна особа замовника</h3>${
  entry.officer_name
    ? `<div class="card">
  <h3><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a></h3>
  <p class="lead">${
    otherOfficer.length
      ? `Цей контакт зазначено ще у <strong>${otherOfficer.length}</strong> ${plural(otherOfficer.length, "закупівлі", "закупівлях", "закупівлях")} із позначками, разом на <strong>${shortMoney(officerValue)}</strong>.`
      : "Інших закупівель із позначками за цією особою в базі немає."
  }</p>
  <dl class="facts">
    <dt>Пошта</dt><dd>${esc(entry.officer_email ?? "—")}</dd>
    <dt>Телефон</dt><dd>${esc(entry.officer_phone ?? "—")}</dd>
  </dl>
  <p style="margin-top:.9rem"><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">Переглянути закупівлі з цим контактом →</a></p>
</div>`
    : `<div class="card"><p>Картку цієї закупівлі ще не завантажено, тому контактні дані недоступні.</p><p><a href="${prozorro}" target="_blank" rel="noopener">Переглянути контакт в Prozorro →</a></p></div>`
}

<h2>Хто виграв</h2>
${
  entry.winner_name
    ? `<div class="card">
  <h3><a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a></h3>
  <p class="lead">${
    otherWinner.length
      ? `Ця компанія перемогла ще у <strong>${otherWinner.length}</strong> ${plural(otherWinner.length, "закупівлі", "закупівлях", "закупівлях")} із позначками, разом на <strong>${shortMoney(winnerValue)}</strong>.`
      : "Інших закупівель із позначками за цією компанією в базі немає."
  }</p>
  <dl class="facts">
    <dt>ЄДРПОУ</dt><dd>${esc(entry.winner_edrpou ?? "—")}</dd>
    <dt>Сума договору</dt><dd>${money(entry.winner_amount)}</dd>
  </dl>
</div>`
    : `<div class="card"><p>Переможця не визначено або картку ще не завантажено.</p><p><a href="${prozorro}" target="_blank" rel="noopener">Подивитися переможця в Prozorro →</a></p></div>`
}

</div></details>
<details class="detail-fold"><summary>Усі реквізити закупівлі</summary><div class="detail-fold-body"><div class="card">
  <dl class="facts">
    <dt>Сума</dt><dd><strong>${money(entry.value_amount)}</strong> <span class="faint">(${shortMoney(entry.value_amount)})</span></dd>
    <dt>Замовник</dt><dd><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(readableName(entry.entity_name))}</a><br><span class="faint">ЄДРПОУ ${esc(entry.entity_edrpou ?? "—")}</span></dd>
    <dt>Регіон</dt><dd>${entry.region ? `<a href="/?region=${encodeURIComponent(entry.region)}">${esc(entry.region)}</a>` : "—"}</dd>
    ${entry.method ? `<dt>Процедура</dt><dd>${esc(procedureLabel(entry.method) ?? "—")}</dd>` : ""}
    ${entry.detailed ? `<dt>Учасників</dt><dd>${entry.bidders === 1 ? "<strong>один</strong> — конкуренції не було" : entry.bidders || "—"}</dd>` : ""}
    <dt>Дата закупівлі</dt><dd>${date(entry.tender_date)}</dd>
    <dt>Позначено державою</dt><dd>${date(entry.date_assessed)}</dd>
    <dt>Першоджерело</dt><dd><a href="https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}" target="_blank" rel="noopener">Відкрити картку в Prozorro →</a></dd>
  </dl>
</div>

<a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? '')}">Досьє замовника · ${sameEntity.length} закупівель із позначками →</a></div></details>
<details class="detail-fold"><summary><span><strong>Правова довідка</strong><small>Норми та пояснення для фахівців</small></span></summary><div class="detail-fold-body">${qualificationBlock(entry)}</div></details>
<details class="detail-fold"><summary>Завантажити або надрукувати звіт</summary><div class="detail-fold-body detail-downloads"><a href="/tender/${encodeURIComponent(entry.tender_id)}/report">Для друку та PDF</a><a href="/tender/${encodeURIComponent(entry.tender_id)}/report.txt">Текстовий файл</a></div></details>
</section></article>
`,
  });
}
