// ============================================================
// SVG export for an app card — the same geometry CardArt draws,
// written out at the card's full canvas (1080×1920 / 1080×1080 /
// 1920×380) as a vector file. Runs in the browser (Export SVG button)
// but has no DOM dependency so it can be unit-tested or moved server
// side later.
//
// Media and the brand logo are referenced by URL (<image href>), not
// embedded, so the file stays small; a video card exports its poster
// still. Text uses Poppins by name — the viewer needs the font installed
// or the SVG falls back to the system sans.
// ============================================================

import { CARD_SPEC, DEFAULT_BG, isVideoUrl, type CardDraft } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const FONT = "Poppins, 'Helvetica Neue', Arial, sans-serif";

export function buildCardSvg(d: CardDraft, brandLogoUrl: string | null): string {
  const { width: W, height: H } = CARD_SPEC[d.card_type];
  const bg = d.bg_color || DEFAULT_BG;
  const still = isVideoUrl(d.media_url) ? d.poster_url || "" : d.media_url;
  const u = W / 100; // 1cqw at full size

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${esc(bg)}"/>`);
  if (still) {
    parts.push(`<image href="${esc(still)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  if (d.card_type === "optin") {
    if (d.eyebrow) {
      parts.push(
        `<text x="${W / 2}" y="${10.6 * u + 3.8 * u}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${3.8 * u}" letter-spacing="${0.3 * 3.8 * u}" fill="#fff">${esc(d.eyebrow)}</text>`
      );
    }
    const logoH = 16 * u;
    const logoW = 60 * u;
    const logoBottom = H - 27 * u;
    if (brandLogoUrl) {
      parts.push(
        `<image href="${esc(brandLogoUrl)}" x="${(W - logoW) / 2}" y="${logoBottom - logoH}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMax meet"/>`
      );
    }
    if (d.headline) {
      parts.push(
        `<text x="${W / 2}" y="${logoBottom + 3 * u + 3.4 * u}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${3.4 * u}" letter-spacing="${0.12 * 3.4 * u}" fill="#fff">${esc(d.headline.toUpperCase())}</text>`
      );
    }
    if (d.cta_label) {
      const label = `${d.cta_label} ›`;
      const fs = 3.8 * u;
      const padX = 7 * u;
      const padY = 3.2 * u;
      const textW = label.length * fs * 0.68;
      const pillW = textW + padX * 2;
      const pillH = fs + padY * 2;
      const y = H - 11.8 * u - pillH;
      parts.push(
        `<rect x="${(W - pillW) / 2}" y="${y}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="#D73F09"/>`,
        `<text x="${W / 2}" y="${y + padY + fs * 0.82}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${fs}" letter-spacing="${0.06 * fs}" fill="#fff">${esc(label)}</text>`
      );
    }
  } else if (d.card_type === "coming_soon") {
    if (still) parts.push(`<rect width="${W}" height="${H}" fill="rgba(0,0,0,0.35)"/>`);
    if (d.eyebrow) {
      const fs = 13 * u;
      const lines = d.eyebrow.split(/\s+/).filter(Boolean);
      const first = lines.shift() ?? "";
      const rest = lines.join(" ");
      parts.push(
        `<text x="${6.5 * u}" y="${26 * u + fs * 0.88}" font-family="${FONT}" font-weight="800" font-size="${fs}" fill="#fff">${esc(first)}</text>`
      );
      if (rest) {
        parts.push(
          `<text x="${6.5 * u}" y="${26 * u + fs * 0.88 + fs * 1.05}" font-family="${FONT}" font-weight="800" font-size="${fs}" fill="#fff">${esc(rest)}</text>`
        );
      }
    }
    if (d.headline) {
      parts.push(
        `<text x="${6.5 * u}" y="${62 * u + 3.2 * u}" font-family="${FONT}" font-weight="700" font-size="${3.2 * u}" letter-spacing="${0.14 * 3.2 * u}" fill="#fff">${esc(d.headline.toUpperCase())}</text>`
      );
    }
    if (brandLogoUrl) {
      const logoH = 12 * u;
      const logoW = 50 * u;
      parts.push(
        `<image href="${esc(brandLogoUrl)}" x="${6.5 * u}" y="${H - 8 * u - logoH}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMinYMax meet"/>`
      );
    }
  } else {
    // strip banner
    const logoH = 10 * u;
    const logoW = 22 * u;
    let x = 3 * u;
    if (brandLogoUrl) {
      parts.push(
        `<image href="${esc(brandLogoUrl)}" x="${x}" y="${(H - logoH) / 2}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMinYMid meet"/>`
      );
      x += logoW + 2 * u;
    }
    const text = d.headline || d.name;
    if (text) {
      parts.push(
        `<text x="${x}" y="${H / 2 + 3.4 * u * 0.35}" font-family="${FONT}" font-weight="700" font-size="${3.4 * u}" fill="#fff">${esc(text)}</text>`
      );
    }
    parts.push(
      `<text x="${W - 3 * u}" y="${H / 2 + 4 * u * 0.35}" text-anchor="end" font-family="${FONT}" font-weight="800" font-size="${4 * u}" fill="#D73F09">›</text>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<title>${esc(d.name || "Postgame app card")}</title>\n${parts.join("\n")}\n</svg>\n`;
}

/** Safe file name for the download. */
export function svgFileName(d: CardDraft): string {
  const base = (d.name || "card").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "card";
  const { width, height } = CARD_SPEC[d.card_type];
  return `${base}-${width}x${height}.svg`;
}
