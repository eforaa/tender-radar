import type { Claim } from "../analysis/ai-extract.ts";
export type SourceDocument = { id: string; title: string; url: string; format: string; modified: string; kind: string };
export type DocumentResult = {
  key: string; tender_id: string; document: SourceDocument; source_sha256?: string;
  status: "ready" | "partial" | "unsupported" | "error"; updated_at: string;
  page_count: number; processed_pages: number; ocr_pages: number[];
  claims: (Claim & { page: number; method: "text" | "ocr" })[];
  rejected_count: number; message: string; attempts: number;
};
export function sourceDocuments(raw: unknown): SourceDocument[] {
  const r = (raw ?? {}) as Record<string, any>;
  const docs: SourceDocument[] = [];
  const add = (list: unknown, kind: string) => {
    if (!Array.isArray(list)) return;
    for (const d of list) if (d && typeof d.id === "string" && typeof d.url === "string") {
      docs.push({ id: d.id, title: String(d.title ?? "Документ"), url: d.url, format: String(d.format ?? ""),
        modified: String(d.dateModified ?? d.datePublished ?? ""), kind });
    }
  };
  add(r.documents, "Тендерна документація");
  for (const contract of Array.isArray(r.contracts) ? r.contracts : []) {
    add(contract.documents, "Договір та додатки");
    for (const change of Array.isArray(contract.changes) ? contract.changes : []) add(change.documents, "Зміни договору");
  }
  for (const award of Array.isArray(r.awards) ? r.awards : []) add(award.documents, "Документи переможця");
  return [...new Map(docs.map(d => [`${d.id}|${d.url}|${d.modified}`, d])).values()];
}

export function allowedDocumentUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "public-docs.prozorro.gov.ua" &&
    !url.username && !url.password && (!url.port || url.port === "443"); } catch { return false; }
}
