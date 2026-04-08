"use client";

import { useState } from "react";
import Image from "next/image";
import { createBrowserSupabase } from "@/lib/supabase";

const POSTGAME_LOGO_URL = "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/brand-kits/1774632055938-16gy1u2t.PNG";

/**
 * OptInLanding — public-facing landing page for an opt-in campaign.
 *
 * Renders the redesigned mobile-first opt-in experience that replaces
 * the old hand-built Wix pages. Layout matches the visualizer mockup:
 *
 *   1. Hero photo with brand mark + "New NIL Opportunity" pill + campaign title
 *   2. Payout/Deadline mini-cards
 *   3. Optional NOTICE callout (eligibility/important note in amber)
 *   4. Brief bullets (Goal / Requirements / Products)
 *   5. Form (just IG handle + green CTA)
 *   6. "Powered by Postgame" footer
 *
 * The form submits straight to Supabase via RLS-permitted INSERT into
 * pending_optins. The ColdFusion admin polls that table separately.
 */

interface OptInCampaign {
  id: string;
  slug: string;
  brand_id: string | null;
  admin_campaign_id: number | null;
  title: string;
  headline: string;
  goal: string | null;
  products: string | null;
  social_platforms: string[] | null;
  requirements: string | null;
  payout: string | null;
  deadline: string | null;
  notice: string | null;
  hero_image_url: string | null;
  accent_color: string | null;
  brands?: {
    id: string;
    name: string;
    logo_light_url: string | null;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
}

interface Props {
  campaign: OptInCampaign;
  /** When true, renders without the actual form submission (for editor preview). */
  previewMode?: boolean;
}

export default function OptInLanding({ campaign, previewMode = false }: Props) {
  const supabase = createBrowserSupabase();

  const [igHandle, setIgHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brand = campaign.brands || null;
  const brandLogo = brand?.logo_light_url || brand?.logo_url || null;
  const brandName = brand?.name || campaign.title;
  const accent = campaign.accent_color || brand?.primary_color || "#D73F09";
  const heroImage = campaign.hero_image_url;

  const deadline = campaign.deadline ? new Date(campaign.deadline) : null;
  const deadlineLabel = deadline
    ? deadline.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

  async function handleSubmit() {
    if (previewMode) return;

    const handle = igHandle.trim().replace(/^@/, "");
    if (!handle) {
      setError("Please enter your Instagram handle.");
      return;
    }
    if (handle.length < 2) {
      setError("That doesn't look like a valid handle.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("pending_optins").insert({
      optin_campaign_id: campaign.id,
      ig_handle: handle,
      source: "direct",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });

    setSubmitting(false);

    if (insertError) {
      console.error("optin submit error", insertError);
      setError("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-md mx-auto">
        {/* Hero — photo background, brand mark, headline pill, title */}
        <div className="relative h-[380px] overflow-hidden">
          {heroImage ? (
            <Image
              src={heroImage}
              alt=""
              fill={true}
              sizes="(max-width: 768px) 100vw, 768px"
              priority={true}
              className="object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, #d4845a 0%, #8b4513 50%, #2c1810 100%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/95" />

          {/* Top bar */}
          <div className="absolute top-4 left-4 right-4 flex items-start justify-between z-10">
            <div className="flex flex-col items-start gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/60">Powered by</span>
              <img src={POSTGAME_LOGO_URL} alt="Postgame" className="h-5 object-contain" />
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/60">
              Opt-In
            </div>
          </div>

          {/* Bottom of hero — title block */}
          <div className="absolute left-5 right-5 bottom-5 z-10">
            <div className="inline-block px-2.5 py-1 bg-white/[0.18] backdrop-blur-sm rounded-full text-[9px] font-bold text-white tracking-[0.12em] uppercase mb-3">
              {campaign.headline}
            </div>
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="h-12 md:h-14 object-contain mb-2"
              />
            ) : (
              <div className="text-3xl font-black text-white tracking-tight leading-none">
                {brandName}
              </div>
            )}
            <div className="text-sm text-white/75 mt-1.5">{campaign.title}</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pt-5 pb-6">
          {/* Payout / Deadline mini-cards */}
          {(campaign.payout || deadlineLabel) && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              {campaign.payout && (
                <div className="bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5">
                  <div className="text-[9px] text-white/50 tracking-[0.1em] uppercase mb-1 font-bold">
                    Payout
                  </div>
                  <div className="text-[13px] text-white font-bold leading-snug">
                    {campaign.payout}
                  </div>
                </div>
              )}
              {deadlineLabel && (
                <div className="bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5">
                  <div className="text-[9px] text-white/50 tracking-[0.1em] uppercase mb-1 font-bold">
                    Deadline
                  </div>
                  <div className="text-[13px] text-white font-bold leading-snug">
                    {deadlineLabel}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form — positioned early so athletes see it without scrolling */}
          <div className="bg-white/[0.04] border border-white/[0.12] rounded-2xl p-4 mb-5">
            {submitted ? (
              <div className="text-center py-4">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto mb-3"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div className="text-base font-black text-white mb-1">You're in.</div>
                <div className="text-xs text-white/60">
                  We'll be in touch soon with next steps.
                </div>
              </div>
            ) : (
              <>
                <div className="text-[11px] text-white/50 tracking-[0.1em] uppercase mb-2.5 font-bold">
                  Your Instagram
                </div>
                <div className="bg-black border border-white/20 rounded-xl px-3.5 py-3 flex items-center gap-2 mb-3">
                  <span className="text-white/40 text-sm">@</span>
                  <input
                    type="text"
                    value={igHandle}
                    onChange={(e) => setIgHandle(e.target.value)}
                    placeholder="your.handle"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={submitting || previewMode}
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30"
                  />
                </div>
                {error && (
                  <div className="text-xs text-red-400 mb-3 px-1">{error}</div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || previewMode}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-black uppercase tracking-wider disabled:opacity-50 transition-colors"
                  style={{ background: "#16A34A" }}
                >
                  {submitting ? "Submitting…" : "Count Me In"}
                </button>
              </>
            )}
          </div>

          {/* NOTICE callout (eligibility / heads-up) */}
          {campaign.notice && (
            <div className="mb-5 flex items-start gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 mt-0.5"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-400 mb-0.5">
                  Notice
                </div>
                <div className="text-[13px] text-amber-100/90 leading-snug">
                  {campaign.notice}
                </div>
              </div>
            </div>
          )}

          {/* Brief bullets */}
          {(campaign.requirements || campaign.products) && (
            <div className="mb-5">
              {campaign.requirements && (
                <BriefRow label="Requirements" value={campaign.requirements} />
              )}
              {campaign.products && (
                <BriefRow label="Products" value={campaign.products} />
              )}
            </div>
          )}

          <div className="text-center pt-4 pb-2 text-[10px] text-white/30">
            Powered by Postgame
          </div>
        </div>
      </div>
    </div>
  );
}

function BriefRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="py-4 border-b border-white/[0.08] last:border-b-0">
      <div className="text-[15px] leading-relaxed">
        <span className="font-black text-white">{label}</span>
        <span className="text-white/40 mx-2">—</span>
        <span className="font-medium text-white/85 whitespace-pre-line">{value}</span>
      </div>
    </div>
  );
}
