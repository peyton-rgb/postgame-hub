"use client";

// Athlete self-signup. Passes role:"athlete" in signup metadata — the
// handle_new_user DB trigger is the ONLY thing that reads it, and it will
// only ever grant the 'athlete' role from metadata (never a staff role),
// so this is safe to send from the public client.
//
// Real logins (verified identity) are required because payouts are legally
// tied to identity — so if the Supabase project has email confirmation on,
// we surface a "check your email" state instead of faking a session.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function AthleteSignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const router = useRouter();
  const supabase = createBrowserSupabase();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "athlete", full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is required there is no session yet.
    if (!data.session) {
      setCheckEmail(true);
      setLoading(false);
      return;
    }

    router.push("/athlete/onboarding");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 26px" }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <div className="a-d" style={{ fontSize: 30 }}>CHECK YOUR EMAIL</div>
          <p className="a-muted" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 10 }}>
            We sent a confirmation link to <b style={{ color: "var(--a-off)" }}>{email}</b>. Tap it to verify
            your account, then sign in to finish setting up your profile.
          </p>
          <Link href="/athlete/login" className="a-cta" style={{ marginTop: 22, textDecoration: "none" }}>
            <span className="a-d" style={{ fontSize: 18 }}>GO TO SIGN IN</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
      <div style={{ width: "100%", maxWidth: 340, padding: "28px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <img src="/postgame-logo-white.png" alt="Postgame" style={{ height: 30, objectFit: "contain", marginBottom: 14 }} />
          <div className="a-d" style={{ fontSize: 30 }}>JOIN POSTGAME</div>
          <div className="a-muted" style={{ fontSize: 13, marginTop: 4 }}>Get paid for brand deals</div>
        </div>

        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="a-label">Full name</label>
            <input className="a-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jordan Ellis" required />
          </div>
          <div>
            <label className="a-label">Email</label>
            <input className="a-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
          </div>
          <div>
            <label className="a-label">Password</label>
            <input className="a-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
          </div>
          {error && <div className="a-err">{error}</div>}
          <button type="submit" className="a-cta" disabled={loading}>
            <span className="a-d" style={{ fontSize: 18 }}>{loading ? "CREATING…" : "CREATE ACCOUNT"}</span>
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }} className="a-muted">
          Already have an account?{" "}
          <Link href="/athlete/login" style={{ color: "var(--a-orange)" }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
