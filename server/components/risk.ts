import { RISK_LABELS, GROUP_ORDER, type RiskGroup } from "../../src/labels.ts";
import { esc, plural } from "../html.ts";
import { ARTICLES, INDICATOR_LEGAL } from "../../src/legal.ts";
import { type Case } from "../data.ts";
import { dataset } from "../context.ts";

export function shortRisk(riskId: string): string {
  return RISK_LABELS[riskId]?.short ?? dataset().ruleById.get(riskId)?.name ?? riskId;
}

export function riskFlag(riskId: string): string {
  return `<a class="flag" href="/?risk=${encodeURIComponent(riskId)}">${esc(shortRisk(riskId))}</a>`;
}

export function rankRisks(list: Case[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const entry of list) for (const r of entry.risks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function riskCard(riskId: string, count?: number): string {
  const rule = dataset().ruleById.get(riskId);
  const label = RISK_LABELS[riskId];
  const legal = INDICATOR_LEGAL[riskId];

  // The state publishes the norm for eight of the fourteen indicators. Where
  // it does, that citation is authoritative and is shown as the state's own;
  // where it does not, our reading is shown and labelled as ours.
  const stateNorm = rule?.legitimateness?.trim();
  const norm = stateNorm
    ? `<p class="legal"><strong>Норма, яку наводить держава:</strong> ${esc(stateNorm)}</p>`
    : legal?.norm
      ? `<p class="legal reading"><strong>Норма — наше зіставлення:</strong> ${esc(legal.norm)}</p>
  <p class="faint">${esc(legal.normNote ?? "")}</p>`
      : `<p class="faint">Держава не наводить норму для цього індикатора, і ми не беремося її добудувати.</p>`;

  const criminal = legal?.criminal.length
    ? `<details class="sub">
  <summary>Що це може означати за кримінальним законом — ${legal.criminal.length} ${plural(legal.criminal.length, "напрям", "напрями", "напрямів")}</summary>
  <div class="inner">
    <p class="faint">Це напрями перевірки для юриста, а не кваліфікація дій. Умисел встановлює лише суд.</p>
    ${legal.criminal
      .map((direction) => {
        const article = ARTICLES[direction.code];
        return `<p><strong>Стаття ${esc(direction.code)} ККУ — ${esc(article?.title ?? "")}</strong><br>${esc(direction.why)}<br><a href="/article/${esc(direction.code)}">Усі закупівлі за цим напрямом →</a></p>`;
      })
      .join("")}
  </div>
</details>`
    : "";

  return `<div class="card">
  <h3><span class="tier state">Позначила держава</span> &nbsp;${esc(label?.short ?? rule?.name ?? riskId)}${count ? ` <span class="faint">— ${count} ${plural(count, "раз", "рази", "разів")}</span>` : ""}</h3>
  ${label ? `<p class="lead">${esc(label.means)}</p>` : ""}
  ${rule?.name && label ? `<p class="faint"><strong>Офіційне формулювання:</strong> ${esc(rule.name)}</p>` : ""}
  ${norm}
  ${criminal}
  <p class="code">Індикатор ${esc(riskId)} · державна система моніторингу закупівель</p>
</div>`;
}

/** Groups indicator cards so a dossier reads as a pattern, not a list. */
export function groupedRiskCards(ranked: [string, number][]): string {
  const byGroup = new Map<RiskGroup, [string, number][]>();
  const ungrouped: [string, number][] = [];

  for (const pair of ranked) {
    const group = RISK_LABELS[pair[0]]?.group;
    if (!group) {
      ungrouped.push(pair);
      continue;
    }
    const list = byGroup.get(group) ?? [];
    list.push(pair);
    byGroup.set(group, list);
  }

  const parts: string[] = [];
  for (const group of GROUP_ORDER) {
    const list = byGroup.get(group);
    if (!list) continue;
    const total = list.reduce((sum, [, n]) => sum + n, 0);
    parts.push(
      `<div class="group"><h3>${esc(group)}</h3><span class="count">${total} ${plural(total, "спрацювання", "спрацювання", "спрацювань")}</span></div>`,
      ...list.map(([riskId, count]) => riskCard(riskId, count)),
    );
  }
  parts.push(...ungrouped.map(([riskId, count]) => riskCard(riskId, count)));
  return parts.join("");
}
