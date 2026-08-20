export type HttpOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

export class HttpError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

const UA = "tender-radar/0.1 (+public procurement analysis)";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetches a URL as text, retrying transient failures with linear backoff. */
export async function getText(url: string, opts: HttpOptions = {}): Promise<string> {
  const retries = opts.retries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  let lastError: Error = new HttpError(0, url, "no attempt was made");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 500) {
        lastError = new HttpError(res.status, url, `server returned ${res.status}`);
      } else if (!res.ok) {
        throw new HttpError(res.status, url, `request failed with ${res.status}`);
      } else {
        return await res.text();
      }
    } catch (err) {
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < retries) await sleep(retryDelayMs * attempt);
  }
  throw lastError;
}

/** Fetches a URL and parses the body as JSON. */
export async function getJson<T>(url: string, opts: HttpOptions = {}): Promise<T> {
  return JSON.parse(await getText(url, opts)) as T;
}
