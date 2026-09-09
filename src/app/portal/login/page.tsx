import type { Metadata } from "next";
import { BG, OFFWHITE, HAIR, MONO, BEBAS, ORANGE, CARD, CARD_B } from "@/lib/portal";
import { arimo } from "@/components/portal/fonts";
import { getPostgameMark } from "@/lib/portal-data";
import { startPortalOAuth } from "./actions";

// ============================================================
// The brand portal's front door.
//
// Two providers, equal weight. No email field: with OAuth the provider
// authenticates first and we check the address it returns, so there is
// nothing to type here and nothing to look up before the handshake.
//
// Every message on this page is deliberately identical in what it
// reveals — none of them confirms whether an address exists anywhere in
// our data. A client who mistyped and a stranger probing for staff
// addresses read the same words.
// ============================================================

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Sign in — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

/**
 * Error copy. Keyed by the codes /portal/auth/callback redirects with —
 * see that route for where each one is raised.
 */
const MESSAGES: Record<string, string> = {
  "not-invited":
    "That email isn't on a brand account yet. Ask your Postgame contact for an invite.",
  "hub-account":
    "That account already signs in to the Hub. Use the main Hub sign-in instead.",
  provider: "We couldn't reach that sign-in provider. Try again in a moment.",
  auth: "That sign-in didn't complete. Try again.",
};

const PROVIDERS = [
  { id: "google", label: "Continue with Google", mark: "/sso/google-g.svg" },
  { id: "azure", label: "Continue with Microsoft", mark: "/sso/microsoft-logo.svg" },
] as const;

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const postgameMark = await getPostgameMark();
  const message = searchParams.error ? MESSAGES[searchParams.error] ?? MESSAGES.auth : null;

  return (
    <div
      className={`${arimo.variable} w-full`}
      style={{
        background: BG,
        color: OFFWHITE,
        minHeight: "100vh",
        fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif",
      }}
    >
      {/* Centred rather than top-aligned with the footer pushed down: on a
          tall desktop viewport the pushed version left a screen-height gap
          between the buttons and the footnote. Centring holds at 380px too,
          and the padding lets it scroll on a short viewport. */}
      <div className="mx-auto w-full max-w-[420px] px-5 md:px-6 py-14 flex flex-col justify-center min-h-screen">
        {/* Hard rule 1: the Postgame mark is a FILE, never the word set in
            type. No file, nothing here — the page still works. The wordmark is
            a ~5:1 lockup, so height is set and width follows; align-self
            keeps the column flex parent from stretching it to full width. */}
        {postgameMark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={postgameMark}
            alt="Postgame"
            style={{
              height: 24,
              width: "auto",
              objectFit: "contain",
              alignSelf: "flex-start",
              flex: "0 0 auto",
            }}
            className="block max-w-full"
          />
        ) : null}

        <h1
          style={{
            ...BEBAS,
            fontSize: 40,
            lineHeight: 0.9,
            letterSpacing: ".02em",
            color: "rgba(250,248,245,1)",
            margin: "38px 0 12px",
          }}
        >
          Sign in
        </h1>

        <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(250,248,245,.68)", margin: 0 }}>
          Use the work account your invite was sent to.
        </p>

        {message && (
          <div
            role="status"
            style={{
              marginTop: 26,
              padding: 20,
              borderRadius: 16,
              background: CARD,
              border: `1px solid ${CARD_B}`,
              borderLeft: `2px solid ${ORANGE}`,
            }}
          >
            <span
              style={{
                ...MONO,
                display: "block",
                fontSize: 10,
                color: "rgba(250,248,245,.50)",
                marginBottom: 8,
              }}
            >
              Signed out
            </span>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: "rgba(250,248,245,.90)" }}>
              {message}
            </p>
          </div>
        )}

        {/* Both buttons glass, equal weight — neither provider is the
            recommended one.

            PADDING AND GAP ARE LOAD-BEARING. Google's own asset centres a
            20px mark in a 40px button, i.e. 10px of clear space per side.
            The 16px inline padding and 12px gap both clear that minimum, so
            the mark keeps the breathing room Google requires. Tightening
            either breaks their branding rules. Orange stays off these
            entirely: a full-colour G on an orange fill is not allowed, and
            equal weight is the point. */}
        <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 12 }}>
          {PROVIDERS.map((p) => (
            <form key={p.id} action={startPortalOAuth}>
              <input type="hidden" name="provider" value={p.id} />
              <button
                type="submit"
                style={{
                  ...MONO,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(255,255,255,.14)",
                  color: "rgba(250,248,245,.90)",
                  fontSize: 10,
                  lineHeight: 1.4,
                  cursor: "pointer",
                }}
              >
                {/* Official provider marks, full colour, fixed size, never
                    recoloured or stretched. Provenance in public/sso/README.md. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.mark}
                  alt=""
                  aria-hidden="true"
                  width={20}
                  height={20}
                  style={{ width: 20, height: 20, flex: "0 0 auto", display: "block" }}
                />
                {p.label}
              </button>
            </form>
          ))}
        </div>

        <p
          style={{
            marginTop: 34,
            fontSize: 16,
            lineHeight: 1.7,
            color: "rgba(250,248,245,.50)",
          }}
        >
          Trouble signing in? Ask your Postgame contact.
        </p>

        <p
          style={{
            ...MONO,
            fontSize: 10,
            color: "rgba(250,248,245,.38)",
            borderTop: `1px solid ${HAIR}`,
            paddingTop: 14,
            marginTop: 20,
          }}
        >
          Confidential
        </p>
      </div>
    </div>
  );
}
