"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign, Athlete, MetricOverrides, HeroMetricOverrideKey } from "@/lib/types";
import MetricsSpreadsheet from "@/components/MetricsSpreadsheet";
import { computeStatsWithOverrides, fmt, pct } from "@/lib/recap-helpers";
import Link from "next/link";

// ─── Hero metric definitions ─────────────────────────────────────────────────
// Single list, used to render the strip AND the override editor. Keeping it in
// one place ensures the calculated value, the label, and the override key all
// stay in sync.
type HeroMetric = {
  key: HeroMetricOverrideKey;
  label: string;
  /** Read the calculated value from a stats object. */
  read: (stats: ReturnType<typeof computeStatsWithOverrides>) => number;
  /** Format the display string. */
  format: (value: number) => string;
};

const HERO_METRICS: HeroMetric[] = [
  { key: "athlete_count",       label: "Athletes",            read: (s) => s.athleteCount,       format: (v) => v.toLocaleString() },
  { key: "school_count",        label: "Colleges",            read: (s) => s.schoolCount,        format: (v) => v.toLocaleString() },
  { key: "sport_count",         label: "Sports",              read: (s) => s.sportCount,         format: (v) => v.toLocaleString() },
  { key: "total_posts",         label: "Total Posts",         read: (s) => s.totalPosts,         format: (v) => v.toLocaleString() },
  { key: "combined_followers",  label: "Combined Followers",  read: (s) => s.combinedFollowers,  format: fmt },
  { key: "total_impressions",   label: "Total Impressions",   read: (s) => s.totalImpressions,   format: fmt },
  { key: "total_engagements",   label: "Total Engagements",   read: (s) => s.totalEngagements,   format: fmt },
  { key: "avg_engagement_rate", label: "Avg Engagement Rate", read: (s) => s.avgEngRate,         format: (v) => v.toFixed(2) + "%" },
];

