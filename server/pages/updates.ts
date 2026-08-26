import { RAILWAY_EDRPOU } from "../../src/config.ts";
import { layout, esc, date, plural } from "../html.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { sortBar, filterPanel, listBody } from "../components/filters.ts";

/* ---------- what changed ---------- */

export function updatesPage(url: URL): string {
  const runs = [...dataset().runs].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const latest = runs[0];
  const newIds = new Set(latest?.new_tender_ids ?? []);
  const freshAll = dataset().cases.filter((x) => newIds.has(x.tender_id));
  const c = readControls(url);
  const fresh = applyControls(freshAll, c, RAILWAY_EDRPOU);

  return layout({
    title: "Оновлення",
    nav: "updates",
    body: `
<h1>Що змінилося</h1>
<p class="sub">Щодня звіряємося з державним масивом і додаємо нове.</p>

${
  latest
    ? `<p class="statline">
  <b>${latest.new_tenders}</b> нових закупівель востаннє ·
  <b>${latest.new_flags}</b> нових спрацювань ·
  <b>${date(latest.started_at)}</b> останнє оновлення ·
  <b>${runs.length}</b> ${plural(runs.length, "запуск", "запуски", "запусків")}
</p>`
    : '<div class="empty">Жодного запуску ще не було. Виконайте <code>npm run daily</code>.</div>'
}

${
  freshAll.length > 0
    ? `<h2>Нові закупівлі з останнього оновлення</h2>
${sortBar("/updates", c)}
${filterPanel("/updates", c)}
${listBody(fresh, c, "/updates")}`
    : latest
      ? `<h2>Нові закупівлі з останнього оновлення</h2><div class="empty">Нових закупівель не з’явилося. Це нормальний результат — держава не щодня додає позначки.</div>`
      : ""
}

<h2>Історія запусків</h2>
<div class="rows">
${runs
  .slice(0, 30)
  .map(
    (r) => `<div class="row">
  <div class="who">
    <div class="name">${date(r.started_at)}${r.status === "failed" ? ' <span class="flag alarm">збій</span>' : ""}</div>
    <div class="meta">${r.new_tenders} ${plural(r.new_tenders, "нова закупівля", "нові закупівлі", "нових закупівель")} · ${r.new_flags} ${plural(r.new_flags, "нове спрацювання", "нові спрацювання", "нових спрацювань")} · ${r.details_fetched} ${plural(r.details_fetched, "картка", "картки", "карток")} завантажено${r.errors ? ` · ${r.errors} ${plural(r.errors, "помилка", "помилки", "помилок")}` : ""}</div>
    ${r.message ? `<div class="meta">${esc(r.message)}</div>` : ""}
  </div>
  <div class="amount"><span class="big">${r.status === "ok" ? "✓" : "✕"}</span></div>
</div>`,
  )
  .join("")}
</div>

<p class="note">Оновлення виконує скрипт <code>npm run daily</code>. Він безпечний до повторного запуску: усе, що вже є, не дублюється, а перерваний запуск довантажується наступного разу.</p>
`,
  });
}
