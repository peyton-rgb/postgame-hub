// ============================================================
// Brand icons for admin lists — the exact marks from the approved Hub
// admin prototype (files in /public/brand-marks, extracted from the
// prototype unchanged). Rows and cards show these instead of the full
// logo from the brands table when a brand has one here.
//
// Matching: brand name, lower-cased, punctuation stripped, then an exact
// alias lookup, then "starts with" (so "Postgame (Test)" → postgame,
// "Raising Cane's Football" → canes). Client-safe (no server imports).
// ============================================================

const FILES: Record<string, string> = {
  adidas: "adidas.png",
  adidas_w: "adidas_w.png",
  allstate: "allstate.svg",
  brooks: "brooks.png",
  burgerking: "burgerking.png",
  calvinklein: "calvinklein.png",
  canes: "canes.png",
  crocs: "crocs.png",
  cvs: "cvs.png",
  dove: "dove.png",
  drinklick: "drinklick.png",
  goodr: "goodr.png",
  hollister: "hollister.png",
  iherb: "iherb.png",
  mcdonalds: "mcdonalds.png",
  myfitnesspal: "myfitnesspal.png",
  papatui: "papatui.png",
  postgame: "postgame.png",
  wendys: "wendys.png",
  whoop: "whoop.png",
  zenni: "zenni.png",
};

/** White versions for dark backgrounds (falls back to the normal mark). */
const WHITE: Record<string, string> = { adidas: "adidas_w" };

/** normalized name → key (normalized = lower-case, letters/digits/spaces only) */
const ALIASES: Record<string, string> = {
  adidas: "adidas",
  whoop: "whoop",
  cvs: "cvs",
  "cvs health": "cvs",
  postgame: "postgame",
  allstate: "allstate",
  "raising canes": "canes",
  canes: "canes",
  crocs: "crocs",
  dove: "dove",
  goodr: "goodr",
  hollister: "hollister",
  iherb: "iherb",
  papatui: "papatui",
  wendys: "wendys",
  zenni: "zenni",
  brooks: "brooks",
  "brooks running": "brooks",
  mcdonalds: "mcdonalds",
  "burger king": "burgerking",
  burgerking: "burgerking",
  "drink lick": "drinklick",
  drinklick: "drinklick",
  "calvin klein": "calvinklein",
  calvinklein: "calvinklein",
  myfitnesspal: "myfitnesspal",
  "my fitness pal": "myfitnesspal",
  mfp: "myfitnesspal",
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function brandMarkKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = normalize(name);
  if (!n) return null;
  if (ALIASES[n]) return ALIASES[n];
  // longest alias that the name starts with ("raising canes football" → canes)
  let best: string | null = null;
  let bestLen = 0;
  for (const [alias, key] of Object.entries(ALIASES)) {
    if ((n === alias || n.startsWith(alias + " ")) && alias.length > bestLen) {
      best = key;
      bestLen = alias.length;
    }
  }
  return best;
}

/** URL of the prototype icon for this brand, or null when there isn't one. */
export function brandMarkUrl(name: string | null | undefined, opts?: { dark?: boolean }): string | null {
  const key = brandMarkKey(name);
  if (!key) return null;
  const k = opts?.dark && WHITE[key] ? WHITE[key] : key;
  return FILES[k] ? `/brand-marks/${FILES[k]}` : null;
}
