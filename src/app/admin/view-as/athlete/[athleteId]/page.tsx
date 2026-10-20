// ============================================================
// View as athlete · Home (prototype S["ath-home"]): the app's home
// feed, built from the live Mobile app cards in order (the same rule
// the Feed preview uses: live, in its schedule window, shown to
// everyone). Cards table arrives with migration 086 — until then the
// feed is honestly empty.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { listCards, loadBrandsFor, brandLogo, cardShowsTo } from "@/lib/admin/mobile-app/cards";
import { getPostgameLogos } from "@/lib/signup/postgameLogo";
import { loadPreviewAthlete } from "@/lib/admin/view-as/queries";
import CardArt from "@/components/admin/mobile-app/CardArt";
import { Btn } from "@/components/admin/campaign/bits";
import { ApScreen, ApTabs, ApTop, AthPhone, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

export default async function AthleteHomePreview({ params }: { params: { athleteId: string } }) {
  await requireAdmin("staff");
  const a = await loadPreviewAthlete(params.athleteId);
  if (!a) notFound();
  const supabase = createServiceSupabase();
  const [cards, logos] = await Promise.all([listCards(supabase), getPostgameLogos()]);
  const live = cards.rows.filter((c) => cardShowsTo(c, undefined, { audienceId: null }));
  const brands = await loadBrandsFor(supabase, live);
  const strip = live.find((c) => c.card_type === "strip_banner");
  const rest = live.filter((c) => c.card_type !== "strip_banner");

  return (
    <div>
      <PreviewHead
        title="Home"
        sub={`The app as ${a.name} sees it. Cards come from Mobile app → Cards.`}
        actions={<Btn href="/admin/mobile-app/cards">Manage cards</Btn>}
      />
      <AthPhone
        note={
          <>
            The home feed, built from the live cards in order. Tap a card to open its opt-in page.{" "}
            {cards.pending
              ? "The cards table arrives with migration 086, so the feed is empty until it's applied."
              : `${live.length} live card${live.length === 1 ? "" : "s"} shown to everyone right now; cards limited to an audience show only to athletes in it.`}
          </>
        }
      >
        <ApScreen>
          <ApTop title="For you" logo={logos.onDark} />
          {strip && (
            <div className="mb-3.5 px-3.5">
              <CardArt
                type="strip_banner"
                bgColor={strip.bg_color}
                mediaUrl={strip.media_url}
                posterUrl={strip.poster_url}
                eyebrow={null}
                headline={strip.headline}
                ctaLabel={null}
                brandLogoUrl={strip.brand_id ? brandLogo(brands.get(strip.brand_id) ?? null, "dark") : null}
                brandName={strip.brand_id ? brands.get(strip.brand_id)?.name ?? null : null}
                stripText={strip.headline || strip.name}
              />
            </div>
          )}
          {rest.length ? (
            <div className="space-y-4 px-3.5 pb-6">
              {rest.map((c) => {
                const b = c.brand_id ? brands.get(c.brand_id) ?? null : null;
                return (
                  <CardArt
                    key={c.id}
                    type={c.card_type}
                    bgColor={c.bg_color}
                    mediaUrl={c.media_url}
                    posterUrl={c.poster_url}
                    eyebrow={c.eyebrow}
                    headline={c.headline}
                    ctaLabel={c.card_type === "optin" ? c.cta_label || "OPT IN" : null}
                    brandLogoUrl={brandLogo(b, "dark")}
                    brandName={b?.name ?? null}
                  />
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-16 text-center text-[13px] text-[#AAAAB0]">No live cards in the feed right now.</div>
          )}
          <ApTabs on="Home" />
        </ApScreen>
      </AthPhone>
    </div>
  );
}
