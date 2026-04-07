"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import OptInLanding from "@/components/OptInLanding";
import CampaignMediaPicker, {
  type MediaPickerResult,
} from "@/components/CampaignMediaPicker";

/**
 * OptInEditor — full-page editor for an opt-in campaign.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Header bar: title, status, save / publish / view / delete    │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  Editor form (60%)        │  Live preview (40%, sticky)      │
 *   │                           │                                  │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ Submitted opt-ins table                                       │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Save persists draft state. Publish flips status to 'live' and sets
 * published_at. Once live, the public URL /optin/[slug] is reachable.
 */

interface Brand {
  id: string;
  name: string;
  logo_light_url: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

interface OptInCampaign {
  id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  slug: string;
  brand_id: string | null;
  admin_campaign_id: number | null;
  title: string;
  headline: string;
  goal: string | null;
  products: string | null;
  social_platforms: string[] | null;
  requirements: string | null;
  payout: string | null;
  deadline: string | null;
  notice: string | null;
  hero_image_url: string | null;
  accent_color: string | null;
  status: "draft" | "live" | "closed";
  brands?: Brand | null;
}

interface PendingOptIn {
  id: string;
  ig_handle: string;
  submitted_at: string;
  source: string | null;
  forwarded_to_admin_at: string | null;
}

interface Props {
  initialCampaign: OptInCampaign;
  brands: Brand[];
}

const SOCIAL_PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "X / Twitter" },
  { value: "youtube", label: "YouTube" },
];

