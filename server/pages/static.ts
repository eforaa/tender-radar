import { REGION, RAILWAY_EDRPOU } from "../../src/config.ts";
import { readableName } from "../../src/labels.ts";
import { layout, esc, shortMoney, plural } from "../html.ts";
import { type Case } from "../data.ts";
import { type Favourite } from "../favourites.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { star } from "../components/case-row.ts";
import { rankRisks, groupedRiskCards } from "../components/risk.ts";
import { sortBar, filterPanel, listBody } from "../components/filters.ts";

export function starredPage(saved: Favourite[], url: URL): string {
  const tenders = saved.filter((f) => f.kind === "tender").map((f) => dataset().byTender.get(f.id)).filter((c): c is Case => Boolean(c));
  const missingTenders = saved.filter((f) => f.kind === "tender").length - tenders.length;
  const c = readControls(url);
  const filteredTenders = applyControls(tenders, c, RAILWAY_EDRPOU);

  const companyRows = saved
    .filter((f) => f.kind === "entity" || f.kind === "supplier")
    .map((f) => {
      const list =
        f.kind === "entity"
          ? dataset().cases.filter((c) => c.entity_edrpou === f.id)
          : dataset().cases.filter((c) => c.winner_edrpou === f.id);
      const name =
        f.kind === "entity"
          ? list.find((c) => c.entity_name)?.entity_name
          : list.find((c) => c.winner_name)?.winner_name;
      return {
        fav: f,
        href: `/${f.kind === "entity" ? "entity" : "supplier"}/${encodeURIComponent(f.id)}`,
        name: readableName(name ?? "") || f.id,
        role: f.kind === "entity" ? "замовник" : "постачальник",
        count: list.length,
        value: list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0),
      };
    });

  const officerRows = saved
    .filter((f) => f.kind === "officer")
    .map((f) => {
      const list = dataset().cases.filter((c) => c.officer_key === f.id);
      return {
        fav: f,
        href: `/officer/${encodeURIComponent(f.id)}`,
        name: list.find((c) => c.officer_name)?.officer_name ?? f.id,
        entity: readableName(list.find((c) => c.entity_name)?.entity_name ?? ""),
        count: list.length,
        value: list.reduce((sum, c) => sum + (c.value_amount ?? 0), 0),
      };
    });

  const section = (title: string, count: number, inner: string) =>
    count === 0 ? "" : `<h2>${esc(title)} — ${count}</h2>${inner}`;

  return layout({
    title: "Обране",
    nav: "starred",
    body: `
<h1>Обране</h1>
<p class="sub">Усе, що ви позначили зірочкою: закупівлі, замовники, постачальники, посадовці. Список зберігається у вашому браузері й не прив'язаний до облікового запису.</p>

<form class="filters" method="get" action="/lookup">
  <div class="filter-row">
    <input type="search" name="edrpou" placeholder="Знайти підприємство за ЄДРПОУ — наприклад, 00131954" aria-label="ЄДРПОУ" inputmode="numeric">
    <button type="submit">Знайти</button>
  </div>
</form>

${
  saved.length === 0
    ? `<div class="empty">Поки нічого не позначено. Натисніть ☆ біля будь-якої закупівлі, компанії чи посадовця.</div>`
    : ""
}

${section(
  "Закупівлі",
  tenders.length,
  `${sortBar("/starred", c)}${filterPanel("/starred", c)}${listBody(filteredTenders, c, "/starred")}${
    missingTenders > 0
      ? `<p class="note">${missingTenders} ${plural(missingTenders, "позначена закупівля більше не знайдена", "позначені закупівлі більше не знайдені", "позначених закупівель більше не знайдено")} в базі.</p>`
      : ""
  }`,
)}

${section(
  "Компанії",
  companyRows.length,
  `<div class="rows">${companyRows
    .map(
      (r) => `<div class="row">
  <div class="who">
    <div class="name">${star(r.fav.kind, r.fav.id, "/starred")}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">ЄДРПОУ ${esc(r.fav.id)} · ${esc(r.role)} · ${r.count} ${plural(r.count, "закупівля", "закупівлі", "закупівель")}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`,
    )
    .join("")}</div>`,
)}

${section(
  "Посадовці",
  officerRows.length,
  `<div class="rows">${officerRows
    .map(
      (r) => `<div class="row">
  <div class="who">
    <div class="name">${star("officer", r.fav.id, "/starred")}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">${esc(r.entity)} · ${r.count} ${plural(r.count, "закупівля", "закупівлі", "закупівель")}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`,
    )
    .join("")}</div>`,
)}
`,
  });
}

