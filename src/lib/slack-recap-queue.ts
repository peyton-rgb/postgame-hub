/**
 * slack-recap-queue — read + parse the "Recap Queue List" Slack List.
 *
 * A campaign manager submits a "New Recap Request" workflow in Slack, which
 * appends a row to a Slack List (file id F0ARQPKHLHJ). This module fetches that
 * list (read-only) and maps each row into a typed {@link RecapRequest}, including
 * a tolerant parser for the free-text "Details" blob.
 *
 * Everything here is defensive: Slack List cells arrive as loosely-typed objects,
 * older rows have unstructured Details, and links can arrive as JSON blobs. No
 * single malformed row should ever throw — callers log and continue.
 */
import { extractDriveFolderId } from "@/lib/drive-url";

const SLACK_API = "https://slack.com/api";

/** The "Recap Queue List" file id (verified against the live list). */
export const RECAP_QUEUE_LIST_ID = "F0ARQPKHLHJ";

// ── Types ────────────────────────────────────────────────────────────────────

/** A Slack List column definition (id ↔ name ↔ type), from the list schema. */
export interface ListColumn {
  id: string;
  name: string;
  type: string;
}

/** The tolerant-parsed shape of the "Details" text blob. All fields optional. */
export interface ParsedDetails {
  campaignType?: string[];
  platforms?: string[];
  campaignStart?: string;
  campaignEnd?: string;
  campaignGoals?: string;
  takeaways?: string;
  contentUnitTarget?: string;
  athleteTarget?: string;
  impressionTarget?: string;
  engagementTarget?: string;
  engagementRateTarget?: string;
  cpmTarget?: string;
  otherKpis?: string;
  /** Set (instead of the structured fields) when the "Campaign Type:" anchor is absent. */
  rawUnstructured?: string;
}

/** One fully-mapped recap request row. */
export interface RecapRequest {
  itemId: string;
  campaignName: string;
  completed: boolean;
  brand: string;
  dueDate?: string;
  /** Dedup key. String form (source may be number or text, e.g. "921"). */
  campaignId?: string;
  /** Extracted Google Sheets URL (gid preserved). */
  performanceTrackerUrl?: string;
  /** Raw cell text, kept for debugging when extraction fails. */
  performanceTrackerRaw?: string;
  /** Extracted Drive folder id (id only). */
  contentFolderId?: string;
  contentFolderRaw?: string;
  details: ParsedDetails;
  campaignManager?: string;
  assignee?: string;
  recapLink?: string;
  comments?: string;
  /** The raw cell map (columnName → extracted primitive), for first-run debugging. */
  _cells?: Record<string, unknown>;
}

// ── Slack API: schema + items ─────────────────────────────────────────────────

function getToken(explicit?: string): string {
  const token = explicit || process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  return token;
}

