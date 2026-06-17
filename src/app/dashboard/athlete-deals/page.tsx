// ============================================================
// Manager — athlete deal review (mockup screen 7)
//
// Staff-only (requireStaff). Lists athlete deliverables that need manager
// action, GROUPED BY ATHLETE + DEAL:
//   • in_review            → content gate: Approve / Request changes
//   • pending_verification → post gate: Verify (live link)
//
// Actions update athlete_deliverables.status + the matching timestamp
// (approved_at on approve, verified_at on verify; posted_at is set when the
// athlete pastes their link). Verifying the last deliverable on a deal marks
// it complete and schedules the payout. Reads athlete_deliverables joined to
// the athlete's profile + optin_campaigns + brand.
// ============================================================

import { requireStaff } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { slotLabel } from "@/lib/deliverable-status";
import StaffDeliverableActions from "@/components/dashboard/StaffDeliverableActions";
import VideographerLinkButton from "@/components/videographer/VideographerLinkButton";
import AutoEditorPanel, { type Evl } from "@/components/dashboard/AutoEditorPanel";

export const dynamic = "force-dynamic";

const SELECT =
  "id,slot,status,live_url,review_note,updated_at,file_url,media_type,optin_campaign_id,athlete_id,athlete:profiles!athlete_id(full_name,email,ig_handle),campaign:optin_campaigns(title,brand:brands(name,logo_url))";

