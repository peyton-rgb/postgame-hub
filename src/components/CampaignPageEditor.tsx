"use client";

// ============================================================
// <CampaignPageEditor> — the editor for one public campaign page
// (/clients/[slug]/[campaign]). Rendered inside the website editor
// shell when ?page=campaign&id={recapId}. Two slots:
//   1. campaign.{id}.hero_carousel  (media, max 6)
//   2. campaign.{id}.gallery        (media, open count)
//
// This REPLACES the hero-editing that used to live in the recap
// editor at /dashboard/[id] (that gets cleaned up in Phase 5).
// ============================================================

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import SlotEditor from "@/components/SlotEditor";

const C = {
  orange: "#D73F09",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.13)",
  text: "#fff",
  text2: "rgba(255,255,255,0.6)",
  text3: "rgba(255,255,255,0.35)",
};

interface RecapInfo {
  name: string | null;
  slug: string | null;
  brandSlug: string | null;
}

export default function CampaignPageEditor({ recapId, onSaved }: { recapId: string; onSaved?: () => void }) {
  const supabase = createBrowserSupabase();
  const db = supabase as any;
  const [info, setInfo] = useState<RecapInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recapId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await db
        .from("campaign_recaps")
        .select("name, slug, brands(slug)")
        .eq("id", recapId)
        .maybeSingle();
      setInfo({
        name: data?.name ?? null,
        slug: data?.slug ?? null,
        brandSlug: (data?.brands as any)?.slug ?? null,
      });
      setLoading(false);
    })();
  }, [recapId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!recapId) {
    return <div style={{ padding: 24, color: C.text3, fontSize: 14 }}>Pick a campaign from the left.</div>;
  }
  if (loading) {
    return <div style={{ padding: 24, color: C.text3, fontSize: 14 }}>Loading…</div>;
  }

  const liveUrl = info?.brandSlug && info?.slug ? `/clients/${info.brandSlug}/${info.slug}` : null;

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{info?.name || "Campaign"}</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
            Public campaign page{liveUrl ? ` · ${liveUrl}` : ""}
          </div>
        </div>

        <Card title="Hero Carousel">
          <SlotEditor slotKey={`campaign.${recapId}.hero_carousel`} title="Hero Images" maxItems={6} onSaved={onSaved} />
          <Hint>Top-of-page heroes. Empty = the page auto-picks heroes (today’s behavior).</Hint>
        </Card>

        <Card title="Gallery">
          <SlotEditor slotKey={`campaign.${recapId}.gallery`} title="Gallery Override" onSaved={onSaved} />
          <Hint>Optional curated gallery. Empty = the page shows all of this campaign’s media automatically.</Hint>
        </Card>
      </div>

      <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
        {liveUrl ? (
          <a href={liveUrl} target="_blank" rel="noreferrer" style={{ padding: "9px 16px", border: `1px solid ${C.border2}`, borderRadius: 8, color: C.text2, fontSize: 12, fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            ↗ View Live
          </a>
        ) : (
          <span style={{ fontSize: 11, color: C.text3 }}>No public URL (campaign missing a slug or brand).</span>
        )}
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#161616", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: C.text3, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>{children}</div>;
}
