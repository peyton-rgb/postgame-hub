"use client";

// Athlete login. Mirrors the staff /login flow (cookie session via
// createBrowserSupabase) but lands athletes in the /athlete app.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function AthleteLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserSupabase();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // The (app) layout routes to onboarding if the profile isn't finished.
    router.push("/athlete");
    router.refresh();
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <img src="/postgame-logo-white.png" alt="Postgame" style={{ height: 30, objectFit: "contain", marginBottom: 14 }} />
          <div className="a-d" style={{ fontSize: 30 }}>WELCOME BACK</div>
          <div className="a-muted" style={{ fontSize: 13, marginTop: 4 }}>Sign in to your deals</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="a-label">Email</label>
            <input className="a-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label className="a-label">Password</label>
              <Link href="/athlete/forgot" style={{ fontSize: 12, color: "var(--a-orange)" }}>Forgot password?</Link>
            </div>
            <input className="a-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required />
          </div>
          {error && <div className="a-err">{error}</div>}
          <button type="submit" className="a-cta" disabled={loading}>
            <span className="a-anton" style={{ fontSize: 15 }}>{loading ? "SIGNING IN…" : "SIGN IN"}</span>
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }} className="a-muted">
          New here?{" "}
          <Link href="/athlete/signup" style={{ color: "var(--a-orange)" }}>Create an account</Link>
        </div>
      </div>
    </div>
  );
}
