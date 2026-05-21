// ============================================================
// Performance Tracking Dashboard — /dashboard/performance
//
// Station 5 main page. Shows asset performance metrics in a
// card grid with filtering by platform, campaign, athlete,
// tier, and date range. Top stats bar shows totals. Cards
// expand to show full metrics and tier rationale. CMs can
// manually log D7/D30 data and trigger AI scoring.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

interface InspoItem {
  id: string;
  thumbnail_url: string | null;
  file_url: string | null;
  content_type: string;
  visual_description: string | null;
  sport: string | null;
  mime_type: string | null;
}

interface AssetMetric {
  id: string;
  created_at: string;
  inspo_item_id: string;
  live_url: string | null;
  platform: string | null;
  posted_at: string | null;
  d7_logged_at: string | null;
  d7_views: number | null;
  d7_likes: number | null;
  d7_comments: number | null;
  d7_shares: number | null;
  d7_saves: number | null;
  d7_reach: number | null;
  d7_impressions: number | null;
  d7_engagement_rate: number | null;
  d30_logged_at: string | null;
  d30_views: number | null;
  d30_likes: number | null;
  d30_comments: number | null;
  d30_shares: number | null;
  d30_saves: number | null;
  d30_reach: number | null;
  d30_engagement_rate: number | null;
  performance_tier: string | null;
  tier_scored_at: string | null;
  tier_rationale: string | null;
  final_asset_id: string | null;
  campaign_id: string | null;
  athlete_name: string | null;
  inspo_item: InspoItem | null;
}

interface Aggregates {
  total_views: number;
  total_likes: number;
  total_engagements: number;
  avg_engagement_rate: number;
  count: number;
  top_tier_count: number;
}

// --- Tier badge config ---

