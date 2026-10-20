"use client";

// ============================================================
// The sign-up card on /desktop — Step 1 of 2 (create account) → Step 2
// of 2 (download), with an "I already have one" sign-in path that also
// lands on Step 2.
//
// Steps swap IN PLACE: the two Server Actions return a result object and
// this component decides what to show, so nothing a person typed is ever
// put into the URL. The only URL state is the hash — #signup opens the
// create form, #signin opens the sign-in form — so the hero buttons and
// the /signup chooser can deep-link into the right mode.
// ============================================================

import { useEffect, useState, useTransition } from "react";
import { createVideographerAccount, signInForDownload, type DesktopSignupResult } from "@/app/desktop/actions";
import { ERROR_COPY, PASSWORD_MIN, type SignupErrorCode } from "@/lib/signup/validation";

export type CardMode = "create" | "signin" | "download" | "confirm-email";

export interface DownloadLinks {
  mac: string | null;
  windows: string | null;
  version: string;
}

export default function DesktopSignupCard({
  initialMode,
  downloads,
  termsUrl,
  privacyUrl,
}: {
  initialMode: CardMode;
  downloads: DownloadLinks;
  termsUrl: string | null;
  privacyUrl: string | null;
}) {
  const [mode, setMode] = useState<CardMode>(initialMode);
  const [error, setError] = useState<SignupErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  // Hero buttons + the /signup chooser deep-link by hash.
  useEffect(() => {
    function fromHash() {
      const h = window.location.hash;
      if (h === "#signin") {
        setMode("signin");
        document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
      } else if (h === "#signup") {
        setMode((m) => (m === "download" ? m : "create"));
      }
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function run(action: (fd: FormData) => Promise<DesktopSignupResult>, form: HTMLFormElement) {
    setError(null);
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) {
        setError(res.error);
        if (res.error === "already-registered") setMode("signin");
        return;
      }
      setMode(res.step);
    });
  }

  if (mode === "download") {
    return (
      <div className="dl-done">
        <div className="dl-eyebrow">Step 2 of 2 · You&rsquo;re in</div>
        <h3>Download Postgame Desktop</h3>
        <p>Sign in with the email you just used. We&rsquo;ve also emailed you the download link.</p>
        <div className="dl-ctas" style={{ flexDirection: "column" }}>
          <DownloadButton href={downloads.mac} label="Download for macOS" primary />
          <DownloadButton href={downloads.windows} label="Download for Windows" />
        </div>
        {!downloads.mac && !downloads.windows && (
          <div className="dl-soon" style={{ marginTop: 12 }}>
            The installers aren&rsquo;t published yet. Your account is ready, and we&rsquo;ll email
            you the download link the moment they are.
          </div>
        )}
        <div className="dl-fine" style={{ marginTop: 12 }}>
          macOS 13 or later · Windows 10 or later · Version {downloads.version}
        </div>
        <button
          type="button"
          className="dl-fine"
          style={{ display: "block", marginTop: 14, background: "none", border: 0, padding: 0, cursor: "pointer" }}
          onClick={() => setMode("create")}
        >
          ← Start over
        </button>
      </div>
    );
  }

  if (mode === "confirm-email") {
    return (
      <div className="dl-done">
        <div className="dl-eyebrow">Step 1 of 2 · Check your email</div>
        <h3>Confirm your email</h3>
        <p>
          We sent you a confirmation link. Tap it to verify your account, then come back here and
          sign in to get the download.
        </p>
        <button type="button" className="dl-btn ghost" onClick={() => setMode("signin")}>
          I&rsquo;ve confirmed — sign in
        </button>
      </div>
    );
  }

  if (mode === "signin") {
    return (
      <form
        className="dl-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(signInForDownload, e.currentTarget);
        }}
      >
        <div>
          <div className="dl-eyebrow">Sign in</div>
          <h3 style={{ fontSize: 20 }}>Welcome back</h3>
        </div>
        <label>
          <span>Email</span>
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {error && <div className="dl-err" role="alert">{ERROR_COPY[error]}</div>}
        <button type="submit" className="dl-btn" disabled={pending}>
          {pending ? "Signing in…" : "Sign in & download"}
        </button>
        <div className="dl-fine" style={{ textAlign: "center", marginTop: 10 }}>
          New here?{" "}
          <button type="button" className="dl-link" onClick={() => { setError(null); setMode("create"); }}>Create an account</button>
          {" · "}
          <a href="/athlete/forgot">Forgot password?</a>
        </div>
      </form>
    );
  }

  return (
    <form
      className="dl-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(createVideographerAccount, e.currentTarget);
      }}
    >
      <label>
        <span>Full name</span>
        <input type="text" name="full_name" autoComplete="name" required maxLength={120} />
      </label>
      <label>
        <span>Email</span>
        <input type="email" name="email" autoComplete="email" required maxLength={254} />
      </label>
      <label>
        <span>Phone</span>
        <input type="tel" name="phone" autoComplete="tel" required maxLength={32} />
      </label>
      <label>
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          placeholder={`At least ${PASSWORD_MIN} characters`}
        />
      </label>
      <label>
        <span>
          Instagram or portfolio link <i>optional</i>
        </span>
        <input type="text" name="instagram_or_portfolio" maxLength={200} />
      </label>
      <label>
        <span>City you&rsquo;re based in</span>
        <input type="text" name="city" autoComplete="address-level2" required maxLength={120} />
      </label>
      <label>
        <span>Gear</span>
        <input type="text" name="gear" placeholder="e.g. Sony FX3, DJI RS3, drone" maxLength={300} />
      </label>
      <label className="dl-chk">
        <input type="checkbox" name="agree" required />
        <span>
          I agree to the <PolicyLink href={termsUrl}>Terms of service</PolicyLink> and{" "}
          <PolicyLink href={privacyUrl}>Privacy policy</PolicyLink>
        </span>
      </label>
      {error && <div className="dl-err" role="alert">{ERROR_COPY[error]}</div>}
      <button type="submit" className="dl-btn" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
      <div className="dl-fine" style={{ textAlign: "center", marginTop: 10 }}>
        Already have an account?{" "}
        <button type="button" className="dl-link" onClick={() => { setError(null); setMode("signin"); }}>Sign in</button>
      </div>
    </form>
  );
}

function PolicyLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  // The policy pages are not published yet (checked 2026-10-20: pstgm.com
  // has no /privacy or /terms). Until NEXT_PUBLIC_TERMS_URL /
  // NEXT_PUBLIC_PRIVACY_URL are set, the words stay plain text rather than
  // a link to a 404.
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function DownloadButton({ href, label, primary }: { href: string | null; label: string; primary?: boolean }) {
  const cls = primary ? "dl-btn" : "dl-btn ghost";
  if (!href) {
    return (
      <span className={cls} aria-disabled="true" style={{ opacity: 0.55, cursor: "not-allowed" }}>
        <DownloadIcon />
        {label} · coming soon
      </span>
    );
  }
  return (
    <a className={cls} href={href}>
      <DownloadIcon />
      {label}
    </a>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}
