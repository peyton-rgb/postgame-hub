"use client";

// ============================================================
// SubmissionsTable — client table for /admin/content/submissions.
// Matches prototype screen S["submission-forms"].
// Client-safe: imports only from @/lib/admin/submissions/types
// and shared UI components.
// ============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FormListRow, WorkerStatus } from "@/lib/admin/submissions/types";
import { CampCell } from "@/components/admin/ops-bits";
import { EmptyRows, PendingMigration } from "@/components/admin/ui";
import { WorkerPill } from "./WorkerPill";
import { DesktopAppModal } from "./DesktopAppModal";

interface SubmissionsTableProps {
  initialRows: FormListRow[];
  pending083: boolean;
  pending087: boolean;
  worker: WorkerStatus;
}

export function SubmissionsTable({
  initialRows,
  pending083,
  pending087,
  worker,
}: SubmissionsTableProps) {
  const [q, setQ] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("any");
  const [toast, setToast] = useState<string | null>(null);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast(`Copied: ${text}`);
    }
  };

  // Distinct brand names for the filter dropdown
  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const r of initialRows) {
      if (r.brand?.name) set.add(r.brand.name);
    }
    return Array.from(set).sort();
  }, [initialRows]);

  // Filtered rows
  const filtered = useMemo(() => {
    return initialRows.filter((r) => {
      if (selectedBrand !== "all" && r.brand?.name !== selectedBrand) return false;
      if (selectedStatus === "active" && !r.isActive) return false;
      if (selectedStatus === "past" && r.isActive) return false;
      if (q.trim()) {
        const query = q.trim().toLowerCase();
        const camp = (r.campaignName ?? "").toLowerCase();
        const br = (r.brand?.name ?? "").toLowerCase();
        if (!camp.includes(query) && !br.includes(query)) return false;
      }
      return true;
    });
  }, [initialRows, q, selectedBrand, selectedStatus]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-[#0C0C10] px-4 py-2.5 text-xs font-medium text-white shadow-xl ring-1 ring-white/10 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header action bar matches prototype ph() extras */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WorkerPill worker={worker} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard("postgame1.com/desktop", "Download link copied · postgame1.com/desktop")}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 shadow-sm hover:border-stone-400 hover:bg-stone-50 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Desktop app download link
          </button>

          <button
            type="button"
            onClick={() => setIsDesktopModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 shadow-sm hover:border-stone-400 hover:bg-stone-50 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            See the desktop app
          </button>
        </div>
      </div>

      {pending083 && (
        <PendingMigration
          migration="20261019_083_blended_admin_schema.sql"
          feature="Content submission forms table (content_submission_forms)"
        />
      )}

      {/* Main table card */}
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar matching prototype */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2.5 bg-stone-50/50">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-500 shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search campaigns..."
              aria-label="Search campaigns"
              className="w-full bg-transparent text-stone-900 outline-none placeholder:text-stone-400 text-[13px]"
            />
          </label>

          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-stone-700 shadow-sm outline-none hover:border-stone-400"
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-stone-700 shadow-sm outline-none hover:border-stone-400"
          >
            <option value="any">Any status</option>
            <option value="active">Active</option>
            <option value="past">Past</option>
          </select>
        </div>

        {/* Table content */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <th className="py-2.5 pl-4 pr-3">Campaign</th>
                <th className="py-2.5 px-3">Athlete link (web page)</th>
                <th className="py-2.5 px-3">Videographers</th>
                <th className="py-2.5 px-3">Uploaded</th>
                <th className="py-2.5 px-3">Needs a nudge</th>
                <th className="py-2.5 px-3">LucidLink folder</th>
                <th className="py-2.5 pl-3 pr-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyRows label={q || selectedBrand !== "all" ? "No campaigns match your search" : "No submission forms found"} />
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const campHref = `/admin/content/submissions/${row.campaignId}`;
                  const fullAthleteLink = row.athleteLink ? `postgame1.com${row.athleteLink}` : null;
                  const isReady = !!(row.lucidPath || row.lucidStatus === "ready");

                  return (
                    <tr key={row.campaignId} className="hover:bg-stone-50/80 transition-colors">
                      {/* Campaign Column */}
                      <td className="py-3 pl-4 pr-3">
                        <CampCell
                          name={row.campaignName ?? "Untitled Campaign"}
                          brandName={row.brand?.name ?? null}
                          logo={row.brand?.logo_dark_url ?? row.brand?.logo_primary_url ?? null}
                          href={campHref}
                        />
                      </td>

                      {/* Athlete Link Column */}
                      <td className="py-3 px-3 text-stone-600">
                        {fullAthleteLink ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-stone-800 truncate max-w-[200px]" title={fullAthleteLink}>
                              {fullAthleteLink}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`https://${fullAthleteLink}`, "Athlete link")}
                              className="text-[12px] font-medium text-[#D73F09] hover:underline"
                            >
                              Copy
                            </button>
                          </div>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      {/* Videographers Column */}
                      <td className="py-3 px-3">
                        {row.videographers == null ? (
                          <span className="text-stone-400" title="Migration 087 not applied">—</span>
                        ) : row.videographers > 0 ? (
                          <span>
                            {row.videographers} assigned ·{" "}
                            <Link href={`${campHref}?tab=videographers`} className="text-[#D73F09] hover:underline">
                              manage
                            </Link>
                          </span>
                        ) : (
                          <Link href={`${campHref}?tab=videographers`} className="text-[#D73F09] hover:underline">
                            Assign
                          </Link>
                        )}
                      </td>

                      {/* Uploaded Column */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-stone-900 tabular-nums">{row.uploaded}</span>{" "}
                        <span className="text-stone-400 tabular-nums">of {row.total}</span>
                      </td>

                      {/* Needs a nudge Column */}
                      <td className="py-3 px-3">
                        {row.nudges > 0 ? (
                          <span className="font-medium text-amber-600 tabular-nums">{row.nudges}</span>
                        ) : (
                          <span className="text-stone-400 tabular-nums">0</span>
                        )}
                      </td>

                      {/* LucidLink folder Column */}
                      <td className="py-3 px-3">
                        {isReady ? (
                          <span className="font-medium text-emerald-600">✓ Ready</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => showToast("LucidLink folders queued")}
                            className="text-[12px] font-medium text-[#D73F09] hover:underline"
                          >
                            Create folders
                          </button>
                        )}
                      </td>

                      {/* Open Action Column */}
                      <td className="py-3 pl-3 pr-4 text-right">
                        <Link
                          href={campHref}
                          className="inline-flex items-center justify-center rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 shadow-sm"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Card Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-stone-50/50 px-4 py-2.5 text-[12px] text-stone-500">
          <span>
            {filtered.length} {filtered.length === 1 ? "campaign" : "campaigns"}
            {pending087 && " · Videographer access arrives with migration 087"}
          </span>
          <span className="text-[11px] text-stone-400">Everything lands in the LucidLink folder; Review &amp; edit picks it up</span>
        </div>
      </div>

      <DesktopAppModal
        isOpen={isDesktopModalOpen}
        onClose={() => setIsDesktopModalOpen(false)}
      />
    </div>
  );
}
