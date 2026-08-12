// src/components/submission-forms/NewFormModal.tsx
// ============================================================
// The brand → campaign → settings picker, lifted out of the old list page
// when that page became the split view. Behaviour is unchanged from the
// version shipped in #155/#156 — only its address moved.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import DeliverablesField from "@/components/submission-forms/DeliverablesField";
import ExpiryControl from "@/components/submission-forms/ExpiryControl";
import { previewLine } from "@/components/submission-forms/previewLine";

interface PickCampaign {
  id: string;
  name: string;
  adminId: string | null;
  driveFolderId: string | null;
  briefUrl: string | null;
  hasActiveLink: boolean;
  createdOn: string | null;
}
interface PickBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  activeCount: number;
  hasBrandFolder: boolean;
  campaigns: PickCampaign[];
}

const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;

// A campaign under a brand with no Drive parent can't be provisioned at all,
// so its row is dead rather than warned about.
type FolderState = "ready" | "pending" | "blocked";
const FOLDER_META: Record<FolderState, { cls: string; tip: string }> = {
  ready: { cls: "text-emerald-400", tip: "Folder ready" },
  pending: { cls: "text-[#D73F09]", tip: "Folder will be created" },
  blocked: { cls: "text-white/20", tip: "This brand has no Drive folder yet" },
};

function folderStateOf(c: PickCampaign, brand: PickBrand): FolderState {
  if (c.driveFolderId) return "ready";
  return brand.hasBrandFolder ? "pending" : "blocked";
}

function FolderIcon({ state }: { state: FolderState }) {
  const { cls, tip } = FOLDER_META[state];
  return (
    <span title={tip} aria-label={tip} className={`flex-shrink-0 ${cls}`}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={state === "ready" ? 2.75 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {state === "ready" ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <path d="M4 20V7a2 2 0 0 1 2-2h3.6l2 2H18a2 2 0 0 1 2 2v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
        )}
      </svg>
    </span>
  );
}

