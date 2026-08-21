import { getJson, type HttpOptions } from "./http.ts";

const BASE = "https://audit-api.prozorro.gov.ua/api/2.5";

/**
 * The State Audit Service publishes every monitoring it opens. Unlike the risk
 * indicators, which only say "this looks worth a look", a finished monitoring
 * carries a conclusion: whether a violation was established, and which norms.
 * That is the difference between a suspicion and a finding, so it is worth the
 * crawl.
 *
 * `opt_fields` works on the listing, and it carries both the tender id and the
 * status. The whole feed — around 82000 monitorings back to October 2018 — can
 * therefore be scanned in about a minute at 1000 per page, and only the few
 * thousand that touch tenders we hold need a second, full request.
 *
 * `tender_id` is accepted as a query parameter and silently ignored: the API
 * answers with the feed from the beginning regardless. There is no way to ask
 * about one tender, which is why the whole feed is walked.
 */
export const AUDIT_FEED_START = `${BASE}/monitorings?limit=1000&opt_fields=tender_id%2Cstatus`;

export type MonitoringEntry = {
  id: string;
  dateModified: string;
  tender_id?: string;
  status?: string;
};

export type MonitoringPage = { data: MonitoringEntry[]; nextUri: string };

export type RawMonitoring = Record<string, unknown> & { id: string };

type FeedResponse = { data: MonitoringEntry[]; next_page?: { uri?: string } };

/** Fetches one feed page; pass the previous page's nextUri to continue. */
export async function fetchMonitoringPage(uri: string, opts?: HttpOptions): Promise<MonitoringPage> {
  const body = await getJson<FeedResponse>(uri, opts);
  return { data: body.data ?? [], nextUri: body.next_page?.uri ?? "" };
}

/** Fetches one monitoring in full, including its conclusion when there is one. */
export async function fetchMonitoring(id: string, opts?: HttpOptions): Promise<RawMonitoring> {
  const body = await getJson<{ data: RawMonitoring }>(`${BASE}/monitorings/${id}`, opts);
  return body.data;
}

/**
 * Statuses a monitoring can reach once the auditors have finished with it.
 * `active` and `draft` are still in progress and carry no conclusion, so they
 * are not worth a second request.
 */
export const CONCLUDED_STATUSES = new Set(["addressed", "completed", "declined", "closed", "stopped"]);
