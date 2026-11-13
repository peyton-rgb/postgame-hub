// ============================================================
// Muse sheet → Inspo library: the mapping half.
//
// Muse logs every reference sent to the "Postgame creative" Instagram DM
// channel as a row in the "Postgame Inspo Library" Google Sheet and (when
// Instagram lets it) saves the file to Drive. This module turns one sheet row
// into the shape of an inspo_items row. It does no I/O, so it can be read and
// tested on its own; the route in /api/sync/inspo-sheet does the fetching and
// writing.
//
// Columns are looked up by HEADER NAME, never by position — Muse adds and
// reorders columns, and a positional read would silently file "Mood" under
// "Audio" the day it does.
// ============================================================

export const INSPO_SHEET_ID = "1eFM0pLMUlSNKbMZ9HW54XRpuGHjXRpfW8F3fKY0ebYw";
export const INSPO_SHEET_RANGE = "Inspo!A1:AZ";

/** One sheet row, keyed by what the sync needs rather than by column letter. */
export interface MuseRow {
  /** 1-based row number in the sheet, for reports a human can check. */
  sheetRow: number;
  code: string;
  link: string;
  dateSaved: string;
  savedBy: string;
  status: string;
  handle: string;
  mediaType: string;
  category: string;
  hookType: string;
  hook: string;
  transcript: string;
  structure: string;
  visualStyle: string;
  shotTypes: string[];
  editing: string[];
  audio: string;
  mood: string[];
  whyItWorks: string;
  likes: string;
  comments: string;
  views: string;
  postgameFit: string;
  brandFit: string[];
  sportFit: string[];
  contentIdea: string;
  productionLift: string;
  tags: string[];
  searchPhrases: string[];
  driveFile: string;
  notes: string;
  postDate: string;
}

/**
 * The shortcode is Instagram's own id for a post — the part after /p/ or
 * /reel/. It is the one thing a sheet row and a Hub row saved months apart
 * have in common, so it is the match key. Query strings and a leading
 * username segment are ignored.
 */
export function instagramCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

/**
 * Drive file id from the sheet's "Drive File" cell. Muse has written that cell
 * three ways: a ".../file/d/<id>/view" link, a "...?id=<id>" link, and — on
 * rows from 11 Nov 2026 on — the bare id with no link around it. Folder links
 * return null.
 */
export function driveFileId(value: string | null | undefined): string | null {
  const v = (value || "").trim();
  if (!v || /\/folders\//.test(v)) return null;
  const m = v.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/) || v.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(v) ? v : null;
}

function list(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Headers the sync cannot work without. Anything else missing just reads as blank. */
const REQUIRED_HEADERS = ["Link"];

/**
 * Parse the raw sheet values (header row first) into rows that have an
 * Instagram link. Rows without one are skipped; duplicates of a shortcode keep
 * the first occurrence, which is the earliest save.
 */
export function parseMuseSheet(values: string[][]): { rows: MuseRow[]; skipped: number; missingHeaders: string[] } {
  const header = (values[0] || []).map((h) => String(h ?? "").trim());
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter((h) => col(h) === -1);
  if (missingHeaders.length) return { rows: [], skipped: 0, missingHeaders };

  const idx = {
    link: col("Link"),
    dateSaved: col("Date Saved"),
    savedBy: col("Saved By"),
    status: col("Status"),
    handle: col("Creator Handle"),
    mediaType: col("Media Type"),
    category: col("Content Category"),
    hookType: col("Hook Type"),
    hook: col("Hook (first 3 sec)"),
    transcript: col("Transcript / On-screen Text"),
    structure: col("Structure"),
    visualStyle: col("Visual Style"),
    shotTypes: col("Shot Types"),
    editing: col("Editing Techniques"),
    audio: col("Audio"),
    mood: col("Mood"),
    whyItWorks: col("Why It Works"),
    likes: col("Likes"),
    comments: col("Comments"),
    views: col("Views"),
    postgameFit: col("Postgame Fit (1-5)"),
    brandFit: col("Brand Fit"),
    sportFit: col("Sport / Athlete Fit"),
    contentIdea: col("Content Idea for Postgame"),
    productionLift: col("Production Lift"),
    tags: col("Tags"),
    searchPhrases: col("Search Phrases"),
    driveFile: col("Drive File"),
    notes: col("Notes"),
    postDate: col("Post Date"),
  };

  const rows: MuseRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = 1; i < values.length; i++) {
    const raw = values[i] || [];
    const get = (c: number) => (c >= 0 ? String(raw[c] ?? "").trim() : "");
    const link = get(idx.link);
    const code = instagramCode(link);
    if (!code || seen.has(code)) {
      if (link) skipped++;
      continue;
    }
    seen.add(code);
    rows.push({
      sheetRow: i + 1,
      code,
      link,
      dateSaved: get(idx.dateSaved),
      savedBy: get(idx.savedBy),
      status: get(idx.status),
      handle: get(idx.handle).replace(/^@/, ""),
      mediaType: get(idx.mediaType).toLowerCase(),
      category: get(idx.category),
      hookType: get(idx.hookType),
      hook: get(idx.hook),
      transcript: get(idx.transcript),
      structure: get(idx.structure),
      visualStyle: get(idx.visualStyle),
      shotTypes: list(get(idx.shotTypes)),
      editing: list(get(idx.editing)),
      audio: get(idx.audio),
      mood: list(get(idx.mood)),
      whyItWorks: get(idx.whyItWorks),
      likes: get(idx.likes),
      comments: get(idx.comments),
      views: get(idx.views),
      postgameFit: get(idx.postgameFit),
      brandFit: list(get(idx.brandFit)),
      sportFit: list(get(idx.sportFit)),
      contentIdea: get(idx.contentIdea),
      productionLift: get(idx.productionLift),
      tags: list(get(idx.tags)),
      searchPhrases: list(get(idx.searchPhrases)),
      driveFile: get(idx.driveFile),
      notes: get(idx.notes),
      postDate: get(idx.postDate),
    });
  }

  return { rows, skipped, missingHeaders: [] };
}