export default function TrackerEditor() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createBrowserSupabase();
  const [tracker, setTracker] = useState<Campaign | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMetrics, setSavingMetrics] = useState(false);

  // ─── Override editor state ─────────────────────────────────────────────────
  // `editingOverrides` controls whether the override inputs are shown.
  // `overrideDrafts` is what the user is currently typing — strings, not numbers,
  // so we can distinguish "" (empty / use calculated) from "0" (explicitly zero).
  // It only flushes to the database when the user clicks Save Overrides.
  const [editingOverrides, setEditingOverrides] = useState(false);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<HeroMetricOverrideKey, string>>(emptyDrafts());
  const [savingOverrides, setSavingOverrides] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    const [{ data: camp }, { data: aths }] = await Promise.all([
      supabase.from("campaign_recaps").select("*").eq("id", id).single(),
      supabase.from("athletes").select("*").eq("campaign_id", id).order("sort_order"),
    ]);

    setTracker(camp);
    setAthletes(aths || []);
    // Seed the draft inputs from whatever overrides the campaign already has.
    setOverrideDrafts(draftsFromOverrides(camp?.metric_overrides));
    setLoading(false);
  }

  async function handleHiddenColumnsChange(columns: string[]) {
    if (!tracker) return;
    const newSettings = { ...tracker.settings, hidden_columns: columns };
    await supabase.from("campaign_recaps").update({ settings: newSettings }).eq("id", id);
    setTracker({ ...tracker, settings: newSettings });
  }

  async function handleSaveMetrics(rows: any[], deletedIds: string[]) {
    setSavingMetrics(true);

    // Delete removed rows
    if (deletedIds.length > 0) {
      await supabase.from("athletes").delete().in("id", deletedIds);
    }

    // Build base row shape (no id)
    const baseRows = rows.map((r, i) => ({
      campaign_id: id,
      name: r.name,
      ig_handle: r.ig_handle,
      ig_followers: typeof r.ig_followers === "number" ? r.ig_followers : 0,
      school: r.school,
      sport: r.sport,
      gender: r.gender,
      content_rating: r.content_rating || null,
      reach_level: r.reach_level || null,
      notes: r.notes,
      post_type: r.post_type || "IG Feed",
      post_url: r.metrics?.ig_feed?.post_url || r.metrics?.ig_reel?.post_url || null,
      metrics: r.metrics || {},
      sort_order: i,
      _origId: r.id,
    }));

    const existingRows = baseRows.filter((r) => r._origId).map(({ _origId, ...rest }) => ({ id: _origId, ...rest }));
    const newRows = baseRows.filter((r) => !r._origId).map(({ _origId, ...rest }) => rest);

    if (existingRows.length > 0) {
      const { error: upsertErr } = await supabase.from("athletes").upsert(existingRows);
      if (upsertErr) {
        console.error("Save failed (upsert):", upsertErr);
        alert("Save failed: " + upsertErr.message);
        setSavingMetrics(false);
        return;
      }
    }
    if (newRows.length > 0) {
      const { error: insertErr } = await supabase.from("athletes").insert(newRows);
      if (insertErr) {
        console.error("Save failed (insert):", insertErr);
        alert("Save failed: " + insertErr.message);
        setSavingMetrics(false);
        return;
      }
    }

    // Reload
    const { data: aths } = await supabase
      .from("athletes")
      .select("*")
      .eq("campaign_id", id)
      .order("sort_order");
    setAthletes(aths || []);
    setSavingMetrics(false);
  }

  // ─── Save overrides to the database ──────────────────────────────────────
  async function handleSaveOverrides() {
    if (!tracker) return;
    setSavingOverrides(true);

    const cleaned = overridesFromDrafts(overrideDrafts);

    const { error } = await supabase
      .from("campaign_recaps")
      .update({ metric_overrides: cleaned })
      .eq("id", id);

    if (error) {
      console.error("Override save failed:", error);
      alert("Save failed: " + error.message);
      setSavingOverrides(false);
      return;
    }

    setTracker({ ...tracker, metric_overrides: cleaned });
    setEditingOverrides(false);
    setSavingOverrides(false);
  }

  function handleResetOverrides() {
    setOverrideDrafts(draftsFromOverrides(tracker?.metric_overrides));
  }

  function handleClearAllOverrides() {
    setOverrideDrafts(emptyDrafts());
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!tracker) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Tracker not found.
      </div>
    );
  }

  // ─── Compute Hero stats (with overrides applied) ────────────────────────
  // This is the SAME function the recap page uses, so what shows here is what
  // the client will see. No more inline math.
  const stats = computeStatsWithOverrides(athletes, tracker);
  // For comparison hints when editing: also compute the raw calculated value.
  const calcStats = computeStatsWithOverrides(athletes, null);
  const hasAnyOverride = stats.overriddenKeys.size > 0;
  const draftDirty = JSON.stringify(overridesFromDrafts(overrideDrafts)) !== JSON.stringify(tracker.metric_overrides ?? {});

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <Link
            href="/dashboard?tab=trackers"
            className="text-xs text-gray-500 hover:text-gray-300 mb-1 block"
          >
            ← Back to Trackers
          </Link>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mt-1">
            {tracker.client_name}
          </div>
          <h1 className="text-lg font-black">{tracker.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-2 py-1 rounded bg-blue-900/30 text-blue-400">
            Performance Tracker
          </span>
        </div>
      </div>

      {/* Hero Metrics Strip */}
      {athletes.length > 0 && (
        <div className="px-8 py-4 border-b border-gray-800 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Hero Metrics</h2>
              {hasAnyOverride && !editingOverrides && (
                <span
                  title={`${stats.overriddenKeys.size} value(s) hand-edited`}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-900/40 text-amber-300"
                >
                  {stats.overriddenKeys.size} edited
                </span>
              )}
            </div>
            {!editingOverrides ? (
              <button
                onClick={() => setEditingOverrides(true)}
                className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
              >
                Edit overrides
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearAllOverrides}
                  className="text-xs font-semibold text-gray-400 hover:text-red-300 px-2 py-1"
                  type="button"
                >
                  Clear all
                </button>
                <button
                  onClick={handleResetOverrides}
                  className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-1 rounded border border-gray-700"
                  type="button"
                >
                  Reset
                </button>
                <button
                  onClick={handleSaveOverrides}
                  disabled={savingOverrides || !draftDirty}
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 px-3 py-1 rounded transition-colors"
                  type="button"
                >
                  {savingOverrides ? "Saving…" : "Save overrides"}
                </button>
                <button
                  onClick={() => { setEditingOverrides(false); handleResetOverrides(); }}
                  className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-1 rounded border border-gray-700"
                  type="button"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {HERO_METRICS.map((metric) => {
              const displayValue = metric.read(stats);
              const calculatedValue = metric.read(calcStats);
              const isOverridden = stats.overriddenKeys.has(metric.key);
              const draft = overrideDrafts[metric.key];

              return (
                <div key={metric.key} className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate">
                      {metric.label}
                    </div>
                    {isOverridden && (
                      <span
                        title="Hand-edited override"
                        aria-label="overridden"
                        className="text-amber-400 text-[10px]"
                      >
                        ✎
                      </span>
                    )}
                  </div>
                  <div className={`text-2xl font-black ${isOverridden ? "text-amber-300" : ""}`}>
                    {metric.format(displayValue)}
                  </div>

                  {editingOverrides && (
                    <div className="mt-2 space-y-1">
                      <input
                        type="number"
                        step="any"
                        value={draft}
                        onChange={(e) => setOverrideDrafts({ ...overrideDrafts, [metric.key]: e.target.value })}
                        placeholder="Override…"
                        className="w-full text-xs px-2 py-1 rounded border border-gray-700 bg-gray-900 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                      <div className="text-[10px] text-gray-500">
                        Calculated: {metric.format(calculatedValue)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {editingOverrides && (
            <p className="mt-3 text-[11px] text-gray-500">
              Leave a field blank to use the calculated value. Saved overrides display on the public recap with an &quot;edited&quot; indicator.
            </p>
          )}
        </div>
      )}

      {/* Metrics Spreadsheet */}
      <div className="flex-1 p-8">
        <MetricsSpreadsheet
          athletes={athletes}
          campaignId={id}
          onSave={handleSaveMetrics}
          saving={savingMetrics}
          hiddenColumns={tracker?.settings?.hidden_columns || []}
          onHiddenColumnsChange={handleHiddenColumnsChange}
        />
      </div>
    </div>
  );
}

// ─── Helpers for the override draft state ────────────────────────────────────

function emptyDrafts(): Record<HeroMetricOverrideKey, string> {
  return {
    athlete_count: "",
    school_count: "",
    sport_count: "",
    total_posts: "",
    combined_followers: "",
    total_impressions: "",
    total_engagements: "",
    avg_engagement_rate: "",
  };
}

function draftsFromOverrides(overrides?: MetricOverrides | null): Record<HeroMetricOverrideKey, string> {
  const drafts = emptyDrafts();
  if (!overrides) return drafts;
  for (const key of Object.keys(drafts) as HeroMetricOverrideKey[]) {
    const v = overrides[key];
    if (v != null && typeof v === "number" && !isNaN(v)) {
      drafts[key] = String(v);
    }
  }
  return drafts;
}

/**
 * Convert the user-typed draft strings back into a MetricOverrides object
 * suitable for saving to Supabase. Empty strings and unparseable values are
 * dropped (meaning "no override — use calculated").
 */
function overridesFromDrafts(drafts: Record<HeroMetricOverrideKey, string>): MetricOverrides {
  const out: MetricOverrides = {};
  for (const key of Object.keys(drafts) as HeroMetricOverrideKey[]) {
    const raw = drafts[key].trim();
    if (raw === "") continue; // empty → no override
    const n = Number(raw);
    if (isNaN(n)) continue;   // junk → no override
    out[key] = n;
  }
  return out;
}
