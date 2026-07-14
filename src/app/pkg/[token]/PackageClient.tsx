"use client";

import { useMemo, useState, useCallback } from "react";
import celebLibrary from "@/data/celebLibrary.json";
import {
  type AssetPackage,
  type BrandKit,
  type Talent,
  type TagRow,
  slugify,
  pickHeroLogo,
  brandLogos,
  brandFonts,
  brandGold,
} from "@/lib/packages";

// ============================================================
// Public package page — client-skinned from the brand kit.
//
// The tag generator is a straight port of the standalone
// Canes_Asset_Package_LIVE.html (renderTag / fitF / grad): a flat 1080×1920
// transparent tag — white BerthCity name (ALL CAPS, +10% tracking, soft drop
// shadow, NO trim/emboss), red #CC1824 Proxima subtitle, ~11px gold spine,
// anchored lower-left at the 6% margin. Constants are unchanged from the
// standalone. Nothing is stored: every tag renders on click and downloads.
// ============================================================

const TAG_RED = "#CC1824"; // subtitle ink — fixed by the tag spec
const GOLD_STOPS: [number, string][] = [
  [0, "#FFF4C4"],
  [0.46, "#E6B22C"],
  [0.74, "#C6921C"],
  [1, "#785412"],
];

function grad(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: [number, string][]
) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((s) => g.addColorStop(s[0], s[1]));
  return g;
}

// Shrink font until the text fits `lim`, mirroring the standalone.
function fitF(
  ctx: CanvasRenderingContext2D,
  t: string,
  fam: string,
  base: number,
  frac: number,
  lim: number,
  min: number
) {
  let s = base;
  for (; s > min; s -= 2) {
    ctx.font = "700 " + s + "px '" + fam + "'";
    ctx.letterSpacing = Math.round(s * frac) + "px";
    if (ctx.measureText(t).width <= lim) break;
  }
  return s;
}

function renderTag(name: string, sub: string): HTMLCanvasElement {
  const W = 1080,
    H = 1920,
    M = 65,
    SW = 11,
    GX = 20,
    TX = M + SW + GX,
    SAFE = W - TX - M,
    GB = 1836;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const NAME = (name || "").toUpperCase(),
    SUB = (sub || "").toUpperCase();
  // Fixed name size — no width-based auto-fit. Peyton: "one set size, don't
  // care about length." Every name renders at the same letter-height; long
  // names simply render wider, and the very longest run past the 1080px right
  // edge — that is intended and accepted.
  // TODO(optional): if clipping should later be avoided, floor ONLY names
  // physically wider than the frame (scale down just those). Not wanted now.
  const NAME_SIZE = 96;
  ctx.font = "700 " + NAME_SIZE + "px 'BerthCity'";
  ctx.letterSpacing = Math.round(NAME_SIZE * 0.1) + "px";
  const nm = ctx.measureText(NAME),
    nA = nm.actualBoundingBoxAscent,
    nD = nm.actualBoundingBoxDescent;
  let ssize = 0,
    sD = 0,
    sH = 0;
  if (SUB) {
    ssize = fitF(ctx, SUB, "Proxima", 44, 0.14, SAFE, 20);
    ctx.font = "700 " + ssize + "px 'Proxima'";
    ctx.letterSpacing = Math.round(ssize * 0.14) + "px";
    const sm = ctx.measureText(SUB);
    sD = sm.actualBoundingBoxDescent;
    sH = sm.actualBoundingBoxAscent + sD;
  }
  const nsGap = SUB ? Math.round(NAME_SIZE * 0.16) : 0;
  const subBottom = GB,
    subInkTop = subBottom - sH;
  const nameInkBottom = SUB ? subInkTop - nsGap : subBottom;
  const baseN = nameInkBottom - nD,
    nameInkTop = baseN - nA;
  // gold spine
  ctx.fillStyle = grad(ctx, nameInkTop, subBottom, GOLD_STOPS);
  ctx.fillRect(M, nameInkTop, SW, subBottom - nameInkTop);
  // white name w/ soft drop shadow — flat, no trim/emboss
  ctx.font = "700 " + NAME_SIZE + "px 'BerthCity'";
  ctx.letterSpacing = Math.round(NAME_SIZE * 0.1) + "px";
  ctx.save();
  ctx.shadowColor = "rgba(7,7,10,0.55)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(NAME, TX, baseN);
  ctx.restore();
  if (SUB) {
    ctx.font = "700 " + ssize + "px 'Proxima'";
    ctx.letterSpacing = Math.round(ssize * 0.14) + "px";
    ctx.fillStyle = TAG_RED;
    ctx.fillText(SUB, TX, subBottom - sD);
  }
  return cv;
}

