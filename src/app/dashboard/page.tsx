"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import OptInList from "@/components/OptInList";
import CampaignList from "@/components/CampaignList";
import RunOfShowList from "@/components/RunOfShowList";
import BriefList from "@/components/BriefList";
import TrackerList from "@/components/TrackerList";
import { PostgameLogo } from "@/components/PostgameLogo";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";

const TABS = [
  { key: "recaps",       label: "Recaps" },
  { key: "trackers",     label: "Performance Trackers" },
  { key: "ros",          label: "Run of Shows" },
  { key: "briefs",       label: "Briefs" },
  { key: "newsletter",   label: "Newsletter" },
  { key: "instructions", label: "Campaign Instructions" },
  { key: "optin",        label: "Campaign Opt-In" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function RedirectTab({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:400 }}>
      <div style={{ textAlign:"center", maxWidth:480 }}>
        <div style={{ fontSize:32, marginBottom:16 }}>
          {label === "Newsletter Creator" ? "📧" : label === "Campaign Instructions" ? "📋" : "✅"}
        </div>
        <h2 style={{ fontSize:22, fontWeight:900, marginBottom:12, color:"#fff" }}>{label}</h2>
        <p style={{ fontSize:15, color:"rgba(255,255,255,0.5)", lineHeight:1.6, marginBottom:28 }}>{desc}</p>
        <Link href={href} style={{ display:"inline-block", padding:"12px 28px", background:"#D73F09", borderRadius:8, color:"#fff", fontWeight:800, fontSize:13, textDecoration:"none", textTransform:"uppercase", letterSpacing:"0.07em" }}>
          Open {label} →
        </Link>
      </div>
    </div>
  );
}

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
              href="/dashboard/content/tier3-queue"
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
              Tier 3 Queue
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
            <Link
              href="/dashboard/website"
              className="flex items-center gap-2 px-5 py-2 text-sm font-black text-[#D73F09] border-2 border-[#D73F09] hover:bg-[#D73F09] hover:text-white rounded-lg transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Website Editor
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
        {activeTab === "ros" && <RunOfShowList />}
        {activeTab === "briefs" && <BriefList />}
        {activeTab === "newsletter"   && <RedirectTab href="/dashboard/newsletter" label="Newsletter Creator" desc="Build exportable Mailchimp newsletters tied to brand campaigns." />}
        {activeTab === "instructions" && <RedirectTab href="/dashboard/campaign-instructions" label="Campaign Instructions" desc="Create athlete + crew instruction pages with deliverables, dos/don'ts, and contact info." />}
        {activeTab === "optin"        && <OptInList />}

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
