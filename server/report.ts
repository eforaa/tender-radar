// The downloadable dossier for one tender: everything the site knows, in one
// document. Two forms of the same content — plain text for saving and pasting
// into a case file, and a print-styled page the browser turns into a PDF.
//
// A real PDF writer would mean a dependency and an embedded Cyrillic font.
// The browser already has both, so printing is the honest shortcut: the output
// is a genuine PDF, selectable and searchable, with no library to keep alive.
import type { Case } from "./data.ts";
import type { RiskRuleRow } from "../src/store/types.ts";
import { RISK_LABELS, procedureLabel, readableName, MONITORING_REASONS, VIOLATION_TYPES } from "../src/labels.ts";
import { INDICATOR_LEGAL, ARTICLES } from "../src/legal.ts";
import { esc, shortDate } from "./html.ts";
import { buildConclusion, type Conclusion } from "./conclusion.ts";
import { buildQualification } from "./qualification.ts";

export type ReportContext = {
  entry: Case;
  rules: Map<string, RiskRuleRow>;
  /** Other tenders sharing the buyer, the official or the winner. */
  sameEntity: number;
  sameOfficer: number;
  sameWinner: number;
  /** The system's own reading, so the file carries the same verdict as the page. */
  conclusion: Conclusion;
  generatedAt: string;
};

/** Plain text must not carry non-breaking spaces — they survive a copy-paste
 *  into a case file as invisible junk. */
function plainNumber(n: number, digits = 2): string {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: digits }).format(n).replace(/ /g, " ");
}

function money(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  return plainNumber(amount) + " грн";
}

const day = shortDate;

function wrap(text: string, width = 78, indent = "  "): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width) {
      lines.push(indent + line.trim());
      line = word;
    } else {
      line += " " + word;
    }
  }
  if (line.trim()) lines.push(indent + line.trim());
  return lines.join("\n");
}