export function indicatorsPage(): string {
  // Every active indicator is listed, including those that never fired here —
  // a zero is information too.
  const counted = new Map(rankRisks(dataset().cases));
  const ranked: [string, number][] = dataset().rules
    .map((r) => [r.risk_id, counted.get(r.risk_id) ?? 0] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  return layout({
    title: "Що ми шукаємо",
    nav: "indicators",
    body: `
<h1>Що ми шукаємо</h1>
<p class="sub">Чотирнадцять ознак, за якими держава перевіряє кожну закупівлю. Нижче — що кожна означає звичайною мовою і скільки разів вона спрацювала в ${esc(REGION)} та на залізниці.</p>
${groupedRiskCards(ranked)}
`,
  });
}

export function aboutPage(): string {
  return layout({
    title: "Про систему",
    nav: "about",
    body: `
<h1>Про систему</h1>
<p class="sub">Що показує цей сайт, звідки бере дані і чого не робить.</p>

<div class="card">
  <h3>Звідки дані</h3>
  <p class="lead">Державна система автоматичних індикаторів ризику Prozorro — наказ Мінфіну № 476 від 27 вересня 2024 року. Держава перевіряє кожну закупівлю за чинним переліком ознак і публікує результат відкрито.</p>
  <p>Ми завантажуємо цей масив, відбираємо ${esc(REGION)} та філії АТ «Українська залізниця», доповнюємо картками закупівель із Prozorro — звідки беремо відповідальну особу, кількість учасників і переможця — і подаємо так, щоб з цим можна було працювати.</p>
</div>

<div class="card">
  <h3>Три рівні достовірності</h3>
  <p><span class="tier confirmed">Перевірила держава</span> &nbsp;Держаудитслужба провела моніторинг і встановила порушення.</p>
  <p><span class="tier state">Позначила держава</span> &nbsp;Спрацював індикатор державної системи. Це підозра держави з посиланням на норму закону — саме це показано на сайті сьогодні.</p>
  <p><span class="tier own">Порахували ми</span> &nbsp;Наш розрахунок: ціна за одиницю проти каталожної. Підключається наступним етапом.</p>
  <p>Нижчий рівень ніколи не подається як вищий.</p>
</div>

<div class="card">
  <h3>Про сторінки посадовців</h3>
  <p>Ім'я, пошта й телефон відповідальної особи взяті з картки закупівлі в Prozorro, де замовник сам їх публікує. Одну людину між закупівлями зіставлено за поштою, бо написання імені різниться.</p>
  <p>Сторінка посадовця показує, у скількох його закупівлях спрацювали державні індикатори і за якими нормами закону. <strong>Це не судимість і не встановлена вина.</strong></p>
</div>

<div class="card">
  <h3>Чому тут немає судимостей</h3>
  <p>Єдиний державний реєстр судових рішень закритий CAPTCHA, а в текстах кримінальних рішень імена замінені на «ОСОБА_1» відповідно до законодавства про захист персональних даних. Зіставити судимість із людиною за збігом прізвища неможливо надійно, а помилка тут — це звинувачення невинного.</p>
  <p>Тому система показує лише те, що можна довести: які ознаки державна система виявила в конкретних закупівлях конкретної особи.</p>
</div>

<div class="card">
  <h3>Чого система не робить</h3>
  <p>Вона не оголошує вину і не називає жодну фірму чи людину злочинцем. Вона показує ознаки ризику, які потребують перевірки, і завжди дає посилання на першоджерело, щоб висновок можна було перевірити вручну.</p>
</div>
`,
  });
}

export function notFound(): string {
  return layout({
    title: "Не знайдено",
    body: `<h1>Не знайдено</h1><p class="sub">Такої сторінки немає. <a href="/">До переліку знахідок →</a></p>`,
  });
}
