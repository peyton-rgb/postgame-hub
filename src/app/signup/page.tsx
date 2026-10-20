// ============================================================
// /signup — the chooser. "I'm a…" one card per kind of person, each
// pointing at that type's own door:
//
//   Current / Former athlete → existing /athlete/signup (?type=current|former)
//   Coach / Agent            → /signup/coach, /signup/agent (this branch)
//   Videographer             → /desktop#signup (sign up, then download)
//   Brand                    → existing /portal/signup (invite link)
//   Postgame staff           → existing /login (Google, @pstgm.com)
//
// The list lives in src/lib/signup/types.ts so /admin and the sign-up
// pages never disagree about what the types are.
//
// NOTE for /athlete/signup (outside this branch): it should read ?type=
// and add `user_type: 'current_athlete' | 'former_athlete'` to the
// signUp() metadata next to role:'athlete'. Migration 085's
// handle_new_user() already understands it; nothing breaks while the
// param is ignored — both land as role 'athlete'.
// ============================================================

import Link from "next/link";
import { SIGNUP_CHOICES } from "@/lib/signup/types";

export const metadata = { title: "Join Postgame — who are you?" };

export default function SignupChooserPage() {
  return (
    <div style={{ padding: "18px 0 40px" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div className="a-eyebrow">Join Postgame</div>
        <div className="a-d" style={{ fontSize: 34 }}>I&rsquo;M A…</div>
        <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
          Pick the one that fits. Each kind of account has its own sign-up.
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {SIGNUP_CHOICES.map((c) => (
          <Link
            key={c.code}
            href={c.href}
            className="a-card"
            style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span className="a-d" style={{ fontSize: 22 }}>{c.label}</span>
                {c.note && <span className="a-pill a-pill-neutral">{c.note}</span>}
              </div>
              <div className="a-muted" style={{ fontSize: 13, lineHeight: 1.45, marginTop: 4 }}>{c.blurb}</div>
            </div>
            <span aria-hidden="true" style={{ color: "var(--a-orange)", fontSize: 22, lineHeight: 1 }}>›</span>
          </Link>
        ))}
      </div>

      <div className="a-muted" style={{ textAlign: "center", marginTop: 22, fontSize: 13 }}>
        Already have an account?{" "}
        <Link href="/athlete/login" style={{ color: "var(--a-orange)" }}>Athletes sign in</Link>
        {" · "}
        <Link href="/desktop#signin" style={{ color: "var(--a-orange)" }}>Videographers sign in</Link>
      </div>
    </div>
  );
}
