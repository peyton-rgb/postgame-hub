"use client";

// ============================================================
// <BrandPageEditor> — the editor for one public brand page
// (/clients/[slug]). Rendered inside the website editor shell when
// ?page=brand&slug={slug}. Three slots, per the v3 brief:
//   1. brand.{slug}.hero_carousel   (media, max 8)
//   2. brand.{slug}.featured_campaigns (recaps — RecapSlotEditor)
//   3. brand.{slug}.pull_quote      (1 media + one-line text)
// ============================================================

import SlotEditor from "@/components/SlotEditor";
import RecapSlotEditor from "@/components/RecapSlotEditor";
import { getBrandBySlug } from "@/lib/data/brands";

const C = {
  orange: "#D73F09",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.13)",
  surface2: "#161616",
  text: "#fff",
  text2: "rgba(255,255,255,0.6)",
  text3: "rgba(255,255,255,0.35)",
};

export default function BrandPageEditor({ slug, onSaved }: { slug: string; onSaved?: () => void }) {
  const brand = getBrandBySlug(slug);

  if (!slug) {
    return <div style={{ padding: 24, color: C.text3, fontSize: 14 }}>Pick a brand from the left.</div>;
  }
  if (!brand) {
    return <div style={{ padding: 24, color: C.text3, fontSize: 14 }}>Unknown brand “{slug}”.</div>;
  }

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{brand.name}</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>Public page · /clients/{slug}</div>
        </div>

        <Card title="Hero Carousel">
          <SlotEditor slotKey={`brand.${slug}.hero_carousel`} title="Hero Images" maxItems={8} treatAsHero onSaved={onSaved} />
          <Hint>Curated cross-campaign hero. Empty = the page falls back to this brand’s featured-campaign photos (today’s behavior).</Hint>
        </Card>

        <Card title="Featured Campaigns">
          <RecapSlotEditor slug={slug} brandName={brand.name} onSaved={onSaved} />
          <Hint>Pick which campaigns appear, in order. Empty = all of this brand’s campaigns show automatically.</Hint>
        </Card>

        <Card title="Pull Quote">
          <SlotEditor slotKey={`brand.${slug}.pull_quote`} title="Banner Image + Text" maxItems={1} acceptsText onSaved={onSaved} />
          <Hint>One image plus a one-line testimonial / stat / summary. Optional.</Hint>
        </Card>
      </div>

      <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
        <a href={`/clients/${slug}`} target="_blank" rel="noreferrer" style={{ padding: "9px 16px", border: `1px solid ${C.border2}`, borderRadius: 8, color: C.text2, fontSize: 12, fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          ↗ View Live
        </a>
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