/** Everything we can say about one tender, as an ordered list of sections. */
function sections(ctx: ReportContext): { heading: string; lines: string[] }[] {
  const { entry, rules } = ctx;
  const out: { heading: string; lines: string[] }[] = [];

  const verdict = ctx.conclusion;
  out.push({
    heading: "ВИСНОВОК СИСТЕМИ",
    lines: [
      verdict.headline,
      "",
      ...(verdict.observations.length > 0
        ? verdict.observations.flatMap((o, i) => [`${i + 1}. ${o.title}`, wrap(o.detail), ""])
        : [
            wrap(
              "Державна система позначила цю закупівлю, але наші власні перевірки — ціна проти ринку, " +
                "конкуренція, повторюваність зв'язків — нічого додаткового не показали.",
            ),
            "",
          ]),
      "Що перевірити далі:",
      ...verdict.nextSteps.map((step) => wrap(`— ${step}`)),
      "",
      wrap(
        "Цей висновок склала система з чисел, наведених нижче. Він не встановлює порушення " +
          "і не є кваліфікацією дій будь-якої особи.",
      ),
    ],
  });

  out.push({
    heading: "ЗАКУПІВЛЯ",
    lines: [
      `Назва: ${entry.title ?? "—"}`,
      `Номер: ${entry.tender_ref || entry.tender_id}`,
      `Дата закупівлі: ${day(entry.tender_date)}`,
      `Дата позначки держави: ${day(entry.date_assessed)}`,
      `Сума: ${money(entry.value_amount)}`,
      `Регіон: ${entry.region ?? "—"}`,
      entry.method ? `Процедура: ${procedureLabel(entry.method) ?? entry.method}` : "",
      entry.detailed ? `Учасників: ${entry.bidders === 1 ? "один — конкуренції не було" : entry.bidders || "—"}` : "",
      `Першоджерело: https://prozorro.gov.ua/tender/${entry.tender_ref}`,
    ].filter(Boolean),
  });

  out.push({
    heading: "ЗАМОВНИК",
    lines: [
      `Назва: ${readableName(entry.entity_name)}`,
      `ЄДРПОУ: ${entry.entity_edrpou ?? "—"}`,
      `Усього закупівель із позначками: ${ctx.sameEntity}`,
    ],
  });

  if (entry.officer_name) {
    out.push({
      heading: "ВІДПОВІДАЛЬНА ОСОБА",
      lines: [
        `Ім'я: ${entry.officer_name}`,
        `Пошта: ${entry.officer_email ?? "—"}`,
        `Телефон: ${entry.officer_phone ?? "—"}`,
        `Закупівель із позначками, де вказана відповідальною: ${ctx.sameOfficer}`,
        "",
        wrap(
          "Дані взято з картки закупівлі в Prozorro, де замовник сам публікує контактну особу. " +
            "Це не твердження про правопорушення з боку названої особи.",
        ),
      ],
    });
  }

  if (entry.winner_name) {
    out.push({
      heading: "ПЕРЕМОЖЕЦЬ",
      lines: [
        `Назва: ${readableName(entry.winner_name)}`,
        `ЄДРПОУ: ${entry.winner_edrpou ?? "—"}`,
        `Сума договору: ${money(entry.winner_amount)}`,
        `Перемог у закупівлях із позначками: ${ctx.sameWinner}`,
      ],
    });
  }

  const indicatorLines: string[] = [];
  for (const riskId of entry.risks) {
    const rule = rules.get(riskId);
    const label = RISK_LABELS[riskId];
    const legal = INDICATOR_LEGAL[riskId];

    indicatorLines.push(`[${riskId}] ${label?.short ?? rule?.name ?? riskId}`);
    if (label) indicatorLines.push(wrap(label.means));
    if (rule?.name) indicatorLines.push(wrap(`Офіційне формулювання: ${rule.name}`));

    const stateNorm = rule?.legitimateness?.trim();
    if (stateNorm) {
      indicatorLines.push(wrap(`Норма, яку наводить держава: ${stateNorm}`));
    } else if (legal?.norm) {
      indicatorLines.push(wrap(`Норма — зіставлення цієї системи: ${legal.norm}`));
      if (legal.normNote) indicatorLines.push(wrap(legal.normNote));
    } else {
      indicatorLines.push(wrap("Держава не наводить норму для цього індикатора."));
    }

    for (const direction of legal?.criminal ?? []) {
      const article = ARTICLES[direction.code];
      indicatorLines.push(wrap(`Стаття ${direction.code} ККУ — ${article?.title ?? ""}: ${direction.why}`));
    }
    indicatorLines.push("");
  }

  if (entry.audit) {
    const audit = entry.audit;
    const lines: string[] = [];
    lines.push(
      audit.violation
        ? "Орган державного фінансового контролю провів моніторинг цієї закупівлі та ВСТАНОВИВ ПОРУШЕННЯ законодавства про закупівлі."
        : "Орган державного фінансового контролю провів моніторинг цієї закупівлі та порушень НЕ ВСТАНОВИВ.",
    );
    lines.push("");
    if (audit.reasons.length > 0) {
      lines.push(`Підстава перевірки: ${audit.reasons.map((r) => MONITORING_REASONS[r] ?? r).join(", ")}`);
    }
    if (audit.types.length > 0) {
      lines.push(`Тип порушення: ${audit.types.map((t) => VIOLATION_TYPES[t] ?? t).join(", ")}`);
    }
    if (audit.published) lines.push(`Висновок оприлюднено: ${shortDate(audit.published)}`);
    if (audit.count > 1) lines.push(`Моніторингів за цією закупівлею: ${audit.count}`);
    if (audit.text) {
      lines.push("");
      lines.push("Формулювання висновку:");
      lines.push(wrap(audit.text));
    }
    lines.push("");
    lines.push(
      wrap(
        "Моніторинг перевіряє дотримання процедури закупівлі. Він не встановлює, чи ціна відповідає ринковій — це окреме питання.",
      ),
    );
    lines.push(`Першоджерело: https://audit-api.prozorro.gov.ua/api/2.5/monitorings/${audit.monitoring_id}`);

    out.push({
      heading: audit.violation ? "ВИСНОВОК ДЕРЖАУДИТСЛУЖБИ — ПОРУШЕННЯ ВСТАНОВЛЕНО" : "ВИСНОВОК ДЕРЖАУДИТСЛУЖБИ — ПОРУШЕНЬ НЕ ВСТАНОВЛЕНО",
      lines,
    });
  }

  out.push({
    heading: `ЩО ЗАПІДОЗРИЛА ДЕРЖАВА — ${entry.risks.length} ${entry.risks.length === 1 ? "ІНДИКАТОР" : "ІНДИКАТОРИ"}`,
    lines: indicatorLines,
  });

  if (entry.findings.length > 0) {
    const lines: string[] = [];
    for (const finding of entry.findings) {
      lines.push(`${finding.title}`);
      lines.push(wrap(finding.explanation));
      const e = finding.evidence as Record<string, unknown>;
      for (const [key, caption] of [
        ["unit_price", "Ціна за одиницю"],
        ["peer_median", "Типова ціна (медіана)"],
        ["peer_count", "Порівняно із закупівлями"],
        ["previous_price", "Попередня ціна цього замовника"],
        ["quantity", "Кількість"],
        ["overpayment", "Різниця на всю закупівлю"],
        ["extra_cost", "Різниця на всю закупівлю"],
      ] as const) {
        if (typeof e[key] === "number") lines.push(`  ${caption}: ${plainNumber(e[key] as number, 2)}`);
      }
      lines.push("");
    }
    out.push({ heading: "РОЗРАХУНОК ЦІНИ ЦІЄЮ СИСТЕМОЮ", lines });
  }

  const q = buildQualification(entry, rules);
  const legalLines: string[] = [wrap(q.caution), ""];

  legalLines.push("НОРМИ, ЯКІ ЗАЧЕПЛЕНІ", "");
  for (const n of q.norms) {
    legalLines.push(wrap(`${n.source === "state" ? "Норма, яку наводить держава" : "Норма — зіставлення цієї системи"}: ${n.norm}`));
    if (n.note) legalLines.push(wrap(n.note));
    legalLines.push(wrap(`Підстава: ${n.from.join("; ")}`), "");
  }

  if (q.consequences.length > 0) {
    legalLines.push("ЩО З ЦЬОГО ВИПЛИВАЄ ЗА ЗАКОНОМ ПРО ЗАКУПІВЛІ", "");
    for (const c of q.consequences) {
      legalLines.push(wrap(c.norm), wrap(c.effect), "");
    }
  }

  if (q.admin.length > 0) {
    legalLines.push("АДМІНІСТРАТИВНА ВІДПОВІДАЛЬНІСТЬ", "");
    for (const a of q.admin) {
      legalLines.push(
        wrap(`Стаття 164-14 КУпАП, ${a.part}: ${a.conduct}`),
        wrap(`Санкція: ${a.fine} на службових та уповноважених осіб замовника.`),
        wrap(`Підстава: ${a.from.join("; ")}`),
        "",
      );
    }
    legalLines.push(
      wrap("Розмір наведено в неоподатковуваних мінімумах доходів громадян; для штрафів ця одиниця становить 17 грн."),
      "",
    );
  }

  if (q.criminal.length > 0) {
    legalLines.push("КРИМІНАЛЬНО-ПРАВОВІ НАПРЯМИ", "");
    for (const c of q.criminal) {
      legalLines.push(`Стаття ${c.code} ККУ — ${c.title}`, wrap(c.summary));
      legalLines.push("  Чому цей напрям виникає саме тут:");
      for (const r of c.reasons) legalLines.push(wrap(`— ${r}`, 78, "    "));
      legalLines.push("  Що має бути доведено:");
      for (const e of c.elements) legalLines.push(wrap(`— ${e}`, 78, "    "));
      legalLines.push("  Які документи витребувати:");
      for (const e of c.evidence) legalLines.push(wrap(`— ${e}`, 78, "    "));
      legalLines.push("");
    }
  }

  out.push({ heading: "ПРАВОВА КВАЛІФІКАЦІЯ", lines: legalLines });

  out.push({
    heading: "МЕЖІ ЦЬОГО ЗВІТУ",
    lines: [
      wrap(
        "Позначка означає, що спрацював індикатор державної системи моніторингу закупівель. " +
          "Це ознака ризику, яка потребує перевірки, а не встановлений факт порушення.",
      ),
      "",
      wrap(
        "Посилання на статті Кримінального кодексу наведені як напрями перевірки для юриста. " +
          "Це не кваліфікація дій будь-якої особи. Умисел і завідомість встановлює виключно суд.",
      ),
      "",
      wrap("Наступний крок — витребувати самі документи закупівлі та перевірити їх."),
    ],
  });

  return out;
}

