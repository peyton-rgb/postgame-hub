// ============================================================
// Public videographer upload page (no auth)  —  /v/[token]
//
// Validates the token server-side (service role), then shows ONLY the brand +
// campaign + brief and an upload dropzone per deliverable for that one
// athlete+campaign. Renders nothing the token isn't scoped to.
// ============================================================

import { validateVideographerToken, ensureParticipation } from "@/lib/videographer";
import { createServiceSupabase } from "@/lib/supabase-server";
import VideographerUpload from "@/components/videographer/VideographerUpload";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload content — Postgame", robots: { index: false } };

function InactiveLink() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 26px" }}>
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div className="a-d" style={{ fontSize: 30 }}>LINK NOT ACTIVE</div>
        <p className="a-muted" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 10 }}>
          This upload link is no longer active. Ask your Postgame contact for a fresh link.
        </p>
      </div>
    </div>
  );
}

export default async function VideographerPage({ params }: { params: { token: string } }) {
  const link = await validateVideographerToken(params.token);
  if (!link) return <InactiveLink />;

  // Make sure the deliverable rows exist, then load only this deal's data.
  const optinId = await ensureParticipation(link.athleteId, link.optinCampaignId);
  if (!optinId) return <InactiveLink />;

  const service = createServiceSupabase();
  const [{ data: campaign }, { data: deliverables }] = await Promise.all([
    service
      .from("optin_campaigns")
      .select("title,requirements,goal,hero_image_url,brand:brands(name,logo_url)")
      .eq("id", link.optinCampaignId)
      .maybeSingle(),
    service
      .from("athlete_deliverables")
      .select("id,slot,status,file_url,media_type")
      .eq("optin_id", optinId)
      .order("slot", { ascending: true }),
  ]);

  if (!campaign) return <InactiveLink />;
  const brand = Array.isArray((campaign as any).brand) ? (campaign as any).brand[0] : (campaign as any).brand;
  const brandName = brand?.name || "the brand";
  const requirements = (campaign as any).requirements as string | null;
  const goal = (campaign as any).goal as string | null;

  return (
    <div>
      {/* Hero */}
      <div className="a-hero" style={{ height: 150 }}>
        {(campaign as any).hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="a-heroimg" src={(campaign as any).hero_image_url} alt="" />
        )}
        {brand?.logo_url && (
          <div className="a-logochip" style={{ top: 12, right: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logo_url} alt={brandName} />
          </div>
        )}
        <div className="a-overlay" style={{ display: "block" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(250,248,245,0.7)" }}>Content upload</div>
          <div className="a-d" style={{ fontSize: 22, textTransform: "uppercase" }}>{(campaign as any).title}</div>
        </div>
      </div>

      <div style={{ padding: "15px 18px 6px" }}>
        <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          You&rsquo;re uploading content for <b style={{ color: "var(--a-off)" }}>{brandName}</b>. Drop the files
          you shot below — Postgame will review them.
        </p>
      </div>

      {/* Brief (read-only) */}
      {(requirements || goal) && (
        <div style={{ padding: "0 18px 8px" }}>
          <div className="a-card" style={{ textAlign: "left" }}>
            <div className="a-d" style={{ fontSize: 16, marginBottom: 8 }}>THE BRIEF</div>
            {requirements && (
              <div style={{ fontSize: 13, color: "rgba(250,248,245,0.85)", lineHeight: 1.5, whiteSpace: "pre-line", marginBottom: goal ? 8 : 0 }}>
                {requirements}
              </div>
            )}
            {goal && <div style={{ fontSize: 12, color: "rgba(250,248,245,0.6)", lineHeight: 1.5 }}>{goal}</div>}
          </div>
        </div>
      )}

      <VideographerUpload
        token={params.token}
        deliverables={(deliverables ?? []).map((d: any) => ({
          id: d.id,
          slot: d.slot,
          status: d.status,
          file_url: d.file_url,
          media_type: d.media_type,
        }))}
      />

      <div style={{ padding: "0 18px 28px", textAlign: "center" }}>
        <div className="a-muted-2" style={{ fontSize: 11 }}>Private upload link · Postgame</div>
      </div>
    </div>
  );
}
