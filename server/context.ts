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
let current = "";

export function dataset(): Dataset {
  return db;
}

/**
 * The path and query being rendered. The star toggle posts it as `back`, so
 * starring a row on page 7 of a filtered feed returns to page 7 of that feed
 * — not to the tender page, which is what a per-row fallback did.
 */
export function setCurrentPath(path: string): void {
  current = path;
}

export function currentPath(): string {
  return current;
}

/** Re-reads the store. The local server calls this when the data files change. */
export async function reloadDataset(): Promise<number> {
  db = await loadDataset();
  memo.clear();
  return db.cases.length;
}

/**
 * Something derived from the whole dataset — a directory's aggregate rows,
 * say — built once and reused until the data changes. The directories used
 * to walk all 36k cases on every request; the result only ever changes when
 * the daily job swaps the files.
 */
const memo = new Map<string, unknown>();
export function perDataset<T>(key: string, build: () => T): T {
  if (!memo.has(key)) memo.set(key, build());
  return memo.get(key) as T;
}

export function setStarred(list: Favourite[]): void {
  starred = list;
}

export function starredList(): Favourite[] {
  return starred;
}
