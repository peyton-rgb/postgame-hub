"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { PressArticle } from "@/lib/types";
import Link from "next/link";

const CATEGORIES = ["Campaign", "Industry", "Award", "Draft", "Creative", "Milestone", "Experiential"];

export default function PressEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<PressArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserSupabase();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [publication, setPublication] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [featured, setFeatured] = useState(false);
  const [archived, setArchived] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    loadArticle();
  }, [id]);

  async function loadArticle() {
    const { data } = await supabase.from("press_articles").select("*").eq("id", id).single();
    if (data) {
      setArticle(data);
      setTitle(data.title || "");
      setSlug(data.slug || "");
      setPublication(data.publication || "");
      setAuthor(data.author || "");
      setCategory(data.category || "");
      setExcerpt(data.excerpt || "");
      setContent(data.content || "");
      setExternalUrl(data.external_url || "");
      setImageUrl(data.image_url || "");
      setPublishedDate(data.published_date || "");
      setFeatured(data.featured);
      setArchived(data.archived ?? false);
      setShowLogo(data.show_logo ?? false);
    }
    setLoading(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !article) return;

    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `press/${article.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("press-media").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (!error) {
      const { data: urlData } = supabase.storage.from("press-media").getPublicUrl(filePath);
      if (urlData?.publicUrl) {
        setImageUrl(urlData.publicUrl);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveArticle(publish?: boolean) {
    if (!article) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      title,
      slug,
      publication: publication || null,
      author: author || null,
      category: category || null,
      excerpt: excerpt || null,
      content: content || null,
      external_url: externalUrl || null,
      image_url: imageUrl || null,
      published_date: publishedDate || null,
      featured,
      archived,
      show_logo: showLogo,
      updated_at: new Date().toISOString(),
    };
    if (publish !== undefined) updates.published = publish;

    const { data } = await supabase
      .from("press_articles")
      .update(updates)
      .eq("id", article.id)
      .select()
      .single();
    if (data) {
      setArticle(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }
  if (!article) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Article not found.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-gray-800 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/dashboard?tab=press" className="text-xs text-gray-500 hover:text-gray-300 mb-1 block">
            ← Back to Press
          </Link>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mt-1">
            {article.publication || "Press Article"}
          </div>
          <h1 className="text-lg font-black">{article.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {archived && (
            <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-900/30 text-yellow-400">
              Archived
            </span>
          )}
          {article.published && (
            <Link href={`/press`} target="_blank" className="text-xs text-[#D73F09] hover:underline">
              View Live →
            </Link>
          )}
          <button
            onClick={() => saveArticle()}
            disabled={saving}
            className="px-4 py-2 border border-gray-700 text-gray-400 text-sm font-bold rounded-lg hover:border-[#D73F09] hover:text-[#D73F09] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save Draft"}
          </button>
          <button
            onClick={() => saveArticle(!article.published)}
            disabled={saving}
            className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50"
          >
            {article.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Article Image</label>
          <div className="space-y-3">
            {imageUrl && (
              <div className="relative rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
                <img src={imageUrl} alt="Article preview" className="w-full h-auto max-h-64 object-contain" />
                {showLogo && (
                  <img
                    src="/postgame-logo-white.png"
                    alt="Postgame"
                    className="absolute bottom-3 left-3 h-5 object-contain drop-shadow-lg"
                  />
                )}
                <button
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600/80 transition-colors"
                  title="Remove image"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm font-bold text-gray-300 hover:border-[#D73F09] hover:text-[#D73F09] transition-colors disabled:opacity-50"
              >
                {uploading ? "Uploading..." : imageUrl ? "Replace Image" : "Upload Image"}
              </button>
              <span className="text-xs text-gray-600 self-center">or</span>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="flex-1 px-4 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Publication</label>
            <input value={publication} onChange={(e) => setPublication(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Author</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none appearance-none">
              <option value="">Select category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Excerpt</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y" />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">External URL</label>
            <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Published Date</label>
            <input type="date" value={publishedDate} onChange={(e) => setPublishedDate(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
        </div>

        <div className="border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Article Options</h3>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-5 h-5 rounded border-gray-700 bg-black text-[#D73F09] focus:ring-[#D73F09]" />
              <div>
                <span className="text-sm font-bold text-gray-300">Featured Article</span>
                <p className="text-xs text-gray-600">Pin this article as featured (legacy)</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} className="w-5 h-5 rounded border-gray-700 bg-black text-[#D73F09] focus:ring-[#D73F09]" />
              <div>
                <span className="text-sm font-bold text-gray-300">Show Brand Logo</span>
                <p className="text-xs text-gray-600">Display Postgame logo in the lower-left corner of the image</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="w-5 h-5 rounded border-gray-700 bg-black text-[#D73F09] focus:ring-[#D73F09]" />
              <div>
                <span className="text-sm font-bold text-yellow-400">Archive Article</span>
                <p className="text-xs text-gray-600">Hide from the public press page without deleting</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
