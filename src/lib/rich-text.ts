// ============================================================
// Sanitiser for admin-authored rich text (campaign description, key
// takeaways) before it is injected with dangerouslySetInnerHTML.
//
// WHY. The recap renderers pass these fields straight through:
//   CampaignRecap.tsx                     settings.description, settings.key_takeaways
//   recap-v2/sections/OverviewSection     settings.description
//   recap-v2/sections/TakeawaysSection    settings.key_takeaways
// `dompurify` is a dependency but nothing in that path calls it. Recap pages
// are PUBLIC — /recap/[slug] serves them to anyone with the link — so whatever
// ends up in those columns is executed in a visitor's browser. Anyone who can
// edit a campaign in the admin can currently ship script to every viewer of
// that recap.
//
// SHAPE. A strict ALLOWLIST, default-deny in both directions: a tag not named
// below is dropped, and EVERY attribute is dropped except the two explicitly
// re-emitted. Event handlers (onclick, onerror), style, srcset and data-* are
// therefore unreachable by construction rather than by blocklist — there is no
// list of bad things to keep up to date.
//
// Dropping a tag keeps its TEXT. `<span style=...>hello</span>` becomes
// `hello`, never nothing. Sanitising must not silently delete delivered client
// copy.
//
// CALIBRATED AGAINST THE REAL CORPUS, not guessed. Every tag and attribute
// across all 636 campaigns' description and key_takeaways columns:
//   tags  p 302 · li 138 · strong 122 · ul 38 · br 34 · ol 12 · u 8 ·
//         blockquote 6 · a 4 · h3 4 · h2 4 · span 2
//   attrs start 2 · href 2 · style 1
// All twelve tags are allowed. href is validated and kept; `start` is kept on
// <ol> because it carries delivered numbering and only accepts digits. The one
// inline style is the entire cost of this change to existing recaps.
//
// No DOM required, so it runs in a server component. DOMPurify would mean
// adding jsdom to the server bundle for two fields.
// ============================================================

const ALLOWED = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li",
  "h2", "h3", "h4", "h5",
  "blockquote", "a", "span",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** http/https/mailto and site-relative only. javascript: and data: are rejected. */
function safeHref(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, "");
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

export function sanitizeRichHtml(input: string): string {
  let html = input;

  // Elements whose CONTENT must go too, not just their tags.
  html = html.replace(
    /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  // Unclosed forms of the same, then comments (which can hide markup).
  html = html.replace(
    /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[^>]*>/gi,
    ""
  );
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Rebuild every remaining tag from scratch. Nothing is edited in place, so
  // an attribute survives only if it is re-emitted here.
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
        // A link we cannot vouch for keeps its <a> but loses the href: inert,
        // and balanced against the </a> that follows.
        if (!href) return "<a>";
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
      }

      if (name === "ol") {
        // Digits only, so there is nothing to escape into.
        const m = /\bstart\s*=\s*"?(\d{1,4})"?/i.exec(attrs);
        return m ? `<ol start="${m[1]}">` : "<ol>";
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
 * Plain text to markup: "- ", "* " and "1." runs become a list, blank lines
 * separate paragraphs, single newlines become <br />. Escaped first, so this
 * path cannot introduce markup.
 *
 * NOT used by the recap renderers. They have rendered plain-text values as one
 * run-on block since they shipped, and changing that would alter the
 * appearance of recaps already delivered to clients. Only the brand portal,
 * which is new, formats them.
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
 * Sanitise, and additionally format plain text. Returns null when the value is
 * absent or holds nothing but whitespace and empty markup, so callers can show
 * a real empty state. Used by the brand portal; recaps use sanitizeRichHtml.
 */
export function richText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;

  const html = looksLikeHtml(trimmed) ? sanitizeRichHtml(trimmed) : plainTextToHtml(trimmed);
  if (html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "") return null;
  return html;
}
