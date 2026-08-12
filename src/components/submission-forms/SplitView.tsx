// src/components/submission-forms/SplitView.tsx
// ============================================================
// Submission forms — the approved split layout (submission-forms-split-v9).
//
// Campaign list on the left, full detail on the right. Both routes render
// this: /dashboard/submission-forms with the first form selected, and
// /dashboard/submission-forms/[token] with that one selected. Selecting a row
// pushes the token into the URL, so the view is deep-linkable and Back works.
//
// Styling is a scoped <style> block rather than Tailwind, matching the submit
// page. The design leans on a sliding thumb, keyframed alert pulses and a
// shared five-column grid; expressing those as utility classes would be a
// translation with nothing gained. Every selector is namespaced under `.sfx`
// so nothing leaks into the rest of the dashboard.
//
// WHAT YOU WILL ACTUALLY SEE: campaign_rosters, submissions and
// tier3_submissions are all empty, so the populated view in the prototype has
// no data behind it yet. Every one of those is degraded deliberately — a
// missing roster drops the denominator rather than the row, and an empty
// athlete list renders an empty state rather than an error.
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DeliverablesField from "@/components/submission-forms/DeliverablesField";
import ExpiryControl from "@/components/submission-forms/ExpiryControl";
import NewFormModal from "@/components/submission-forms/NewFormModal";
import { previewLine } from "@/components/submission-forms/previewLine";

// ── Types ──

interface FormRow {
  token: string;
  active: boolean;
  revokedAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  submittedCount: number;
  rosterSize: number | null;
  campaign: {
    id: string;
    name: string;
    brandName: string | null;
    brandLogoUrl: string | null;
    driveFolderId: string | null;
  } | null;
}

interface Athlete {
  name: string;
  handle: string | null;
  school: string | null;
  phone: string | null;
  photos: number;
  videos: number;
  total: number;
  lastUpload: string | null;
  reviewedAt: string | null;
  shotBy: string | null;
  chasedAt: string | null;
  folderId: string | null;
  submissionId: string | null;
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
    driveFolderId: string | null;
    briefUrl: string | null;
    trackerUrl: string | null;
  } | null;
  stats: { submitted: number; filesReceived: number; belowMinimum: number; notStarted: number | null; rosterSize: number };
  athletes: Athlete[];
}

// ── Icons ──
// The Drive mark is Google's own path, taken verbatim from Simple Icons.
// Inlined rather than fetched so the dashboard has no runtime dependency on a
// CDN — but not redrawn, which is the rule that matters.
const DRIVE_PATH =
  "M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z";

