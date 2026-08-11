// ============================================================
// Submission form detail — /dashboard/submission-forms/[id]
//
// [id] is the link token. Link bar (URL, Copy, QR, Open, Revoke),
// four stats, the campaign-link panel (editable Campaign ID + read-only
// Admin ID + paste-a-Drive-link folder field), tabs, and the athlete
// table where photo/video counts turn orange under the minimum.
//
// Reads tier3_submissions, empty until a real campaign runs — the page is
// a working shell until then, by design.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import DashboardContent from "@/components/DashboardContent";
import DeliverablesField from "@/components/submission-forms/DeliverablesField";
import ExpiryControl from "@/components/submission-forms/ExpiryControl";
import { previewLine } from "@/components/submission-forms/previewLine";

interface Athlete {
  name: string;
  handle: string | null;
  school: string | null;
  photos: number;
  videos: number;
  total: number;
  lastUpload: string | null;
  // The videographer's name when someone filed on this athlete's behalf.
  shotBy: string | null;
  belowMinimum: boolean;
  notStarted: boolean;
}
interface Detail {
  link: {
    token: string;
    active: boolean;
    revokedAt: string | null;
    sentAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    createdByName: string | null;
    minPhotos: number;
    minVideos: number;
    maxFiles: number;
    deliverables: number | null;
    briefUrl: string | null;
  };
  campaign: {
    id: string;
    name: string;
    brandName: string | null;
    brandLogoUrl: string | null;
    adminId: string | null;
    driveFolderId: string | null;
  } | null;
  stats: { submitted: number; filesReceived: number; belowMinimum: number; notStarted: number | null; rosterSize: number };
  athletes: Athlete[];
}

