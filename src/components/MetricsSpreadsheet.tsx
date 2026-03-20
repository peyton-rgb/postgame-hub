"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Athlete, AthleteMetrics } from "@/lib/types";
import { autoFillMetrics } from "@/lib/metrics-helpers";
import { parseMetricsCSV, mergeAthleteData, type ParsedAthlete } from "@/lib/csv-parser";

// ─── Types ───────────────────────────────────────────────

interface EditableRow {
  _key: string;
  _isNew: boolean;
  id?: string;
  name: string;
  ig_handle: string;
  ig_followers: number | "";
  school: string;
  sport: string;
  gender: string;
  notes: string;
  post_type: string;
  metrics: AthleteMetrics;
}

type PlatformTab = "identity" | "ig_feed" | "ig_story" | "ig_reel" | "tiktok" | "clicks" | "sales";

interface Props {
  athletes: Athlete[];
  campaignId: string;
  onSave: (rows: EditableRow[], deletedIds: string[]) => Promise<void>;
  saving: boolean;
}

// ─── Column Definitions ──────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  type: "text" | "number" | "url";
  computed?: boolean;
  width?: string;
  getValue: (row: EditableRow) => string | number | "";
  setValue: (row: EditableRow, val: string) => EditableRow;
}

function metricVal(m: AthleteMetrics | undefined, platform: string, field: string): string | number | "" {
  const p = m?.[platform as keyof AthleteMetrics] as Record<string, unknown> | undefined;
  if (!p) return "";
  const v = p[field];
  if (v == null) return "";
  return v as string | number;
}

function setMetricVal(row: EditableRow, platform: string, field: string, val: string): EditableRow {
  const metrics = JSON.parse(JSON.stringify(row.metrics || {}));
  if (!metrics[platform]) metrics[platform] = {};
  if (field === "post_url") {
    metrics[platform][field] = val || undefined;
  } else {
    const n = val === "" ? undefined : parseFloat(val);
    metrics[platform][field] = n != null && !isNaN(n) ? n : undefined;
  }
  return { ...row, metrics: autoFillMetrics(metrics) };
}

const IDENTITY_COLS: ColDef[] = [
  { key: "name", label: "Name", type: "text", width: "180px",
    getValue: (r) => r.name, setValue: (r, v) => ({ ...r, name: v }) },
  { key: "ig_handle", label: "IG Handle", type: "text", width: "140px",
    getValue: (r) => r.ig_handle, setValue: (r, v) => ({ ...r, ig_handle: v }) },
  { key: "ig_followers", label: "Followers", type: "number", width: "100px",
    getValue: (r) => r.ig_followers, setValue: (r, v) => ({ ...r, ig_followers: v === "" ? "" : parseInt(v) || 0 }) },
  { key: "school", label: "School", type: "text", width: "150px",
    getValue: (r) => r.school, setValue: (r, v) => ({ ...r, school: v }) },
  { key: "sport", label: "Sport", type: "text", width: "120px",
    getValue: (r) => r.sport, setValue: (r, v) => ({ ...r, sport: v }) },
  { key: "gender", label: "Gender", type: "text", width: "80px",
    getValue: (r) => r.gender, setValue: (r, v) => ({ ...r, gender: v }) },
  { key: "notes", label: "Notes", type: "text", width: "200px",
    getValue: (r) => r.notes, setValue: (r, v) => ({ ...r, notes: v }) },
];

const IG_FEED_COLS: ColDef[] = [
  { key: "ig_feed_post_url", label: "Post URL", type: "url", width: "180px",
    getValue: (r) => metricVal(r.metrics, "ig_feed", "post_url"),
    setValue: (r, v) => setMetricVal(r, "ig_feed", "post_url", v) },
  { key: "ig_feed_reach", label: "Reach", type: "number", width: "90px",
    getValue: (r) => metricVal(r.metrics, "ig_feed", "reach"),
    setValue: (r, v) => setMetricVal(r, "ig_feed", "reach", v) },
  { key: "ig_feed_impressions", label: "Impressions", type: "number", width: "100px",
    getValue: (r) => metricVal(r.metrics, "ig_feed", "impressions"),
    setValue: (r, v) => setMetricVal(r, "ig_feed", "impressions", v) },
  { key: "ig_feed_likes", label: "Likes", type: "number", width: "80px",
    getValue: (r) => metricVal(r.metrics, "ig_feed", "likes"),
    setValue: (r, v) => setMetricVal(r, "ig_feed", "likes", v) },
  { key: "ig_feed_comments", label: "Comments", type: "number", width: "90px",
    getValue: (r) => metricVal(r.metrics, "ig_feed", "comments"),
    setValue: (r, v) => setMetricVal(r, "ig_feed", "comments", v) },
  { key: "ig_feed_total", label: "Total Eng.", type: "number", width: "90px", computed: true,
    getValue: (r) => metricVal(r.metrics, "ig_feed", "total_engagements"),
    setValue: (r) => r },
  { key: "ig_feed_rate", label: "Eng. Rate %", type: "number", width: "100px", computed: true,
    getValue: (r) => metricVal(r.metrics, "ig_feed", "engagement_rate"),
    setValue: (r) => r },
];

