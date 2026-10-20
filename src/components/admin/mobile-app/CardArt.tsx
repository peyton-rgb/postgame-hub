// ============================================================
// CardArt — one app card, drawn the way the athlete app draws it.
// Pure render (no hooks): the editor renders it from live form state,
// the feed preview renders it on the server. Geometry follows the
// prototype's .mc-prev / .fd-card rules, expressed in container-query
// units (cqw = 1% of the card's own width) so the same markup is right
// at 340px in the editor and ~300px inside the phone frame.
//
// The brand mark is always the brands row's light-ink logo file. When a
// card has no brand yet the editor shows a "BRAND LOGO" slot; the feed
// shows nothing in its place — a brand name is never typed as a logo.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { CARD_SPEC, DEFAULT_BG, isVideoUrl, type CardType } from "@/lib/admin/mobile-app/cards";

export interface CardArtProps {
  type: CardType;
  bgColor: string | null;
  mediaUrl: string | null;
  posterUrl: string | null;
  eyebrow: string | null;
  headline: string | null;
  ctaLabel: string | null;
  brandLogoUrl: string | null;
  brandName: string | null;
  /** editor mode: show upload / logo slots when things are missing */
  placeholders?: boolean;
  /** strip banner only: the text shown beside the logo */
  stripText?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

const POPPINS = "var(--font-poppins), Poppins, system-ui, sans-serif";

function Media({ mediaUrl, posterUrl, dim }: { mediaUrl: string | null; posterUrl: string | null; dim: boolean }) {
  if (!mediaUrl) return null;
  const common: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
  return (
    <>
      {isVideoUrl(mediaUrl) ? (
        <video src={mediaUrl} poster={posterUrl ?? undefined} muted playsInline loop autoPlay style={common} />
      ) : (
        <img src={mediaUrl} alt="" style={common} />
      )}
      {dim && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)" }} />}
    </>
  );
}

function Logo({
  url,
  name,
  placeholder,
  maxH,
  maxW,
  align = "center",
}: {
  url: string | null;
  name: string | null;
  placeholder: boolean;
  maxH: string;
  maxW: string;
  align?: "center" | "left";
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name} logo` : ""}
        style={{ maxHeight: maxH, maxWidth: maxW, width: "auto", height: "auto", objectFit: "contain", display: "block", margin: align === "center" ? "0 auto" : 0 }}
      />
    );
  }
  if (!placeholder) return null;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "2.6cqw",
        letterSpacing: ".1em",
        fontWeight: 700,
        opacity: 0.6,
        border: "1px dashed rgba(255,255,255,.5)",
        borderRadius: "1cqw",
        padding: "1.5cqw 3cqw",
      }}
    >
      BRAND LOGO
    </span>
  );
}

export default function CardArt(p: CardArtProps) {
  const spec = CARD_SPEC[p.type];
  const empty = !p.mediaUrl;
  const bg = p.bgColor || DEFAULT_BG;
  const base: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    aspectRatio: `${spec.width} / ${spec.height}`,
    width: "100%",
    background: empty && p.placeholders ? "#E9EBEE" : bg,
    color: empty && p.placeholders ? "#555" : "#fff",
    fontFamily: POPPINS,
    containerType: "inline-size",
    ...p.style,
  };
  const ph = (text: string, top = "50%") =>
    p.placeholders && empty ? (
      <div style={{ position: "absolute", top, left: 0, right: 0, textAlign: "center", fontSize: "3.8cqw", fontWeight: 600, transform: "translateY(-50%)", padding: "0 6cqw" }}>
        {text}
      </div>
    ) : null;

  if (p.type === "optin") {
    return (
      <div className={p.className} style={{ ...base, borderRadius: "2.4cqw" }}>
        <Media mediaUrl={p.mediaUrl} posterUrl={p.posterUrl} dim={false} />
        {p.eyebrow && (
          <div style={{ position: "absolute", top: "10.6cqw", left: 0, right: 0, textAlign: "center", fontWeight: 800, letterSpacing: ".3em", fontSize: "3.8cqw", opacity: empty && p.placeholders ? 0.8 : 1 }}>
            {p.eyebrow}
          </div>
        )}
        {ph("Upload a vertical video or photo")}
        <div style={{ position: "absolute", bottom: "27cqw", left: 0, right: 0, textAlign: "center", padding: "0 10cqw" }}>
          <Logo url={p.brandLogoUrl} name={p.brandName} placeholder={!!p.placeholders} maxH="16cqw" maxW="60cqw" />
          {p.headline && (
            <div style={{ marginTop: "3cqw", fontSize: "3.4cqw", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>{p.headline}</div>
          )}
        </div>
        {p.ctaLabel && (
          <div
            style={{
              position: "absolute",
              bottom: "11.8cqw",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#D73F09",
              color: "#fff",
              fontWeight: 800,
              fontSize: "3.8cqw",
              letterSpacing: ".06em",
              padding: "3.2cqw 7cqw",
              borderRadius: "999px",
              whiteSpace: "nowrap",
            }}
          >
            {p.ctaLabel}&nbsp;›
          </div>
        )}
      </div>
    );
  }

  if (p.type === "coming_soon") {
    return (
      <div className={p.className} style={{ ...base, borderRadius: "2.4cqw", background: empty && p.placeholders ? "#E9EBEE" : bg }}>
        <Media mediaUrl={p.mediaUrl} posterUrl={p.posterUrl} dim />
        {p.eyebrow && (
          <div style={{ position: "absolute", top: "26cqw", left: "6.5cqw", right: "6.5cqw", fontWeight: 800, fontSize: "13cqw", lineHeight: 1.05, whiteSpace: "pre-line" }}>
            {p.eyebrow.replace(/\s+/, "\n")}
          </div>
        )}
        {ph("Upload a square video or photo")}
        {p.headline && (
          <div style={{ position: "absolute", top: "62cqw", left: "6.5cqw", right: "6.5cqw", fontSize: "3.2cqw", letterSpacing: ".14em", fontWeight: 700, textTransform: "uppercase" }}>
            {p.headline}
          </div>
        )}
        <div style={{ position: "absolute", bottom: "8cqw", left: "6.5cqw" }}>
          <Logo url={p.brandLogoUrl} name={p.brandName} placeholder={!!p.placeholders} maxH="12cqw" maxW="50cqw" align="left" />
        </div>
      </div>
    );
  }

  // strip banner
  return (
    <div className={p.className} style={{ ...base, borderRadius: "1.2cqw" }}>
      <Media mediaUrl={p.mediaUrl} posterUrl={p.posterUrl} dim={false} />
      {ph("Upload a 1920 × 380 banner")}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: "2cqw", padding: "0 3cqw" }}>
        <Logo url={p.brandLogoUrl} name={p.brandName} placeholder={!!p.placeholders && !p.stripText} maxH="10cqw" maxW="22cqw" align="left" />
        {(p.stripText || p.headline) && (
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700, fontSize: "3.4cqw" }}>
            {p.stripText || p.headline}
          </span>
        )}
        <span style={{ color: "#D73F09", fontWeight: 800, fontSize: "4cqw" }}>›</span>
      </div>
    </div>
  );
}