/**
 * What the library shows as an asset's description. The hook is Muse's
 * account of what is on screen in the opening seconds, which is the closest
 * thing to "what am I looking at"; structure and visual style stand in when a
 * row has no hook.
 */
export function museDescription(row: MuseRow): string | null {
  return row.hook || row.structure || row.visualStyle || null;
}

/**
 * The Muse fields as columns of an inspo_items row. Only the descriptive
 * columns — the route adds the file, thumbnail, ids and embeddings.
 *
 * context_tags values are kept flat (strings or string arrays) on purpose:
 * buildEmbeddingInput() joins every value in that object into the text that
 * gets embedded, and a nested object would land in it as "[object Object]".
 */
export function museFields(row: MuseRow) {
  const search = unique([
    ...row.tags,
    ...row.searchPhrases,
    ...row.mood,
    ...row.editing,
    ...(row.category ? [row.category] : []),
    ...(row.mediaType ? [`ig-type:${row.mediaType}`] : []),
    ...(row.handle ? [`ig-owner:${row.handle}`] : []),
  ]);

  const context: Record<string, string | string[]> = {
    ig_type: row.mediaType,
    ig_owner: row.handle,
    sport: row.sportFit,
    muse_category: row.category,
    muse_structure: row.structure,
    muse_hook: row.hook,
    muse_transcript: row.transcript,
    muse_visual_style: row.visualStyle,
    muse_audio: row.audio,
    muse_why_it_works: row.whyItWorks,
    muse_content_idea: row.contentIdea,
    muse_production_lift: row.productionLift,
    muse_postgame_fit: row.postgameFit,
    muse_saved_by: row.savedBy,
    muse_date_saved: row.dateSaved,
    muse_post_date: row.postDate,
    muse_likes: row.likes,
    muse_comments: row.comments,
    muse_views: row.views,
    muse_notes: row.notes,
  };
  // Blank cells are dropped rather than stored as "" so the embedding text and
  // the detail panel are not padded with empty entries.
  for (const key of Object.keys(context)) {
    const v = context[key];
    if (v === "" || (Array.isArray(v) && v.length === 0)) delete context[key];
  }

  return {
    visual_description: museDescription(row),
    search_phrases: search,
    brief_fit: row.brandFit,
    mood_tags: row.mood,
    shot_type: row.shotTypes.join(", ") || null,
    format: row.mediaType || null,
    pro_tags: {
      lens_shot_type: row.shotTypes,
      editing_techniques: row.editing,
    } as Record<string, string[]>,
    social_tags: {
      trend_format: row.category ? [row.category] : [],
      audience_energy: row.mood,
      ...(row.hookType ? { hook_style: row.hookType } : {}),
    } as Record<string, string[] | string>,
    context_tags: context,
  };
}

/** File extension for the stored object, from Drive's mime type then its file name. */
export function extensionFor(mimeType: string | null | undefined, name: string | null | undefined): string {
  const byMime: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  if (mimeType && byMime[mimeType]) return byMime[mimeType];
  const m = (name || "").match(/\.([A-Za-z0-9]{2,5})$/);
  if (m) return m[1].toLowerCase();
  return mimeType?.startsWith("video/") ? "mp4" : "bin";
}