type Tab = "all" | "submitted" | "below" | "notstarted";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SubmissionFormDetail() {
  const params = useParams<{ id: string }>();
  const token = params?.id;

  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/submission-forms/${token}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setD(body);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const submitUrl = d ? `${origin}/submit/${d.link.token}` : "";
  const hasSubmissions = (d?.stats.submitted ?? 0) > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(submitUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const patch = async (payload: any, warnMsg?: string) => {
    if (warnMsg && !confirm(warnMsg)) return;
    const res = await fetch(`/api/submission-forms/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body.error || "That didn't work.");
      return;
    }
    // A regenerate changes the token → navigate to the new URL.
    if (payload.action === "regenerate" && body.token) {
      window.location.href = `/dashboard/submission-forms/${body.token}`;
      return;
    }
    load();
  };

  const repoint = (campaignId: string) =>
    patch(
      { action: "repoint", campaignId },
      hasSubmissions
        ? `This form has ${d!.stats.submitted} athlete(s) submitted. Existing files won't move — only new uploads will go to the new campaign. Continue?`
        : undefined
    );
  const setFolder = (driveUrl: string) =>
    patch(
      { action: "set-folder", driveUrl },
      hasSubmissions
        ? `This form has ${d!.stats.submitted} athlete(s) submitted. Existing files won't move — only new uploads will go to the new folder. Continue?`
        : undefined
    );

  const shownAthletes = useMemo(() => {
    if (!d) return [];
    if (tab === "below") return d.athletes.filter((a) => a.belowMinimum && !a.notStarted);
    if (tab === "notstarted") return d.athletes.filter((a) => a.notStarted);
    if (tab === "submitted") return d.athletes.filter((a) => !a.notStarted);
    return d.athletes;
  }, [d, tab]);

  if (loading) return <DashboardContent><div className="text-white/40 text-sm py-16 text-center">Loading…</div></DashboardContent>;
  if (error || !d) return <DashboardContent><div className="text-red-400 text-sm py-16 text-center">{error || "Not found"}</div></DashboardContent>;

  const c = d.campaign;
  const folderUrl = c?.driveFolderId ? `https://drive.google.com/drive/folders/${c.driveFolderId}` : null;

  return (
    <DashboardContent>
      {/* Header */}
      <Link href="/dashboard/submission-forms" className="text-xs text-white/45 hover:text-white/70">
        ← Submission Forms
      </Link>
      <div className="flex items-center gap-3 mt-2 mb-5">
        <div className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
          {c?.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.brandLogoUrl} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-white/25 text-xs">—</span>
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{c?.name ?? "Unknown campaign"}</h1>
          <div className="text-xs text-white/45">{(c?.brandName ?? "—").toUpperCase()}</div>
        </div>
        {!d.link.active && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 text-white/40">REVOKED</span>
        )}
      </div>

      {/* Link bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 mb-5">
        <span className="flex-1 min-w-[180px] text-sm text-white/70 font-mono truncate">{submitUrl}</span>
        <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {copied ? "Copied" : "Copy link"}
        </button>
        <div className="relative">
          <button onClick={() => setShowQR((v) => !v)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70">
            QR
          </button>
          {showQR && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowQR(false)} />
              <div className="absolute right-0 top-10 z-20 bg-white p-3 rounded-xl shadow-2xl">
                <QRCodeSVG value={submitUrl} size={168} bgColor="#ffffff" fgColor="#07070A" level="M" />
                <div className="text-[10px] text-black/50 text-center mt-1.5 font-mono">Scan to open the form</div>
              </div>
            </>
          )}
        </div>
        <a href={submitUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70">
          Open
        </a>
        {d.link.active && (
          <button
            onClick={() => patch({ action: "revoke" }, "Revoke this form? Its link will stop working.")}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-red-400"
          >
            Revoke
          </button>
        )}
      </div>

      {/* Four stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Submitted" value={d.stats.submitted} />
        <Stat label="Files received" value={d.stats.filesReceived} />
        <Stat label="Below minimum" value={d.stats.belowMinimum} orange />
        <Stat label="Not started" value={d.stats.notStarted} orange hint="Needs a roster" />
      </div>

      {/* Info row */}
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs mb-6 px-1">
        <Info label="Requirements" value={`${d.link.minPhotos} photos · ${d.link.minVideos} video · up to ${d.link.maxFiles} files`} />
        <Info
          label="Content folder"
          value={folderUrl ? <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="text-[#D73F09] hover:underline">Open folder</a> : <span className="text-white/40">Not set</span>}
        />
        <Info label="Tracker" value={<span className="text-white/40">Not linked</span>} />
        <Info label="Created by" value={<span className="text-white/60">{d.link.createdByName ?? "—"}</span>} />
      </div>

      {/* Campaign link panel */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-6">
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Campaign link</div>
        <div className="grid md:grid-cols-3 gap-4">
          <EditableId
            label="Campaign ID"
            value={c?.id ?? ""}
            onSave={repoint}
            disabled={!d.link.active}
          />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Admin ID</div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/50 font-mono truncate">
              {c?.adminId || "—"}
            </div>
            <div className="text-[10px] text-white/25 mt-1">Read-only · owned by admin</div>
          </div>
          <DriveField
            currentId={c?.driveFolderId ?? null}
            onSave={setFolder}
            disabled={!d.link.active}
          />
        </div>
      </div>

      {/* Form settings panel */}
      <SettingsPanel link={d.link} submitted={d.stats.submitted} onSaved={load} />

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3 border-b border-white/10">
        {(
          [
            ["all", "All"],
            ["submitted", "Submitted"],
            ["below", "Below minimum"],
            ["notstarted", "Not started"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === k ? "border-[#D73F09] text-white" : "border-transparent text-white/45 hover:text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Athlete table */}
      {shownAthletes.length === 0 ? (
        <div className="py-14 text-center text-sm text-white/40">
          {tab === "notstarted"
            ? d.stats.rosterSize === 0
              ? "No roster imported yet — not-started athletes appear once the tracker syncs."
              : "Everyone on the roster has submitted."
            : d.athletes.length === 0
              ? "No submissions yet."
              : "Nothing in this tab."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-white/35 text-left">
                <th className="py-2 pr-4 font-medium">Athlete</th>
                <th className="py-2 pr-4 font-medium">School</th>
                <th className="py-2 pr-4 font-medium text-center">Photos</th>
                <th className="py-2 pr-4 font-medium text-center">Videos</th>
                <th className="py-2 pr-4 font-medium text-center">Total</th>
                <th className="py-2 pr-4 font-medium">Last</th>
                <th className="py-2 pr-4 font-medium">Shot by</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shownAthletes.map((a, i) => {
                const photoLow = a.photos < d.link.minPhotos;
                const videoLow = a.videos < d.link.minVideos;
                return (
                  <tr key={`${a.handle ?? a.name}-${i}`} className="border-t border-white/[0.06]">
                    <td className="py-2.5 pr-4">
                      <div className="text-white">{a.name}</div>
                      {a.handle && <div className="text-[11px] text-white/40">@{a.handle}</div>}
                    </td>
                    <td className="py-2.5 pr-4 text-white/55">{a.school || "—"}</td>
                    <td className={`py-2.5 pr-4 text-center font-semibold ${photoLow ? "text-[#D73F09]" : "text-white/70"}`}>{a.photos}</td>
                    <td className={`py-2.5 pr-4 text-center font-semibold ${videoLow ? "text-[#D73F09]" : "text-white/70"}`}>{a.videos}</td>
                    <td className="py-2.5 pr-4 text-center text-white/70">{a.total}</td>
                    <td className="py-2.5 pr-4 text-white/50">{fmtDate(a.lastUpload)}</td>
                    <td className="py-2.5 pr-4 text-white/55">{a.shotBy || "—"}</td>
                    <td className="py-2.5 pr-4">
                      {a.notStarted ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/15 text-white/45">NOT STARTED</span>
                      ) : a.belowMinimum ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#D73F09]/30 text-[#D73F09]">BELOW MIN</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/25 text-emerald-400">COMPLETE</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {a.notStarted ? (
                        <button disabled title="Reminders aren't enabled yet" className="text-xs text-white/30 cursor-not-allowed">
                          Remind
                        </button>
                      ) : folderUrl ? (
                        <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 hover:text-white">Folder</a>
                      ) : (
                        <span className="text-xs text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardContent>
  );
}

// ── Form settings ──
//
// Everything about a form used to be frozen at creation: changing the ask
// after the link went out meant revoke-and-recreate, which mints a new URL
// and orphans the one already texted to the roster. This panel edits the six
// settings in place, keeping the token.
//
// Deliberately ONE Save rather than the per-field Save links above it: these
// fields interact, and raising the minimums while stating deliverables is one
// decision, not three.
function SettingsPanel({
  link,
  submitted,
  onSaved,
}: {
  link: Detail["link"];
  submitted: number;
  onSaved: () => void;
}) {
  const [minPhotos, setMinPhotos] = useState(link.minPhotos);
  const [minVideos, setMinVideos] = useState(link.minVideos);
  const [maxFiles, setMaxFiles] = useState(link.maxFiles);
  const [deliverables, setDeliverables] = useState<number | null>(link.deliverables);
  const [briefUrl, setBriefUrl] = useState(link.briefUrl ?? "");
  const [expiresAt, setExpiresAt] = useState<string | null>(link.expiresAt);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setMinPhotos(link.minPhotos);
    setMinVideos(link.minVideos);
    setMaxFiles(link.maxFiles);
    setDeliverables(link.deliverables);
    setBriefUrl(link.briefUrl ?? "");
    setExpiresAt(link.expiresAt);
    setErr(null);
  };

  // Re-seed from the server after a save re-fetches the detail.
  useEffect(reset, [link.minPhotos, link.minVideos, link.maxFiles, link.deliverables, link.briefUrl, link.expiresAt]);

  const readOnly = !link.active;

  const dirty =
    minPhotos !== link.minPhotos ||
    minVideos !== link.minVideos ||
    maxFiles !== link.maxFiles ||
    deliverables !== link.deliverables ||
    (briefUrl.trim() || null) !== (link.briefUrl ?? null) ||
    expiresAt !== link.expiresAt;

  // Nothing is lost by raising a minimum, but every athlete who submitted
  // between the old figure and the new one flips to BELOW MIN — including
  // people who did exactly what was asked at the time. Lowering needs no
  // warning, and neither does a form nobody has submitted to.
  const raisingMinimum = submitted > 0 && (minPhotos > link.minPhotos || minVideos > link.minVideos);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/submission-forms/${link.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-settings",
          minPhotos,
          minVideos,
          maxFiles,
          deliverables,
          briefUrl: briefUrl.trim() || null,
          expiresAt,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "That didn't work.");
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-6">
      <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Form settings</div>

      {readOnly && (
        <div className="text-xs text-white/45 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 mb-4 leading-relaxed">
          This form is revoked, so its settings are read-only.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* 2×2 at 390px — three inputs across a phone read tight. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SettingNum label="Min photos" value={minPhotos} onChange={setMinPhotos} max={50} disabled={readOnly} />
          <SettingNum label="Min videos" value={minVideos} onChange={setMinVideos} max={50} disabled={readOnly} />
          <SettingNum label="Max files" value={maxFiles} onChange={setMaxFiles} max={100} disabled={readOnly} />
        </div>

        <DeliverablesField value={deliverables} onChange={setDeliverables} disabled={readOnly} />

        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Brief link</label>
          <input
            type="url"
            value={briefUrl}
            disabled={readOnly}
            onChange={(e) => setBriefUrl(e.target.value)}
            placeholder="https://"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[#D73F09]/50 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Link expires</label>
          <ExpiryControl value={expiresAt} onChange={setExpiresAt} disabled={readOnly} />
        </div>

        <div className="rounded-lg bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-white/55 leading-relaxed">
          {previewLine({ minPhotos, minVideos, deliverables, expiresAt })}
        </div>

        {raisingMinimum && (
          <div className="text-xs text-[#D73F09] bg-[#D73F09]/10 border border-[#D73F09]/25 rounded-lg px-3 py-2 leading-relaxed">
            Raising the minimums re-flags athletes who already met the old ones. {submitted}{" "}
            {submitted === 1 ? "athlete has" : "athletes have"} submitted.
          </div>
        )}

        {err && <div className="text-red-400 text-xs">{err}</div>}

        {!readOnly && (
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-lg bg-[#D73F09] text-white text-sm font-semibold hover:bg-[#ef4a13] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={reset}
              disabled={!dirty || saving}
              className="text-xs text-white/45 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingNum({
  label,
  value,
  onChange,
  max,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">{label}</label>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.min(max, Math.max(0, parseInt(e.target.value, 10) || 0)))}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D73F09]/50 disabled:opacity-50"
      />
    </div>
  );
}

function Stat({ label, value, orange, hint }: { label: string; value: number | null; orange?: boolean; hint?: string }) {
  const isEmphasis = orange && (value ?? 0) > 0;
  return (
    <div className={`rounded-xl px-4 py-4 border ${orange ? "border-[#D73F09]/40 bg-[#D73F09]/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${isEmphasis ? "text-[#D73F09]" : "text-white"}`}>{value == null ? "—" : value}</div>
      {value == null && hint && <div className="text-[10px] text-white/30 mt-0.5">{hint}</div>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/35">{label}</div>
      <div className="text-white/70 mt-0.5">{value}</div>
    </div>
  );
}

// Editable id field (Campaign ID) — inline edit + Paste + Save.
function EditableId({ label, value, onSave, disabled }: { label: string; value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const paste = async () => {
    try {
      setDraft((await navigator.clipboard.readText()).trim());
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
      {!editing ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 font-mono truncate">{value || "—"}</div>
          {!disabled && (
            <button onClick={() => setEditing(true)} className="text-xs text-white/45 hover:text-white/80">Edit</button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 bg-white/5 border border-[#D73F09]/40 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none"
            placeholder="Paste campaign ID"
          />
          <button onClick={paste} className="text-xs text-white/50 hover:text-white/80">Paste</button>
          <button
            onClick={() => { setEditing(false); if (draft.trim() && draft.trim() !== value) onSave(draft.trim()); }}
            className="text-xs text-[#D73F09] hover:underline"
          >
            Save
          </button>
          <button onClick={() => { setEditing(false); setDraft(value); }} className="text-xs text-white/40">Cancel</button>
        </div>
      )}
    </div>
  );
}

// Drive folder paste field — Drive mark, tooltip, accepts any URL shape.
function DriveField({ currentId, onSave, disabled }: { currentId: string | null; onSave: (v: string) => void; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  const [tip, setTip] = useState(false);

  const paste = async () => {
    try {
      setDraft((await navigator.clipboard.readText()).trim());
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 relative">
        <span className="text-[10px] uppercase tracking-wider text-white/40">Drive folder</span>
        <button onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} className="text-white/30 hover:text-white/60 text-[11px]" aria-label="About the Drive folder">ⓘ</button>
        {tip && (
          <div className="absolute left-0 top-5 z-30 w-64 bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/60 leading-relaxed shadow-xl">
            Internal All → Brands (Master) → brand → campaign. Not the Content subfolder.
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 flex-shrink-0">
          <svg viewBox="0 0 1443 1250" className="w-full h-full"><path fill="#3777e3" d="M240 1250l241-417h962l-241 417z"/><path fill="#ffcf63" d="M962 833h481L962 0H481z"/><path fill="#11a861" d="M0 833l241 417L962 0H481z"/></svg>
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
          placeholder="Paste Drive link to campaign here"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 font-mono outline-none focus:border-[#D73F09]/40 disabled:opacity-50"
        />
        <button onClick={paste} className="text-xs text-white/50 hover:text-white/80">Paste</button>
        <button
          onClick={() => { if (draft.trim()) { onSave(draft.trim()); setDraft(""); } }}
          className="text-xs text-[#D73F09] hover:underline"
        >
          Save
        </button>
      </div>
      {currentId && <div className="text-[10px] text-white/30 mt-1 font-mono truncate">Current: {currentId}</div>}
    </div>
  );
}