function one(v: any) {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

type Group = {
  key: string;
  athleteId: string;
  campaignId: string;
  athleteName: string;
  athleteHandle: string | null;
  brandName: string | null;
  brandLogo: string | null;
  campaignTitle: string | null;
  items: any[];
};

async function fetchGroups(campaignId?: string): Promise<Group[]> {
  const service = createServiceSupabase();
  let query = service
    .from("athlete_deliverables")
    .select(SELECT)
    .in("status", ["in_review", "pending_verification"]);
  if (campaignId) query = query.eq("optin_campaign_id", campaignId);
  const { data, error } = await query.order("updated_at", { ascending: true });

  if (error) {
    console.error("athlete-deals queue error:", error.message);
    return [];
  }

  const groups = new Map<string, Group>();
  for (const r of data ?? []) {
    const athlete = one((r as any).athlete);
    const campaign = one((r as any).campaign);
    const brand = campaign ? one(campaign.brand) : null;
    const key = `${r.athlete_id}|${r.optin_campaign_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        athleteId: r.athlete_id,
        campaignId: r.optin_campaign_id,
        athleteName: athlete?.full_name || athlete?.email || "Athlete",
        athleteHandle: athlete?.ig_handle ?? null,
        brandName: brand?.name ?? null,
        brandLogo: brand?.logo_url ?? null,
        campaignTitle: campaign?.title ?? null,
        items: [],
      });
    }
    groups.get(key)!.items.push(r);
  }
  // Sort each group's items by slot for stable display.
  for (const g of groups.values()) g.items.sort((a, b) => String(a.slot).localeCompare(String(b.slot)));
  return Array.from(groups.values());
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { t: string; bg: string; c: string }> = {
    in_review: { t: "In review", bg: "rgba(255,255,255,0.12)", c: "rgba(255,255,255,0.7)" },
    pending_verification: { t: "Awaiting verify", bg: "rgba(215,63,9,0.18)", c: "#ff8a5c" },
  };
  const s = map[status] || { t: status, bg: "rgba(255,255,255,0.12)", c: "rgba(255,255,255,0.7)" };
  return <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", borderRadius: 20, padding: "4px 10px", background: s.bg, color: s.c }}>{s.t}</span>;
}

function DeliverableRow({ d }: { d: any }) {
  const isVideo = d.media_type === "video";
  const mode: "review" | "verify" = d.status === "pending_verification" ? "verify" : "review";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flex: "none", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {d.file_url && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.file_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: "#fff" }}><path d="M8 5v14l11-7z" /></svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontSize: 13, color: "#fff" }}>{slotLabel(d.slot)}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
          {d.file_url && (
            <a href={d.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "underline" }}>
              {mode === "review" ? "View file" : "Open file"}
            </a>
          )}
          {mode === "verify" && d.live_url && (
            <a href={d.live_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#9cc3ff", wordBreak: "break-all" }}>{d.live_url}</a>
          )}
        </div>
      </div>
      <StatusPill status={d.status} />
      <StaffDeliverableActions deliverableId={d.id} mode={mode} />
    </div>
  );
}

async function fetchEvaluations(athleteId: string, campaignId: string): Promise<Evl[]> {
  const service = createServiceSupabase();
  const { data, error } = await service
    .from("content_evaluations")
    .select("deliverable_id,overall_score,scores,compliance_pass,compliance_flags,is_top_pick,rank,rationale,is_preliminary,model,deliverable:athlete_deliverables(slot,media_type,file_url)")
    .eq("athlete_id", athleteId)
    .eq("optin_campaign_id", campaignId);
  if (error) {
    console.error("fetchEvaluations error:", error.message);
    return [];
  }
  const evals = data ?? [];
  const deliverableIds = evals.map((r: any) => r.deliverable_id);

  // Suggestions + queued edit jobs for these deliverables.
  const sugByDeliv = new Map<string, any[]>();
  const jobsByDeliv = new Map<string, any[]>();
  if (deliverableIds.length > 0) {
    const [{ data: sugs }, { data: jobs }] = await Promise.all([
      service.from("edit_suggestions").select("id,deliverable_id,kind,summary,detail,severity,status").in("deliverable_id", deliverableIds).order("created_at", { ascending: true }),
      service.from("athlete_edit_jobs").select("id,deliverable_id,type,status").in("deliverable_id", deliverableIds).order("created_at", { ascending: false }),
    ]);
    for (const s of sugs ?? []) { const a = sugByDeliv.get(s.deliverable_id) ?? []; a.push(s); sugByDeliv.set(s.deliverable_id, a); }
    for (const j of jobs ?? []) { const a = jobsByDeliv.get(j.deliverable_id) ?? []; a.push(j); jobsByDeliv.set(j.deliverable_id, a); }
  }

  return evals.map((r: any) => {
    const d = one(r.deliverable);
    return {
      deliverable_id: r.deliverable_id,
      slot: d?.slot ?? "",
      media_type: d?.media_type ?? null,
      file_url: d?.file_url ?? null,
      overall_score: r.overall_score,
      scores: r.scores,
      compliance_pass: r.compliance_pass,
      compliance_flags: r.compliance_flags ?? [],
      is_top_pick: r.is_top_pick,
      rank: r.rank,
      rationale: r.rationale,
      is_preliminary: r.is_preliminary,
      model: r.model,
      suggestions: sugByDeliv.get(r.deliverable_id) ?? [],
      jobs: jobsByDeliv.get(r.deliverable_id) ?? [],
    } as Evl;
  });
}

async function GroupCard({ g }: { g: Group }) {
  const initials = g.athleteName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const evaluations = await fetchEvaluations(g.athleteId, g.campaignId);
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#D73F09", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: "#fff" }}>{g.athleteName}{g.athleteHandle ? <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}> · @{g.athleteHandle}</span> : null}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{g.brandName ? `${g.brandName} · ` : ""}{g.campaignTitle}</div>
        </div>
        {g.brandLogo && (
          <div style={{ background: "rgba(255,255,255,0.94)", borderRadius: 6, padding: "5px 8px", display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.brandLogo} alt={g.brandName || "brand"} style={{ height: 13 }} />
          </div>
        )}
      </div>
      {g.items.map((d) => <DeliverableRow key={d.id} d={d} />)}

      <AutoEditorPanel athleteId={g.athleteId} campaignId={g.campaignId} initial={evaluations} />

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 10, paddingTop: 12 }}>
        <VideographerLinkButton
          endpoint="/api/staff/videographer-link"
          body={{ athleteId: g.athleteId, campaignId: g.campaignId }}
          variant="staff"
        />
      </div>
    </div>
  );
}

export default async function AthleteDealsReviewPage({ searchParams }: { searchParams: { campaign?: string } }) {
  await requireStaff();
  const groups = await fetchGroups(searchParams?.campaign);
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 20px 60px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Athlete deals</h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
        Approve athlete content, then verify their live posts to release payment. Grouped by athlete + deal.
      </p>

      {groups.length === 0 ? (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 24, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          Nothing waiting for review right now. Submitted content and posted links will show up here.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>
            {totalItems} item{totalItems === 1 ? "" : "s"} across {groups.length} athlete deal{groups.length === 1 ? "" : "s"}
          </div>
          {groups.map((g) => <GroupCard key={g.key} g={g} />)}
        </>
      )}
    </div>
  );
}
