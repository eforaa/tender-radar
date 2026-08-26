import { RAILWAY_EDRPOU } from "../../src/config.ts";
import { layout, shortMoney } from "../html.ts";
import { type Case } from "../data.ts";
import { readControls, applyControls } from "../controls.ts";
import { dataset } from "../context.ts";
import { presetBar, sortBar, filterPanel, listBody } from "../components/filters.ts";

/* ---------- our own price findings ---------- */

export function pricesPage(url: URL): string {
  const withFindings = dataset().cases.filter((c) => c.findings.length > 0);
  const gapOf = (c: Case) =>
    c.findings.reduce((total, f) => {
      const e = f.evidence as { overpayment?: number; extra_cost?: number };
      return total + (e.overpayment ?? e.extra_cost ?? 0);
    }, 0);

  const totalGap = withFindings.reduce((t, c) => t + gapOf(c), 0);
  const peer = withFindings.filter((c) => c.findings.some((f) => f.detector_key === "peer_price")).length;
  const growth = withFindings.filter((c) => c.findings.some((f) => f.detector_key === "own_price_growth")).length;

  // Every tender here already has a price finding, so that checkbox is moot.
  const c = readControls(url);
  const list = applyControls(withFindings, c, RAILWAY_EDRPOU, { hidePrice: true });

  return layout({
    title: "Завищені ціни",
    nav: "prices",
    body: `
<h1>Де ціна виглядає завищеною</h1>
<p class="sub">Рахуємо самі: ціна за одиницю проти інших закупівель і проти минулих цін цього замовника.</p>

<p class="statline">
  <b>${withFindings.length}</b> закупівель із завищеною ціною ·
  <b>${shortMoney(totalGap)}</b> різниця проти звичайної ціни ·
  <b>${peer}</b> дорожче, ніж в інших ·
  <b>${growth}</b> дорожче, ніж було торік
</p>

<details class="help">
  <summary>Як ми це рахуємо</summary>
  <div class="inner">
    <p>Спочатку рахуємо <strong>ціну за одиницю</strong>: суму договору ділимо на кількість. Наприклад, 4 млн грн за 200 холодильників — це 20 тисяч за штуку.</p>
    <p>Далі шукаємо, за скільки те саме купували інші, і беремо середину. Якщо ціна помітно вища за середину — показуємо.</p>
    <p>Окремо порівнюємо замовника з ним самим: скільки він платив за це раніше. Тут місцеві умови однакові, тож стрибок ціни складніше пояснити.</p>
    <p><strong>Ми мовчимо, коли порівняти чесно не можна.</strong> Ремонти й послуги не порівнюємо — кожен об'єкт свій. Не порівнюємо й товари всередині надто широкого коду: під одним кодом можуть бути і прокладка за 400 грн, і редуктор за мільйон.</p>
  </div>
</details>

${presetBar("/prices", url, c)}
${sortBar("/prices", c)}
${filterPanel("/prices", c, { hidePrice: true })}

${listBody(list, c, "/prices")}

<p class="note">Різниця в ціні — це ще не порушення. Вона може мати пояснення: інші умови постачання, інший час, інша якість. Наше завдання — показати, де це пояснення варто запитати.</p>
`,
  });
}
