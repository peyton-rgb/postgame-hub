// ============================================================
// Rich text for portal pages: campaign description and key takeaways.
//
// WHY THIS EXISTS RATHER THAN REUSING THE RECAP PAGES' APPROACH.
// The recap components (CampaignRecap.tsx, recap-v2/sections/*) pass these
// same fields straight into dangerouslySetInnerHTML with NO sanitising.
// dompurify is in package.json but nothing in the recap path calls it. So
// there was no existing sanitizer to share — copying that pattern into a
// client-facing portal would have carried the same gap forward.
//
// This is a strict ALLOWLIST, and it is default-deny: any tag not named below
// is dropped, and EVERY attribute is dropped except a validated href on <a>.
// That makes event handlers (onclick, onerror), style, srcset, and data-*
// unreachable by construction rather than by blocklist.
//
// It runs server-side with no dependency. DOMPurify would need a DOM, which
// means adding jsdom to the server bundle for two fields.
//
// THE FIELD HOLDS TWO DIFFERENT FORMATS. Verified against CVS: some rows are
// HTML ("<ol><li><p><strong>Maximize..."), others are plain text with newlines
// and "- " bullets ("- Postgame utilized a significant number..."), and some
// are the empty string. Sanitising alone would render the plain-text rows as
// one run-on paragraph, so the plain path gets its own conversion.
// ============================================================

/** Tags a campaign write-up legitimately needs. Everything else is dropped. */
const ALLOWED = new Set([
  "p", "br", "strong", "b", "em", "i", "u",
  "ul", "ol", "li",
  "h3", "h4", "h5",
  "blockquote", "a",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http/https/mailto survive; javascript: and data: are rejected. */
function safeHref(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, "");
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

export function sanitizeRichHtml(input: string): string {
  let html = input;

  // Elements whose CONTENT must go too, not just their tags.
  html = html.replace(/<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi, "");
  // Unclosed versions of the same, plus comments (which can hide markup).
  html = html.replace(/<(script|style|iframe|object|embed|noscript)\b[^>]*>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Rebuild every remaining tag from scratch. Nothing is edited in place, so
  // no attribute can survive unless it is re-emitted below.
  html = html.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (_m, slash: string, rawName: string, attrs: string) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED.has(name)) return "";
      if (slash) return `</${name}>`;
      if (name === "br") return "<br />";
      if (name === "a") {
        const m = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
        const href = m ? safeHref(m[2] ?? m[3] ?? m[4] ?? "") : null;
        // A link we cannot vouch for keeps its <a> but loses the href, which
        // is inert and — unlike dropping the open tag — stays balanced
        // against the </a> that follows.
        if (!href) return "<a>";
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
      }
      return `<${name}>`;
    }
  );

  return html.trim();
}

/** Does this look like markup, or like someone's plain typing? */
export function looksLikeHtml(s: string): boolean {
  return /<\s*\/?\s*[a-zA-Z][a-zA-Z0-9]*\b[^>]*>/.test(s);
}

/**
 * Plain text to markup: "- " and "* " and "•" runs become a list, blank lines
 * separate paragraphs, single newlines become <br />. Everything is escaped
 * first, so this path cannot introduce markup.
 */
export function plainTextToHtml(input: string): string {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    out.push(`<ul>${list.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>`);
    list = [];
  };
  const flushPara = () => {
    if (para.length === 0) return;
    out.push(`<p>${para.map(escapeHtml).join("<br />")}</p>`);
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      list.push(bullet[2]);
    } else if (line === "") {
      flushList();
      flushPara();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushList();
  flushPara();
  return out.join("");
}

/**
 * The one entry point a page should call. Returns ready-to-inject HTML, or
 * null when the field is absent or holds nothing but whitespace and empty
 * markup — so callers can render a real empty state instead of a blank panel.
 * (CVS has rows where key_takeaways is the empty string, and one that is only
 * "<p></p>".)
 */
export function richText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;

  const html = looksLikeHtml(trimmed)
    ? sanitizeRichHtml(trimmed)
    : plainTextToHtml(trimmed);

  // Strip tags to see whether any actual words survived.
  if (html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "") return null;
  return html;
}
