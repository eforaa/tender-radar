import { MONITORING_REASONS, VIOLATION_TYPES, readableName } from "../../src/labels.ts";
import { esc, date, trim, shortMoney, plural } from "../html.ts";
import { type Case } from "../data.ts";
import { isStarred, type FavKind } from "../favourites.ts";
import { starredList } from "../context.ts";
import { riskFlag, shortRisk, rankRisks } from "./risk.ts";

/** Chips beyond this crowd the row; the rest are one click away. */
const MAX_ROW_FLAGS = 3;

/**
 * A cheap severity for list rows. The full conclusion is too heavy to build
 * for 36000 rows, so this uses the same signals it leans on most.
 */
export function rowSeverity(entry: Case): "proven" | "high" | "medium" | "clear" | "low" {
  // An established violation outranks anything we inferred ourselves. A clean
  // audit does not cancel a price finding: the auditors check the procedure,
  // not what the thing cost.
  if (entry.audit?.violation) return "proven";
  if (entry.findings.length > 0) return "high";
  if (entry.audit && !entry.audit.violation) return "clear";
  if (entry.bidders === 1 || entry.risks.length >= 3) return "medium";
  return "low";
}

/**
 * The one-line signal the phone shows in place of the full chip list. A proven
 * violation is the whole story; otherwise it is a count and the single most
 * common risk, short — the detail lives on the tender page behind a tap.
 */
export function signalLine(entry: Case): string {
  if (entry.audit?.violation) return "Порушення доведено";
  const n = entry.risks.length;
  if (n === 0) return "";
  const topRisk = rankRisks([entry])[0]?.[0] ?? entry.risks[0];
  const count = `${n} ${plural(n, "ознака", "ознаки", "ознак")}`;
  return `${count} · ${esc(shortRisk(topRisk))}`;
}

const SEVERITY_TITLE: Record<string, string> = {
  proven: "Держаудитслужба встановила порушення",
  high: "Ми знайшли розбіжність у ціні",
  medium: "Є на що подивитися: без конкурентів або кілька ознак",
  clear: "Держаудитслужба перевірила і порушень не встановила",
  low: "Позначено державою",
};

/**
 * What the auditors concluded, in full. This is the only block on a tender
 * page that is not our reading of anything: the wording is theirs and the
 * link goes to the record it came from.
 */
export function auditSection(entry: Case): string {
  const audit = entry.audit;
  if (!audit) return "";

  const grounds = audit.reasons.map((r) => MONITORING_REASONS[r] ?? r);
  const kinds = audit.types.map((t) => VIOLATION_TYPES[t] ?? t);
  const facts: string[] = [];
  if (grounds.length) facts.push(`<dt>Підстава перевірки</dt><dd>${esc(grounds.join(", "))}</dd>`);
  if (kinds.length) facts.push(`<dt>Тип порушення</dt><dd>${esc(kinds.join(", "))}</dd>`);
  if (audit.published) facts.push(`<dt>Висновок оприлюднено</dt><dd>${date(audit.published)}</dd>`);
  if (audit.count > 1) facts.push(`<dt>Моніторингів</dt><dd>${audit.count}</dd>`);

  return `
<h2>Висновок Держаудитслужби</h2>
<div class="card verdict ${audit.violation ? "high" : "low"}">
  <span class="verdict-tag">${audit.violation ? "Порушення встановлено" : "Порушень не встановлено"}</span>
  <p class="lead">${
    audit.violation
      ? "Орган державного фінансового контролю провів моніторинг цієї закупівлі та встановив порушення законодавства."
      : "Орган державного фінансового контролю провів моніторинг цієї закупівлі та порушень не встановив."
  }</p>
  ${audit.text ? `<p>«${esc(audit.text)}»</p>` : ""}
  ${facts.length ? `<dl class="facts">${facts.join("")}</dl>` : ""}
  <p class="note">Моніторинг перевіряє дотримання процедури закупівлі. Він не оцінює, чи ціна відповідає ринковій — це окреме питання, і відповідь на нього нижче.
  <br><a href="https://audit-api.prozorro.gov.ua/api/2.5/monitorings/${encodeURIComponent(audit.monitoring_id)}">Першоджерело висновку</a></p>
</div>
`;
}

