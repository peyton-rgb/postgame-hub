"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Brief, Campaign } from "@/lib/types";
import {
  generateBriefHTML,
  EMPTY_FIELDS,
  SYSTEM_TEMPLATES,
  applyTemplate,
  type BriefFields,
  type CustomSection,
} from "@/lib/brief-template";
import Link from "next/link";

const CORE_FIELD_CONFIG = [
  { key: "objective" as const, label: "Objective", placeholder: "Describe the campaign objective and goals..." },
  { key: "deliverables" as const, label: "Required Deliverables", placeholder: "- 3 vertical videos (9:16, 30-60s)\n- 10 high-res photos\n- 2 horizontal videos (16:9, 15-30s)" },
  { key: "creativeDirection" as const, label: "Creative Direction", placeholder: "- Energetic, fast-paced editing\n- Natural lighting preferred\n- Brand colors prominent" },
  { key: "platformNotes" as const, label: "Platform & Posting", placeholder: "- Instagram Reels: 9:16, 30s max\n- TikTok: trending audio encouraged" },
  { key: "cameraTechnical" as const, label: "Camera & Technical", placeholder: "- Shoot in 4K, 60fps\n- S-Log or flat color profile\n- Stabilized footage required" },
  { key: "workflow" as const, label: "Shoot Workflow", placeholder: "- Arrive 30 min early for setup\n- Capture establishing shots first\n- Film primary content" },
  { key: "fileDelivery" as const, label: "File Delivery", placeholder: "- Upload raw footage to Google Drive\n- Deliver edited files within 24 hours" },
];

interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const AI_CHIPS = [
  "Write a shot list",
  "Expand the objective",
  "Suggest deliverables",
  "Add IP-safe language",
  "Script athlete talking points",
  "Add brand restrictions",
  "Suggest music direction",
  "Write edit structure",
];