/** The plain-text file. */
export function reportText(ctx: ReportContext): string {
  const title = ctx.entry.title ?? ctx.entry.tender_ref;
  const head = [
    "TENDER RADAR — ЗВІТ ПО ЗАКУПІВЛІ",
    "=".repeat(78),
    wrap(title, 78, ""),
    `Сформовано: ${day(ctx.generatedAt)}`,
    "=".repeat(78),
    "",
  ];

  const body = sections(ctx).flatMap((section) => [section.heading, "-".repeat(78), ...section.lines, ""]);

  return [...head, ...body].join("\n");
}

/** The print-styled page; the browser's own print dialog produces the PDF. */
export function reportHtml(ctx: ReportContext): string {
  const { entry } = ctx;
  const title = entry.title ?? entry.tender_ref;

  const body = sections(ctx)
    .map(
      (section) => `<section>
  <h2>${esc(section.heading)}</h2>
  ${section.lines
    .filter((l) => l.trim())
    .map((line) => `<p>${esc(line.trim())}</p>`)
    .join("")}
</section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Звіт — ${esc(entry.tender_ref)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ysabeau:wght@300..800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{
    color-scheme:light;
    /* Same scale as the site (server/html.ts) — kept local rather than shared
       because this document has no import path back to that stylesheet. */
    --s1:.25rem; --s2:.5rem; --s3:.75rem; --s4:1rem;
    --s5:1.5rem; --s6:2rem;  --s7:3rem;   --s8:4rem;
    --paper:#FCFCFA; --ink:#14181A; --soft:#565B60; --line:#E4E3DD; --accent:#0F5C8C;
    --f-body:"Ysabeau","Segoe UI",system-ui,sans-serif;
    --f-mono:"IBM Plex Mono",Consolas,monospace;
  }
  *{box-sizing:border-box}
  /* One voice on screen, same as the site. On paper it doesn't matter — the
     print rule below forces plain white regardless of this token. */
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.6}
  .sheet{max-width:52rem;margin:0 auto;background:#fff;padding:var(--s7) var(--s7) var(--s8);min-height:100vh}
  .toolbar{max-width:52rem;margin:var(--s4) auto 0;padding:0 var(--s7);display:flex;gap:var(--s3);flex-wrap:wrap}
  .toolbar a,.toolbar button{font:inherit;font-size:.92rem;text-decoration:none;color:var(--accent);background:#fff;border:1px solid var(--line);border-radius:5px;padding:var(--s2) var(--s4);cursor:pointer}
  .toolbar a:hover,.toolbar button:hover{border-color:var(--accent)}
  /* No serif on paper either: a second voice here would be the same
     inconsistency the site just dropped. Weight and size still carry the
     hierarchy, same as the site's own h2. */
  h1{font-family:var(--f-body);font-weight:700;font-size:1.5rem;line-height:1.25;margin:0 0 var(--s2)}
  .ref{font-family:var(--f-mono);font-size:.85rem;color:var(--soft)}
  .made{color:var(--soft);font-size:.85rem;margin:var(--s1) 0 var(--s5);padding-bottom:var(--s4);border-bottom:2px solid var(--ink)}
  section{margin:0 0 var(--s5);break-inside:avoid}
  h2{font-family:var(--f-body);font-weight:700;font-size:1rem;letter-spacing:.04em;margin:0 0 var(--s2);padding-bottom:var(--s1);border-bottom:1px solid var(--line)}
  p{margin:0 0 var(--s2);max-width:64ch}
  /* The page a person actually holds: plain black text on white, no tint,
     no brand background — paper is not a screen and shouldn't try to look
     like one. */
  @media print{
    body{background:#fff;font-size:11pt}
    .toolbar{display:none}
    .sheet{max-width:none;padding:0;min-height:0}
    @page{margin:18mm}
  }
</style>
</head>
<body>
<div class="toolbar">
  <a href="/tender/${encodeURIComponent(entry.tender_id)}">← до закупівлі</a>
  <button type="button" onclick="window.print()">Друк або збереження у PDF</button>
  <a href="/tender/${encodeURIComponent(entry.tender_id)}/report.txt">Завантажити текстом</a>
</div>
<div class="sheet">
  <h1>${esc(title)}</h1>
  <div class="ref">${esc(entry.tender_ref || entry.tender_id)}</div>
  <div class="made">Tender Radar · звіт сформовано ${esc(day(ctx.generatedAt))}</div>
  ${body}
</div>
</body>
</html>`;
}