export default function OptInEditor({ initialCampaign, brands }: Props) {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [campaign, setCampaign] = useState<OptInCampaign>(initialCampaign);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [optins, setOptins] = useState<PendingOptIn[]>([]);
  const [optinsLoading, setOptinsLoading] = useState(true);

  // Load pending opt-ins on mount
  useEffect(() => {
    void loadOptins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOptins() {
    setOptinsLoading(true);
    const { data, error } = await supabase
      .from("pending_optins")
      .select("id, ig_handle, submitted_at, source, forwarded_to_admin_at")
      .eq("optin_campaign_id", campaign.id)
      .order("submitted_at", { ascending: false });
    if (!error) setOptins((data || []) as PendingOptIn[]);
    setOptinsLoading(false);
  }

  function update<K extends keyof OptInCampaign>(key: K, value: OptInCampaign[K]) {
    setCampaign((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  function togglePlatform(platform: string) {
    const current = campaign.social_platforms || [];
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    update("social_platforms", next);
  }

  const handleMediaSelect = useCallback(
    (item: MediaPickerResult) => {
      if (item.type !== "image") return;
      setCampaign((prev) => ({ ...prev, hero_image_url: item.url }));
      setIsDirty(true);
      setPickerOpen(false);
    },
    []
  );

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const { brands: _b, created_at, updated_at, published_at, ...updateFields } = campaign;
    void _b;
    void created_at;
    void updated_at;
    void published_at;

    const { error } = await supabase
      .from("optin_campaigns")
      .update(updateFields)
      .eq("id", campaign.id);

    setSaving(false);

    if (error) {
      console.error("save error", error);
      setSaveError(error.message || "Save failed.");
      return;
    }

    setIsDirty(false);
    setSavedAt(new Date());
  }

  async function handlePublishToggle() {
    const newStatus: "live" | "draft" = campaign.status === "live" ? "draft" : "live";
    const updates: Partial<OptInCampaign> = { status: newStatus };
    if (newStatus === "live" && !campaign.published_at) {
      (updates as any).published_at = new Date().toISOString();
    }

    setSaving(true);
    setSaveError(null);

    const { brands: _b, created_at, updated_at, ...rest } = campaign;
    void _b;
    void created_at;
    void updated_at;

    const { error } = await supabase
      .from("optin_campaigns")
      .update({ ...rest, ...updates })
      .eq("id", campaign.id);

    setSaving(false);

    if (error) {
      console.error("publish error", error);
      setSaveError(error.message || "Publish failed.");
      return;
    }

    setCampaign((prev) => ({ ...prev, ...updates } as OptInCampaign));
    setIsDirty(false);
    setSavedAt(new Date());
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("optin_campaigns")
      .delete()
      .eq("id", campaign.id);
    setDeleting(false);
    if (error) {
      console.error("delete error", error);
      return;
    }
    router.push("/dashboard?tab=optin");
  }

  // Derive a deadline value for <input type="datetime-local"> from the stored ISO string.
  // datetime-local needs YYYY-MM-DDTHH:MM (no timezone).
  const deadlineLocal = campaign.deadline
    ? new Date(campaign.deadline).toISOString().slice(0, 16)
    : "";

  function setDeadlineFromLocal(value: string) {
    if (!value) {
      update("deadline", null);
    } else {
      update("deadline", new Date(value).toISOString());
    }
  }

  const statusPillClass =
    campaign.status === "live"
      ? "bg-green-900/30 text-green-400"
      : campaign.status === "closed"
      ? "bg-gray-800 text-gray-400"
      : "bg-amber-900/30 text-amber-400";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-gray-800">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard?tab=optin"
              className="text-gray-500 hover:text-white text-sm font-bold flex items-center gap-1.5 shrink-0"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base font-black truncate">{campaign.title || "Untitled"}</h1>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${statusPillClass}`}>
                  {campaign.status === "live" ? "Live" : campaign.status === "closed" ? "Closed" : "Draft"}
                </span>
              </div>
              <div className="text-[11px] text-gray-600 truncate">
                /optin/{campaign.slug}
                {savedAt && !isDirty && (
                  <span className="ml-2 text-green-500">
                    Saved {savedAt.toLocaleTimeString()}
                  </span>
                )}
                {isDirty && <span className="ml-2 text-amber-400">Unsaved changes</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {campaign.status === "live" && (
              <a
                href={`/optin/${campaign.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg"
              >
                View Live ↗
              </a>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="px-4 py-2 text-xs font-bold text-white border border-gray-700 hover:border-gray-500 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handlePublishToggle}
              disabled={saving}
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg disabled:opacity-50 ${
                campaign.status === "live"
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-[#D73F09] hover:bg-[#B33407]"
              }`}
            >
              {campaign.status === "live" ? "Unpublish" : "Publish"}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
              title="Delete"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
        {saveError && (
          <div className="px-6 pb-3">
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {saveError}
            </div>
          </div>
        )}
      </div>

      {/* Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 p-6 max-w-[1400px] mx-auto">
        {/* ── EDITOR FORM ── */}
        <div className="space-y-6">
          <Section title="Basics">
            <Field label="Title">
              <input
                type="text"
                value={campaign.title}
                onChange={(e) => update("title", e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Headline" hint='Top pill on the hero. Defaults to "New NIL Opportunity".'>
              <input
                type="text"
                value={campaign.headline}
                onChange={(e) => update("headline", e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Brand">
              <select
                value={campaign.brand_id || ""}
                onChange={(e) => update("brand_id", e.target.value || null)}
                className="form-input"
              >
                <option value="">— No brand —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Admin Campaign ID"
              hint="ColdFusion admin numeric ID — opt-ins are queued under this for the admin to pull."
            >
              <input
                type="text"
                inputMode="numeric"
                value={campaign.admin_campaign_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === "") update("admin_campaign_id", null);
                  else {
                    const n = parseInt(v, 10);
                    if (!isNaN(n)) update("admin_campaign_id", n);
                  }
                }}
                className="form-input"
              />
            </Field>
          </Section>

          <Section title="Hero Image">
            <div className="flex items-start gap-4">
              <div className="w-[180px] h-[180px] rounded-xl overflow-hidden bg-black border border-gray-800 flex-shrink-0">
                {campaign.hero_image_url ? (
                  <img
                    src={campaign.hero_image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">
                    No image
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#D73F09] hover:bg-[#B33407] rounded-lg"
                >
                  Pick from media library
                </button>
                {campaign.hero_image_url && (
                  <button
                    onClick={() => update("hero_image_url", null)}
                    className="block text-xs font-bold text-gray-500 hover:text-white"
                  >
                    Clear image
                  </button>
                )}
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Choose an athlete photo from a previous campaign. The hero appears on the
                  landing page, app card, and story card.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Brief">
            <Field label="Goal">
              <textarea
                value={campaign.goal || ""}
                onChange={(e) => update("goal", e.target.value)}
                rows={3}
                className="form-input"
              />
            </Field>
            <Field label="Products">
              <textarea
                value={campaign.products || ""}
                onChange={(e) => update("products", e.target.value)}
                rows={2}
                className="form-input"
              />
            </Field>
            <Field label="Requirements">
              <textarea
                value={campaign.requirements || ""}
                onChange={(e) => update("requirements", e.target.value)}
                rows={2}
                className="form-input"
              />
            </Field>
            <Field label="Payout">
              <input
                type="text"
                value={campaign.payout || ""}
                onChange={(e) => update("payout", e.target.value)}
                placeholder="Free product + bonus"
                className="form-input"
              />
            </Field>
            <Field label="Deadline">
              <input
                type="datetime-local"
                value={deadlineLocal}
                onChange={(e) => setDeadlineFromLocal(e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Social Platforms">
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORM_OPTIONS.map((opt) => {
                  const active = (campaign.social_platforms || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => togglePlatform(opt.value)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full border ${
                        active
                          ? "bg-[#D73F09] border-[#D73F09] text-white"
                          : "bg-transparent border-gray-700 text-gray-500 hover:text-white hover:border-gray-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          <Section title="Eligibility Notice" subtitle="Optional amber callout shown at the top of the brief.">
            <Field label="Notice text" hint='e.g. "Big 12 schools only" or "Limited to first 50 athletes"'>
              <textarea
                value={campaign.notice || ""}
                onChange={(e) => update("notice", e.target.value)}
                rows={2}
                className="form-input"
                placeholder="Leave blank if no eligibility restriction."
              />
            </Field>
          </Section>

          <Section title="Visual">
            <Field label="Accent color" hint="Defaults to the brand's primary color if blank.">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={campaign.accent_color || "#D73F09"}
                  onChange={(e) => update("accent_color", e.target.value)}
                  className="w-12 h-10 rounded border border-gray-800 bg-black cursor-pointer"
                />
                <input
                  type="text"
                  value={campaign.accent_color || ""}
                  onChange={(e) => update("accent_color", e.target.value || null)}
                  placeholder="#D73F09"
                  className="form-input flex-1"
                />
                {campaign.accent_color && (
                  <button
                    onClick={() => update("accent_color", null)}
                    className="text-xs font-bold text-gray-500 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
            </Field>
          </Section>
        </div>

        {/* ── LIVE PREVIEW ── */}
        <div className="lg:sticky lg:top-[88px] lg:self-start">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-1">
            Live Preview
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-800 bg-black">
            <div className="max-h-[720px] overflow-y-auto">
              <OptInLanding campaign={campaign as any} previewMode />
            </div>
          </div>
        </div>
      </div>

      {/* ── PENDING OPT-INS TABLE ── */}
      <div className="px-6 pb-12 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-white">
            Submitted Opt-Ins
            <span className="ml-2 text-xs text-gray-500 font-bold">{optins.length}</span>
          </h2>
          <button
            onClick={loadOptins}
            className="text-xs font-bold text-gray-500 hover:text-white"
          >
            Refresh
          </button>
        </div>
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">
          {optinsLoading ? (
            <div className="text-gray-500 text-center py-8 text-sm">Loading…</div>
          ) : optins.length === 0 ? (
            <div className="text-gray-600 text-center py-8 text-sm">
              No opt-ins yet. Submissions will appear here as athletes opt in.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    IG Handle
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Submitted
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {optins.map((o) => (
                  <tr key={o.id} className="border-b border-gray-900 last:border-b-0">
                    <td className="px-4 py-3 text-white font-bold">@{o.ig_handle}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(o.submitted_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs uppercase tracking-wider">
                      {o.source || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {o.forwarded_to_admin_at ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-900/30 text-green-400">
                          Synced
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-900/30 text-amber-400">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Media picker */}
      <CampaignMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleMediaSelect}
      />

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Opt-In Page</h2>
            <p className="text-sm text-gray-400 mb-1">
              Permanently delete <span className="text-white font-bold">{campaign.title}</span>?
            </p>
            <p className="text-xs text-red-400/70 mb-6">
              All submitted opt-ins for this page will also be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-400 hover:text-white border border-gray-800 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .form-input {
          width: 100%;
          background: #000;
          border: 1px solid #1f2937;
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          color: #fff;
          font-size: 0.875rem;
          font-weight: 600;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          border-color: #d73f09;
        }
        .form-input::placeholder {
          color: #4b5563;
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-5">
      <div className="mb-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-600 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-600 mt-1.5">{hint}</p>}
    </div>
  );
}
