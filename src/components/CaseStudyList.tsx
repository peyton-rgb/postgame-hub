"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { CaseStudy } from "@/lib/types";
import Link from "next/link";

export default function CaseStudyList() {
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CaseStudy | null>(null);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadStudies();
  }, []);

  async function loadStudies() {
    const { data } = await supabase
      .from("case_studies")
      .select("*")
      .order("created_at", { ascending: false });
    setStudies(data || []);
    setLoading(false);
  }

  async function createStudy() {
    if (!newTitle.trim() || !newBrand.trim()) return;
    const slug =
      newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

    const { data } = await supabase
      .from("case_studies")
      .insert({
        title: newTitle,
        slug,
        brand_name: newBrand,
        metrics: {},
        highlights: [],
        featured: false,
        published: false,
        sort_order: 0,
      })
      .select()
      .single();

    if (data) {
      setStudies([data, ...studies]);
      setShowCreate(false);
      setNewTitle("");
      setNewBrand("");
    }
  }

  async function deleteStudy(study: CaseStudy) {
    setDeleting(study.id);
    const { error } = await supabase.from("case_studies").delete().eq("id", study.id);
    if (!error) {
      setStudies((prev) => prev.filter((s) => s.id !== study.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  return (
    <>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407]"
        >
          + New Case Study
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Case Study</h2>
            <p className="text-sm text-gray-400 mb-1">
              Are you sure you want to delete{" "}
              <span className="text-white font-bold">{confirmDelete.title}</span>?
            </p>
            <p className="text-xs text-status-bad/70 mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteStudy(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-6">New Case Study</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Title
            </label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Nike Tunnel Walk Campaign"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-4 focus:border-[#D73F09] outline-none"
            />
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Brand Name
            </label>
            <input
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="e.g. Nike"
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
                onClick={createStudy}
                className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407]"
              >
                Create Case Study
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading...</div>
      ) : studies.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No case studies yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-[#D73F09] font-bold text-sm hover:underline"
          >
            Create your first case study →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studies.map((study) => (
            <div
              key={study.id}
              className="relative p-6 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors group"
            >
              <Link
                href={`/dashboard/case-studies/${study.id}`}
                className="absolute inset-0 z-0"
              />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {study.brand_name}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      study.published
                        ? "bg-status-ok/30 text-status-ok-ink"
                        : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    {study.published ? "Published" : "Draft"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(study);
                    }}
                    className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-status-bad-ink hover:bg-status-bad/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete case study"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-black mb-1">{study.title}</h3>
              {study.category && (
                <p className="text-sm text-gray-400">{study.category}</p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                {new Date(study.created_at).toLocaleDateString()}
                {study.published && (
                  <span className="ml-2 text-[#D73F09]">/case-studies/{study.slug}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