const IG_STORY_COLS: ColDef[] = [
  { key: "ig_story_count", label: "Story Count", type: "number", width: "100px",
    getValue: (r) => metricVal(r.metrics, "ig_story", "count"),
    setValue: (r, v) => setMetricVal(r, "ig_story", "count", v) },
  { key: "ig_story_impressions", label: "Impressions", type: "number", width: "100px",
    getValue: (r) => metricVal(r.metrics, "ig_story", "impressions"),
    setValue: (r, v) => setMetricVal(r, "ig_story", "impressions", v) },
];

const IG_REEL_COLS: ColDef[] = [
  { key: "ig_reel_post_url", label: "Post URL", type: "url", width: "180px",
    getValue: (r) => metricVal(r.metrics, "ig_reel", "post_url"),
    setValue: (r, v) => setMetricVal(r, "ig_reel", "post_url", v) },
  { key: "ig_reel_views", label: "Views", type: "number", width: "90px",
    getValue: (r) => metricVal(r.metrics, "ig_reel", "views"),
    setValue: (r, v) => setMetricVal(r, "ig_reel", "views", v) },
  { key: "ig_reel_likes", label: "Likes", type: "number", width: "80px",
    getValue: (r) => metricVal(r.metrics, "ig_reel", "likes"),
    setValue: (r, v) => setMetricVal(r, "ig_reel", "likes", v) },
  { key: "ig_reel_comments", label: "Comments", type: "number", width: "90px",
    getValue: (r) => metricVal(r.metrics, "ig_reel", "comments"),
    setValue: (r, v) => setMetricVal(r, "ig_reel", "comments", v) },
  { key: "ig_reel_total", label: "Total Eng.", type: "number", width: "90px", computed: true,
    getValue: (r) => metricVal(r.metrics, "ig_reel", "total_engagements"),
    setValue: (r) => r },
  { key: "ig_reel_rate", label: "Eng. Rate %", type: "number", width: "100px", computed: true,
    getValue: (r) => metricVal(r.metrics, "ig_reel", "engagement_rate"),
    setValue: (r) => r },
];

const TIKTOK_COLS: ColDef[] = [
  { key: "tiktok_post_url", label: "Post URL", type: "url", width: "180px",
    getValue: (r) => metricVal(r.metrics, "tiktok", "post_url"),
    setValue: (r, v) => setMetricVal(r, "tiktok", "post_url", v) },
  { key: "tiktok_views", label: "Views", type: "number", width: "90px",
    getValue: (r) => metricVal(r.metrics, "tiktok", "views"),
    setValue: (r, v) => setMetricVal(r, "tiktok", "views", v) },
  { key: "tiktok_likes_comments", label: "Likes+Comments", type: "number", width: "120px",
    getValue: (r) => metricVal(r.metrics, "tiktok", "likes_comments"),
    setValue: (r, v) => setMetricVal(r, "tiktok", "likes_comments", v) },
  { key: "tiktok_saves_shares", label: "Saves+Shares", type: "number", width: "110px",
    getValue: (r) => metricVal(r.metrics, "tiktok", "saves_shares"),
    setValue: (r, v) => setMetricVal(r, "tiktok", "saves_shares", v) },
  { key: "tiktok_total", label: "Total Eng.", type: "number", width: "90px", computed: true,
    getValue: (r) => metricVal(r.metrics, "tiktok", "total_engagements"),
    setValue: (r) => r },
  { key: "tiktok_rate", label: "Eng. Rate %", type: "number", width: "100px", computed: true,
    getValue: (r) => metricVal(r.metrics, "tiktok", "engagement_rate"),
    setValue: (r) => r },
];

