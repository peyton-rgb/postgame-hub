"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignROI {
  campaign_id: string;
  campaign_name: string;
  budget: number;
  total_views: number;
  total_engagement: number;
  cost_per_view: number | null;
  cost_per_engagement: number | null;
  asset_count: number;
  avg_engagement_rate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function dollar(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function costColor(cpe: number | null): string {
  if (cpe === null) return "text-gray-400";
  if (cpe < 1) return "text-green-400";
  if (cpe < 5) return "text-yellow-400";
  return "text-red-400";
}

function costBorder(cpe: number | null): string {
  if (cpe === null) return "border-gray-700";
  if (cpe < 1) return "border-green-600/40";
  if (cpe < 5) return "border-yellow-600/40";
  return "border-red-600/40";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ROIDashboardPage() {
  const [campaigns, setCampaigns] = useState<CampaignROI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline analysis per campaign
  const [analysisMap, setAnalysisMap] = useState<Record<string, string>>({});
  const [analysisLoading, setAnalysisLoading] = useState<Record<string, boolean>>({});
  const [analysisError, setAnalysisError] = useState<Record<string, string>>({});

  // ------- Fetch ROI data -------
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/metrics/roi");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setCampaigns(data);
      } catch (err) {
        console.error("Error loading ROI data:", err);
        setError(err instanceof Error ? err.message : "Failed to load ROI data.");
      }
      setLoading(false);
    }
    load();
  }, []);

  // ------- Summary stats -------
  const totalCampaigns = campaigns.length;
  const totalViews = campaigns.reduce((s, c) => s + c.total_views, 0);
  const totalEngagement = campaigns.reduce((s, c) => s + c.total_engagement, 0);
  const avgEngagementRate =
    campaigns.length > 0
      ? Math.round(
          (campaigns.reduce((s, c) => s + c.avg_engagement_rate, 0) / campaigns.length) * 100
        ) / 100
      : 0;

  // ------- Run Campaign Analysis -------
  async function handleRunAnalysis(campaignId: string) {
    setAnalysisLoading((prev) => ({ ...prev, [campaignId]: true }));
    setAnalysisError((prev) => {
      const next = { ...prev };
      delete next[campaignId];
      return next;
    });

    try {
      const res = await fetch("/api/agents/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          analysis_type: "performance_review",
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAnalysisMap((prev) => ({
          ...prev,
          [campaignId]: JSON.stringify(json.analysis, null, 2),
        }));
      } else {
        setAnalysisError((prev) => ({
          ...prev,
          [campaignId]: json.error || "Agent returned an error.",
        }));
      }
    } catch {
      setAnalysisError((prev) => ({
        ...prev,
        [campaignId]: "Network error running analytics agent.",
      }));
    }

    setAnalysisLoading((prev) => ({ ...prev, [campaignId]: false }));
  }

  // ======================================================================
  // Render
  // ======================================================================

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10">
      {/* Back link */}
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>

      {/* Header */}
      <h1 className="text-2xl font-bold mb-6">ROI Dashboard</h1>

      {/* Loading / Error */}
      {loading && (
        <div className="text-gray-400 py-12 text-center">Loading ROI data...</div>
      )}
      {error && (
        <div className="p-4 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-300 mb-6">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ============================================================ */}
          {/* Summary Cards                                                 */}
          {/* ============================================================ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard label="Total Campaigns" value={totalCampaigns.toString()} />
            <SummaryCard label="Total Views" value={num(totalViews)} />
            <SummaryCard label="Total Engagement" value={num(totalEngagement)} />
            <SummaryCard label="Avg Engagement Rate" value={`${avgEngagementRate}%`} />
          </div>

          {/* ============================================================ */}
          {/* Campaign Cards                                                */}
          {/* ============================================================ */}
          {campaigns.length === 0 ? (
            <div className="text-gray-500 py-12 text-center">No campaign data yet.</div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const cpeColor = costColor(c.cost_per_engagement);
                const borderColor = costBorder(c.cost_per_engagement);
                const isAnalysisLoading = analysisLoading[c.campaign_id];
                const analysis = analysisMap[c.campaign_id];
                const aError = analysisError[c.campaign_id];

                return (
                  <div key={c.campaign_id} className={`bg-gray-800 rounded-xl border ${borderColor} overflow-hidden`}>
                    <div className="p-4">
                      {/* Top row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h3 className="font-semibold text-base">{c.campaign_name || "Untitled Campaign"}</h3>
                        <button
                          onClick={() => handleRunAnalysis(c.campaign_id)}
                          disabled={isAnalysisLoading}
                          className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-medium transition disabled:opacity-50"
                        >
                          {isAnalysisLoading ? "Analyzing..." : "Run Campaign Analysis"}
                        </button>
                      </div>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-xs text-gray-400 block">Budget</span>
                          <span className="font-medium">{dollar(c.budget)}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 block">Total Views</span>
                          <span className="font-medium">{num(c.total_views)}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 block">Total Engagement</span>
                          <span className="font-medium">{num(c.total_engagement)}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 block">Assets</span>
                          <span className="font-medium">{c.asset_count}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 block">Cost / View</span>
                          <span className="font-medium">{dollar(c.cost_per_view)}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 block">Cost / Engagement</span>
                          <span className={`font-medium ${cpeColor}`}>{dollar(c.cost_per_engagement)}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 block">Avg Eng. Rate</span>
                          <span className="font-medium">{c.avg_engagement_rate}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Inline analysis results */}
                    {aError && (
                      <div className="border-t border-gray-700 p-4">
                        <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-300">
                          {aError}
                        </div>
                      </div>
                    )}
                    {analysis && (
                      <div className="border-t border-gray-700 p-4">
                        <p className="text-xs text-gray-400 mb-1 font-medium">Analysis Results</p>
                        <pre className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                          {analysis}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card Component
// ---------------------------------------------------------------------------

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: "#D73F09" }}>
        {value}
      </p>
    </div>
  );
}
