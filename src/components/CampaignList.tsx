"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign } from "@/lib/types";
import { parseMetricsCSV } from "@/lib/csv-parser";
import { autoFillMetrics } from "@/lib/metrics-helpers";
import Link from "next/link";

export default function CampaignList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandFilterId, setBrandFilterId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [recapType, setRecapType] = useState<"recap" | "top_50" | "event">("recap");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);
  const [trackers, setTrackers] = useState<Campaign[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string>("");
  // Google Sheet link intake — reads the tracker via /api/recap/import-sheet
  // (server-side, shared Postgame token). Check validates before create.
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetChecking, setSheetChecking] = useState(false);
  const [sheetCheck, setSheetCheck] = useState<{ ok: boolean; count?: number; athletes?: any[]; reason?: string; gid?: string } | null>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [brandCampaigns, setBrandCampaigns] = useState<any[]>([]);
  const [selectedBrandCampaignId, setSelectedBrandCampaignId] = useState("");
  const dragCounterRef = useRef(0);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadCampaigns();
    loadTrackers();
    loadBrands();
  }, []);

  // Open the create-campaign modal automatically when the page is
  // reached via the "+ New Campaign" button on the cards page
  // (which links here with ?new=1).
  useEffect(() => {
    if (searchParams.get("new") === "1") setShowCreate(true);
  }, [searchParams]);

  useEffect(() => {
    if (selectedBrandId) loadBrandCampaigns(selectedBrandId);
    else setBrandCampaigns([]);
    setSelectedBrandCampaignId("");
  }, [selectedBrandId]);

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

  async function loadBrands() {
    const { data } = await supabase
      .from("brands")
      .select("id, name, logo_light_url, logo_url, primary_color")
      .eq("archived", false)
      .order("name");
    setBrands(data || []);
  }

  async function loadBrandCampaigns(brandId: string) {
    const { data } = await supabase
      .from("brand_campaigns")
      .select("id, name, status, created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(25);
    setBrandCampaigns(data || []);
  }

  async function checkSheet() {
    const url = sheetUrl.trim();
    if (!url) return;
    setSheetChecking(true);
    setSheetCheck(null);
    try {
      const res = await fetch("/api/recap/import-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json().catch(() => ({ ok: false, reason: `HTTP ${res.status}` }));
      setSheetCheck(json);
    } catch (e: any) {
      setSheetCheck({ ok: false, reason: String(e?.message || e) });
    } finally {
      setSheetChecking(false);
    }
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
        brand_id: selectedBrandId || null,
        type: "recap",
        published: false,
        settings: { primary_color: "var(--accent)", layout: "masonry", columns: 4, campaign_type: recapType },
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
      } else if (sheetCheck?.ok && sheetCheck.athletes?.length) {
        // A checked Google Sheet link — insert the server-parsed rows.
        try {
          const athleteRows = sheetCheck.athletes.map((a: any) => ({ ...a, campaign_id: data.id }));
          await supabase.from("athletes").insert(athleteRows);
        } catch (err) {
          console.error("Sheet import error:", err);
        }
      } else if (csvFile) {
        // If CSV was attached, parse and import athletes
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

      setCampaigns([data, ...campaigns]);
      setShowCreate(false);
      setNewName("");
      setNewClient("");
      setRecapType("recap");
      setCsvFile(null);
      setSheetUrl("");
      setSheetCheck(null);
      setSelectedTrackerId("");
      setSelectedBrandId("");
      setSelectedBrandCampaignId("");
      setBrandCampaigns([]);
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
          + New Campaign
        </button>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 backdrop-blur-sm">
          <div className="bg-surface-card border border-hairline rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Campaign</h2>
            <p className="text-sm text-ink-3 mb-1">
              Are you sure you want to delete <span className="text-ink-1 font-bold">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-accent/70 mb-6">
              This will permanently remove the campaign and all its athletes, media, and metrics. This cannot be undone.
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
                onClick={() => deleteCampaign(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-accent rounded-lg text-ink-1 font-bold text-sm hover:bg-accent disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 backdrop-blur-sm">
          <div className="bg-surface-card border border-hairline rounded-2xl p-8 w-[480px]">
            <h2 className="text-lg font-black mb-6">New Campaign</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Campaign Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Adidas EVO SL"
              className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 mb-4 focus:border-[var(--accent)] outline-none"
            />

            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Recap Type
            </label>
            <select
              value={recapType}
              onChange={(e) => setRecapType(e.target.value as "recap" | "top_50" | "event")}
              className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 text-sm mb-4 focus:border-[var(--accent)] outline-none appearance-none"
            >
              <option value="recap">Campaign Recap</option>
              <option value="top_50">Top 50 List</option>
              <option value="event">Event Recap</option>
            </select>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Brand
            </label>
            <div className="relative mb-4">
              <select
                value={selectedBrandId}
                onChange={(e) => {
                  const brandId = e.target.value;
                  setSelectedBrandId(brandId);
                  const brand = brands.find((b) => b.id === brandId);
                  if (brand) setNewClient(brand.name);
                  else setNewClient("");
                }}
                className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 text-sm focus:border-[var(--accent)] outline-none appearance-none"
              >
                <option value="">Select a brand...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {selectedBrandId && (() => {
                const brand = brands.find((b) => b.id === selectedBrandId);
                const logoUrl = brand?.logo_light_url || brand?.logo_url;
                return logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="absolute right-10 top-1/2 -translate-y-1/2 h-[16px] max-w-[60px] object-contain pointer-events-none"
                  />
                ) : null;
              })()}
            </div>

            {/* Brand Campaign selector */}
            {selectedBrandId && brandCampaigns.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
                  Campaign <span className="text-ink-4 normal-case">(optional)</span>
                </label>
                <select
                  value={selectedBrandCampaignId}
                  onChange={(e) => {
                    const bcId = e.target.value;
                    setSelectedBrandCampaignId(bcId);
                    const bc = brandCampaigns.find((c) => c.id === bcId);
                    if (bc) setNewName(bc.name);
                  }}
                  className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 text-sm focus:border-[var(--accent)] outline-none appearance-none"
                >
                  <option value="">Select a campaign or enter name above...</option>
                  {brandCampaigns.map((bc) => (
                    <option key={bc.id} value={bc.id}>
                      {bc.name}{bc.status === "archived" ? " (archived)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Link to Performance Tracker */}
            {trackers.length > 0 && (
              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
                  Link Performance Tracker <span className="text-ink-4 normal-case">(optional)</span>
                </label>
                <select
                  value={selectedTrackerId}
                  onChange={(e) => {
                    setSelectedTrackerId(e.target.value);
                    if (e.target.value) { setCsvFile(null); setSheetUrl(""); setSheetCheck(null); } // clear other sources
                  }}
                  className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 text-sm focus:border-[var(--accent)] outline-none appearance-none"
                >
                  <option value="">Select a tracker to import athletes...</option>
                  {trackers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.client_name}
                    </option>
                  ))}
                </select>
                {selectedTrackerId && (
                  <p className="text-[10px] text-ink-3/70 mt-1.5">
                    All athletes &amp; metrics from this tracker will be imported into the recap.
                  </p>
                )}
              </div>
            )}

            {/* Content sources — hidden when a tracker is selected */}
            {!selectedTrackerId && (
              <>
                {/* Google Sheet link */}
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
                  Import from Google Sheet link <span className="text-ink-4 normal-case">(optional)</span>
                </label>
                <div className="flex gap-2 mb-1.5">
                  <input
                    value={sheetUrl}
                    onChange={(e) => {
                      setSheetUrl(e.target.value);
                      setSheetCheck(null);
                      if (e.target.value.trim()) setCsvFile(null); // sheet + CSV are mutually exclusive
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className="flex-1 px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 text-sm focus:border-[var(--accent)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={checkSheet}
                    disabled={!sheetUrl.trim() || sheetChecking}
                    className="px-4 py-3 border border-hairline rounded-lg text-sm font-bold text-ink-3 hover:text-ink-1 hover:border-ink-4 disabled:opacity-40 whitespace-nowrap"
                  >
                    {sheetChecking ? "Checking…" : "Check link"}
                  </button>
                </div>
                {sheetCheck ? (
                  sheetCheck.ok ? (
                    <p className="text-[10px] text-ink-3/80 mb-5">
                      ✓ {sheetCheck.count} athlete{sheetCheck.count === 1 ? "" : "s"} found{sheetCheck.gid ? ` (tab gid ${sheetCheck.gid})` : ""} — imported on create.
                    </p>
                  ) : (
                    <p className="text-[10px] text-accent/80 mb-5">
                      Couldn&apos;t read this sheet: {sheetCheck.reason || "unknown error"}. Make sure it&apos;s shared with the Postgame Google account.
                    </p>
                  )
                ) : (
                  <div className="text-[10px] text-ink-4 mb-5">Paste a tracker tab link — the gid in the URL picks the tab.</div>
                )}

                {/* CSV upload */}
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
                    if (f && f.name.endsWith(".csv")) { setCsvFile(f); setSheetUrl(""); setSheetCheck(null); }
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".csv";
                    input.onchange = (ev) => {
                      const f = (ev.target as HTMLInputElement).files?.[0];
                      if (f) { setCsvFile(f); setSheetUrl(""); setSheetCheck(null); }
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
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(false); setCsvFile(null); setSheetUrl(""); setSheetCheck(null); setCsvDragging(false); setSelectedTrackerId(""); setSelectedBrandId(""); setSelectedBrandCampaignId(""); setBrandCampaigns([]); setRecapType("recap"); }}
                disabled={creating}
                className="flex-1 px-4 py-3 border border-hairline rounded-lg text-ink-3 font-bold text-sm hover:border-ink-4 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createCampaign}
                disabled={creating || !newName.trim() || !newClient.trim()}
                className="flex-1 px-4 py-3 bg-[var(--accent)] rounded-lg text-ink-1 font-bold text-sm hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating...
                  </span>
                ) : selectedTrackerId ? "Create & Link Tracker" : sheetCheck?.ok ? "Create & Import from Sheet" : csvFile ? "Create & Import" : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter campaigns by selected brand. Sort is already applied at fetch time
          (created_at desc), so newest campaigns appear at the top. */}
      {(() => {
        const filteredCampaigns = brandFilterId
          ? campaigns.filter((c: any) => c.brand_id === brandFilterId)
          : campaigns;

        if (loading) {
          return <div className="text-ink-4 text-center py-20">Loading...</div>;
        }
        if (campaigns.length === 0) {
          return (
            <div className="text-center py-20">
              <p className="text-ink-4 mb-4">No campaigns yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-[var(--accent)] font-bold text-sm hover:underline"
              >
                Create your first campaign →
              </button>
            </div>
          );
        }
        if (filteredCampaigns.length === 0) {
          const brandName = brands.find((b: any) => b.id === brandFilterId)?.name || "this brand";
          return (
            <div className="text-center py-20">
              <p className="text-ink-4 mb-4">No campaigns for {brandName}.</p>
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
            {filteredCampaigns.map((c) => (
              <div
                key={c.id}
                className="relative flex items-center gap-4 px-5 py-4 bg-surface-card border border-hairline rounded-lg hover:border-ink-4 transition-colors group"
              >
                <Link href={`/dashboard/${c.id}`} className="absolute inset-0 z-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold truncate">{c.name}</h3>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                        c.published
                          ? "bg-surface-card/30 text-ink-3"
                          : "bg-surface-raised text-ink-4"
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
                    <span className="text-xs text-ink-4">{c.client_name}</span>
                    <span className="text-[10px] text-ink-4">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                    {c.published && (
                      <span className="text-[10px] text-[var(--accent)]">/recap/{c.slug}</span>
                    )}
                  </div>
                </div>
                {c.published && (
                  <Link
                    href={`/recap/${c.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="relative z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-ink-4 hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="View live recap"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h6v6" />
                      <path d="M10 14L21 3" />
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
                    </svg>
                    View Live
                  </Link>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(c);
                  }}
                  className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-ink-4 hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
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
        );
      })()}
    </>
  );
}
