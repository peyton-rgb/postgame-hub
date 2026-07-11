"use client";

// Athlete "forgot password" — step 1 of the reset flow. Sends a Supabase
// recovery email whose link lands the athlete on /athlete/reset-password (both
// routes are allowlisted as public in middleware.ts). We always show the same
// "check your email" confirmation whether or not the address exists, so this
// page never reveals which emails have accounts.

import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function AthleteForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createBrowserSupabase();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/athlete/reset-password`,
    });
    setLoading(false);

    // Don't leak whether the email exists — confirm either way. Only surface
    // genuine transport errors (rate limit, network).
    if (error && /rate|network|too many/i.test(error.message)) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/postgame-logo-white.png" alt="Postgame" style={{ height: 30, objectFit: "contain", marginBottom: 14 }} />
          <div className="a-d" style={{ fontSize: 30 }}>RESET PASSWORD</div>
          <div className="a-muted" style={{ fontSize: 13, marginTop: 4 }}>
            {sent ? "Check your inbox" : "We'll email you a reset link"}
          </div>
        </div>

        {sent ? (
          <>
            <div className="a-card" style={{ textAlign: "center", padding: "22px 18px" }}>
              <p style={{ fontSize: 13.5, color: "rgba(250,248,245,0.8)", lineHeight: 1.55 }}>
                If an account exists for <b style={{ color: "var(--a-off)" }}>{email.trim()}</b>, a reset link
                is on its way. Open it on this phone to set a new password.
              </p>
              <p className="a-muted" style={{ fontSize: 11.5, marginTop: 12 }}>
                Didn't get it? Check spam, or wait a minute and try again.
              </p>
            </div>
            <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }} className="a-muted">
              <Link href="/athlete/login" style={{ color: "var(--a-orange)" }}>Back to sign in</Link>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="a-label">Email</label>
                <input
                  className="a-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              {error && <div className="a-err">{error}</div>}
              <button type="submit" className="a-cta" disabled={loading}>
                <span className="a-anton" style={{ fontSize: 15 }}>{loading ? "SENDING…" : "SEND RESET LINK"}</span>
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }} className="a-muted">
              Remembered it?{" "}
              <Link href="/athlete/login" style={{ color: "var(--a-orange)" }}>Sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