function DriveMark({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Google Drive">
      <path d={DRIVE_PATH} />
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

const Ico = {
  copy: (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  eye: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  pen: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
  doc: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.7" {...stroke}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  ),
  grid: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.7" {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  ),
  bell: (
    <svg width="12" height="12" viewBox="0 0 24 24" strokeWidth="1.9" {...stroke}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  alert: (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  ),
  info: (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  tick: (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.2" {...stroke}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  ),
  chev: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...stroke}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  msg: (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 4 11.5a8.4 8.4 0 0 1 8.5-8.4h.5a8.4 8.4 0 0 1 8 8z" />
    </svg>
  ),
  tel: (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.7" {...stroke}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  ig: (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.7" fill="none" stroke="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  up: (
    <svg width="9" height="9" viewBox="0 0 24 24" strokeWidth="3" {...stroke}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  dot: (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
};

// ── Helpers ──

const initials = (name: string) =>
  name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "—";

const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

const plural = (n: number, w: string) => `${w}${n === 1 ? "" : "s"}`;

function BrandMark({ url, name, lg }: { url: string | null; name: string; lg?: boolean }) {
  return (
    <div className={`bm${lg ? " lg" : ""}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        // 45 of 130 brands have no logo, so this fallback is load-bearing.
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

// ── The view ──

export default function SplitView({ initialToken }: { initialToken?: string }) {
  const router = useRouter();

  const [forms, setForms] = useState<FormRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [tab, setTab] = useState<"subs" | "act">("subs");
  const [pane, setPane] = useState<"att" | "rdy">("att");
  const [toast, setToast] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [ping, setPing] = useState<Athlete | null>(null);
  const [busy, setBusy] = useState(false);

  // Which side of the toggle has been acknowledged, per token. Chasing writes
  // chased_at server-side; this also settles the alert immediately so the UI
  // doesn't keep pulsing at someone who has just dealt with it.
  const [acked, setAcked] = useState<Record<string, { att?: boolean; rdy?: boolean }>>({});

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const loadList = useCallback(async (): Promise<FormRow[]> => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/submission-forms");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setForms(body.forms ?? []);
      return body.forms as FormRow[];
    } catch (e: any) {
      setListError(e.message);
      return [];
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (t: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/submission-forms/${t}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setDetail(body);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const rows = await loadList();
      if (!initialToken && rows.length) setToken(rows[0].token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token) loadDetail(token);
  }, [token, loadDetail]);

  const select = (t: string) => {
    if (t === token) return;
    setToken(t);
    setTab("subs");
    setPane("att");
    // Deep-linkable, and Back returns to the previously selected campaign.
    router.push(`/dashboard/submission-forms/${t}`, { scroll: false });
  };

  // The rail lists active forms; a revoked one still renders on the right if
  // you arrived by link, so a deep link never lands on nothing.
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const live = forms.filter((f) => f.active && !f.revokedAt);
    if (!s) return live;
    return live.filter((f) =>
      `${f.campaign?.name ?? ""} ${f.campaign?.brandName ?? ""} ${f.token}`.toLowerCase().includes(s)
    );
  }, [forms, q]);

  const grouped = useMemo(() => {
    const by = new Map<string, FormRow[]>();
    for (const f of shown) {
      const b = f.campaign?.brandName ?? "—";
      by.set(b, [...(by.get(b) ?? []), f]);
    }
    return Array.from(by.entries());
  }, [shown]);

  const patch = async (payload: any, ok: string) => {
    if (!token) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/submission-forms/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "That didn't work.");
      say(ok);
      await Promise.all([loadDetail(token), loadList()]);
      return true;
    } catch (e: any) {
      say(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      say(msg);
    } catch {
      say("Clipboard is blocked in this browser.");
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const submitUrl = token ? `${origin}/submit/${token}` : "";

  const d = detail;
  const link = d?.link;
  const camp = d?.campaign;
  const rosterSize = d?.stats.rosterSize ?? 0;

  const attention = useMemo(
    () => (d?.athletes ?? []).filter((a) => a.belowMinimum),
    [d]
  );
  const ready = useMemo(
    () => (d?.athletes ?? []).filter((a) => !a.belowMinimum && !a.notStarted),
    [d]
  );

  // An alert only fires for work nobody has settled: unchased athletes on the
  // attention side, unreviewed ones on the ready side.
  const attUnhandled = attention.some((a) => !a.chasedAt);
  const rdyUnhandled = ready.some((a) => !a.reviewedAt);
  const ack = token ? acked[token] ?? {} : {};
  const attWake = attention.length > 0 && attUnhandled && !ack.att;
  const rdyWake = ready.length > 0 && rdyUnhandled && !ack.rdy;

  const exportCsv = () => {
    if (!d || !camp) return;
    const head = ["Athlete", "Handle", "School", "Photos", "Videos", "Total", "Shot by", "Last upload", "Status"];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [head.join(",")].concat(
      d.athletes.map((a) =>
        [
          a.name,
          a.handle ? `@${a.handle}` : "",
          a.school ?? "",
          String(a.photos),
          String(a.videos),
          String(a.total),
          a.shotBy ?? "",
          a.lastUpload ? fmtDay(a.lastUpload) : "",
          a.notStarted ? "Not started" : a.belowMinimum ? "Needs attention" : "Ready for review",
        ]
          .map(esc)
          .join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${camp.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
    say("CSV exported");
  };

  const createFolder = async () => {
    if (!camp) return;
    setBusy(true);
    try {
      const res = await fetch("/api/drive/campaign-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: camp.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't create the folder.");
      say("Folder created");
      if (token) await loadDetail(token);
      await loadList();
    } catch (e: any) {
      say(e.message);
    } finally {
      setBusy(false);
    }
  };

  const markChased = async () => {
    const ids = attention.map((a) => a.submissionId).filter(Boolean) as string[];
    if (token) setAcked((p) => ({ ...p, [token]: { ...(p[token] ?? {}), att: true } }));
    if (ids.length) await patch({ action: "chase", submissionIds: ids }, "Marked as chased");
    else say("Marked as chased");
  };

  return (
    <div className="sfx">
      <Styles />

      <div className="hd">
        <h1 className="d">Submission forms</h1>
        <button className="new" onClick={() => setShowNew(true)}>
          New submission form
        </button>
      </div>

      <div className="split">
        {/* ── Left rail ── */}
        <div className="L">
          <input
            className="srch"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search campaign, brand or token…"
          />
          <div className="Lw">
            <div className="Ll">
              {listLoading ? (
                <div className="empt">Loading…</div>
              ) : listError ? (
                <div className="empt" style={{ color: "#e06a6a" }}>{listError}</div>
              ) : !grouped.length ? (
                <div className="empt">{forms.length ? "Nothing matches." : "No submission forms yet."}</div>
              ) : (
                grouped.map(([brand, rows]) => (
                  <div key={brand}>
                    <div className="gl">
                      {brand}
                      <span className="qt">{rows.length}</span>
                    </div>
                    {rows.map((f) => (
                      <button
                        key={f.token}
                        className={`it${f.token === token ? " on" : ""}`}
                        onClick={() => select(f.token)}
                      >
                        <BrandMark url={f.campaign?.brandLogoUrl ?? null} name={f.campaign?.brandName ?? "—"} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="n">{f.campaign?.name ?? "Unknown campaign"}</span>
                          <span className="s">
                            {!f.sentAt
                              ? "not sent"
                              : f.rosterSize
                                ? `${f.submittedCount}/${f.rosterSize} athletes`
                                : `${f.submittedCount} in`}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right pane ── */}
        <div className="R">
          {!token ? (
            <div className="empt">Select a campaign.</div>
          ) : detailLoading && !d ? (
            <div className="empt">Loading…</div>
          ) : !d || !link ? (
            <div className="empt">Couldn&rsquo;t load this form.</div>
          ) : (
            <>
              <div className="cc">
                <div className="cc-top">
                  <div className="cc-plate">
                    {camp?.brandLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={camp.brandLogoUrl} alt="" />
                    ) : (
                      <span className="fb">{initials(camp?.brandName ?? "—")}</span>
                    )}
                  </div>
                  <div className="cc-id">
                    <div className="cc-eb">{camp?.brandName ?? "—"}</div>
                    <div className="cc-nm d">{camp?.name ?? "Unknown campaign"}</div>
                    <div className={`stt${link.sentAt ? " live" : " wait"}`}>
                      <span className="dt" />
                      <span className="s1">{link.sentAt ? "Live" : "Not sent"}</span>
                      <span className="sep2" />
                      <span className="s2">
                        {link.expiresAt ? `expires ${fmtDay(link.expiresAt)}` : "no expiry set"}
                      </span>
                    </div>
                  </div>
                  <div className="cc-side">
                    {link.active ? (
                      <button
                        className="tl dz"
                        disabled={busy}
                        onClick={() => {
                          if (confirm("Deactivate this form? Its link stops working and this can't be undone here.")) {
                            patch({ action: "revoke" }, "Form deactivated");
                          }
                        }}
                      >
                        Deactivate form
                      </button>
                    ) : (
                      <span className="tag t-wait">DEACTIVATED</span>
                    )}
                    <div className="rsb">
                      <ResourceBtn href={camp?.briefUrl ?? null} icon={Ico.doc} label="Brief" />
                      <ResourceBtn href={camp?.trackerUrl ?? null} icon={Ico.grid} label="Tracker" />
                      <ResourceBtn
                        href={camp?.driveFolderId ? `https://drive.google.com/drive/folders/${camp.driveFolderId}` : null}
                        icon={<DriveMark size={14} />}
                        label="Campaign folder"
                      />
                    </div>
                  </div>
                </div>

                <div className="cc-act">
                  <button className="cpy" onClick={() => copy(submitUrl, "Link copied to clipboard")}>
                    {Ico.copy} Copy submission form link
                  </button>
                  <a className="tl" href={submitUrl} target="_blank" rel="noopener noreferrer">
                    {Ico.eye} View live form
                  </a>
                  {!link.sentAt && (
                    <button className="tl" disabled={busy} onClick={() => patch({ action: "mark-sent" }, "Marked as sent")}>
                      Mark as sent
                    </button>
                  )}
                  <div className="cc-res">
                    <button className="tl" onClick={() => setShowEdit(true)}>
                      {Ico.pen} Edit form
                    </button>
                  </div>
                </div>
              </div>

              {!camp?.driveFolderId && (
                <div className="nt warn">
                  <span className="ic">{Ico.alert}</span>
                  <div style={{ flex: 1 }}>
                    <b>No Drive folder.</b> Uploads have nowhere to land.
                  </div>
                  <button className="gh" disabled={busy} onClick={createFolder}>
                    {busy ? "Creating…" : "Create folder"}
                  </button>
                </div>
              )}
              {/* Noise on a form that has been live a week — so, only before it's sent. */}
              {!link.sentAt && (
                <div className="nt info">
                  <span className="ic">{Ico.info}</span>
                  <div style={{ flex: 1 }}>
                    <b>Test this form before you send it.</b> Open it, upload a file, and check it lands in Drive.
                  </div>
                  <a className="gh" href={submitUrl} target="_blank" rel="noopener noreferrer">
                    Open form
                  </a>
                </div>
              )}

              <div className="tabs">
                <button className={`tb${tab === "subs" ? " on" : ""}`} onClick={() => setTab("subs")}>
                  Athlete submissions
                  {d.stats.submitted > 0 && <i>{d.stats.submitted}</i>}
                </button>
                <button className={`tb${tab === "act" ? " on" : ""}`} onClick={() => setTab("act")}>
                  Activity
                </button>
              </div>

              {tab === "act" ? (
                <ActivityTab detail={d} />
              ) : (
                <>
                  <div className="seg-row">
                    <div className="seg">
                      <span className={`thumb ${pane}`} />
                      <button
                        className={`sg att${pane === "att" ? " on" : ""}${pane !== "att" && attWake ? " wake" : ""}`}
                        onClick={() => setPane("att")}
                      >
                        {pane === "att" && attWake && <span className="pd att" />}
                        Needs attention <span className="ct">{attention.length}</span>
                      </button>
                      <button
                        className={`sg rdy${pane === "rdy" ? " on" : ""}${pane !== "rdy" && rdyWake ? " wake" : ""}`}
                        onClick={() => setPane("rdy")}
                      >
                        {pane === "rdy" && rdyWake && <span className="pd rdy" />}
                        Ready for review <span className="ct">{ready.length}</span>
                      </button>
                    </div>
                    <div className="seg-stat">
                      <div style={{ textAlign: "right" }}>
                        <div className="v">
                          {d.stats.submitted}
                          {/* No roster imported → no denominator, rather than a fake one. */}
                          {rosterSize > 0 && <s>/{rosterSize}</s>}
                        </div>
                        <div className="k">submitted</div>
                      </div>
                      <button className="gh sm" onClick={exportCsv} disabled={!d.athletes.length}>
                        Export CSV
                      </button>
                    </div>
                  </div>

                  {pane === "att" ? (
                    attention.length === 0 ? (
                      <div className="empt">
                        {d.athletes.length === 0
                          ? link.sentAt
                            ? "Nothing submitted yet."
                            : "This form hasn't been sent."
                          : "Nobody needs chasing."}
                        <br />
                        {d.athletes.length > 0 && "Everyone who's submitted has met the minimum."}
                      </div>
                    ) : (
                      <>
                        <div className="sheet">
                          <div className="colh grid">
                            <span>Athlete</span>
                            <span className="r">Photos</span>
                            <span className="r">Videos</span>
                            <span className="r">Contact</span>
                            <span className="r">Folder</span>
                          </div>
                          {attention.map((a, i) => (
                            <div className="ar grid" key={a.submissionId ?? `${a.name}-${i}`}>
                              <AthleteCell a={a} />
                              <Pill n={a.photos} min={link.minPhotos} unit="photos" />
                              <Pill n={a.videos} min={link.minVideos} unit={plural(link.minVideos, "video")} />
                              <button className="ping" onClick={() => setPing(a)}>
                                {Ico.bell} Ping
                              </button>
                              <FolderCell a={a} campaignFolder={camp?.driveFolderId ?? null} />
                            </div>
                          ))}
                        </div>
                        {attWake && (
                          <div className="ack">
                            <button className="gh sm" disabled={busy} onClick={markChased}>
                              Mark as chased
                            </button>
                            <span className="ack-h">stops the alert until someone new falls behind</span>
                          </div>
                        )}
                      </>
                    )
                  ) : ready.length === 0 ? (
                    <div className="empt">
                      Nothing ready yet.
                      <br />
                      Athletes appear here once they meet the minimum.
                    </div>
                  ) : (
                    <div className="sheet">
                      <div className="colh grid">
                        <span>Athlete</span>
                        <span className="r">Photos</span>
                        <span className="r">Videos</span>
                        <span className="r">Review</span>
                        <span className="r">Folder</span>
                      </div>
                      {ready.map((a, i) => (
                        <div className="ar grid" key={a.submissionId ?? `${a.name}-${i}`}>
                          <AthleteCell a={a} showLast />
                          <Pill n={a.photos} min={link.minPhotos} unit="photos" />
                          <Pill n={a.videos} min={link.minVideos} unit={plural(link.minVideos, "video")} />
                          <button className="rev" onClick={() => say(`Review hub isn't wired up yet`)}>
                            Review
                          </button>
                          <FolderCell a={a} campaignFolder={camp?.driveFolderId ?? null} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showEdit && d && link && (
        <EditFormModal
          detail={d}
          onClose={() => setShowEdit(false)}
          onSaved={async () => {
            setShowEdit(false);
            say("Changes saved");
            if (token) await loadDetail(token);
            await loadList();
          }}
        />
      )}

      {showNew && (
        <NewFormModal
          onClose={() => setShowNew(false)}
          onCreated={async () => {
            setShowNew(false);
            say("Form created");
            const rows = await loadList();
            // Land on the form just made rather than leaving it to be hunted for.
            const fresh = rows.find((f) => !forms.some((old) => old.token === f.token));
            if (fresh) select(fresh.token);
          }}
        />
      )}

      {ping && <PingSheet athlete={ping} onClose={() => setPing(null)} />}

      {toast && (
        <div className="toast on">
          <span className="ic">{Ico.tick}</span>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Pieces ──

function ResourceBtn({ href, icon, label }: { href: string | null; icon: React.ReactNode; label: string }) {
  // Dimmed and unclickable rather than hidden, so the row of three doesn't
  // reflow between campaigns.
  if (!href) {
    return (
      <span className="rb no" aria-disabled="true">
        <span className="ic">{icon}</span>
        {label}
      </span>
    );
  }
  return (
    <a className="rb" href={href} target="_blank" rel="noopener noreferrer">
      <span className="ic">{icon}</span>
      {label}
    </a>
  );
}

function AthleteCell({ a, showLast }: { a: Athlete; showLast?: boolean }) {
  const sub = showLast
    ? [a.lastUpload ? fmtDay(a.lastUpload) : null, a.shotBy ? `shot by ${a.shotBy}` : null].filter(Boolean).join(" · ")
    : a.shotBy
      ? `shot by ${a.shotBy}`
      : "";
  return (
    <div className="ai2">
      <div className="nm">
        <span className="who">{a.name}</span>
        {a.school && <span className="sch">{a.school}</span>}
      </div>
      {sub && <div className="by">{sub}</div>}
    </div>
  );
}

/** Progress, not a complaint: "2/3 photos", never "needs 1 more photo". */
function Pill({ n, min, unit }: { n: number; min: number; unit: string }) {
  const cls = n >= min ? "ok" : n > 0 ? "lo" : "zero";
  return (
    <span className={`pill2 ${cls}`}>
      {n}/{min} {unit}
    </span>
  );
}

function FolderCell({ a, campaignFolder }: { a: Athlete; campaignFolder: string | null }) {
  // Needs both: a campaign folder to live in, and this athlete's own folder id.
  const href = campaignFolder && a.folderId ? `https://drive.google.com/drive/folders/${a.folderId}` : null;
  return (
    <span className="dvc">
      {href ? (
        <a
          className="dv"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${a.name}'s content folder`}
        >
          <DriveMark />
        </a>
      ) : (
        <span className="dv off" title="No folder recorded for this athlete">
          <DriveMark />
        </span>
      )}
    </span>
  );
}

function ActivityTab({ detail }: { detail: Detail }) {
  // Built from what is actually recorded — uploads, and the form's own
  // lifecycle stamps. No invented events.
  type Entry = { at: string; kind: "up" | "lo" | "sy"; text: React.ReactNode };
  const entries: Entry[] = [];

  for (const a of detail.athletes) {
    if (!a.lastUpload) continue;
    entries.push({
      at: a.lastUpload,
      kind: a.belowMinimum ? "lo" : "up",
      text: (
        <>
          <b>{a.shotBy ?? a.name}</b> submitted {a.total} {plural(a.total, "file")}
          {a.shotBy && (
            <>
              {" "}for <b>{a.name}</b>
            </>
          )}
          <span className={a.belowMinimum ? "m lo" : "m"}>
            {" · "}
            {a.belowMinimum ? "below the minimum" : "ready for review"}
          </span>
        </>
      ),
    });
  }
  if (detail.link.sentAt) entries.push({ at: detail.link.sentAt, kind: "sy", text: <>Form marked as sent</> });
  if (detail.link.revokedAt) entries.push({ at: detail.link.revokedAt, kind: "sy", text: <>Form deactivated</> });
  entries.push({
    at: detail.link.createdAt,
    kind: "sy",
    text: (
      <>
        Form created{detail.link.createdByName ? <> by <b>{detail.link.createdByName}</b></> : null}
      </>
    ),
  });

  entries.sort((x, y) => y.at.localeCompare(x.at));

  const days = new Map<string, Entry[]>();
  const today = new Date().toDateString();
  const yday = new Date(Date.now() - 86400000).toDateString();
  for (const e of entries) {
    const dd = new Date(e.at).toDateString();
    const label = dd === today ? "Today" : dd === yday ? "Yesterday" : fmtDay(e.at);
    days.set(label, [...(days.get(label) ?? []), e]);
  }

  if (!entries.length) {
    return (
      <div className="empt">
        Nothing has happened yet.
        <br />
        Activity appears once the link is sent.
      </div>
    );
  }

  return (
    <div className="act">
      {Array.from(days.entries()).map(([label, es]) => (
        <div key={label}>
          <div className="ad">{label}</div>
          {es.map((e, i) => (
            <div className="ae" key={i}>
              <div className={`ai ${e.kind}`}>{e.kind === "sy" ? Ico.dot : Ico.up}</div>
              <div className="at">{e.text}</div>
              <div className="am">{fmtTime(e.at)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PingSheet({ athlete, onClose }: { athlete: Athlete; onClose: () => void }) {
  const tel = athlete.phone ? athlete.phone.replace(/\D/g, "") : null;
  return (
    <div className="ov on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="psh">
        <div className="psh-h">
          <div className="n d">{athlete.name}</div>
          <div className="m">
            {athlete.handle ? `@${athlete.handle}` : "no handle"}
            {athlete.phone ? ` · ${athlete.phone}` : ""}
          </div>
        </div>
        <div className="psh-b">
          {/* Every option hands off to the device. The Hub sends nothing. */}
          <PingOption
            href={tel ? `sms:${tel}` : null}
            bg="rgba(74,222,128,.14)"
            fg="#7ee2a8"
            icon={Ico.msg}
            title="Send a text"
            detail={athlete.phone ?? "No number on file"}
            onClose={onClose}
          />
          <PingOption
            href={tel ? `tel:${tel}` : null}
            bg="rgba(56,139,253,.16)"
            fg="#79b8ff"
            icon={Ico.tel}
            title="Call"
            detail={athlete.phone ?? "No number on file"}
            onClose={onClose}
          />
          <PingOption
            href={athlete.handle ? `https://instagram.com/${athlete.handle}` : null}
            bg="rgba(214,41,118,.16)"
            fg="#f472b6"
            icon={Ico.ig}
            title="DM on Instagram"
            detail={athlete.handle ? `@${athlete.handle}` : "No handle on file"}
            onClose={onClose}
          />
        </div>
        <div className="psh-f">
          <span>Nothing is sent automatically</span>
          <button className="gh sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PingOption({
  href,
  bg,
  fg,
  icon,
  title,
  detail,
  onClose,
}: {
  href: string | null;
  bg: string;
  fg: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClose: () => void;
}) {
  const inner = (
    <>
      <span className="pi" style={{ background: bg, color: fg }}>
        {icon}
      </span>
      <span className="tx">
        <b>{title}</b>
        <span>{detail}</span>
      </span>
      <span className="ar2">{Ico.chev}</span>
    </>
  );
  if (!href) {
    return (
      <span className="po off" aria-disabled="true">
        {inner}
      </span>
    );
  }
  return (
    <a
      className="po"
      href={href}
      target={href.startsWith("https") ? "_blank" : undefined}
      rel="noopener noreferrer"
      onClick={onClose}
    >
      {inner}
    </a>
  );
}

/** Brief C's settings panel, as the modal the design asks for. */
function EditFormModal({
  detail,
  onClose,
  onSaved,
}: {
  detail: Detail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { link, campaign, stats } = detail;
  const [minPhotos, setMinPhotos] = useState(link.minPhotos);
  const [minVideos, setMinVideos] = useState(link.minVideos);
  const [maxFiles, setMaxFiles] = useState(link.maxFiles);
  const [deliverables, setDeliverables] = useState<number | null>(link.deliverables);
  const [briefUrl, setBriefUrl] = useState(link.briefUrl ?? "");
  const [expiresAt, setExpiresAt] = useState<string | null>(link.expiresAt);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty =
    minPhotos !== link.minPhotos ||
    minVideos !== link.minVideos ||
    maxFiles !== link.maxFiles ||
    deliverables !== link.deliverables ||
    (briefUrl.trim() || null) !== (link.briefUrl ?? null) ||
    expiresAt !== link.expiresAt;

  const raising = stats.submitted > 0 && (minPhotos > link.minPhotos || minVideos > link.minVideos);

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
    <div className="ov on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="md">
        <div className="md-h">
          <BrandMark url={campaign?.brandLogoUrl ?? null} name={campaign?.brandName ?? "—"} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sub">{campaign?.brandName ?? "—"}</div>
            <div className="ttl d">{campaign?.name ?? "Campaign"}</div>
          </div>
          <button className="gh" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="md-b">
          <div className="fl">What athletes must send</div>
          <div className="g3">
            <NumCell label="min photos" value={minPhotos} max={50} onChange={setMinPhotos} />
            <NumCell label="min videos" value={minVideos} max={50} onChange={setMinVideos} />
            <NumCell label="max files" value={maxFiles} max={100} onChange={setMaxFiles} />
          </div>

          <DeliverablesField value={deliverables} onChange={setDeliverables} />

          <div className="trow-b">
            <div className="fl">Brief link shown to athletes</div>
            <input
              className="fi"
              type="url"
              value={briefUrl}
              placeholder="https://"
              onChange={(e) => setBriefUrl(e.target.value)}
            />
          </div>

          <div className="trow-b">
            <div className="fl">Link expires</div>
            <ExpiryControl value={expiresAt} onChange={setExpiresAt} />
          </div>

          <div className="pv">
            <span className="pv-k">THE ATHLETE SEES</span>
            <br />
            {previewLine({ minPhotos, minVideos, deliverables, expiresAt })}
          </div>

          {raising && (
            <div className="md-warn">
              Raising the minimums moves athletes who already met the old ones back into Needs attention.{" "}
              {stats.submitted} {stats.submitted === 1 ? "athlete has" : "athletes have"} submitted.
            </div>
          )}
          {err && <div className="md-err">{err}</div>}
        </div>
        <div className="md-f">
          <button className="gh" onClick={onClose}>
            Cancel
          </button>
          <button className="new sm" disabled={!dirty || saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumCell({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <input
        className="fi"
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(0, parseInt(e.target.value, 10) || 0)))}
      />
      <div className="numk">{label}</div>
    </div>
  );
}

// ── Styles ──
// Ported from the approved design. Everything is namespaced under `.sfx`.

function Styles() {
  return (
    <style>{`
.sfx{--or:#D73F09;--s1:rgba(250,248,245,.035);--s2:rgba(250,248,245,.06);
 --ln:rgba(250,248,245,.08);--ln2:rgba(250,248,245,.045);
 --t1:rgba(250,248,245,.96);--t2:rgba(250,248,245,.62);
 --t3:rgba(250,248,245,.38);--t4:rgba(250,248,245,.24);--gr:#4ade80;
 --mono:var(--font-mono),ui-monospace,monospace;--bd:Arial,Helvetica,sans-serif;
 --anton:var(--font-anton),Arial,sans-serif;
 color:var(--t2);font:14px/1.55 var(--bd)}
.sfx *{box-sizing:border-box}
/* Deliberately NOT a blanket border/background reset: DeliverablesField,
   ExpiryControl and NewFormModal are Tailwind-styled and render inside this
   scope, and a bare \`.sfx button{border:none;background:none}\` outranks their
   utility classes — which silently strips the toggle track and the expiry
   chips. Only the buttons defined below get the reset. */
.sfx button{font-family:var(--bd);cursor:pointer;color:inherit}
.sfx button:disabled{cursor:not-allowed;opacity:.5}
.sfx .it,.sfx .tl,.sfx .tb,.sfx .sg,.sfx .po{border:none;background:none}
.sfx svg{display:block}
.sfx a{color:inherit;text-decoration:none}

.sfx .hd{display:flex;justify-content:space-between;align-items:center;padding:0 0 22px;gap:20px;flex-wrap:wrap}
.sfx h1{font-size:34px;color:var(--t1);line-height:1;margin:0}
.sfx .new{background:var(--or);color:#fff;border-radius:7px;padding:10px 16px;font-size:13.5px;font-weight:bold}
.sfx .new:hover:not(:disabled){background:#ef4a13}
.sfx .new.sm{padding:8px 16px;font-size:13px}
.sfx .gh{border:1px solid var(--ln);border-radius:7px;padding:7px 12px;font-size:12.5px;color:var(--t2);display:inline-block}
.sfx .gh:hover:not(:disabled){border-color:rgba(250,248,245,.26);color:var(--t1)}
.sfx .gh.sm{padding:5px 10px;font-size:11.5px}
.sfx .tag{font-family:var(--mono);font-size:9px;letter-spacing:.09em;padding:3px 7px;border-radius:4px;white-space:nowrap}
.sfx .t-wait{color:var(--t3);background:var(--s1)}

.sfx .bm{width:32px;height:32px;border-radius:7px;background:var(--s2);display:flex;align-items:center;
 justify-content:center;flex-shrink:0;overflow:hidden}
.sfx .bm img{width:100%;height:100%;object-fit:contain;padding:5px}
.sfx .bm span{font-family:var(--anton);font-size:11px;color:var(--t3)}

.sfx .split{display:grid;grid-template-columns:322px 1fr;border:1px solid var(--ln);border-radius:12px;
 overflow:hidden;min-height:640px}
.sfx .L{border-right:1px solid var(--ln);display:flex;flex-direction:column;background:rgba(0,0,0,.2);min-width:0}
.sfx .srch{background:transparent;border:none;border-bottom:1px solid var(--ln);padding:13px 15px;
 font-size:13px;color:var(--t1);width:100%;outline:none;font-family:var(--bd)}
.sfx .srch::placeholder{color:var(--t4)}
.sfx .srch:focus{border-bottom-color:var(--or)}
.sfx .Lw{position:relative;flex:1;min-height:0}
.sfx .Lw:after{content:"";position:absolute;left:0;right:9px;bottom:0;height:44px;pointer-events:none;
 background:linear-gradient(transparent,#050507)}
.sfx .Ll{position:absolute;inset:0;overflow-y:auto;scrollbar-width:thin;
 scrollbar-color:rgba(250,248,245,.22) transparent}
.sfx .Ll::-webkit-scrollbar{width:9px}
.sfx .Ll::-webkit-scrollbar-thumb{background:rgba(250,248,245,.18);border-radius:5px;
 border:2px solid transparent;background-clip:content-box}
.sfx .Ll::-webkit-scrollbar-thumb:hover{background:rgba(250,248,245,.3);background-clip:content-box}
.sfx .gl{font-size:14px;color:var(--t1);padding:20px 15px 9px;letter-spacing:.01em;
 display:flex;justify-content:space-between;align-items:baseline}
.sfx .gl .qt{font-family:var(--mono);font-size:10px;color:var(--t4)}
.sfx .it{padding:11px 15px;display:flex;gap:11px;align-items:center;border-left:2px solid transparent;
 border-bottom:1px solid var(--ln2);width:100%;text-align:left}
.sfx .it:hover{background:rgba(250,248,245,.022)}
.sfx .it.on{background:rgba(215,63,9,.08);border-left-color:var(--or)}
.sfx .it .n{font-size:13px;color:var(--t1);line-height:1.35;white-space:nowrap;overflow:hidden;
 text-overflow:ellipsis;display:block}
.sfx .it .s{font-family:var(--mono);font-size:10px;color:var(--t3);margin-top:2px;display:block}

.sfx .R{padding:26px 30px;min-width:0}
.sfx .cc{border:1px solid var(--ln);border-radius:14px;overflow:hidden;margin-bottom:22px;
 background:linear-gradient(rgba(250,248,245,.045),rgba(250,248,245,.015))}
.sfx .cc-top{display:flex;align-items:stretch}
.sfx .cc-plate{width:104px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
 background:rgba(0,0,0,.32);border-right:1px solid var(--ln)}
.sfx .cc-plate img{width:56px;height:56px;object-fit:contain}
.sfx .cc-plate .fb{font-family:var(--anton);font-size:22px;color:var(--t3)}
.sfx .cc-id{flex:1;min-width:0;padding:16px 22px 20px;display:flex;flex-direction:column;justify-content:flex-end}
.sfx .cc-eb{font-size:17px;color:var(--t2);letter-spacing:.01em}
.sfx .cc-nm{font-size:40px;color:var(--t1);line-height:1;margin-top:6px}
.sfx .cc-side{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;
 padding:16px 18px 20px;flex-shrink:0;gap:14px}
.sfx .rsb{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.sfx .rb{display:inline-flex;gap:8px;align-items:center;padding:9px 14px;border-radius:8px;
 border:1px solid var(--ln);background:var(--s1);font-size:12.5px;color:var(--t2);white-space:nowrap}
.sfx .rb:hover{background:var(--s2);border-color:rgba(250,248,245,.3);color:var(--t1)}
.sfx .rb .ic{color:var(--t3);display:flex}
.sfx .rb:hover .ic{color:var(--t2)}
.sfx .rb .ic svg{fill:currentColor}
.sfx .rb.no{opacity:.32;pointer-events:none}
.sfx .stt{display:flex;gap:8px;align-items:center;margin-top:9px}
.sfx .stt .dt{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.sfx .stt.live .dt{background:var(--gr);box-shadow:0 0 0 3px rgba(74,222,128,.15)}
.sfx .stt.wait .dt{background:var(--t4)}
.sfx .stt .s1{font-size:12.5px;color:var(--gr)}
.sfx .stt.wait .s1{color:var(--t3)}
.sfx .stt .sep2{width:3px;height:3px;border-radius:50%;background:var(--t4)}
.sfx .stt .s2{font-family:var(--mono);font-size:11px;color:var(--t3)}
.sfx .cc-act{display:flex;align-items:center;gap:10px;padding:15px 22px;border-top:1px solid var(--ln);
 background:rgba(0,0,0,.22);flex-wrap:wrap}
.sfx .cpy{background:var(--or);color:#fff;border-radius:9px;padding:12px 20px;font-size:14px;font-weight:bold;
 display:inline-flex;gap:9px;align-items:center;white-space:nowrap}
.sfx .cpy:hover{background:#ef4a13}
.sfx .tl{display:inline-flex;gap:7px;align-items:center;font-size:13px;color:var(--t3);padding:8px 4px;white-space:nowrap}
.sfx .tl:hover:not(:disabled){color:var(--t1)}
.sfx .tl.dz:hover:not(:disabled){color:#e06a6a}
.sfx .cc-res{margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap}

.sfx .nt{display:flex;gap:12px;align-items:center;padding:13px 15px;border-radius:9px;margin-bottom:10px;font-size:13.5px}
.sfx .nt.warn{background:rgba(215,63,9,.08);border-left:2px solid var(--or);color:var(--t2)}
.sfx .nt.info{background:var(--s1);border-left:2px solid rgba(250,248,245,.2);color:var(--t2)}
.sfx .nt b{color:var(--t1);font-weight:normal}
.sfx .nt .ic{flex-shrink:0}
.sfx .nt.warn .ic{color:var(--or)}
.sfx .nt.info .ic{color:var(--t3)}

.sfx .tabs{display:flex;gap:22px;border-bottom:1px solid var(--ln);margin-bottom:6px;margin-top:22px}
.sfx .tb{color:var(--t3);font-size:13px;padding:0 0 11px;border-bottom:1.5px solid transparent;margin-bottom:-1px}
.sfx .tb:hover{color:var(--t2)}
.sfx .tb.on{color:var(--t1);border-bottom-color:var(--or)}
.sfx .tb i{font-family:var(--mono);font-size:10px;color:var(--t4);font-style:normal;margin-left:5px}

.sfx .grid{display:grid;grid-template-columns:1fr 104px 104px 122px 60px;gap:14px;align-items:center}
.sfx .sheet{border:1px solid var(--ln);border-radius:11px;overflow:hidden;background:rgba(250,248,245,.012)}
.sfx .colh{padding:11px 16px;background:var(--s2);border-bottom:1px solid var(--ln);
 font-size:12.5px;color:var(--t1);letter-spacing:.01em}
.sfx .colh span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sfx .colh .r{text-align:center}
.sfx .ar{padding:12px 16px;border-bottom:1px solid var(--ln2)}
.sfx .ar:last-child{border-bottom:none}
.sfx .ar:hover{background:rgba(250,248,245,.028)}
.sfx .ai2{min-width:0}
.sfx .ai2 .nm{display:flex;gap:10px;align-items:baseline;min-width:0}
.sfx .ai2 .nm .who{color:var(--t1);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sfx .ai2 .nm .sch{font-family:var(--mono);font-size:11px;color:var(--t3);white-space:nowrap;flex-shrink:0}
.sfx .ai2 .by{font-family:var(--mono);font-size:10.5px;color:var(--t4);margin-top:3px}
.sfx .pill2{font-family:var(--mono);font-size:11px;padding:6px 0;border-radius:6px;white-space:nowrap;
 background:var(--s1);color:var(--t3);border:1px solid transparent;text-align:center}
.sfx .pill2.ok{background:rgba(74,222,128,.12);color:#7ee2a8}
.sfx .pill2.lo{background:rgba(255,90,31,.18);color:#FF8A4C;border-color:rgba(255,90,31,.3)}
.sfx .pill2.zero{background:transparent;color:var(--t4);border-color:var(--ln2)}
.sfx .ping{border:1px solid rgba(255,90,31,.32);background:rgba(255,90,31,.09);color:#FF8A4C;
 border-radius:7px;padding:7px 0;font-size:12.5px;white-space:nowrap;width:100%;
 display:inline-flex;gap:7px;align-items:center;justify-content:center}
.sfx .ping:hover{background:rgba(255,90,31,.2);border-color:rgba(255,90,31,.6)}
.sfx .rev{border:1px solid rgba(74,222,128,.3);background:rgba(74,222,128,.08);color:#7ee2a8;
 border-radius:7px;padding:7px 0;font-size:12.5px;white-space:nowrap;width:100%}
.sfx .rev:hover{background:rgba(74,222,128,.16);border-color:rgba(74,222,128,.55)}
.sfx .dvc{display:flex;justify-content:center}
.sfx .dv{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;
 border-radius:6px;flex-shrink:0}
.sfx .dv svg{fill:var(--t3)}
.sfx .dv:hover{background:var(--s2)}
.sfx .dv:hover svg{fill:#4285F4}
.sfx .dv.off{opacity:.16;pointer-events:none}

.sfx .seg{position:relative;display:inline-grid;grid-template-columns:1fr 1fr;
 background:var(--s1);border:1px solid var(--ln);border-radius:11px;padding:4px;
 min-width:400px;overflow:hidden}
.sfx .thumb{position:absolute;top:4px;left:4px;width:calc(50% - 4px);height:calc(100% - 8px);
 border-radius:8px;transition:transform .32s cubic-bezier(.4,0,.2,1),background-color .32s ease;z-index:0}
.sfx .thumb.att{background:var(--or);transform:translateX(0)}
.sfx .thumb.rdy{background:#22C55E;transform:translateX(100%)}
.sfx .sg{position:relative;z-index:1;display:flex;gap:8px;align-items:center;justify-content:center;
 padding:10px 14px;font-size:13.5px;color:var(--t3);white-space:nowrap;transition:color .32s ease}
.sfx .sg:hover{color:var(--t2)}
.sfx .sg.on{color:#fff;font-weight:bold}
.sfx .sg.rdy.on{color:#052e16}
.sfx .sg .ct{font-family:var(--mono);font-size:11.5px;color:var(--t4);transition:color .32s ease}
.sfx .sg.on .ct{color:rgba(255,255,255,.8)}
.sfx .sg.rdy.on .ct{color:rgba(5,46,22,.65)}
.sfx .sg .pd{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sfx .sg .pd.att{background:#FF4E0D;animation:sfx-pd-a 1.1s ease-in-out infinite}
.sfx .sg .pd.rdy{background:#22C55E;animation:sfx-pd-r 1.1s ease-in-out infinite}
.sfx .sg.wake{animation:sfx-wk 1.1s ease-in-out infinite}
.sfx .sg.att.wake{color:#FF7A45}
.sfx .sg.rdy.wake{color:#4ADE80}
@keyframes sfx-pd-a{0%,100%{box-shadow:0 0 0 0 rgba(255,78,13,.75);opacity:1}
 50%{box-shadow:0 0 0 5px rgba(255,78,13,0);opacity:.45}}
@keyframes sfx-pd-r{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.75);opacity:1}
 50%{box-shadow:0 0 0 5px rgba(34,197,94,0);opacity:.45}}
@keyframes sfx-wk{0%,100%{opacity:1}50%{opacity:.55}}
/* Blinking UI is genuinely hard for some people to look at. Not optional. */
@media (prefers-reduced-motion:reduce){
 .sfx .sg .pd,.sfx .sg.wake{animation:none}
 .sfx .sg .pd.att{box-shadow:0 0 0 4px rgba(255,78,13,.28)}
 .sfx .sg .pd.rdy{box-shadow:0 0 0 4px rgba(34,197,94,.28)}
 .sfx .thumb{transition:none}
}
.sfx .seg-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:22px 0 16px}
.sfx .seg-stat{margin-left:auto;display:flex;gap:22px;align-items:center}
.sfx .seg-stat .v{font-family:var(--anton);font-size:34px;color:var(--t1);line-height:1}
.sfx .seg-stat .v s{color:var(--t4);text-decoration:none;font-size:19px}
.sfx .seg-stat .k{font-family:var(--mono);font-size:9px;letter-spacing:.11em;color:var(--t3);
 text-transform:uppercase;margin-top:4px}
.sfx .ack{margin-top:12px;display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.sfx .ack-h{font-size:12px;color:var(--t4)}
.sfx .empt{padding:50px 16px;text-align:center;color:var(--t3);font-size:13px;line-height:1.9}

.sfx .act{padding-top:6px}
.sfx .ad{font-family:var(--mono);font-size:9px;letter-spacing:.14em;color:var(--t4);
 text-transform:uppercase;padding:16px 0 9px}
.sfx .ae{display:flex;gap:13px;padding:9px 0 9px 2px;position:relative}
.sfx .ae:before{content:"";position:absolute;left:8px;top:26px;bottom:-9px;width:1px;background:var(--ln2)}
.sfx .ae:last-child:before{display:none}
.sfx .ai{width:17px;height:17px;border-radius:50%;flex-shrink:0;margin-top:2px;display:flex;
 align-items:center;justify-content:center;background:var(--s2);z-index:1}
.sfx .ai.up{background:rgba(74,222,128,.15);color:var(--gr)}
.sfx .ai.lo{background:rgba(215,63,9,.15);color:var(--or)}
.sfx .ai.sy{background:var(--s2);color:var(--t3)}
.sfx .at{flex:1;min-width:0;font-size:13px;color:var(--t2)}
.sfx .at b{color:var(--t1);font-weight:normal}
.sfx .at .m{color:var(--t3);font-size:12px}
.sfx .at .m.lo{color:var(--or)}
.sfx .am{font-family:var(--mono);font-size:10.5px;color:var(--t4);flex-shrink:0}

.sfx .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(0);
 background:#16161a;border:1px solid var(--ln);border-radius:9px;padding:12px 18px;
 display:flex;gap:10px;align-items:center;font-size:13.5px;color:var(--t1);z-index:200;
 box-shadow:0 8px 30px rgba(0,0,0,.5)}
.sfx .toast .ic{color:var(--gr)}

.sfx .ov{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:150;display:flex;
 align-items:flex-start;justify-content:center;padding:60px 20px;overflow-y:auto}
.sfx .md{background:#101014;border:1px solid var(--ln);border-radius:14px;width:100%;max-width:560px;overflow:hidden}
.sfx .md-h{padding:18px 22px;border-bottom:1px solid var(--ln);display:flex;gap:13px;align-items:center}
.sfx .md-h .ttl{font-size:24px;color:var(--t1);line-height:1.1}
.sfx .md-h .sub{font-family:var(--mono);font-size:10px;color:var(--t3);letter-spacing:.1em;text-transform:uppercase}
.sfx .md-b{padding:22px;display:flex;flex-direction:column;gap:18px}
.sfx .md-f{padding:15px 22px;border-top:1px solid var(--ln);display:flex;gap:8px;justify-content:flex-end;
 background:rgba(0,0,0,.2)}
.sfx .fl{font-family:var(--mono);font-size:9px;letter-spacing:.11em;color:var(--t3);
 text-transform:uppercase;margin-bottom:7px}
.sfx .fi{background:var(--s1);border:1px solid var(--ln);border-radius:7px;padding:9px 11px;font-size:13.5px;
 color:var(--t1);width:100%;font-family:var(--bd)}
.sfx .fi:focus{outline:none;border-color:rgba(215,63,9,.5)}
.sfx .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.sfx .numk{font-size:11px;color:var(--t3);margin-top:5px}
.sfx .trow-b{border-top:1px solid var(--ln2);padding-top:16px}
.sfx .pv{background:var(--s1);border-radius:8px;padding:12px 14px;font-size:12.5px;color:var(--t2);line-height:1.65}
.sfx .pv-k{font-family:var(--mono);font-size:9px;letter-spacing:.11em;color:var(--t4)}
.sfx .md-warn{background:rgba(215,63,9,.08);border-left:2px solid var(--or);border-radius:0 7px 7px 0;
 padding:11px 13px;font-size:12.5px;color:var(--t2)}
.sfx .md-err{color:#e06a6a;font-size:12.5px}

.sfx .psh{background:#101014;border:1px solid var(--ln);border-radius:14px;width:100%;max-width:380px;overflow:hidden}
.sfx .psh-h{padding:17px 20px;border-bottom:1px solid var(--ln)}
.sfx .psh-h .n{font-size:24px;color:var(--t1);line-height:1.1}
.sfx .psh-h .m{font-family:var(--mono);font-size:11px;color:var(--t3);margin-top:4px}
.sfx .psh-b{padding:10px}
.sfx .po{display:flex;gap:13px;align-items:center;width:100%;padding:13px 14px;border-radius:9px;text-align:left}
.sfx .po:hover{background:var(--s2)}
.sfx .po.off{opacity:.34;pointer-events:none}
.sfx .po .pi{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;
 justify-content:center;flex-shrink:0}
.sfx .po .tx{flex:1;min-width:0}
.sfx .po .tx b{display:block;color:var(--t1);font-size:13.5px;font-weight:normal}
.sfx .po .tx span{font-family:var(--mono);font-size:11px;color:var(--t3)}
.sfx .po .ar2{color:var(--t4)}
.sfx .psh-f{padding:11px 20px;border-top:1px solid var(--ln);background:rgba(0,0,0,.2);
 font-size:11.5px;color:var(--t4);display:flex;justify-content:space-between;align-items:center;gap:10px}

/* Mobile-first check: the split stacks, and the athlete sheet keeps its five
   columns but scrolls inside its own container rather than the page. */
@media (max-width:900px){
 .sfx .split{grid-template-columns:1fr}
 .sfx .L{border-right:none;border-bottom:1px solid var(--ln)}
 .sfx .Lw{height:240px;flex:none}
 .sfx .R{padding:18px 16px}
 .sfx .cc-top{flex-wrap:wrap}
 .sfx .cc-plate{width:72px}
 .sfx .cc-plate img{width:40px;height:40px}
 .sfx .cc-id{padding:14px 16px 16px}
 .sfx .cc-nm{font-size:30px}
 .sfx .cc-side{width:100%;align-items:stretch;padding:0 16px 16px;flex-direction:column-reverse}
 .sfx .rsb{justify-content:flex-start}
 .sfx .cc-act{padding:13px 16px}
 .sfx .cpy{width:100%;justify-content:center}
 .sfx .cc-res{margin-left:0}
 .sfx .seg{min-width:0;width:100%}
 .sfx .seg-stat{margin-left:0;width:100%;justify-content:space-between}
 .sfx .sheet{overflow-x:auto}
 .sfx .colh,.sfx .ar{min-width:560px}
}
`}</style>
  );
}
