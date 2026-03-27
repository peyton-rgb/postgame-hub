"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign } from "@/lib/types";
import { parseMetricsCSV } from "@/lib/csv-parser";
import { autoFillMetrics } from "@/lib/metrics-helpers";
import Link from "next/link";
import ViewToggle, { type ViewMode } from "./ViewToggle";

export default function TrackerList() {
  const router = useRouter();
  const [trackers, setTrackers] = useState<Campaign[]>([]);
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
  const dragCounterRef = useRef(0);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadTrackers();
  }, []);

  async function loadTrackers() {
    const { data } = await supabase
      .from("campaign_recaps")
      .select("*, brands(logo_light_url, logo_url, primary_color)")
      .order("created_at", { ascending: false });
    setTrackers(data || []);
    setLoading(false);
  }

  async function createTracker() {
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
        type: "tracker",
        settings: { primary_color: "#D73F09" },
      })
      .select()
      .single();

    if (error) {
      console.error("Tracker create error:", JSON.stringify(error));
      setCreating(false);
      return;
    }

    if (data) {
      // If CSV was attached, parse and import athletes
      if (csvFile) {
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

      setTrackers([data, ...trackers]);
      setShowCreate(false);
      setNewName("");
      setNewClient("");
      setCsvFile(null);
      setCreating(false);

      router.push(`/dashboard/trackers/${data.id}`);
    } else {
      setCreating(false);
    }
  }

  async function deleteTracker(tracker: Campaign) {
    setDeleting(tracker.id);
    await supabase.from("athletes").delete().eq("campaign_id", tracker.id);
    const { error } = await supabase.from("campaign_recaps").delete().eq("id", tracker.id);
    if (!error) {
      setTrackers((prev) => prev.filter((t) => t.id !== tracker.id));
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
          + New Tracker
        </button>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Tracker</h2>
            <p className="text-sm text-gray-400 mb-1">
              Are you sure you want to delete{" "}
              <span className="text-white font-bold">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-red-400/70 mb-6">
              This will permanently remove the tracker and all its athlete data. This cannot be undone.
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
                onClick={() => deleteTracker(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete Tracker"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[480px]">
            <h2 className="text-lg font-black mb-6">New Performance Tracker</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Tracker Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Raising Cane's Tunnel Walk"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-4 focus:border-[#D73F09] outline-none"
            />
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Client Name
            </label>
            <input
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              placeholder="e.g. Raising Cane's"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-5 focus:border-[#D73F09] outline-none"
            />

            {/* CSV Upload Zone */}
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

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(false); setCsvFile(null); setCsvDragging(false); }}
                disabled={creating}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createTracker}
                disabled={creating || !newName.trim() || !newClient.trim()}
                className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407] disabled:opacity-50"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating...
                  </span>
                ) : csvFile ? "Create & Import" : "Create Tracker"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracker list */}
      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading...</div>
      ) : trackers.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No performance trackers yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-[#D73F09] font-bold text-sm hover:underline"
          >
            Create your first tracker →
          </button>
        </div>
      ) : (
        viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackers.map((t) => (
              <div
                key={t.id}
                className="relative p-6 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors group"
              >
                <Link href={`/dashboard/trackers/${t.id}`} className="absolute inset-0 z-0" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {(t as any).brands?.logo_light_url || (t as any).brands?.logo_url ? (
                      <img
                        src={((t as any).brands.logo_light_url || (t as any).brands.logo_url) as string}
                        alt={t.client_name}
                        className="h-[24px] max-w-[80px] object-contain flex-shrink-0"
                      />
                    ) : null}
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 truncate">
                      {t.client_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      t.type === "tracker"
                        ? "bg-blue-900/30 text-blue-400"
                        : "bg-purple-900/30 text-purple-400"
                    }`}>
                      {t.type === "tracker" ? "Tracker" : "Recap"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDelete(t);
                      }}
                      className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete tracker"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-black mb-2">{t.name}</h3>
                <p className="text-xs text-gray-600">
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {trackers.map((t) => (
              <div
                key={t.id}
                className="relative flex items-center gap-4 px-5 py-4 bg-[#111] border border-gray-800 rounded-lg hover:border-gray-600 transition-colors group"
              >
                <Link href={`/dashboard/trackers/${t.id}`} className="absolute inset-0 z-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold truncate">{t.name}</h3>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                      t.type === "tracker"
                        ? "bg-blue-900/30 text-blue-400"
                        : "bg-purple-900/30 text-purple-400"
                    }`}>
                      {t.type === "tracker" ? "Tracker" : "Recap"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {(t as any).brands?.logo_light_url || (t as any).brands?.logo_url ? (
                      <img
                        src={((t as any).brands.logo_light_url || (t as any).brands.logo_url) as string}
                        alt={t.client_name}
                        className="h-[16px] max-w-[60px] object-contain flex-shrink-0"
                      />
                    ) : null}
                    <span className="text-xs text-gray-500">{t.client_name}</span>
                    <span className="text-[10px] text-gray-700">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(t);
                  }}
                  className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Delete tracker"
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
