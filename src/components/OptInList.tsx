"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

/**
 * OptInList — dashboard tab content for the "Campaign Opt-In" feature.
 *
 * Mirrors the patterns used in CampaignList.tsx:
 *   - Brand filter dropdown ("All Brands" + clear)
 *   - Sorted by created_at desc (newest first) at fetch time
 *   - List-only view (no card grid)
 *   - "+ New Opt-In Page" modal that creates a draft + redirects to the editor
 *   - Inline delete with confirmation modal
 *
 * The editor page itself lives at /dashboard/campaign-optin/[id] and is built
 * in the next chunk. For now, clicking a row navigates there as a stub.
 */

type OptInCampaign = {
  id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  slug: string;
  brand_id: string | null;
  admin_campaign_id: number | null;
  title: string;
  headline: string;
  status: "draft" | "live" | "closed";
  brands?: {
    id: string;
    name: string;
    logo_light_url: string | null;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
};

type Brand = {
  id: string;
  name: string;
  logo_light_url: string | null;
  logo_url: string | null;
  primary_color: string | null;
};

type OptInCounts = Record<string, number>;

export default function OptInList() {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [campaigns, setCampaigns] = useState<OptInCampaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [optInCounts, setOptInCounts] = useState<OptInCounts>({});
  const [loading, setLoading] = useState(true);

  const [brandFilterId, setBrandFilterId] = useState<string>("");

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBrandId, setNewBrandId] = useState("");
  const [newAdminId, setNewAdminId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<OptInCampaign | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadCampaigns(), loadBrands()]);
    setLoading(false);
  }

  async function loadCampaigns() {
    const { data, error } = await supabase
      .from("optin_campaigns")
      .select("*, brands(id, name, logo_light_url, logo_url, primary_color)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadCampaigns error", error);
      return;
    }

    const list = (data || []) as OptInCampaign[];
    setCampaigns(list);

    // Pull pending opt-in counts in a second query so the list shows
    // "23 opt-ins" inline next to each row. Cheap aggregate.
    if (list.length > 0) {
      const ids = list.map((c) => c.id);
      const { data: countRows } = await supabase
        .from("pending_optins")
        .select("optin_campaign_id")
        .in("optin_campaign_id", ids);

      const counts: OptInCounts = {};
      (countRows || []).forEach((row: any) => {
        const k = row.optin_campaign_id as string;
        counts[k] = (counts[k] || 0) + 1;
      });
      setOptInCounts(counts);
    } else {
      setOptInCounts({});
    }
  }

  async function loadBrands() {
    const { data } = await supabase
      .from("brands")
      .select("id, name, logo_light_url, logo_url, primary_color")
      .eq("archived", false)
      .order("name");
    setBrands((data || []) as Brand[]);
  }

  /**
   * Generate a URL-safe slug from a title plus a short random suffix to avoid
   * collisions. Mirrors the pattern used by recap slugs (e.g. "iherb-spring-x7k2").
   */
  function generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const suffix = Math.random().toString(36).slice(2, 6);
    return base ? `${base}-${suffix}` : `optin-${suffix}`;
  }

  async function handleCreate() {
    setCreateError(null);

    if (!newTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }
    if (!newBrandId) {
      setCreateError("Pick a brand.");
      return;
    }

    setCreating(true);

    const slug = generateSlug(newTitle);
    const adminId = newAdminId.trim() ? parseInt(newAdminId.trim(), 10) : null;
    if (newAdminId.trim() && (adminId === null || isNaN(adminId))) {
      setCreateError("Admin Campaign ID must be a number.");
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from("optin_campaigns")
      .insert({
        slug,
        brand_id: newBrandId,
        admin_campaign_id: adminId,
        title: newTitle.trim(),
        headline: "New NIL Opportunity",
        status: "draft",
      })
      .select()
      .single();

    setCreating(false);

    if (error) {
      console.error("create optin error", error);
      setCreateError(error.message || "Could not create opt-in page.");
      return;
    }

    // Reset and redirect into the editor
    setShowCreate(false);
    setNewTitle("");
    setNewBrandId("");
    setNewAdminId("");
    router.push(`/dashboard/campaign-optin/${data.id}`);
  }

  async function handleDelete(campaign: OptInCampaign) {
    setDeleting(campaign.id);
    const { error } = await supabase.from("optin_campaigns").delete().eq("id", campaign.id);
    if (!error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    } else {
      console.error("delete optin error", error);
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  // Apply brand filter client-side. Sort is already applied at fetch time.
  const filteredCampaigns = brandFilterId
    ? campaigns.filter((c) => c.brand_id === brandFilterId)
    : campaigns;

  return (
    <>
      {/* Header row: brand filter + create button */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 shrink-0">
            Filter by brand
          </label>
          <select
            value={brandFilterId}
            onChange={(e) => setBrandFilterId(e.target.value)}
            className="px-3 py-2 bg-[#111] border border-gray-800 rounded-lg text-sm text-white font-bold focus:border-[#D73F09] focus:outline-none min-w-[220px]"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {brandFilterId && (
            <button
              onClick={() => setBrandFilterId("")}
              className="text-[11px] font-bold text-gray-500 hover:text-white uppercase tracking-wider"
            >
              Clear
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407] shrink-0"
        >
          + New Opt-In Page
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[480px] max-w-[92vw]">
            <h2 className="text-lg font-black mb-1">New Opt-In Page</h2>
            <p className="text-sm text-gray-500 mb-6">
              You can edit everything else in the editor after creating.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Brand
                </label>
                <select
                  value={newBrandId}
                  onChange={(e) => setNewBrandId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black border border-gray-800 rounded-lg text-sm text-white font-bold focus:border-[#D73F09] focus:outline-none"
                >
                  <option value="">Select a brand…</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="iHerb Gifting Campaign"
                  className="w-full px-3 py-2.5 bg-black border border-gray-800 rounded-lg text-sm text-white font-bold focus:border-[#D73F09] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Admin Campaign ID
                  <span className="ml-2 normal-case font-normal text-gray-600">
                    (numeric, optional)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  placeholder="e.g. 1187"
                  className="w-full px-3 py-2.5 bg-black border border-gray-800 rounded-lg text-sm text-white font-bold focus:border-[#D73F09] focus:outline-none"
                />
                <p className="text-[11px] text-gray-600 mt-2">
                  The ColdFusion admin campaign ID. Opt-ins will be queued under this ID for the admin to pull.
                </p>
              </div>

              {createError && (
                <div className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                  {createError}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
                disabled={creating}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-400 hover:text-white border border-gray-800 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 px-4 py-2.5 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create & Edit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Opt-In Page</h2>
            <p className="text-sm text-gray-400 mb-1">
              Are you sure you want to delete{" "}
              <span className="text-white font-bold">{confirmDelete.title}</span>?
            </p>
            <p className="text-xs text-red-400/70 mb-6">
              This will permanently remove the page and all submitted opt-ins. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-400 hover:text-white border border-gray-800 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {(() => {
        if (loading) {
          return <div className="text-gray-500 text-center py-20">Loading…</div>;
        }
        if (campaigns.length === 0) {
          return (
            <div className="text-center py-20">
              <p className="text-gray-500 mb-4">No opt-in pages yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-[#D73F09] font-bold text-sm hover:underline"
              >
                Create your first opt-in page →
              </button>
            </div>
          );
        }
        if (filteredCampaigns.length === 0) {
          const brandName = brands.find((b) => b.id === brandFilterId)?.name || "this brand";
          return (
            <div className="text-center py-20">
              <p className="text-gray-500 mb-4">No opt-in pages for {brandName}.</p>
              <button
                onClick={() => setBrandFilterId("")}
                className="text-[#D73F09] font-bold text-sm hover:underline"
              >
                Clear filter →
              </button>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-2">
            {filteredCampaigns.map((c) => {
              const count = optInCounts[c.id] || 0;
              const brandLogo = c.brands?.logo_light_url || c.brands?.logo_url || null;
              const brandName = c.brands?.name || "—";
              return (
                <div
                  key={c.id}
                  className="relative flex items-center gap-4 px-5 py-4 bg-[#111] border border-gray-800 rounded-lg hover:border-gray-600 transition-colors group"
                >
                  <Link href={`/dashboard/campaign-optin/${c.id}`} className="absolute inset-0 z-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold truncate">{c.title}</h3>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.status === "live"
                            ? "bg-green-900/30 text-green-400"
                            : c.status === "closed"
                            ? "bg-gray-800 text-gray-400"
                            : "bg-amber-900/30 text-amber-400"
                        }`}
                      >
                        {c.status === "live" ? "Live" : c.status === "closed" ? "Closed" : "Draft"}
                      </span>
                      {count > 0 && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-[#D73F09]/15 text-[#D73F09]">
                          {count} opt-in{count === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {brandLogo ? (
                        <img
                          src={brandLogo}
                          alt={brandName}
                          className="h-[16px] max-w-[60px] object-contain flex-shrink-0"
                        />
                      ) : null}
                      <span className="text-xs text-gray-500">{brandName}</span>
                      <span className="text-[10px] text-gray-700">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      {c.status === "live" && (
                        <span className="text-[10px] text-[#D73F09]">/optin/{c.slug}</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(c);
                    }}
                    className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Delete opt-in page"
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
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