export default function BriefEditor() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [fields, setFields] = useState<BriefFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"fields" | "sections" | "preview">("fields");
  const [showRawHtml, setShowRawHtml] = useState(false);
  const [rawHtml, setRawHtml] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const supabase = createBrowserSupabase();

  // AI chat state
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    { role: "system", content: "Hey — describe a concept or ask me to write any section. I'll keep everything production-ready and NIL-compliant." },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiMessagesRef = useRef<HTMLDivElement>(null);

  // Tracker state
  const [trackers, setTrackers] = useState<Campaign[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [creatingTracker, setCreatingTracker] = useState(false);
  const [newTrackerName, setNewTrackerName] = useState("");

  useEffect(() => {
    loadBrief();
    loadTrackers();
  }, [id]);

  useEffect(() => {
    if (aiMessagesRef.current) {
      aiMessagesRef.current.scrollTop = aiMessagesRef.current.scrollHeight;
    }
  }, [aiMessages]);

  async function loadTrackers() {
    const { data } = await supabase
      .from("campaign_recaps")
      .select("*")
      .eq("type", "tracker")
      .order("created_at", { ascending: false });
    setTrackers(data || []);
  }

  async function loadBrief() {
    const { data } = await supabase
      .from("briefs")
      .select("*, tracker_id")
      .eq("id", id)
      .single();
    if (data) {
      setBrief(data);
      setSelectedTrackerId(data.tracker_id || null);
      const storedFields = parseStoredFields(data);
      // If coming from template picker, apply that template
      const templateIdx = searchParams.get("template");
      if (templateIdx !== null && !data.html_content) {
        const idx = parseInt(templateIdx, 10);
        if (SYSTEM_TEMPLATES[idx]) {
          const tplFields = applyTemplate(SYSTEM_TEMPLATES[idx], data.title, data.client_name);
          setFields(tplFields);
        } else {
          setFields(storedFields);
        }
      } else {
        setFields(storedFields);
      }
      setRawHtml(data.html_content || "");
    }
    setLoading(false);
  }

  function parseStoredFields(brief: Brief): BriefFields {
    const match = brief.html_content?.match(/<!--BRIEF_FIELDS:(.*?)-->/s);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        return { ...EMPTY_FIELDS, ...parsed, customSections: parsed.customSections || [] };
      } catch {}
    }
    return { ...EMPTY_FIELDS, title: brief.title, clientName: brief.client_name };
  }

  const previewHtml = useCallback(() => {
    if (showRawHtml) return rawHtml;
    const html = generateBriefHTML(fields);
    return html.replace("</head>", `<!--BRIEF_FIELDS:${JSON.stringify(fields)}-->\n</head>`);
  }, [fields, showRawHtml, rawHtml]);

  function updateField(key: keyof BriefFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateCustomSection(sectionId: string, key: keyof CustomSection, value: string) {
    setFields((prev) => ({
      ...prev,
      customSections: prev.customSections.map((s) =>
        s.id === sectionId ? { ...s, [key]: value } : s
      ),
    }));
    setSaved(false);
  }

  function addCustomSection() {
    const newSection: CustomSection = {
      id: `cs-${Date.now()}`,
      title: `Section ${fields.customSections.length + 1}`,
      content: "",
    };
    setFields((prev) => ({ ...prev, customSections: [...prev.customSections, newSection] }));
    setSaved(false);
  }

  function removeCustomSection(sectionId: string) {
    setFields((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((s) => s.id !== sectionId),
    }));
    setSaved(false);
  }

  async function saveBrief(publish?: boolean) {
    if (!brief) return;
    setSaving(true);
    const htmlContent = previewHtml();
    const updates: Record<string, unknown> = {
      title: fields.title || brief.title,
      client_name: fields.clientName || brief.client_name,
      html_content: htmlContent,
      updated_at: new Date().toISOString(),
      tracker_id: selectedTrackerId || null,
    };
    if (publish !== undefined) updates.published = publish;
    const { data } = await supabase
      .from("briefs")
      .update(updates)
      .eq("id", brief.id)
      .select()
      .single();
    if (data) {
      setBrief(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function createTrackerFromBrief() {
    const trackerName = newTrackerName.trim() || `${fields.title || brief?.title || "Untitled"} Tracker`;
    const clientName = fields.clientName || brief?.client_name || "";
    if (!clientName) return;
    setCreatingTracker(true);
    const slug =
      trackerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" + Date.now().toString(36);
    const { data } = await supabase
      .from("campaign_recaps")
      .insert({ name: trackerName, slug, client_name: clientName, published: false, type: "tracker", settings: { primary_color: "#D73F09" } })
      .select()
      .single();
    if (data) {
      setSelectedTrackerId(data.id);
      await supabase.from("briefs").update({ tracker_id: data.id }).eq("id", id);
      setTrackers((prev) => [data, ...prev]);
      setNewTrackerName("");
    }
    setCreatingTracker(false);
  }

  async function sendAiMessage(overrideText?: string) {
    const text = (overrideText || aiInput).trim();
    if (!text || aiLoading) return;
    setAiInput("");
    setAiLoading(true);

    const userMsg: AiMessage = { role: "user", content: text };
    setAiMessages((prev) => [...prev, userMsg]);

    const systemPrompt = `You are the Postgame Brief Assistant — a sports media production tool for NIL college athlete campaigns.

Context:
- Brand: ${fields.clientName || "unspecified"}
- Brief type: ${fields.briefType || "Creative Brief"}
- Brief title: ${fields.title || "untitled"}
- Custom sections: ${fields.customSections.map((s) => s.title).join(", ") || "none"}

Rules:
- NEVER use: "March Madness", "Final Four", "Sweet 16", "Elite Eight", "The Big Dance", "Selection Sunday", or any NCAA trademark. Use "tournament" or "postseason" instead.
- Keep responses concise and production-ready
- Format shot lists and deliverables as numbered or bulleted lists
- For athlete briefs, keep language direct and easy to act on
- Just write the content — don't explain what you're about to write
- Tailor everything to the college athlete NIL space`;

    const history = aiMessages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: text });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: history,
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "No response.";
      setAiMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setAiMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to AI. Check your network." }]);
    }
    setAiLoading(false);
  }

  function applyAiToField(content: string, fieldKey?: keyof BriefFields) {
    if (fieldKey && fieldKey in fields && typeof fields[fieldKey] === "string") {
      updateField(fieldKey, content);
      return;
    }
    // Default: put in objective if empty, otherwise add custom section
    if (!fields.objective.trim()) {
      updateField("objective", content);
    } else {
      const newSection: CustomSection = {
        id: `cs-ai-${Date.now()}`,
        title: "AI Generated",
        content,
      };
      setFields((prev) => ({ ...prev, customSections: [...prev.customSections, newSection] }));
      setActiveTab("sections");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Brief not found.
      </div>
    );
  }

  // Determine which core fields to show based on brief type
  const activeCoreFields = CORE_FIELD_CONFIG.filter((f) => {
    if (fields.briefType === "Run-of-Show") return false;
    if (fields.briefType === "Campaign Overview") return ["objective", "deliverables"].includes(f.key);
    if (fields.briefType === "Editor Brief") return ["objective", "deliverables"].includes(f.key);
    if (fields.briefType === "Athlete Brief") return ["objective", "deliverables"].includes(f.key);
    if (fields.briefType === "Creative Brief") return ["objective"].includes(f.key);
    return true; // Videographer Brief shows all
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/dashboard?tab=briefs" className="text-xs text-gray-500 hover:text-gray-300 mb-0.5 block">
            ← Briefs
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{brief.client_name}</span>
            <span className="text-gray-700">/</span>
            <h1 className="text-sm font-black">{brief.title}</h1>
            {fields.briefType && (
              <span className="text-xs px-2 py-0.5 bg-[#D73F09]/20 text-[#D73F09] rounded font-bold uppercase tracking-wider">
                {fields.briefType}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {brief.published && (
            <Link href={`/brief/${brief.slug}`} target="_blank" className="text-xs text-[#D73F09] hover:underline">
              View Live →
            </Link>
          )}
          <button
            onClick={() => saveBrief()}
            disabled={saving}
            className="px-3 py-1.5 border border-gray-700 text-gray-400 text-xs font-bold rounded-lg hover:border-[#D73F09] hover:text-[#D73F09] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Draft"}
          </button>
          <button
            onClick={() => saveBrief(!brief.published)}
            disabled={saving}
            className="px-4 py-1.5 bg-[#D73F09] text-white text-xs font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50"
          >
            {brief.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Editor panel */}
        <div className="w-[400px] flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-800 bg-black flex-shrink-0">
            {(["fields", "sections", "preview"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? "text-[#D73F09] border-b-2 border-[#D73F09]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab === "fields" ? "Fields" : tab === "sections" ? "Sections" : "Settings"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* FIELDS TAB */}
            {activeTab === "fields" && (
              <div className="p-5 space-y-4">
                {/* Brief type */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Brief Type</label>
                  <select
                    value={fields.briefType}
                    onChange={(e) => updateField("briefType", e.target.value)}
                    className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                  >
                    {["Videographer Brief", "Editor Brief", "Athlete Brief", "Creative Brief", "Run-of-Show", "Campaign Overview"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Title</label>
                    <input
                      value={fields.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Brand</label>
                    <input
                      value={fields.clientName}
                      onChange={(e) => updateField("clientName", e.target.value)}
                      className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Date</label>
                    <input
                      value={fields.shootDate}
                      onChange={(e) => updateField("shootDate", e.target.value)}
                      placeholder="e.g. April 12, 2026"
                      className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Location</label>
                    <input
                      value={fields.location}
                      onChange={(e) => updateField("location", e.target.value)}
                      placeholder="e.g. Florida Field"
                      className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Talent / Athletes</label>
                  <input
                    value={fields.athletes}
                    onChange={(e) => updateField("athletes", e.target.value)}
                    placeholder="Names, positions, schools..."
                    className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                  />
                </div>

                {/* Core content fields (type-dependent) */}
                {activeCoreFields.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{label}</label>
                    <textarea
                      value={fields[key] as string}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={placeholder}
                      rows={4}
                      className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y"
                    />
                  </div>
                ))}

                {/* Do's & Don'ts */}
                {fields.briefType !== "Run-of-Show" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-green-600 mb-2">Do&apos;s</label>
                      <textarea
                        value={fields.dos}
                        onChange={(e) => updateField("dos", e.target.value)}
                        placeholder={"Capture wide shots\nShow product clearly"}
                        rows={4}
                        className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-red-500 mb-2">Don&apos;ts</label>
                      <textarea
                        value={fields.donts}
                        onChange={(e) => updateField("donts", e.target.value)}
                        placeholder={"No competitor branding\nAvoid shaky footage"}
                        rows={4}
                        className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTIONS TAB */}
            {activeTab === "sections" && (
              <div className="p-5 space-y-3">
                {fields.customSections.length === 0 && (
                  <p className="text-xs text-gray-500 py-4 text-center">No custom sections yet. Add one below or ask the AI to generate content.</p>
                )}
                {fields.customSections.map((section, i) => (
                  <div key={section.id} className="border border-gray-800 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#111] border-b border-gray-800">
                      <span className="w-5 h-5 rounded-full bg-[#D73F09] text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <input
                        value={section.title}
                        onChange={(e) => updateCustomSection(section.id, "title", e.target.value)}
                        className="flex-1 bg-transparent text-white text-sm font-bold outline-none"
                      />
                      <button
                        onClick={() => removeCustomSection(section.id)}
                        className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={section.content}
                      onChange={(e) => updateCustomSection(section.id, "content", e.target.value)}
                      placeholder="Section content..."
                      rows={4}
                      className="w-full px-3 py-2.5 bg-black text-white text-sm outline-none resize-y border-0"
                    />
                  </div>
                ))}
                <button
                  onClick={addCustomSection}
                  className="w-full py-3 border border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-[#D73F09] hover:border-[#D73F09] text-sm font-bold transition-colors"
                >
                  + Add Section
                </button>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === "preview" && (
              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Badge Text</label>
                  <input
                    value={fields.badgeText}
                    onChange={(e) => updateField("badgeText", e.target.value)}
                    className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                  />
                </div>

                {/* Tracker link */}
                <div className="border-t border-gray-800 pt-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Performance Tracker</label>
                  <select
                    value={selectedTrackerId || ""}
                    onChange={(e) => { setSelectedTrackerId(e.target.value || null); setSaved(false); }}
                    className="w-full px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none mb-3 appearance-none"
                  >
                    <option value="">No tracker linked</option>
                    {trackers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} — {t.client_name}</option>
                    ))}
                  </select>
                  {selectedTrackerId && (
                    <Link href={`/dashboard/trackers/${selectedTrackerId}`} className="inline-flex items-center gap-1 text-xs text-[#D73F09] hover:underline mb-3">
                      Open Tracker →
                    </Link>
                  )}
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newTrackerName}
                      onChange={(e) => setNewTrackerName(e.target.value)}
                      placeholder="New tracker name..."
                      className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                    />
                    <button
                      onClick={createTrackerFromBrief}
                      disabled={creatingTracker}
                      className="px-3 py-2 bg-[#D73F09] text-white text-xs font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50 whitespace-nowrap"
                    >
                      {creatingTracker ? "..." : "+ Create"}
                    </button>
                  </div>
                </div>

                {/* Raw HTML */}
                <div className="border-t border-gray-800 pt-4">
                  <button
                    onClick={() => { if (!showRawHtml) setRawHtml(previewHtml()); setShowRawHtml(!showRawHtml); }}
                    className="text-xs text-gray-500 hover:text-gray-300 font-bold uppercase tracking-wider"
                  >
                    {showRawHtml ? "← Back to Fields" : "Edit Raw HTML →"}
                  </button>
                  {showRawHtml && (
                    <textarea
                      value={rawHtml}
                      onChange={(e) => setRawHtml(e.target.value)}
                      rows={16}
                      className="w-full mt-3 px-3 py-2.5 bg-black border border-gray-700 rounded-lg text-green-400 text-xs font-mono focus:border-[#D73F09] outline-none resize-y"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Preview */}
        <div className="flex-1 bg-[#0a0a0a] overflow-hidden flex flex-col min-w-0">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preview</span>
          </div>
          <div className="flex-1 overflow-auto flex justify-center p-4">
            <iframe
              ref={iframeRef}
              srcDoc={previewHtml()}
              className="w-full max-w-[800px] bg-white rounded-xl shadow-2xl"
              style={{ height: "calc(100vh - 100px)" }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* RIGHT: AI Chat */}
        <div className="w-[300px] flex-shrink-0 border-l border-gray-800 flex flex-col bg-[#0d0d0d]">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D73F09]" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Brief Assistant</span>
          </div>

          {/* Messages */}
          <div ref={aiMessagesRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {aiMessages.map((msg, i) => (
              <div key={i} className={`text-sm leading-relaxed ${
                msg.role === "user"
                  ? "ml-4 px-3 py-2 bg-[#D73F09] text-white rounded-lg"
                  : msg.role === "system"
                  ? "text-gray-500 text-xs italic"
                  : "mr-2 text-gray-200"
              }`}>
                {msg.content}
                {msg.role === "assistant" && (
                  <button
                    onClick={() => applyAiToField(msg.content)}
                    className="block mt-2 text-xs text-[#D73F09] hover:text-white border border-[#D73F09]/30 hover:border-[#D73F09] px-2 py-1 rounded transition-colors"
                  >
                    Apply to brief
                  </button>
                )}
              </div>
            ))}
            {aiLoading && (
              <div className="text-xs text-gray-500 italic animate-pulse">Thinking...</div>
            )}
          </div>

          {/* Quick chips */}
          <div className="px-3 py-2 border-t border-gray-800 flex flex-wrap gap-1.5">
            {AI_CHIPS.slice(0, 4).map((chip) => (
              <button
                key={chip}
                onClick={() => sendAiMessage(chip)}
                className="text-xs px-2 py-1 border border-gray-700 rounded-full text-gray-400 hover:border-[#D73F09] hover:text-[#D73F09] transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {AI_CHIPS.slice(4).map((chip) => (
              <button
                key={chip}
                onClick={() => sendAiMessage(chip)}
                className="text-xs px-2 py-1 border border-gray-700 rounded-full text-gray-400 hover:border-[#D73F09] hover:text-[#D73F09] transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-800">
            <div className="flex gap-2">
              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }}}
                placeholder="Describe a concept..."
                rows={2}
                className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none"
              />
              <button
                onClick={() => sendAiMessage()}
                disabled={aiLoading || !aiInput.trim()}
                className="w-9 h-9 bg-[#D73F09] rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-[#B33407] disabled:opacity-40 transition-colors self-end"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                  <path d="M2 8L14 2L10 8L14 14L2 8Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
