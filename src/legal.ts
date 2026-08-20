// Maps Criminal Code articles to the state risk indicators whose findings are
// the kind of documentary anomaly an investigator examines when screening for
// that article.
//
// This is a screening aid for lawyers, not a qualification of anyone's conduct.
// Nothing here establishes an offence: intent and knowing falsity are decided
// by a court on evidence, never by an indicator firing.

export type ArticleLink = {
  /** Which indicator, and why it is relevant to this article. */
  risk_id: string;
  why: string;
};

export type Article = {
  code: string;
  title: string;
  /** What the offence is, in plain words. */
  summary: string;
  /** What a prosecutor must establish. Makes clear why data alone cannot. */
  elements: string[];
  /** What this screen cannot show, stated up front. */
  caution: string;
  links: ArticleLink[];
};

export const ARTICLES: Record<string, Article> = {
  "366": {
    code: "366",
    title: "Службове підроблення",
    summary:
      "Складання чи видача службовою особою завідомо неправдивих офіційних документів, внесення до офіційних документів завідомо неправдивих відомостей або інше підроблення документів.",
    elements: [
      "Особа є службовою — має організаційно-розпорядчі або адміністративно-господарські повноваження.",
      "Документ є офіційним — договір про закупівлю, додаткова угода, звіт про виконання, протокол уповноваженої особи.",
      "Відомості завідомо неправдиві — особа знала про їх неправдивість у момент внесення.",
      "Наявний умисел. Помилка, недбалість чи хибне тлумачення закону складу цієї статті не утворюють.",
    ],
    caution:
      "Жоден із наведених індикаторів не доводить підроблення. Вони показують документальні розбіжності в закупівлі — тобто місце, де варто подивитися на самі документи. Умисел і завідомість встановлює виключно суд.",
    links: [
      {
        risk_id: "ari-1-1",
        why: "Кожна додаткова угода — офіційний документ із зазначеною підставою. Три і більше угод до одного договору означає три і більше підстав, які можна перевірити на відповідність дійсності.",
      },
      {
        risk_id: "ari-1-2",
        why: "Підстава «покращення якості предмета закупівлі» фіксується в документі. Якщо фактично предмет не змінювався, розбіжність між написаним і дійсним стає предметом перевірки.",
      },
      {
        risk_id: "sas24-3-4",
        why: "Зміна істотних умов договору оформлюється документально й потребує обґрунтування. Одночасне підвищення ціни та продовження строку — типове місце для перевірки обґрунтувань.",
      },
      {
        risk_id: "sas24-3-7",
        why: "Звіт про виконання договору — офіційний документ. Якщо між оприлюдненням договору на роботи і звітом про їх виконання минуло менше 60 днів, варто звірити обсяг робіт із заявленим строком.",
      },
      {
        risk_id: "sas24-3-10",
        why: "Невідхилення переможця, який не виконав вимоги щодо оприлюднення документів, означає, що рішення уповноваженої особи розходиться з наявними документами.",
      },
    ],
  },
};

/**
 * Recognises joint-stock companies by name.
 * Note for maintainers: JavaScript's \w does not match Cyrillic, so an
 * earlier pattern using `акціонерн\w*` matched nothing at all.
 */
const JOINT_STOCK = /(^|[\s"«(“'])(АТ|ПАТ|ПрАТ|ВАТ|ЗАТ)([\s"«.,“']|$)|акціонерн/i;

export function isJointStock(name: string | null): boolean {
  return name !== null && JOINT_STOCK.test(name);
}
