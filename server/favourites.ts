// Starred items, kept in a cookie.
//
// Anything can be starred — a tender, a buyer, a supplier, an official — so
// each entry carries its kind alongside its id. Deliberately server-side and
// JavaScript-free: the whole site renders without scripts, and a cookie keeps
// that true. The trade-off is that the list lives in one browser rather than
// in an account, which is acceptable while the site has no accounts of its own.

export const FAVOURITES_COOKIE = "tr_starred";
const MAX_SAVED = 60;
const TTL_SECONDS = 365 * 24 * 60 * 60;

/**
 * Entries are joined by "~" rather than a comma or a dot: officer ids are
 * email addresses, which contain dots, and cookie values may not contain
 * commas or semicolons at all.
 */
const SEPARATOR = "~";

export type FavKind = "tender" | "entity" | "supplier" | "officer";

export type Favourite = { kind: FavKind; id: string };

const PREFIX: Record<FavKind, string> = {
  tender: "t",
  entity: "e",
  supplier: "s",
  officer: "o",
};

const BY_PREFIX: Record<string, FavKind> = { t: "tender", e: "entity", s: "supplier", o: "officer" };

/** A EDRPOU code: eight digits, sometimes shorter for older registrations. */
const EDRPOU = /^\d{6,10}$/;

export function isEdrpou(value: string): boolean {
  return EDRPOU.test(value.trim());
}

/** Pulls whatever a person typed into a bare EDRPOU, or null. */
export function normaliseEdrpou(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return isEdrpou(digits) ? digits : null;
}

/** Ids must survive a cookie round-trip and stay bounded. */
function isUsableId(id: string): boolean {
  return id.length > 0 && id.length <= 120 && !/[~;,\s\\"]/.test(id);
}

export function isFavKind(value: string): value is FavKind {
  return value === "tender" || value === "entity" || value === "supplier" || value === "officer";
}

export function encodeFavourite(fav: Favourite): string {
  return `${PREFIX[fav.kind]}:${fav.id}`;
}

export function decodeFavourite(token: string): Favourite | null {
  const colon = token.indexOf(":");
  if (colon !== 1) return null;
  const kind = BY_PREFIX[token.slice(0, 1)];
  const id = token.slice(colon + 1);
  if (!kind || !isUsableId(id)) return null;
  return { kind, id };
}

export function parseFavourites(cookieValue: string | null): Favourite[] {
  if (!cookieValue) return [];
  const seen = new Set<string>();
  const out: Favourite[] = [];
  for (const token of cookieValue.split(SEPARATOR)) {
    const fav = decodeFavourite(token.trim());
    if (!fav) continue;
    const key = encodeFavourite(fav);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fav);
  }
  return out.slice(0, MAX_SAVED);
}

export function serialiseFavourites(favourites: Favourite[]): string {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const fav of favourites) {
    if (!isUsableId(fav.id)) continue;
    const token = encodeFavourite(fav);
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens.slice(0, MAX_SAVED).join(SEPARATOR);
}

export function isStarred(favourites: Favourite[], kind: FavKind, id: string): boolean {
  return favourites.some((f) => f.kind === kind && f.id === id);
}

export function toggleFavourite(current: Favourite[], kind: FavKind, id: string): Favourite[] {
  if (!isUsableId(id)) return current;
  return isStarred(current, kind, id)
    ? current.filter((f) => !(f.kind === kind && f.id === id))
    : [{ kind, id }, ...current];
}

export function favouritesCookie(favourites: Favourite[], secure: boolean): string {
  const value = serialiseFavourites(favourites);
  const attrs = `SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
  return value.length === 0
    ? `${FAVOURITES_COOKIE}=; ${attrs}; Max-Age=0`
    : `${FAVOURITES_COOKIE}=${value}; ${attrs}; Max-Age=${TTL_SECONDS}`;
}
