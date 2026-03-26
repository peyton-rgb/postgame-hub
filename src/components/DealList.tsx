"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";
import Link from "next/link";
import ViewToggle, { type ViewMode } from "./ViewToggle";

export default function DealList() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [showCreate, setShowCreate] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [newAthlete, setNewAthlete] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Deal | null>(null);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    const { data } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });
    setDeals(data || []);
    setLoading(false);
  }

  async function createDeal() {
    if (!newBrand.trim()) return;
    const { data } = await supabase
      .from("deals")
      .insert({
        brand_name: newBrand,
        athlete_name: newAthlete || null,
        tier: "tier_1",
        featured: false,
        published: false,
        sort_order: 0,
      })
      .select()
      .single();

    if (data) {
      setDeals([data, ...deals]);
      setShowCreate(false);
      setNewBrand("");
      setNewAthlete("");
    }
  }

  async function deleteDeal(deal: Deal) {
    setDeleting(deal.id);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    if (!error) {
      setDeals((prev) => prev.filter((d) => d.id !== deal.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <ViewToggle mode={viewMode} onChange={setViewMode} />
        <div className="flex gap-3">
        <a
          href="/deals"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          View Live Page
        </a>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407]"
        >
          + New Deal
        </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Deal</h2>
            <p className="text-sm text-gray-400 mb-1">
              Are you sure you want to delete{" "}
              <span className="text-white font-bold">{confirmDelete.brand_name}</span>?
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
                onClick={() => deleteDeal(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete Deal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-6">New Deal</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Brand Name
            </label>
            <input
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="e.g. Nike"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-4 focus:border-[#D73F09] outline-none"
            />
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Athlete Name
            </label>
            <input
              value={newAthlete}
              onChange={(e) => setNewAthlete(e.target.value)}
              placeholder="e.g. John Smith"
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
                onClick={createDeal}
                className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407]"
              >
                Create Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading...</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No deals yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-[#D73F09] font-bold text-sm hover:underline"
          >
            Create your first deal →
          </button>
        </div>
      ) : (
        viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="relative p-6 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors group"
              >
                <Link
                  href={`/dashboard/deals/${deal.id}`}
                  className="absolute inset-0 z-0"
                />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    {deal.tier.replace("_", " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        deal.published
                          ? "bg-green-900/30 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {deal.published ? "Published" : "Draft"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDelete(deal);
                      }}
                      className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete deal"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-black mb-1">{deal.brand_name}</h3>
                {deal.athlete_name && (
                  <p className="text-sm text-gray-400">{deal.athlete_name}</p>
                )}
                <p className="text-xs text-gray-600 mt-2">
                  {new Date(deal.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="relative flex items-center gap-4 px-5 py-4 bg-[#111] border border-gray-800 rounded-lg hover:border-gray-600 transition-colors group"
              >
                <Link href={`/dashboard/deals/${deal.id}`} className="absolute inset-0 z-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold truncate">{deal.brand_name}</h3>
                    {deal.athlete_name && (
                      <span className="text-xs text-gray-400 truncate">{deal.athlete_name}</span>
                    )}
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                        deal.published
                          ? "bg-green-900/30 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {deal.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500 uppercase">{deal.tier.replace("_", " ")}</span>
                    <span className="text-[10px] text-gray-700">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(deal);
                  }}
                  className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Delete deal"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
