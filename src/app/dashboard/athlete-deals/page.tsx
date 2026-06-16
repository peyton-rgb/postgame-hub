// ============================================================
// Manager — athlete deal review (mockup screen 7)
//
// Two queues:
//   • Content to approve   — deliverables in_review (content gate)
//   • Posts to verify       — deliverables pending_verification (post gate)
// Verifying the last deliverable on a deal flips it to Paid-pending and
// schedules the payout (Phase 5). Staff-only.
// ============================================================

import { requireStaff } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { slotLabel } from "@/lib/deliverable-status";
import StaffDeliverableActions from "@/components/dashboard/StaffDeliverableActions";

export const dynamic = "force-dynamic";

const SELECT =
  "id,slot,status,live_url,review_note,updated_at,file_url,media_type,athlete:profiles!athlete_id(full_name,email,ig_handle),campaign:optin_campaigns(title,brand:brands(name,logo_url))";

function one(v: any) {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

async function fetchQueue(statuses: string[]) {
  const service = createServiceSupabase();
  const { data, error } = await service
    .from("athlete_deliverables")
    .select(SELECT)
    .in("status", statuses)
    .order("updated_at", { ascending: true });
  if (error) {
    console.error("athlete-deals queue error:", error.message);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    ...r,
    athlete: one(r.athlete),
    campaign: one(r.campaign),
  }));
}

function Row({ row, mode }: { row: any; mode: "review" | "verify" }) {
  const brand = one(row.campaign?.brand);
  const athleteName = row.athlete?.full_name || row.athlete?.email || "Athlete";
  const isVideo = row.media_type === "video";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexWrap: "wrap" }}>
      {/* thumb */}
      <div style={{ width: 48, height: 48, borderRadius: 9, overflow: "hidden", flex: "none", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {row.file_url && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.file_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "#fff" }}><path d="M8 5v14l11-7z" /></svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14, color: "#fff" }}>{athleteName}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          {brand?.name ? `${brand.name} · ` : ""}{row.campaign?.title} · {slotLabel(row.slot)}
        </div>
        {mode === "verify" && row.live_url && (
          <a href={row.live_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#9cc3ff", wordBreak: "break-all" }}>
            {row.live_url}
          </a>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {row.file_url && (
          <a href={row.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", textDecoration: "underline" }}>
            {mode === "review" ? "View file" : "Open"}
          </a>
        )}
        <StaffDeliverableActions deliverableId={row.id} mode={mode} />
      </div>
    </div>
  );
}

export default async function AthleteDealsReviewPage() {
  await requireStaff();
  const [toApprove, toVerify] = await Promise.all([
    fetchQueue(["in_review"]),
    fetchQueue(["pending_verification"]),
  ]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 60px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Athlete deals</h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
        Approve athlete content, then verify their live posts to release payment.
      </p>

      <section style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 10 }}>
          Content to approve ({toApprove.length})
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, overflow: "hidden" }}>
          {toApprove.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Nothing waiting for content approval.</div>
          ) : (
            toApprove.map((r: any) => <Row key={r.id} row={r} mode="review" />)
          )}
        </div>
      </section>

      <section>
        <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 10 }}>
          Posts to verify ({toVerify.length})
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, overflow: "hidden" }}>
          {toVerify.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>No posts awaiting verification.</div>
          ) : (
            toVerify.map((r: any) => <Row key={r.id} row={r} mode="verify" />)
          )}
        </div>
      </section>
    </div>
  );
}
