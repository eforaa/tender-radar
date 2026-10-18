import { getJson, type HttpOptions } from "./http.ts";

const BASE = "https://public-api.prozorro.gov.ua/api/2.5";

/**
 * Scanning the feed with opt_fields is cheap — 100 entries per request.
 * procuringEntity comes back (and carries the region); items, value and
 * awards do not, so anything we keep needs a second, full fetch.
 *
 * `descending=1` matters: without it the feed starts in 2015 and the first
 * run would crawl a decade of history before reaching anything current.
 */
export const FEED_START = `${BASE}/tenders?limit=100&descending=1&opt_fields=tenderID,procuringEntity,public_modified`;

export type FeedEntry = {
  id: string;
  dateModified: string;
  public_modified?: number;
  tenderID?: string;
  procuringEntity?: {
    name?: string;
    identifier?: { id?: string; legalName?: string };
    address?: { region?: string; locality?: string };
  };
};

export type FeedPage = { data: FeedEntry[]; nextUri: string | null; prevUri?: string | null };

export type RawTender = Record<string, unknown> & { id: string; tenderID: string; procuringEntity?: FeedEntry["procuringEntity"]; items?: unknown };

/** Fetches one feed page; pass the previous page's nextUri to continue. */
export async function fetchFeedPage(url: string | null, opts?: HttpOptions): Promise<FeedPage> {
  const body = await getJson<{ data: FeedEntry[]; next_page?: { uri: string }; prev_page?: { uri: string } }>(url ?? FEED_START, opts);
  if (!Array.isArray(body.data)) throw new Error("Invalid Prozorro feed response");
  for (const uri of [body.next_page?.uri, body.prev_page?.uri]) {
    if (uri && new URL(uri).origin !== new URL(BASE).origin) throw new Error("Untrusted feed cursor origin");
  }
  return { data: body.data, nextUri: body.next_page?.uri ?? null, prevUri: body.prev_page?.uri ?? null };
}

/** Fetches the full tender card, including items, bids, awards and contracts. */
export async function fetchTender(id: string, opts?: HttpOptions): Promise<RawTender> {
  const body = await getJson<{ data: RawTender }>(`${BASE}/tenders/${encodeURIComponent(id)}`, opts);
  if (body.data?.id !== id) throw new Error("Tender response ID mismatch");
  return body.data;
}
