// ============================================================
// Carousel content picker — which Frame.io clips an athlete may use.
//
// Rule (Peyton, 2026-11-09): a clip can be added to an athlete's carousel
// only if it sits in that athlete's SELECTED CLIPS folder, OR it is marked
// Approved (the Frame.io "Status" field) anywhere inside the athlete's
// Frame.io folder. Photos (added 2026-11-09): every image in the athlete's
// PHOTOS folder may be used too. Nothing is copied: we ask Frame.io each time and hand the
// browser Frame.io's own short-lived play / thumbnail links.
// ============================================================

// Same base as FRAMEIO_API in @/lib/frameio — repeated here so this module has
// no path-alias imports and its tests run under plain `node --test`.
const FRAMEIO_API = "https://api.frame.io/v4";

// The Status field and its "Approved" option in Postgame's Frame.io account.
// Matched by id first, then by name, so a renamed label still works.
const STATUS_FIELD_ID = "04884c84-8309-4ac9-beb1-8334a4610db7";
const APPROVED_OPTION_ID = "b1caf85a-6387-4e93-b254-b72008058593";

// Folders under an athlete that never hold carousel footage — skipped so a
// walk stays fast (Frame.io allows ~100 calls a minute per user).
const SKIP_FOLDERS = /^(audio|music|vo|exports?|renders?)$/i;
// The athlete's photo folder: every image in it (and its sub-folders, e.g.
// Leica / Polaroid) is offered in the picker's Photos section.
export const isPhotoFolder = (name: string) => /^(photos?|stills)$/i.test(name.trim());
const MAX_DEPTH = 3;

type MetaField = {
  field_definition_id?: string;
  field_definition_name?: string;
  value?: unknown;
};
type Asset = {
  id: string;
  name: string;
  type: "file" | "folder" | "version_stack";
  media_type?: string;
  status?: string;
  parent_id?: string;
  view_url?: string;
  metadata?: MetaField[];
  media_links?: Record<string, { url?: string | null; download_url?: string | null } | null>;
  head_version?: Asset;
};

export type PickerClip = {
  id: string;
  name: string;
  kind: "video" | "image";
  source: "selected" | "approved" | "photos";
  approved: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  thumb: string | null;
  play: string | null;
  viewUrl: string | null;
  folder: string;
};

function metaValue(f: Asset, name: string): unknown {
  return f.metadata?.find((m) => m.field_definition_name === name)?.value;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

// A select field's value comes back as a list; each entry may be an option
// object ({ id, display_name }) or a plain string, depending on API version.
export function isApproved(f: Asset): boolean {
  const field = f.metadata?.find(
    (m) => m.field_definition_id === STATUS_FIELD_ID || m.field_definition_name === "Status"
  );
  const vals = Array.isArray(field?.value) ? field!.value : field?.value ? [field.value] : [];
  return vals.some((v) => {
    if (typeof v === "string") return v === APPROVED_OPTION_ID || v.toLowerCase() === "approved";
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return o.id === APPROVED_OPTION_ID || String(o.display_name ?? o.name ?? "").toLowerCase() === "approved";
    }
    return false;
  });
}

const INCLUDE = "metadata,media_links.thumbnail_high_quality,media_links.high_quality";

async function listChildren(token: string, accountId: string, folderId: string): Promise<Asset[]> {
  const out: Asset[] = [];
  let next: string | null =
    `/accounts/${accountId}/folders/${folderId}/children?page_size=500&include=${encodeURIComponent(INCLUDE)}`;
  while (next) {
    const url: string = next.startsWith("http") ? next : `${FRAMEIO_API}${next.replace(/^\/v4/, "")}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) throw new Error(`Frame.io folder ${folderId} (${res.status})`);
    const body = (await res.json()) as { data?: Asset[]; links?: { next?: string | null } };
    out.push(...(body.data ?? []));
    next = body.links?.next ?? null;
  }
  return out;
}

function toClip(f: Asset, source: PickerClip["source"], folder: string): PickerClip | null {
  const file = f.type === "version_stack" && f.head_version ? f.head_version : f;
  const mt = file.media_type ?? "";
  const kind = mt.startsWith("video") ? "video" : mt.startsWith("image") ? "image" : null;
  if (!kind) return null;
  const link = (k: string) => file.media_links?.[k]?.url ?? file.media_links?.[k]?.download_url ?? null;
  return {
    id: file.id,
    name: file.name,
    kind,
    source,
    approved: isApproved(file),
    duration: num(metaValue(file, "Duration")),
    width: num(metaValue(file, "Resolution - Width")),
    height: num(metaValue(file, "Resolution - Height")),
    thumb: link("thumbnail_high_quality"),
    play: link("high_quality"),
    viewUrl: file.view_url ?? null,
    folder,
  };
}

// Walks the athlete's Frame.io folder and returns the clips the picker may show:
// everything in SELECTED CLIPS first, then Approved clips found elsewhere.
export async function athletePickerClips(opts: {
  token: string;
  accountId: string;
  rootFolderId: string;
  selectedFolderId: string;
}): Promise<{ selected: PickerClip[]; approvedElsewhere: PickerClip[]; photos: PickerClip[] }> {
  const { token, accountId, rootFolderId, selectedFolderId } = opts;
  const selected: PickerClip[] = [];
  const approvedElsewhere: PickerClip[] = [];
  const photos: PickerClip[] = [];
  const seen = new Set<string>();

  for (const f of await listChildren(token, accountId, selectedFolderId)) {
    if (f.type === "folder") continue;
    const c = toClip(f, "selected", "SELECTED CLIPS");
    if (c && !seen.has(c.id)) { seen.add(c.id); selected.push(c); }
  }

  // inPhotos: we're inside the PHOTOS folder, where every image counts.
  const walk = async (folderId: string, path: string, depth: number, inPhotos: boolean) => {
    for (const f of await listChildren(token, accountId, folderId)) {
      if (f.type === "folder") {
        if (f.id === selectedFolderId || depth >= MAX_DEPTH || SKIP_FOLDERS.test(f.name.trim())) continue;
        await walk(f.id, path ? `${path} › ${f.name}` : f.name, depth + 1, inPhotos || isPhotoFolder(f.name));
        continue;
      }
      const c = toClip(f, "approved", path || "main folder");
      if (!c || seen.has(c.id)) continue;
      if (inPhotos && c.kind === "image") { seen.add(c.id); photos.push({ ...c, source: "photos" }); }
      else if (c.approved) { seen.add(c.id); approvedElsewhere.push(c); }
    }
  };
  await walk(rootFolderId, "", 0, false);

  const byName = (a: PickerClip, b: PickerClip) => a.name.localeCompare(b.name);
  return { selected: selected.sort(byName), approvedElsewhere: approvedElsewhere.sort(byName), photos: photos.sort(byName) };
}

// One file's fresh play/thumbnail links (they expire, so they're fetched
// whenever a saved carousel that uses the file is opened).
export async function frameioFileLinks(token: string, accountId: string, fileId: string) {
  const url = `${FRAMEIO_API}/accounts/${accountId}/files/${fileId}?include=${encodeURIComponent(INCLUDE)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Frame.io file ${fileId} (${res.status})`);
  const body = (await res.json()) as { data?: Asset };
  const c = body.data ? toClip(body.data, "selected", "") : null;
  return { play: c?.play ?? null, thumb: c?.thumb ?? null };
}
