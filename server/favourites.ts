// Saved companies, kept in a cookie.
//
// Deliberately server-side and JavaScript-free: the whole site renders without
// scripts, and a cookie keeps that true. The trade-off is that the list lives
// in one browser rather than in an account — acceptable while the site has no
// user accounts of its own.

export const FAVOURITES_COOKIE = "tr_saved";
const MAX_SAVED = 60;
const TTL_SECONDS = 365 * 24 * 60 * 60;

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

export function parseFavourites(cookieValue: string | null): string[] {
  if (!cookieValue) return [];
  return [...new Set(cookieValue.split(".").map((c) => c.trim()).filter(isEdrpou))].slice(0, MAX_SAVED);
}

export function serialiseFavourites(codes: string[]): string {
  return [...new Set(codes.filter(isEdrpou))].slice(0, MAX_SAVED).join(".");
}

export function toggleFavourite(current: string[], code: string): string[] {
  if (!isEdrpou(code)) return current;
  return current.includes(code) ? current.filter((c) => c !== code) : [code, ...current];
}

export function favouritesCookie(codes: string[], secure: boolean): string {
  const value = serialiseFavourites(codes);
  const attrs = `SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
  return value.length === 0
    ? `${FAVOURITES_COOKIE}=; ${attrs}; Max-Age=0`
    : `${FAVOURITES_COOKIE}=${value}; ${attrs}; Max-Age=${TTL_SECONDS}`;
}
