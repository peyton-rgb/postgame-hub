// ============================================================
// /signup/coach — coaches and team staff.
// Creates an auth user with user_type 'coach' and a coach_profiles row
// (status 'pending'); Postgame reviews before access. New type — nobody
// has it yet (Peyton, 2026-10-20).
// ============================================================

import Link from "next/link";
import RoleSignupForm from "@/components/signup/RoleSignupForm";
import { createCoachAccount } from "@/app/signup/actions";

export const metadata = { title: "Join Postgame — Coach" };

export default function CoachSignupPage() {
  return (
    <div style={{ padding: "14px 0 40px" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div className="a-eyebrow">Coach</div>
        <div className="a-d" style={{ fontSize: 30 }}>BRING YOUR TEAM</div>
        <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
          Create your account. Postgame reviews coach requests before access, then you&rsquo;ll see
          the campaigns open to your athletes.
        </p>
      </div>

      <RoleSignupForm
        action={createCoachAccount}
        organizationLabel="School"
        organizationPlaceholder="School or program"
        rolePlaceholder="e.g. Head coach, Director of ops"
      />

      <div className="a-muted" style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
        Not a coach? <Link href="/signup" style={{ color: "var(--a-orange)" }}>Pick another type</Link>
      </div>
    </div>
  );
}
