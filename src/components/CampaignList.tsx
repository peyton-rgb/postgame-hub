"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign } from "@/lib/types";
import { parseMetricsCSV } from "@/lib/csv-parser";
import { autoFillMetrics } from "@/lib/metrics-helpers";
import Link from "next/link";
import ViewToggle, { type ViewMode } from "./ViewToggle";

export default function CampaignList() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);
  const [trackers, setTrackers] = useState<Campaign[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string>("");
  const dragCounterRef = useRef(0);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadCampaigns();
    loadTrackers();
  }, []);

  async function loadTrackers() {
    const { data } = await supabase
      .from("campaign_recaps")
      .select("*, brands(logo_light_url, logo_url, primary_color)")
      .eq("type", "tracker")
      .order("created_at", { ascending: false });
    setTrackers(data || []);
  }

  async function loadCampaigns() {
    const { data } = await supabase
      .from("campaign_recaps")
      .select("*, brands(logo_light_url, logo_url, primary_color)")
      .in("type", ["recap"])
      .order("created_at", { ascending: false });
    setCampaigns(data || []);
    setLoading(false);
  }

  async function createCampaign() {
    if (!newName.trim() || !newClient.trim()) return;
    setCreating(true);

    const slug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data, error } = await supabase
      .from("campaign_recaps")
      .insert({
        name: newName,
        slug: `${slug}-${Date.now().toString(36)}`,
        client_name: newClient,
        published: false,
        settings: { primary_color: "#D73F09", layout: "masonry", columns: 4 },
      })
      .select()
      .single();

    if (error) {
      console.error("Campaign create error:", JSON.stringify(error));
      setCreating(false);
      return;
    }

    if (data) {
      // If a tracker is linked, import its athletes
      if (selectedTrackerId) {
        try {
          const { data: trackerAthletes } = await supabase
            .from("athletes")
            .select("*")
            .eq("campaign_id", selectedTrackerId)
            .order("sort_order");

          if (trackerAthletes && trackerAthletes.length > 0) {
            const athleteRows = trackerAthletes.map((a: any, i: number) => ({
              campaign_id: data.id,
              name: a.name,
              ig_handle: a.ig_handle || "",
              ig_followers: a.ig_followers || 0,
              school: a.school || "",
              sport: a.sport || "",
              gender: a.gender || "",
              notes: a.notes || "",
              post_type: a.post_type || "IG Feed",
              post_url: a.post_url || null,
              metrics: a.metrics || {},
              sort_order: i,
            }));

            await supabase.from("athletes").insert(athleteRows);
          }
        } catch (err) {
          console.error("Tracker import error:", err);
        }
      } else if (csvFile) {
        // If CSV was attached, parse and import athletes
        try {
          const text = await csvFile.text();
          const parsed = parseMetricsCSV(text);

          if (parsed.length > 0) {
            const athleteRows = parsed.map((pa, i) => ({
              campaign_id: data.id,
              name: pa.name,
              ig_handle: pa.ig_handle || "",
              ig_followers: pa.ig_followers || 0,
              school: pa.school || "",
              sport: pa.sport || "",
              gender: pa.gender || "",
              notes: pa.notes || "",
              post_type: pa.metrics.ig_reel?.post_url ? "IG Reel" : pa.metrics.tiktok?.post_url ? "TikTok" : "IG Feed",
              post_url: pa.metrics.ig_feed?.post_url || pa.metrics.ig_reel?.post_url || null,
              metrics: autoFillMetrics(pa.metrics),
              sort_order: i,
            }));

            await supabase.from("athletes").insert(athleteRows);
          }
        } catch (err) {
          console.error("CSV import error:", err);
        }
      }

      setCampaigns([data, ...campaigns]);
      setShowCreate(false);
      setNewName("");
      setNewClient("");
      setCsvFile(null);
      setSelectedTrackerId("");
      setCreating(false);

      // Navigate straight to the campaign editor
      router.push(`/dashboard/${data.id}`);
    } else {
      setCreating(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    setDeleting(campaign.id);
    await supabase.from("media").delete().eq("campaign_id", campaign.id);
    await supabase.from("athletes").delete().eq("campaign_id", campaign.id);
    const { error } = await supabase.from("campaign_recaps").delete().eq("id", campaign.id);
    if (!error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  return (
    <>
      {/* Header row with toggle + create button */}
      <div className="flex items-center justify-between mb-6">
        <ViewToggle mode={viewMode} onChange={setViewMode} />
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407]"
        >
          + New Campaign
        </button>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Campaign</h2>
            <p className="text-sm text-gray-400 mb-1">
              Are you sure you want to delete <span className="text-white font-bold">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-red-400/70 mb-6">
              This will permanently remove the campaign and all its athletes, media, and metrics. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCampaign(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[480px]">
            <h2 className="text-lg font-black mb-6">New Campaign</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Campaign Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Adidas EVO SL"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-4 focus:border-[#D73F09] outline-none"
            />
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Client Name
            </label>
            <input
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              placeholder="e.g. Adidas"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-5 focus:border-[#D73F09] outline-none"
            />

            {/* Link to Performance Tracker */}
            {trackers.length > 0 && (
              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Link Performance Tracker <span className="text-gray-700 normal-case">(optional)</span>
                </label>
                <select
                  value={selectedTrackerId}
                  onChange={(e) => {
                    setSelectedTrackerId(e.target.value);
                    if (e.target.value) setCsvFile(null); // clear CSV if tracker selected
                  }}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none appearance-none"
                >
                  <option value="">Select a tracker to import athletes...</option>
                  {trackers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.client_name}
                    </option>
                  ))}
                </select>
                {selectedTrackerId && (
                  <p className="text-[10px] text-green-500/70 mt-1.5">
                    All athletes &amp; metrics from this tracker will be imported into the recap.
                  </p>
                )}
              </div>
            )}

            {/* CSV Upload Zone — hidden when a tracker is selected */}
            {!selectedTrackerId && (
              <>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Import Roster CSV <span className="text-gray-700 normal-case">(optional)</span>
                </label>
                <div
                  onDragEnter={(e) => { e.preventDefault(); dragCounterRef.current++; setCsvDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); dragCounterRef.current--; if (dragCounterRef.current === 0) setCsvDragging(false); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    dragCounterRef.current = 0;
                    setCsvDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f && f.name.endsWith(".csv")) setCsvFile(f);
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".csv";
                    input.onchange = (ev) => {
                      const f = (ev.target as HTMLInputElement).files?.[0];
                      if (f) setCsvFile(f);
                    };
                    input.click();
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all mb-6 ${
                    csvDragging
                      ? "border-[#D73F09] bg-[#D73F09]/5"
                      : csvFile
                        ? "border-green-500/40 bg-green-500/5"
                        : "border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {csvFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <div>
                        <div className="text-sm font-bold text-green-400">{csvFile.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Athletes will be imported on create</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCsvFile(null); }}
                        className="ml-2 w-6 h-6 rounded-full bg-white/10 text-gray-400 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={csvDragging ? "#D73F09" : "#555"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <div className="text-xs font-bold text-gray-400">Drop CSV here or click to browse</div>
                      <div className="text-[10px] text-gray-600 mt-1">Athlete roster + metrics spreadsheet</div>
                    </>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(false); setCsvFile(null); setCsvDragging(false); setSelectedTrackerId(""); }}
                disabled={creating}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createCampaign}
                disabled={creating || !newName.trim() || !newClient.trim()}
                className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407] disabled:opacity-50"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating...
                  </span>
                ) : selectedTrackerId ? "Create & Link Tracker" : csvFile ? "Create & Import" : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No campaigns yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-[#D73F09] font-bold text-sm hover:underline"
          >
            Create your first campaign →
          </button>
        </div>
      ) : (
        viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="relative p-6 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors group"
              >
                <Link href={`/dashboard/${c.id}`} className="absolute inset-0 z-0" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {(c as any).brands?.logo_light_url || (c as any).brands?.logo_url ? (
                      <img
                        src={((c as any).brands.logo_light_url || (c as any).brands.logo_url) as string}
                        alt={c.client_name}
                        className="h-[24px] max-w-[80px] object-contain flex-shrink-0"
                      />
                    ) : null}
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 truncate">
                      {c.client_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        c.published
                          ? "bg-green-900/30 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {c.published ? "Published" : "Draft"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDelete(c);
                      }}
                      className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete campaign"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-black mb-2">{c.name}</h3>
                <p className="text-xs text-gray-600">
                  {new Date(c.created_at).toLocaleDateString()}
                  {c.published && (
                    <span className="ml-2 text-[#D73F09]">
                      /recap/{c.slug}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="relative flex items-center gap-4 px-5 py-4 bg-[#111] border border-gray-800 rounded-lg hover:border-gray-600 transition-colors group"
              >
                <Link href={`/dashboard/${c.id}`} className="absolute inset-0 z-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold truncate">{c.name}</h3>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                        c.published
                          ? "bg-green-900/30 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {c.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {(c as any).brands?.logo_light_url || (c as any).brands?.logo_url ? (
                      <img
                        src={((c as any).brands.logo_light_url || (c as any).brands.logo_url) as string}
                        alt={c.client_name}
                        className="h-[16px] max-w-[60px] object-contain flex-shrink-0"
                      />
                    ) : null}
                    <span className="text-xs text-gray-500">{c.client_name}</span>
                    <span className="text-[10px] text-gray-700">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                    {c.published && (
                      <span className="text-[10px] text-[#D73F09]">/recap/{c.slug}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(c);
                  }}
                  className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Delete campaign"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
