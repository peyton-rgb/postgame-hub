/**
 * postgame-admin — typed, server-only client for the read-only Postgame admin
 * REST API (a Supabase Edge Function in front of the rebuilt admin's own
 * Supabase project, separate from the Hub's).
 *
 * One-directional: admin → Hub. Nothing here ever writes back to the admin.
 *
 * NOTE ON TYPES: the admin API returns *every* scalar as a string — ids and
 * booleans included ("1007", is_active: "1"). Every field below is therefore
 * `string | null`. Never compare these to numbers, and never cast
 * `campaign_recaps.admin_campaign_id` (already `text`) to an int to match them.
 *
 * Distinct from `admin-campaigns.ts`, which reads the Hub's cached
 * `admin_campaigns` table. This module talks to the live API.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 200; // API max
const PAGE_DELAY_MS = 250; // stay well under 120 req/min
const MAX_ATTEMPTS = 3; // total tries per request, incl. the first
const MAX_PAGES = 100; // runaway guard: 20k rows

/** Error carrying the HTTP status so callers can branch without string-matching.
 *  Never contains the API key. */
export class PostgameAdminError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "PostgameAdminError";
    this.status = status;
  }
}

/**
 * Read config at CALL time, not import time — so a missing env var surfaces as a
 * clear runtime error on the one route that needs it, rather than crashing the
 * build or any module that happens to import this file.
 */
function getConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.POSTGAME_ADMIN_API_URL;
  const apiKey = process.env.POSTGAME_ADMIN_API_KEY;

  const missing: string[] = [];
  if (!baseUrl) missing.push("POSTGAME_ADMIN_API_URL");
  if (!apiKey) missing.push("POSTGAME_ADMIN_API_KEY");
  if (missing.length > 0) {
    throw new PostgameAdminError(
      `Postgame admin API not configured — missing ${missing.join(" and ")}. ` +
        `Set both in .env.local and in Vercel project settings (server-side only; ` +
        `do NOT use a NEXT_PUBLIC_ prefix). Vercel env changes need a redeploy to take effect.`,
    );
  }
  // Trailing slash would produce a double slash and a 404.
  return { baseUrl: baseUrl!.replace(/\/+$/, ""), apiKey: apiKey! };
}

// ── Wire types ────────────────────────────────────────────────────────────────

/** List endpoints: `{ data, count, limit, offset }`. */
export interface AdminListEnvelope<T> {
  data: T[];
  count: number;
  limit: number;
  offset: number;
}

/** Single-record endpoints: `{ data }`. */
export interface AdminSingleEnvelope<T> {
  data: T;
}

export interface AdminCampaign {
  campaign_id: string | null;
  campaign_name: string | null;
  account_id: string | null;
  is_active: string | null; // "1" / "0" — a STRING, not a boolean
  date_stamp: string | null;
  total_opt_in: string | null;
  total_is_selected: string | null;
  total_paid: string | null;
  instagram_hashtag: string | null;
  instagram_hashtag2: string | null;
  instagram_hashtag3: string | null;
  instagram_mention: string | null;
}

export interface AdminAccount {
  account_id: string | null;
  account: string | null;
  account_type_id: string | null;
  date_stamp: string | null;
}

/** `/user` field shape is undocumented (the spec sets additionalProperties:true)
 *  and unverified against live data, so it stays open rather than wrongly exact. */
export type AdminUser = Record<string, string | null>;

type QueryParams = Record<string, string | number | boolean | undefined | null>;

// ── Transport ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential: 1s, 2s, 4s… Honour Retry-After when the server sends one. */
function backoffMs(attempt: number, retryAfter: string | null): number {
  const headerSeconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
    return Math.min(headerSeconds * 1000, 30_000);
  }
  return Math.min(1000 * 2 ** (attempt - 1), 30_000);
}

