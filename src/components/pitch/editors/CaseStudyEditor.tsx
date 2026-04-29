"use client";

import { useRef, useState } from "react";
import type {
  CaseStudySectionData,
  CaseStudyAthleteTag,
} from "@/types/pitch";
import CampaignMediaPicker from "@/components/CampaignMediaPicker";
import { createBrowserSupabase } from "@/lib/supabase";

interface Props {
  data: CaseStudySectionData;
  onChange: (data: CaseStudySectionData) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

/**
 * Dashboard editor for the caseStudy section.
 *
 * The hero image can be (a) typed in as a URL, (b) uploaded
 * directly, or (c) picked from the media library — same pattern as
 * the WhyYou photo slots. The athlete tags are a simple add/remove
 * list of {athleteName, team} pairs.
 */
export default function CaseStudyEditor({ data, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supabase = createBrowserSupabase();

  const patch = (p: Partial<CaseStudySectionData>) =>
    onChange({ ...data, ...p });

  async function uploadHero(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const random = crypto.randomUUID();
      const path = `pitch-uploads/${random}/case-study-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("campaign-media")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from("campaign-media")
        .getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("No public URL returned");
      patch({ heroImageUrl: pub.publicUrl });
    } catch (err: any) {
      setUploadError(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function updateAthlete(
    i: number,
    field: keyof CaseStudyAthleteTag,
    value: string,
  ) {
    const arr = [...(data.athletes ?? [])];
    arr[i] = { ...arr[i], [field]: value } as CaseStudyAthleteTag;
    patch({ athletes: arr });
  }
  function addAthlete() {
    patch({
      athletes: [...(data.athletes ?? []), { athleteName: "", team: "" }],
    });
  }
  function removeAthlete(i: number) {
    patch({
      athletes: (data.athletes ?? []).filter((_, idx) => idx !== i),
    });
  }

  return (
    <div className="space-y-4">
      {/* COPY */}
      <Field label="Section Label">
        <input
          value={data.sectionLabel ?? ""}
          onChange={(e) =>
            patch({ sectionLabel: e.target.value || undefined })
          }
          placeholder="CASE STUDY"
          className={inputClass}
        />
      </Field>
      <Field label="Kicker (small line above heading)">
        <input
          value={data.kicker ?? ""}
          onChange={(e) => patch({ kicker: e.target.value || undefined })}
          placeholder="BUILT FOR APPAREL ATHLETES"
          className={inputClass}
        />
      </Field>
      <Field label="Heading (use <em>word</em> for orange highlight)" required>
        <input
          value={data.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value })}
          placeholder="We co-designed Hollister's biggest <em>NIL apparel</em> campaign — ever."
          className={inputClass}
        />
      </Field>
      <Field label="Description Paragraph">
        <textarea
          value={data.paragraph ?? ""}
          onChange={(e) => patch({ paragraph: e.target.value || undefined })}
          rows={4}
          placeholder="Short campaign description"
          className={`${inputClass} resize-y`}
        />
      </Field>

      {/* HERO IMAGE */}
      <Field label="Hero Image">
        {data.heroImageUrl ? (
          <div className="flex items-center gap-2">
            <img
              src={data.heroImageUrl}
              alt=""
              className="w-24 h-12 rounded object-cover border border-gray-700"
            />
            <span className="text-xs text-gray-400 truncate flex-1">
              {data.heroImageUrl}
            </span>
            <button
              onClick={() => patch({ heroImageUrl: "" })}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              &times;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadHero(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-2 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-[#D73F09] hover:border-[#D73F09] transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "+ Upload File"}
            </button>
            <button
              onClick={() => setPicking(true)}
              disabled={uploading}
              className="text-xs px-3 py-2 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-[#D73F09] hover:border-[#D73F09] transition-colors disabled:opacity-50"
            >
              Media Library
            </button>
          </div>
        )}
        {uploadError ? (
          <div className="mt-2 text-xs text-red-400">{uploadError}</div>
        ) : null}
      </Field>
      <Field label="Hero Image Alt Text">
        <input
          value={data.heroImageAlt ?? ""}
          onChange={(e) =>
            patch({ heroImageAlt: e.target.value || undefined })
          }
          placeholder="Describe the image for screen readers"
          className={inputClass}
        />
      </Field>

      {/* ATHLETE TAGS */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Athlete Tags ({data.athletes?.length ?? 0})
        </label>
        {(data.athletes ?? []).map((a, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2 items-center"
          >
            <input
              value={a.athleteName}
              onChange={(e) => updateAthlete(i, "athleteName", e.target.value)}
              placeholder="Athlete name"
              className={inputClass}
            />
            <input
              value={a.team}
              onChange={(e) => updateAthlete(i, "team", e.target.value)}
              placeholder="Team / school"
              className={inputClass}
            />
            <button
              onClick={() => removeAthlete(i)}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          onClick={addAthlete}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add athlete
        </button>
      </div>

      {/* OUTBOUND LINK */}
      <Field label="Article / Recap Link (optional)">
        <input
          value={data.linkUrl ?? ""}
          onChange={(e) => patch({ linkUrl: e.target.value || undefined })}
          placeholder="https://www.glossy.co/..."
          className={inputClass}
        />
      </Field>
      <Field label="Link Label">
        <input
          value={data.linkLabel ?? ""}
          onChange={(e) => patch({ linkLabel: e.target.value || undefined })}
          placeholder="Featured in Glossy"
          className={inputClass}
        />
      </Field>

      {picking && (
        <CampaignMediaPicker
          open={true}
          onClose={() => setPicking(false)}
          onSelect={(result) => {
            patch({ heroImageUrl: result.url });
            setPicking(false);
          }}
        />
      )}
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
