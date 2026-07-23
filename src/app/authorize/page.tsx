"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

// Public, logged-out landing page for staff to link their @pstgm.com Google
// account to their existing Hub account. Single action: Continue with Google.
// The domain enforcement lives in three places — Google's Internal user type,
// the handle_new_user DB trigger, and the /auth/callback domain guard. This
// page is just the front door.
//
// Not gated by middleware: src/middleware.ts is matcher-scoped and /authorize
// is intentionally absent from the matcher, so it stays reachable while
// logged out.

// Human-readable messages for the ?error= codes /auth/callback can redirect
// back with. Anything unrecognized falls through to a safe generic line so a
// failed sign-in never shows a blank screen or a raw code.
const ERROR_MESSAGES: Record<string, string> = {
  domain:
    "That account isn't a @pstgm.com address. Sign in with your Postgame Google account.",
  auth: "Sign-in didn't complete. Please try again.",
};

export default function AuthorizePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read ?error= from the URL directly instead of useSearchParams() so the
  // page needs no Suspense boundary and stays statically renderable (keeps
  // `npm run build` clean).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) {
      setError(ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.");
    }
  }, []);

  async function handleGoogle() {
    setError(null);
    setLoading(true);

    const supabase = createBrowserSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        queryParams: { hd: "pstgm.com", prompt: "select_account" },
      },
    });

    // On success the browser is already navigating to Google, so this only
    // runs if the redirect never kicked off.
    if (oauthError) {
      setError("Couldn't reach Google. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="authorize-page">
      <div className="glow" aria-hidden="true" />

      <div className="wrap">
        <main className="card">
          <img
            src="/postgame-logo-primary.png"
            alt="Postgame"
            className="logo"
          />

          <h1 className="greeting">Authorize your account</h1>
          <p className="instruction">
            Sign in once to set up your access to the Postgame Hub.
          </p>

          {error && (
            <div className="banner" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            className="google"
            onClick={handleGoogle}
            disabled={loading}
          >
            {loading ? (
              "Redirecting…"
            ) : (
              <>
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p className="ghint">
            Use your <strong>@pstgm.com</strong> account. Personal Google
            accounts won&rsquo;t work.
          </p>

          <p className="foot">
            Not expecting this? Don&rsquo;t sign in — tell{" "}
            <a href="mailto:peyton@pstgm.com">peyton@pstgm.com</a>
          </p>
        </main>
      </div>

      <style>{`
        .authorize-page {
          --black: #07070a;
          --orange: #D73F09;
          --off: #FAF8F5;
          --line: rgba(255, 255, 255, .12);
          --muted: rgba(250, 248, 245, .55);
          --dim: rgba(250, 248, 245, .32);
          background: var(--black);
          color: var(--off);
          font-family: Arial, Helvetica, sans-serif;
          -webkit-font-smoothing: antialiased;
          min-height: 100dvh;
        }
        .authorize-page .glow {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 90% 55% at 50% 0%, rgba(215, 63, 9, .14) 0%, transparent 60%);
        }
        .authorize-page .wrap {
          position: relative;
          z-index: 1;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 20px 64px;
        }
        .authorize-page .card {
          width: 100%;
          max-width: 392px;
          animation: authorize-rise .45s cubic-bezier(.2, .7, .3, 1) both;
        }
        @keyframes authorize-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        .authorize-page .logo {
          display: block;
          height: 42px;
          width: auto;
          margin: 0 auto 44px;
        }
        .authorize-page .greeting {
          font-family: var(--font-bebas), Impact, sans-serif;
          font-size: clamp(32px, 8vw, 40px);
          font-weight: 400;
          line-height: 1.02;
          letter-spacing: .015em;
          text-transform: uppercase;
          text-align: center;
          margin: 0 0 12px;
          overflow-wrap: break-word;
        }
        .authorize-page .instruction {
          text-align: center;
          font-size: 14.5px;
          line-height: 1.5;
          color: var(--muted);
          margin: 0 0 30px;
        }
        .authorize-page .banner {
          border: 1px solid rgba(215, 63, 9, .4);
          background: rgba(215, 63, 9, .1);
          color: var(--off);
          border-radius: 11px;
          padding: 12px 14px;
          font-size: 13px;
          line-height: 1.45;
          text-align: center;
          margin: 0 0 20px;
        }
        .authorize-page .google {
          width: 100%;
          height: 52px;
          border: 0;
          border-radius: 11px;
          background: #fff;
          color: #1f1f1f;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 15px;
          font-weight: bold;
          transition: filter .16s, transform .1s;
        }
        .authorize-page .google:hover:not(:disabled) { filter: brightness(.94); }
        .authorize-page .google:active:not(:disabled) { transform: translateY(1px); }
        .authorize-page .google:focus-visible {
          outline: 2px solid var(--orange);
          outline-offset: 2px;
        }
        .authorize-page .google:disabled {
          cursor: not-allowed;
          color: var(--muted);
        }
        .authorize-page .google svg {
          width: 19px;
          height: 19px;
          flex: 0 0 19px;
        }
        .authorize-page .ghint {
          text-align: center;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--dim);
          margin: 11px 0 0;
        }
        .authorize-page .ghint strong { color: var(--muted); font-weight: bold; }
        .authorize-page .foot {
          margin-top: 26px;
          padding-top: 22px;
          border-top: 1px solid var(--line);
          text-align: center;
          font-size: 11.5px;
          line-height: 1.6;
          color: var(--dim);
        }
        .authorize-page .foot a {
          color: var(--muted);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .authorize-page .foot a:hover { color: var(--off); }
        @media (prefers-reduced-motion: reduce) {
          .authorize-page .card { animation: none; }
        }
      `}</style>
    </div>
  );
}
