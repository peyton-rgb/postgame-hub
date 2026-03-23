"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign, Athlete } from "@/lib/types";
import MetricsSpreadsheet from "@/components/MetricsSpreadsheet";
import Link from "next/link";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export default function TrackerEditor() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createBrowserSupabase();
  const [tracker, setTracker] = useState<Campaign | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMetrics, setSavingMetrics] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const [{ data: camp }, { data: aths }] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", id).single(),
      supabase.from("athletes").select("*").eq("campaign_id", id).order("sort_order"),
    ]);

    setTracker(camp);
    setAthletes(aths || []);
    setLoading(false);
  }

  async function handleSaveMetrics(rows: any[], deletedIds: string[]) {
    setSavingMetrics(true);

    // Delete removed rows
    if (deletedIds.length > 0) {
      await supabase.from("athletes").delete().in("id", deletedIds);
    }

    // Upsert rows
    const upsertRows = rows.map((r, i) => ({
      id: r.id || undefined,
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
    }));

    // Separate new rows (no id) from existing
    const existingRows = upsertRows.filter((r) => r.id);
    const newRows = upsertRows.filter((r) => !r.id).map(({ id: _, ...rest }) => rest);

    if (existingRows.length > 0) {
      await supabase.from("athletes").upsert(existingRows);
    }
    if (newRows.length > 0) {
      await supabase.from("athletes").insert(newRows);
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

  // Summary stats
  const totalAthletes = athletes.length;
  const totalFollowers = athletes.reduce((s, a) => s + (a.ig_followers || 0), 0);
  const totalImpressions = athletes.reduce((s, a) => {
    const m = a.metrics || {};
    return s + (m.ig_feed?.impressions || 0) + (m.ig_reel?.views || 0) + (m.tiktok?.views || 0);
  }, 0);
  const totalEngagements = athletes.reduce((s, a) => {
    const m = a.metrics || {};
    return s + (m.ig_feed?.total_engagements || 0) + (m.ig_reel?.total_engagements || 0) + (m.tiktok?.total_engagements || 0);
  }, 0);

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

      {/* Summary Stats */}
      {totalAthletes > 0 && (
        <div className="px-8 py-4 border-b border-gray-800 bg-white/[0.02]">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Athletes</div>
              <div className="text-2xl font-black">{totalAthletes}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Combined Followers</div>
              <div className="text-2xl font-black">{fmt(totalFollowers)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Total Impressions</div>
              <div className="text-2xl font-black">{fmt(totalImpressions)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Total Engagements</div>
              <div className="text-2xl font-black">{fmt(totalEngagements)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Spreadsheet */}
      <div className="flex-1 p-8">
        <MetricsSpreadsheet
          athletes={athletes}
          campaignId={id}
          onSave={handleSaveMetrics}
          saving={savingMetrics}
        />
      </div>
    </div>
  );
}
