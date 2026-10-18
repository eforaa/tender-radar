import type { DocumentResult } from "../documents/types.ts";
import type { TenderItemRow, FindingRow } from "../store/types.ts";
import type { MarketPrice } from "./market-price.ts";

export type DocumentPriceCheck = {
  tender_id: string; document_key: string; document_title: string; document_url: string; source_sha256?: string;
  item_id: string; description: string; status: "insufficient" | "limited" | "compared" | "signal"; reasons: string[];
  checked_at: string; quotes: DocumentResult["claims"]; locator_kind: "page" | "fragment";
  unit?: string; unit_price?: number; quantity?: number; vat?: boolean; reference?: MarketPrice;
  difference_per_unit?: number; comparison_difference?: number; difference_percent?: number;
  document_unit_price?: number; normalization?: string; contract_url?: string;
};
export type ContractPriceContext = { tender_id: string; contract_id: string; contract: {
  status?: string; documents?: { id: string }[]; value?: { amount?: number; amountNet?: number; currency?: string; valueAddedTaxIncluded?: boolean };
  items?: { id: string; product?: string; quantity?: number; classification?: { id: string }; unit?: { code: string; value?: { amount?: number; currency?: string; valueAddedTaxIncluded?: boolean } } }[];
} };
const normalized = (s: string) => s.normalize("NFKC").toLocaleLowerCase("uk-UA").replace(/\s+/g, " ").trim();
export function priceNumber(value: string, corroboratedDecimal = false): number | null {
  const v = value.trim().replace(/[\u00a0\u202f]/g, " ");
  if (!/^(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d{1,6})?$/.test(v) || (!corroboratedDecimal && /^\d+[.,]\d{3}$/.test(v))) return null;
  const n = Number(v.replace(/ /g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function priceUnit(value: string): string | null {
  const aliases: Record<string, string> = { кг: "KGM", кілограм: "KGM", кілограмів: "KGM", т: "TNE", тонна: "TNE", м: "MTR", метр: "MTR", метрів: "MTR", м2: "MTK", "м²": "MTK", м3: "MTQ", "м³": "MTQ", л: "LTR", літр: "LTR", літрів: "LTR", шт: "H87", "шт.": "H87", штука: "H87", штук: "H87", "квт·год": "KWH", "квт*год": "KWH", "кіловат-година": "KWH" };
  const v = normalized(value);
  return ["KGM", "TNE", "MTR", "MTK", "MTQ", "LTR", "H87", "KWH"].includes(value.toUpperCase()) ? value.toUpperCase() : aliases[v] ?? null;
}
function vatValue(v: string): boolean | null {
  const s = normalized(v), without = /без\s+пдв|не\s+включає\s+пдв/.test(s), withVat = /(?:^|\s)(?:з|із|включаючи)\s+пдв|пдв\s+включено/.test(s);
  return without === withVat ? null : withVat;
}
function numericQuoteContains(quote: string, n: number): boolean {
  const tokens = quote.match(/(?<![\p{L}\p{N}])\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?(?![\p{L}\p{N}])/gu) ?? [];
  return tokens.some(s => priceNumber(s, true) === n);
}

export function compareDocumentPrices(documents: DocumentResult[], items: TenderItemRow[], market: MarketPrice[], now: string, contracts: ContractPriceContext[] = []): DocumentPriceCheck[] {
  const checks: DocumentPriceCheck[] = [];
  // Keep only the newest extracted version of a document; never add its old and new prices together.
  const latest = new Map<string, DocumentResult>();
  for (const d of documents) { const k = d.tender_id + "|" + d.document.id; const old = latest.get(k); if (!old || d.document.modified > old.document.modified || (d.document.modified === old.document.modified && d.updated_at > old.updated_at)) latest.set(k, d); }
  for (const d of latest.values()) {
    if (d.status !== "ready" && d.status !== "partial") continue;
    const ids = [...new Set(d.claims.filter(c => c.field === "unit_price").map(c => c.item_id))];
    for (const id of ids) {
      const claims = d.claims.filter(c => c.item_id === id);
      const one = (field: string) => { const matches = claims.filter(c => c.field === field); return matches.length === 1 ? matches[0] : undefined; };
      const desc = one("description"), price = one("unit_price"), qty = one("quantity"), unit = one("unit"), currency = one("currency"), vat = one("vat");
      const contexts = contracts.filter(c => c.tender_id === d.tender_id && c.contract.status === "active" && c.contract.documents?.some(doc => doc.id === d.document.id));
      const context = contexts.length === 1 ? contexts[0] : undefined;
      const currencyFromContract = !currency && context?.contract.value?.currency === "UAH" && !/USD|EUR|\$|€/.test(price?.quote ?? "");
      const r: DocumentPriceCheck = { tender_id: d.tender_id, document_key: d.key, document_title: d.document.title, document_url: d.document.url, source_sha256: d.source_sha256, item_id: id, description: desc?.value ?? `Позиція ${id}`, status: "insufficient", reasons: [], checked_at: now, quotes: claims, locator_kind: d.locator_kind ?? "page" };
      checks.push(r);
      const missing = [[desc, "назви"], [price, "ціни одиниці"], [qty, "кількості"], [unit, "одиниці"], [currency || currencyFromContract, "валюти"], [vat, "ПДВ"]].filter(([claim]) => !claim).map(([, label]) => label);
      if (missing.length) r.reasons.push(`Бракує однозначних даних: ${missing.join(", ")}.`);
      if (claims.some(c => !c.quote.includes(c.value))) r.reasons.push("Значення не підтверджене цитатою.");
      if (r.reasons.length) continue;
      const q = priceNumber(qty!.value), u = priceUnit(unit!.value), tax = vatValue(vat!.value);
      const single = context?.contract.items?.length === 1 ? context.contract.items[0] : undefined;
      const close = (a: number | undefined, b: number) => typeof a === "number" && Number.isFinite(a) && Math.abs(a - b) < 0.011;
      let p = priceNumber(price!.value);
      const decimal = priceNumber(price!.value, true);
      if (p === null && decimal !== null && q !== null && single?.quantity === q && context?.contract.value?.valueAddedTaxIncluded === tax && close(context.contract.value.amount, decimal * q)) p = decimal;
      if (p === null || q === null || !u || tax === null || (!currencyFromContract && !/^(uah|грн\.?|гривня|гривень)$/i.test(currency!.value.trim()))) { r.reasons.push("Неоднозначний формат числа, одиниці, валюти чи ПДВ; автоматично не конвертуємо."); continue; }
      if (!numericQuoteContains(price!.quote, q) || !numericQuoteContains(price!.quote, p) || price!.page !== qty!.page) { r.reasons.push("Ціну та кількість не підтверджено спільним рядком документа."); continue; }
      const linked = items.filter(i => i.tender_id === d.tender_id && normalized(i.description ?? "") === normalized(desc!.value) && i.unit_code === u);
      const cpvs = new Set(linked.map(i => i.cpv_code).filter(Boolean));
      if (cpvs.size !== 1) { r.reasons.push("Не вдалося однозначно зіставити позицію документа з предметом закупівлі та кодом ДК."); continue; }
      const contractItem = context?.contract.items?.find(i => linked.some(l => l.item_id === i.id)) ?? (linked.length === 1 ? single : undefined);
      const verifiedItem = contractItem?.quantity === q && contractItem.unit?.code === u && contractItem.classification?.id === [...cpvs][0] ? contractItem : undefined;
      r.document_unit_price = p; r.unit_price = p; r.quantity = q; r.unit = u; r.vat = tax;
      if (context) r.contract_url = `https://public-api.prozorro.gov.ua/api/2.5/contracts/${encodeURIComponent(context.contract_id)}`;
      if (currencyFromContract) r.reasons.push("Валюта UAH підтверджена API цього договору.");
      const variants = [{ price: p, vat: tax, normalization: "" }];
      const net = verifiedItem?.unit?.value;
      if (single && verifiedItem === single && tax && context?.contract.value?.valueAddedTaxIncluded && net?.currency === "UAH" && net.valueAddedTaxIncluded === false && typeof net.amount === "number" && net.amount > 0 && close(context.contract.value.amount, p * q) && close(context.contract.value.amountNet, net.amount * q))
        variants.push({ price: net.amount, vat: false, normalization: "Для порівняння використано ціну без ПДВ з API позиції договору; кількість, загальна сума та сума без ПДВ звірені з ціною документа. Ставку податку не припускали." });
      const matching = market.filter(m => m.cpv === [...cpvs][0] && (verifiedItem?.product ? m.product_id === verifiedItem.product : normalized(m.title) === normalized(desc!.value)) && m.unit === u && m.currency === "UAH" && variants.some(v => v.vat === m.vat) && m.sample_size >= 1 &&
        Date.parse(now) >= Date.parse(m.date) && Date.parse(now) - Date.parse(m.date) <= 30 * 86400000 &&
        [m.lower, m.median, m.upper].every(n => Number.isFinite(n) && n > 0) && m.lower <= m.median && m.median <= m.upper);
      if (new Set(matching.map(m => m.product_id)).size !== 1) { r.reasons.push("Немає єдиного актуального товару Prozorro Market з тією ж назвою, кодом, одиницею і ПДВ та доступними ціновими спостереженнями."); continue; }
      const reference = matching.sort((a, b) => b.date.localeCompare(a.date))[0];
      const variant = variants.find(v => v.vat === reference.vat)!;
      r.unit_price = variant.price; r.vat = variant.vat; r.normalization = variant.normalization;
      const delta = variant.price - reference.median, total = delta * q;
      if (!Number.isFinite(total) || Math.abs(total) > Number.MAX_SAFE_INTEGER / 100) { r.reasons.push("Розрахунок виходить за допустимі числові межі."); continue; }
      r.reference = reference; r.difference_per_unit = Math.round(delta * 100) / 100; r.comparison_difference = Math.round(total * 100) / 100;
      r.difference_percent = Math.round((variant.price / reference.median - 1) * 10000) / 100;
      r.status = reference.sample_size < 5 ? "limited" : variant.price >= reference.upper * 1.5 ? "signal" : "compared";
      if (reference.sample_size < 5) r.reasons.push(`Лише ${reference.sample_size} спостереження: показуємо арифметику, але автоматичний сигнал за такою вибіркою заборонено.`);
      if (variant.normalization) r.reasons.push(variant.normalization);
      r.reasons.push("Порівняння з поточним орієнтиром каталогу, не оцінка на дату договору. Перевірте комплектацію, доставку, оплату й обсяг.");
      if (d.status === "partial") r.reasons.push("Документ опрацьовано частково: перевірте решту сторінок.");
      if (claims.some(c => c.method === "ocr")) r.reasons.push("Ціну витягнуто зі скану: звірте цифри з оригіналом.");
    }
  }
  return checks;
}

export function documentPriceFindings(checks: DocumentPriceCheck[]): FindingRow[] {
  return checks.filter(r => r.status === "signal").map(r => ({ tender_id: r.tender_id, detector_key: "document_market_price", tier: "own_analysis", severity: "low",
    title: `Можливе завищення ціни з документа: ${r.description}`,
    explanation: `Ціна ${r.unit_price} ₴/${r.unit} проти поточної медіани ${r.reference!.median} ₴. Різниця для ${r.quantity} одиниць — ${r.comparison_difference} ₴ (${r.difference_percent}%). Це кандидат для перевірки, не встановлений збиток. ${r.reasons.join(" ")}`,
    evidence: { unit_price: r.unit_price, quantity: r.quantity, unit_code: r.unit, market_median: r.reference!.median, market_upper: r.reference!.upper,
      comparison_difference: r.comparison_difference, difference_percent: r.difference_percent, source_url: r.reference!.source_url, product_url: r.reference!.product_url,
      reference_date: r.reference!.date, sample_size: r.reference!.sample_size, document_url: r.document_url, document_key: r.document_key, item_id: r.item_id,
      source_sha256: r.source_sha256, document_unit_price: r.document_unit_price, contract_url: r.contract_url, normalization: r.normalization, vat: r.vat, quotes: r.quotes, requires_review: true, date_basis: "current_market", comparison_version: 1 }, created_at: r.checked_at }));
}
