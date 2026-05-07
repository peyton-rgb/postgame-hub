"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { PostgameLogo } from "@/components/PostgameLogo";
import { createBrowserSupabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlatformCaption {
  platform: string;
  short_caption: string;
  long_caption: string;
  hashtags: string[];
  mentions: string[];
}

interface VoiceSetting {
  id: string;
  channel_name: string;
  system_prompt: string;
  tone_notes: string;
  example_captions: string[];
  forbidden_phrases: string[];
  active: boolean;
}

const PLATFORMS = ["Instagram", "TikTok", "Twitter/X", "YouTube", "Facebook"];

/* ------------------------------------------------------------------ */
/*  Clipboard helper                                                   */
/* ------------------------------------------------------------------ */

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  return { copiedKey, copy };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CaptionsPage() {
  const [tab, setTab] = useState<"generate" | "voice">("generate");

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <PostgameLogo size="md" />
            </Link>
            <span className="text-gray-700">/</span>
            <Link
              href="/dashboard"
              className="text-sm font-bold text-gray-500 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-gray-700">/</span>
            <h1 className="text-sm font-black text-white">Caption AI</h1>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-8">
        <div className="flex gap-6">
          <button
            onClick={() => setTab("generate")}
            className={`py-3 text-sm font-bold border-b-2 transition-colors ${
              tab === "generate"
                ? "border-[#D73F09] text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Generate Captions
          </button>
          <button
            onClick={() => setTab("voice")}
            className={`py-3 text-sm font-bold border-b-2 transition-colors ${
              tab === "voice"
                ? "border-[#D73F09] text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Voice Settings
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {tab === "generate" ? <GenerateTab /> : <VoiceTab />}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  TAB 1 — Generate Captions                                         */
/* ================================================================== */

function GenerateTab() {
  const [assetName, setAssetName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [campaignContext, setCampaignContext] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlatformCaption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copiedKey, copy } = useCopy();

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerate = async () => {
    if (!assetName || !athleteName || platforms.length === 0) {
      setError("Please fill in asset name, athlete name, and select at least one platform.");
      return;
    }
    setError(null);
    setLoading(true);
    setResults(null);

    try {
      const res = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_name: assetName,
          athlete_name: athleteName,
          campaign_context: campaignContext,
          platforms,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate captions");
      }

      const data = await res.json();
      setResults(data.captions ?? data);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Form */}
      <div className="space-y-5">
        {/* Asset Name */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-1">
            Asset Name
          </label>
          <input
            type="text"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            placeholder="e.g. Gameday Hype Reel"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#D73F09] focus:ring-1 focus:ring-[#D73F09] outline-none transition-colors"
          />
        </div>

        {/* Athlete Name */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-1">
            Athlete Name
          </label>
          <input
            type="text"
            value={athleteName}
            onChange={(e) => setAthleteName(e.target.value)}
            placeholder="e.g. Jaylen Carter"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#D73F09] focus:ring-1 focus:ring-[#D73F09] outline-none transition-colors"
          />
        </div>

        {/* Campaign Context */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-1">
            Campaign Context
          </label>
          <textarea
            value={campaignContext}
            onChange={(e) => setCampaignContext(e.target.value)}
            rows={3}
            placeholder="Describe the campaign, brand, goals, tone..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#D73F09] focus:ring-1 focus:ring-[#D73F09] outline-none transition-colors resize-y"
          />
        </div>

        {/* Platform Checkboxes */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            Platforms
          </label>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <label
                key={p}
                className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  platforms.includes(p)
                    ? "border-[#D73F09] bg-[#D73F09]/10 text-white"
                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={platforms.includes(p)}
                  onChange={() => togglePlatform(p)}
                  className="sr-only"
                />
                <span
                  className={`h-4 w-4 rounded border flex items-center justify-center ${
                    platforms.includes(p)
                      ? "border-[#D73F09] bg-[#D73F09]"
                      : "border-gray-600 bg-gray-700"
                  }`}
                >
                  {platforms.includes(p) && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                {p}
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-[#D73F09] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#b83508] disabled:opacity-50 transition-colors"
        >
          {loading && (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                fill="currentColor"
                className="opacity-75"
              />
            </svg>
          )}
          {loading ? "Generating..." : "Generate Captions"}
        </button>
      </div>

      {/* Results */}
      {results && results.length > 0 && (
        <div className="mt-10 space-y-6">
          <h2 className="text-lg font-black text-white">Generated Captions</h2>
          {results.map((cap) => (
            <div
              key={cap.platform}
              className="rounded-xl border border-gray-700 bg-gray-800 p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-white">{cap.platform}</h3>

              {/* Short caption */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Short Caption
                  </span>
                  <button
                    onClick={() =>
                      copy(cap.short_caption, `${cap.platform}-short`)
                    }
                    className="text-xs font-bold text-[#D73F09] hover:text-[#b83508] transition-colors"
                  >
                    {copiedKey === `${cap.platform}-short`
                      ? "Copied!"
                      : "Copy Short"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={cap.short_caption}
                  rows={2}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 resize-none outline-none"
                />
              </div>

              {/* Long caption */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Long Caption
                  </span>
                  <button
                    onClick={() =>
                      copy(cap.long_caption, `${cap.platform}-long`)
                    }
                    className="text-xs font-bold text-[#D73F09] hover:text-[#b83508] transition-colors"
                  >
                    {copiedKey === `${cap.platform}-long`
                      ? "Copied!"
                      : "Copy Long"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={cap.long_caption}
                  rows={4}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 resize-none outline-none"
                />
              </div>

              {/* Hashtags */}
              {cap.hashtags && cap.hashtags.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Hashtags
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {cap.hashtags.map((h) => (
                      <span
                        key={h}
                        className="rounded-full bg-[#D73F09]/15 border border-[#D73F09]/30 px-3 py-0.5 text-xs font-medium text-[#D73F09]"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mentions */}
              {cap.mentions && cap.mentions.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Mentions
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {cap.mentions.map((m) => (
                      <span
                        key={m}
                        className="text-xs font-medium text-gray-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  TAB 2 — Voice Settings                                            */
/* ================================================================== */

function VoiceTab() {
  const [settings, setSettings] = useState<VoiceSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from("voice_settings")
        .select("*")
        .order("channel_name");

      if (!error && data) {
        setSettings(
          data.map((d: any) => ({
            id: d.id,
            channel_name: d.channel_name ?? "",
            system_prompt: d.system_prompt ?? "",
            tone_notes: d.tone_notes ?? "",
            example_captions: d.example_captions ?? [],
            forbidden_phrases: d.forbidden_phrases ?? [],
            active: d.active ?? true,
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateField = (id: string, field: keyof VoiceSetting, value: any) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async (setting: VoiceSetting) => {
    setSavingId(setting.id);
    setSaveMsg(null);

    try {
      const res = await fetch("/api/captions/voice-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: setting.id,
          system_prompt: setting.system_prompt,
          tone_notes: setting.tone_notes,
          example_captions: setting.example_captions,
          forbidden_phrases: setting.forbidden_phrases,
          active: setting.active,
        }),
      });

      if (!res.ok) throw new Error("Save failed");
      setSaveMsg(setting.id);
      setTimeout(() => setSaveMsg(null), 2000);
    } catch {
      alert("Failed to save voice settings.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            fill="currentColor"
            className="opacity-75"
          />
        </svg>
        Loading voice settings...
      </div>
    );
  }

  if (settings.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No voice settings found. Add channels in the database to configure them
        here.
      </p>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {settings.map((s) => (
        <div
          key={s.id}
          className="rounded-xl border border-gray-700 bg-gray-800 p-6 space-y-4"
        >
          {/* Header row */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {s.channel_name}
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-gray-400">
                {s.active ? "Active" : "Inactive"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={s.active}
                onClick={() => updateField(s.id, "active", !s.active)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  s.active ? "bg-[#D73F09]" : "bg-gray-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    s.active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
              System Prompt
            </label>
            <textarea
              value={s.system_prompt}
              onChange={(e) =>
                updateField(s.id, "system_prompt", e.target.value)
              }
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-[#D73F09] focus:ring-1 focus:ring-[#D73F09] outline-none resize-y transition-colors"
            />
          </div>

          {/* Tone Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
              Tone Notes
            </label>
            <textarea
              value={s.tone_notes}
              onChange={(e) => updateField(s.id, "tone_notes", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-[#D73F09] focus:ring-1 focus:ring-[#D73F09] outline-none resize-y transition-colors"
            />
          </div>

          {/* Example Captions */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
              Example Captions
            </label>
            <ListEditor
              items={s.example_captions}
              onChange={(items) =>
                updateField(s.id, "example_captions", items)
              }
              placeholder="Add an example caption..."
            />
          </div>

          {/* Forbidden Phrases */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
              Forbidden Phrases
            </label>
            <ListEditor
              items={s.forbidden_phrases}
              onChange={(items) =>
                updateField(s.id, "forbidden_phrases", items)
              }
              placeholder="Add a forbidden phrase..."
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave(s)}
              disabled={savingId === s.id}
              className="rounded-lg bg-[#D73F09] px-5 py-2 text-sm font-bold text-white hover:bg-[#b83508] disabled:opacity-50 transition-colors"
            >
              {savingId === s.id ? "Saving..." : "Save"}
            </button>
            {saveMsg === s.id && (
              <span className="text-xs font-bold text-green-400">Saved!</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  List Editor (for example_captions / forbidden_phrases)            */
/* ================================================================== */

function ListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const update = (idx: number, value: string) => {
    onChange(items.map((item, i) => (i === idx ? value : item)));
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => update(idx, e.target.value)}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 focus:border-[#D73F09] focus:ring-1 focus:ring-[#D73F09] outline-none transition-colors"
          />
          <button
            onClick={() => remove(idx)}
            className="text-gray-500 hover:text-red-400 transition-colors"
            title="Remove"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-[#D73F09] focus:ring-1 focus:ring-[#D73F09] outline-none transition-colors"
        />
        <button
          onClick={add}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-bold text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
