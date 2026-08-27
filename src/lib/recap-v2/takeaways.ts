// ============================================================
// Recap v2 — normalising the key_takeaways blob.
//
// One rich-text field holds three incompatible shapes across the 32 published
// campaigns that fill it in:
//
//   10  start with <ul> or <ol>       — the points ARE the content
//   10  start with <p>                — a lede, then supporting copy
//   12  are plain text, no markup     — one unbroken run of prose
//    2  contain <h3> headings
//    1  carries inline colour and font-size from the editor
//
// Average 692 characters, longest 3,700.
//
// The v2 design assumed shape 2 and styled `p:first-child` as a display line,
// so on the other 22 it produced nothing but a wall of undifferentiated text.
// This module classifies the blob first, and the section styles each shape on
// its own terms.
//
// What it deliberately does NOT do: invent structure. Plain text is rendered
// as prose, paragraph-split on blank lines only. Splitting sentences into
// bullets would be guessing at an author's intent and would read as though
// they had written a list when they had not.
// ============================================================

export type TakeawaysShape = "lede" | "points" | "prose";

export interface NormalisedTakeaways {
  shape: TakeawaysShape;
  /** Sanitised HTML, ready to inject. Empty when there is nothing to show. */
  html: string;
}

/**
 * Strip the editor's inline colour and font-size.
 *
 * Only those two declarations, and only from `style` attributes — the editor
 * writes `style="color: rgb(255,255,255); font-size: 14px"` on spans, which
 * overrides the page's own type scale and palette and is why one campaign's
 * takeaways rendered at 14px in pure white against a design that sets neither.
 * Other declarations (text-align, for instance) are left alone, and a `style`
 * attribute left empty is removed rather than kept as `style=""`.
 */
export function stripInlineTypography(html: string): string {
  return html.replace(/\sstyle="([^"]*)"/gi, (_full, decls: string) => {
    const kept = decls
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .filter((d) => !/^(color|font-size|font-family|background(-color)?)\s*:/i.test(d));
    return kept.length > 0 ? ` style="${kept.join("; ")}"` : "";
  });
}

/** Does this string contain any element markup at all? */
function hasMarkup(s: string): boolean {
  return /<[a-z][\s\S]*?>/i.test(s);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Drop a bullet character the author typed by hand.
 *
 * Several plain-text campaigns write their takeaways one point per line, using
 * a marker they typed themselves — "- Postgame utilised ...", and three
 * campaigns using a space-less "*Successfully contracted 16 athletes ...". The
 * marker is intent, not content: the line becomes its own paragraph either
 * way, and leaving a literal "-" or "*" at the head of a client-facing
 * sentence is worse than removing it.
 *
 * Two forms, and the guards on each matter:
 *
 *   marker + whitespace   The space is what keeps "-5% change" and
 *                         "*terms apply" intact.
 *   bare * or bullet      Only when it is the ONLY one on the line, because a
 *                         matched pair is emphasis ("*terms apply*") whereas a
 *                         single leading one cannot be. Hyphen is excluded
 *                         here — a space-less leading "-" is far more likely a
 *                         negative number than a bullet.
 *
 * A line that is nothing but a marker is left alone; stripping it would leave
 * an empty paragraph.
 */
function stripLeadingBullet(line: string): string {
  let out = line.replace(/^[-*\u2022\u2013\u2014]\s+/, "");
  if (out === line && /^[*\u2022]/.test(line)) {
    const markers = (line.match(/[*\u2022]/g) || []).length;
    if (markers === 1) out = line.slice(1).trimStart();
  }
  return out.trim().length > 0 ? out : line;
}

/**
 * Plain text to paragraphs. Split on blank lines, and on single newlines only
 * when the text uses them as its paragraph break (i.e. there are no blank
 * lines at all). Never on sentence boundaries.
 */
function proseToParagraphs(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const parts = /\n\s*\n/.test(trimmed)
    ? trimmed.split(/\n\s*\n/)
    : trimmed.split(/\n/);
  return parts
    .map((p) => stripLeadingBullet(p.trim()))
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
}

export function normaliseTakeaways(raw: string | null | undefined): NormalisedTakeaways {
  if (!raw) return { shape: "prose", html: "" };

  if (!hasMarkup(raw)) {
    const html = proseToParagraphs(raw);
    return { shape: "prose", html };
  }

  const cleaned = stripInlineTypography(raw).trim();

  // Is there any visible text once tags are gone? An empty <p></p> from the
  // editor should render nothing rather than an empty display line.
  const textOnly = cleaned
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  if (!textOnly && !/<(img|iframe)\b/i.test(cleaned)) {
    return { shape: "prose", html: "" };
  }

  // Classify on the FIRST block element, which is what decides whether there
  // is a lede to set large or whether the content opens straight into points.
  const firstTag = cleaned.match(/<\s*([a-z][a-z0-9]*)\b/i)?.[1]?.toLowerCase();
  if (firstTag === "ul" || firstTag === "ol") {
    return { shape: "points", html: cleaned };
  }
  if (firstTag === "p" || firstTag === "div" || firstTag === "span") {
    return { shape: "lede", html: cleaned };
  }
  // Opens on a heading or something else — treat it as points: there is no
  // paragraph to promote, so nothing should be set at display size.
  return { shape: "points", html: cleaned };
}
