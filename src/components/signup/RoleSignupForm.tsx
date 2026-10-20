"use client";

// ============================================================
// The agent / coach sign-up form (dark app style, athlete.css classes).
// One component, two actions: the page passes the Server Action and the
// copy that differs (organisation label, role placeholder).
//
// On success the action hands back the next path (from afterSignupPath)
// and this component navigates; nothing typed ends up in the URL. When
// the project requires email confirmation there is no session yet, so
// the form shows "check your email" instead of pretending.
// ============================================================

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RoleSignupResult } from "@/app/signup/actions";
import { ERROR_COPY, PASSWORD_MIN, type SignupErrorCode } from "@/lib/signup/validation";

export default function RoleSignupForm({
  action,
  organizationLabel,
  organizationPlaceholder,
  rolePlaceholder,
  submitLabel = "CREATE ACCOUNT",
}: {
  action: (formData: FormData) => Promise<RoleSignupResult>;
  organizationLabel: string;
  organizationPlaceholder: string;
  rolePlaceholder: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<SignupErrorCode | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [pending, startTransition] = useTransition();

  if (checkEmail) {
    return (
      <div style={{ textAlign: "center", padding: "30px 0" }}>
        <div className="a-d" style={{ fontSize: 30 }}>CHECK YOUR EMAIL</div>
        <p className="a-muted" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 10 }}>
          We sent you a confirmation link. Tap it to verify your account. Postgame reviews new
          requests before access, so you&rsquo;ll hear from us after that.
        </p>
        <Link href="/signup/done" className="a-cta" style={{ marginTop: 22, textDecoration: "none" }}>
          <span className="a-anton" style={{ fontSize: 15 }}>WHAT HAPPENS NEXT</span>
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await action(fd);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          if (!res.next) {
            setCheckEmail(true);
            return;
          }
          router.push(res.next);
          router.refresh();
        });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div>
        <label className="a-label" htmlFor="rs-name">Full name</label>
        <input id="rs-name" className="a-input" name="full_name" autoComplete="name" required maxLength={120} />
      </div>
      <div>
        <label className="a-label" htmlFor="rs-email">Email</label>
        <input id="rs-email" className="a-input" type="email" name="email" autoComplete="email" required maxLength={254} />
      </div>
      <div>
        <label className="a-label" htmlFor="rs-phone">Phone</label>
        <input id="rs-phone" className="a-input" type="tel" name="phone" autoComplete="tel" required maxLength={32} />
      </div>
      <div>
        <label className="a-label" htmlFor="rs-password">Password</label>
        <input
          id="rs-password"
          className="a-input"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          placeholder={`At least ${PASSWORD_MIN} characters`}
        />
      </div>
      <div>
        <label className="a-label" htmlFor="rs-org">{organizationLabel}</label>
        <input id="rs-org" className="a-input" name="organization" placeholder={organizationPlaceholder} autoComplete="organization" maxLength={160} />
      </div>
      <div>
        <label className="a-label" htmlFor="rs-title">Role</label>
        <input id="rs-title" className="a-input" name="title" placeholder={rolePlaceholder} autoComplete="organization-title" maxLength={120} />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            border: "1px solid rgba(215,63,9,.45)",
            background: "rgba(215,63,9,.12)",
            color: "var(--a-orange-soft)",
            borderRadius: 13,
            padding: "10px 12px",
            fontSize: 13,
          }}
        >
          {ERROR_COPY[error]}
        </div>
      )}

      <button type="submit" className="a-cta" disabled={pending}>
        <span className="a-anton" style={{ fontSize: 15 }}>{pending ? "CREATING…" : submitLabel}</span>
      </button>
    </form>
  );
}
