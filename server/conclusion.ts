// The system's own conclusion about one tender.
//
// This is where the site stops repeating what the state said and states what
// it thinks. Everything here is derived from numbers already on the page —
// no model, no guessing — and every observation carries the figures it rests
// on, so a reader can disagree with the reasoning rather than trust it.
//
// The bar is deliberately conservative. A tender with a single indicator and
// nothing else around it gets told exactly that, rather than dressed up.
import type { Case } from "./data.ts";
import { RISK_LABELS, type RiskGroup } from "../src/labels.ts";

export type Weight = "high" | "medium" | "low";

export type Observation = {
  weight: Weight;
  title: string;
  detail: string;
  /**
   * Whether this says something about *this* tender, or about the people and
   * companies around it. Context matters to a reader but must not by itself
   * raise the priority — otherwise every tender of a busy buyer looks urgent.
   */
  aboutThisTender: boolean;
};

export type Conclusion = {
  level: Weight;
  headline: string;
  observations: Observation[];
  nextSteps: string[];
};

export type ConclusionInput = {
  entry: Case;
  /** Every tender of the same buyer, official and winner, including this one. */
  sameEntity: Case[];
  sameOfficer: Case[];
  sameWinner: Case[];
};

function fmt(n: number, digits = 0): string {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: digits }).format(n);
}

function money(n: number | null): string {
  return n === null || !Number.isFinite(n) ? "—" : `${fmt(n)} грн`;
}