// A small dark strip preview of the lower-left tag area (matches standalone).
function tagThumbURL(cv: HTMLCanvasElement): string {
  const t = document.createElement("canvas");
  const sw = 980,
    sh = 240,
    tw = 470,
    th = Math.round((sh * tw) / sw);
  t.width = tw;
  t.height = th;
  const c = t.getContext("2d")!;
  c.fillStyle = "#18181a";
  c.fillRect(0, 0, tw, th);
  c.drawImage(cv, 40, 1620, sw, sh, 0, 0, tw, th);
  return t.toDataURL("image/jpeg", 0.82);
}

let fontsReady: Promise<void> | null = null;
function ensureTagFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      if (typeof document !== "undefined" && (document as any).fonts?.load) {
        try {
          await Promise.all([
            (document as any).fonts.load("700 100px 'BerthCity'"),
            (document as any).fonts.load("700 40px 'Proxima'"),
          ]);
        } catch {
          /* fall through — fitF still measures with whatever loaded */
        }
      }
    })();
  }
  return fontsReady;
}

function triggerDownload(blobUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadRemote(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("bad status");
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    triggerDownload(objUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
  } catch {
    // Cross-origin without CORS — open the asset so they can save it.
    window.open(url, "_blank", "noopener");
  }
}

export default function PackageClient({
  pkg,
  brand,
  talent,
}: {
  pkg: AssetPackage;
  brand: BrandKit;
  talent: Talent[];
}) {
  const [query, setQuery] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [customName, setCustomName] = useState("");
  const [customBio, setCustomBio] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const red = brand.primary_color || "#D71C2E";
  const yellow = brand.secondary_color || "#FFDD00";
  const gold = brandGold(brand);
  const heroLogo = pickHeroLogo(brand);
  const logos = useMemo(() => brandLogos(brand), [brand]);
  const colors = brand.brand_colors || [];
  const fonts = useMemo(() => brandFonts(brand), [brand]);
  const rosterLabel = pkg.roster_label || "Names";

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  // Roster rows (ranked + status chips) followed by the shared celeb library,
  // de-duped by slug. Search runs across the whole set; an empty query shows
  // just the campaign roster (the point of the package).
  const roster: TagRow[] = useMemo(() => {
    return talent.map((t, i) => {
      const s = t.status || "";
      const statusShort: TagRow["statusShort"] =
        s === "confirmed_2026" ? "2026" : s === "past_attendee" ? "PAST" : "";
      return {
        name: t.name,
        subtext: t.subtext || "",
        slug: t.slug || slugify(t.name),
        tag_url: t.tag_url,
        rank: i + 1,
        pin: s === "alist",
        statusShort,
        source: "roster" as const,
      };
    });
  }, [talent]);

  const library: TagRow[] = useMemo(() => {
    const have = new Set(roster.map((r) => r.slug));
    return (celebLibrary as { name: string; subtext: string; slug: string }[])
      .filter((c) => !have.has(c.slug))
      .map((c) => ({
        name: c.name,
        subtext: c.subtext || "",
        slug: c.slug,
        tag_url: null,
        source: "library" as const,
      }));
  }, [roster]);

  const total = roster.length + library.length;

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return roster;
    const match = (r: TagRow) =>
      r.name.toLowerCase().includes(t) || r.subtext.toLowerCase().includes(t);
    const hits = [...roster.filter(match), ...library.filter(match)];
    return hits.slice(0, 300); // guardrail: cap the DOM on broad queries
  }, [query, roster, library]);

  const generate = useCallback(
    async (row: TagRow) => {
      const key = row.slug;
      // Pre-rendered tag on the row → download that instead (future: tag_url).
      if (row.tag_url) {
        downloadRemote(row.tag_url, `${key}.png`);
        showToast(`Downloading ${key}.png`);
        return;
      }
      if (busy[key]) return;
      setBusy((b) => ({ ...b, [key]: true }));
      try {
        await ensureTagFonts();
        const cv = renderTag(row.name, row.subtext);
        setThumbs((m) => ({ ...m, [key]: tagThumbURL(cv) }));
        await new Promise<void>((resolve) =>
          cv.toBlob((b) => {
            if (b) {
              const u = URL.createObjectURL(b);
              triggerDownload(u, `${key}.png`);
              setTimeout(() => URL.revokeObjectURL(u), 4000);
            }
            resolve();
          }, "image/png")
        );
        showToast(`Downloading ${key}.png`);
      } finally {
        setBusy((b) => ({ ...b, [key]: false }));
      }
    },
    [busy, showToast]
  );

  const generateCustom = useCallback(async () => {
    const nm = customName.trim();
    if (!nm) return;
    const key = slugify(nm) || "tag";
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await ensureTagFonts();
      const cv = renderTag(nm, customBio.trim());
      await new Promise<void>((resolve) =>
        cv.toBlob((b) => {
          if (b) {
            const u = URL.createObjectURL(b);
            triggerDownload(u, `${key}.png`);
            setTimeout(() => URL.revokeObjectURL(u), 4000);
          }
          resolve();
        }, "image/png")
      );
      showToast(`Downloading ${key}.png`);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  }, [customName, customBio, showToast]);

  const noMatches = query.trim() !== "" && filtered.length === 0;

  return (
    <div
      className="pkg"
      style={
        {
          "--pk-red": red,
          "--pk-yellow": yellow,
          "--pk-gold": gold,
        } as React.CSSProperties
      }
    >
      <div className="wrap">
        {/* Hero */}
        <div className="hero">
          {heroLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="logo" src={heroLogo} alt={brand.name} />
          ) : null}
          <div className="hero-txt">
            <h1>{pkg.name}</h1>
            <p>Editor asset package</p>
          </div>
        </div>

        {/* Logos */}
        <h2 className="sec">
          <span className="bar" />
          Logos
        </h2>
        <div className="pad">
          {logos.length ? (
            <div className="logos">
              {logos.map((L) => (
                <div className="logocard" key={L.url}>
                  <div className={"logoview " + (L.onColor ? "onred" : "light")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={L.url} alt={`${brand.name} ${L.label} logo`} />
                  </div>
                  <div className="logometa">
                    <span className="lb">{L.label}</span>
                    <button
                      className="btn dl"
                      onClick={() => {
                        downloadRemote(L.url, L.file);
                        showToast(`Downloading ${L.file}`);
                      }}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mut">Logo files coming soon.</p>
          )}
        </div>

        {/* Colors */}
        <h2 className="sec">
          <span className="bar" />
          Colors <span className="hint">&nbsp;click to copy hex</span>
        </h2>
        <div className="pad">
          <div className="cols">
            {colors.map((c) => (
              <button
                className="swatch"
                key={c.hex + c.name}
                title="Click to copy"
                onClick={() => {
                  navigator.clipboard?.writeText(c.hex).catch(() => {});
                  showToast(`Copied ${c.hex}`);
                }}
              >
                <div
                  className="chip"
                  style={{
                    background: c.hex,
                    borderBottom:
                      c.hex.toUpperCase() === "#FFFFFF"
                        ? "1px solid var(--pk-line)"
                        : undefined,
                  }}
                />
                <div className="info">
                  <div className="nm">{c.name}</div>
                  <div className="hex">{c.hex}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Fonts */}
        <h2 className="sec">
          <span className="bar" />
          Fonts
        </h2>
        <div className="pad">
          {/* Bind non-bundled brand fonts to their url so their specimen renders
              in the real face. Bundled faces are already @font-face'd globally. */}
          {fonts.some((f) => f.faceUrl) ? (
            <style
              dangerouslySetInnerHTML={{
                __html: fonts
                  .filter((f) => f.faceUrl)
                  .map(
                    (f) =>
                      `@font-face{font-family:'${f.family}';src:url('${f.faceUrl}') format('opentype');font-display:swap;}`
                  )
                  .join("\n"),
              }}
            />
          ) : null}
          <div className="fonts">
            {fonts.map((f) => (
              <div className="fontcard" key={f.name}>
                <div className="big" style={{ fontFamily: `'${f.family}'` }}>
                  Aa Bb Cc
                </div>
                <div className="fn">{f.name}</div>
                <div className="fr">{f.role}</div>
                {f.files.length ? (
                  <button
                    className="btn dl fontbtn"
                    onClick={() => {
                      f.files.forEach((file) =>
                        triggerDownload(file, file.split("/").pop() || "font.otf")
                      );
                      showToast(`Downloading ${f.name}`);
                    }}
                  >
                    Download {f.files.length > 1 ? "family" : "font"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Name tags */}
        <h2 className="sec">
          <span className="bar" />
          Name tags{" "}
          <span className="hint">&nbsp;search a name, download the tag</span>
        </h2>
        <div className="searchbar">
          <div className="searchbox">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a name…"
              autoComplete="off"
            />
          </div>
          <div className="meta">
            <b>{filtered.length}</b> of <b>{total}</b> {rosterLabel.toLowerCase()}{" "}
            shown
          </div>
        </div>

        <div className="list">
          {noMatches ? (
            <div className="custom">
              <div className="ct">
                No match for &ldquo;{query.trim()}&rdquo; — make a tag anyway
              </div>
              <input
                className="cin"
                placeholder="Name"
                value={customName || query.trim()}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <input
                className="cin"
                placeholder="Short bio / accolade (optional)"
                value={customBio}
                onChange={(e) => setCustomBio(e.target.value)}
              />
              <button
                className="btn gen"
                onClick={() => {
                  if (!customName) setCustomName(query.trim());
                  generateCustom();
                }}
              >
                ✦ Generate tag
              </button>
            </div>
          ) : (
            filtered.map((r) => {
              // Pre-rendered stored PNG (top ~100) → instant thumbnail + direct
              // download, no canvas. Rows without tag_url keep generate-on-click.
              const pre = !!r.tag_url;
              const thumb = thumbs[r.slug]; // client-generated strip (on-click rows)
              const isBusy = busy[r.slug];
              const ready = pre || !!thumb;
              return (
                <div className={"row " + (r.pin ? "pin" : "")} key={r.source + r.slug}>
                  <div className="rank">{r.rank ?? "•"}</div>
                  <div className="thumbwrap">
                    {pre ? (
                      // Full stored tag, CSS-cropped to the name band (bottom).
                      <div className="thumb tagimg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.tag_url!} alt={`${r.name} name tag`} loading="lazy" />
                      </div>
                    ) : thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="thumb" src={thumb} alt={`${r.name} name tag`} />
                    ) : (
                      <div className="thumb gen">{r.name}</div>
                    )}
                  </div>
                  {r.statusShort ? (
                    <span
                      className={
                        "chip2 " + (r.statusShort === "PAST" ? "past" : "conf")
                      }
                    >
                      {r.statusShort}
                    </span>
                  ) : null}
                  <div className="sp" />
                  <button
                    className={"btn " + (ready ? "dl" : "gen")}
                    disabled={isBusy}
                    onClick={() => generate(r)}
                  >
                    {isBusy
                      ? "Generating…"
                      : ready
                        ? "↓ Download tag"
                        : "✦ Generate tag"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="foot">
          Tags generate on click, in-browser · logos, colors &amp; fonts
          included · nothing to install.
        </div>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}

      {/* Fonts the canvas + specimens need. Global so @font-face registers. */}
      <style jsx global>{`
        @font-face {
          font-family: "Veneer";
          src: url("/fonts/veneer.otf") format("opentype");
          font-display: swap;
        }
        @font-face {
          font-family: "BerthCity";
          src: url("/fonts/berthold-city-bold.otf") format("opentype");
          font-weight: 700;
          font-display: swap;
        }
        @font-face {
          font-family: "Proxima";
          src: url("/fonts/proxima-nova-regular.otf") format("opentype");
          font-weight: 400;
          font-display: swap;
        }
        @font-face {
          font-family: "Proxima";
          src: url("/fonts/proxima-nova-bold.otf") format("opentype");
          font-weight: 700;
          font-display: swap;
        }
      `}</style>

      <style jsx>{`
        .pkg {
          --pk-ink: #141414;
          --pk-paper: #fbf6e9;
          --pk-line: #eadfbe;
          min-height: 100vh;
          background: var(--pk-paper);
          color: var(--pk-ink);
          font-family: "Proxima", Arial, sans-serif;
          padding: 22px;
        }
        .wrap {
          max-width: 1020px;
          margin: 0 auto;
          background: #fff;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 10px 34px rgba(0, 0, 0, 0.12);
        }
        .hero {
          background: var(--pk-red);
          padding: 22px 30px;
          display: flex;
          align-items: center;
          gap: 20px;
          border-bottom: 5px solid var(--pk-yellow);
        }
        .hero .logo {
          height: 60px;
          max-width: 220px;
          object-fit: contain;
        }
        .hero h1 {
          font-family: "Veneer", Impact, sans-serif;
          color: #fff;
          font-size: 32px;
          letter-spacing: 1px;
          text-transform: uppercase;
          line-height: 0.95;
        }
        .hero p {
          color: var(--pk-yellow);
          font-size: 12px;
          letter-spacing: 1px;
          margin-top: 5px;
          text-transform: uppercase;
          font-weight: 700;
        }
        .sec {
          font-family: "Veneer", sans-serif;
          font-size: 18px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--pk-red);
          padding: 20px 30px 0;
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .sec .bar {
          width: 20px;
          height: 5px;
          background: var(--pk-yellow);
        }
        .sec .hint {
          font-family: "Proxima";
          font-size: 11px;
          color: #9a8a63;
          text-transform: none;
          letter-spacing: 0;
          font-weight: 400;
        }
        .pad {
          padding: 14px 30px 4px;
        }
        .mut {
          color: #9a8a63;
          font-size: 13px;
        }
        .logos {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .logocard {
          border: 1px solid var(--pk-line);
          border-radius: 12px;
          overflow: hidden;
        }
        .logoview {
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 15px;
        }
        .logoview.light {
          background: #fff;
        }
        .logoview.onred {
          background: var(--pk-red);
        }
        .logoview img {
          max-width: 100%;
          max-height: 100%;
        }
        .logometa {
          padding: 9px 11px;
          border-top: 1px solid var(--pk-line);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logometa .lb {
          font-size: 12px;
          font-weight: 700;
        }
        .cols {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
        }
        .swatch {
          border: 1px solid var(--pk-line);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          text-align: left;
          padding: 0;
          background: #fff;
          font: inherit;
        }
        .swatch:hover {
          transform: translateY(-2px);
        }
        .swatch .chip {
          height: 64px;
        }
        .swatch .info {
          padding: 8px 10px;
        }
        .swatch .nm {
          font-size: 12px;
          font-weight: 700;
        }
        .swatch .hex {
          font-family: monospace;
          font-size: 12px;
          color: #7a6a45;
          margin-top: 3px;
        }
        .swatch:hover .hex {
          color: var(--pk-red);
        }
        .fonts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .fontcard {
          border: 1px solid var(--pk-line);
          border-radius: 12px;
          padding: 14px 16px;
        }
        .fontcard .big {
          font-size: 30px;
          line-height: 1.05;
        }
        .fontcard .fn {
          font-size: 12px;
          font-weight: 700;
          margin-top: 8px;
        }
        .fontcard .fr {
          font-size: 11px;
          color: #9a8a63;
        }
        .fontbtn {
          margin-top: 10px;
        }
        .btn {
          font-family: "Proxima", sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          border: none;
          border-radius: 9px;
          padding: 9px 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn.dl {
          background: var(--pk-red);
          color: #fff;
        }
        .btn.dl:hover {
          filter: brightness(0.92);
        }
        .btn.gen {
          background: #fff;
          color: var(--pk-red);
          border: 1.5px solid var(--pk-red);
        }
        .btn.gen:hover {
          background: var(--pk-red);
          color: #fff;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .searchbar {
          padding: 8px 30px;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 5;
          border-top: 1px solid var(--pk-line);
          margin-top: 14px;
        }
        .searchbox {
          position: relative;
        }
        .searchbox input {
          width: 100%;
          padding: 14px 16px;
          font-size: 17px;
          font-family: "Proxima";
          border: 2px solid var(--pk-ink);
          border-radius: 12px;
          outline: none;
        }
        .searchbox input:focus {
          border-color: var(--pk-red);
        }
        .meta {
          margin-top: 8px;
          font-size: 11px;
          color: #8a7c5a;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .meta b {
          color: var(--pk-red);
        }
        .list {
          padding: 4px 18px 20px;
          max-height: 58vh;
          overflow: auto;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 12px;
          border-radius: 11px;
          border: 1px solid transparent;
        }
        .row:nth-child(even) {
          background: #fbf7ec;
        }
        .row:hover {
          border-color: #eaddba;
        }
        .rank {
          font-family: "BerthCity", sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: #c9b478;
          min-width: 30px;
          text-align: center;
        }
        .row.pin .rank {
          color: var(--pk-red);
        }
        .thumbwrap {
          display: flex;
          align-items: center;
        }
        .thumb {
          height: 64px;
          border-radius: 8px;
          display: block;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
        }
        .thumb.gen {
          min-width: 200px;
          background: #1a1a1c;
          color: #fff;
          font-family: "BerthCity", sans-serif;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          font-size: 17px;
          border: 1px dashed #4a4a4e;
        }
        /* Stored 1080×1920 tag, CSS-cropped to its lower name band so the row
           preview matches the on-click generated strip. */
        .thumb.tagimg {
          height: 64px;
          width: 230px;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: #18181a;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
        }
        .thumb.tagimg img {
          width: 230px;
          height: auto;
          display: block;
        }
        .chip2 {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 3px 7px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .chip2.conf {
          background: #e3f4e8;
          color: #1c7a3e;
        }
        .chip2.past {
          background: #efe9d9;
          color: #8a7c5a;
        }
        .sp {
          flex: 1;
          min-width: 8px;
        }
        .custom {
          padding: 26px 16px;
          text-align: center;
        }
        .custom .ct {
          color: #8a7c5a;
          font-size: 14px;
          margin-bottom: 14px;
        }
        .custom .cin {
          display: block;
          width: 100%;
          max-width: 460px;
          margin: 0 auto 10px;
          padding: 11px 13px;
          border: 1.5px solid var(--pk-line);
          border-radius: 9px;
          font-family: "Proxima";
          font-size: 14px;
          outline: none;
        }
        .custom .cin:focus {
          border-color: var(--pk-red);
        }
        .foot {
          padding: 13px 30px;
          background: var(--pk-yellow);
          color: #5c4a12;
          font-size: 11px;
          font-weight: 600;
        }
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--pk-ink);
          color: #fff;
          padding: 11px 20px;
          border-radius: 30px;
          font-size: 13px;
          z-index: 99;
        }
        @media (max-width: 720px) {
          .logos,
          .fonts {
            grid-template-columns: repeat(2, 1fr);
          }
          .cols {
            grid-template-columns: repeat(3, 1fr);
          }
          .thumb.gen {
            min-width: 120px;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
