// ============================================================
// Campaign manager overview (staff-only)
//
// "What's the state of every active campaign, and what needs me?" — per-deal
// rollups (opt-ins, deliverable funnel, needs-action badges) computed from the
// athlete tables. Read-only; actions happen in /dashboard/athlete-deals.
// ============================================================

import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { getManagerOverview, FUNNEL_STAGES, type CampaignRollup } from "@/lib/manager-overview";

export const dynamic = "force-dynamic";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DeadlineChip({ c }: { c: CampaignRollup }) {
  if (c.deadlineState === "none") return null;
  const map = {
    overdue: { t: `Overdue · ${fmtDate(c.deadline!)}`, bg: "rgba(255,107,107,0.15)", col: "#ff6b6b" },
    soon: { t: `Due ${fmtDate(c.deadline!)}`, bg: "rgba(215,63,9,0.18)", col: "#ff8a5c" },
    ok: { t: `Due ${fmtDate(c.deadline!)}`, bg: "rgba(255,255,255,0.08)", col: "rgba(255,255,255,0.6)" },
  } as const;
  const s = map[c.deadlineState as "overdue" | "soon" | "ok"];
  return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 8px", background: s.bg, color: s.col }}>{s.t}</span>;
}

function Badge({ n, label, tone }: { n: number; label: string; tone: "due" | "flag" }) {
  if (n <= 0) return null;
  const c = tone === "flag" ? { bg: "rgba(255,107,107,0.12)", col: "#ff6b6b" } : { bg: "rgba(215,63,9,0.18)", col: "#ff8a5c" };
  return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "4px 10px", background: c.bg, color: c.col }}>{n} {label}</span>;
}

function Card({ c }: { c: CampaignRollup }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${c.deadlineState === "overdue" ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.09)"}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        {c.brandLogo && (
          <div style={{ background: "rgba(255,255,255,0.94)", borderRadius: 7, padding: "5px 8px", display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.brandLogo} alt={c.brandName || "brand"} style={{ height: 14 }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 15, color: "#fff" }}>{c.brandName ? `${c.brandName} · ` : ""}{c.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{c.optinCount} opted in · {c.totalDeliverables} deliverables</div>
        </div>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.5)" }}>{c.status}</span>
        <DeadlineChip c={c} />
      </div>

      {/* needs-action badges */}
      {(c.inReview > 0 || c.pendingVerification > 0 || c.complianceFlags > 0) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge n={c.inReview} label="to approve" tone="due" />
          <Badge n={c.pendingVerification} label="to verify" tone="due" />
          <Badge n={c.complianceFlags} label="compliance flag" tone="flag" />
        </div>
      )}

      {/* funnel */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {FUNNEL_STAGES.map((s) => {
          const n = c.funnel[s.key] ?? 0;
          return (
            <div key={s.key} style={{ flex: "1 1 70px", minWidth: 64, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: n > 0 ? "#fff" : "rgba(255,255,255,0.3)" }}>{n}</div>
              <div style={{ fontSize: 10, color: s.needsAction && n > 0 ? "#ff8a5c" : "rgba(255,255,255,0.45)" }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      <Link href={`/dashboard/athlete-deals?campaign=${c.id}`} style={{ fontSize: 12, color: "#9cc3ff", textDecoration: "none" }}>
        Open in review queue →
      </Link>
    </div>
  );
}

function Stat({ n, label, alert }: { n: number; label: string; alert?: boolean }) {
  return (
    <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: alert && n > 0 ? "#ff8a5c" : "#fff" }}>{n}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{label}</div>
    </div>
  );
}

export default async function CampaignsOverviewPage() {
  await requireStaff();
  const { campaigns, totals } = await getManagerOverview();

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px 60px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Campaigns</h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Status at a glance across every active campaign.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat n={totals.activeCampaigns} label="Active campaigns" />
        <Stat n={totals.needsAction} label="Items needing action" alert />
        <Stat n={totals.overdue} label="Overdue campaigns" alert />
      </div>

      {campaigns.length === 0 ? (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 24, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          No active campaigns yet. Live deals and any campaign with opt-ins will show up here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {campaigns.map((c) => <Card key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
