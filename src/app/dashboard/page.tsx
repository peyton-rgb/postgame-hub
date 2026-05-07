"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import OptInList from "@/components/OptInList";
import CampaignList from "@/components/CampaignList";
import RunOfShowList from "@/components/RunOfShowList";
import BriefList from "@/components/BriefList";
import PitchList from "@/components/PitchList";
import TrackerList from "@/components/TrackerList";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";

// ────────────────────────────────────────────────
// Sidebar navigation structure — grouped by stage
// ────────────────────────────────────────────────

type NavItem =
  | { type: "link"; key: string; label: string; href: string; icon: React.ReactNode }
  | { type: "tab"; key: string; label: string; icon: React.ReactNode };

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Creative Brain",
    items: [
      {
        type: "link", key: "brand-briefs", label: "Brand Briefs",
        href: "/dashboard/campaign-briefs",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="15" y2="17" />
          </svg>
        ),
      },
      {
        type: "link", key: "inspo", label: "Inspo Library",
        href: "/dashboard/inspo",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        ),
      },
      {
        type: "link", key: "reviews", label: "Reviews",
        href: "/dashboard/reviews",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
      {
        type: "link", key: "assets", label: "Assets",
        href: "/dashboard/assets",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Distribution",
    items: [
      {
        type: "link", key: "captions", label: "Captions",
        href: "/dashboard/captions",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        type: "link", key: "publishing", label: "Publishing",
        href: "/dashboard/publishing",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Analytics",
    items: [
      {
        type: "link", key: "performance", label: "Performance",
        href: "/dashboard/performance",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
      },
      {
        type: "link", key: "roi", label: "ROI",
        href: "/dashboard/roi",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Pages",
    items: [
      {
        type: "tab", key: "recaps", label: "Recaps",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ),
      },
      {
        type: "tab", key: "trackers", label: "Performance Trackers",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
      },
      {
        type: "tab", key: "ros", label: "Run of Shows",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      },
      {
        type: "tab", key: "briefs", label: "Legacy Briefs",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
      },
      {
        type: "tab", key: "pitches", label: "Pitches",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ),
      },
      {
        type: "tab", key: "newsletter", label: "Newsletter",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
          </svg>
        ),
      },
      {
        type: "tab", key: "instructions", label: "Campaign Instructions",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        ),
      },
      {
        type: "tab", key: "optin", label: "Campaign Opt-In",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        type: "link", key: "brands", label: "Brands",
        href: "/dashboard/brands",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        ),
      },
      {
        type: "link", key: "media", label: "Media Library",
        href: "/media-library",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        type: "link", key: "bts", label: "BTS Submissions",
        href: "/dashboard/bts",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ),
      },
      {
        type: "link", key: "intake", label: "Intake",
        href: "/dashboard/intake",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        ),
      },
      {
        type: "link", key: "website", label: "Website Editor",
        href: "/dashboard/website",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ),
      },
    ],
  },
];

// Tab keys for the "Pages" group (inline content)
type TabKey = "recaps" | "trackers" | "ros" | "briefs" | "pitches" | "newsletter" | "instructions" | "optin";

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
  const [collapsed, setCollapsed] = useState(false);

  function setTab(key: TabKey) {
    router.push(`/dashboard?tab=${key}`, { scroll: false });
  }

  // Determine which sidebar item is "active"
  function isActive(item: NavItem): boolean {
    if (item.type === "tab") return item.key === activeTab;
    return false; // Links navigate away, so they're never "active" on this page
  }

  return (
    <div className="min-h-screen flex">
      {/* ───── Sidebar ───── */}
      <aside
        className={`fixed top-0 left-0 h-full bg-[#0a0a0f] border-r border-gray-800 flex flex-col z-50 transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          {!collapsed && (
            <img src="/postgame-logo-white.png" className="h-5 object-contain" alt="Postgame" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-500 hover:text-white transition-colors p-1"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {group.label}
                </div>
              )}
              {collapsed && <div className="border-t border-gray-800 mx-2 mb-2" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);

                  if (item.type === "link") {
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  }

                  // Tab items (Pages group — render inline content)
                  return (
                    <button
                      key={item.key}
                      onClick={() => setTab(item.key as TabKey)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                        active
                          ? "bg-[#D73F09]/10 text-[#D73F09]"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sign out at bottom */}
        <div className="border-t border-gray-800 p-2">
          <button
            onClick={async () => {
              await createBrowserSupabase().auth.signOut();
              window.location.href = "/login";
            }}
            title={collapsed ? "Sign Out" : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ───── Main content ───── */}
      <main className={`flex-1 transition-all duration-200 ${collapsed ? "ml-16" : "ml-60"}`}>
        {/* Minimal top bar */}
        <div className="border-b border-gray-800 px-8 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">
            {/* Show the active page name */}
            {NAV_GROUPS.flatMap((g) => g.items).find((i) => isActive(i))?.label || "Postgame Hub"}
          </h1>
        </div>

        {/* Tab content */}
        <div className="p-8">
          {activeTab === "recaps" && <CampaignList />}
          {activeTab === "trackers" && <TrackerList />}
          {activeTab === "ros" && <RunOfShowList />}
          {activeTab === "briefs" && <BriefList />}
          {activeTab === "pitches" && <PitchList />}
          {activeTab === "newsletter"   && <RedirectTab href="/dashboard/newsletter" label="Newsletter Creator" desc="Build exportable Mailchimp newsletters tied to brand campaigns." />}
          {activeTab === "instructions" && <RedirectTab href="/dashboard/campaign-instructions" label="Campaign Instructions" desc="Create athlete + crew instruction pages with deliverables, dos/don'ts, and contact info." />}
          {activeTab === "optin"        && <OptInList />}
        </div>
      </main>
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
