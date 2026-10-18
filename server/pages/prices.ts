import { RAILWAY_EDRPOU } from "../../src/config.ts";
import { layout, shortMoney } from "../html.ts";
import { type Case } from "../data.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { controlBar, listBody } from "../components/filters.ts";

/* ---------- our own price findings ---------- */

export function pricesPage(url: URL): string {
  const withFindings = dataset().cases.filter((c) => c.findings.length > 0);
  const gapOf = (c: Case) =>
    c.findings.reduce((total, f) => {
      const e = f.evidence as { overpayment?: number; extra_cost?: number };
      return Math.max(total, e.overpayment ?? e.extra_cost ?? 0);
    }, 0);

  const totalGap = withFindings.reduce((t, c) => t + gapOf(c), 0);
  const peer = withFindings.filter((c) => c.findings.some((f) => f.detector_key === "peer_price")).length;
  const growth = withFindings.filter((c) => c.findings.some((f) => f.detector_key === "own_price_growth")).length;
  const market = withFindings.filter(c => c.findings.some(f => f.detector_key === "market_price")).length;

  // Every tender here already has a price finding, so that checkbox is moot.
  const c = readControls(url);
  const list = applyControls(withFindings, c, RAILWAY_EDRPOU, { hidePrice: true });

  return layout({
    title: "Перевірка цін",
    nav: "prices",
    body: `
<h1>Де ціна виглядає завищеною</h1>
<p class="sub">Порівнюємо з попередніми закупівлями та статистикою Prozorro Market. Кожен сигнал потребує перевірки умов.</p>

<p class="statline">
  <b>${withFindings.length}</b> закупівель для перевірки ·
  <b>${shortMoney(totalGap)}</b> різниця з іншими закупівлями ·
  <b>${peer}</b> дорожче, ніж в інших ·
  <b>${growth}</b> дорожче за попередню закупівлю ·
  <b>${market}</b> сигнали каталогу
</p>

<details class="help">
  <summary>Як ми це рахуємо</summary>
  <div class="inner">
    <p>Рахуємо ціну одиниці лише для закупівлі з однією позицією та одним активним рішенням про переможця. Очікуваний бюджет не використовуємо.</p>
    <p>Далі шукаємо, за скільки те саме купували інші, і беремо середину. Якщо ціна помітно вища за середину — показуємо.</p>
    <p>Для попередніх закупівель перевіряємо дату, однаковий опис, одиницю, валюту та ПДВ. Для каталогу потрібна однозначна відповідність назви та ціна не пізніше закупівлі, давністю до 30 днів, із вибірки щонайменше 5 спостережень. Доставка, комплектація й умови оплати потребують окремої перевірки.</p>
    <p><strong>Ми мовчимо, коли порівняти чесно не можна.</strong> Ремонти й послуги не порівнюємо — кожен об'єкт свій. Не порівнюємо й товари всередині надто широкого коду: під одним кодом можуть бути і прокладка за 400 грн, і редуктор за мільйон.</p>
  </div>
</details>

${controlBar("/prices", c, { hidePrice: true }, { url })}

${listBody(list, c, "/prices")}

<p class="note">Різниця в ціні — це ще не порушення. Вона може мати пояснення: інші умови постачання, інший час, інша якість. Наше завдання — показати, де це пояснення варто запитати.</p>
`,
  });
}
