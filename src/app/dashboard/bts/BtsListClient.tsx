"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";

/**
 * A single BTS submission row, shaped after the PostgREST join on
 * brands and campaign_recaps is normalized.
 */
type Submission = {
  id: string;
  athleteName: string;
  submitterName: string | null;
  holdPosting: boolean;
  videoPath: string;
  videoUrl: string;
  originalFilename: string;
  fileMimeType: string;
  fileSizeBytes: number;
  submittedAt: string;
  sheetSyncedAt: string | null;
  sheetSyncError: string | null;
  brandName: string | null;
  campaignName: string | null;
};

type HoldFilter = "all" | "held" | "not-held";

/** "Apr 21, 6:42 PM"-style timestamp for tile display. */
function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Client list view for BTS submissions.
 *
 * Fetches the 50 most recent submissions on mount, then renders a filter
 * bar (search + brand dropdown + hold filter) above a tile grid. Each
 * tile is a link to /dashboard/bts/[id].
 */
export default function BtsListClient() {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [holdFilter, setHoldFilter] = useState<HoldFilter>("all");

  // Fetch on mount. The Supabase FK-embed syntax brings brand + campaign
  // names in one round trip; we normalize nulls/array-shapes below.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("bts_submissions")
        .select(
          `
            id,
            athlete_name,
            submitter_name,
            hold_posting,
            video_path,
            video_url,
            original_filename,
            file_mime_type,
            file_size_bytes,
            submitted_at,
            sheet_synced_at,
            sheet_sync_error,
            brand:brands ( name ),
            campaign:campaign_recaps ( name )
          `
        )
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setSubmissions([]);
        return;
      }

      const rows = (data ?? []).map((r: any) => ({
        id: r.id as string,
        athleteName: (r.athlete_name as string) ?? "",
        submitterName: (r.submitter_name as string | null) ?? null,
        holdPosting: !!r.hold_posting,
        videoPath: (r.video_path as string) ?? "",
        videoUrl: (r.video_url as string) ?? "",
        originalFilename: (r.original_filename as string) ?? "",
        fileMimeType: (r.file_mime_type as string) ?? "",
        fileSizeBytes: (r.file_size_bytes as number) ?? 0,
        submittedAt: (r.submitted_at as string) ?? "",
        sheetSyncedAt: (r.sheet_synced_at as string | null) ?? null,
        sheetSyncError: (r.sheet_sync_error as string | null) ?? null,
        brandName:
          (Array.isArray(r.brand) ? r.brand[0]?.name : r.brand?.name) ?? null,
        campaignName:
          (Array.isArray(r.campaign) ? r.campaign[0]?.name : r.campaign?.name) ?? null,
      }));

      setSubmissions(rows);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Unique brand names for the dropdown, alphabetized; nulls stripped.
  const brandOptions = useMemo(() => {
    if (!submissions) return [];
    const set = new Set<string>();
    for (const s of submissions) if (s.brandName) set.add(s.brandName);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [submissions]);

  // Apply search + brand + hold filters.
  const filtered = useMemo(() => {
    if (!submissions) return [];
    const q = search.toLowerCase().trim();
    return submissions.filter((s) => {
      if (holdFilter === "held" && !s.holdPosting) return false;
      if (holdFilter === "not-held" && s.holdPosting) return false;
      if (brandFilter && s.brandName !== brandFilter) return false;
      if (q) {
        const blob = [s.athleteName, s.brandName ?? "", s.campaignName ?? ""]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, brandFilter, holdFilter]);

  const inputCls =
    "w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none text-sm";
  const selectCls = inputCls + " appearance-none cursor-pointer";

  // ── Loading / error shells ───────────────────────────────────────
  if (submissions === null) {
    return (
      <div className="text-sm text-gray-500">Loading submissions…</div>
    );
  }
  if (loadError) {
    return (
      <div className="text-sm text-red-400">
        Failed to load submissions: {loadError}
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────
  return (
    <div>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <input
          type="text"
          className={inputCls}
          placeholder="Search athlete, brand, or campaign…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={selectCls}
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="">All brands</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={holdFilter}
          onChange={(e) => setHoldFilter(e.target.value as HoldFilter)}
        >
          <option value="all">All submissions</option>
          <option value="held">Held only</option>
          <option value="not-held">Not held</option>
        </select>
      </div>

      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
        {filtered.length} {filtered.length === 1 ? "submission" : "submissions"}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-gray-800 rounded-xl p-10 text-center text-sm text-gray-500">
          No submissions match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/bts/${s.id}`}
              className="block bg-[#111] border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-base font-black text-white truncate">
                    {s.athleteName || "Unnamed athlete"}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {s.brandName ?? "(unlinked brand)"} ·{" "}
                    {s.campaignName ?? "(unlinked campaign)"}
                  </div>
                </div>
                {s.holdPosting && (
                  <span className="shrink-0 px-2 py-0.5 rounded bg-[#D73F09]/15 border border-[#D73F09]/40 text-[#D73F09] text-[10px] font-black uppercase tracking-wider">
                    HOLD
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {formatDate(s.submittedAt)}
                </span>
                {s.sheetSyncError && (
                  <span
                    className="text-xs font-bold text-yellow-400"
                    title={s.sheetSyncError}
                  >
                    ⚠ Sheet sync failed
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
