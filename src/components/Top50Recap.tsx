"use client";

import type { Campaign, Athlete, Media } from "@/lib/types";
import { fmt, pct, computeStats, getBestEngRate, getTotalImpressions, getTotalEngagements } from "@/lib/recap-helpers";
import { PostgameLogo } from "./PostgameLogo";
import { TopPerformerMedia } from "./TopPerformerMedia";
import { SchoolBadge } from "./SchoolBadge";

// ── Ranked athlete type ──────────────────────────────────────

type RankedAthlete = Athlete & { bestEngRate: number };

function rankAthletes(athletes: Athlete[], max = 50): RankedAthlete[] {
  return [...athletes]
    .map((a) => ({ ...a, bestEngRate: getBestEngRate(a) }))
    .sort((a, b) => b.bestEngRate - a.bestEngRate)
    .slice(0, max);
}

// ── Top 3 Hero Card ──────────────────────────────────────────

function Top3HeroCard({
  athlete,
  rank,
  items,
  isFirst,
}: {
  athlete: RankedAthlete;
  rank: number;
  items: Media[];
  isFirst: boolean;
}) {
  return (
    <div className={isFirst ? "flex-1 max-w-[340px]" : "flex-1 max-w-[280px]"}>
      <div
        className={`relative rounded-xl overflow-hidden ${
          isFirst
            ? "h-[380px] border-2 border-brand shadow-[0_0_24px_rgba(215,63,9,0.35)]"
            : "h-[320px] border border-white/10"
        }`}
      >
        {/* Media background */}
        {items.length > 0 ? (
          <TopPerformerMedia items={items} name={athlete.name} />
        ) : (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <span className="text-[10px] text-white/20 font-bold uppercase">No content</span>
          </div>
        )}

        {/* Rank badge */}
        <div
          className={`absolute top-3 left-3 w-10 h-10 rounded-full text-white text-lg font-black flex items-center justify-center z-10 ${
            isFirst ? "bg-brand" : "bg-white/20 backdrop-blur"
          }`}
        >
          {rank}
        </div>

        {/* Bottom gradient overlay with info */}
        <div className="absolute bottom-0 left-0 right-0 z-[5] px-4 pb-4 pt-16 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="flex items-center gap-2 mb-1">
            <SchoolBadge school={athlete.school} size={22} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black uppercase truncate">{athlete.name}</div>
              <div className="text-[10px] text-white/50 font-semibold flex items-center gap-1.5">
                {athlete.school}
                <span className="px-1 py-px rounded text-[7px] font-bold uppercase bg-brand text-white">
                  {athlete.sport}
                </span>
              </div>
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-wider text-white/35">Followers</div>
              <div className="text-xs font-bold text-white/70">{athlete.ig_followers ? fmt(athlete.ig_followers) : "\u2014"}</div>
            </div>
            <div>
              <div className="text-[8px] font-bold uppercase tracking-wider text-white/35">Impressions</div>
              <div className="text-xs font-bold text-white/70">{fmt(getTotalImpressions(athlete))}</div>
            </div>
            <div>
              <div className="text-[8px] font-bold uppercase tracking-wider text-white/35">Engagements</div>
              <div className="text-xs font-bold text-white/70">{fmt(getTotalEngagements(athlete))}</div>
            </div>
            <div>
              <div className="text-[8px] font-bold uppercase tracking-wider text-white/35">Eng. Rate</div>
              <div className={`text-xs font-black ${isFirst ? "text-brand" : "text-white/70"}`}>
                {pct(athlete.bestEngRate)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Hero Card ─────────────────────────────────────────

function MobileHeroCard({
  athlete,
  rank,
  items,
  isFirst,
}: {
  athlete: RankedAthlete;
  rank: number;
  items: Media[];
  isFirst: boolean;
}) {
  return (
    <div className={isFirst ? "col-span-2" : ""}>
      <div
        className={`relative rounded-xl overflow-hidden ${
          isFirst
            ? "h-[280px] border-2 border-brand shadow-[0_0_20px_rgba(215,63,9,0.3)]"
            : "h-[200px] border border-white/10"
        }`}
      >
        {items.length > 0 ? (
          <TopPerformerMedia items={items} name={athlete.name} />
        ) : (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <span className="text-[10px] text-white/20 font-bold uppercase">No content</span>
          </div>
        )}

        <div
          className={`absolute top-2 left-2 w-8 h-8 rounded-full text-white text-sm font-black flex items-center justify-center z-10 ${
            isFirst ? "bg-brand" : "bg-white/20 backdrop-blur"
          }`}
        >
          {rank}
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-[5] px-3 pb-3 pt-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="text-xs font-black uppercase truncate">{athlete.name}</div>
          <div className="text-[10px] text-white/50">{athlete.school}</div>
          <div className={`text-base font-black mt-1 ${isFirst ? "text-brand" : "text-white/70"}`}>
            {pct(athlete.bestEngRate)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Top 50 Component ────────────────────────────────────

export function Top50Recap({
  campaign,
  athletes,
  media,
}: {
  campaign: Campaign;
  athletes: Athlete[];
  media: Record<string, Media[]>;
}) {
  const settings = campaign.settings || {};
  const ranked = rankAthletes(athletes);
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const stats = computeStats(athletes);

  return (
    <div className="recap-container min-h-screen bg-black text-white font-sans">

      {/* ── POSTGAME TOP BAR ───────────────────────────────── */}
      <div className="px-6 md:px-12 py-3 border-b border-white/5 flex items-center justify-between">
        <PostgameLogo size="sm" className="opacity-50" />
        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/20">
          Top 50 Rankings
        </span>
      </div>

      {/* ── HERO HEADER ────────────────────────────────────── */}
      <div className="relative px-6 md:px-12 pt-8 md:pt-10 pb-8 md:pb-10 bg-gradient-to-b from-white/[0.04] to-black">
        <div className="flex flex-col gap-5">
          {/* Brand logo */}
          {settings.brand_logo_url ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 md:p-6 inline-flex items-center justify-center self-start">
              <img src={settings.brand_logo_url} className="h-12 md:h-20 object-contain" alt={campaign.client_name} />
            </div>
          ) : campaign.client_logo_url ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 md:p-6 inline-flex items-center justify-center self-start">
              <img src={campaign.client_logo_url} className="h-10 md:h-16 object-contain" alt={campaign.client_name} />
            </div>
          ) : null}

          {/* Badges row */}
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-brand text-white rounded text-[10px] font-black uppercase tracking-wider">
              Top 50
            </span>
            {settings.quarter && (
              <span className="px-2.5 py-1.5 bg-white/[0.06] border border-white/10 rounded text-[10px] font-bold uppercase tracking-wider text-white/60">
                {settings.quarter}
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-4xl font-black uppercase leading-tight">
            {campaign.name}
          </h1>

          {settings.description && (
            <p className="text-sm md:text-base text-white/40 leading-relaxed max-w-2xl">
              {settings.description}
            </p>
          )}

          {/* Tag pills */}
          {settings.tags && settings.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.tags.map((tag) => (
                <span key={tag} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand/15 text-brand border border-brand/20">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── AGGREGATE STATS ────────────────────────────────── */}
      <div className="px-6 md:px-12 py-8 md:py-10 border-t border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { value: String(stats.athleteCount), label: "ATHLETES" },
            { value: fmt(stats.totalReach), label: "TOTAL REACH" },
            { value: fmt(stats.totalImpressions), label: "TOTAL IMPRESSIONS" },
            { value: fmt(stats.totalEngagements), label: "TOTAL ENGAGEMENTS" },
            { value: pct(stats.avgEngRate), label: "AVG ENG. RATE" },
          ].map((m) => (
            <div key={m.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 md:p-5 text-center">
              <div className="text-xl md:text-2xl font-black text-white mb-1">{m.value}</div>
              <div className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-white/40">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOP 3 PODIUM ───────────────────────────────────── */}
      {top3.length > 0 && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/10">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wide mb-8">
            Top Performers
          </h2>

          {/* Desktop podium: #2 — #1 — #3 */}
          <div className="hidden md:flex items-end justify-center gap-4">
            {top3.length > 1 && (
              <Top3HeroCard athlete={top3[1]} rank={2} items={media[top3[1].id] || []} isFirst={false} />
            )}
            <Top3HeroCard athlete={top3[0]} rank={1} items={media[top3[0].id] || []} isFirst={true} />
            {top3.length > 2 && (
              <Top3HeroCard athlete={top3[2]} rank={3} items={media[top3[2].id] || []} isFirst={false} />
            )}
          </div>

          {/* Mobile: #1 full-width, #2 + #3 side-by-side */}
          <div className="md:hidden grid grid-cols-2 gap-2">
            {top3.map((a, i) => (
              <MobileHeroCard key={a.id} athlete={a} rank={i + 1} items={media[a.id] || []} isFirst={i === 0} />
            ))}
          </div>
        </div>
      )}

      {/* ── RANKED LIST #4-50 ──────────────────────────────── */}
      {rest.length > 0 && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/10">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wide mb-8">
            Full Rankings
          </h2>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 w-10">#</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 w-10"></th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30">Athlete</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30">School</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30">Sport</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 text-right">Followers</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 text-right">Impressions</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 text-right">Engagements</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 text-right">Eng. Rate</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((a, i) => {
                  const rank = i + 4;
                  const firstMedia = (media[a.id] || [])[0];
                  const thumbSrc = firstMedia?.thumbnail_url || (firstMedia?.type === "image" ? firstMedia?.file_url : null);
                  return (
                    <tr key={a.id} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                      <td className="px-3 py-3 text-sm font-black text-white/30">{rank}</td>
                      <td className="px-3 py-2">
                        {thumbSrc ? (
                          <img src={thumbSrc} className="w-8 h-8 rounded object-cover" alt="" />
                        ) : (
                          <SchoolBadge school={a.school} size={32} />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm font-black uppercase">{a.name}</div>
                        {a.ig_handle && <div className="text-[10px] text-white/30">@{a.ig_handle}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <SchoolBadge school={a.school} size={20} />
                          <span className="text-sm text-white/50">{a.school}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-brand/15 text-brand">
                          {a.sport}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-white/50 text-right">
                        {a.ig_followers ? fmt(a.ig_followers) : "\u2014"}
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-white/50 text-right">
                        {fmt(getTotalImpressions(a))}
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-white/50 text-right">
                        {fmt(getTotalEngagements(a))}
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-brand text-right">
                        {a.bestEngRate > 0 ? pct(a.bestEngRate) : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile compact cards */}
          <div className="md:hidden space-y-1">
            {rest.map((a, i) => {
              const rank = i + 4;
              return (
                <div key={a.id} className="flex items-center gap-3 py-3 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-sm font-black text-white/30 w-7 text-right flex-shrink-0">{rank}</span>
                  <SchoolBadge school={a.school} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black uppercase truncate">{a.name}</div>
                    <div className="text-[10px] text-white/40">{a.school} &middot; {a.sport}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-white/50">{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</div>
                    {a.bestEngRate > 0 && (
                      <div className="text-[10px] font-bold text-brand">{pct(a.bestEngRate)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <div className="recap-footer-area px-6 md:px-12 py-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <PostgameLogo size="sm" className="opacity-30" />
          <div className="flex items-center gap-3">
            {settings.brand_logo_url && (
              <img src={settings.brand_logo_url} className="h-5 object-contain opacity-50" alt="" />
            )}
            <span className="text-white/30">
              &copy; {new Date().getFullYear()} {campaign.client_name}
            </span>
          </div>
        </div>
        <div className="text-center mt-4">
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
            Powered by Postgame
          </span>
        </div>
      </div>
    </div>
  );
}
