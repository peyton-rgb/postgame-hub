"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Brand } from "@/lib/types";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function BrandList() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaignCounts, setCampaignCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newPrimary, setNewPrimary] = useState("#D73F09");
  const [newSecondary, setNewSecondary] = useState("#000000");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const supabase = createBrowserSupabase();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [
      { data: brandsData },
      { data: bcRows },
      { data: crRows },
    ] = await Promise.all([
      supabase.from("brands").select("*").eq("archived", false).order("name"),
      supabase.from("brand_campaigns").select("brand_id").not("brand_id", "is", null),
      supabase.from("campaign_recaps").select("brand_id").not("brand_id", "is", null),
    ]);

    setBrands(brandsData || []);

    const counts: Record<string, number> = {};
    for (const row of [...(bcRows || []), ...(crRows || [])]) {
      const bid = (row as { brand_id: string }).brand_id;
      if (bid) counts[bid] = (counts[bid] || 0) + 1;
    }
    setCampaignCounts(counts);
    setLoading(false);
  }

  function handleLogoFile(file: File) {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function resetForm() {
    setShowCreate(false);
    setNewName("");
    setNewWebsite("");
    setNewPrimary("#D73F09");
    setNewSecondary("#000000");
    setLogoFile(null);
    setLogoPreview(null);
  }

  async function createBrand() {
    if (!newName.trim()) return;
    setCreating(true);

    // Create brand first
    const { data, error } = await supabase
      .from("brands")
      .insert({
        name: newName.trim(),
        logo_url: null,
        primary_color: newPrimary,
        secondary_color: newSecondary,
        website: newWebsite.trim() || null,
        archived: false,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Brand create error:", error);
      setCreating(false);
      return;
    }

    // Upload logo if provided
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `brands/${data.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("campaign-media")
        .upload(path, logoFile, { upsert: true });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("campaign-media")
          .getPublicUrl(path);
        await supabase.from("brands").update({ logo_url: publicUrl }).eq("id", data.id);
        data.logo_url = publicUrl;
      }
    }

    resetForm();
    router.push(`/dashboard/brands/${data.id}`);
  }

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands..."
          className="px-4 py-2 bg-[#111] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:border-gray-600 outline-none w-64"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407]"
        >
          + Add Brand
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[480px]">
            <h2 className="text-lg font-black mb-6">New Brand</h2>

            {/* Logo upload */}
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Logo <span className="text-gray-700 normal-case">(optional)</span>
            </label>
            <div
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleLogoFile(f);
                };
                input.click();
              }}
              className="flex items-center gap-4 p-4 border border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-gray-500 transition-colors mb-5"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="logo preview" className="w-12 h-12 object-contain rounded-lg bg-gray-900" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-900 flex items-center justify-center text-gray-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-gray-300">
                  {logoFile ? logoFile.name : "Upload logo"}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">PNG, JPG, SVG recommended</div>
              </div>
              {logoFile && (
                <button
                  onClick={(e) => { e.stopPropagation(); setLogoFile(null); setLogoPreview(null); }}
                  className="ml-auto w-6 h-6 rounded-full bg-white/10 text-gray-400 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center text-sm"
                >
                  ×
                </button>
              )}
            </div>

            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Brand Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createBrand()}
              placeholder="e.g. Nike"
              autoFocus
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-4 focus:border-[#D73F09] outline-none"
            />

            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Website <span className="text-gray-700 normal-case">(optional)</span>
            </label>
            <input
              value={newWebsite}
              onChange={(e) => setNewWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-5 focus:border-[#D73F09] outline-none"
            />

            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={newPrimary}
                      onChange={(e) => setNewPrimary(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <div
                      className="w-9 h-9 rounded-lg border border-white/10 cursor-pointer"
                      style={{ backgroundColor: newPrimary }}
                    />
                  </div>
                  <input
                    value={newPrimary}
                    onChange={(e) => setNewPrimary(e.target.value)}
                    className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none font-mono"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={newSecondary}
                      onChange={(e) => setNewSecondary(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <div
                      className="w-9 h-9 rounded-lg border border-white/10 cursor-pointer"
                      style={{ backgroundColor: newSecondary }}
                    />
                  </div>
                  <input
                    value={newSecondary}
                    onChange={(e) => setNewSecondary(e.target.value)}
                    className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetForm}
                disabled={creating}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createBrand}
                disabled={creating || !newName.trim()}
                className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407] disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">
            {search ? "No brands match your search." : "No brands yet."}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-[#D73F09] font-bold text-sm hover:underline"
            >
              Add your first brand →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((brand) => (
            <div
              key={brand.id}
              onClick={() => router.push(`/dashboard/brands/${brand.id}`)}
              className="p-6 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors cursor-pointer group"
            >
              {/* Logo / initials */}
              <div className="mb-4">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="w-14 h-14 object-contain rounded-xl bg-gray-900"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-black"
                    style={{ backgroundColor: brand.primary_color || "#D73F09" }}
                  >
                    {getInitials(brand.name)}
                  </div>
                )}
              </div>

              <h3 className="text-base font-black mb-1 group-hover:text-white transition-colors">
                {brand.name}
              </h3>
              <p className="text-xs text-gray-500">
                {campaignCounts[brand.id] ?? 0} campaign
                {(campaignCounts[brand.id] ?? 0) !== 1 ? "s" : ""}
              </p>

              {/* Color swatches */}
              {(brand.primary_color || brand.secondary_color) && (
                <div className="flex gap-1.5 mt-3">
                  {brand.primary_color && (
                    <div
                      className="w-4 h-4 rounded-full border border-white/10"
                      style={{ backgroundColor: brand.primary_color }}
                      title={brand.primary_color}
                    />
                  )}
                  {brand.secondary_color && (
                    <div
                      className="w-4 h-4 rounded-full border border-white/10"
                      style={{ backgroundColor: brand.secondary_color }}
                      title={brand.secondary_color}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