const CLICKS_COLS: ColDef[] = [
  { key: "clicks_link_clicks", label: "Link Clicks", type: "number", width: "100px",
    getValue: (r) => metricVal(r.metrics, "clicks", "link_clicks"),
    setValue: (r, v) => setMetricVal(r, "clicks", "link_clicks", v) },
  { key: "clicks_ctr", label: "CTR %", type: "number", width: "80px",
    getValue: (r) => metricVal(r.metrics, "clicks", "click_through_rate"),
    setValue: (r, v) => setMetricVal(r, "clicks", "click_through_rate", v) },
  { key: "clicks_lpv", label: "Landing Page Views", type: "number", width: "140px",
    getValue: (r) => metricVal(r.metrics, "clicks", "landing_page_views"),
    setValue: (r, v) => setMetricVal(r, "clicks", "landing_page_views", v) },
  { key: "clicks_cpc", label: "CPC ($)", type: "number", width: "90px",
    getValue: (r) => metricVal(r.metrics, "clicks", "cost_per_click"),
    setValue: (r, v) => setMetricVal(r, "clicks", "cost_per_click", v) },
];

const SALES_COLS: ColDef[] = [
  { key: "sales_conversions", label: "Conversions", type: "number", width: "100px",
    getValue: (r) => metricVal(r.metrics, "sales", "conversions"),
    setValue: (r, v) => setMetricVal(r, "sales", "conversions", v) },
  { key: "sales_revenue", label: "Revenue ($)", type: "number", width: "110px",
    getValue: (r) => metricVal(r.metrics, "sales", "revenue"),
    setValue: (r, v) => setMetricVal(r, "sales", "revenue", v) },
  { key: "sales_conv_rate", label: "Conv. Rate %", type: "number", width: "100px",
    getValue: (r) => metricVal(r.metrics, "sales", "conversion_rate"),
    setValue: (r, v) => setMetricVal(r, "sales", "conversion_rate", v) },
  { key: "sales_cpa", label: "CPA ($)", type: "number", width: "90px",
    getValue: (r) => metricVal(r.metrics, "sales", "cost_per_acquisition"),
    setValue: (r, v) => setMetricVal(r, "sales", "cost_per_acquisition", v) },
  { key: "sales_roas", label: "ROAS", type: "number", width: "80px",
    getValue: (r) => metricVal(r.metrics, "sales", "roas"),
    setValue: (r, v) => setMetricVal(r, "sales", "roas", v) },
];

const TAB_COLS: Record<PlatformTab, ColDef[]> = {
  identity: IDENTITY_COLS,
  ig_feed: IG_FEED_COLS,
  ig_story: IG_STORY_COLS,
  ig_reel: IG_REEL_COLS,
  tiktok: TIKTOK_COLS,
  clicks: CLICKS_COLS,
  sales: SALES_COLS,
};

const BASE_TABS: { key: PlatformTab; label: string; color: string }[] = [
  { key: "identity", label: "Identity", color: "#D73F09" },
  { key: "ig_feed", label: "IG Feed", color: "#E1306C" },
  { key: "ig_story", label: "IG Story", color: "#58C322" },
  { key: "ig_reel", label: "IG Reel", color: "#A855F7" },
  { key: "tiktok", label: "TikTok", color: "#00F2EA" },
];

const CLICKS_TAB = { key: "clicks" as PlatformTab, label: "Clicks", color: "#F59E0B" };
const SALES_TAB = { key: "sales" as PlatformTab, label: "Sales", color: "#10B981" };

// ─── Helpers ─────────────────────────────────────────────

function athleteToRow(a: Athlete): EditableRow {
  return {
    _key: a.id,
    _isNew: false,
    id: a.id,
    name: a.name,
    ig_handle: a.ig_handle || "",
    ig_followers: a.ig_followers || "",
    school: a.school || "",
    sport: a.sport || "",
    gender: a.gender || "",
    notes: a.notes || "",
    post_type: a.post_type || "IG Feed",
    metrics: autoFillMetrics(a.metrics || {}),
  };
}

function blankRow(): EditableRow {
  return {
    _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    _isNew: true,
    name: "",
    ig_handle: "",
    ig_followers: "",
    school: "",
    sport: "",
    gender: "",
    notes: "",
    post_type: "IG Feed",
    metrics: {},
  };
}

// ─── Component ───────────────────────────────────────────

