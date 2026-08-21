// The expanded legal qualification for one tender.
//
// The per-indicator cards answer "what does this one indicator point at".
// This answers the question a lawyer actually asks: taking this tender as a
// whole, which norms are engaged, what follows under the procurement law
// itself, what administrative liability is in play, and what has to be proved
// before any of it becomes a criminal matter.
//
// It qualifies nothing. Every conclusion is conditional and says what evidence
// would have to be obtained to test it.
import type { Case } from "./data.ts";
import type { RiskRuleRow } from "../src/store/types.ts";
import { RISK_LABELS } from "../src/labels.ts";
import { INDICATOR_LEGAL, ARTICLES, ADMIN_ARTICLE, CONSEQUENCES, type AdminPart } from "../src/legal.ts";

export type EngagedNorm = {
  norm: string;
  source: "state" | "reading";
  note?: string;
  /** Which indicators on this tender bring the norm into play. */
  from: string[];
};

export type AdminExposure = {
  part: string;
  conduct: string;
  fine: string;
  from: string[];
};

export type CriminalDirection = {
  code: string;
  title: string;
  summary: string;
  elements: string[];
  reasons: string[];
  /** What would have to be obtained to test it. */
  evidence: string[];
};

export type Qualification = {
  norms: EngagedNorm[];
  consequences: { norm: string; effect: string }[];
  admin: AdminExposure[];
  criminal: CriminalDirection[];
  caution: string;
};

const EVIDENCE_BY_ARTICLE: Record<string, string[]> = {
  "366": [
    "Договір про закупівлю та всі додаткові угоди до нього, із зазначеними підставами змін.",
    "Первинні документи, які мали б підтверджувати ці підстави: акти, специфікації, розрахунки.",
    "Звіт про виконання договору та документи, що підтверджують фактичний обсяг.",
    "Протоколи уповноваженої особи замовника.",
  ],
  "191": [
    "Платіжні документи та виписки за договором.",
    "Розрахунок різниці між сплаченим і обґрунтованою вартістю.",
    "Документи про фактично отриманий товар, роботу чи послугу.",
  ],
  "364": [
    "Посадова інструкція та наказ про призначення уповноваженої особи.",
    "Тендерна документація та протоколи розгляду пропозицій.",
    "Листування щодо розгляду та відхилення пропозицій учасників.",
  ],
  "367": [
    "Посадова інструкція та обсяг обов'язків уповноваженої особи.",
    "Документи, що показують, які дії мали бути вчинені та у який строк.",
  ],
};

function fine(part: AdminPart): string {
  const p = ADMIN_ARTICLE.parts[part];
  const uah = (n: number) => new Intl.NumberFormat("uk-UA").format(n * ADMIN_ARTICLE.unitUah);
  return p.fineFrom === p.fineTo
    ? `${p.fineFrom} нмдг (${uah(p.fineFrom)} грн)`
    : `від ${p.fineFrom} до ${p.fineTo} нмдг (${uah(p.fineFrom)}–${uah(p.fineTo)} грн)`;
}

function shortName(riskId: string, rules: Map<string, RiskRuleRow>): string {
  return RISK_LABELS[riskId]?.short ?? rules.get(riskId)?.name ?? riskId;
}

export function buildQualification(entry: Case, rules: Map<string, RiskRuleRow>): Qualification {
  const norms = new Map<string, EngagedNorm>();
  const consequenceKeys = new Set<string>();
  const adminParts = new Map<AdminPart, string[]>();
  const criminal = new Map<string, { reasons: string[] }>();

  for (const riskId of entry.risks) {
    const rule = rules.get(riskId);
    const legal = INDICATOR_LEGAL[riskId];
    const name = shortName(riskId, rules);

    // The norm: the state's citation wins where it exists.
    const stateNorm = rule?.legitimateness?.trim();
    const text = stateNorm || legal?.norm;
    if (text) {
      const existing = norms.get(text);
      if (existing) {
        existing.from.push(name);
      } else {
        norms.set(text, {
          norm: text,
          source: stateNorm ? "state" : "reading",
          note: stateNorm ? undefined : legal?.normNote,
          from: [name],
        });
      }
    }

    for (const key of legal?.consequences ?? []) consequenceKeys.add(key);

    if (legal?.admin) {
      const list = adminParts.get(legal.admin) ?? [];
      list.push(name);
      adminParts.set(legal.admin, list);
    }

    for (const direction of legal?.criminal ?? []) {
      const acc = criminal.get(direction.code) ?? { reasons: [] };
      if (!acc.reasons.includes(direction.why)) acc.reasons.push(direction.why);
      criminal.set(direction.code, acc);
    }
  }

  return {
    norms: [...norms.values()],
    consequences: [...consequenceKeys].map((key) => CONSEQUENCES[key]).filter(Boolean),
    admin: [...adminParts.entries()].map(([part, from]) => ({
      part: ADMIN_ARTICLE.parts[part].label,
      conduct: ADMIN_ARTICLE.parts[part].conduct,
      fine: fine(part),
      from,
    })),
    criminal: [...criminal.entries()].map(([code, acc]) => {
      const article = ARTICLES[code];
      return {
        code,
        title: article?.title ?? "",
        summary: article?.summary ?? "",
        elements: article?.elements ?? [],
        reasons: acc.reasons,
        evidence: EVIDENCE_BY_ARTICLE[code] ?? [],
      };
    }),
    caution:
      "Наведене нижче — правова довідка для юриста, а не кваліфікація дій будь-якої особи. " +
      "Індикатор фіксує розбіжність у закупівлі; чи є вона порушенням, і тим більше злочином, " +
      "встановлюють уповноважені органи та суд на підставі самих документів.",
  };
}
