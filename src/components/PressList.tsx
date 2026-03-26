"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { PressArticle } from "@/lib/types";
import Link from "next/link";
import ViewToggle, { type ViewMode } from "./ViewToggle";

export default function PressList() {
  const [articles, setArticles] = useState<PressArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPublication, setNewPublication] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PressArticle | null>(null);
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    const { data } = await supabase
      .from("press_articles")
      .select("*")
      .order("created_at", { ascending: false });
    setArticles(data || []);
    setLoading(false);
  }

  async function createArticle() {
    if (!newTitle.trim()) return;
    const slug =
      newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

    const { data } = await supabase
      .from("press_articles")
      .insert({
        title: newTitle,
        slug,
        publication: newPublication || null,
        featured: false,
        published: false,
        sort_order: 0,
        archived: false,
        show_logo: false,
      })
      .select()
      .single();

    if (data) {
      setArticles([data, ...articles]);
      setShowCreate(false);
      setNewTitle("");
      setNewPublication("");
    }
  }

  async function toggleArchive(article: PressArticle, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const newArchived = !article.archived;
    const { data } = await supabase
      .from("press_articles")
      .update({ archived: newArchived, updated_at: new Date().toISOString() })
      .eq("id", article.id)
      .select()
      .single();
    if (data) {
      setArticles((prev) => prev.map((a) => (a.id === data.id ? data : a)));
    }
  }

  async function deleteArticle(article: PressArticle) {
    setDeleting(article.id);
    const { error } = await supabase.from("press_articles").delete().eq("id", article.id);
    if (!error) {
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  const filtered = articles.filter((a) =>
    filter === "archived" ? a.archived : !a.archived
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
        <ViewToggle mode={viewMode} onChange={setViewMode} />
        <div className="flex gap-1 bg-[#111] border border-gray-800 rounded-lg p-1">
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
              filter === "active"
                ? "bg-[#D73F09] text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter("archived")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
              filter === "archived"
                ? "bg-yellow-600 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Archived
          </button>
        </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407]"
        >
          + New Article
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Article</h2>
            <p className="text-sm text-gray-400 mb-1">
              Are you sure you want to delete{" "}
              <span className="text-white font-bold">{confirmDelete.title}</span>?
            </p>
            <p className="text-xs text-red-400/70 mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteArticle(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete Article"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-6">New Press Article</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Article Title
            </label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Postgame Secures Series A Funding"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-4 focus:border-[#D73F09] outline-none"
            />
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Publication
            </label>
            <input
              value={newPublication}
              onChange={(e) => setNewPublication(e.target.value)}
              placeholder="e.g. Forbes"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-6 focus:border-[#D73F09] outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={createArticle}
                className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407]"
              >
                Create Article
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">
            {filter === "archived" ? "No archived articles." : "No press articles yet."}
          </p>
          {filter === "active" && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-[#D73F09] font-bold text-sm hover:underline"
            >
              Create your first article →
            </button>
          )}
        </div>
      ) : (
        viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((article) => (
              <div
                key={article.id}
                className={`relative p-6 bg-[#111] border rounded-xl hover:border-gray-600 transition-colors group ${
                  article.archived ? "border-yellow-900/40" : "border-gray-800"
                }`}
              >
                <Link
                  href={`/dashboard/press/${article.id}`}
                  className="absolute inset-0 z-0"
                />
                {article.image_url && (
                  <div className="relative rounded-lg overflow-hidden bg-gray-900 mb-3 h-32">
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                    {article.show_logo && (
                      <div className={`absolute bottom-1.5 ${article.logo_position === "bottom-right" ? "right-1.5" : "left-1.5"} flex items-center gap-1 drop-shadow-lg`}>
                        <img src="/postgame-logo-white.png" alt="" className="h-3 object-contain" />
                        {article.brand_logo_url && (
                          <>
                            <span className="text-white/60 text-[8px] font-bold">×</span>
                            <img src={article.brand_logo_url} alt="" className="h-3 object-contain" />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    {article.publication || "No publication"}
                  </span>
                  <div className="flex items-center gap-2">
                    {article.archived && (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-900/30 text-yellow-400">
                        Archived
                      </span>
                    )}
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        article.published
                          ? "bg-green-900/30 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {article.published ? "Published" : "Draft"}
                    </span>
                    <button
                      onClick={(e) => toggleArchive(article, e)}
                      className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-yellow-400 hover:bg-yellow-400/10 opacity-0 group-hover:opacity-100 transition-all"
                      title={article.archived ? "Unarchive" : "Archive"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="21 8 21 21 3 21 3 8" />
                        <rect x="1" y="3" width="22" height="5" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDelete(article);
                      }}
                      className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete article"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-black mb-1">{article.title}</h3>
                {article.category && (
                  <p className="text-sm text-gray-400">{article.category}</p>
                )}
                <p className="text-xs text-gray-600 mt-2">
                  {new Date(article.created_at).toLocaleDateString()}
                  {article.published && (
                    <span className="ml-2 text-[#D73F09]">/press/{article.slug}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((article) => (
              <div
                key={article.id}
                className={`relative flex items-center gap-4 px-5 py-4 bg-[#111] border rounded-lg hover:border-gray-600 transition-colors group ${
                  article.archived ? "border-yellow-900/40" : "border-gray-800"
                }`}
              >
                <Link href={`/dashboard/press/${article.id}`} className="absolute inset-0 z-0" />
                {article.image_url && (
                  <div className="shrink-0 w-16 h-10 rounded overflow-hidden bg-gray-900">
                    <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold truncate">{article.title}</h3>
                    {article.archived && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-900/30 text-yellow-400">
                        Archived
                      </span>
                    )}
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                        article.published
                          ? "bg-green-900/30 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {article.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500">{article.publication || "No publication"}</span>
                    {article.category && <span className="text-xs text-gray-600">{article.category}</span>}
                    <span className="text-[10px] text-gray-700">
                      {new Date(article.created_at).toLocaleDateString()}
                    </span>
                    {article.published && (
                      <span className="text-[10px] text-[#D73F09]">/press/{article.slug}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => toggleArchive(article, e)}
                    className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-yellow-400 hover:bg-yellow-400/10 opacity-0 group-hover:opacity-100 transition-all"
                    title={article.archived ? "Unarchive" : "Archive"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="21 8 21 21 3 21 3 8" />
                      <rect x="1" y="3" width="22" height="5" />
                      <line x1="10" y1="12" x2="14" y2="12" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(article);
                    }}
                    className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete article"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