const TIER_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  S: { label: 'S', bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  A: { label: 'A', bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  B: { label: 'B', bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  C: { label: 'C', bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
  D: { label: 'D', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
};

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter'];
const TIERS = ['S', 'A', 'B', 'C', 'D'];

// --- Helpers ---

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatRate(r: number | null | undefined): string {
  if (r == null) return '--';
  return Number(r).toFixed(2) + '%';
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function platformIcon(p: string | null): string {
  switch (p?.toLowerCase()) {
    case 'instagram': return 'IG';
    case 'tiktok': return 'TT';
    case 'youtube': return 'YT';
    case 'linkedin': return 'LI';
    case 'twitter': return 'X';
    default: return '--';
  }
}

export default function PerformancePage() {
  const supabase = createBrowserSupabase();

  // Data state
  const [metrics, setMetrics] = useState<AssetMetric[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates>({
    total_views: 0, total_likes: 0, total_engagements: 0,
    avg_engagement_rate: 0, count: 0, top_tier_count: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [platformFilter, setPlatformFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [athleteFilter, setAthleteFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('engagement');

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logTarget, setLogTarget] = useState<AssetMetric | null>(null);

  // Log modal form state
  const [logType, setLogType] = useState<'d7' | 'd30'>('d7');
  const [logViews, setLogViews] = useState('');
  const [logLikes, setLogLikes] = useState('');
  const [logComments, setLogComments] = useState('');
  const [logShares, setLogShares] = useState('');
  const [logSaves, setLogSaves] = useState('');
  const [logReach, setLogReach] = useState('');
  const [logImpressions, setLogImpressions] = useState('');
  const [logEngRate, setLogEngRate] = useState('');
  const [logSaving, setLogSaving] = useState(false);

  // Campaign list for dropdown
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);

  // Fetch campaigns for the filter dropdown
  useEffect(() => {
    async function loadCampaigns() {
      const { data } = await supabase
        .from('campaign_briefs')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setCampaigns(data);
    }
    loadCampaigns();
  }, [supabase]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50', offset: '0', sort: sortBy });
    if (platformFilter) params.set('platform', platformFilter);
    if (campaignFilter) params.set('campaign_id', campaignFilter);
    if (athleteFilter) params.set('athlete_name', athleteFilter);
    if (tierFilter) params.set('performance_tier', tierFilter);
    if (dateFrom) params.set('posted_after', dateFrom);
    if (dateTo) params.set('posted_before', dateTo);

    try {
      const res = await fetch(`/api/analytics?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.items || []);
        setTotal(data.total || 0);
        if (data.aggregates) setAggregates(data.aggregates);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
    setLoading(false);
  }, [platformFilter, campaignFilter, athleteFilter, tierFilter, dateFrom, dateTo, sortBy]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Score a single asset
  const handleScore = async (id: string) => {
    setScoringId(id);
    try {
      const res = await fetch(`/api/analytics/${id}/score`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        // Update local state
        setMetrics((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, performance_tier: result.tier, tier_rationale: result.rationale, tier_scored_at: result.scored_at }
              : m
          )
        );
      } else {
        const err = await res.json();
        alert(err.error || 'Scoring failed');
      }
    } catch (err) {
      console.error('Scoring error:', err);
      alert('Failed to score asset');
    }
    setScoringId(null);
  };

  // Log metrics
  const handleLogSave = async () => {
    if (!logTarget) return;
    setLogSaving(true);

    const prefix = logType === 'd7' ? 'd7' : 'd30';
    const payload: Record<string, unknown> = {};

    if (logViews) payload[`${prefix}_views`] = parseInt(logViews, 10);
    if (logLikes) payload[`${prefix}_likes`] = parseInt(logLikes, 10);
    if (logComments) payload[`${prefix}_comments`] = parseInt(logComments, 10);
    if (logShares) payload[`${prefix}_shares`] = parseInt(logShares, 10);
    if (logSaves) payload[`${prefix}_saves`] = parseInt(logSaves, 10);
    if (logReach) payload[`${prefix}_reach`] = parseInt(logReach, 10);
    if (logType === 'd7' && logImpressions) payload.d7_impressions = parseInt(logImpressions, 10);
    if (logEngRate) payload[`${prefix}_engagement_rate`] = parseFloat(logEngRate);

    try {
      const res = await fetch(`/api/analytics/${logTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setMetrics((prev) => prev.map((m) => (m.id === logTarget.id ? { ...m, ...updated } : m)));
        closeLogModal();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save metrics');
      }
    } catch (err) {
      console.error('Log save error:', err);
    }
    setLogSaving(false);
  };

  const openLogModal = (metric: AssetMetric) => {
    setLogTarget(metric);
    setLogType(metric.d7_logged_at ? 'd30' : 'd7');
    setLogViews('');
    setLogLikes('');
    setLogComments('');
    setLogShares('');
    setLogSaves('');
    setLogReach('');
    setLogImpressions('');
    setLogEngRate('');
    setShowLogModal(true);
  };

  const closeLogModal = () => {
    setShowLogModal(false);
    setLogTarget(null);
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Performance Tracking</h1>
          <p className="text-gray-400 mt-1">Track, score, and analyze content performance across platforms</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Views</p>
            <p className="text-2xl font-bold">{formatNumber(aggregates.total_views)}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Engagements</p>
            <p className="text-2xl font-bold">{formatNumber(aggregates.total_engagements)}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Avg Engagement Rate</p>
            <p className="text-2xl font-bold">{formatRate(aggregates.avg_engagement_rate)}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Top Tier (S+A)</p>
            <p className="text-2xl font-bold">{aggregates.top_tier_count}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Platform */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="">All Platforms</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>

            {/* Campaign */}
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>

            {/* Athlete */}
            <input
              type="text"
              placeholder="Athlete name..."
              value={athleteFilter}
              onChange={(e) => setAthleteFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
            />

            {/* Tier */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="">All Tiers</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>Tier {t}</option>
              ))}
            </select>

            {/* Date From */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            />

            {/* Date To */}
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            />

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="engagement">Engagement Rate</option>
              <option value="views">Views</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">
            {total} asset{total !== 1 ? 's' : ''} tracked
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading performance data...</div>
        ) : metrics.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No performance data yet</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Metrics are logged after content is posted. Once assets go live, log their D7 and D30 performance data here to track and score them.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {metrics.map((m) => {
              const isExpanded = expandedId === m.id;
              const tierCfg = m.performance_tier ? TIER_CONFIG[m.performance_tier] : null;
              const thumb = m.inspo_item?.thumbnail_url || m.inspo_item?.file_url;

              return (
                <div
                  key={m.id}
                  className={`bg-white/5 border rounded-xl overflow-hidden transition-all ${
                    isExpanded ? 'border-white/20' : 'border-white/10 hover:border-white/15'
                  }`}
                >
                  {/* Card Header — clickable */}
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  >
                    <div className="flex gap-3 p-4">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl">
                            📷
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {m.athlete_name && (
                            <span className="text-sm font-medium text-white truncate">{m.athlete_name}</span>
                          )}
                          {m.platform && (
                            <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono text-gray-300">
                              {platformIcon(m.platform)}
                            </span>
                          )}
                          {tierCfg && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${tierCfg.bg} ${tierCfg.text} ${tierCfg.border}`}>
                              {tierCfg.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Posted {formatDate(m.posted_at)}
                          {m.inspo_item?.content_type && ` · ${m.inspo_item.content_type}`}
                        </p>
                      </div>
                    </div>

                    {/* D7 Metric Row */}
                    {m.d7_logged_at && (
                      <div className="px-4 pb-3">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">D7 Metrics</p>
                        <div className="grid grid-cols-6 gap-2 text-center">
                          <div>
                            <p className="text-xs font-medium">{formatNumber(m.d7_views)}</p>
                            <p className="text-[9px] text-gray-500">Views</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">{formatNumber(m.d7_likes)}</p>
                            <p className="text-[9px] text-gray-500">Likes</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">{formatNumber(m.d7_comments)}</p>
                            <p className="text-[9px] text-gray-500">Comments</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">{formatNumber(m.d7_shares)}</p>
                            <p className="text-[9px] text-gray-500">Shares</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">{formatNumber(m.d7_saves)}</p>
                            <p className="text-[9px] text-gray-500">Saves</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-blue-400">{formatRate(m.d7_engagement_rate)}</p>
                            <p className="text-[9px] text-gray-500">Eng %</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 py-3 space-y-3">
                      {/* D30 Metrics */}
                      {m.d30_logged_at ? (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">D30 Metrics</p>
                          <div className="grid grid-cols-6 gap-2 text-center">
                            <div>
                              <p className="text-xs font-medium">{formatNumber(m.d30_views)}</p>
                              <p className="text-[9px] text-gray-500">Views</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium">{formatNumber(m.d30_likes)}</p>
                              <p className="text-[9px] text-gray-500">Likes</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium">{formatNumber(m.d30_comments)}</p>
                              <p className="text-[9px] text-gray-500">Comments</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium">{formatNumber(m.d30_shares)}</p>
                              <p className="text-[9px] text-gray-500">Shares</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium">{formatNumber(m.d30_saves)}</p>
                              <p className="text-[9px] text-gray-500">Saves</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-blue-400">{formatRate(m.d30_engagement_rate)}</p>
                              <p className="text-[9px] text-gray-500">Eng %</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">D30 metrics not yet logged</p>
                      )}

                      {/* Tier Rationale */}
                      {m.tier_rationale && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">AI Scoring Rationale</p>
                          <p className="text-xs text-gray-300 leading-relaxed">{m.tier_rationale}</p>
                          {m.tier_scored_at && (
                            <p className="text-[9px] text-gray-600 mt-1">Scored {formatDate(m.tier_scored_at)}</p>
                          )}
                        </div>
                      )}

                      {/* Live URL */}
                      {m.live_url && (
                        <a
                          href={m.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View live post &rarr;
                        </a>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {!m.performance_tier && m.d7_logged_at && (
                          <button
                            onClick={() => handleScore(m.id)}
                            disabled={scoringId === m.id}
                            className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                          >
                            {scoringId === m.id ? 'Scoring...' : 'AI Score'}
                          </button>
                        )}
                        {m.performance_tier && m.d7_logged_at && (
                          <button
                            onClick={() => handleScore(m.id)}
                            disabled={scoringId === m.id}
                            className="px-3 py-1.5 bg-white/5 text-gray-400 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors disabled:opacity-50"
                          >
                            {scoringId === m.id ? 'Re-scoring...' : 'Re-score'}
                          </button>
                        )}
                        <button
                          onClick={() => openLogModal(m)}
                          className="px-3 py-1.5 bg-white/5 text-gray-300 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors"
                        >
                          Log Metrics
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Metrics Modal */}
      {showLogModal && logTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeLogModal} />
          <div className="relative bg-[#141414] border border-white/10 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Log Metrics</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {logTarget.athlete_name || 'Asset'} — {logTarget.platform || 'Unknown platform'}
                </p>
              </div>
              <button onClick={closeLogModal} className="text-gray-500 hover:text-white transition-colors text-xl">
                ✕
              </button>
            </div>

            {/* Type Toggle */}
            <div className="px-5 pt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setLogType('d7')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    logType === 'd7'
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  D7 (7-Day)
                </button>
                <button
                  onClick={() => setLogType('d30')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    logType === 'd30'
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  D30 (30-Day)
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Views</label>
                  <input
                    type="number"
                    value={logViews}
                    onChange={(e) => setLogViews(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Likes</label>
                  <input
                    type="number"
                    value={logLikes}
                    onChange={(e) => setLogLikes(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Comments</label>
                  <input
                    type="number"
                    value={logComments}
                    onChange={(e) => setLogComments(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Shares</label>
                  <input
                    type="number"
                    value={logShares}
                    onChange={(e) => setLogShares(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Saves</label>
                  <input
                    type="number"
                    value={logSaves}
                    onChange={(e) => setLogSaves(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Reach</label>
                  <input
                    type="number"
                    value={logReach}
                    onChange={(e) => setLogReach(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                {logType === 'd7' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Impressions</label>
                    <input
                      type="number"
                      value={logImpressions}
                      onChange={(e) => setLogImpressions(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Engagement Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={logEngRate}
                    onChange={(e) => setLogEngRate(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={closeLogModal}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogSave}
                disabled={logSaving}
                className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {logSaving ? 'Saving...' : 'Save Metrics'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
