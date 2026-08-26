// Hero: brand mark, title, meta line, and a full-bleed carousel behind them.
// The carousel is the part that can be absent — 2 published campaigns have no
// usable media at all — so the plate has to stand on its own without it.
import { hasRichText } from "@/lib/recap-v2/guards";
import type { Campaign, Media } from "@/lib/types";

export function HeroSection({ campaign, slides }: { campaign: Campaign; slides: Media[] }) {
  const s = campaign.settings || {};
  // Meta line: each part drops independently rather than leaving stray separators.
  const meta = ["Campaign recap", s.campaign_type].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  return (
    <header id="hero" data-recap-v2="hero">
      {/* Carousel slot. Zero slides renders no <img> and no dots — the hero
          falls back to the flat plate rather than an empty frame. */}
      <div data-slot="slides" data-count={slides.length} />
      {s.brand_logo_url ? <img src={s.brand_logo_url} alt={campaign.client_name || ""} /> : null}
      {campaign.client_name ? <p data-slot="kicker">{campaign.client_name}</p> : null}
      <h1>{campaign.name}</h1>
      {/* 15 of 82 campaigns have no description. No paragraph, no empty block. */}
      {hasRichText(s.description) ? <p data-slot="desc-present" /> : null}
      {meta.length > 0 ? <p data-slot="meta">{meta.join(" · ")}</p> : null}
    </header>
  );
}
