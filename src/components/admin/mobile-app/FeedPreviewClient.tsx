"use client";

// ============================================================
// FeedPreviewClient — Interactive phone-framed athlete home feed
// Matching prototype screen S["app-feed"] & feedScreen().
// Allows filtering by audience cohort ("Preview as"), renders cards
// inside the authentic IPhoneFrame using CardArt, and displays
// the feed manifest table beside the phone.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CARD_SPEC,
  brandLogo,
  cardShowsTo,
  visibilityLabel,
  type AudienceOption,
  type CardRow,
  type Whitelist,
} from "@/lib/admin/mobile-app/types";
import type { BrandLite } from "@/lib/admin/campaigns/types";
import { IPhoneFrame } from "@/components/admin/campaign/OptinPreview";
import CardArt from "./CardArt";

interface FeedPreviewClientProps {
  cards: CardRow[];
  whitelists: Record<string, Whitelist>;
  brands: Record<string, BrandLite>;
  audiences: AudienceOption[];
  postgameLogoUrl: string;
}

export default function FeedPreviewClient({
  cards,
  whitelists,
  brands,
  audiences,
  postgameLogoUrl,
}: FeedPreviewClientProps) {
  const [selectedAudienceId, setSelectedAudienceId] = useState<string>("everyone");

  const audienceName = useMemo(() => {
    if (selectedAudienceId === "everyone") return "Everyone";
    return audiences.find((a) => a.id === selectedAudienceId)?.name ?? null;
  }, [audiences, selectedAudienceId]);

  // Filter live cards by audience
  const feedCards = useMemo(() => {
    return cards.filter((c) =>
      cardShowsTo(c, whitelists[c.id], {
        audienceId: selectedAudienceId === "everyone" ? null : selectedAudienceId,
      })
    );
  }, [cards, whitelists, selectedAudienceId]);

  const strip = useMemo(() => feedCards.find((c) => c.card_type === "strip_banner"), [feedCards]);
  const rest = useMemo(() => feedCards.filter((c) => c.card_type !== "strip_banner"), [feedCards]);

  return (
    <div className="space-y-6">
      {/* Header matching prototype */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Mobile App · Feed</h1>
          <p className="mt-1 text-[13px] text-stone-500">
            The home feed as athletes see it, built from the Cards list in order. Click a card to edit it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[13px] text-stone-600">
            <span className="font-medium text-stone-700">Preview as:</span>
            <select
              value={selectedAudienceId}
              onChange={(e) => setSelectedAudienceId(e.target.value)}
              aria-label="Preview as"
              className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-800 focus:border-[#D73F09] focus:outline-none"
            >
              <option value="everyone">Everyone</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/admin/mobile-app/cards"
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="7" height="7" rx="1.5" />
              <rect x="13" y="4" width="7" height="7" rx="1.5" />
              <rect x="4" y="13" width="7" height="7" rx="1.5" />
              <rect x="13" y="13" width="7" height="7" rx="1.5" />
            </svg>
            Manage cards
          </Link>
          <Link
            href="/admin/mobile-app/cards/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Card
          </Link>
        </div>
      </div>

      {/* Main layout: Phone Stage + Manifest Card */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[410px_minmax(0,1fr)]">
        {/* Left: The Phone Preview Stage */}
        <div className="flex justify-center py-2 lg:sticky lg:top-4">
          <IPhoneFrame>
            <div className="flex min-h-full flex-col bg-[#0C0C10] font-sans text-white">
              {/* App Top Bar */}
              <div className="flex items-center justify-between px-4 pb-3 pt-14">
                <img
                  src={postgameLogoUrl}
                  alt="Postgame"
                  className="h-4 w-auto object-contain"
                />
                <span className="text-[10px] font-bold text-[#DF4A06]">●</span>
              </div>

              {/* Strip Banner if present */}
              {strip && (
                <div className="mb-3.5 px-3.5">
                  <Link href={`/admin/mobile-app/cards/${strip.id}`} className="block transition hover:opacity-90">
                    <CardArt
                      type="strip_banner"
                      bgColor={strip.bg_color}
                      mediaUrl={strip.media_url}
                      posterUrl={strip.poster_url}
                      eyebrow={null}
                      headline={strip.headline}
                      ctaLabel={null}
                      brandLogoUrl={strip.brand_id ? brandLogo(brands[strip.brand_id], "dark") : null}
                      brandName={strip.brand_id ? brands[strip.brand_id]?.name ?? null : null}
                      stripText={strip.headline || strip.name}
                    />
                  </Link>
                </div>
              )}

              {/* Section Header */}
              <div className="mb-2.5 px-4 text-[17px] font-extrabold tracking-tight text-white font-['Poppins',sans-serif]">
                For you
              </div>

              {/* Live cards stream */}
              {rest.length === 0 ? (
                <div className="px-4 py-16 text-center text-[13px] text-stone-500">
                  {cards.length === 0 ? (
                    <div>
                      <p className="font-medium text-stone-400">No cards created yet.</p>
                      <p className="mt-1 text-xs">Create cards in the admin to see them live on the feed.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-stone-400">No live cards in this view.</p>
                      <p className="mt-1 text-xs">Cards set to draft or restricted to other audiences are hidden.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 px-3.5 pb-6">
                  {rest.map((c) => {
                    const spec = CARD_SPEC[c.card_type];
                    const b = c.brand_id ? brands[c.brand_id] : null;
                    return (
                      <div key={c.id}>
                        <Link href={`/admin/mobile-app/cards/${c.id}`} className="block transition hover:opacity-95">
                          <CardArt
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
                        </Link>
                        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-[#AAAAB0]">
                          <span className="truncate font-medium text-stone-300">{c.name}</span>
                          <span className="shrink-0 text-[#6B6B73]">
                            {spec.label} · {visibilityLabel(c, whitelists[c.id], audienceName)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom athlete app tabs */}
              <div className="sticky bottom-0 mt-auto flex justify-around border-t border-[#303036] bg-[#0C0C10]/95 px-2 py-3 pb-6 text-[10px] font-semibold text-[#6B6B73] backdrop-blur">
                <span className="flex flex-col items-center gap-0.5 text-[#DF4A06]">
                  <span className="text-[12px]">⌂</span>
                  <span>Home</span>
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-[12px]">★</span>
                  <span>Campaigns</span>
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-[12px]">⚡</span>
                  <span>My deals</span>
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-[12px]">☺</span>
                  <span>Profile</span>
                </span>
              </div>
            </div>
          </IPhoneFrame>
        </div>

        {/* Right: In this feed manifest */}
        <section className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-stone-900">In this feed</h2>
            <div className="mt-0.5 text-[12px] text-stone-500">
              {feedCards.length} live card{feedCards.length === 1 ? "" : "s"}, in display order. Drag to reorder on the Cards page.
            </div>
          </div>

          {feedCards.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-stone-500">
              No live cards match this view. Switch the &ldquo;Preview as&rdquo; selector or publish cards on the Cards page.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {feedCards.map((c, i) => {
                const spec = CARD_SPEC[c.card_type];
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-stone-50/70"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 text-center text-xs font-semibold tabular-nums text-stone-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/mobile-app/cards/${c.id}`}
                          className="block truncate text-[13px] font-medium text-stone-900 hover:text-[#D73F09] hover:underline"
                        >
                          {c.name}
                        </Link>
                        <div className="text-[12px] text-stone-500">
                          {spec.label} · {spec.aspect} · {visibilityLabel(c, whitelists[c.id], audienceName)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[12px]">
                      <Link
                        href={`/admin/mobile-app/cards/${c.id}`}
                        className="font-medium text-[#D73F09] hover:underline"
                      >
                        Edit
                      </Link>
                      {c.card_type === "optin" && c.campaign_id && (
                        <Link
                          href={`/admin/campaigns/${c.campaign_id}/page`}
                          className="text-stone-500 hover:text-stone-900 hover:underline"
                        >
                          Opt-in page →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-stone-200 bg-stone-50/70 px-5 py-3 text-[12px] text-stone-500">
            Cards marked draft don&rsquo;t show. Visibility rules come from each card&rsquo;s audience, college, sport or handle list.
          </div>
        </section>
      </div>
    </div>
  );
}
