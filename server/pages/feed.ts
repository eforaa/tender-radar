import { REGION, RAILWAY_EDRPOU } from "../../src/config.ts";
import { layout, esc, shortMoney } from "../html.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { riskCard } from "../components/risk.ts";
import { controlBar, listBody } from "../components/filters.ts";

const HELP = `<details class="help">
  <summary>Як читати цю сторінку</summary>
  <div class="inner">
    <p>Кожен рядок — це закупівля, у якій спрацював індикатор державної системи моніторингу. Держава сама позначає такі закупівлі; ми лише збираємо позначки по ${esc(REGION)} та філіях залізниці й показуємо їх зрозуміло.</p>
    <p>Червоні позначки — те, на що варто глянути першим: єдиний учасник на великих торгах, сума понад мільярд, кілька індикаторів одразу.</p>
    <p>Сірі позначки — що саме запідозрила держава. Натисніть на будь-яку, щоб побачити всі закупівлі з тією самою ознакою.</p>
    <p><strong>Позначка не означає, що встановлено порушення.</strong> Це підстава відкрити закупівлю й перевірити її людиною.</p>
  </div>
</details>`;

/** One compact line, not a panel: a newcomer needs it once, a returning
 *  reader needs the screen. The detail lives behind the link. */
const PRIMER = `<div class="primer">
  <span><b>1</b> держава позначає підозрілі</span>
  <span><b>2</b> ми пояснюємо і рахуємо ціну</span>
  <span><b>3</b> у кожній — висновок і звіт</span>
  <a href="/about">Докладніше</a>
</div>`;

export function feedPage(url: URL): string {
  const c = readControls(url);
  const list = applyControls(dataset().cases, c, RAILWAY_EDRPOU);

  return layout({
    title: "Закупівлі",
    nav: "feed",
    body: `
<h1>Закупівлі, які варто перевірити</h1>
<p class="sub">Публічні закупівлі всієї України, які держава позначила як підозрілі.</p>

<p class="statline">
  <b>${dataset().cases.length.toLocaleString("uk-UA")}</b> закупівель ·
  <b>${shortMoney(dataset().totalValue)}</b> ·
  <b>${dataset().flagCount.toLocaleString("uk-UA")}</b> ознак ·
  <b>${dataset().findingCount.toLocaleString("uk-UA")}</b> переплат
</p>

${PRIMER}

${controlBar("/", c, {}, { url })}

${c.risk ? riskCard(c.risk) : ""}

${listBody(list, c, "/")}

<p class="note">Позначка означає, що спрацював індикатор державної системи моніторингу закупівель. Це ознака ризику, яка потребує перевірки, а не встановлений факт порушення.</p>
`,
  });
}
