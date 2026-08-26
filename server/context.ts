// The two pieces of state the pages share.
//
// The dataset is loaded once per process and swapped by the dev server when
// the daily job rewrites the files. The starred list is per request: caseRow
// is called from a dozen places, and threading the list through every one of
// them would add a parameter to each.
import { loadDataset, type Dataset } from "./data.ts";
import type { Favourite } from "./favourites.ts";

let db: Dataset = await loadDataset();
console.log(
  `loaded ${db.flagCount} flags across ${db.cases.length} tenders ` +
    `(${db.cases.filter((c) => c.detailed).length} with full cards)`,
);
let starred: Favourite[] = [];

export function dataset(): Dataset {
  return db;
}

/** Re-reads the store. The local server calls this when the data files change. */
export async function reloadDataset(): Promise<number> {
  db = await loadDataset();
  return db.cases.length;
}

export function setStarred(list: Favourite[]): void {
  starred = list;
}

export function starredList(): Favourite[] {
  return starred;
}
