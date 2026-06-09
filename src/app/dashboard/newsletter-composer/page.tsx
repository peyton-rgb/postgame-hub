"use client";

import { useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ *
 * Newsletter Composer — UI-only phase.
 * No Mailchimp calls, no database writes, no network requests.
 * Everything lives in React state and re-renders the live preview.
 * ------------------------------------------------------------------ */

const C = {
  bg: "#07070a",
  surface: "#0f0f0f",
  surface2: "#161616",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.13)",
  orange: "#D73F09",
  text: "#FAF8F5",
  text2: "rgba(250,248,245,0.6)",
  text3: "rgba(250,248,245,0.35)",
  caution: "#E8A33D",
};

const DISPLAY = "var(--font-bebas), 'Bebas Neue', Arial, sans-serif";

const S = {
  page: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Arial, sans-serif" } as const,
  header: {
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    padding: "14px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as const,
  body: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 0, height: "calc(100vh - 53px)" } as const,
  editorCol: { overflowY: "auto" as const, padding: 28, borderRight: `1px solid ${C.border}` },
  previewCol: { overflowY: "auto" as const, padding: 28, background: "#050507" },

  zoneLocked: {
    position: "relative" as const,
    background: C.surface,
    border: `1px dashed ${C.border2}`,
    borderRadius: 12,
    padding: 20,
    marginBottom: 18,
    opacity: 0.55,
    pointerEvents: "none" as const,
  },
  lockBadge: {
    position: "absolute" as const,
    top: 10,
    right: 12,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: C.text3,
    border: `1px solid ${C.border2}`,
    borderRadius: 6,
    padding: "3px 7px",
  },

  card: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: C.text3,
    marginBottom: 14,
  } as const,
  field: { marginBottom: 16 },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: C.text2,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: 6,
  } as const,
  input: {
    width: "100%",
    padding: "10px 12px",
    background: "#1a1a1a",
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    color: C.text,
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    background: "#1a1a1a",
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    color: C.text,
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    outline: "none",
    minHeight: 96,
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
    lineHeight: 1.5,
  },
  hint: { fontSize: 11, color: C.text3, marginTop: 5 },

  cautionChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginRight: 6,
    padding: "5px 10px",
    background: "rgba(232,163,61,0.12)",
    border: `1px solid rgba(232,163,61,0.4)`,
    borderRadius: 999,
    color: C.caution,
    fontSize: 11.5,
    fontWeight: 600,
    lineHeight: 1.3,
  } as const,

  actionsRow: { display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" as const },
  btnDisabled: {
    padding: "11px 20px",
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    color: C.text3,
    fontSize: 12.5,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    cursor: "not-allowed",
  } as const,
  backLink: { color: C.text2, fontSize: 13, textDecoration: "none", fontWeight: 600 } as const,

  /* ---- preview (mimics the real email feature zone) ---- */
  previewFrame: {
    maxWidth: 600,
    margin: "0 auto",
    background: "#0a0a0a",
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    overflow: "hidden",
  } as const,
  pMasthead: {
    background: "#000",
    padding: "26px 32px",
    textAlign: "center" as const,
    borderBottom: `2px solid ${C.orange}`,
  },
  pTagline: {
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: C.text2,
    marginTop: 12,
  } as const,
  pVisitBtn: {
    display: "inline-block",
    marginTop: 14,
    padding: "9px 20px",
    background: C.orange,
    color: "#fff",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    textDecoration: "none",
  } as const,
  pFeature: { padding: "28px 32px" },
  pHeadline: {
    fontFamily: DISPLAY,
    fontSize: 38,
    letterSpacing: "0.02em",
    lineHeight: 1.05,
    fontWeight: 400,
    color: C.text,
    margin: "0 0 16px",
  } as const,
  pBodyPara: { fontSize: 16, lineHeight: 1.6, color: "rgba(250,248,245,0.85)", margin: "0 0 14px" } as const,
  pBullets: { margin: "4px 0 18px", paddingLeft: 22 },
  pBullet: { color: C.orange, fontSize: 16, lineHeight: 1.6, fontWeight: 700, marginBottom: 6 } as const,
  pCtaLink: { color: C.orange, fontWeight: 700, textDecoration: "underline" } as const,
  pFooter: {
    background: "#000",
    padding: "22px 32px",
    textAlign: "center" as const,
    borderTop: `1px solid ${C.border}`,
  },
};

/* NCAA trademark guard — client-side, advisory only. Never auto-edits text. */
const BANNED: { phrase: string; suggestion: string }[] = [
  { phrase: "March Madness", suggestion: "the tournament" },
  { phrase: "Final Four", suggestion: "the national semifinal" },
  { phrase: "Elite Eight", suggestion: "the regional final" },
  { phrase: "Sweet Sixteen", suggestion: "the round of 16" },
];

function findBanned(text: string): { phrase: string; suggestion: string }[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return BANNED.filter((b) => lower.includes(b.phrase.toLowerCase()));
}

function CautionChips({ text }: { text: string }) {
  const hits = findBanned(text);
  if (hits.length === 0) return null;
  return (
    <div>
      {hits.map((h) => (
        <span key={h.phrase} style={S.cautionChip}>
          <span aria-hidden>⚠</span>
          <span>
            Avoid &ldquo;{h.phrase}&rdquo; (NCAA trademark) — try &ldquo;{h.suggestion}&rdquo;
          </span>
        </span>
      ))}
    </div>
  );
}

const DEFAULT_CTA = "Contact Postgame ASAP — info@pstgm.com";

