"use client";

import { useEffect, useState } from "react";

interface Brand { id: string; name: string; logo_primary_url: string | null; logo_light_url: string | null; }
import { createBrowserSupabase } from "@/lib/supabase";
import type { Brief } from "@/lib/types";
import { SYSTEM_TEMPLATES, type BriefTemplate } from "@/lib/brief-template";
import Link from "next/link";

export default function BriefList() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<BriefTemplate | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Brief | null>(null);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadBriefs();
    loadBrands();
  }, []);

  async function loadBrands() {
    const { data } = await supabase.from("brands").select("id, name, logo_primary_url, logo_light_url").order("name", { ascending: true });
    setBrands(data || []);
  }

  async function loadBrands() {
    const { data } = await supabase.from("brands").select("id, name, logo_primary_url, logo_light_url").order("name", { ascending: true });
    setBrands(data || []);
  }

  async function loadBriefs() {
    const { data } = await supabase
      .from("briefs")
      .select("*")
      .order("created_at", { ascending: false });
    setBriefs(data || []);
    setLoading(false);
  }

  function openCreate() {
    setStep("template");
    setSelectedTemplate(null);
    setNewTitle("");
    setSelectedBrandId("");
    setShowCreate(true);
  }

  function selectTemplate(t: BriefTemplate) {
    setSelectedTemplate(t);
    setStep("details");
  }

  async function createBrief() {
    if (!newTitle.trim() || !selectedBrandId || !selectedTemplate) return;
    setCreating(true);
    const slug =
      newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

    const { data } = await supabase
      .from("briefs")
      .insert({
        title: newTitle,
        slug,
        client_name: selectedBrand?.name || "",
        brand_id: selectedBrandId,
        html_content: "",
        published: false,
      })
      .select()
      .single();

    if (data) {
      setBriefs([data, ...briefs]);
      setShowCreate(false);
      // Navigate to editor with template info in URL
      const templateIdx = SYSTEM_TEMPLATES.indexOf(selectedTemplate);
      window.location.href = `/dashboard/briefs/${data.id}?template=${templateIdx}`;
    }
    setCreating(false);
  }

  async function deleteBrief(brief: Brief) {
    setDeleting(brief.id);
    const { error } = await supabase.from("briefs").delete().eq("id", brief.id);
    if (!error) {
      setBriefs((prev) => prev.filter((b) => b.id !== brief.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  const TEMPLATE_ICONS: Record<string, string> = {
    "Raising Cane's Tunnel Walk": "🍗",
    "Videographer Brief": "🎥",
    "Editor Brief": "✂️",
    "Athlete Brief": "🏅",
    "Creative Brief": "✏️",
    "Run-of-Show": "📋",
    "Campaign Overview": "📊",
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <button
          onClick={openCreate}
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407]"
        >
          + New Brief
        </button>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Brief</h2>
            <p className="text-sm text-gray-400 mb-1">
              Are you sure you want to delete{" "}
              <span className="text-white font-bold">{confirmDelete.title}</span>?
            </p>
            <p className="text-xs text-red-400/70 mb-6">
              This will permanently remove this brief. This cannot be undone.
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
                onClick={() => deleteBrief(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete Brief"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-700 rounded-2xl w-[560px] max-h-[90vh] overflow-y-auto">
            {step === "template" ? (
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-black">Choose a Template</h2>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="text-gray-500 hover:text-gray-300 text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {SYSTEM_TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => selectTemplate(t)}
                      className="p-4 bg-black border border-gray-700 rounded-xl text-left hover:border-[#D73F09] hover:bg-[#D73F09]/5 transition-colors group"
                    >
                      <div className="text-2xl mb-2">{TEMPLATE_ICONS[t.name] || "📄"}</div>
                      <div className="text-sm font-bold text-white mb-1">{t.name}</div>
                      <div className="text-xs text-gray-500">
                        {t.customSections.length > 0
                          ? `${t.customSections.length} custom sections`
                          : `${t.coreFields.length} fields`}
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => selectTemplate(SYSTEM_TEMPLATES[0])}
                    className="p-4 bg-black border border-dashed border-gray-700 rounded-xl text-left hover:border-[#D73F09] transition-colors"
                  >
                    <div className="text-2xl mb-2">📄</div>
                    <div className="text-sm font-bold text-white mb-1">Blank Brief</div>
                    <div className="text-xs text-gray-500">Start from scratch</div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setStep("template")}
                    className="text-gray-500 hover:text-gray-300 text-sm"
                  >
                    ← Back
                  </button>
                  <h2 className="text-lg font-black">
                    {TEMPLATE_ICONS[selectedTemplate?.name || ""] || "📄"}{" "}
                    {selectedTemplate?.name}
                  </h2>
                </div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Brief Title
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`e.g. ${selectedTemplate?.name} — Spring 2026`}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-4 focus:border-[#D73F09] outline-none"
                  onKeyDown={(e) => e.key === "Enter" && createBrief()}
                  autoFocus
                />
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Brand
                </label>
                <select
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white mb-6 focus:border-[#D73F09] outline-none appearance-none"
                >
                  <option value="">Select a brand...</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createBrief}
                    disabled={creating || !newTitle.trim() || !selectedBrandId}
                    className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407] disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Brief →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Brief list */}
      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading...</div>
      ) : briefs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No briefs yet.</p>
          <button
            onClick={openCreate}
            className="text-[#D73F09] font-bold text-sm hover:underline"
          >
            Create your first brief →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {briefs.map((brief) => (
            <div
              key={brief.id}
              className="relative p-6 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors group"
            >
              {brief.external_url ? (
                <a
                  href={brief.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-0"
                />
              ) : (
                <Link
                  href={`/dashboard/briefs/${brief.id}`}
                  className="absolute inset-0 z-0"
                />
              )}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {brief.client_name}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      brief.external_url
                        ? "bg-blue-900/30 text-blue-400"
                        : brief.published
                        ? "bg-green-900/30 text-green-400"
                        : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    {brief.external_url ? "External" : brief.published ? "Published" : "Draft"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(brief);
                    }}
                    className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-black mb-2">{brief.title}</h3>
              <p className="text-xs text-gray-600">
                {new Date(brief.created_at).toLocaleDateString()}
                {brief.published && (
                  <span className="ml-2 text-[#D73F09]">/brief/{brief.slug}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
