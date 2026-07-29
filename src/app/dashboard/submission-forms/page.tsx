// ============================================================
// Submission Forms — /dashboard/submission-forms
//
// The day-one list: one row per submission link, joined to its
// campaign_recap, with submission aggregates. Ships useful before the
// detail/review pages exist (those read tier3_submissions, empty until a
// real campaign runs).
//
// Roster note: we show a PLAIN submitted count ("42 submitted"), never a
// fraction — the roster lives in a Google Sheet nothing syncs in. The row
// renderer supports "42 / 54" for the day a roster count appears; the API
// returns rosterSize: null until then.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardContent from "@/components/DashboardContent";

interface Campaign {
  id: string;
  name: string;
  brandName: string | null;
  brandLogoUrl: string | null;
  adminId: string | null;
  driveFolderId: string | null;
}
interface Form {
  token: string;
  active: boolean;
  revokedAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string | null;
  minPhotos: number;
  minVideos: number;
  maxFiles: number;
  campaign: Campaign | null;
  submittedCount: number;
  fileCount: number;
  lastUpload: string | null;
  rosterSize: number | null;
}
interface Metrics {
  activeForms: number;
  submissionsThisMonth: number;
  athletesOutstanding: number | null;
  expiringSoon: number;
}

type Status = "revoked" | "notsent" | "expiring" | "live";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function statusOf(f: Form): Status {
  if (!f.active || f.revokedAt) return "revoked";
  if (!f.sentAt && f.submittedCount === 0) return "notsent";
  if (f.expiresAt) {
    const t = new Date(f.expiresAt).getTime();
    if (t >= Date.now() && t - Date.now() <= WEEK) return "expiring";
  }
  return "live";
}

