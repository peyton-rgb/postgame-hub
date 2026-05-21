// ============================================================
// ContentStrategyPanel — embedded in /dashboard/publishing
//
// Three sub-tabs:
//   1. Platform Strategy — shows each platform's role, content
//      mix, gaps, and quick wins
//   2. Weekly Calendar — AI-generated 7-day content plan per
//      platform
//   3. Suggest Content — on-demand AI suggestions with a
//      "generate" button
//
// All data comes from /api/content-suggestions
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';

// --- Types (matching the API / agent types) ---

interface ContentMixItem {
  type: string;
  percentage: number;
  description: string;
}

interface PlatformConfig {
  key: string;
  label: string;
  role: string;
  icon: string;
  color: string;
  contentPillars: string[];
  postingCadence: string;
  bestTimes: string;
  contentMix: ContentMixItem[];
}

interface ContentSuggestion {
  id: string;
  platform: string;
  contentType: string;
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  priority: 'high' | 'medium' | 'low';
  suggestedDate?: string;
  relatedAthlete?: string;
  relatedBrand?: string;
  assetNotes: string;
  reasoning: string;
}

interface ContentGap {
  platform: string;
  gap: string;
  impact: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

interface WeeklyCalendar {
  platform: string;
  week: { day: string; date: string; suggestions: ContentSuggestion[] }[];
}

// --- Platform tab config ---

const PLATFORM_TABS = [
  { key: 'instagram', label: 'Instagram', icon: 'IG', color: 'bg-pink-600', textColor: 'text-pink-400', borderColor: 'border-pink-600/30', bgColor: 'bg-pink-600/10' },
  { key: 'tiktok', label: 'TikTok', icon: 'TT', color: 'bg-gray-700', textColor: 'text-gray-300', borderColor: 'border-gray-600/30', bgColor: 'bg-gray-700/10' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'LI', color: 'bg-blue-700', textColor: 'text-blue-400', borderColor: 'border-blue-600/30', bgColor: 'bg-blue-600/10' },
  { key: 'youtube', label: 'YouTube', icon: 'YT', color: 'bg-red-600', textColor: 'text-red-400', borderColor: 'border-red-600/30', bgColor: 'bg-red-600/10' },
  { key: 'twitter/x', label: 'Twitter/X', icon: 'X', color: 'bg-gray-700', textColor: 'text-gray-300', borderColor: 'border-gray-600/30', bgColor: 'bg-gray-700/10' },
];

const PRIORITY_BADGES: Record<string, { label: string; classes: string }> = {
  high: { label: 'High', classes: 'bg-red-600/20 text-red-300 border-red-600/30' },
  medium: { label: 'Med', classes: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30' },
  low: { label: 'Low', classes: 'bg-gray-600/20 text-gray-400 border-gray-600/30' },
};

export default function ContentStrategyPanel() {
  // --- State ---
  const [activeSubTab, setActiveSubTab] = useState<'strategy' | 'calendar' | 'suggest'>('strategy');
  const [selectedPlatform, setSelectedPlatform] = useState('instagram');
  const [platforms, setPlatforms] = useState<Record<string, PlatformConfig>>({});
  const [gaps, setGaps] = useState<ContentGap[]>([]);
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [calendar, setCalendar] = useState<WeeklyCalendar | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(true);
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);

  // Approve/Deny workflow state
  const [approvingItem, setApprovingItem] = useState<ContentSuggestion | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('12:00');
  const [approving, setApproving] = useState(false);
  const [denyingItem, setDenyingItem] = useState<ContentSuggestion | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [denying, setDenying] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Track which suggestions have been acted on (approved/denied)
  const [actedOn, setActedOn] = useState<Record<string, 'approved' | 'denied'>>({});
  // Caption variants state
  const [generatingVariants, setGeneratingVariants] = useState<string | null>(null);
  const [variants, setVariants] = useState<Record<string, { short: string; medium: string; long: string }>>({});
  const [selectedVariant, setSelectedVariant] = useState<Record<string, 'original' | 'short' | 'medium' | 'long'>>({});

  // --- Fetch platform strategy (static data) ---
  useEffect(() => {
    async function fetchStrategy() {
      setLoadingStrategy(true);
      try {
        const res = await fetch('/api/content-suggestions?type=strategy');
        if (res.ok) {
          const data = await res.json();
          setPlatforms(data.platforms || {});
        }
      } catch (err) {
        console.error('Failed to fetch strategy:', err);
      }
      setLoadingStrategy(false);
    }
    fetchStrategy();
  }, []);

  // --- Fetch content gaps ---
  const fetchGaps = useCallback(async () => {
    setLoadingGaps(true);
    try {
      const res = await fetch('/api/content-suggestions?type=gaps');
      if (res.ok) {
        const data = await res.json();
        setGaps(data.gaps || []);
      }
    } catch (err) {
      console.error('Failed to fetch gaps:', err);
    }
    setLoadingGaps(false);
  }, []);

  // --- Generate on-demand suggestions ---
  const generateSuggestions = async (platform: string) => {
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      // 45-second timeout so the spinner doesn't run forever
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const res = await fetch('/api/content-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest', platform, count: 8 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (res.ok) {
        setSuggestions(data.suggestions || []);
      } else {
        setToast({ message: `Error: ${data.error || 'Failed to generate suggestions'}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error('Failed to generate suggestions:', err);
      const message = err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out — the AI took too long. Try again.'
        : 'Network error — could not reach the API';
      setToast({ message, type: 'error' });
    }
    setLoadingSuggestions(false);
  };

  // --- Generate weekly calendar ---
  const generateCalendar = async (platform: string) => {
    setLoadingCalendar(true);
    setCalendar(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const res = await fetch('/api/content-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calendar', platform }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (res.ok) {
        setCalendar(data.calendar || null);
      } else {
        setToast({ message: `Error: ${data.error || 'Failed to generate calendar'}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error('Failed to generate calendar:', err);
      const message = err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out — the AI took too long. Try again.'
        : 'Network error — could not reach the API';
      setToast({ message, type: 'error' });
    }
    setLoadingCalendar(false);
  };

  // --- Copy caption to clipboard ---
  const copyCaption = (caption: string, id: string) => {
    navigator.clipboard.writeText(caption);
    setCopiedCaption(id);
    setTimeout(() => setCopiedCaption(null), 2000);
  };

  // --- Approve suggestion ---
  const handleApprove = async () => {
    if (!approvingItem) return;
    setApproving(true);
    setActionMessage(null);

    // Determine which caption to use (original or a variant)
    const variantKey = selectedVariant[approvingItem.id] || 'original';
    let captionToUse = approvingItem.caption;
    if (variantKey !== 'original' && variants[approvingItem.id]) {
      captionToUse = variants[approvingItem.id][variantKey as 'short' | 'medium' | 'long'];
    }

    const suggestionWithCaption = { ...approvingItem, caption: captionToUse };

    try {
      const scheduledFor = scheduleDate
        ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
        : null;

      const res = await fetch('/api/content-suggestions/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          suggestion: suggestionWithCaption,
          scheduledFor,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionMessage({ type: 'success', text: data.message });
        setActedOn(prev => ({ ...prev, [approvingItem.id]: 'approved' }));
        setApprovingItem(null);
        setScheduleDate('');
        setScheduleTime('12:00');
      } else {
        const data = await res.json();
        setActionMessage({ type: 'error', text: data.error || 'Failed to approve' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error — try again' });
    }
    setApproving(false);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // --- Deny suggestion ---
  const handleDeny = async () => {
    if (!denyingItem) return;
    setDenying(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/content-suggestions/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deny',
          suggestion: denyingItem,
          reason: denyReason || undefined,
        }),
      });

      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Suggestion denied' });
        setActedOn(prev => ({ ...prev, [denyingItem.id]: 'denied' }));
        setDenyingItem(null);
        setDenyReason('');
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error — try again' });
    }
    setDenying(false);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // --- Generate caption variants ---
  const handleGenerateVariants = async (suggestion: ContentSuggestion) => {
    setGeneratingVariants(suggestion.id);
    try {
      const res = await fetch('/api/content-suggestions/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-variants',
          suggestion,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.variants?.captions) {
          setVariants(prev => ({ ...prev, [suggestion.id]: data.variants.captions }));
        }
      }
    } catch {
      console.error('Failed to generate variants');
    }
    setGeneratingVariants(null);
  };

  // --- Current platform data ---
  const currentPlatform = platforms[selectedPlatform];
  const platformGaps = gaps.filter(g => g.platform === selectedPlatform);
  const platformTab = PLATFORM_TABS.find(p => p.key === selectedPlatform) || PLATFORM_TABS[0];

  return (
    <div className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-[#D73F09]">&#9733;</span>
              Content Strategy
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              AI-powered posting suggestions based on your pipeline
            </p>
          </div>
        </div>

        {/* Sub-tabs: Strategy | Calendar | Suggest */}
        <div className="flex gap-1 bg-[#0f0f0f] rounded-lg p-1">
          {[
            { key: 'strategy' as const, label: 'Platform Strategy' },
            { key: 'calendar' as const, label: 'Weekly Calendar' },
            { key: 'suggest' as const, label: 'Suggest Content' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                activeSubTab === tab.key
                  ? 'bg-[#D73F09]/20 text-[#D73F09]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Platform selector (shared across all sub-tabs) */}
      <div className="px-6 py-3 border-b border-gray-800 flex gap-2 overflow-x-auto">
        {PLATFORM_TABS.map(p => (
          <button
            key={p.key}
            onClick={() => setSelectedPlatform(p.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedPlatform === p.key
                ? `${p.bgColor} ${p.textColor} border ${p.borderColor}`
                : 'text-gray-500 border border-transparent hover:border-gray-700 hover:text-gray-300'
            }`}
          >
            <span className={`w-5 h-5 rounded-full ${p.color} flex items-center justify-center text-[8px] font-bold text-white`}>
              {p.icon}
            </span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="p-6">
        {loadingStrategy ? (
          <div className="text-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-[#D73F09] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading strategy...</p>
          </div>
        ) : (
          <>
            {/* ===== PLATFORM STRATEGY TAB ===== */}
            {activeSubTab === 'strategy' && currentPlatform && (
              <div className="space-y-6">
                {/* Platform role */}
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${platformTab.color} flex items-center justify-center text-lg font-bold text-white flex-shrink-0`}>
                    {platformTab.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{currentPlatform.label}</h3>
                    <p className="text-gray-400 mt-0.5">{currentPlatform.role}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>Cadence: <span className="text-gray-300">{currentPlatform.postingCadence}</span></span>
                      <span>Best times: <span className="text-gray-300">{currentPlatform.bestTimes}</span></span>
                    </div>
                  </div>
                </div>

                {/* Content mix breakdown */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Recommended Content Mix</h4>
                  <div className="space-y-3">
                    {currentPlatform.contentMix.map((mix) => (
                      <div key={mix.type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-300">{mix.type}</span>
                          <span className={`text-xs font-mono ${platformTab.textColor}`}>{mix.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                          <div
                            className={`h-2 rounded-full ${platformTab.color} opacity-70`}
                            style={{ width: `${mix.percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600">{mix.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content pillars */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Content Pillars</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentPlatform.contentPillars.map((pillar) => (
                      <span
                        key={pillar}
                        className={`px-3 py-1.5 rounded-lg text-xs ${platformTab.bgColor} ${platformTab.textColor} border ${platformTab.borderColor}`}
                      >
                        {pillar}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Content gaps (AI-powered) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-300">Content Gaps</h4>
                    <button
                      onClick={fetchGaps}
                      disabled={loadingGaps}
                      className="px-3 py-1 text-xs text-[#D73F09] border border-[#D73F09]/30 rounded-lg hover:bg-[#D73F09]/10 transition disabled:opacity-50"
                    >
                      {loadingGaps ? 'Analyzing...' : 'Analyze Gaps'}
                    </button>
                  </div>

                  {loadingGaps ? (
                    <div className="flex items-center gap-2 py-4">
                      <div className="animate-spin w-4 h-4 border-2 border-[#D73F09] border-t-transparent rounded-full" />
                      <span className="text-sm text-gray-500">AI is analyzing your content gaps...</span>
                    </div>
                  ) : platformGaps.length > 0 ? (
                    <div className="space-y-2">
                      {platformGaps.map((gap, i) => (
                        <div key={i} className="p-3 bg-[#0f0f0f] rounded-lg border border-gray-800">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-200 font-medium">{gap.gap}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${PRIORITY_BADGES[gap.priority]?.classes || ''}`}>
                              {PRIORITY_BADGES[gap.priority]?.label || gap.priority}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{gap.impact}</p>
                          <p className="text-xs text-[#D73F09] mt-1.5">{gap.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  ) : gaps.length > 0 ? (
                    <p className="text-sm text-gray-600 py-2">No specific gaps found for {currentPlatform.label}.</p>
                  ) : (
                    <p className="text-sm text-gray-600 py-2">Click &quot;Analyze Gaps&quot; to identify what&apos;s missing from your content.</p>
                  )}
                </div>
              </div>
            )}

            {/* ===== WEEKLY CALENDAR TAB ===== */}
            {activeSubTab === 'calendar' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Weekly Calendar — {PLATFORM_TABS.find(p => p.key === selectedPlatform)?.label}
                    </h3>
                    <p className="text-gray-500 text-sm mt-0.5">
                      AI-generated 7-day content plan based on your pipeline
                    </p>
                  </div>
                  <button
                    onClick={() => generateCalendar(selectedPlatform)}
                    disabled={loadingCalendar}
                    className="px-4 py-2 bg-[#D73F09] hover:bg-[#b33507] rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingCalendar ? 'Generating...' : 'Generate Calendar'}
                  </button>
                </div>

                {loadingCalendar ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-[#D73F09] border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">AI is planning your week...</p>
                    <p className="text-gray-600 text-xs mt-1">This takes about 10-15 seconds</p>
                  </div>
                ) : calendar && calendar.platform === selectedPlatform ? (
                  <div className="space-y-3">
                    {calendar.week.map((day) => (
                      <div key={day.date} className="bg-[#0f0f0f] rounded-lg border border-gray-800 overflow-hidden">
                        {/* Day header */}
                        <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-200">{day.day}</span>
                            <span className="text-xs text-gray-500">{day.date}</span>
                          </div>
                          <span className="text-xs text-gray-600">{day.suggestions.length} post{day.suggestions.length !== 1 ? 's' : ''}</span>
                        </div>

                        {/* Suggestions for this day */}
                        {day.suggestions.map((s) => (
                          <div key={s.id} className="px-4 py-3 border-b border-gray-800/50 last:border-0">
                            <div
                              className="flex items-start justify-between gap-3 cursor-pointer"
                              onClick={() => setExpandedSuggestion(expandedSuggestion === s.id ? null : s.id)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${platformTab.bgColor} ${platformTab.textColor}`}>
                                    {s.contentType}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${PRIORITY_BADGES[s.priority]?.classes || ''}`}>
                                    {PRIORITY_BADGES[s.priority]?.label || s.priority}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-200 font-medium mt-1">{s.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                              </div>
                              <span className={`text-gray-600 text-xs transition-transform ${expandedSuggestion === s.id ? 'rotate-180' : ''}`}>
                                &#9660;
                              </span>
                            </div>

                            {/* Expanded details */}
                            {expandedSuggestion === s.id && (
                              <div className="mt-3 pt-3 border-t border-gray-800/50 space-y-3">
                                {/* Caption */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-500">Caption</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); copyCaption(s.caption, s.id); }}
                                      className="text-xs text-[#D73F09] hover:text-[#e8663d] transition"
                                    >
                                      {copiedCaption === s.id ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>
                                  <p className="text-sm text-gray-300 whitespace-pre-line bg-black/30 rounded-lg p-3 border border-gray-800">
                                    {s.caption}
                                  </p>
                                </div>

                                {/* Hashtags */}
                                {s.hashtags.length > 0 && (
                                  <div>
                                    <span className="text-xs text-gray-500">Hashtags</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {s.hashtags.map(h => (
                                        <span key={h} className="px-2 py-0.5 bg-blue-600/10 border border-blue-600/20 rounded-full text-xs text-blue-300">
                                          #{h}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Meta row */}
                                <div className="flex flex-wrap gap-4 text-xs">
                                  {s.relatedAthlete && (
                                    <span className="text-gray-500">Athlete: <span className="text-gray-300">{s.relatedAthlete}</span></span>
                                  )}
                                  {s.relatedBrand && (
                                    <span className="text-gray-500">Brand: <span className="text-gray-300">{s.relatedBrand}</span></span>
                                  )}
                                </div>

                                {/* Asset notes */}
                                {s.assetNotes && (
                                  <div>
                                    <span className="text-xs text-gray-500">Asset needed</span>
                                    <p className="text-xs text-gray-400 mt-0.5">{s.assetNotes}</p>
                                  </div>
                                )}

                                {/* Reasoning */}
                                {s.reasoning && (
                                  <div className="p-2 bg-[#D73F09]/5 border border-[#D73F09]/10 rounded-lg">
                                    <span className="text-xs text-[#D73F09]/70">Why this post:</span>
                                    <p className="text-xs text-gray-400 mt-0.5">{s.reasoning}</p>
                                  </div>
                                )}

                                {/* Caption variants */}
                                {variants[s.id] && (
                                  <div>
                                    <span className="text-xs text-gray-500 mb-2 block">Caption Variants</span>
                                    <div className="space-y-2">
                                      {(['original', 'short', 'medium', 'long'] as const).map(v => (
                                        <label key={v} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer border transition ${
                                          (selectedVariant[s.id] || 'original') === v
                                            ? 'border-[#D73F09]/40 bg-[#D73F09]/5'
                                            : 'border-gray-800 hover:border-gray-700'
                                        }`}>
                                          <input
                                            type="radio"
                                            name={`variant-${s.id}`}
                                            checked={(selectedVariant[s.id] || 'original') === v}
                                            onChange={() => setSelectedVariant(prev => ({ ...prev, [s.id]: v }))}
                                            className="mt-1 accent-[#D73F09]"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <span className="text-xs font-medium text-gray-300 capitalize">{v}</span>
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                              {v === 'original' ? s.caption : variants[s.id][v]}
                                            </p>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Action buttons */}
                                {actedOn[s.id] ? (
                                  <div className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${
                                    actedOn[s.id] === 'approved'
                                      ? 'bg-green-600/10 text-green-400 border border-green-600/20'
                                      : 'bg-red-600/10 text-red-400 border border-red-600/20'
                                  }`}>
                                    {actedOn[s.id] === 'approved' ? 'Approved — added to queue' : 'Denied'}
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setApprovingItem(s); }}
                                      className="px-4 py-1.5 bg-green-600/10 text-green-400 border border-green-600/20 rounded-lg text-xs font-medium hover:bg-green-600/20 transition"
                                    >
                                      Approve & Schedule
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDenyingItem(s); }}
                                      className="px-4 py-1.5 bg-red-600/10 text-red-400 border border-red-600/20 rounded-lg text-xs font-medium hover:bg-red-600/20 transition"
                                    >
                                      Deny
                                    </button>
                                    {!variants[s.id] && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleGenerateVariants(s); }}
                                        disabled={generatingVariants === s.id}
                                        className="px-4 py-1.5 bg-purple-600/10 text-purple-400 border border-purple-600/20 rounded-lg text-xs font-medium hover:bg-purple-600/20 transition disabled:opacity-50"
                                      >
                                        {generatingVariants === s.id ? 'Generating...' : 'Generate Variants'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-gray-800 rounded-xl bg-[#0f0f0f]">
                    <div className="text-3xl mb-3 text-gray-700">&#128197;</div>
                    <p className="text-gray-400 font-medium">No calendar generated yet</p>
                    <p className="text-gray-600 text-sm mt-1">
                      Click &quot;Generate Calendar&quot; to create a 7-day content plan for {PLATFORM_TABS.find(p => p.key === selectedPlatform)?.label}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ===== SUGGEST CONTENT TAB ===== */}
            {activeSubTab === 'suggest' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Content Suggestions</h3>
                    <p className="text-gray-500 text-sm mt-0.5">
                      AI generates fresh post ideas from your pipeline data
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateSuggestions(selectedPlatform)}
                      disabled={loadingSuggestions}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${platformTab.bgColor} ${platformTab.textColor} border ${platformTab.borderColor} hover:opacity-80`}
                    >
                      {loadingSuggestions ? 'Generating...' : `Suggest for ${PLATFORM_TABS.find(p => p.key === selectedPlatform)?.label}`}
                    </button>
                    <button
                      onClick={() => generateSuggestions('all')}
                      disabled={loadingSuggestions}
                      className="px-4 py-2 bg-[#D73F09] hover:bg-[#b33507] rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingSuggestions ? 'Generating...' : 'All Platforms'}
                    </button>
                  </div>
                </div>

                {loadingSuggestions ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-[#D73F09] border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">AI is crafting content ideas...</p>
                    <p className="text-gray-600 text-xs mt-1">Analyzing your briefs, athletes, and brands</p>
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="space-y-3">
                    {suggestions.map((s) => {
                      const sPlatformTab = PLATFORM_TABS.find(p => p.key === s.platform) || PLATFORM_TABS[0];
                      return (
                        <div key={s.id} className="bg-[#0f0f0f] rounded-lg border border-gray-800 overflow-hidden">
                          <div
                            className="px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition"
                            onClick={() => setExpandedSuggestion(expandedSuggestion === s.id ? null : s.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`w-5 h-5 rounded-full ${sPlatformTab.color} flex items-center justify-center text-[8px] font-bold text-white`}>
                                    {sPlatformTab.icon}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sPlatformTab.bgColor} ${sPlatformTab.textColor}`}>
                                    {s.contentType}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${PRIORITY_BADGES[s.priority]?.classes || ''}`}>
                                    {PRIORITY_BADGES[s.priority]?.label || s.priority}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-200 font-medium">{s.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                                {(s.relatedAthlete || s.relatedBrand) && (
                                  <div className="flex gap-3 mt-1 text-xs text-gray-600">
                                    {s.relatedAthlete && <span>Athlete: {s.relatedAthlete}</span>}
                                    {s.relatedBrand && <span>Brand: {s.relatedBrand}</span>}
                                  </div>
                                )}
                              </div>
                              <span className={`text-gray-600 text-xs transition-transform ${expandedSuggestion === s.id ? 'rotate-180' : ''}`}>
                                &#9660;
                              </span>
                            </div>
                          </div>

                          {/* Expanded */}
                          {expandedSuggestion === s.id && (
                            <div className="px-4 pb-4 pt-2 border-t border-gray-800/50 space-y-3">
                              {/* Caption */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-500">Ready-to-use Caption</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyCaption(s.caption, s.id); }}
                                    className="text-xs text-[#D73F09] hover:text-[#e8663d] transition"
                                  >
                                    {copiedCaption === s.id ? 'Copied!' : 'Copy caption'}
                                  </button>
                                </div>
                                <p className="text-sm text-gray-300 whitespace-pre-line bg-black/30 rounded-lg p-3 border border-gray-800">
                                  {s.caption}
                                </p>
                              </div>

                              {/* Hashtags */}
                              {s.hashtags.length > 0 && (
                                <div>
                                  <span className="text-xs text-gray-500">Hashtags</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {s.hashtags.map(h => (
                                      <span key={h} className="px-2 py-0.5 bg-blue-600/10 border border-blue-600/20 rounded-full text-xs text-blue-300">
                                        #{h}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Asset notes */}
                              {s.assetNotes && (
                                <div>
                                  <span className="text-xs text-gray-500">Asset needed</span>
                                  <p className="text-xs text-gray-400 mt-0.5">{s.assetNotes}</p>
                                </div>
                              )}

                              {/* Reasoning */}
                              {s.reasoning && (
                                <div className="p-2 bg-[#D73F09]/5 border border-[#D73F09]/10 rounded-lg">
                                  <span className="text-xs text-[#D73F09]/70">Why this post:</span>
                                  <p className="text-xs text-gray-400 mt-0.5">{s.reasoning}</p>
                                </div>
                              )}

                              {/* Caption variants */}
                              {variants[s.id] && (
                                <div>
                                  <span className="text-xs text-gray-500 mb-2 block">Caption Variants</span>
                                  <div className="space-y-2">
                                    {(['original', 'short', 'medium', 'long'] as const).map(v => (
                                      <label key={v} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer border transition ${
                                        (selectedVariant[s.id] || 'original') === v
                                          ? 'border-[#D73F09]/40 bg-[#D73F09]/5'
                                          : 'border-gray-800 hover:border-gray-700'
                                      }`}>
                                        <input
                                          type="radio"
                                          name={`variant-suggest-${s.id}`}
                                          checked={(selectedVariant[s.id] || 'original') === v}
                                          onChange={() => setSelectedVariant(prev => ({ ...prev, [s.id]: v }))}
                                          className="mt-1 accent-[#D73F09]"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-xs font-medium text-gray-300 capitalize">{v}</span>
                                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                            {v === 'original' ? s.caption : variants[s.id][v]}
                                          </p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              {actedOn[s.id] ? (
                                <div className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${
                                  actedOn[s.id] === 'approved'
                                    ? 'bg-green-600/10 text-green-400 border border-green-600/20'
                                    : 'bg-red-600/10 text-red-400 border border-red-600/20'
                                }`}>
                                  {actedOn[s.id] === 'approved' ? 'Approved — added to queue' : 'Denied'}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setApprovingItem(s); }}
                                    className="px-4 py-1.5 bg-green-600/10 text-green-400 border border-green-600/20 rounded-lg text-xs font-medium hover:bg-green-600/20 transition"
                                  >
                                    Approve & Schedule
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDenyingItem(s); }}
                                    className="px-4 py-1.5 bg-red-600/10 text-red-400 border border-red-600/20 rounded-lg text-xs font-medium hover:bg-red-600/20 transition"
                                  >
                                    Deny
                                  </button>
                                  {!variants[s.id] && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleGenerateVariants(s); }}
                                      disabled={generatingVariants === s.id}
                                      className="px-4 py-1.5 bg-purple-600/10 text-purple-400 border border-purple-600/20 rounded-lg text-xs font-medium hover:bg-purple-600/20 transition disabled:opacity-50"
                                    >
                                      {generatingVariants === s.id ? 'Generating...' : 'Generate Variants'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-gray-800 rounded-xl bg-[#0f0f0f]">
                    <div className="text-3xl mb-3 text-gray-700">&#128161;</div>
                    <p className="text-gray-400 font-medium">Ready to suggest content</p>
                    <p className="text-gray-600 text-sm mt-1">
                      Click a button above to generate post ideas based on your current briefs, athletes, and brands
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== ACTION MESSAGE TOAST ===== */}
      {actionMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
          actionMessage.type === 'success'
            ? 'bg-green-600/20 text-green-300 border-green-600/30'
            : 'bg-red-600/20 text-red-300 border-red-600/30'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* ===== APPROVE / SCHEDULE MODAL ===== */}
      {approvingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-1">Approve & Schedule</h3>
            <p className="text-sm text-gray-400 mb-4">{approvingItem.title}</p>

            {/* Caption preview */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">
                Caption {selectedVariant[approvingItem.id] && selectedVariant[approvingItem.id] !== 'original'
                  ? `(${selectedVariant[approvingItem.id]} variant)`
                  : '(original)'}
              </p>
              <p className="text-xs text-gray-400 bg-black/30 rounded-lg p-2 border border-gray-800 line-clamp-3">
                {(() => {
                  const vKey = selectedVariant[approvingItem.id] || 'original';
                  if (vKey !== 'original' && variants[approvingItem.id]) {
                    return variants[approvingItem.id][vKey as 'short' | 'medium' | 'long'];
                  }
                  return approvingItem.caption;
                })()}
              </p>
            </div>

            {/* Schedule inputs */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Date (optional — skip to approve without scheduling)</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#D73F09]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#D73F09]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setApprovingItem(null); setScheduleDate(''); setScheduleTime('12:00'); }}
                className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition"
              >
                {approving ? 'Approving...' : scheduleDate ? 'Approve & Schedule' : 'Approve (Schedule Later)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DENY MODAL ===== */}
      {denyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-1">Deny Suggestion</h3>
            <p className="text-sm text-gray-400 mb-4">{denyingItem.title}</p>

            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-1.5">Reason (optional)</label>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="e.g. Wrong timing, not on-brand, asset not available..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#D73F09] resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setDenyingItem(null); setDenyReason(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeny}
                disabled={denying}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition"
              >
                {denying ? 'Denying...' : 'Deny Suggestion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