export default function MetricsSpreadsheet({ athletes, campaignId, onSave, saving }: Props) {
  const [rows, setRows] = useState<EditableRow[]>(() => athletes.map(athleteToRow));
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<PlatformTab>("identity");
  const [isDirty, setIsDirty] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  // Sync rows when athletes prop changes (e.g. after save reloads data)
  useEffect(() => {
    setRows(athletes.map(athleteToRow));
    setDeletedIds([]);
    setIsDirty(false);
  }, [athletes]);

  const updateRow = useCallback((key: string, updater: (row: EditableRow) => EditableRow) => {
    setRows((prev) => prev.map((r) => (r._key === key ? updater(r) : r)));
    setIsDirty(true);
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, blankRow()]);
    setIsDirty(true);
    // Scroll to bottom
    setTimeout(() => tableRef.current?.scrollTo({ top: tableRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  const deleteRow = useCallback((key: string, id?: string) => {
    setRows((prev) => prev.filter((r) => r._key !== key));
    if (id) setDeletedIds((prev) => [...prev, id]);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    await onSave(rows, deletedIds);
  }, [rows, deletedIds, onSave]);

  // CSV bulk import
  const handleCsvFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseMetricsCSV(text);
      if (!parsed.length) return;

      setCsvFileName(file.name);

      setRows((prev) => {
        const existing = new Map<string, number>();
        prev.forEach((r, i) => {
          if (r.name.trim()) existing.set(r.name.toLowerCase().trim(), i);
        });

        const updated = [...prev];
        const newRows: EditableRow[] = [];

        for (const pa of parsed) {
          const key = pa.name.toLowerCase().trim();
          const existingIdx = existing.get(key);

          if (existingIdx != null) {
            const row = updated[existingIdx];
            updated[existingIdx] = {
              ...row,
              ig_handle: pa.ig_handle || row.ig_handle,
              ig_followers: pa.ig_followers || row.ig_followers,
              school: pa.school || row.school,
              sport: pa.sport || row.sport,
              gender: pa.gender || row.gender,
              notes: pa.notes || row.notes,
              metrics: autoFillMetrics(pa.metrics),
            };
          } else {
            newRows.push({
              _key: `csv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              _isNew: true,
              name: pa.name,
              ig_handle: pa.ig_handle,
              ig_followers: pa.ig_followers || "",
              school: pa.school,
              sport: pa.sport,
              gender: pa.gender,
              notes: pa.notes,
              post_type: pa.metrics.ig_reel?.post_url ? "IG Reel" : pa.metrics.tiktok?.post_url ? "TikTok" : "IG Feed",
              metrics: autoFillMetrics(pa.metrics),
            });
          }
        }

        return [...updated, ...newRows];
      });

      setIsDirty(true);
      setIsDragging(false);
    };
    reader.readAsText(file);
  }, []);

  // Global drag handlers for the entire component
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    const f = e.dataTransfer.files[0];
    if (f) handleCsvFile(f);
    else setIsDragging(false);
  }, [handleCsvFile]);

  // Determine which tabs to show based on data
  const hasClicksData = rows.some((r) => {
    const c = r.metrics?.clicks;
    return c && (c.link_clicks || c.click_through_rate || c.landing_page_views || c.cost_per_click);
  });
  const hasSalesData = rows.some((r) => {
    const s = r.metrics?.sales;
    return s && (s.conversions || s.revenue || s.conversion_rate || s.cost_per_acquisition || s.roas);
  });

  const tabs = [
    ...BASE_TABS,
    ...(hasClicksData ? [CLICKS_TAB] : []),
    ...(hasSalesData ? [SALES_TAB] : []),
  ];

  const cols = TAB_COLS[activeTab];
  const newCount = rows.filter((r) => r._isNew).length;

  // ─── Render ──────────────────────────────────────────

  return (
    <div
      className="space-y-4 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Full-screen drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm rounded-xl border-2 border-dashed border-[#D73F09] flex flex-col items-center justify-center pointer-events-none">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D73F09" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="text-lg font-black text-[#D73F09] mt-3">Drop CSV to Import</div>
          <div className="text-sm text-gray-400 mt-1">Athlete roster + metrics data</div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          <span className="font-bold text-white">{rows.length}</span> athlete{rows.length !== 1 ? "s" : ""}
          {newCount > 0 && <span className="text-[#D73F09] ml-1">({newCount} unsaved)</span>}
          {deletedIds.length > 0 && <span className="text-red-400 ml-1">({deletedIds.length} to delete)</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv";
              input.onchange = (ev) => {
                const f = (ev.target as HTMLInputElement).files?.[0];
                if (f) handleCsvFile(f);
              };
              input.click();
            }}
            className="px-3 py-1.5 border border-gray-700 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:border-gray-500"
          >
            Import CSV
          </button>
          <button onClick={addRow}
            className="px-3 py-1.5 border border-gray-700 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:border-gray-500">
            + Add Athlete
          </button>
        </div>
      </div>

      {/* CSV status */}
      {csvFileName && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          Imported: {csvFileName}
        </div>
      )}

      {/* Platform Tabs */}
      <div className="flex gap-1 border-b border-gray-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === tab.key
                ? "text-white border-current"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
            style={activeTab === tab.key ? { color: tab.color, borderColor: tab.color } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="py-16 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="text-gray-500 text-sm mb-1">No athletes yet</div>
          <div className="text-gray-600 text-xs mb-4">Drag & drop a CSV file here, or use the buttons below</div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={addRow}
              className="px-4 py-2 bg-[#D73F09] rounded-lg text-sm font-bold text-white hover:bg-[#c43808]">
              + Add Athlete
            </button>
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".csv";
                input.onchange = (ev) => {
                  const f = (ev.target as HTMLInputElement).files?.[0];
                  if (f) handleCsvFile(f);
                };
                input.click();
              }}
              className="px-4 py-2 border border-gray-700 rounded-lg text-sm font-bold text-gray-400 hover:text-white">
              Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div ref={tableRef} className="overflow-auto border border-gray-800 rounded-xl max-h-[600px]">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-[#111]">
              <tr>
                <th className="sticky left-0 z-30 bg-[#111] w-8 px-2 py-2.5 text-gray-600 font-bold text-center border-b border-r border-gray-800">#</th>
                <th className="sticky left-8 z-30 bg-[#111] w-8 px-1 py-2.5 border-b border-r border-gray-800"></th>
                {/* Always show Name as sticky */}
                {activeTab !== "identity" && (
                  <th className="sticky left-16 z-30 bg-[#111] px-2 py-2.5 text-left text-gray-500 font-bold uppercase tracking-wider border-b border-r border-gray-800" style={{ minWidth: "150px" }}>
                    Name
                  </th>
                )}
                {cols.map((col) => (
                  <th key={col.key}
                    className={`px-2 py-2.5 text-left font-bold uppercase tracking-wider border-b border-gray-800 ${col.computed ? "text-gray-600" : "text-gray-500"}`}
                    style={{ minWidth: col.width }}>
                    {col.label}
                    {col.computed && <span className="ml-1 text-[9px] text-gray-700 normal-case">(auto)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row._key} className={`border-b border-gray-800/50 hover:bg-white/[0.02] ${row._isNew ? "bg-[#D73F09]/[0.03]" : ""}`}>
                  {/* Row number */}
                  <td className="sticky left-0 z-10 bg-black w-8 px-2 py-1 text-center text-gray-600 font-mono border-r border-gray-800">
                    {idx + 1}
                  </td>
                  {/* Delete button */}
                  <td className="sticky left-8 z-10 bg-black w-8 px-1 py-1 text-center border-r border-gray-800">
                    <button onClick={() => deleteRow(row._key, row.id)}
                      className="text-gray-700 hover:text-red-500 transition-colors" title="Delete">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                  {/* Sticky name col when on metric tabs */}
                  {activeTab !== "identity" && (
                    <td className="sticky left-16 z-10 bg-black px-2 py-1 border-r border-gray-800" style={{ minWidth: "150px" }}>
                      <span className="text-white font-bold text-xs truncate block">{row.name || "—"}</span>
                    </td>
                  )}
                  {/* Data columns */}
                  {cols.map((col) => {
                    const val = col.getValue(row);
                    if (col.computed) {
                      return (
                        <td key={col.key} className="px-2 py-1">
                          <div className="bg-[#0a0a0a] rounded px-2 py-1.5 text-gray-400 font-mono text-xs min-w-[60px]">
                            {val !== "" && val != null ? (typeof val === "number" ? val.toFixed(2) : val) : "—"}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} className="px-1 py-1">
                        <input
                          type={col.type === "number" ? "number" : "text"}
                          value={val ?? ""}
                          onChange={(e) => updateRow(row._key, (r) => col.setValue(r, e.target.value))}
                          className="w-full bg-transparent border-0 border-b border-gray-800 focus:border-[#D73F09] text-white text-xs px-2 py-1.5 outline-none transition-colors placeholder-gray-700"
                          placeholder={col.label}
                          step={col.type === "number" ? "any" : undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save Footer */}
      {isDirty && (
        <div className="sticky bottom-0 bg-black/95 backdrop-blur-xl border-t border-gray-800 -mx-8 px-8 py-3 flex items-center justify-between">
          <span className="text-xs text-[#D73F09] font-bold">Unsaved changes</span>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-[#D73F09] rounded-lg text-sm font-bold text-white hover:bg-[#c43808] disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
