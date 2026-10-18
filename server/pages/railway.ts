import { RAILWAY_EDRPOU, SOUTHERN_RAILWAY_EDRPOU, railwayScope, type RailwayScope } from "../../src/config.ts";
import { readableName } from "../../src/labels.ts";
import { layout, esc, shortMoney, plural } from "../html.ts";
import { type Case } from "../data.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { star } from "../components/case-row.ts";
import { rankRisks, groupedRiskCards } from "../components/risk.ts";
import { controlBar, listBody } from "../components/filters.ts";

/* ---------- railway ---------- */

type RailwayBlock = { scope: RailwayScope; heading: string; note: string; list: Case[] };

function railwayBlocks(): RailwayBlock[] {
  const by = new Map<RailwayScope, Case[]>();
  for (const entry of dataset().cases) {
    const scope = railwayScope(entry);
    if (!scope) continue;
    const list = by.get(scope) ?? [];
    list.push(entry);
    by.set(scope, list);
  }

  const blocks: RailwayBlock[] = [
    {
      scope: "southern",
      heading: "Регіональна філія «Південна залізниця»",
      note: `Власне залізниця Харківщини — регіональна філія АТ «Українська залізниця» з осідком у Харкові, ЄДРПОУ ${SOUTHERN_RAILWAY_EDRPOU}.`,
      list: by.get("southern") ?? [],
    },
    {
      scope: "branch",
      heading: "Інші філії АТ «Українська залізниця»",
      note:
        "Централізовані філії, які закуповують для всієї мережі, зокрема й для Харківського вузла. " +
        "Зареєстровані поза межами області, тому ми показуємо їх окремо, а не змішуємо з харківськими.",
      list: by.get("branch") ?? [],
    },
    {
      scope: "local",
      heading: "Залізничні заклади Харківщини",
      note: "Організації залізничного профілю, зареєстровані в області: університет, ліцей, центр професійної освіти.",
      list: by.get("local") ?? [],
    },
  ];
  return blocks.filter((b) => b.list.length > 0);
}

export function railwayPage(url: URL): string {
  const blocks = railwayBlocks();
  const all = blocks.flatMap((b) => b.list);
  const value = all.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
  const solo = all.filter((c) => c.bidders === 1).length;
  const southern = blocks.find((b) => b.scope === "southern")?.list ?? [];

  // The whole page is railway already, so that checkbox would do nothing.
  const c = readControls(url);
  const filtered = applyControls(all, c, RAILWAY_EDRPOU, { hideRail: true });

  const suppliers = new Map<string, { name: string; count: number; value: number; solo: number }>();
  for (const entry of all) {
    const key = entry.winner_edrpou ?? "";
    if (!key) continue;
    const acc = suppliers.get(key) ?? { name: entry.winner_name ?? key, count: 0, value: 0, solo: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    if (entry.bidders === 1) acc.solo++;
    suppliers.set(key, acc);
  }
  const topSuppliers = [...suppliers.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 15);

  return layout({
    title: "Залізниця Харківської області",
    nav: "railway",
    body: `
<header class="railway-heading"><div><h1>Залізниця Харківської області</h1><p class="sub">Закупівлі залізниці та пов’язаних організацій.</p></div><span class="railway-count">${all.length.toLocaleString("uk-UA")} закупівель</span></header>
<details class="railway-about"><summary>Про розділ</summary><div class="railway-about-grid"><p><strong>Південна залізниця</strong><br>Регіональна філія, що обслуговує Харківщину.</p><p><strong>Інші філії Укрзалізниці</strong><br>Централізовані закупівлі для всієї мережі. Не лише Харківщина.</p><p><strong>Місцеві заклади</strong><br>Залізничні освітні та наукові організації області.</p></div></details>
${controlBar("/railway", c, { hideRail: true }, { url })}
${listBody(filtered, c, "/railway")}

<details class="railway-analysis"><summary>Замовники, постачальники та статистика</summary><div class="railway-analysis-body"><h2>Хто закуповує</h2>
${blocks
  .map((block) => {
    const blockValue = block.list.reduce((sum, x) => sum + (x.value_amount ?? 0), 0);
    const entities = new Map<string, { name: string; count: number; value: number }>();
    for (const entry of block.list) {
      const key = entry.entity_edrpou ?? "";
      const acc = entities.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
      acc.count++;
      acc.value += entry.value_amount ?? 0;
      entities.set(key, acc);
    }

    return `
<details class="group-block">
  <summary>
    <span class="g-name">${esc(block.heading)}</span>
    <span class="g-meta">${block.list.length} ${plural(block.list.length, "закупівля", "закупівлі", "закупівель")} · ${shortMoney(blockValue)} · ${entities.size} ${plural(entities.size, "замовник", "замовники", "замовників")}</span>
  </summary>
  <div class="g-body">
<p class="hint">${esc(block.note)}</p>
<div class="rows">
${[...entities.entries()]
  .sort((a, b) => b[1].value - a[1].value)
  .map(
    ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name">${star("entity", edrpou, "/railway")}<a href="/entity/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")} із позначками</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`,
  )
  .join("")}
</div>
  </div>
</details>`;
  })
  .join("")}

<h2>Що держава запідозрила в залізничних закупівлях</h2>
${groupedRiskCards(rankRisks(all))}

<h2>Хто виграє залізничні тендери</h2>
<p class="hint">П'ятнадцять найбільших переможців.</p>
<div class="rows">
${topSuppliers
  .map(
    ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name">${star("supplier", edrpou, "/railway")}<a href="/supplier/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "перемога", "перемоги", "перемог")}${acc.solo ? ` · ${acc.solo} без конкурентів` : ""}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`,
  )
  .join("")}
</div>

</div></details><p class="note">Позначка означає, що спрацював індикатор державної системи моніторингу закупівель. Це ознака ризику, яка потребує перевірки, а не встановлений факт порушення.</p>
`,
  });
}
