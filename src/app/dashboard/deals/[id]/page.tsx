"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";
import Link from "next/link";

export default function DealEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createBrowserSupabase();

  const [brandName, setBrandName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [athleteSchool, setAthleteSchool] = useState("");
  const [athleteSport, setAthleteSport] = useState("");
  const [tier, setTier] = useState<"tier_1" | "tier_2" | "tier_3">("tier_1");
  const [dealType, setDealType] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [dateAnnounced, setDateAnnounced] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDeal();
  }, [id]);

  async function loadDeal() {
    const { data } = await supabase.from("deals").select("*").eq("id", id).single();
    if (data) {
      setDeal(data);
      setBrandName(data.brand_name || "");
      setAthleteName(data.athlete_name || "");
      setAthleteSchool(data.athlete_school || "");
      setAthleteSport(data.athlete_sport || "");
      setTier(data.tier);
      setDealType(data.deal_type || "");
      setValue(data.value || "");
      setDescription(data.description || "");
      setDateAnnounced(data.date_announced || "");
      setImageUrl(data.image_url || "");
      setFeatured(data.featured);
    }
    setLoading(false);
  }

  async function saveDeal(publish?: boolean) {
    if (!deal) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      brand_name: brandName,
      athlete_name: athleteName || null,
      athlete_school: athleteSchool || null,
      athlete_sport: athleteSport || null,
      tier,
      deal_type: dealType || null,
      value: value || null,
      description: description || null,
      image_url: imageUrl || null,
      date_announced: dateAnnounced || null,
      featured,
      updated_at: new Date().toISOString(),
    };
    if (publish !== undefined) updates.published = publish;

    const { data } = await supabase
      .from("deals")
      .update(updates)
      .eq("id", deal.id)
      .select()
      .single();
    if (data) {
      setDeal(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }
  if (!deal) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Deal not found.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-gray-800 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/dashboard?tab=deals" className="text-xs text-gray-500 hover:text-gray-300 mb-1 block">
            ← Back to Deals
          </Link>
          <h1 className="text-lg font-black">{deal.brand_name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => saveDeal()}
            disabled={saving}
            className="px-4 py-2 border border-gray-700 text-gray-400 text-sm font-bold rounded-lg hover:border-[#D73F09] hover:text-[#D73F09] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save Draft"}
          </button>
          <button
            onClick={() => saveDeal(!deal.published)}
            disabled={saving}
            className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50"
          >
            {deal.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Brand Name</label>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Athlete Name</label>
            <input value={athleteName} onChange={(e) => setAthleteName(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">School</label>
            <input value={athleteSchool} onChange={(e) => setAthleteSchool(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Sport</label>
            <input value={athleteSport} onChange={(e) => setAthleteSport(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value as Deal["tier"])} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none appearance-none">
              <option value="tier_1">Tier 1</option>
              <option value="tier_2">Tier 2</option>
              <option value="tier_3">Tier 3</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Deal Type</label>
            <input value={dealType} onChange={(e) => setDealType(e.target.value)} placeholder="e.g. NIL, Endorsement" className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Value</label>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. $50,000" className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
        </div>

        {/* Image */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Deal Image</label>
          {imageUrl && (
            <div className="mb-3 relative group">
              <img src={imageUrl} alt="Deal" className="w-full max-h-64 object-cover rounded-lg border border-gray-700" />
              <button
                onClick={() => setImageUrl("")}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 text-gray-400 hover:text-red-400 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Paste image URL or upload below"
              className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
            />
            <button
              onClick={async () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async (ev) => {
                  const file = (ev.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const path = `deals/${deal.id}/${Date.now()}-${file.name}`;
                  const { data: uploadData, error } = await supabase.storage
                    .from("campaign-media")
                    .upload(path, file, { upsert: true });
                  if (error) { setUploading(false); return; }
                  const { data: { publicUrl } } = supabase.storage.from("campaign-media").getPublicUrl(uploadData.path);
                  setImageUrl(publicUrl);
                  setUploading(false);
                };
                input.click();
              }}
              disabled={uploading}
              className="px-4 py-3 border border-gray-700 rounded-lg text-gray-400 text-sm font-bold hover:border-[#D73F09] hover:text-[#D73F09] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Date Announced</label>
            <input type="date" value={dateAnnounced} onChange={(e) => setDateAnnounced(e.target.value)} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none" />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-5 h-5 rounded border-gray-700 bg-black text-[#D73F09] focus:ring-[#D73F09]" />
              <span className="text-sm font-bold text-gray-400">Featured Deal</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
