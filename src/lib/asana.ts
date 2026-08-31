// ============================================================
// Asana read client — "Campaigns Notes and Timelines" board.
//
// Read-only in one direction: Asana → Hub. Nothing is ever written back to
// Asana. The single consumer is /api/sync/asana-managers, which maps each
// campaign task's ASSIGNEE onto the matching campaign_recaps row.
//
// STUB-SAFE: callers check `asanaConfigured()` first and degrade to a 503
// rather than throwing when ASANA_ACCESS_TOKEN is unset.
// ============================================================

const ASANA_API = "https://app.asana.com/api/1.0";

/** The board this sync reads. Verified against the live workspace 31 Aug. */
export const CAMPAIGNS_PROJECT_GID = "1205710454451172";

/** The "Campaign Link" custom field (resource_subtype: text). Its value is a CF
 *  admin URL — the campaignID inside it is the join key to campaign_recaps. */
export const CAMPAIGN_LINK_FIELD_GID = "1213879407201590";

/** Asana caps `limit` at 100. The board is ~430 tasks including completed ones,
 *  so a full read is ~5 pages — pagination is required, not optional. */
const PAGE_LIMIT = 100;

/** Hard stop on the pagination loop. Well above the real page count; exists so a
 *  malformed next_page can never spin this route until the function times out. */
const MAX_PAGES = 50;

export class AsanaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AsanaError";
  }
}

export interface AsanaUser {
  gid: string;
  name?: string | null;
  email?: string | null;
}

export interface AsanaCustomField {
  gid: string;
  name?: string | null;
  text_value?: string | null;
}

export interface AsanaTask {
  gid: string;
  name?: string | null;
  completed?: boolean | null;
  assignee?: AsanaUser | null;
  custom_fields?: AsanaCustomField[] | null;
}

interface AsanaListResponse {
  data?: AsanaTask[];
  next_page?: { offset?: string | null } | null;
}

/** True when the access token is present. Never logs or returns the value. */
export function asanaConfigured(): boolean {
  return Boolean(process.env.ASANA_ACCESS_TOKEN);
}

/**
 * Every task on the campaigns board, completed ones included.
 *
 * Completed tasks are deliberately in scope: a campaign can be marked done in
 * Asana and still receive a late submission, and that submission should still
 * reach the manager who ran it.
 */
export async function getCampaignTasks(): Promise<AsanaTask[]> {
  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) throw new AsanaError("ASANA_ACCESS_TOKEN is not set");

  const optFields = "name,completed,assignee.name,assignee.email,custom_fields.gid,custom_fields.name,custom_fields.text_value";
  const tasks: AsanaTask[] = [];
  let offset: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${ASANA_API}/projects/${CAMPAIGNS_PROJECT_GID}/tasks`);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    url.searchParams.set("opt_fields", optFields);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      // Body may carry Asana's own error text, but it can also echo the request.
      // Take the status and a short excerpt — never the Authorization header.
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new AsanaError(`Asana responded ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
    }

    const body = (await res.json()) as AsanaListResponse;
    tasks.push(...(body.data ?? []));

    offset = body.next_page?.offset ?? null;
    if (!offset) return tasks;
  }

  throw new AsanaError(`Pagination exceeded ${MAX_PAGES} pages — aborting rather than looping`);
}

/** The raw "Campaign Link" text on a task, or null when the field is empty. */
export function campaignLinkValue(task: AsanaTask): string | null {
  const field = (task.custom_fields ?? []).find((f) => f.gid === CAMPAIGN_LINK_FIELD_GID);
  const value = (field?.text_value ?? "").trim();
  return value.length > 0 ? value : null;
}

/**
 * Pull the admin campaign id out of a Campaign Link value.
 *
 * The right kind of link is `…/Campaign_dashboard.cfm?campaignID=1000`. Some
 * tasks hold a different CF page instead (`campaigns.cfm?AccountID=126`), which
 * has no campaignID at all — those return null and are reported as bad links
 * rather than silently skipped, because they look filled-in to a human.
 *
 * Returned as a STRING: campaign_recaps.admin_campaign_id is text, and these
 * ids must never round-trip through a number.
 */
export function parseCampaignId(link: string | null): string | null {
  if (!link) return null;
  const match = /campaignID=(\d+)/i.exec(link);
  return match ? match[1] : null;
}
