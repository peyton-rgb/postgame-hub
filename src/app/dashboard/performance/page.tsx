"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetMetric {
  id: string;
  platform: string | null;
  live_url: string | null;
  athlete_name: string | null;
  campaign_id: string | null;
  posted_at: string | null;
  performance_tier: string | null;
  tier_rationale: string | null;
  tier_scored_at: string | null;
  d7_views: number | null;
  d7_likes: number | null;
  d7_comments: number | null;
  d7_shares: number | null;
  d7_saves: number | null;
  d7_reach: number | null;
  d7_impressions: number | null;
  d7_engagement_rate: number | null;
  d7_logged_at: string | null;
  d30_views: number | null;
  d30_likes: number | null;
  d30_comments: number | null;
  d30_shares: number | null;
  d30_saves: number | null;
  d30_reach: number | null;
  d30_engagement_rate: number | null;
  d30_logged_at: string | null;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = ["All", "Instagram", "TikTok", "Twitter", "YouTube", "Facebook"] as const;

const TIERS = ["All", "Top", "Strong", "Average", "Underperforming", "Unscored"] as const;

const TIER_COLORS: Record<string, string> = {
  top: "bg-green-600 text-green-100",
  strong: "bg-blue-600 text-blue-100",
  average: "bg-gray-600 text-gray-200",
  underperforming: "bg-red-600 text-red-100",
  unscored: "border border-gray-500 text-gray-400",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-600 text-pink-100",
  tiktok: "bg-gray-700 text-white",
  twitter: "bg-sky-600 text-sky-100",
  youtube: "bg-red-600 text-red-100",
  facebook: "bg-blue-700 text-blue-100",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function pct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(2)}%`;
}

function truncateUrl(url: string, max = 40): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "...";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PerformancePage() {
  const supabase = createBrowserSupabase();

  const [metrics, setMetrics] = useState<AssetMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<AssetMetric>>({});
  const [saving, setSaving] = useState(false);

  // Log Metrics modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({
    platform: "instagram",
    live_url: "",
    athlete_name: "",
    campaign_id: "",
    posted_at: "",
    d7_views: "",
    d7_likes: "",
    d7_comments: "",
    d7_shares: "",
    d7_saves: "",
    d7_reach: "",
    d7_engagement_rate: "",
  });
  const [logSaving, setLogSaving] = useState(false);

  // Analytics Agent modal
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsCampaignId, setAnalyticsCampaignId] = useState("");
  const [analysisType, setAnalysisType] = useState("performance_review");
  const [analyticsResult, setAnalyticsResult] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // ------- Fetch -------
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("asset_metrics")
      .select("*")
      .order("created_at", { ascending: false });

    if (platformFilter !== "All") {
      query = query.eq("platform", platformFilter.toLowerCase());
    }
    if (tierFilter !== "All") {
      query = query.eq("performance_tier", tierFilter.toLowerCase());
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading metrics:", error);
    }
    setMetrics((data as AssetMetric[]) || []);
    setLoading(false);
  }, [supabase, platformFilter, tierFilter]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ------- Expand / Edit -------
  function handleExpand(m: AssetMetric) {
    if (expandedId === m.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(m.id);
    setEditData({ ...m });
  }

  async function handleSaveEdit() {
    if (!expandedId) return;
    setSaving(true);

    const payload: Record<string, unknown> = {};
    const fields = [
      "d7_views", "d7_likes", "d7_comments", "d7_shares", "d7_saves",
      "d7_reach", "d7_impressions", "d7_engagement_rate",
      "d30_views", "d30_likes", "d30_comments", "d30_shares", "d30_saves",
      "d30_reach", "d30_engagement_rate", "performance_tier",
    ] as const;

    for (const f of fields) {
      if (f in editData) {
        const val = editData[f as keyof AssetMetric];
        payload[f] = val === "" || val === null ? null : Number(val);
      }
    }
    if ("performance_tier" in editData) {
      payload.performance_tier = editData.performance_tier;
    }

    const res = await fetch(`/api/metrics/${expandedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await fetchMetrics();
      setExpandedId(null);
    } else {
      const err = await res.json();
      alert("Save failed: " + (err.error || "Unknown error"));
    }
    setSaving(false);
  }

  // ------- Log Metrics -------
  async function handleLogMetrics() {
    if (!logForm.platform || !logForm.live_url) {
      alert("Platform and Live URL are required.");
      return;
    }
    setLogSaving(true);

    const payload: Record<string, unknown> = {
      platform: logForm.platform,
      live_url: logForm.live_url,
      athlete_name: logForm.athlete_name || null,
      campaign_id: logForm.campaign_id || null,
      posted_at: logForm.posted_at || null,
    };

    const d7Fields = ["d7_views", "d7_likes", "d7_comments", "d7_shares", "d7_saves", "d7_reach", "d7_engagement_rate"] as const;
    for (const f of d7Fields) {
      const val = logForm[f as keyof typeof logForm];
      if (val !== "") payload[f] = Number(val);
    }

    const res = await fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShowLogModal(false);
      setLogForm({
        platform: "instagram", live_url: "", athlete_name: "", campaign_id: "",
        posted_at: "", d7_views: "", d7_likes: "", d7_comments: "",
        d7_shares: "", d7_saves: "", d7_reach: "", d7_engagement_rate: "",
      });
      await fetchMetrics();
    } else {
      const err = await res.json();
      alert("Error logging metrics: " + (err.error || "Unknown"));
    }
    setLogSaving(false);
  }

  // ------- Analytics Agent -------
  async function handleRunAnalytics() {
    if (!analyticsCampaignId) {
      alert("Enter a Campaign ID.");
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsResult(null);
    setAnalyticsError(null);

    try {
      const res = await fetch("/api/agents/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: analyticsCampaignId,
          analysis_type: analysisType,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAnalyticsResult(JSON.stringify(json.analysis, null, 2));
      } else {
        setAnalyticsError(json.error || "Agent returned an error.");
      }
    } catch {
      setAnalyticsError("Network error running analytics agent.");
    }
    setAnalyticsLoading(false);
  }

  // ------- Metrics row component -------
  function MetricsRow({ label, views, likes, comments, shares, saves, reach, engRate }: {
    label: string; views: number | null; likes: number | null; comments: number | null;
    shares: number | null; saves: number | null; reach: number | null; engRate: number | null;
  }) {
    return (
      <div className="mt-1">
        <span className="text-xs text-gray-400 font-medium">{label}:</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300 mt-0.5">
          <span>Views {num(views)}</span>
          <span>Likes {num(likes)}</span>
          <span>Comments {num(comments)}</span>
          <span>Shares {num(shares)}</span>
          <span>Saves {num(saves)}</span>
          <span>Reach {num(reach)}</span>
          <span>Eng. {pct(engRate)}</span>
        </div>
      </div>
    );
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Performance Tracking</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAnalyticsModal(true)}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition"
          >
            Run Analytics Agent
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{ backgroundColor: "#D73F09" }}
          >
            Log Metrics
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Platform dropdown */}
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Tier tabs */}
        <div className="flex flex-wrap gap-1">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tierFilter === t
                  ? "bg-orange-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Empty */}
      {loading ? (
        <div className="text-gray-400 py-12 text-center">Loading metrics...</div>
      ) : metrics.length === 0 ? (
        <div className="text-gray-500 py-12 text-center">No metrics found for the selected filters.</div>
      ) : (
        /* Cards */
        <div className="space-y-3">
          {metrics.map((m) => {
            const expanded = expandedId === m.id;
            const tierClass = TIER_COLORS[m.performance_tier || "unscored"] || TIER_COLORS.unscored;
            const platClass = PLATFORM_COLORS[m.platform || ""] || "bg-gray-600 text-gray-200";

            return (
              <div key={m.id} className="bg-gray-800 rounded-xl overflow-hidden">
                {/* Summary row */}
                <button
                  onClick={() => handleExpand(m)}
                  className="w-full text-left p-4 hover:bg-gray-750 transition"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Platform badge */}
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${platClass}`}>
                      {m.platform || "—"}
                    </span>

                    {/* Tier badge */}
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${tierClass}`}>
                      {m.performance_tier || "unscored"}
                    </span>

                    {/* Athlete */}
                    {m.athlete_name && (
                      <span className="text-sm text-gray-300">{m.athlete_name}</span>
                    )}

                    {/* Posted date */}
                    <span className="text-xs text-gray-500 ml-auto">{formatDate(m.posted_at)}</span>
                  </div>

                  {/* Live URL */}
                  {m.live_url && (
                    <a
                      href={m.live_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-orange-400 hover:underline mt-1 block"
                    >
                      {truncateUrl(m.live_url)}
                    </a>
                  )}

                  {/* D7 row */}
                  <MetricsRow
                    label="D7"
                    views={m.d7_views}
                    likes={m.d7_likes}
                    comments={m.d7_comments}
                    shares={m.d7_shares}
                    saves={m.d7_saves}
                    reach={m.d7_reach}
                    engRate={m.d7_engagement_rate}
                  />

                  {/* D30 row (only if logged) */}
                  {m.d30_logged_at && (
                    <MetricsRow
                      label="D30"
                      views={m.d30_views}
                      likes={m.d30_likes}
                      comments={m.d30_comments}
                      shares={m.d30_shares}
                      saves={m.d30_saves}
                      reach={m.d30_reach}
                      engRate={m.d30_engagement_rate}
                    />
                  )}
                </button>

                {/* Expanded: Edit form */}
                {expanded && (
                  <div className="border-t border-gray-700 p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-300">Edit Metrics</h3>

                    {/* D7 fields */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2 font-medium">D7 Metrics</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(["d7_views", "d7_likes", "d7_comments", "d7_shares", "d7_saves", "d7_reach", "d7_impressions", "d7_engagement_rate"] as const).map((f) => (
                          <div key={f}>
                            <label className="text-xs text-gray-500 block mb-0.5">{f.replace("d7_", "").replace("_", " ")}</label>
                            <input
                              type="number"
                              step={f === "d7_engagement_rate" ? "0.01" : "1"}
                              value={editData[f] ?? ""}
                              onChange={(e) => setEditData((prev) => ({ ...prev, [f]: e.target.value }))}
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* D30 fields */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2 font-medium">D30 Metrics</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(["d30_views", "d30_likes", "d30_comments", "d30_shares", "d30_saves", "d30_reach", "d30_engagement_rate"] as const).map((f) => (
                          <div key={f}>
                            <label className="text-xs text-gray-500 block mb-0.5">{f.replace("d30_", "").replace("_", " ")}</label>
                            <input
                              type="number"
                              step={f === "d30_engagement_rate" ? "0.01" : "1"}
                              value={editData[f] ?? ""}
                              onChange={(e) => setEditData((prev) => ({ ...prev, [f]: e.target.value }))}
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tier override */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Performance Tier Override</label>
                      <select
                        value={editData.performance_tier || "unscored"}
                        onChange={(e) => setEditData((prev) => ({ ...prev, performance_tier: e.target.value }))}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        {["top", "strong", "average", "underperforming", "unscored"].map((t) => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tier rationale */}
                    {m.tier_rationale && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Tier Rationale</p>
                        <p className="text-xs text-gray-300 bg-gray-900 rounded p-2">{m.tier_rationale}</p>
                      </div>
                    )}

                    {/* Save / Cancel */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                        style={{ backgroundColor: "#D73F09" }}
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* Log Metrics Modal                                             */}
      {/* ============================================================ */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">Log Metrics</h2>

            <div className="space-y-3">
              {/* Platform */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Platform *</label>
                <select
                  value={logForm.platform}
                  onChange={(e) => setLogForm((p) => ({ ...p, platform: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  {["instagram", "tiktok", "twitter", "youtube", "facebook"].map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Live URL */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Live URL *</label>
                <input
                  type="url"
                  value={logForm.live_url}
                  onChange={(e) => setLogForm((p) => ({ ...p, live_url: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>

              {/* Athlete Name */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Athlete Name</label>
                <input
                  type="text"
                  value={logForm.athlete_name}
                  onChange={(e) => setLogForm((p) => ({ ...p, athlete_name: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Campaign ID */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Campaign ID</label>
                <input
                  type="text"
                  value={logForm.campaign_id}
                  onChange={(e) => setLogForm((p) => ({ ...p, campaign_id: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  placeholder="UUID"
                />
              </div>

              {/* Posted At */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Posted At</label>
                <input
                  type="date"
                  value={logForm.posted_at}
                  onChange={(e) => setLogForm((p) => ({ ...p, posted_at: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>

              {/* D7 fields */}
              <p className="text-xs text-gray-400 font-medium pt-2">D7 Metrics (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                {(["d7_views", "d7_likes", "d7_comments", "d7_shares", "d7_saves", "d7_reach", "d7_engagement_rate"] as const).map((f) => (
                  <div key={f}>
                    <label className="text-xs text-gray-500 block mb-0.5">{f.replace("d7_", "").replace("_", " ")}</label>
                    <input
                      type="number"
                      step={f === "d7_engagement_rate" ? "0.01" : "1"}
                      value={logForm[f as keyof typeof logForm]}
                      onChange={(e) => setLogForm((p) => ({ ...p, [f]: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleLogMetrics}
                disabled={logSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                style={{ backgroundColor: "#D73F09" }}
              >
                {logSaving ? "Saving..." : "Log Metrics"}
              </button>
              <button
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Analytics Agent Modal                                         */}
      {/* ============================================================ */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">Run Analytics Agent</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Campaign ID *</label>
                <input
                  type="text"
                  value={analyticsCampaignId}
                  onChange={(e) => setAnalyticsCampaignId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  placeholder="UUID"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Analysis Type</label>
                <select
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="performance_review">Performance Review</option>
                  <option value="campaign_recap">Campaign Recap</option>
                  <option value="comparison">Comparison</option>
                </select>
              </div>
            </div>

            {/* Run button */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleRunAnalytics}
                disabled={analyticsLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                style={{ backgroundColor: "#D73F09" }}
              >
                {analyticsLoading ? "Running..." : "Run Agent"}
              </button>
              <button
                onClick={() => {
                  setShowAnalyticsModal(false);
                  setAnalyticsResult(null);
                  setAnalyticsError(null);
                }}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition"
              >
                Close
              </button>
            </div>

            {/* Results */}
            {analyticsError && (
              <div className="mt-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-300">
                {analyticsError}
              </div>
            )}
            {analyticsResult && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-1 font-medium">Results</p>
                <pre className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {analyticsResult}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
