import { getJson, type HttpOptions } from "./http.ts";

const BASE = "https://public.api.openprocurement.org/api/2.5";

/**
 * Scanning the feed with opt_fields is cheap — 100 entries per request.
 * procuringEntity comes back (and carries the region); items, value and
 * awards do not, so anything we keep needs a second, full fetch.
 *
 * `descending=1` matters: without it the feed starts in 2015 and the first
 * run would crawl a decade of history before reaching anything current.
 */
export const FEED_START = `${BASE}/tenders?limit=100&descending=1&opt_fields=tenderID,procuringEntity`;

export type FeedEntry = {
  id: string;
  dateModified: string;
  tenderID?: string;
  procuringEntity?: {
    name?: string;
    identifier?: { id?: string; legalName?: string };
    address?: { region?: string; locality?: string };
  };
};

export type FeedPage = { data: FeedEntry[]; nextUri: string };

export type RawTender = Record<string, unknown> & { id: string; tenderID: string };

/** Fetches one feed page; pass the previous page's nextUri to continue. */
export async function fetchFeedPage(url: string | null, opts?: HttpOptions): Promise<FeedPage> {
  const body = await getJson<{ data: FeedEntry[]; next_page: { uri: string } }>(url ?? FEED_START, opts);
  return { data: body.data, nextUri: body.next_page.uri };
}

/** Fetches the full tender card, including items, bids, awards and contracts. */
export async function fetchTender(id: string, opts?: HttpOptions): Promise<RawTender> {
  const body = await getJson<{ data: RawTender }>(`${BASE}/tenders/${id}`, opts);
  return body.data;
}
