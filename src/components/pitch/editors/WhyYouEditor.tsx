"use client";

import { useEffect, useRef, useState } from "react";
import type {
  WhyYouSectionData,
  WhyYouSocialHandle,
  WhyYouSocialStat,
  WhyYouUpcomingCampaign,
} from "@/types/pitch";
import CampaignMediaPicker from "@/components/CampaignMediaPicker";
import { createBrowserSupabase } from "@/lib/supabase";
import { sumFollowerCounts } from "@/lib/pitch/socialFormat";

interface Props {
  data: WhyYouSectionData;
  onChange: (data: WhyYouSectionData) => void;
}

const PLATFORMS: { value: WhyYouSocialHandle["platform"]; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X / Twitter" },
];

// One row of the brands table — only the bits the dropdown needs.
type BrandOption = {
  name: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  logo_url: string | null;
};

export default function WhyYouEditor({ data, onChange }: Props) {
  const [pickingPhoto, setPickingPhoto] = useState<
    "athlete" | "school" | "banner" | null
  >(null);
  const [uploadingSlot, setUploadingSlot] = useState<
    "athlete" | "school" | "banner" | null
  >(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Brand dropdown options, fetched once on mount. Used to populate
  // the "Upcoming Campaigns" brand picker — replaces the old free-text
  // input so titles always match an existing brand.
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: rows } = await supabase
        .from("brands")
        .select("name, logo_light_url, logo_dark_url, logo_url")
        .or("archived.is.null,archived.eq.false")
        .order("name", { ascending: true });
      if (!active) return;
      setBrands((rows as BrandOption[] | null) ?? []);
      setBrandsLoaded(true);
    })();
    return () => {
      active = false;
    };
    // We only need to load brands once; the supabase client identity
    // changes per render, so don't include it in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convenience patcher
  const patch = (partial: Partial<WhyYouSectionData>) =>
    onChange({ ...data, ...partial });

  // Direct file upload to Supabase Storage (campaign-media bucket).
  // Generates a unique path under "pitch-uploads/<random-id>/<filename>".
  async function uploadPhoto(
    slot: "athlete" | "school" | "banner",
    file: File,
  ) {
    setUploadError(null);
    setUploadingSlot(slot);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const random = crypto.randomUUID();
      const path = `pitch-uploads/${random}/${slot}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("campaign-media")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from("campaign-media")
        .getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("No public URL returned");
      if (slot === "athlete") patch({ athletePhotoUrl: pub.publicUrl });
      else if (slot === "school") patch({ schoolLogoUrl: pub.publicUrl });
      else patch({ bannerImageUrl: pub.publicUrl });
    } catch (err: any) {
      setUploadError(err?.message ?? "Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  }

  // ---- Paragraphs (string[]) — edited as a single textarea, split on
  // blank lines. Empty array becomes empty textarea.
  const paragraphsText = (data.paragraphs ?? []).join("\n\n");
  function handleParagraphsChange(value: string) {
    const parts = value
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    patch({ paragraphs: parts });
  }

  // ---- Social handles (array of objects)
  function updateHandle(
    i: number,
    field: keyof WhyYouSocialHandle,
    value: string,
  ) {
    const handles = [...(data.socialHandles ?? [])];
    handles[i] = { ...handles[i], [field]: value } as WhyYouSocialHandle;
    patch({ socialHandles: handles });
  }
  function addHandle() {
    patch({
      socialHandles: [
        ...(data.socialHandles ?? []),
        { platform: "instagram", handle: "", url: "" },
      ],
    });
  }
  function removeHandle(i: number) {
    patch({
      socialHandles: (data.socialHandles ?? []).filter((_, idx) => idx !== i),
    });
  }

  // ---- Social stats
  function updateStat(i: number, field: keyof WhyYouSocialStat, value: string) {
    const stats = [...(data.socialStats ?? [])];
    stats[i] = { ...stats[i], [field]: value } as WhyYouSocialStat;
    patch({ socialStats: stats });
  }
  function addStat() {
    patch({
      socialStats: [...(data.socialStats ?? []), { label: "", value: "" }],
    });
  }
  function removeStat(i: number) {
    patch({
      socialStats: (data.socialStats ?? []).filter((_, idx) => idx !== i),
    });
  }

  // ---- Highlights (string[])
  function updateHighlight(i: number, value: string) {
    const arr = [...(data.highlights ?? [])];
    arr[i] = value;
    patch({ highlights: arr });
  }
  function addHighlight() {
    patch({ highlights: [...(data.highlights ?? []), ""] });
  }
  function removeHighlight(i: number) {
    patch({
      highlights: (data.highlights ?? []).filter((_, idx) => idx !== i),
    });
  }

  // ---- Upcoming campaigns
  function updateCampaign(
    i: number,
    field: keyof WhyYouUpcomingCampaign,
    value: string,
  ) {
    const arr = [...(data.upcomingCampaigns ?? [])];
    arr[i] = { ...arr[i], [field]: value } as WhyYouUpcomingCampaign;
    patch({ upcomingCampaigns: arr });
  }
  function addCampaign() {
    patch({
      upcomingCampaigns: [
        ...(data.upcomingCampaigns ?? []),
        { title: "" },
      ],
    });
  }
  function removeCampaign(i: number) {
    patch({
      upcomingCampaigns: (data.upcomingCampaigns ?? []).filter(
        (_, idx) => idx !== i,
      ),
    });
  }

  return (
    <div className="space-y-6">
      {/* ============== IDENTITY ============== */}
      <Section title="Athlete identity">
        <Field label="Legal Name" required>
          <input
            value={data.athleteName ?? ""}
            onChange={(e) => patch({ athleteName: e.target.value })}
            placeholder="e.g. Nau'Jour Grainger"
            className={inputClass}
          />
        </Field>
        <Field label="Nickname (optional)">
          <input
            value={data.nickname ?? ""}
            onChange={(e) => patch({ nickname: e.target.value || undefined })}
            placeholder="e.g. Toosii"
            className={inputClass}
          />
        </Field>
        <Field label="Subtitle">
          <input
            value={data.athleteSubtitle ?? ""}
            onChange={(e) =>
              patch({ athleteSubtitle: e.target.value || undefined })
            }
            placeholder="e.g. LSU Football"
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Position">
            <input
              value={data.position ?? ""}
              onChange={(e) =>
                patch({ position: e.target.value || undefined })
              }
              placeholder="WR"
              className={inputClass}
            />
          </Field>
          <Field label="Class">
            <input
              value={data.classYear ?? ""}
              onChange={(e) =>
                patch({ classYear: e.target.value || undefined })
              }
              placeholder="Freshman"
              className={inputClass}
            />
          </Field>
          <Field label="Hometown">
            <input
              value={data.hometown ?? ""}
              onChange={(e) =>
                patch({ hometown: e.target.value || undefined })
              }
              placeholder="Raleigh, NC"
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      {/* ============== PHOTOS ============== */}
      <Section title="Photos">
        <Field label="Hero Banner Photo">
          <PhotoSlot
            url={data.bannerImageUrl}
            uploading={uploadingSlot === "banner"}
            onClear={() => patch({ bannerImageUrl: undefined })}
            onPick={() => setPickingPhoto("banner")}
            onUpload={(file) => uploadPhoto("banner", file)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Wide photo behind the profile circle. Aim for 16:7 aspect
            ratio (e.g. 2400×1050). Leave blank to use the dark gradient
            fallback.
          </p>
        </Field>
        <Field label="Athlete Photo">
          <PhotoSlot
            url={data.athletePhotoUrl}
            uploading={uploadingSlot === "athlete"}
            onClear={() => patch({ athletePhotoUrl: undefined })}
            onPick={() => setPickingPhoto("athlete")}
            onUpload={(file) => uploadPhoto("athlete", file)}
          />
        </Field>
        <Field label="School Logo">
          <PhotoSlot
            url={data.schoolLogoUrl}
            uploading={uploadingSlot === "school"}
            onClear={() => patch({ schoolLogoUrl: undefined })}
            onPick={() => setPickingPhoto("school")}
            onUpload={(file) => uploadPhoto("school", file)}
          />
        </Field>
        {uploadError ? (
          <div className="text-xs text-red-400">{uploadError}</div>
        ) : null}
      </Section>

      {/* ============== BIO ============== */}
      <Section title="Bio">
        <Field label="Paragraphs (one per blank line)">
          <textarea
            value={paragraphsText}
            onChange={(e) => handleParagraphsChange(e.target.value)}
            rows={8}
            placeholder={
              "First paragraph here.\n\nSecond paragraph after a blank line.\n\nAdd as many as you need."
            }
            className={`${inputClass} resize-y`}
          />
        </Field>
        <Field label="Pull Quote (optional)">
          <textarea
            value={data.quote ?? ""}
            onChange={(e) => patch({ quote: e.target.value || undefined })}
            rows={2}
            placeholder="A line from a recent interview or post"
            className={`${inputClass} resize-y`}
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={data.tinted !== false}
            onChange={(e) => patch({ tinted: e.target.checked })}
          />
          Tinted (orange wash) background
        </label>
      </Section>

      {/* ============== SOCIAL HANDLES ============== */}
      <Section title={`Social Handles (${data.socialHandles?.length ?? 0})`}>
        {(data.socialHandles ?? []).map((h, i) => (
          <div
            key={i}
            className="border border-gray-800 rounded-lg p-3 mb-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#D73F09]">
                Handle {i + 1}
              </span>
              <button
                onClick={() => removeHandle(i)}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                &times; Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={h.platform}
                onChange={(e) => updateHandle(i, "platform", e.target.value)}
                className={inputClass}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                value={h.followers ?? ""}
                onChange={(e) => updateHandle(i, "followers", e.target.value)}
                placeholder="Followers (e.g. 4.5M)"
                className={inputClass}
              />
            </div>
            <input
              value={h.handle}
              onChange={(e) => updateHandle(i, "handle", e.target.value)}
              placeholder="@handle (no @)"
              className={inputClass}
            />
            <input
              value={h.url}
              onChange={(e) => updateHandle(i, "url", e.target.value)}
              placeholder="https://instagram.com/handle"
              className={inputClass}
            />
          </div>
        ))}
        <button
          onClick={addHandle}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add social handle
        </button>

        {/* Live combined-followers total — auto-summed from the
            per-platform follower strings above. Shown so Peyton can
            see the math update as he edits the numbers. The value
            shown here also appears on the public pitch page below the
            social icons row (calculated the same way at render time). */}
        {(() => {
          const sum = sumFollowerCounts(data.socialHandles);
          if (sum.parsedCount === 0 && sum.unparseableCount === 0) {
            return null;
          }
          return (
            <div className="mt-3 px-3 py-2 border border-[#D73F09]/40 rounded-lg bg-[#D73F09]/5 text-xs text-gray-300 flex items-baseline gap-3">
              <span className="font-bold text-[#D73F09]">
                {sum.formatted}
              </span>
              <span className="text-gray-400 uppercase tracking-wider">
                Auto-calculated combined followers
              </span>
              {sum.unparseableCount > 0 ? (
                <span className="ml-auto text-[10px] text-yellow-400">
                  {sum.unparseableCount} entr
                  {sum.unparseableCount === 1 ? "y" : "ies"} couldn&apos;t
                  parse
                </span>
              ) : null}
            </div>
          );
        })()}
      </Section>

      {/* ============== SOCIAL STATS ============== */}
      <Section title={`Social Stats (${data.socialStats?.length ?? 0})`}>
        {(data.socialStats ?? []).map((s, i) => (
          <div
            key={i}
            className="border border-gray-800 rounded-lg p-3 mb-3 grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
          >
            <input
              value={s.label}
              onChange={(e) => updateStat(i, "label", e.target.value)}
              placeholder="Label (e.g. Combined followers)"
              className={inputClass}
            />
            <input
              value={s.value}
              onChange={(e) => updateStat(i, "value", e.target.value)}
              placeholder="Value (e.g. 13.5M+)"
              className={inputClass}
            />
            <button
              onClick={() => removeStat(i)}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          onClick={addStat}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add stat
        </button>
      </Section>

      {/* ============== HIGHLIGHTS ============== */}
      <Section title={`Recent Highlights (${data.highlights?.length ?? 0})`}>
        {(data.highlights ?? []).map((h, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto] gap-2 items-start mb-2"
          >
            <textarea
              value={h}
              onChange={(e) => updateHighlight(i, e.target.value)}
              rows={2}
              placeholder="One-sentence highlight"
              className={`${inputClass} resize-y`}
            />
            <button
              onClick={() => removeHighlight(i)}
              className="text-xs text-gray-500 hover:text-red-400 mt-2"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          onClick={addHighlight}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add highlight
        </button>
      </Section>

      {/* ============== UPCOMING CAMPAIGNS ============== */}
      <Section
        title={`Upcoming Campaigns (${data.upcomingCampaigns?.length ?? 0})`}
      >
        <p className="text-xs text-gray-500 mb-2">
          Pick a brand from the dropdown — the logo auto-resolves from
          the brands table at render time. If a campaign was created
          before the dropdown existed and its title doesn&apos;t match a
          brand, it&apos;s shown as &quot;(custom)&quot; so you can keep
          or replace it.
        </p>
        {(data.upcomingCampaigns ?? []).map((c, i) => {
          // If the existing title doesn't match any active brand, we
          // still want to render a valid <option> for it so the
          // <select> shows the current value instead of falling back
          // to the empty option. We add a synthetic "(custom)" entry.
          const titleMatchesBrand = brands.some((b) => b.name === c.title);
          const showCustomOption =
            !!c.title && !titleMatchesBrand && brandsLoaded;
          return (
            <div
              key={i}
              className="border border-gray-800 rounded-lg p-3 mb-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#D73F09]">
                  Campaign {i + 1}
                </span>
                <button
                  onClick={() => removeCampaign(i)}
                  className="text-xs text-gray-500 hover:text-red-400"
                >
                  &times; Remove
                </button>
              </div>
              <select
                value={c.title}
                onChange={(e) => updateCampaign(i, "title", e.target.value)}
                className={inputClass}
              >
                <option value="">
                  {brandsLoaded ? "— Select a brand —" : "Loading brands…"}
                </option>
                {showCustomOption ? (
                  <option value={c.title}>
                    {c.title} (custom — not in brands list)
                  </option>
                ) : null}
                {brands.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                value={c.subtitle ?? ""}
                onChange={(e) => updateCampaign(i, "subtitle", e.target.value)}
                placeholder="Subtitle (optional)"
                className={inputClass}
              />
              <input
                value={c.logoUrl ?? ""}
                onChange={(e) => updateCampaign(i, "logoUrl", e.target.value)}
                placeholder="Override logo URL (optional — leave blank to use brand's logo)"
                className={inputClass}
              />
            </div>
          );
        })}
        <button
          onClick={addCampaign}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add campaign
        </button>
      </Section>

      {/* ============== Photo picker ============== */}
      {pickingPhoto !== null && (
        <CampaignMediaPicker
          open={true}
          onClose={() => setPickingPhoto(null)}
          onSelect={(result) => {
            if (pickingPhoto === "athlete") {
              patch({ athletePhotoUrl: result.url });
            } else if (pickingPhoto === "school") {
              patch({ schoolLogoUrl: result.url });
            } else if (pickingPhoto === "banner") {
              patch({ bannerImageUrl: result.url });
            }
            setPickingPhoto(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-[#D73F09] mb-3">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
        {label}
        {required ? <span className="text-[#D73F09]"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function PhotoSlot({
  url,
  uploading,
  onPick,
  onUpload,
  onClear,
}: {
  url?: string;
  uploading?: boolean;
  onPick: () => void;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (url) {
    return (
      <div className="flex items-center gap-2">
        <img
          src={url}
          alt=""
          className="w-12 h-12 rounded object-cover border border-gray-700"
        />
        <span className="text-xs text-gray-400 truncate flex-1">
          {url.split("/").pop()}
        </span>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-red-400"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Direct file upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          // Reset so the same file can be re-selected if needed
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="text-xs px-3 py-2 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-[#D73F09] hover:border-[#D73F09] transition-colors disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "+ Upload File"}
      </button>
      {/* Or pick from library */}
      <button
        onClick={onPick}
        disabled={uploading}
        className="text-xs px-3 py-2 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-[#D73F09] hover:border-[#D73F09] transition-colors disabled:opacity-50"
      >
        Media Library
      </button>
    </div>
  );
}
