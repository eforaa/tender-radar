import { esc } from "../html.ts";
import { type Case } from "../data.ts";
import { buildConclusion } from "../conclusion.ts";
import { buildQualification } from "../qualification.ts";
import { dataset } from "../context.ts";

/** The expanded legal qualification for one tender. */
export function qualificationBlock(entry: Case): string {
  const q = buildQualification(entry, dataset().ruleById);

  return `<p class="caution">${esc(q.caution)}</p>

<h3 class="block-head">Норми, які зачеплені</h3>
${q.norms
  .map(
    (n) => `<div class="card">
  <p class="${n.source === "state" ? "legal" : "legal reading"}"><strong>${n.source === "state" ? "Норма, яку наводить держава" : "Норма — наше зіставлення"}:</strong> ${esc(n.norm)}</p>
  ${n.note ? `<p class="faint">${esc(n.note)}</p>` : ""}
  <p class="faint">Підстава: ${n.from.map((f) => esc(f)).join(" · ")}</p>
</div>`,
  )
  .join("")}

<h3 class="block-head">Що з цього випливає за законом про закупівлі</h3>
${q.consequences
  .map(
    (c) => `<div class="card">
  <h3>${esc(c.norm)}</h3>
  <p class="lead">${esc(c.effect)}</p>
</div>`,
  )
  .join("")}

<h3 class="block-head">Адміністративна відповідальність</h3>
${q.admin
  .map(
    (a) => `<div class="card">
  <h3>Стаття 164-14 КУпАП, ${esc(a.part)}</h3>
  <p class="lead">${esc(a.conduct)}</p>
  <dl class="facts">
    <dt>Санкція</dt><dd><strong>${esc(a.fine)}</strong> на службових та уповноважених осіб замовника</dd>
    <dt>Підстава</dt><dd>${a.from.map((f) => esc(f)).join(" · ")}</dd>
  </dl>
  <p class="faint">Розмір наведено в неоподатковуваних мінімумах доходів громадян; для штрафів ця одиниця становить 17 грн.</p>
</div>`,
  )
  .join("")}

<h3 class="block-head">Кримінально-правові напрями</h3>
<p class="hint">Для кожного напряму — що доводити і якими документами.</p>
${q.criminal
  .map(
    (c) => `<div class="card">
  <h3>Стаття ${esc(c.code)} ККУ — ${esc(c.title)}</h3>
  <p class="lead">${esc(c.summary)}</p>
  <p><strong>Чому цей напрям виникає саме тут:</strong></p>
  <ul>${c.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
  <details class="sub">
    <summary>Що має бути доведено та які документи витребувати</summary>
    <div class="inner">
      <p><strong>Склад:</strong></p>
      <ul>${c.elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      <p><strong>Докази:</strong></p>
      <ul>${c.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>
  </details>
</div>`,
  )
  .join("")}`;
}

/** The system's own reading of one tender, rendered for the page. */
export function conclusionBlock(entry: Case, sameEntity: Case[], sameOfficer: Case[], sameWinner: Case[]): string {
  const c = buildConclusion({ entry, sameEntity, sameOfficer, sameWinner });
  // The tag states the priority; the headline says why. They must not repeat.
  const levelLabel = c.level === "high" ? "Високий пріоритет" : c.level === "medium" ? "Середній пріоритет" : "Низький пріоритет";

  return `<div class="card verdict ${esc(c.level)}">
  <h3><span class="verdict-tag">${esc(levelLabel)}</span> ${esc(c.headline)}</h3>
  ${
    c.observations.length > 0
      ? `<ol class="findings">${c.observations
          .map(
            (o) => `<li class="w-${esc(o.weight)}">
    <strong>${esc(o.title)}</strong>
    <span>${esc(o.detail)}</span>
  </li>`,
          )
          .join("")}</ol>`
      : `<p class="lead">Державна система позначила цю закупівлю, але наші власні перевірки — ціна проти ринку, конкуренція, повторюваність зв'язків — нічого додаткового не показали.</p>`
  }
  <p><strong>Що перевірити далі:</strong></p>
  <ul>${c.nextSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
  <p class="faint">Цей висновок склала система з чисел, наведених вище. Він не встановлює порушення і не є кваліфікацією дій будь-якої особи.</p>
</div>`;
}
