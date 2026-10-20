// ============================================================
// /signup/agent — agents and agencies representing athletes.
// Creates an auth user with user_type 'agent' and an agent_profiles row
// (status 'pending'); Postgame reviews before access.
// ============================================================

import Link from "next/link";
import RoleSignupForm from "@/components/signup/RoleSignupForm";
import { createAgentAccount } from "@/app/signup/actions";

export const metadata = { title: "Join Postgame — Agent" };

export default function AgentSignupPage() {
  return (
    <div style={{ padding: "14px 0 40px" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div className="a-eyebrow">Agent</div>
        <div className="a-d" style={{ fontSize: 30 }}>REPRESENT YOUR ATHLETES</div>
        <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
          Create your account. Postgame reviews agent requests, then you can see your
          athletes&rsquo; deals and invite the rest of your roster.
        </p>
      </div>

      <RoleSignupForm
        action={createAgentAccount}
        organizationLabel="Agency"
        organizationPlaceholder="Agency or company name"
        rolePlaceholder="e.g. NIL agent, Partner"
      />

      <div className="a-muted" style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
        Not an agent? <Link href="/signup" style={{ color: "var(--a-orange)" }}>Pick another type</Link>
      </div>
    </div>
  );
}
