// Human-readable labels for the machine codes the state APIs emit.

export type RiskLabel = {
  /** Short headline a person can read at a glance. */
  short: string;
  /** What it means in practice, in plain words. */
  means: string;
  /** Grouping, so a dossier reads as a pattern rather than a list. */
  group: RiskGroup;
};

export type RiskGroup =
  | "Ціну змінили після перемоги"
  | "Конкурентів усунули"
  | "Систему обійшли"
  | "Скаргу проігнорували"
  | "Строки не сходяться";

export const RISK_LABELS: Record<string, RiskLabel> = {
  "ari-1-1": {
    short: "Договір переписували щонайменше тричі",
    means: "Після перемоги до договору уклали три чи більше додаткових угод. Саме так найчастіше піднімають ціну вже після того, як торги виграно.",
    group: "Ціну змінили після перемоги",
  },
  "ari-1-2": {
    short: "Ціну підняли «за покращення якості»",
    means: "Дві чи більше додаткових угод із формулюванням про покращення якості. Це поширений спосіб обґрунтувати підвищення ціни.",
    group: "Ціну змінили після перемоги",
  },
  "sas24-3-4": {
    short: "Ціну підняли й строк подовжили",
    means: "Замовник змінив істотні умови договору одразу у двох частинах — ціна вгору, строк далі.",
    group: "Ціну змінили після перемоги",
  },
  "sas24-3-2": {
    short: "Відхилили двох і більше учасників — товари й послуги",
    means: "Усіх, крім переможця, зняли з торгів. Конкуренція зникає, ціну нема з чим порівняти.",
    group: "Конкурентів усунули",
  },
  "sas24-3-2-1": {
    short: "Відхилили двох і більше учасників — роботи",
    means: "Те саме на закупівлі робіт: усіх конкурентів переможця відхилено.",
    group: "Конкурентів усунули",
  },
  "sas24-3-5": {
    short: "Відхилили, не давши виправити помилку",
    means: "Закон дає учаснику 24 години на усунення невідповідностей. Тут щонайменше двох відхилили, не скориставшись цим механізмом.",
    group: "Конкурентів усунули",
  },
  "sas24-3-15": {
    short: "Відхилили учасників, поки тривала скарга",
    means: "Двох і більше учасників зняли з торгів у момент, коли скарга ще розглядалася.",
    group: "Конкурентів усунули",
  },
  "sas24-3-13": {
    short: "Безпідставно застосували механізм «24 години»",
    means: "На спрощеній закупівлі скористалися процедурою виправлення там, де підстав для неї не було.",
    group: "Конкурентів усунули",
  },
  "sas24-3-10": {
    short: "Переможця не відхилили попри порушення вимог",
    means: "Переможець не виконав обов'язкові вимоги щодо оприлюднення, але його залишили переможцем.",
    group: "Конкурентів усунули",
  },
  "sas24-3-11-1": {
    short: "Договір уклали повз електронну систему",
    means: "Закупівлю провели без використання електронної системи там, де вона обов'язкова.",
    group: "Систему обійшли",
  },
  "sas24-3-11-2": {
    short: "Договір уклали під час оскарження",
    means: "Договір підписали, поки процедуру оскаржували — тобто не дочекавшись рішення.",
    group: "Систему обійшли",
  },
  "sas24-3-1": {
    short: "Не виконали рішення по скарзі вчасно",
    means: "Рішення органу оскарження обов'язкове до виконання. Замовник не виконав його у визначений законом строк.",
    group: "Скаргу проігнорували",
  },
  "sas24-3-9": {
    short: "Повторно обрали того самого переможця",
    means: "Після рішення органу оскарження замовник знову визнав переможцем того самого учасника.",
    group: "Скаргу проігнорували",
  },
  "sas24-3-7": {
    short: "Роботи «виконано» підозріло швидко",
    means: "Між оприлюдненням договору на роботи і звітом про його виконання минуло менше 60 днів.",
    group: "Строки не сходяться",
  },
};

export const GROUP_ORDER: RiskGroup[] = [
  "Ціну змінили після перемоги",
  "Конкурентів усунули",
  "Систему обійшли",
  "Скаргу проігнорували",
  "Строки не сходяться",
];

const PROCEDURES: Record<string, string> = {
  aboveThreshold: "Відкриті торги",
  aboveThresholdUA: "Відкриті торги",
  aboveThresholdEU: "Відкриті торги з публікацією в ЄС",
  belowThreshold: "Спрощена закупівля",
  reporting: "Звіт про укладений договір",
  negotiation: "Переговорна процедура",
  "negotiation.quick": "Переговорна процедура, скорочена",
  competitiveDialogue: "Конкурентний діалог",
  "competitiveDialogue.stage2": "Конкурентний діалог, другий етап",
  priceQuotation: "Запит пропозицій",
  simple: "Спрощена закупівля",
  esco: "Енергосервіс",
  closeFrameworkAgreementUA: "Рамкова угода",
};

export function procedureLabel(code: string | null): string | null {
  if (!code) return null;
  return PROCEDURES[code] ?? code;
}

/**
 * Abbreviations that stay capitalised. A whitelist, not a length rule:
 * treating every short token as an abbreviation produced
 * "Департамент З благоустрою ТА реконструкції міської РАДИ".
 */
const ABBREVIATIONS = new Set([
  "АТ", "ПАТ", "ПРАТ", "ПрАТ", "ВАТ", "ЗАТ", "ТОВ", "ТзОВ", "ПП", "ФОП",
  "КП", "КНП", "ДП", "КУ", "УДП", "НДІ", "ДПТНЗ", "ЗДО", "ЗЗСО",
  "ХОДА", "ОДА", "ОВА", "МВА", "МВС", "ЗСУ", "ДСНС", "УЗ", "РФ",
  "ЦЗО", "ЦЗВ", "ХМР", "ХОР", "ЖКГ", "ТЕЦ", "ТЕС", "ГЕС", "АЕС",
]);

/**
 * The state registers write organisation names in capitals. Shouting is hard
 * to read, so fold them to normal sentence case: lower case throughout, an
 * initial capital at the start and after an opening quote, and recognised
 * abbreviations left alone. Names that already carry mixed case are returned
 * untouched.
 */
export function readableName(name: string | null): string {
  if (!name) return "";
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return name;
  const upper = [...letters].filter((c) => c === c.toUpperCase()).length;
  if (upper / letters.length < 0.8) return name;

  let first = true;
  let afterQuote = false;

  return name.replace(/\p{L}[\p{L}'’-]*|[«"“']/gu, (token) => {
    if (/^[«"“']$/.test(token)) {
      afterQuote = true;
      return token;
    }
    if (token.length <= 4) {
      first = false;
      afterQuote = false;
      return token;
    }
    const lower = token[0] + token.slice(1).toLowerCase();
    const capitalise = first || afterQuote;
    first = false;
    afterQuote = false;
    return capitalise ? lower[0].toUpperCase() + lower.slice(1) : lower.toLowerCase();
  });
}
