// ============================================================
// /portal/signup?token=… — mockup screen 1, "set your password".
//
// Brand logo + role banner, email locked to the address the invite was
// sent to (changing it would let one person redeem another's invite),
// and one password field pair.
//
// Every failure mode is an honest dead end with a way out, never a
// blank form that will reject you after you fill it in. The page and
// the action share validateInviteToken so they cannot disagree.
// ============================================================

import Link from "next/link";
import { validateInviteToken, INVITE_FAILURE_COPY } from "@/lib/portal/invite-token";
import { completeSignup, acceptWithExistingLogin } from "./actions";
import { BG, CARD, CARD_B, HAIR, INK_BODY, INK_LABEL, OFFWHITE, ORANGE, RADIUS } from "@/lib/portal";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  "password-too-short": "Use at least 10 characters.",
  "password-mismatch": "Those two passwords don't match.",
  "signup-failed": "We couldn't create the login. Try again, or ask your Postgame contact.",
  "profile-failed": "We couldn't finish setting up the account. Nothing was saved — try again.",
  "link-failed": "We couldn't finish setting up the account. Nothing was saved — try again.",
  "activate-failed": "We couldn't activate your access. Nothing was saved — try again.",
  "bad-credentials": "That password didn't match the login we already have for this address.",
  "already-registered": "",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const token = (searchParams.token ?? "").trim();
  const error = searchParams.error ?? "";
  const invite = await validateInviteToken(token);

  if (!invite.ok) {
    const copy = INVITE_FAILURE_COPY[invite.reason];
    return (
      <Shell>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{copy.title}</h1>
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: INK_BODY }}>
          {copy.body}
        </p>
        {invite.reason === "already-active" && (
          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: 20,
              background: ORANGE,
              color: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              padding: "11px 26px",
              borderRadius: RADIUS,
            }}
          >
            Sign in
          </Link>
        )}
      </Shell>
    );
  }

  const existing = error === "already-registered";
  const roleLabel = invite.role === "approver" ? "Approver" : "Viewer";

  return (
    <Shell>
      {invite.brandLogoUrl ? (
        <div
          style={{
            background: "#fff",
            borderRadius: RADIUS,
            padding: "14px 18px",
            display: "inline-block",
            marginBottom: 18,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={invite.brandLogoUrl}
            alt={invite.brandName}
            style={{ height: 30, width: "auto", display: "block" }}
          />
        </div>
      ) : (
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>{invite.brandName}</div>
      )}

      <div
        style={{
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: INK_LABEL,
        }}
      >
        {invite.brandName} portal · {roleLabel}
      </div>

      <h1 style={{ margin: "10px 0 0", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em" }}>
        {existing ? "Sign in to accept" : "Set your password"}
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.6, color: INK_BODY }}>
        {existing
          ? `You already have a Postgame login for this address. Sign in and we'll add ${invite.brandName} to it — one login, not two.`
          : `You've been given ${roleLabel} access to ${invite.brandName}. Choose a password and you're in.`}
      </p>

      {error && ERROR_COPY[error] && (
        <div
          style={{
            marginTop: 16,
            border: "1px solid rgba(201,47,29,.4)",
            background: "rgba(201,47,29,.12)",
            borderRadius: RADIUS,
            padding: "10px 12px",
            fontSize: 13,
            color: "#ffb4a8",
          }}
        >
          {ERROR_COPY[error]}
        </div>
      )}

      <form action={existing ? acceptWithExistingLogin : completeSignup} style={{ marginTop: 20 }}>
        <input type="hidden" name="token" value={token} />

        <Label>Email</Label>
        {/* Locked: the invite is for this address. Read-only + disabled
            styling, and the action reads the address from the token
            anyway, so tampering with the DOM changes nothing. */}
        <input
          type="email"
          value={invite.email}
          readOnly
          style={{ ...inputStyle, color: INK_LABEL, cursor: "not-allowed" }}
        />

        <Label>{existing ? "Your existing password" : "Password"}</Label>
        <input
          type="password"
          name="password"
          required
          minLength={existing ? undefined : 10}
          autoComplete={existing ? "current-password" : "new-password"}
          placeholder={existing ? "" : "At least 10 characters"}
          style={inputStyle}
        />

        {!existing && (
          <>
            <Label>Confirm password</Label>
            <input
              type="password"
              name="confirm"
              required
              minLength={10}
              autoComplete="new-password"
              style={inputStyle}
            />
          </>
        )}

        <button
          type="submit"
          style={{
            marginTop: 20,
            width: "100%",
            background: ORANGE,
            color: "#fff",
            border: 0,
            fontSize: 15,
            fontWeight: 600,
            padding: "13px 0",
            borderRadius: RADIUS,
            cursor: "pointer",
          }}
        >
          {existing ? `Sign in and add ${invite.brandName}` : "Create my login"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: OFFWHITE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: CARD,
          border: `1px solid ${CARD_B}`,
          borderRadius: RADIUS * 2,
          padding: "32px 30px",
        }}
      >
        {children}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${HAIR}` }}>
          <span style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: INK_LABEL }}>
            Postgame
          </span>
        </div>
      </div>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 16,
        marginBottom: 6,
        fontSize: 11,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: INK_LABEL,
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(250,248,245,.05)",
  border: "1px solid rgba(250,248,245,.15)",
  borderRadius: 8,
  padding: "11px 12px",
  fontSize: 14,
  color: "#FAF8F5",
  outline: "none",
};