export default function NewFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [brands, setBrands] = useState<PickBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<PickBrand | null>(null);
  const [selected, setSelected] = useState<PickCampaign | null>(null);
  const [minPhotos, setMinPhotos] = useState(3);
  const [minVideos, setMinVideos] = useState(1);
  const [maxFiles, setMaxFiles] = useState(25);
  const [deliverables, setDeliverables] = useState<number | null>(null);
  const [briefUrl, setBriefUrl] = useState("");
  // null = never, matching what the create route wrote before this existed.
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Folder provisioning for the selected campaign. Held here rather than
  // re-fetching the whole brand list, so the step-3 state flips immediately.
  const [folderId, setFolderId] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [folderErr, setFolderErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/submission-forms/campaigns");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setBrands(body.brands);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shownBrands = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? brands.filter((b) => b.name.toLowerCase().includes(s)) : brands;
  }, [brands, q]);

  const pickCampaign = (c: PickCampaign) => {
    setSelected(c);
    setBriefUrl(c.briefUrl ?? ""); // 231 of 611 campaigns carry one
    setFolderId(c.driveFolderId);
    setFolderErr(null);
    setErr(null);
  };

  // Creates <campaign>/Content and <campaign>/Contracts/{Drafts,Signed}.
  // Idempotent — adopts anything already there rather than duplicating it.
  const createFolder = async () => {
    if (!selected) return;
    setProvisioning(true);
    setFolderErr(null);
    try {
      const res = await fetch("/api/drive/campaign-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selected.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't create the folder.");
      setFolderId(body.driveFolderId);
    } catch (e: any) {
      setFolderErr(e.message);
    } finally {
      setProvisioning(false);
    }
  };

  // Only claim the brief came from the campaign while it's still untouched.
  const briefPrefilled = !!selected?.briefUrl && briefUrl === selected.briefUrl;

  // Assembled from the same values the athlete page renders, so this is a real
  // preview of that page's copy rather than decoration.
  const preview = previewLine({ minPhotos, minVideos, deliverables, expiresAt });

  const create = async () => {
    if (!selected) return;
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/submission-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selected.id,
          minPhotos,
          minVideos,
          maxFiles,
          deliverables,
          briefUrl: briefUrl.trim() || null,
          expiresAt,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      onCreated();
    } catch (e: any) {
      setErr(e.message);
      setCreating(false);
    }
  };

  const subtitle = selected
    ? selected.name
    : brand
      ? `${brand.activeCount} active ${plural(brand.activeCount, "campaign")}`
      : "Pick the brand, then the campaign.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] bg-[#0f0f0f] border border-white/10 rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">New submission form</h2>
          <p className="text-xs text-white/45 mt-0.5 truncate">{subtitle}</p>
        </div>

        {!brand ? (
          // ── Step 1: brand ──
          <>
            <div className="px-5 pt-4">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search brands…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#D73F09]/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {loading ? (
                <div className="text-white/40 text-sm py-8 text-center">Loading brands…</div>
              ) : err ? (
                <div className="text-red-400 text-sm py-8 text-center">{err}</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {shownBrands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBrand(b)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {b.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.logoUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-white/25 text-[10px]">—</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{b.name}</div>
                        <div className="text-[11px] text-white/40">
                          {b.activeCount} active {plural(b.activeCount, "campaign")}
                        </div>
                      </div>
                      <span className="text-white/25 text-sm flex-shrink-0">›</span>
                    </button>
                  ))}
                  {shownBrands.length === 0 && (
                    <div className="text-white/40 text-sm py-8 text-center">No matches.</div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : !selected ? (
          // ── Step 2: campaign ──
          <>
            <div className="px-5 pt-4 flex items-center gap-3">
              <button
                onClick={() => setBrand(null)}
                className="text-xs text-white/45 hover:text-white/70 flex-shrink-0"
              >
                ← Back to brands
              </button>
              <div className="flex items-center gap-2 min-w-0 ml-auto">
                <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logoUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-white/25 text-[9px]">—</span>
                  )}
                </div>
                <span className="text-xs text-white/70 truncate">{brand.name}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="flex flex-col gap-1">
                {brand.campaigns.map((c) => {
                  const state = folderStateOf(c, brand);
                  const blocked = state === "blocked";
                  return (
                    <button
                      key={c.id}
                      onClick={() => pickCampaign(c)}
                      disabled={blocked}
                      title={blocked ? FOLDER_META.blocked.tip : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                        blocked ? "opacity-45 cursor-not-allowed" : "hover:bg-white/5"
                      }`}
                    >
                      <FolderIcon state={state} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{c.name}</div>
                      </div>
                      {c.hasActiveLink && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/15 text-white/45 flex-shrink-0">
                          HAS FORM
                        </span>
                      )}
                      {/* /28 isn't on Tailwind's opacity scale (steps of 5) —
                          the bracket form is what actually emits 28%. */}
                      <span className="text-[11px] font-mono text-white/[0.28] flex-shrink-0">
                        {c.adminId ?? "—"}
                      </span>
                    </button>
                  );
                })}
                {brand.campaigns.length === 0 && (
                  <div className="text-white/40 text-sm py-8 text-center">No active campaigns.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          // ── Step 3: settings ──
          <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-white/45 hover:text-white/70 text-left"
            >
              ← Back to campaigns
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-white/25 text-xs">—</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{selected.name}</div>
                <div className="text-xs text-white/45 truncate">{brand.name}</div>
              </div>
            </div>

            {!folderId ? (
              <div className="text-xs text-[#D73F09] bg-[#D73F09]/10 border border-[#D73F09]/25 rounded-lg px-3 py-2 leading-relaxed">
                <div>No Drive folder yet — uploads won&apos;t work until one is created.</div>
                <button
                  onClick={createFolder}
                  disabled={provisioning}
                  className="mt-2 px-3 py-1.5 rounded-lg border border-[#D73F09]/40 bg-[#D73F09]/10 text-[#D73F09] font-semibold hover:bg-[#D73F09]/20 disabled:opacity-50 transition-colors"
                >
                  {provisioning ? "Creating…" : "Create folder"}
                </button>
                {folderErr && <div className="text-red-400 mt-2">{folderErr}</div>}
              </div>
            ) : (
              !selected.driveFolderId && (
                // Only shown when this modal did the creating — a campaign that
                // arrived with a folder needs no announcement.
                <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2 leading-relaxed">
                  Folder ready — Content and Contracts/Drafts + Signed created.
                </div>
              )
            )}

            {/* 2×2 at 390px, where three number inputs in one row still read
                fine but their labels sit tight. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumField label="Min photos" value={minPhotos} onChange={(n) => setMinPhotos(n ?? 0)} />
              <NumField label="Min videos" value={minVideos} onChange={(n) => setMinVideos(n ?? 0)} />
              <NumField label="Max files" value={maxFiles} onChange={(n) => setMaxFiles(n ?? 1)} />
            </div>

            <DeliverablesField value={deliverables} onChange={setDeliverables} />

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Brief link</label>
              <input
                type="url"
                value={briefUrl}
                onChange={(e) => setBriefUrl(e.target.value)}
                placeholder="https://"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[#D73F09]/50"
              />
              {briefPrefilled && <div className="text-[10px] text-white/30 mt-1">From the campaign brief</div>}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Link expires</label>
              <ExpiryControl value={expiresAt} onChange={setExpiresAt} />
            </div>

            <div className="rounded-lg bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-white/55 leading-relaxed">
              {preview}
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

// Deliverables moved to its own toggle component, so this is back to the
// plain file-count field the three minimums need.
function NumField({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  max?: number;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">{label}</label>
      <input
        type="number"
        min={0}
        max={max}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = Math.max(0, parseInt(raw, 10) || 0);
          onChange(max != null ? Math.min(max, n) : n);
        }}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D73F09]/50"
      />
    </div>
  );
}