/** The one-glance signals that make a case worth opening. */
/**
 * The verdict as a chip. This is the only badge on the site that can lower
 * suspicion rather than raise it, which is worth as much as the other kind:
 * a name cleared by the auditors should not sit under the same grey dot as
 * one nobody has looked at.
 */
export function auditFlag(entry: Case): string {
  if (!entry.audit) return "";
  return entry.audit.violation
    ? '<span class="flag proven">Порушення доведено</span>'
    : '<span class="flag clear">ДАСУ: без порушень</span>';
}

export function alarms(entry: Case): string[] {
  const out: string[] = [];
  // The monitoring already has its own chip; printing its title again would
  // say the same thing twice in the same row.
  for (const finding of entry.findings) {
    if (finding.tier === "confirmed") continue;
    out.push(finding.title);
  }
  if (entry.detailed && entry.bidders === 1) out.push("Єдиний учасник");
  if ((entry.value_amount ?? 0) >= 1e9) out.push("Понад мільярд");
  if (entry.risks.length >= 3) out.push(`${entry.risks.length} індикатори одразу`);
  return out;
}

/**
 * The star toggle. A plain form, so the site still needs no scripts.
 * `back` is where the visitor returns after the POST.
 */
export function star(kind: FavKind, id: string, back: string, opts: { label?: boolean } = {}): string {
  if (!id) return "";
  const on = isStarred(starredList(), kind, id);
  const title = on ? "Прибрати з обраного" : "Додати до обраного";
  return `<form class="star-form" method="post" action="/starred/toggle">
  <input type="hidden" name="kind" value="${esc(kind)}">
  <input type="hidden" name="id" value="${esc(id)}">
  <input type="hidden" name="back" value="${esc(back)}">
  <button type="submit" class="star${on ? " on" : ""}" title="${title}" aria-label="${title}" aria-pressed="${on}">${on ? "★" : "☆"}${opts.label ? `<span>${on ? "В обраному" : "До обраного"}</span>` : ""}</button>
</form>`;
}

export function caseRow(entry: Case, opts: { showOfficer?: boolean; showEntity?: boolean } = {}): string {
  const showOfficer = opts.showOfficer ?? true;
  const showEntity = opts.showEntity ?? true;

  // Tenders without a full card have no title of their own. Falling back to
  // the buyer's name printed it twice: once as the heading, once in the meta.
  const buyer = readableName(entry.entity_name);
  const hasOwnTitle = Boolean(entry.title);
  const title = hasOwnTitle ? trim(entry.title as string, 110) : buyer || "Закупівля";

  const meta: string[] = [];
  if (showEntity && buyer && hasOwnTitle) {
    meta.push(`<a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(buyer)}</a>`);
  }
  if (entry.region) meta.push(esc(entry.region));
  if (entry.tender_date) meta.push(date(entry.tender_date));

  const people: string[] = [];
  if (showOfficer && entry.officer_name) {
    people.push(`вів(ла) <a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a>`);
  }
  if (entry.winner_name) {
    people.push(
      `виграв <a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a>`,
    );
  }

  const severity = rowSeverity(entry);

  return `<div class="row sev-${severity}">
  <span class="dot" title="${esc(SEVERITY_TITLE[severity])}" aria-label="${esc(SEVERITY_TITLE[severity])}"></span>
  <div class="who">
    <div class="name">${star("tender", entry.tender_id, "/tender/" + encodeURIComponent(entry.tender_id))}<a href="/tender/${encodeURIComponent(entry.tender_id)}">${esc(title)}</a></div>
    <div class="meta">${meta.join(" · ")}</div>
    ${people.length ? `<div class="meta">${people.join(" · ")}</div>` : ""}
  </div>
  <div class="amount">
    <span class="big">${shortMoney(entry.value_amount)}</span>
    <span class="exact">${esc(entry.tender_ref || entry.tender_id)}</span>
  </div>
  <div class="flags">
    ${auditFlag(entry)}
    ${alarms(entry).map((a) => `<span class="flag alarm">${esc(a)}</span>`).join("")}
    ${entry.risks.slice(0, MAX_ROW_FLAGS).map(riskFlag).join("")}
    ${
      entry.risks.length > MAX_ROW_FLAGS
        ? `<a class="flag more" href="/tender/${encodeURIComponent(entry.tender_id)}">ще ${entry.risks.length - MAX_ROW_FLAGS}</a>`
        : ""
    }
  </div>
  <div class="signal">${signalLine(entry)}</div>
</div>`;
}
