"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign, Athlete, Media } from "@/lib/types";
import { PostgameLogo } from "@/components/PostgameLogo";
import Link from "next/link";

interface Brand {
  name: string;
  campaigns: Campaign[];
  totalMedia: number;
}

type View =
  | { level: "brands" }
  | { level: "campaigns"; brand: string }
  | { level: "athletes"; brand: string; campaign: Campaign }
  | { level: "media"; brand: string; campaign: Campaign; athlete: Athlete };

export default function MediaLibrary() {
  const supabase = createBrowserSupabase();
  const [view, setView] = useState<View>({ level: "brands" });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [athleteMediaCounts, setAthleteMediaCounts] = useState<Record<string, number>>({});
  const [campaignCounts, setCampaignCounts] = useState<Record<string, { athletes: number; media: number }>>({});
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<Media | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    // Fetch all data in parallel
    const [campsRes, athletesRes, mediaRes] = await Promise.all([
      supabase.from("campaign_recaps").select("*").order("created_at", { ascending: false }),
      supabase.from("athletes").select("id, campaign_id"),
      supabase.from("media").select("id, campaign_id").eq("is_video_thumbnail", false),
    ]);
    const camps = campsRes.data || [];
    const allAthletes = athletesRes.data || [];
    const allMedia = mediaRes.data || [];
    setCampaigns(camps);

    const counts: Record<string, { athletes: number; media: number }> = {};
    for (const c of camps) {
      counts[c.id] = {
        athletes: allAthletes.filter((a) => a.campaign_id === c.id).length,
        media: allMedia.filter((m) => m.campaign_id === c.id).length,
      };
    }
    setCampaignCounts(counts);

    // Group campaigns by brand (client_name)
    const brandMap = new Map<string, Campaign[]>();
    for (const c of camps) {
      const existing = brandMap.get(c.client_name) || [];
      existing.push(c);
      brandMap.set(c.client_name, existing);
    }
    setBrands(
      Array.from(brandMap.entries()).map(([name, brandCamps]) => ({
        name,
        campaigns: brandCamps,
        totalMedia: brandCamps.reduce((sum, c) => sum + (counts[c.id]?.media || 0), 0),
      }))
    );
    setLoading(false);
  }

  function openBrand(brandName: string) {
    setView({ level: "campaigns", brand: brandName });
  }

  async function openCampaign(campaign: Campaign, brandName: string) {
    setLoading(true);
    // Fetch athletes and their media counts in parallel
    const [athletesRes, mediaRes] = await Promise.all([
      supabase.from("athletes").select("*").eq("campaign_id", campaign.id).order("sort_order", { ascending: true }),
      supabase.from("media").select("id, athlete_id").eq("campaign_id", campaign.id).eq("is_video_thumbnail", false),
    ]);
    const athleteData = athletesRes.data || [];
    const mediaData = mediaRes.data || [];
    setAthletes(athleteData);

    const mediaCounts: Record<string, number> = {};
    for (const a of athleteData) {
      mediaCounts[a.id] = mediaData.filter((m) => m.athlete_id === a.id).length;
    }
    setAthleteMediaCounts(mediaCounts);

    setView({ level: "athletes", brand: brandName, campaign });
    setLoading(false);
  }

  async function openAthlete(athlete: Athlete) {
    if (view.level !== "athletes") return;
    setLoading(true);
    const { data } = await supabase
      .from("media")
      .select("*")
      .eq("athlete_id", athlete.id)
      .eq("is_video_thumbnail", false)
      .order("sort_order", { ascending: true });
    setMedia(data || []);
    setView({ level: "media", brand: view.brand, campaign: view.campaign, athlete });
    setLoading(false);
  }

  function goBack() {
    if (view.level === "media") {
      openCampaign(view.campaign, view.brand);
    } else if (view.level === "athletes") {
      setView({ level: "campaigns", brand: view.brand });
    } else if (view.level === "campaigns") {
      setView({ level: "brands" });
    }
  }

  // Get brand campaigns for current view
  function getBrandCampaigns(brandName: string) {
    return campaigns.filter((c) => c.client_name === brandName);
  }

  function Breadcrumb() {
    return (
      <div className="flex items-center gap-2 text-sm mb-6 flex-wrap">
        <button
          onClick={() => setView({ level: "brands" })}
          className={`font-bold transition-colors ${
            view.level === "brands" ? "text-white" : "text-gray-500 hover:text-white"
          }`}
        >
          All Brands
        </button>
        {view.level !== "brands" && (
          <>
            <span className="text-gray-600">/</span>
            <button
              onClick={() => openBrand(view.brand)}
              className={`font-bold transition-colors ${
                view.level === "campaigns" ? "text-white" : "text-gray-500 hover:text-white"
              }`}
            >
              {view.brand}
            </button>
          </>
        )}
        {(view.level === "athletes" || view.level === "media") && (
          <>
            <span className="text-gray-600">/</span>
            <button
              onClick={() => openCampaign(view.campaign, view.brand)}
              className={`font-bold transition-colors ${
                view.level === "athletes" ? "text-white" : "text-gray-500 hover:text-white"
              }`}
            >
              {view.campaign.name}
            </button>
          </>
        )}
        {view.level === "media" && (
          <>
            <span className="text-gray-600">/</span>
            <span className="font-bold text-white">{view.athlete.name}</span>
          </>
        )}
      </div>
    );
  }

  // Back button shared across views
  function BackButton() {
    return (
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-white font-bold mb-4 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <PostgameLogo size="md" />
            </Link>
            <h1 className="text-xl font-black">Media Library</h1>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-white font-bold transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <Breadcrumb />

        {loading ? (
          <div className="text-gray-500 text-center py-20">Loading...</div>
        ) : (
          <>
            {/* === BRANDS VIEW === */}
            {view.level === "brands" && (
              brands.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-gray-500 mb-2">No campaigns yet.</p>
                  <Link href="/dashboard" className="text-[#D73F09] font-bold text-sm hover:underline">
                    Create a campaign to get started
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {brands.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => openBrand(b.name)}
                      className="text-left p-5 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-sm truncate group-hover:text-white">{b.name}</h3>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>{b.campaigns.length} campaign{b.campaigns.length !== 1 ? "s" : ""}</span>
                        <span>{b.totalMedia} files</span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* === CAMPAIGNS VIEW === */}
            {view.level === "campaigns" && (
              <>
                <BackButton />
                {(() => {
                  const brandCampaigns = getBrandCampaigns(view.brand);
                  return brandCampaigns.length === 0 ? (
                    <div className="text-center py-20">
                      <p className="text-gray-500 mb-2">No campaigns for this brand.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {brandCampaigns.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => openCampaign(c, view.brand)}
                          className="text-left p-5 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-all group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-[#D73F09]/10 border border-[#D73F09]/20 flex items-center justify-center flex-shrink-0">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D73F09" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-black text-sm truncate group-hover:text-white">{c.name}</h3>
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-600">
                            <span>{campaignCounts[c.id]?.athletes || 0} athletes</span>
                            <span>{campaignCounts[c.id]?.media || 0} files</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}

            {/* === ATHLETES VIEW === */}
            {view.level === "athletes" && (
              <>
                <BackButton />
                {athletes.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-gray-500 mb-2">No athletes in this campaign.</p>
                    <Link
                      href={`/dashboard/${view.campaign.id}`}
                      className="text-[#D73F09] font-bold text-sm hover:underline"
                    >
                      Add athletes in the campaign editor
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {athletes.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => openAthlete(a)}
                        className="text-left p-5 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-black text-sm truncate group-hover:text-white">{a.name}</h3>
                            <p className="text-xs text-gray-500">
                              {[a.sport, a.school].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-600">
                          <span>{athleteMediaCounts[a.id] || 0} files</span>
                          {a.ig_handle && <span>@{a.ig_handle}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* === MEDIA VIEW === */}
            {view.level === "media" && (
              <>
                <BackButton />
                {media.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-gray-500 mb-2">No media uploaded for this athlete.</p>
                    <Link
                      href={`/dashboard/${view.campaign.id}`}
                      className="text-[#D73F09] font-bold text-sm hover:underline"
                    >
                      Upload content in the campaign editor
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {media.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setLightbox(m)}
                        className="relative aspect-square bg-[#111] border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-all group"
                      >
                        {m.type === "video" ? (
                          <>
                            {m.thumbnail_url ? (
                              <img
                                src={m.thumbnail_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={m.file_url}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                            )}
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] font-bold text-white flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              VIDEO
                            </div>
                          </>
                        ) : (
                          <img
                            src={m.file_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            <line x1="11" y1="8" x2="11" y2="14" />
                            <line x1="8" y1="11" x2="14" y2="11" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-4xl max-h-[85vh] w-full">
            {lightbox.type === "video" ? (
              <video
                src={lightbox.file_url}
                controls
                autoPlay
                className="w-full max-h-[85vh] rounded-lg"
              />
            ) : (
              <img
                src={lightbox.file_url}
                alt=""
                className="w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
