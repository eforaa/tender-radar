// Server-rendered site over the local store. Zero dependencies.
import { normaliseEdrpou, type Favourite } from "./favourites.ts";
import { reportText, reportHtml, type ReportContext } from "./report.ts";
import { buildConclusion } from "./conclusion.ts";
import { dataset, reloadDataset, setStarred } from "./context.ts";
import { feedPage } from "./pages/feed.ts";
import { tenderPage } from "./pages/tender.ts";
import { entityPage } from "./pages/entity.ts";
import { officerPage } from "./pages/officer.ts";
import { supplierPage } from "./pages/supplier.ts";
import { entitiesPage } from "./pages/entities.ts";
import { officersPage } from "./pages/officers.ts";
import { suppliersPage } from "./pages/suppliers.ts";
import { railwayPage } from "./pages/railway.ts";
import { articlePage } from "./pages/article.ts";
import { updatesPage } from "./pages/updates.ts";
import { pricesPage } from "./pages/prices.ts";
import { lookupPage } from "./pages/lookup.ts";
import { indicatorsPage, aboutPage, notFound, starredPage } from "./pages/static.ts";

/** Re-reads the store. The local server calls this when the data files change. */
export async function reload(): Promise<number> {
  return reloadDataset();
}

export type Rendered = { status: number; body: string; contentType?: string; filename?: string };

/**
 * Resolves one URL to a page. Pure with respect to I/O, so the same code
 * serves the local Node server and a serverless function.
 */
export function render(url: URL, saved: Favourite[] = []): Rendered {
  // caseRow is called from a dozen places; threading the list through every
  // one of them would add a parameter to each. Set it once per request.
  setStarred(saved);

  const path = decodeURIComponent(url.pathname);

  // A EDRPOU typed into the lookup box: send it to whichever dossier exists.
  if (path === "/lookup") {
    const code = normaliseEdrpou(url.searchParams.get("edrpou") ?? "");
    if (!code) return { status: 200, body: lookupPage(null, url.searchParams.get("edrpou") ?? "") };
    return { status: 200, body: lookupPage(code, code) };
  }
  if (path === "/starred") return { status: 200, body: starredPage(saved, url) };

  if (path === "/") return { status: 200, body: feedPage(url) };
  if (path === "/entities") return { status: 200, body: entitiesPage(url) };
  if (path === "/officers") return { status: 200, body: officersPage(url) };
  if (path === "/suppliers") return { status: 200, body: suppliersPage(url) };
  if (path === "/railway") return { status: 200, body: railwayPage(url) };
  if (path === "/updates") return { status: 200, body: updatesPage(url) };
  if (path === "/prices") return { status: 200, body: pricesPage(url) };
  if (path === "/indicators") return { status: 200, body: indicatorsPage() };
  if (path === "/about") return { status: 200, body: aboutPage() };
  if (path.startsWith("/article/")) return { status: 200, body: articlePage(path.slice("/article/".length), url) };
  if (path.startsWith("/tender/")) {
    const rest = path.slice("/tender/".length);
    if (rest.endsWith("/report") || rest.endsWith("/report.txt")) {
      const asText = rest.endsWith(".txt");
      const id = rest.slice(0, rest.lastIndexOf("/report"));
      const entry = dataset().byTender.get(id);
      if (!entry) return { status: 404, body: notFound() };
      const sameEntity = dataset().cases.filter((x) => x.entity_edrpou && x.entity_edrpou === entry.entity_edrpou);
      const sameOfficer = entry.officer_key ? dataset().cases.filter((x) => x.officer_key === entry.officer_key) : [];
      const sameWinner = entry.winner_edrpou ? dataset().cases.filter((x) => x.winner_edrpou === entry.winner_edrpou) : [];
      const ctx: ReportContext = {
        entry,
        rules: dataset().ruleById,
        sameEntity: sameEntity.length,
        sameOfficer: sameOfficer.length,
        sameWinner: sameWinner.length,
        conclusion: buildConclusion({ entry, sameEntity, sameOfficer, sameWinner }),
        generatedAt: new Date().toISOString(),
      };
      return asText
        ? {
            status: 200,
            body: reportText(ctx),
            contentType: "text/plain; charset=utf-8",
            filename: `${entry.tender_ref || entry.tender_id}.txt`,
          }
        : { status: 200, body: reportHtml(ctx) };
    }
    return { status: 200, body: tenderPage(rest) };
  }
  if (path.startsWith("/entity/")) return { status: 200, body: entityPage(path.slice("/entity/".length), url) };
  if (path.startsWith("/officer/")) return { status: 200, body: officerPage(path.slice("/officer/".length), url) };
  if (path.startsWith("/supplier/")) return { status: 200, body: supplierPage(path.slice("/supplier/".length), url) };

  return { status: 404, body: notFound() };
}
