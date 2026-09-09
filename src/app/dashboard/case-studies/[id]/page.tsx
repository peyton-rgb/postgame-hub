"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { CaseStudy } from "@/lib/types";
import Link from "next/link";

export default function CaseStudyEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [study, setStudy] = useState<CaseStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createBrowserSupabase();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [heroStat, setHeroStat] = useState("");
  const [heroStatLabel, setHeroStatLabel] = useState("");
  const [overview, setOverview] = useState("");
  const [challenge, setChallenge] = useState("");
  const [solution, setSolution] = useState("");
  const [results, setResults] = useState("");
  const [highlights, setHighlights] = useState<string[]>([""]);
  const [imageUrl, setImageUrl] = useState("");
  const [featured, setFeatured] = useState(false);

  useEffect(() => {
    loadStudy();
  }, [id]);

  async function loadStudy() {
    const { data } = await supabase.from("case_studies").select("*").eq("id", id).single();
    if (data) {
      setStudy(data);
      setTitle(data.title || "");
      setSlug(data.slug || "");
      setBrandName(data.brand_name || "");
      setCategory(data.category || "");
      setHeroStat(data.hero_stat || "");
      setHeroStatLabel(data.hero_stat_label || "");
      setOverview(data.overview || "");
      setChallenge(data.challenge || "");
      setSolution(data.solution || "");
      setResults(data.results || "");
      setHighlights(data.highlights?.length ? data.highlights : [""]);
      setImageUrl(data.image_url || "");
      setFeatured(data.featured);
    }
    setLoading(false);
  }

  async function saveStudy(publish?: boolean) {
    if (!study) return;
    setSaving(true);
    const cleanHighlights = highlights.filter((h) => h.trim());
    const updates: Record<string, unknown> = {
      title,
      slug,
      brand_name: brandName,
      category: category || null,
      hero_stat: heroStat || null,
      hero_stat_label: heroStatLabel || null,
      overview: overview || null,
      challenge: challenge || null,
      solution: solution || null,
      results: results || null,
      highlights: cleanHighlights,
      image_url: imageUrl || null,
      featured,
      updated_at: new Date().toISOString(),
    };
    if (publish !== undefined) updates.published = publish;

    const { data } = await supabase
      .from("case_studies")
      .update(updates)
      .eq("id", study.id)
      .select()
      .single();
    if (data) {
      setStudy(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  function updateHighlight(index: number, value: string) {
    const updated = [...highlights];
    updated[index] = value;
    setHighlights(updated);
  }

  function addHighlight() {
    setHighlights([...highlights, ""]);
  }

  function removeHighlight(index: number) {
    if (highlights.length <= 1) return;
    setHighlights(highlights.filter((_, i) => i !== index));
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }
  if (!study) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Case study not found.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-gray-800 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/dashboard?tab=case-studies" className="text-xs text-gray-500 hover:text-gray-300 mb-1 block">
            ← Back to Case Studies
          </Link>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mt-1">
            {study.brand_name}
          </div>
          <h1 className="text-lg font-black">{study.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {study.published && (
            <Link href={`/case-studies/${study.slug}`} target="_blank" className="text-xs text-[#D73F09] hover:underline">
              View Live →
            </Link>
          )}
          <button
            onClick={() => saveStudy()}
            disabled={saving}
            className="px-4 py-2 border border-gray-700 text-gray-400 text-sm font-bold rounded-lg hover:border-[#D73F09] hover:text-[#D73F09] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save Draft"}
          </button>
          <button
            onClick={() => saveStudy(!study.published)}
            disabled={saving}
            className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50"
          >
            {study.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Brand Name</label>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. NIL, Social Media" className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Hero Stat</label>
            <input value={heroStat} onChange={(e) => setHeroStat(e.target.value)} placeholder="e.g. 2.5M+" className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Hero Stat Label</label>
            <input value={heroStatLabel} onChange={(e) => setHeroStatLabel(e.target.value)} placeholder="e.g. Total Impressions" className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Overview</label>
          <textarea value={overview} onChange={(e) => setOverview(e.target.value)} rows={4} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y" />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Challenge</label>
          <textarea value={challenge} onChange={(e) => setChallenge(e.target.value)} rows={4} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y" />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Solution</label>
          <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={4} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y" />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Results</label>
          <textarea value={results} onChange={(e) => setResults(e.target.value)} rows={4} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y" />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Highlights</label>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={h}
                  onChange={(e) => updateHighlight(i, e.target.value)}
                  placeholder={`Highlight ${i + 1}`}
                  className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
                <button
                  onClick={() => removeHighlight(i)}
                  className="px-3 text-gray-600 hover:text-status-bad transition-colors"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addHighlight}
            className="mt-2 text-xs text-[#D73F09] font-bold hover:underline"
          >
            + Add Highlight
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Image URL</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-5 h-5 rounded border-gray-700 bg-black text-[#D73F09] focus:ring-[#D73F09]" />
            <span className="text-sm font-bold text-gray-400">Featured Case Study</span>
          </label>
        </div>
      </div>
    </div>
  );
}
