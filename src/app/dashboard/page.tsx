"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign } from "@/lib/types";
import Link from "next/link";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns(data || []);
    setLoading(false);
  }

  async function createCampaign() {
    if (!newName.trim() || !newClient.trim()) return;
    const slug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        name: newName,
        slug,
        client_name: newClient,
        published: false,
        settings: { primary_color: "#D73F09", layout: "masonry", columns: 4 },
      })
      .select()
      .single();

    if (data) {
      setCampaigns([data, ...campaigns]);
      setShowCreate(false);
      setNewName("");
      setNewClient("");
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    setDeleting(campaign.id);
    // Delete in order: media → athletes → campaign (foreign key constraints)
    await supabase.from("media").delete().eq("campaign_id", campaign.id);
    await supabase.from("athletes").delete().eq("campaign_id", campaign.id);
    const { error } = await supabase.from("campaigns").delete().eq("id", campaign.id);
    if (!error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[3px] text-[#D73F09] mb-1">
            Postgame
          </div>
          <h1 className="text-xl font-black">Campaign Recaps</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407]"
        >
          + New Campaign
        </button>
      </div>

      <div className="p-8">
        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
              <h2 className="text-lg font-black mb-2">Delete Campaign</h2>
              <p className="text-sm text-gray-400 mb-1">
                Are you sure you want to delete <span className="text-white font-bold">{confirmDelete.name}</span>?
              </p>
              <p className="text-xs text-red-400/70 mb-6">
                This will permanently remove the campaign and all its athletes, media, and metrics. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleting === confirmDelete.id}
                  className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteCampaign(confirmDelete)}
                  disabled={deleting === confirmDelete.id}
                  className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting === confirmDelete.id ? "Deleting..." : "Delete Campaign"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
              <h2 className="text-lg font-black mb-6">New Campaign</h2>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Campaign Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Adidas EVO SL"
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-4 focus:border-[#D73F09] outline-none"
              />
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Client Name
              </label>
              <input
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                placeholder="e.g. Adidas"
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
                  onClick={createCampaign}
                  className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407]"
                >
                  Create Campaign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Campaign list */}
        {loading ? (
          <div className="text-gray-500 text-center py-20">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No campaigns yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-[#D73F09] font-bold text-sm hover:underline"
            >
              Create your first campaign →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="relative p-6 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors group"
              >
                <Link href={`/dashboard/${c.id}`} className="absolute inset-0 z-0" />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    {c.client_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        c.published
                          ? "bg-green-900/30 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {c.published ? "Published" : "Draft"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDelete(c);
                      }}
                      className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete campaign"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-black mb-2">{c.name}</h3>
                <p className="text-xs text-gray-600">
                  {new Date(c.created_at).toLocaleDateString()}
                  {c.published && (
                    <span className="ml-2 text-[#D73F09]">
                      /recap/{c.slug}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
