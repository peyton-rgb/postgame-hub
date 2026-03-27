"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import CampaignList from "@/components/CampaignList";
import RunOfShowList from "@/components/RunOfShowList";
import BriefList from "@/components/BriefList";
import DealList from "@/components/DealList";
import PressList from "@/components/PressList";
import CaseStudyList from "@/components/CaseStudyList";
import TrackerList from "@/components/TrackerList";
import BrandKitList from "@/components/BrandKitList";
import ComingSoon from "@/components/ComingSoon";
import { PostgameLogo } from "@/components/PostgameLogo";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";

const TABS = [
  { key: "recaps", label: "Recaps" },
  { key: "trackers", label: "Performance Trackers" },
  { key: "brands", label: "Brand Kits" },
  { key: "ros", label: "Run of Shows" },
  { key: "briefs", label: "Briefs" },
  { key: "deals", label: "Deal Tracker" },
  { key: "press", label: "Press" },
  { key: "case-studies", label: "Case Studies" },
  { key: "event-pages", label: "Event Pages" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabKey) || "recaps";

  function setTab(key: TabKey) {
    router.push(`/dashboard?tab=${key}`, { scroll: false });
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <PostgameLogo size="md" />
            <h1 className="text-xl font-black">Page Creator</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/brands"
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
              Brands
            </Link>
            <Link
              href="/media-library"
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Media Library
            </Link>
            <button
              onClick={async () => {
                await createBrowserSupabase().auth.signOut();
                window.location.href = "/login";
              }}
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-bold rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? "text-white border-b-2 border-[#D73F09] bg-white/5"
                  : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-8">
        {activeTab === "recaps" && <CampaignList />}
        {activeTab === "trackers" && <TrackerList />}
        {activeTab === "brands" && <BrandKitList />}
        {activeTab === "ros" && <RunOfShowList />}
        {activeTab === "briefs" && <BriefList />}
        {activeTab === "deals" && <DealList />}
        {activeTab === "press" && <PressList />}
        {activeTab === "case-studies" && <CaseStudyList />}
        {activeTab === "event-pages" && <ComingSoon label="Event Pages" />}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
