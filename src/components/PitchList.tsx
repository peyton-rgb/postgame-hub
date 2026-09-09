"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { getDefaultPitchSections } from "@/lib/pitch/defaultTemplate";
import { VOICES, DEFAULT_VOICE_ID, type VoiceModule } from "@/lib/pitch/aiPrompts";
import type { PitchPage } from "@/types/pitch";
import Link from "next/link";

const VOICE_LIST = Object.values(VOICES);

interface Brand {
  id: string;
  name: string;
  logo_primary_url: string | null;
  logo_light_url: string | null;
}

interface UploadedFile {
  file: File;
  preview: string;
  error?: string;
}

type CreateTab = "blank" | "ai";
type PitchType = "athlete" | "brand";
type PitchFilter = "all" | "brand" | "athlete";

const PROGRESS_STEPS = [
  "Uploading assets...",
  "Analyzing brand history...",
  "Processing video frames...",
  "Generating with Claude...",
  "Almost there...",
];

const MAX_FILES = 10;
const MAX_VIDEO_DURATION_SEC = 30;
const MAX_VIDEO_SIZE_MB = 50;

export default function PitchList() {
  const [pitches, setPitches] = useState<PitchPage[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PitchPage | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // URL-driven filter state
  const searchParams = useSearchParams();
  const router = useRouter();
  // Current path (e.g. "/dashboard/pitches") so the All/Brand/Athlete
  // filter buttons stay on whatever page PitchList renders on.
  const pathname = usePathname();
  const pitchFilter = (searchParams.get("filter") as PitchFilter) || "all";

  // Shared form state
  const [createTab, setCreateTab] = useState<CreateTab>("blank");
  const [pitchType, setPitchType] = useState<PitchType>("athlete");
  // Athlete-pitch intake fields (only relevant when pitchType='athlete')
  const [athleteName, setAthleteName] = useState("");
  const [athleteNickname, setAthleteNickname] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");

  // Slug validation
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // AI tab state
  const [selectedVoiceId, setSelectedVoiceId] = useState(DEFAULT_VOICE_ID);
  const [aiPrompt, setAiPrompt] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadPitches();
    loadBrands();
  }, []);

  async function loadPitches() {
    const { data } = await supabase
      .from("pitch_pages")
      .select("*")
      .order("updated_at", { ascending: false });
    setPitches((data as PitchPage[]) || []);
    setLoading(false);
  }

  async function loadBrands() {
    const { data } = await supabase
      .from("brands")
      .select("id, name, logo_primary_url, logo_light_url")
      .order("name", { ascending: true });
    setBrands(data || []);
  }

  // ---- Filter helpers ----

  function setFilter(filter: PitchFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", filter);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Counts computed from the full unfiltered list
  const brandCount = pitches.filter((p) => p.brand_id !== null).length;
  const athleteCount = pitches.filter((p) => p.brand_id === null).length;

  // The rows actually shown in the table
  const filteredPitches = pitches.filter((p) => {
    if (pitchFilter === "brand") return p.brand_id !== null;
    if (pitchFilter === "athlete") return p.brand_id === null;
    return true; // "all"
  });

  // ---- Create modal helpers ----

  function openCreate() {
    setCreateTab("blank");
    setNewTitle("");
    setNewSlug("");
    setSlugError(null);
    setSlugManuallyEdited(false);
    setSelectedBrandId("");
    setSelectedVoiceId(DEFAULT_VOICE_ID);
    setAiPrompt("");
    setUploadedFiles([]);
    setGenError(null);
    setGenerating(false);
    setProgressStep(0);
    setShowCreate(true);
  }

  function slugify(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function handleTitleChange(title: string) {
    setNewTitle(title);
    if (!slugManuallyEdited) {
      setNewSlug(slugify(title));
      setSlugError(null);
    }
  }

  function handleSlugChange(slug: string) {
    setNewSlug(slug);
    setSlugManuallyEdited(true);
    setSlugError(null);
  }

  function handleBrandChange(brandId: string) {
    setSelectedBrandId(brandId);
    // Auto-fill title/slug from brand name if on AI tab and fields are empty
    if (createTab === "ai" && brandId) {
      const brand = brands.find((b) => b.id === brandId);
      if (brand) {
        if (!newTitle) setNewTitle(`Postgame × ${brand.name}`);
        if (!newSlug) setNewSlug(slugify(brand.name));
      }
    }
  }

  // ---- File validation ----

  function validateVideoFile(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        resolve(`${file.name}: exceeds ${MAX_VIDEO_SIZE_MB}MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        return;
      }
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > MAX_VIDEO_DURATION_SEC) {
          resolve(`${file.name}: exceeds ${MAX_VIDEO_DURATION_SEC}s limit (${Math.round(video.duration)}s)`);
        } else {
          resolve(null);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null); // Can't validate duration, allow it
      };
      video.src = URL.createObjectURL(file);
    });
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files) return;

    const fileArray = Array.from(files);
    const totalAfter = uploadedFiles.length + fileArray.length;
    if (totalAfter > MAX_FILES) {
      setGenError(`Max ${MAX_FILES} files. You have ${uploadedFiles.length}, tried to add ${fileArray.length}.`);
      return;
    }

    const newFiles: UploadedFile[] = [];
    for (const file of fileArray) {
      const isVideo = file.type.startsWith("video/");
      let error: string | undefined;

      if (isVideo) {
        const validationError = await validateVideoFile(file);
        if (validationError) error = validationError;
      }

      newFiles.push({
        file,
        preview: isVideo ? "" : URL.createObjectURL(file),
        error,
      });
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setGenError(null);
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }

  // ---- Slug collision check ----

  async function ensureSlugAvailable(slug: string): Promise<string | null> {
    const { data } = await supabase
      .from("pitch_pages")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug; // Available

    // Collision — if user manually typed it, block submission
    if (slugManuallyEdited) {
      setSlugError("This slug is already taken — try another");
      return null;
    }

    // Auto-generated slug collided — find a free suffix
    for (let i = 2; i <= 20; i++) {
      const candidate = `${slug}-${i}`;
      const { data: existing } = await supabase
        .from("pitch_pages")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (!existing) {
        setNewSlug(candidate);
        setSlugError(null);
        return candidate;
      }
    }

    setSlugError("Could not find an available slug — try a different name");
    return null;
  }

  // ---- Blank create ----

  async function createBlankPitch() {
    if (pitchType === "athlete" && !athleteName.trim()) return;
    if (!newTitle.trim() || !newSlug.trim()) return;
    setCreating(true);

    const finalSlug = await ensureSlugAvailable(newSlug);
    if (!finalSlug) {
      setCreating(false);
      return;
    }

    let contentJson: Record<string, unknown>;

    if (pitchType === "athlete") {
      // Copy sections from the new athlete template (stored in
      // pitch_templates.default — the Nau'Jour-style deck) and seed
      // the WhyYou section with the athlete name + nickname.
      const { data: tmpl } = await supabase
        .from("pitch_templates")
        .select("sections")
        .eq("name", "default")
        .single();

      const sections: any[] = Array.isArray(tmpl?.sections)
        ? [...(tmpl!.sections as any[])]
        : getDefaultPitchSections();

      // Seed the welcome heading (cta heading-mode at index 0) with
      // the athlete's first name.
      const firstName = athleteName.trim().split(/\s+/)[0] ?? "";
      if (sections[0]?.type === "cta" && sections[0]?.mode === "heading") {
        sections[0] = {
          ...sections[0],
          heading: `Welcome to Postgame, <em>${firstName}</em>.`,
        };
      }
      // Seed the whyYou section (typically index 1) with athlete data.
      const whyYouIdx = sections.findIndex(
        (s: any) => s?.type === "whyYou",
      );
      if (whyYouIdx >= 0) {
        sections[whyYouIdx] = {
          ...sections[whyYouIdx],
          athleteName: athleteName.trim(),
          nickname: athleteNickname.trim() || undefined,
        };
      }
      // Seed the closing footer's "Built for X" and welcome.
      const ctaFooterIdx = sections.findIndex(
        (s: any) => s?.type === "cta" && s?.mode === "footer",
      );
      if (ctaFooterIdx >= 0) {
        sections[ctaFooterIdx] = {
          ...sections[ctaFooterIdx],
          footerMeta: `Built for ${athleteName.trim()}`,
        };
      }

      contentJson = {
        pitchType,
        athleteName: athleteName.trim(),
        athleteFirstName: firstName,
        nickname: athleteNickname.trim() || undefined,
        sections,
      };
    } else {
      // Brand pitch — legacy section-based template for now (until
      // we build the brand-specific template that mirrors the Crocs
      // HTML layout).
      contentJson = {
        pitchType,
        sections: getDefaultPitchSections(),
      };
    }

    const { data, error } = await supabase
      .from("pitch_pages")
      .insert({
        title: newTitle,
        slug: finalSlug,
        brand_id: pitchType === "brand" ? selectedBrandId || null : null,
        status: "draft",
        content: contentJson,
      })
      .select()
      .single();

    if (data && !error) {
      window.location.href = `/dashboard/pitches/${data.id}`;
    }
    setCreating(false);
  }

  // ---- AI generate ----

  async function generatePitch() {
    if (!selectedBrandId) return;

    // Check for file errors
    const hasErrors = uploadedFiles.some((f) => f.error);
    if (hasErrors) {
      setGenError("Fix file errors before generating.");
      return;
    }

    setGenerating(true);
    setGenError(null);
    setProgressStep(0);

    try {
      // Derive title/slug if not set
      const brand = brands.find((b) => b.id === selectedBrandId);
      const finalTitle = newTitle || `Postgame × ${brand?.name || "Brand"}`;
      const derivedSlug = newSlug || slugify(brand?.name || "pitch");

      // Check slug availability before doing any expensive work
      const finalSlug = await ensureSlugAvailable(derivedSlug);
      if (!finalSlug) {
        setGenerating(false);
        return;
      }

      // Step 0: Upload assets
      const tempId = crypto.randomUUID();
      const uploadedAssets: { path: string; mimeType: string; originalName: string }[] = [];

      if (uploadedFiles.length > 0) {
        for (const uf of uploadedFiles) {
          const path = `pitch-uploads/${tempId}/${uf.file.name}`;
          const { error } = await supabase.storage
            .from("campaign-media")
            .upload(path, uf.file);
          if (error) throw new Error(`Upload failed for ${uf.file.name}: ${error.message}`);
          uploadedAssets.push({
            path,
            mimeType: uf.file.type,
            originalName: uf.file.name,
          });
        }
      }

      // Step 1: Analyzing brand
      setProgressStep(1);

      // Step 2: Processing video
      setProgressStep(2);

      // Step 3: Generating
      setProgressStep(3);

      const res = await fetch("/api/pitches/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: selectedBrandId,
          title: finalTitle,
          slug: finalSlug,
          voiceId: selectedVoiceId,
          userPrompt: aiPrompt,
          uploadedAssets,
          pitchType, // forwarded for the API to branch on
        }),
      });

      setProgressStep(4);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const { pitchId } = await res.json();
      window.location.href = `/dashboard/pitches/${pitchId}`;
    } catch (err: any) {
      setGenError(err.message || "Something went wrong. Try again.");
      setGenerating(false);
    }
  }

  // ---- Delete ----

  async function deletePitch(pitch: PitchPage) {
    setDeleting(pitch.id);
    const { error } = await supabase
      .from("pitch_pages")
      .delete()
      .eq("id", pitch.id);
    if (!error) {
      setPitches((prev) => prev.filter((p) => p.id !== pitch.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  function getBrandForPitch(pitch: PitchPage): Brand | undefined {
    return brands.find((b) => b.id === pitch.brand_id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-4 text-sm">
        Loading pitch pages...
      </div>
    );
  }

  const tabClass = (tab: CreateTab) =>
    `flex-1 text-center py-2.5 text-sm font-bold rounded-lg transition-colors ${
      createTab === tab
        ? "bg-surface-raised text-ink-1"
        : "text-ink-4 hover:text-ink-3"
    }`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-black text-ink-1">Pitch Pages</h2>
          <p className="text-sm text-ink-4 mt-1">
            {filteredPitches.length === pitches.length
              ? `${pitches.length} pitch${pitches.length !== 1 ? "es" : ""}`
              : `${filteredPitches.length} of ${pitches.length} pitches`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-ink-1 text-sm font-bold rounded-lg hover:bg-[var(--accent)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Pitch
        </button>
      </div>

      {/* Filter tabs — All / Brand / Athlete */}
      <div className="flex gap-0 mb-6 border-b border-hairline">
        {(
          [
            { key: "all" as PitchFilter, label: "All", count: pitches.length },
            { key: "brand" as PitchFilter, label: "Brand", count: brandCount },
            { key: "athlete" as PitchFilter, label: "Athlete", count: athleteCount },
          ] as const
        ).map(({ key, label, count }) => {
          const isActive = pitchFilter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-5 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px ${
                isActive
                  ? "text-[var(--accent)] border-[var(--accent)]"
                  : "text-ink-4 border-transparent hover:text-ink-3 hover:border-ink-4"
              }`}
            >
              {label}{" "}
              <span
                className={`text-xs ml-0.5 ${
                  isActive ? "text-[var(--accent)]/70" : "text-ink-4"
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filteredPitches.length === 0 ? (
        <div className="text-center py-20 text-ink-4">
          <div className="text-4xl mb-4">&#9670;</div>
          <div className="text-sm">
            {pitches.length === 0
              ? "No pitch pages yet. Create your first one."
              : `No ${pitchFilter} pitches found.`}
          </div>
        </div>
      ) : (
        <div className="border border-hairline rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-card/[0.02]">
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-4">Title</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-4">Brand</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-4">Slug</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-4">Status</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-4">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredPitches.map((pitch) => {
                const brand = getBrandForPitch(pitch);
                return (
                  <tr key={pitch.id} className="border-b border-hairline/50 hover:bg-surface-card/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/pitches/${pitch.id}`} className="font-bold text-ink-1 hover:text-[var(--accent)] transition-colors">
                        {pitch.title || "Untitled"}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      {brand ? (
                        <div className="flex items-center gap-2">
                          {(brand.logo_primary_url || brand.logo_light_url) && (
                            <img src={brand.logo_light_url || brand.logo_primary_url || ""} alt="" className="w-5 h-5 object-contain rounded" />
                          )}
                          <span className="text-ink-3">{brand.name}</span>
                        </div>
                      ) : (
                        <span className="text-ink-4">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-xs text-ink-3 bg-surface-card px-2 py-1 rounded">/pitch/{pitch.slug}</code>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${pitch.status === "published" ? "bg-surface-raised/10 text-ink-3" : "bg-surface-raised/10 text-ink-3"}`}>
                        {pitch.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-4 text-xs">
                      {new Date(pitch.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Link href={`/pitch/${pitch.slug}`} target="_blank" className="text-xs px-3 py-1.5 border border-hairline rounded-lg text-ink-3 hover:text-ink-1 hover:border-ink-4 transition-colors">
                          View
                        </Link>
                        <button onClick={() => setConfirmDelete(pitch)} className="text-xs px-3 py-1.5 border border-hairline rounded-lg text-ink-4 hover:text-accent hover:border-accent/30 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-ground/70 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => !generating && setShowCreate(false)}
        >
          <div
            className="bg-surface-card border border-hairline rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress overlay */}
            {generating && (
              <div className="absolute inset-0 bg-surface-card/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl">
                <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-6" />
                <div className="text-sm font-bold text-ink-1 mb-2">{PROGRESS_STEPS[progressStep]}</div>
                <div className="flex gap-1.5 mt-3">
                  {PROGRESS_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i <= progressStep ? "bg-[var(--accent)]" : "bg-surface-raised"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="p-8">
              <h3 className="text-lg font-black text-ink-1 mb-5">
                New {pitchType === "brand" ? "Brand" : "Athlete"} Pitch
              </h3>

              {/* Pitch type selector — athlete vs brand. Saved in
                  content.pitchType for downstream branching. */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setPitchType("athlete")}
                  className={`px-4 py-3 rounded-xl border text-left transition-colors ${
                    pitchType === "athlete"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-hairline bg-ground hover:border-hairline"
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                    Athlete
                  </div>
                  <div className="text-xs text-ink-3 mt-1">
                    Pitching an athlete to sign with Postgame
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPitchType("brand")}
                  className={`px-4 py-3 rounded-xl border text-left transition-colors ${
                    pitchType === "brand"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-hairline bg-ground hover:border-hairline"
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                    Brand
                  </div>
                  <div className="text-xs text-ink-3 mt-1">
                    Pitching a brand on a campaign concept
                  </div>
                </button>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 bg-surface-card rounded-lg p-1 mb-6">
                <button onClick={() => setCreateTab("blank")} className={tabClass("blank")}>
                  Blank
                </button>
                <button onClick={() => setCreateTab("ai")} className={tabClass("ai")}>
                  Generate with AI
                </button>
              </div>

              {/* When pitching an athlete: collect athlete intake fields.
                  When pitching a brand: keep the brand dropdown. */}
              <div className="space-y-5">
                {pitchType === "athlete" ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
                        Athlete Name <span className="text-[var(--accent)]">*</span>
                      </label>
                      <input
                        type="text"
                        value={athleteName}
                        onChange={(e) => setAthleteName(e.target.value)}
                        placeholder="e.g. Nau'Jour Grainger"
                        className="w-full px-4 py-3 bg-ground border border-hairline rounded-xl text-ink-1 text-sm focus:border-[var(--accent)] outline-none placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
                        Nickname <span className="text-ink-4 normal-case font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={athleteNickname}
                        onChange={(e) => setAthleteNickname(e.target.value)}
                        placeholder="e.g. Toosii"
                        className="w-full px-4 py-3 bg-ground border border-hairline rounded-xl text-ink-1 text-sm focus:border-[var(--accent)] outline-none placeholder-gray-600"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
                      Brand {createTab === "ai" && <span className="text-[var(--accent)]">*</span>}
                    </label>
                    <select
                      value={selectedBrandId}
                      onChange={(e) => handleBrandChange(e.target.value)}
                      className="w-full px-4 py-3 bg-ground border border-hairline rounded-xl text-ink-1 text-sm focus:border-[var(--accent)] outline-none"
                    >
                      <option value="">{createTab === "ai" ? "Select brand (required)" : "Select brand (optional)"}</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Shared: Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
                    Title {createTab === "blank" && <span className="text-[var(--accent)]">*</span>}
                    {createTab === "ai" && <span className="text-ink-4 normal-case font-normal"> (auto from brand if blank)</span>}
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder={createTab === "ai" ? "Auto-generated from brand" : "e.g. Postgame x Crocs"}
                    className="w-full px-4 py-3 bg-ground border border-hairline rounded-xl text-ink-1 text-sm focus:border-[var(--accent)] outline-none placeholder-gray-600"
                  />
                </div>

                {/* Shared: Slug */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
                    Slug {createTab === "blank" && <span className="text-[var(--accent)]">*</span>}
                    {createTab === "ai" && <span className="text-ink-4 normal-case font-normal"> (auto from brand if blank)</span>}
                  </label>
                  <div className="flex items-center">
                    <span className={`text-xs text-ink-4 bg-ground border border-r-0 rounded-l-xl px-3 py-3 ${slugError ? "border-accent/50" : "border-hairline"}`}>/pitch/</span>
                    <input
                      type="text"
                      value={newSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder={createTab === "ai" ? "auto" : "crocs"}
                      className={`flex-1 px-4 py-3 bg-ground border rounded-r-xl text-ink-1 text-sm outline-none placeholder-gray-600 ${slugError ? "border-accent/50 focus:border-accent" : "border-hairline focus:border-[var(--accent)]"}`}
                    />
                  </div>
                  {slugError && (
                    <div className="text-xs text-accent mt-1.5">{slugError}</div>
                  )}
                </div>

                {/* AI-only fields */}
                {createTab === "ai" && (
                  <>
                    {/* Voice selector */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
                        Voice
                      </label>
                      <div className="space-y-2">
                        {VOICE_LIST.map((voice) => (
                          <label
                            key={voice.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              !voice.ready
                                ? "opacity-40 cursor-not-allowed border-hairline"
                                : selectedVoiceId === voice.id
                                ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                                : "border-hairline hover:border-ink-4"
                            }`}
                          >
                            <input
                              type="radio"
                              name="voice"
                              value={voice.id}
                              checked={selectedVoiceId === voice.id}
                              disabled={!voice.ready}
                              onChange={() => setSelectedVoiceId(voice.id)}
                              className="mt-0.5 accent-[var(--accent)]"
                            />
                            <div>
                              <div className="text-sm font-bold text-ink-1">{voice.name}</div>
                              <div className="text-xs text-ink-3 mt-0.5">{voice.tagline}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Prompt */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
                        Prompt
                      </label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={6}
                        placeholder="What's the angle? Who's the audience? What should this pitch lean into?"
                        className="w-full px-4 py-3 bg-ground border border-hairline rounded-xl text-ink-1 text-sm focus:border-[var(--accent)] outline-none placeholder-gray-600 resize-none"
                      />
                    </div>

                    {/* File upload */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
                        Assets <span className="text-ink-4 normal-case font-normal">(photos &amp; videos, max {MAX_FILES})</span>
                      </label>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />

                      {/* Drop zone */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[var(--accent)]"); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove("border-[var(--accent)]"); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove("border-[var(--accent)]");
                          handleFileSelect(e.dataTransfer.files);
                        }}
                        className="border-2 border-dashed border-hairline rounded-xl p-6 text-center cursor-pointer hover:border-ink-4 transition-colors"
                      >
                        <div className="text-ink-4 text-sm">
                          Drop files here or <span className="text-[var(--accent)] font-bold">browse</span>
                        </div>
                        <div className="text-ink-4 text-xs mt-1">
                          Videos: max {MAX_VIDEO_DURATION_SEC}s, {MAX_VIDEO_SIZE_MB}MB each
                        </div>
                      </div>

                      {/* File list */}
                      {uploadedFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {uploadedFiles.map((uf, i) => (
                            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${uf.error ? "bg-accent/10 border border-accent/20" : "bg-surface-card"}`}>
                              {uf.preview ? (
                                <img src={uf.preview} alt="" className="w-8 h-8 rounded object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-surface-raised flex items-center justify-center text-xs text-ink-3">
                                  {uf.file.type.startsWith("video/") ? "VID" : "IMG"}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-ink-3 truncate">{uf.file.name}</div>
                                {uf.error && (
                                  <div className="text-xs text-accent mt-0.5">{uf.error}</div>
                                )}
                                <div className="text-xs text-ink-4">{(uf.file.size / 1024 / 1024).toFixed(1)}MB</div>
                              </div>
                              <button onClick={() => removeFile(i)} className="text-ink-4 hover:text-accent text-sm flex-shrink-0">&times;</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Error display */}
                {genError && (
                  <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-3 text-sm text-accent">
                    {genError}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowCreate(false)}
                  disabled={generating}
                  className="flex-1 px-4 py-3 border border-hairline rounded-xl text-ink-3 text-sm font-bold hover:text-ink-1 hover:border-ink-4 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>

                {createTab === "blank" ? (
                  <button
                    onClick={createBlankPitch}
                    disabled={
                      !newTitle.trim() ||
                      !newSlug.trim() ||
                      (pitchType === "athlete" && !athleteName.trim()) ||
                      creating
                    }
                    className="flex-1 px-4 py-3 bg-[var(--accent)] rounded-xl text-ink-1 text-sm font-bold hover:bg-[var(--accent)] disabled:opacity-40 transition-colors"
                  >
                    {creating ? "Creating..." : "Create Pitch"}
                  </button>
                ) : (
                  <button
                    onClick={generatePitch}
                    disabled={!selectedBrandId || generating || uploadedFiles.some((f) => f.error)}
                    className="flex-1 px-4 py-3 bg-[var(--accent)] rounded-xl text-ink-1 text-sm font-bold hover:bg-[var(--accent)] disabled:opacity-40 transition-colors"
                  >
                    {generating ? "Generating..." : "Generate Pitch"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-ground/70 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-surface-card border border-hairline rounded-2xl p-8 w-full max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-ink-1 mb-3">Delete Pitch?</h3>
            <p className="text-sm text-ink-3 mb-6">
              &ldquo;{confirmDelete.title || "Untitled"}&rdquo; will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-3 border border-hairline rounded-xl text-ink-3 text-sm font-bold hover:text-ink-1 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePitch(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-accent rounded-xl text-ink-1 text-sm font-bold hover:bg-accent disabled:opacity-40 transition-colors"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
