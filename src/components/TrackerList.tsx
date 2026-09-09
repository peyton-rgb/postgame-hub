"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign } from "@/lib/types";
import { parseMetricsCSV } from "@/lib/csv-parser";
import { autoFillMetrics } from "@/lib/metrics-helpers";
import { BrandInlineLogo } from "@/components/BrandInlineLogo";
import { useHubTheme } from "@/lib/use-hub-theme";
import Link from "next/link";

export default function TrackerList() {
  const router = useRouter();
  // Which logo file to render is a JS decision, not a CSS one — you cannot
  // choose between two image URLs without downloading both. See pickBrandLogo().
  const theme = useHubTheme();
  const [trackers, setTrackers] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandFilterId, setBrandFilterId] = useState<string>("");
  const [brands, setBrands] = useState<any[]>([]);
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
    loadBrands();
  }, []);

  async function loadTrackers() {
    const { data } = await supabase
      .from("campaign_recaps")
      .select(
        "*, brands(logo_light_url, logo_dark_url, logo_primary_url, logo_url, primary_color)"
      )
      .order("created_at", { ascending: false });
    setTrackers(data || []);
    setLoading(false);
  }

  async function loadBrands() {
    const { data } = await supabase
      .from("brands")
      .select("id, name, logo_light_url, logo_dark_url, logo_primary_url, logo_url, primary_color")
      .eq("archived", false)
      .order("name");
    setBrands(data || []);
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
        settings: { primary_color: "var(--accent)" },
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
          const { athletes: parsed } = parseMetricsCSV(text);

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
      {/* Header row with brand filter + create button */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-4 shrink-0">
            Filter by brand
          </label>
          <select
            value={brandFilterId}
            onChange={(e) => setBrandFilterId(e.target.value)}
            className="px-3 py-2 bg-surface-card border border-hairline rounded-lg text-sm text-ink-1 font-bold focus:border-[var(--accent)] focus:outline-none min-w-[220px]"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {brandFilterId && (
            <button
              onClick={() => setBrandFilterId("")}
              className="text-[11px] font-bold text-ink-4 hover:text-ink-1 uppercase tracking-wider"
            >
              Clear
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[var(--accent)] text-ink-1 text-sm font-bold rounded-lg hover:bg-[var(--accent)] shrink-0"
        >
          + New Tracker
        </button>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 backdrop-blur-sm">
          <div className="bg-surface-card border border-hairline rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Tracker</h2>
            <p className="text-sm text-ink-3 mb-1">
              Are you sure you want to delete{" "}
              <span className="text-ink-1 font-bold">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-accent/70 mb-6">
              This will permanently remove the tracker and all its athlete data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 border border-hairline rounded-lg text-ink-3 font-bold text-sm hover:border-ink-4 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTracker(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-accent rounded-lg text-ink-1 font-bold text-sm hover:bg-accent disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete Tracker"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 backdrop-blur-sm">
          <div className="bg-surface-card border border-hairline rounded-2xl p-8 w-[480px]">
            <h2 className="text-lg font-black mb-6">New Performance Tracker</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Tracker Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Raising Cane's Tunnel Walk"
              className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 mb-4 focus:border-[var(--accent)] outline-none"
            />
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Client Name
            </label>
            <input
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              placeholder="e.g. Raising Cane's"
              className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 mb-5 focus:border-[var(--accent)] outline-none"
            />

            {/* CSV Upload Zone */}
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Import Roster CSV <span className="text-ink-4 normal-case">(optional)</span>
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
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : csvFile
                    ? "border-hairline/40 bg-surface-raised/5"
                    : "border-hairline hover:border-ink-4"
              }`}
            >
              {csvFile ? (
                <div className="flex items-center justify-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <div>
                    <div className="text-sm font-bold text-ink-3">{csvFile.name}</div>
                    <div className="text-[10px] text-ink-4 mt-0.5">Athletes will be imported on create</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCsvFile(null); }}
                    className="ml-2 w-6 h-6 rounded-full bg-surface-raised text-ink-3 hover:text-accent hover:bg-accent/10 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={csvDragging ? "var(--accent)" : "var(--ink-4)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div className="text-xs font-bold text-ink-3">Drop CSV here or click to browse</div>
                  <div className="text-[10px] text-ink-4 mt-1">Athlete roster + metrics spreadsheet</div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(false); setCsvFile(null); setCsvDragging(false); }}
                disabled={creating}
                className="flex-1 px-4 py-3 border border-hairline rounded-lg text-ink-3 font-bold text-sm hover:border-ink-4 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createTracker}
                disabled={creating || !newName.trim() || !newClient.trim()}
                className="flex-1 px-4 py-3 bg-[var(--accent)] rounded-lg text-ink-1 font-bold text-sm hover:bg-[var(--accent)] disabled:opacity-50"
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

      {/* Tracker list — filtered by brand, list-only view */}
      {(() => {
        const filteredTrackers = brandFilterId
          ? trackers.filter((t: any) => t.brand_id === brandFilterId)
          : trackers;

        if (loading) {
          return <div className="text-ink-4 text-center py-20">Loading...</div>;
        }
        if (trackers.length === 0) {
          return (
            <div className="text-center py-20">
              <p className="text-ink-4 mb-4">No performance trackers yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-[var(--accent)] font-bold text-sm hover:underline"
              >
                Create your first tracker →
              </button>
            </div>
          );
        }
        if (filteredTrackers.length === 0) {
          const brandName = brands.find((b: any) => b.id === brandFilterId)?.name || "this brand";
          return (
            <div className="text-center py-20">
              <p className="text-ink-4 mb-4">No trackers for {brandName}.</p>
              <button
                onClick={() => setBrandFilterId("")}
                className="text-[var(--accent)] font-bold text-sm hover:underline"
              >
                Clear filter →
              </button>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-2">
            {filteredTrackers.map((t) => (
              <div
                key={t.id}
                className="relative flex items-center gap-4 px-5 py-4 bg-surface-card border border-hairline rounded-lg hover:border-ink-4 transition-colors group"
              >
                <Link href={`/dashboard/trackers/${t.id}`} className="absolute inset-0 z-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold truncate">{t.name}</h3>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-surface-card/30 text-ink-2">
                      Tracker
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <BrandInlineLogo
                      brand={(t as any).brands}
                      name={t.client_name}
                      theme={theme}
                    />
                    <span className="text-xs text-ink-4">{t.client_name}</span>
                    <span className="text-[10px] text-ink-4">
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
                  className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-ink-4 hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
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
        );
      })()}
    </>
  );
}
