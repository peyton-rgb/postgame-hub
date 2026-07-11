"use client";

// Athlete "set a new password" — step 2 of the reset flow. The recovery email
// link lands here with a token that @supabase/ssr exchanges for a short-lived
// recovery session (detectSessionInUrl); PASSWORD_RECOVERY confirms it. We then
// let the athlete set a new password via updateUser and drop them into the app.
// This route is allowlisted public in middleware.ts AND excluded from the
// "logged-in → /athlete" bounce, so the recovery session doesn't abort the reset.

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function AthleteResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createBrowserSupabase();

  useEffect(() => {
    // The recovery session may already be established (token exchanged) by the
    // time we mount, or arrive a beat later. Handle both.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      router.push("/athlete");
      router.refresh();
    }, 1400);
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/postgame-logo-white.png" alt="Postgame" style={{ height: 30, objectFit: "contain", marginBottom: 14 }} />
          <div className="a-d" style={{ fontSize: 30 }}>NEW PASSWORD</div>
          <div className="a-muted" style={{ fontSize: 13, marginTop: 4 }}>Choose a new password for your account</div>
        </div>

        {success ? (
          <div className="a-card" style={{ textAlign: "center", padding: "26px 18px", borderColor: "rgba(9,215,63,0.3)" }}>
            <div className="a-anton" style={{ fontSize: 14, color: "var(--a-green)", letterSpacing: "0.12em" }}>
              PASSWORD UPDATED
            </div>
            <p className="a-muted" style={{ fontSize: 12.5, marginTop: 8 }}>Taking you to your deals…</p>
          </div>
        ) : !ready ? (
          <div className="a-card" style={{ textAlign: "center", padding: "22px 18px" }}>
            <p style={{ fontSize: 13.5, color: "rgba(250,248,245,0.8)", lineHeight: 1.55 }}>
              This reset link looks expired or was already used. Request a fresh one to continue.
            </p>
            <Link
              href="/athlete/forgot"
              className="a-cta"
              style={{ marginTop: 16, display: "flex", textDecoration: "none" }}
            >
              <span className="a-anton" style={{ fontSize: 15 }}>GET A NEW LINK</span>
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="a-label">New password</label>
                <input
                  className="a-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="a-label">Confirm password</label>
                <input
                  className="a-input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter it"
                  autoComplete="new-password"
                  required
                />
              </div>
              {error && <div className="a-err">{error}</div>}
              <button type="submit" className="a-cta" disabled={loading}>
                <span className="a-anton" style={{ fontSize: 15 }}>{loading ? "SAVING…" : "SAVE NEW PASSWORD"}</span>
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }} className="a-muted">
              <Link href="/athlete/login" style={{ color: "var(--a-orange)" }}>Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