export default function NewsletterComposerPage() {
  const [headline, setHeadline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bullets, setBullets] = useState("");
  const [cta, setCta] = useState(DEFAULT_CTA);

  const bodyParagraphs = bodyText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const bulletItems = bullets.split("\n").map((b) => b.trim()).filter(Boolean);

  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/dashboard" style={S.backLink}>
            ← Dashboard
          </Link>
          <span style={{ color: C.text3 }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Newsletter Composer</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: C.caution,
              border: `1px solid rgba(232,163,61,0.4)`,
              borderRadius: 6,
              padding: "3px 8px",
            }}
          >
            Draft · UI preview
          </span>
        </div>
      </div>

      {/* Two-column: editor | live preview */}
      <div style={S.body}>
        {/* -------------------- EDITOR -------------------- */}
        <div style={S.editorCol}>
          {/* Locked masthead */}
          <div style={S.zoneLocked}>
            <span style={S.lockBadge}>Locked</span>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Real logo asset — never a text wordmark */}
              <img
                src="/postgame-logo-white.png"
                alt="Postgame"
                style={{ height: 22, width: "auto", objectFit: "contain" }}
              />
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.text2 }}>
                  #1 Name, Image &amp; Likeness
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>Visit Our Website ›</div>
              </div>
            </div>
          </div>

          {/* Editable feature zone */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Feature Zone · Editable</div>

            <div style={S.field}>
              <label style={S.label}>Headline</label>
              <input
                style={S.input}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="There's Still Time to Activate Around the Tournament"
              />
              <CautionChips text={headline} />
            </div>

            <div style={S.field}>
              <label style={S.label}>Body</label>
              <textarea
                style={S.textarea}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Write the main message. Separate paragraphs with a blank line."
              />
              <div style={S.hint}>Tip: leave a blank line between paragraphs.</div>
              <CautionChips text={bodyText} />
            </div>

            <div style={S.field}>
              <label style={S.label}>
                Bullets <span style={{ color: C.text3, fontWeight: 400, textTransform: "none" }}>(optional · one per line)</span>
              </label>
              <textarea
                style={S.textarea}
                value={bullets}
                onChange={(e) => setBullets(e.target.value)}
                placeholder={"Partner with standout athletes\nCreate social-first content\nExecute on-site activations"}
              />
              <CautionChips text={bullets} />
            </div>

            <div style={S.field}>
              <label style={S.label}>Call to Action</label>
              <input
                style={S.input}
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder={DEFAULT_CTA}
              />
              <CautionChips text={cta} />
            </div>
          </div>

          {/* Locked footer */}
          <div style={S.zoneLocked}>
            <span style={S.lockBadge}>Locked</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: C.text2, fontSize: 12 }}>Instagram</span>
              <span style={{ color: C.text3 }}>·</span>
              <span style={{ color: C.text2, fontSize: 12 }}>TikTok</span>
              <span style={{ color: C.text3 }}>·</span>
              <span style={{ color: C.text2, fontSize: 12 }}>X</span>
            </div>
            <div style={{ textAlign: "center", color: C.text3, fontSize: 11, marginTop: 8 }}>
              You&apos;re receiving this because you opted in · Unsubscribe
            </div>
          </div>

          {/* Action buttons — present but disabled */}
          <div style={S.card}>
            <div style={S.actionsRow}>
              <button type="button" style={S.btnDisabled} disabled aria-disabled>
                Send test to myself
              </button>
              <button type="button" style={S.btnDisabled} disabled aria-disabled>
                Push to Mailchimp
              </button>
            </div>
            <div style={S.hint}>Connected in the next step.</div>
          </div>
        </div>

        {/* -------------------- LIVE PREVIEW -------------------- */}
        <div style={S.previewCol}>
          <div style={{ ...S.sectionTitle, marginBottom: 16 }}>Live Preview</div>
          <div style={S.previewFrame}>
            {/* masthead (mirrors locked zone) */}
            <div style={S.pMasthead}>
              <img
                src="/postgame-logo-white.png"
                alt="Postgame"
                style={{ height: 26, width: "auto", objectFit: "contain" }}
              />
              <div style={S.pTagline}>#1 Name, Image &amp; Likeness</div>
              <span style={S.pVisitBtn}>Visit Our Website</span>
            </div>

            {/* feature zone (live) */}
            <div style={S.pFeature}>
              <h1 style={S.pHeadline}>{headline || "Your headline appears here"}</h1>

              {bodyParagraphs.length > 0 ? (
                bodyParagraphs.map((p, i) => (
                  <p key={i} style={S.pBodyPara}>
                    {p}
                  </p>
                ))
              ) : (
                <p style={{ ...S.pBodyPara, color: C.text3 }}>Your body copy appears here…</p>
              )}

              {bulletItems.length > 0 && (
                <ul style={S.pBullets}>
                  {bulletItems.map((b, i) => (
                    <li key={i} style={S.pBullet}>
                      <span style={{ color: "rgba(250,248,245,0.85)", fontWeight: 400 }}>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {cta.trim() && (
                <p style={{ ...S.pBodyPara, marginBottom: 0 }}>
                  <a href="#" onClick={(e) => e.preventDefault()} style={S.pCtaLink}>
                    {cta}
                  </a>
                </p>
              )}
            </div>

            {/* footer (mirrors locked zone) */}
            <div style={S.pFooter}>
              <div style={{ color: C.text2, fontSize: 12 }}>Instagram · TikTok · X</div>
              <div style={{ color: C.text3, fontSize: 11, marginTop: 8 }}>
                You&apos;re receiving this because you opted in · Unsubscribe
              </div>
            </div>
          </div>

          <div style={{ ...S.hint, textAlign: "center", marginTop: 14 }}>
            Preview only — nothing here is sent or saved.
          </div>
        </div>
      </div>
    </div>
  );
}