const STATUS_PILL: Record<Status, { label: string; cls: string }> = {
  live: { label: "LIVE", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  expiring: { label: "EXPIRING", cls: "bg-[#D73F09]/15 text-[#D73F09] border-[#D73F09]/30" },
  notsent: { label: "NOT SENT", cls: "bg-white/10 text-white/55 border-white/20" },
  revoked: { label: "REVOKED", cls: "bg-white/5 text-white/35 border-white/10" },
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SubmissionFormsPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/submission-forms");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setForms(body.forms);
      setMetrics(body.metrics);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const submitUrl = (token: string) => `${origin}/submit/${token}`;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(submitUrl(token));
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const doAction = async (token: string, action: "revoke" | "regenerate") => {
    setMenuOpen(null);
    if (action === "revoke" && !confirm("Revoke this form? Its link will stop working.")) return;
    const res = await fetch(`/api/submission-forms/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) load();
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forms.filter((f) => {
      if (filter !== "all" && statusOf(f) !== filter) return false;
      if (!q) return true;
      const hay = `${f.campaign?.name ?? ""} ${f.campaign?.brandName ?? ""} ${f.token}`.toLowerCase();
      return hay.includes(q);
    });
  }, [forms, search, filter]);

  return (
    <DashboardContent>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Submission Forms</h1>
          <p className="text-sm text-white/45 mt-1">
            Tokenized links athletes use to upload content for a campaign.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 rounded-lg bg-[#D73F09] text-white text-sm font-semibold hover:bg-[#ef4a13] transition-colors"
        >
          New submission form
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Active forms" value={metrics?.activeForms} />
        <MetricCard label="Submissions this month" value={metrics?.submissionsThisMonth} />
        <MetricCard label="Athletes outstanding" value={metrics?.athletesOutstanding} hint="Needs a roster" />
        <MetricCard label="Expiring in 7 days" value={metrics?.expiringSoon} orange />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaign, brand, or token…"
          className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#D73F09]/50"
        />
        <div className="flex gap-1.5">
          {(["all", "live", "expiring", "notsent"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                filter === k ? "bg-white/12 text-white" : "text-white/45 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              {k === "all" ? "All" : STATUS_PILL[k as Status].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-white/40 text-sm py-16 text-center">Loading…</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-16 text-center">{error}</div>
      ) : shown.length === 0 ? (
        <div className="border border-white/10 rounded-xl py-16 text-center">
          <div className="text-white/60 text-sm">
            {forms.length === 0 ? "No submission forms yet." : "No forms match this filter."}
          </div>
          {forms.length === 0 && (
            <button onClick={() => setShowNew(true)} className="mt-3 text-sm text-[#D73F09] hover:underline">
              Create your first one
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((f) => {
            const st = statusOf(f);
            const pill = STATUS_PILL[st];
            return (
              <div
                key={f.token}
                className="flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.05] transition-colors"
              >
                {/* Logo */}
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {f.campaign?.brandLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.campaign.brandLogoUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-white/25 text-xs">—</span>
                  )}
                </div>

                {/* Campaign + url */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {f.campaign?.name ?? "Unknown campaign"}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${pill.cls}`}>
                      {pill.label}
                    </span>
                  </div>
                  <div className="text-xs text-white/40 truncate font-mono mt-0.5">
                    {(f.campaign?.brandName ?? "—").toUpperCase()} · /submit/{f.token}
                  </div>
                </div>

                {/* Submitted (plain count — no fraction until a roster exists) */}
                <div className="hidden sm:block text-center w-24 flex-shrink-0">
                  <div className="text-sm font-semibold text-white">
                    {f.rosterSize != null ? `${f.submittedCount} / ${f.rosterSize}` : `${f.submittedCount}`}
                  </div>
                  <div className="text-[10px] text-white/35 uppercase tracking-wide">submitted</div>
                </div>

                {/* Files */}
                <div className="hidden md:block text-center w-16 flex-shrink-0">
                  <div className="text-sm text-white/70">{f.fileCount}</div>
                  <div className="text-[10px] text-white/35 uppercase tracking-wide">files</div>
                </div>

                {/* Last upload */}
                <div className="hidden lg:block text-center w-20 flex-shrink-0">
                  <div className="text-xs text-white/60">{fmtDate(f.lastUpload)}</div>
                  <div className="text-[10px] text-white/35 uppercase tracking-wide">last</div>
                </div>

                {/* Expiry */}
                <div className="hidden lg:block text-center w-20 flex-shrink-0">
                  <div className="text-xs text-white/60">{fmtDate(f.expiresAt)}</div>
                  <div className="text-[10px] text-white/35 uppercase tracking-wide">expires</div>
                </div>

                {/* Copy */}
                <button
                  onClick={() => copy(f.token)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 flex-shrink-0"
                  title="Copy submit link"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {copied === f.token ? "Copied" : "Copy"}
                </button>

                {/* ••• menu */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setMenuOpen((m) => (m === f.token ? null : f.token))}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/50 flex items-center justify-center"
                  >
                    •••
                  </button>
                  {menuOpen === f.token && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-9 z-20 w-44 bg-[#141414] border border-white/10 rounded-lg shadow-xl py-1">
                        <Link
                          href={`/dashboard/submission-forms/${f.token}`}
                          className="block px-3 py-2 text-sm text-white/70 hover:bg-white/5"
                        >
                          View submissions
                        </Link>
                        <button
                          onClick={() => doAction(f.token, "regenerate")}
                          className="block w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/5"
                        >
                          Regenerate link
                        </button>
                        <button
                          onClick={() => doAction(f.token, "revoke")}
                          className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/5"
                        >
                          Revoke
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewFormModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </DashboardContent>
  );
}

function MetricCard({
  label,
  value,
  orange,
  hint,
}: {
  label: string;
  value: number | null | undefined;
  orange?: boolean;
  hint?: string;
}) {
  return (
    <div className={`rounded-xl px-4 py-4 border ${orange ? "border-[#D73F09]/40 bg-[#D73F09]/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value == null ? "—" : value}</div>
      {value == null && hint && <div className="text-[10px] text-white/30 mt-0.5">{hint}</div>}
    </div>
  );
}

// ── New form modal: campaign picker over campaign_recaps ──

interface PickCampaign {
  id: string;
  name: string;
  brandName: string | null;
  brandLogoUrl: string | null;
  hasFolder: boolean;
  hasActiveLink: boolean;
  status: string | null;
}

function NewFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [campaigns, setCampaigns] = useState<PickCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PickCampaign | null>(null);
  const [minPhotos, setMinPhotos] = useState(3);
  const [minVideos, setMinVideos] = useState(1);
  const [maxFiles, setMaxFiles] = useState(25);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/submission-forms/campaigns");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setCampaigns(body.campaigns);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? campaigns.filter((c) => `${c.name} ${c.brandName ?? ""}`.toLowerCase().includes(s))
      : campaigns;
    return list.slice(0, 60);
  }, [campaigns, q]);

  const create = async () => {
    if (!selected) return;
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/submission-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selected.id, minPhotos, minVideos, maxFiles }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      onCreated();
    } catch (e: any) {
      setErr(e.message);
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] bg-[#0f0f0f] border border-white/10 rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">New submission form</h2>
          <p className="text-xs text-white/45 mt-0.5">Pick a campaign to collect athlete content for.</p>
        </div>

        {!selected ? (
          <>
            <div className="px-5 pt-4">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search campaigns…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#D73F09]/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {loading ? (
                <div className="text-white/40 text-sm py-8 text-center">Loading campaigns…</div>
              ) : err ? (
                <div className="text-red-400 text-sm py-8 text-center">{err}</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {shown.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {c.brandLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.brandLogoUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-white/25 text-[10px]">—</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{c.name}</div>
                        <div className="text-[11px] text-white/40 truncate">{c.brandName ?? "—"}</div>
                      </div>
                      {!c.hasFolder && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#D73F09]/40 text-[#D73F09] flex-shrink-0">
                          NO FOLDER
                        </span>
                      )}
                      {c.hasActiveLink && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/15 text-white/45 flex-shrink-0">
                          HAS FORM
                        </span>
                      )}
                    </button>
                  ))}
                  {shown.length === 0 && <div className="text-white/40 text-sm py-8 text-center">No matches.</div>}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-4">
            <button onClick={() => setSelected(null)} className="text-xs text-white/45 hover:text-white/70 text-left">
              ← Back to campaigns
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center overflow-hidden">
                {selected.brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.brandLogoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-white/25 text-xs">—</span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{selected.name}</div>
                <div className="text-xs text-white/45">{selected.brandName ?? "—"}</div>
              </div>
            </div>

            {!selected.hasFolder && (
              <div className="text-xs text-[#D73F09] bg-[#D73F09]/10 border border-[#D73F09]/25 rounded-lg px-3 py-2 leading-relaxed">
                This campaign has no Drive Content folder yet. Uploads won&apos;t work until provisioning
                creates it — the folder is not created from here.
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <NumField label="Min photos" value={minPhotos} onChange={setMinPhotos} />
              <NumField label="Min videos" value={minVideos} onChange={setMinVideos} />
              <NumField label="Max files" value={maxFiles} onChange={setMaxFiles} />
            </div>

            {err && <div className="text-red-400 text-xs">{err}</div>}

            <button
              onClick={create}
              disabled={creating}
              className="w-full py-3 rounded-lg bg-[#D73F09] text-white text-sm font-semibold hover:bg-[#ef4a13] disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create form"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10)))}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D73F09]/50"
      />
    </div>
  );
}
