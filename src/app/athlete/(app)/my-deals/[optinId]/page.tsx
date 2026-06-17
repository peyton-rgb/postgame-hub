// ============================================================
// My deal detail — upload / status (mockup screen 4b + states)
//
// Adapts to the deal's rolled-up stage:
//   content_due           → upload drop-zones (screen 4b)
//   in_review             → "in review" status
//   ready_to_post         → ready-to-post (Phase 4 builds the link flow)
//   awaiting_verification → posted, awaiting manager verification
//   paid                  → complete
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAthlete } from "@/lib/athlete-auth";
import { getDealParticipation } from "@/lib/athlete-deliverables";
import UploadDeliverables from "@/components/athlete/UploadDeliverables";
import PostDeliverables from "@/components/athlete/PostDeliverables";
import VideographerLinkButton from "@/components/videographer/VideographerLinkButton";
import { slotLabel } from "@/lib/deliverable-status";

export const dynamic = "force-dynamic";

const STAGE_TITLE: Record<string, string> = {
  content_due: "UPLOAD CONTENT",
  in_review: "IN REVIEW",
  ready_to_post: "READY TO POST",
  awaiting_verification: "AWAITING VERIFICATION",
  verified: "VERIFIED",
  paid: "COMPLETE",
};

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="a-card" style={{ margin: "0 18px", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: "var(--a-orange)", strokeWidth: 2, fill: "none", flex: "none", marginTop: 1 }}>
        <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" />
      </svg>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(250,248,245,0.8)" }}>{children}</span>
    </div>
  );
}

export default async function DealDetailPage({ params }: { params: { optinId: string } }) {
  const profile = await requireAthlete();
  const deal = await getDealParticipation(profile.id, params.optinId);
  if (!deal) notFound();

  const stageKey = deal.stage.key;

  return (
    <div>
      <div style={{ padding: "4px 18px 2px", display: "flex", alignItems: "center", gap: 8 }}>
        <Link href="/athlete/my-deals" style={{ display: "flex", color: "rgba(250,248,245,0.7)" }}>
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: "currentColor", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <div className="a-d" style={{ fontSize: 24, flex: 1 }}>{STAGE_TITLE[stageKey] || "DEAL"}</div>
        <div className="a-pill" style={deal.stage.pill.kind === "ok" ? { background: "rgba(52,199,89,0.16)", color: "var(--a-green)" } : deal.stage.pill.kind === "due" ? { background: "rgba(215,63,9,0.18)", color: "var(--a-orange-soft)" } : { background: "rgba(255,255,255,0.12)", color: "rgba(250,248,245,0.7)" }}>
          {deal.stage.pill.text}
        </div>
      </div>
      <div style={{ padding: "0 18px 14px" }}>
        <div style={{ fontSize: 12, color: "rgba(250,248,245,0.55)" }}>
          {deal.brandName} · {deal.title}
        </div>
      </div>

      {stageKey === "content_due" && (
        <UploadDeliverables
          optinId={deal.optinId}
          campaignId={deal.campaignId}
          athleteId={profile.id}
          deliverables={deal.deliverables.map((d) => ({ id: d.id, slot: d.slot, status: d.status, review_note: d.review_note, file_url: d.file_url, media_type: d.media_type }))}
        />
      )}

      {stageKey === "in_review" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StatusNote>
            Your content is in review by Postgame and {deal.brandName}. We&rsquo;ll notify you the
            moment it&rsquo;s approved — then you can post.
          </StatusNote>
          <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {deal.deliverables.map((d) => (
              <div key={d.id} className="a-card" style={{ display: "flex", alignItems: "center", gap: 11 }}>
                {d.file_url && d.media_type !== "video" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.file_url} alt="" style={{ width: 42, height: 42, borderRadius: 9, objectFit: "cover", flex: "none" }} />
                ) : (
                  <div style={{ width: 42, height: 42, borderRadius: 9, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: "#fff" }}><path d="M8 5v14l11-7z" /></svg>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--a-off)" }}>{slotLabel(d.slot)}</div>
                  <div style={{ fontSize: 11, color: "rgba(250,248,245,0.5)" }}>In review</div>
                </div>
                <span className="a-pill a-pill-neutral">In review</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(stageKey === "ready_to_post" || stageKey === "awaiting_verification" || stageKey === "verified") && (
        <>
          {stageKey === "verified" && (
            <StatusNote>All your posts are verified — your payout is scheduled. Track it on the Earnings tab.</StatusNote>
          )}
          <div style={{ height: stageKey === "verified" ? 12 : 0 }} />
          <PostDeliverables
            brandName={deal.brandName || "the brand"}
            deliverables={deal.deliverables.map((d) => ({ id: d.id, slot: d.slot, status: d.status, live_url: d.live_url, file_url: d.file_url, media_type: d.media_type }))}
          />
        </>
      )}

      {stageKey === "paid" && (
        <StatusNote>This deal is complete and your payout has been released. Thanks for posting!</StatusNote>
      )}

      {/* Delegate filming/uploading to a videographer */}
      {(stageKey === "content_due" || stageKey === "in_review") && (
        <div style={{ padding: "12px 18px 4px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(250,248,245,0.4)", marginBottom: 8 }}>
            Working with a videographer?
          </div>
          <VideographerLinkButton
            endpoint="/api/athlete/videographer-link"
            body={{ campaignId: deal.campaignId }}
            variant="athlete"
          />
        </div>
      )}
    </div>
  );
}