async function slackPost(method: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    // Never let Next's fetch cache a Slack list read — the cron must always see
    // fresh list state (a stale cached response can also pin an earlier error).
    cache: "no-store",
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Slack ${method} failed: ${json.error || res.status}`);
  }
  return json;
}

/**
 * Fetch the list's column schema (id → name → type). Slack returns the schema
 * embedded in the items.list response and/or on the file object; we read it from
 * whichever is present. Returns [] if no schema could be found (mapping then
 * falls back to matching by the raw column keys).
 */
export function extractSchema(payload: Record<string, unknown>): ListColumn[] {
  // slackLists.items.list returns list metadata under a few possible shapes.
  const candidates: unknown[] = [
    (payload as any)?.list?.list_metadata?.schema,
    (payload as any)?.list_metadata?.schema,
    (payload as any)?.schema,
    (payload as any)?.file?.list_metadata?.schema,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      return c.map((col: any) => ({
        id: String(col.id ?? col.key ?? ""),
        name: String(col.name ?? col.label ?? col.key ?? ""),
        type: String(col.type ?? ""),
      }));
    }
  }
  return [];
}

/**
 * Pull every item from the Recap Queue List, paginating via next_cursor.
 * Returns the raw items plus the resolved column schema.
 */
export async function fetchListItems(
  token?: string,
  listId: string = RECAP_QUEUE_LIST_ID,
): Promise<{ items: any[]; columns: ListColumn[]; firstPayload: Record<string, unknown> }> {
  const t = getToken(token);
  const items: any[] = [];
  let columns: ListColumn[] = [];
  let firstPayload: Record<string, unknown> = {};
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { list_id: listId, limit: 100 };
    if (cursor) body.cursor = cursor;
    const payload = await slackPost("slackLists.items.list", t, body);
    if (!firstPayload.ok) firstPayload = payload;
    if (!columns.length) columns = extractSchema(payload);
    const pageItems: any[] = payload.items || payload.records || [];
    items.push(...pageItems);
    cursor = payload.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return { items, columns, firstPayload };
}

// ── Column resolution ─────────────────────────────────────────────────────────
//
// The Recap Queue List returns NO column-name schema, so columns are resolved by
// their stable `column_id` (custom columns) and by semantic `key` (built-in Todo
// columns: name / todo_*). These ids were logged from the live list on first run
// (2026-07); if the list is ever rebuilt from scratch, re-log with ?raw=1 and
// update SLOT_BY_COLUMN_ID. A name→slot map is still honored first if Slack ever
// starts returning a schema.

export type Slot =
  | "campaignName" | "completed" | "brand" | "dueDate" | "campaignId"
  | "performanceTracker" | "contentFolder" | "details"
  | "campaignManager" | "assignee" | "recapLink" | "comments";

const SLOT_BY_COLUMN_ID: Record<string, Slot> = {
  Col00: "completed",
  Col01: "assignee",
  Col02: "dueDate",
  Col0ARK46TWJ2: "campaignName",
  Col0ARM6E5K98: "brand",
  Col0ASFM2DF7A: "campaignId",
  Col0ARF1QHP7D: "performanceTracker",
  Col0ATD3FT5ME: "contentFolder",
  Col0ARR2RTX8U: "details",
  Col0ARHTE5NDB: "campaignManager",
  Col0ATC7ZKYM6: "recapLink",
};

const SLOT_BY_KEY: Record<string, Slot> = {
  name: "campaignName",
  todo_completed: "completed",
  todo_due_date: "dueDate",
  todo_assignee: "assignee",
};

const SLOT_BY_NAME: Record<string, Slot> = {
  "campaign name": "campaignName",
  completed: "completed",
  brand: "brand",
  "due date": "dueDate",
  "campaign id": "campaignId",
  "performance tracker": "performanceTracker",
  "content folder": "contentFolder",
  details: "details",
  "campaign manager": "campaignManager",
  assignee: "assignee",
  "recap link": "recapLink",
  comments: "comments",
};

/** Resolve which logical slot a field belongs to (or null if unknown). */
function slotForField(field: any, idToName: Map<string, string>): Slot | null {
  // 1) Built-in semantic key (name, todo_*).
  if (field.key && SLOT_BY_KEY[field.key]) return SLOT_BY_KEY[field.key];
  // 2) Schema-provided human name (only if Slack ever returns a schema).
  const nm = field.column_id ? idToName.get(field.column_id) : undefined;
  if (nm && SLOT_BY_NAME[nm.toLowerCase()]) return SLOT_BY_NAME[nm.toLowerCase()];
  // 3) Stable column_id (logged from the live list).
  if (field.column_id && SLOT_BY_COLUMN_ID[field.column_id]) return SLOT_BY_COLUMN_ID[field.column_id];
  return null;
}

/** Map each item's fields to the logical slots they fill (first wins per slot). */
export function resolveSlots(item: any, columns: ListColumn[]): Partial<Record<Slot, any>> {
  const idToName = new Map<string, string>();
  for (const c of columns) if (c.id) idToName.set(c.id, c.name);
  const slots: Partial<Record<Slot, any>> = {};
  const fields: any[] = item.fields || item.cells || [];
  for (const f of fields) {
    const slot = slotForField(f, idToName);
    if (slot && !(slot in slots)) slots[slot] = f;
  }
  return slots;
}

// ── Field value extraction (defensive, per shape) ─────────────────────────────

/** Flatten Slack rich_text blocks (or arbitrary nested arrays) to plain text. */
function flattenRichText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(flattenRichText).join("");
  if (typeof node === "object") {
    if (typeof node.text === "string") return node.text;
    if (typeof node.url === "string") return node.url;
    if (Array.isArray(node.elements)) return node.elements.map(flattenRichText).join("");
    if (node.rich_text) return flattenRichText(node.rich_text);
  }
  return "";
}

/** Clean plain text for a text column. Prefers field.text; falls back to
 *  rich_text/value. (Fine for names/brand/id/details/user-id cells.) */
function fieldText(field: any): string {
  if (field == null) return "";
  if (typeof field.text === "string" && field.text.trim() !== "") return field.text;
  const flat = flattenRichText(field.rich_text ?? field.value);
  if (flat) return flat;
  if (field.value != null && typeof field.value !== "object") return String(field.value);
  return "";
}

/**
 * Full URL for a link/url column — never the truncated display text. Slack
 * truncates a link cell's `text` ("drive.google.com/…?usp=…") while keeping the
 * full URL in the `link` array or the rich_text element's `url`. Prefer those.
 */
function fieldUrl(field: any): string {
  if (field == null) return "";
  if (Array.isArray(field.link) && field.link[0]) {
    return field.link[0].originalUrl || field.link[0].url || "";
  }
  // Prefer a url from a structured link element in the rich_text tree.
  const u = findUrl(field.rich_text);
  if (u) return u;
  // Plain-text URL cells expose the clean URL (normal slashes) via the parsed
  // rich_text `text` — use it before the raw `value`, which Slack double-encodes
  // (its embedded URL has backslash-escaped slashes that break URL regexes).
  const flat = flattenRichText(field.rich_text);
  if (flat && /https?:\/\//.test(flat)) return flat;
  if (typeof field.text === "string" && field.text.trim() && !field.text.includes("…")) return field.text;
  if (typeof field.value === "string" && field.value.trim()) return field.value;
  return fieldText(field);
}

/** Walk rich_text (or a JSON string of it) for the first element url. */
function findUrl(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") {
    const t = node.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      try { return findUrl(JSON.parse(t)); } catch { /* fall through to regex */ }
    }
    const m = node.match(/https?:\/\/[^\s"'\\<>)\]]+/);
    return m ? m[0] : "";
  }
  if (Array.isArray(node)) {
    for (const n of node) { const u = findUrl(n); if (u) return u; }
    return "";
  }
  if (typeof node === "object") {
    if (typeof node.url === "string") return node.url;
    if (Array.isArray(node.elements)) return findUrl(node.elements);
    if (node.rich_text) return findUrl(node.rich_text);
  }
  return "";
}

/** Boolean for a checkbox column. */
function fieldBool(field: any): boolean {
  if (field == null) return false;
  if (typeof field.checkbox === "boolean") return field.checkbox;
  if (typeof field.value === "boolean") return field.value;
  const s = fieldText(field).toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "checked" || s === "done";
}

// ── Link / URL extraction ─────────────────────────────────────────────────────

/**
 * Extract a Google Sheets URL (gid preserved) from a Performance Tracker cell.
 * The cell may be a plain URL, or a JSON blob like {"originalUrl":"https://..."}.
 */
export function extractSheetUrl(raw: string): string | undefined {
  if (!raw) return undefined;
  // Slack double-encodes some cells, escaping slashes as "\/" — normalize first.
  let text = raw.replace(/\\\//g, "/");
  // JSON blob → originalUrl
  const originalUrl = tryOriginalUrl(text);
  if (originalUrl) text = originalUrl;
  const m = text.match(/https?:\/\/docs\.google\.com\/spreadsheets\/[^\s"'}<>)\]]+/i);
  return m ? m[0] : undefined;
}

/** If `raw` is (or contains) a JSON blob with originalUrl, return that url. */
function tryOriginalUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.includes("originalUrl")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.originalUrl === "string") return parsed.originalUrl;
    } catch {
      // Not clean JSON — regex the value out.
      const m = trimmed.match(/"originalUrl"\s*:\s*"([^"]+)"/);
      if (m) return m[1];
    }
  }
  return undefined;
}

/**
 * Extract sheet id + gid (tab) from a Google Sheets export/edit URL.
 * gid may be in a query param (?gid=) or a fragment (#gid=). Undefined gid ⇒
 * first tab.
 */
export function parseSheetIdAndGid(url: string): { id?: string; gid?: string } {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = url.match(/[?#&]gid=([0-9]+)/);
  return { id: idMatch?.[1], gid: gidMatch?.[1] };
}

/** Extract a Drive folder id from a Content Folder cell (handles JSON blob + N/A). */
export function extractContentFolderId(raw: string): string | undefined {
  if (!raw) return undefined;
  // Normalize Slack's escaped slashes ("\/" → "/") before matching folder ids.
  const trimmed = raw.replace(/\\\//g, "/").trim();
  if (!trimmed || /^n\/?a$/i.test(trimmed)) return undefined;
  const url = tryOriginalUrl(trimmed) || trimmed;
  return extractDriveFolderId(url) || undefined;
}

// ── Details blob parser ───────────────────────────────────────────────────────

const DETAIL_FIELDS: { key: keyof ParsedDetails; label: string; kind: "array" | "date" | "text" }[] = [
  { key: "campaignType", label: "Campaign Type", kind: "array" },
  { key: "platforms", label: "Platforms", kind: "array" },
  { key: "campaignStart", label: "Campaign Start", kind: "date" },
  { key: "campaignEnd", label: "Campaign End", kind: "date" },
  { key: "campaignGoals", label: "Campaign Goals", kind: "text" },
  { key: "takeaways", label: "Takeaways", kind: "text" },
  { key: "contentUnitTarget", label: "Content Unit Target", kind: "text" },
  { key: "athleteTarget", label: "Athlete Target", kind: "text" },
  { key: "impressionTarget", label: "Impression Target", kind: "text" },
  { key: "engagementTarget", label: "Engagement Target", kind: "text" },
  { key: "engagementRateTarget", label: "Engagement Rate Target", kind: "text" },
  { key: "cpmTarget", label: "CPM Target", kind: "text" },
  { key: "otherKpis", label: "Other KPIs", kind: "text" },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse a JSON-ish array cell ("[\"UGC\",\"Elevated Content\"]") into strings.
 *  Tolerant of trailing spaces, typos, and missing brackets. Preserves values verbatim. */
function parseArrayish(value: string): string[] | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const inner = v.replace(/^\[/, "").replace(/\]$/, "");
  const parts = inner
    .split(",")
    .map((p) => p.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

/**
 * Tolerant parser for the Details blob. Anchors on labels appearing at the start
 * of a line ("Label:"), captures the text between each present label and the
 * next present label (values may be inline OR on the following line, and may span
 * multiple lines). If the "Campaign Type:" anchor is missing entirely, the whole
 * blob is returned as {rawUnstructured}.
 */
export function parseDetailsBlob(blob: string | undefined | null): ParsedDetails {
  const text = (blob ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) return {};

  // No structured anchor → treat the whole thing as free text.
  if (!/(^|\n)[ \t]*Campaign Type[ \t]*:/i.test(text)) {
    return { rawUnstructured: text.trim() };
  }

  // Locate every present label (at line start) and record its span.
  type Hit = { field: (typeof DETAIL_FIELDS)[number]; labelStart: number; valueStart: number };
  const hits: Hit[] = [];
  for (const field of DETAIL_FIELDS) {
    const re = new RegExp(`(^|\\n)[ \\t]*${escapeRegex(field.label)}[ \\t]*:`, "i");
    const m = re.exec(text);
    if (m) {
      const labelStart = m.index + (m[1] ? m[1].length : 0);
      hits.push({ field, labelStart, valueStart: m.index + m[0].length });
    }
  }
  hits.sort((a, b) => a.labelStart - b.labelStart);

  const out: ParsedDetails = {};
  for (let i = 0; i < hits.length; i++) {
    const { field, valueStart } = hits[i];
    const end = i + 1 < hits.length ? hits[i + 1].labelStart : text.length;
    const rawValue = text.slice(valueStart, end).trim();
    if (!rawValue) continue;

    if (field.kind === "array") {
      const arr = parseArrayish(rawValue);
      if (arr) (out[field.key] as string[] | undefined) = arr;
    } else if (field.kind === "date") {
      const d = rawValue.match(/\d{4}-\d{2}-\d{2}/);
      (out[field.key] as string | undefined) = d ? d[0] : rawValue;
    } else {
      (out[field.key] as string | undefined) = rawValue;
    }
  }
  return out;
}

// ── Row mapping ───────────────────────────────────────────────────────────────

/** Map one raw Slack List item into a typed RecapRequest. Never throws. */
export function mapItem(item: any, columns: ListColumn[], includeRawCells = false): RecapRequest {
  const slots = resolveSlots(item, columns);
  const g = (s: Slot) => slots[s];

  const perfRaw = g("performanceTracker") ? fieldUrl(g("performanceTracker")) : "";
  const folderRaw = g("contentFolder") ? fieldUrl(g("contentFolder")) : "";
  const campaignId = (g("campaignId") ? fieldText(g("campaignId")).trim() : "") || undefined;

  return {
    itemId: String(item.id ?? item.record_id ?? item.item_id ?? ""),
    campaignName: g("campaignName") ? fieldText(g("campaignName")).trim() : "",
    completed: g("completed") ? fieldBool(g("completed")) : false,
    brand: g("brand") ? fieldText(g("brand")).trim() : "",
    dueDate: (g("dueDate") ? fieldText(g("dueDate")).trim() : "") || undefined,
    campaignId,
    performanceTrackerUrl: extractSheetUrl(perfRaw),
    performanceTrackerRaw: perfRaw || undefined,
    contentFolderId: extractContentFolderId(folderRaw),
    contentFolderRaw: folderRaw || undefined,
    details: parseDetailsBlob(g("details") ? fieldText(g("details")) : ""),
    campaignManager: (g("campaignManager") ? fieldText(g("campaignManager")).trim() : "") || undefined,
    assignee: (g("assignee") ? fieldText(g("assignee")).trim() : "") || undefined,
    recapLink: (g("recapLink") ? fieldUrl(g("recapLink")).trim() : "") || undefined,
    comments: (g("comments") ? fieldText(g("comments")).trim() : "") || undefined,
    ...(includeRawCells
      ? {
          _cells: Object.fromEntries(
            (Object.keys(slots) as Slot[]).map((s) => [
              s,
              s === "completed"
                ? fieldBool(slots[s])
                : s === "performanceTracker" || s === "contentFolder" || s === "recapLink"
                  ? fieldUrl(slots[s])
                  : fieldText(slots[s]),
            ]),
          ),
        }
      : {}),
  };
}

/**
 * Fetch + map the entire Recap Queue List into typed requests.
 * `includeRawCells` attaches the raw cell map to each row (first-run debugging).
 */
export async function getRecapQueue(
  opts: { token?: string; includeRawCells?: boolean } = {},
): Promise<{ requests: RecapRequest[]; columns: ListColumn[] }> {
  const { items, columns } = await fetchListItems(opts.token);
  const requests = items.map((it) => {
    try {
      return mapItem(it, columns, opts.includeRawCells);
    } catch (e) {
      // Never crash on a malformed row — return a minimal record and log.
      console.error("[slack-recap-queue] failed to map item", item_id(it), e);
      return {
        itemId: item_id(it),
        campaignName: "",
        completed: false,
        brand: "",
        details: {},
      } as RecapRequest;
    }
  });
  return { requests, columns };
}

function item_id(it: any): string {
  return String(it?.id ?? it?.record_id ?? it?.item_id ?? "unknown");
}