/** Which pattern the indicators on this tender mostly belong to. */
function dominantPattern(entry: Case): { group: RiskGroup; count: number } | null {
  const counts = new Map<RiskGroup, number>();
  for (const id of entry.risks) {
    const group = RISK_LABELS[id]?.group;
    if (!group) continue;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  let best: { group: RiskGroup; count: number } | null = null;
  for (const [group, count] of counts) {
    if (!best || count > best.count) best = { group, count };
  }
  return best;
}

export function buildConclusion(input: ConclusionInput): Conclusion {
  const { entry, sameEntity, sameOfficer, sameWinner } = input;
  const observations: Observation[] = [];
  const nextSteps: string[] = [];

  /* ---- what the auditors concluded, which is not an inference at all ---- */

  if (entry.audit?.violation) {
    observations.push({
      weight: "high",
      aboutThisTender: true,
      title: "Держаудитслужба встановила порушення",
      detail:
        `Моніторинг завершено висновком про порушення${entry.audit.published ? ` (${entry.audit.published.slice(0, 10)})` : ""}. ` +
        `Це не наша оцінка й не спрацювання індикатора — це висновок органу державного фінансового контролю. ` +
        (entry.audit.text ? `Формулювання висновку: «${entry.audit.text}»` : ""),
    });
    nextSteps.push("Прочитати висновок моніторингу в оригіналі та перевірити, чи усунуто порушення.");
  } else if (entry.audit) {
    observations.push({
      weight: "low",
      aboutThisTender: true,
      title: "Держаудитслужба перевірила і порушень не встановила",
      detail:
        `За цією закупівлею проведено моніторинг${entry.audit.count > 1 ? ` (${entry.audit.count})` : ""}, ` +
        "і порушень законодавства про закупівлі не встановлено. " +
        "Моніторинг перевіряє дотримання процедури, а не те, чи ціна відповідає ринковій.",
    });
  }

  /* ---- our own price arithmetic carries the most weight ---- */
  for (const finding of entry.findings) {
    const e = finding.evidence as Record<string, number | string | undefined>;
    const gap = typeof e.overpayment === "number" ? e.overpayment : typeof e.extra_cost === "number" ? e.extra_cost : null;

    if (finding.detector_key === "peer_price" && typeof e.peer_median === "number" && typeof e.unit_price === "number") {
      observations.push({
        weight: finding.severity === "low" ? "medium" : "high",
        aboutThisTender: true,
        title: "Ціна за одиницю вища за ринкову",
        detail:
          `За одиницю платять ${fmt(e.unit_price, 2)} грн, тоді як у ${e.peer_count ?? "інших"} закупівлях того самого ` +
          `предмета медіана — ${fmt(e.peer_median, 2)} грн. ` +
          (gap !== null ? `На весь обсяг різниця складає ${money(gap)}.` : ""),
      });
      nextSteps.push("Запросити обґрунтування очікуваної вартості та розрахунок ціни за одиницю.");
    }

    if (finding.detector_key === "own_price_growth" && typeof e.previous_price === "number" && typeof e.growth === "number") {
      observations.push({
        weight: e.growth >= 1 ? "high" : "medium",
        aboutThisTender: true,
        title: "Той самий замовник підняв ціну",
        detail:
          `Раніше цей замовник купував те саме по ${fmt(e.previous_price, 2)} грн за одиницю, тепер — ` +
          `по ${fmt(Number(e.unit_price ?? 0), 2)} грн, тобто на ${Math.round(e.growth * 100)}% більше. ` +
          (gap !== null ? `Різниця на цю закупівлю — ${money(gap)}. ` : "") +
          "Порівняння всередині одного замовника, тож посилання на місцеві умови тут не працює.",
      });
      nextSteps.push("Порівняти технічні вимоги обох закупівель — чи справді змінився предмет.");
    }
  }

  /* ---- competition ---- */
  if (entry.detailed && entry.bidders === 1) {
    const big = (entry.value_amount ?? 0) >= 10_000_000;
    observations.push({
      weight: big ? "high" : "medium",
      aboutThisTender: true,
      title: "Конкуренції не було",
      detail:
        `На торги подався один учасник, і він же переміг. Сума — ${money(entry.value_amount)}. ` +
        "Без другої пропозиції ціну немає з чим порівняти в межах самої процедури.",
    });
    nextSteps.push("Перевірити вимоги тендерної документації — чи не звужували вони коло учасників.");
  }

  /* ---- award almost equal to the expected value ---- */
  if (entry.value_amount && entry.winner_amount && entry.value_amount > 0) {
    const discount = 1 - entry.winner_amount / entry.value_amount;
    if (discount >= 0 && discount < 0.01 && entry.value_amount >= 1_000_000) {
      observations.push({
        weight: "medium",
        aboutThisTender: true,
        title: "Торги не збили ціну",
        detail:
          `Договір укладено на ${money(entry.winner_amount)} проти очікуваних ${money(entry.value_amount)} — ` +
          `знижка ${(discount * 100).toFixed(2)}%. Фактично аукціон не відбувся.`,
      });
    }
  }

  /* ---- the pattern the indicators form ---- */
  const pattern = dominantPattern(entry);
  if (pattern && pattern.count >= 2) {
    observations.push({
      weight: "medium",
      aboutThisTender: true,
      title: `Ознаки складаються в один сюжет: ${pattern.group.toLowerCase()}`,
      detail:
        `${pattern.count} з ${entry.risks.length} індикаторів належать до однієї групи. ` +
        "Це не збіг окремих формальностей, а повторюваний хід у межах однієї закупівлі.",
    });
  }

  /* ---- the buyer and winner keep meeting ---- */
  const pair = sameWinner.filter((c) => c.entity_edrpou === entry.entity_edrpou).length;
  if (pair >= 3 && entry.winner_name) {
    observations.push({
      weight: pair >= 6 ? "high" : "medium",
      aboutThisTender: false,
      title: "Постійна пара замовник — переможець",
      detail:
        `Цей постачальник виграв ${pair} закупівель саме цього замовника, і всі вони мають державні позначки. ` +
        `Усього в базі за ним ${sameWinner.length} перемог.`,
    });
    nextSteps.push("Перевірити засновників переможця та їх зв'язки із замовником.");
  }

  /* ---- the official's own record ---- */
  if (entry.officer_name && sameOfficer.length >= 5) {
    const officerSolo = sameOfficer.filter((c) => c.bidders === 1).length;
    observations.push({
      weight: sameOfficer.length >= 20 ? "medium" : "low",
      aboutThisTender: false,
      title: "Закупівлі цієї відповідальної особи позначаються систематично",
      detail:
        `${entry.officer_name} вказана відповідальною у ${sameOfficer.length} закупівлях із державними позначками` +
        (officerSolo > 0 ? `, з них ${officerSolo} — без конкурентів` : "") +
        ". Це характеристика потоку закупівель, а не звинувачення особи.",
    });
  }

  /* ---- the buyer overall ---- */
  if (sameEntity.length >= 20) {
    const entityValue = sameEntity.reduce((sum, c) => sum + (c.value_amount ?? 0), 0);
    observations.push({
      weight: "low",
      aboutThisTender: false,
      title: "Замовник у переліку постійно",
      detail: `За цим замовником обліковано ${sameEntity.length} закупівель із позначками на ${money(entityValue)}.`,
    });
  }

  /* ---- level and headline ----
     Only what we found in this tender sets the priority. Context about the
     buyer, the official or the winner is shown, but a busy buyer must not
     make every one of its tenders look urgent. */
  const own = observations.filter((o) => o.aboutThisTender);
  const highs = own.filter((o) => o.weight === "high").length;
  const mediums = own.filter((o) => o.weight === "medium").length;
  const level: Weight = highs >= 1 ? "high" : mediums >= 1 ? "medium" : "low";

  const proven = Boolean(entry.audit?.violation);
  // A clean audit only speaks for itself when nothing else about the tender
  // is weighing in. It clears the procedure, not the price.
  const clearedAndQuiet = Boolean(entry.audit) && !proven && own.every((o) => o.weight === "low");

  const headline = proven
    ? "Порушення встановила держава, а не ми"
    : clearedAndQuiet
      ? "Держава перевіряла цю закупівлю і порушень не встановила"
      : own.length === 0
        ? observations.length === 0
          ? "Крім самої державної позначки, ми нічого не знайшли"
          : "У самій закупівлі нічого не знайшли, але навколо неї є контекст"
        : level === "high"
          ? "Є що перевіряти: знайдено кількісні розбіжності"
          : "Варто подивитися уважніше";

  if (clearedAndQuiet) {
    nextSteps.push("Перевірити, чи стосувався моніторинг саме того питання, яке вас цікавить — його предмет вужчий за всю закупівлю.");
  } else if (own.length === 0) {
    nextSteps.push("Відкрити першоджерело в Prozorro і звірити документи закупівлі з описом індикатора.");
  } else {
    nextSteps.push("Витребувати договір і всі додаткові угоди до нього.");
  }

  return { level, headline, observations, nextSteps: [...new Set(nextSteps)] };
}