function buildUrl(baseUrl: string, path: string, params: QueryParams): URL {
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

/**
 * One request, with 429 backoff. The key travels in a header and is never
 * placed in a URL, a log line, or an error message.
 */
async function requestJson<T>(path: string, params: QueryParams = {}): Promise<T> {
  const { baseUrl, apiKey } = getConfig();
  const url = buildUrl(baseUrl, path, params);
  // Safe to surface: query string only, no credentials.
  const where = `${path}${url.search}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { "x-api-key": apiKey, accept: "application/json" },
        cache: "no-store",
      });
    } catch (cause) {
      // Network-level failure — retry, since it is usually transient.
      if (attempt === MAX_ATTEMPTS) {
        throw new PostgameAdminError(
          `Postgame admin API unreachable for ${where} after ${MAX_ATTEMPTS} attempts: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        );
      }
      await sleep(backoffMs(attempt, null));
      continue;
    }

    if (res.status === 429) {
      if (attempt === MAX_ATTEMPTS) {
        throw new PostgameAdminError(
          `Postgame admin API rate limit (429) on ${where} after ${MAX_ATTEMPTS} attempts. ` +
            `The key allows 120 requests/minute.`,
          429,
        );
      }
      await sleep(backoffMs(attempt, res.headers.get("retry-after")));
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      // Distinct, self-explanatory message: the log line alone should be enough
      // to tell "wrong key" from "right key, wrong scope".
      throw new PostgameAdminError(
        res.status === 401
          ? `Postgame admin API rejected the key (401 Unauthorized) on ${where} — ` +
            `POSTGAME_ADMIN_API_KEY is missing, malformed, or revoked. On Vercel, confirm the ` +
            `env var is set for this environment AND that a redeploy has happened since.`
          : `Postgame admin API refused the request (403 Forbidden) on ${where} — ` +
            `the key is recognised but is not scoped to this endpoint.`,
        res.status,
      );
    }

    if (!res.ok) {
      const detail = await readErrorMessage(res);
      throw new PostgameAdminError(
        `Postgame admin API returned ${res.status} on ${where}${detail ? `: ${detail}` : ""}`,
        res.status,
      );
    }

    try {
      return (await res.json()) as T;
    } catch {
      throw new PostgameAdminError(`Postgame admin API returned non-JSON body on ${where}`, res.status);
    }
  }

  // Unreachable: every path above returns or throws on the final attempt.
  throw new PostgameAdminError(`Postgame admin API request failed for ${where}`);
}

/** Errors are shaped `{ "error": "..." }`, but never assume — the body may be
 *  HTML from a proxy. */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body?.error === "string" ? body.error : "";
  } catch {
    return "";
  }
}

// ── Paging ────────────────────────────────────────────────────────────────────

/**
 * Page through a list endpoint at the max page size until `count` rows have been
 * collected, pausing between pages to stay inside the rate limit.
 *
 * Stops early on an empty page so a wrong/oversized `count` can't spin forever.
 */
export async function fetchAll<T>(path: string, params: QueryParams = {}): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  let expected = Number.POSITIVE_INFINITY;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0) await sleep(PAGE_DELAY_MS);

    const envelope = await requestJson<AdminListEnvelope<T>>(path, {
      ...params,
      limit: PAGE_SIZE,
      offset,
    });

    const batch = Array.isArray(envelope?.data) ? envelope.data : [];
    rows.push(...batch);

    const count = Number(envelope?.count);
    if (Number.isFinite(count)) expected = count;

    // No rows came back, or we have everything the server says exists.
    if (batch.length === 0 || rows.length >= expected) return rows;

    offset += batch.length;
  }

  throw new PostgameAdminError(
    `Postgame admin API paging exceeded ${MAX_PAGES} pages on ${path} (collected ${rows.length} rows) — aborting.`,
  );
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * All campaigns. `active: true` restricts to live ones, `false` to archived;
 * omit for everything. Booleans are sent as "1"/"0" to match the admin's
 * string-typed columns.
 */
export async function getCampaigns(opts: { active?: boolean } = {}): Promise<AdminCampaign[]> {
  const params: QueryParams = {};
  if (opts.active !== undefined) params.active = opts.active ? "1" : "0";
  return fetchAll<AdminCampaign>("/campaigns", params);
}

/** All accounts. */
export async function getAccounts(): Promise<AdminAccount[]> {
  return fetchAll<AdminAccount>("/accounts");
}

/**
 * One user, by admin user id or Instagram handle. The API declares both params
 * optional but requires one of them, so guard here rather than eat a 400.
 */
export async function getUser(opts: { userId?: string; instagram?: string }): Promise<AdminUser | null> {
  const userId = opts.userId?.trim();
  const instagram = opts.instagram?.trim();
  if (!userId && !instagram) {
    throw new PostgameAdminError("getUser requires either userId or instagram — the admin API needs one of them.");
  }

  try {
    const envelope = await requestJson<AdminSingleEnvelope<AdminUser>>("/user", {
      user_id: userId,
      instagram,
    });
    return envelope?.data ?? null;
  } catch (err) {
    // "No such user" is an expected answer, not a failure.
    if (err instanceof PostgameAdminError && err.status === 404) return null;
    throw err;
  }
}
