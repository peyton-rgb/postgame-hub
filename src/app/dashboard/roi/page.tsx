// ============================================================
// ROI Dashboard — /dashboard/roi
//
// Campaign ROI overview for Station 5. Shows cost-per-view,
// cost-per-engagement, and spend allocation across assets.
// Campaign selector at top, with aggregate view when none
// selected. Performance tier distribution, top performers,
// and a "Generate Report" placeholder button.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

interface Campaign {
  id: string;
  title: string;
  budget: number | null;
  brand_name: string | null;
}

interface AssetMetric {
  id: string;
  athlete_name: string | null;
  platform: string | null;
  posted_at: string | null;
  d7_views: number | null;
  d7_likes: number | null;
  d7_comments: number | null;
  d7_shares: number | null;
  d7_saves: number | null;
  d7_engagement_rate: number | null;
  performance_tier: string | null;
  campaign_id: string | null;
  inspo_item: {
    id: string;
    thumbnail_url: string | null;
    file_url: string | null;
    content_type: string;
    visual_description: string | null;
  } | null;
}

// --- Helpers ---

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '--';
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRate(r: number | null | undefined): string {
  if (r == null) return '--';
  return Number(r).toFixed(2) + '%';
}

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  S: { label: 'S - Viral', color: 'bg-amber-500' },
  A: { label: 'A - Strong', color: 'bg-green-500' },
  B: { label: 'B - Solid', color: 'bg-blue-500' },
  C: { label: 'C - Below Avg', color: 'bg-yellow-500' },
  D: { label: 'D - Under', color: 'bg-red-500' },
};

export default function ROIDashboardPage() {
  const supabase = createBrowserSupabase();

  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [metrics, setMetrics] = useState<AssetMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Load campaigns
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('campaign_briefs')
        .select('id, title, budget, brand_name')
        .order('created_at', { ascending: false })
        .limit(200);
      if (data) setCampaigns(data);
    }
    load();
  }, [supabase]);

  // Track selected campaign object
  useEffect(() => {
    if (selectedCampaignId) {
      setSelectedCampaign(campaigns.find((c) => c.id === selectedCampaignId) || null);
    } else {
      setSelectedCampaign(null);
    }
  }, [selectedCampaignId, campaigns]);

  // Load metrics
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '200', sort: 'engagement' });
    if (selectedCampaignId) params.set('campaign_id', selectedCampaignId);

    try {
      const res = await fetch(`/api/analytics?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch metrics for ROI:', err);
    }
    setLoading(false);
  }, [selectedCampaignId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // --- Computed values ---

  const totalSpend = selectedCampaign?.budget ?? null;
  const totalViews = metrics.reduce((s, m) => s + (m.d7_views || 0), 0);
  const totalEngagements = metrics.reduce(
    (s, m) => s + (m.d7_likes || 0) + (m.d7_comments || 0) + (m.d7_shares || 0) + (m.d7_saves || 0),
    0
  );
  const cpv = totalSpend && totalViews > 0 ? totalSpend / totalViews : null;
  const cpe = totalSpend && totalEngagements > 0 ? totalSpend / totalEngagements : null;

  // Tier distribution
  const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  metrics.forEach((m) => {
    if (m.performance_tier && tierCounts[m.performance_tier] !== undefined) {
      tierCounts[m.performance_tier]++;
    }
  });
  const totalScored = Object.values(tierCounts).reduce((s, n) => s + n, 0);

  // Top 5 by engagement rate
  const topPerformers = [...metrics]
    .filter((m) => m.d7_engagement_rate != null)
    .sort((a, b) => (b.d7_engagement_rate ?? 0) - (a.d7_engagement_rate ?? 0))
    .slice(0, 5);

  // Per-asset spend allocation (even split if we have a budget)
  const perAssetSpend = totalSpend && metrics.length > 0 ? totalSpend / metrics.length : null;

  // Toast handler
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">ROI Dashboard</h1>
            <p className="text-gray-400 mt-1">Campaign spend analysis and content value tracking</p>
          </div>
          <button
            onClick={() => showToast('Report generation coming soon')}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors"
          >
            Generate Report
          </button>
        </div>

        {/* Campaign Selector */}
        <div className="mb-8">
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 w-full max-w-md"
          >
            <option value="">All Campaigns (Aggregate)</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}{c.brand_name ? ` — ${c.brand_name}` : ''}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading ROI data...</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Spend</p>
                <p className="text-2xl font-bold">
                  {totalSpend != null ? formatCurrency(totalSpend) : 'N/A'}
                </p>
                {selectedCampaign?.brand_name && (
                  <p className="text-[10px] text-gray-600 mt-1">{selectedCampaign.brand_name}</p>
                )}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Views</p>
                <p className="text-2xl font-bold">{formatNumber(totalViews)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cost Per View</p>
                <p className="text-2xl font-bold">{cpv != null ? formatCurrency(cpv) : 'N/A'}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Engagements</p>
                <p className="text-2xl font-bold">{formatNumber(totalEngagements)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cost Per Engagement</p>
                <p className="text-2xl font-bold">{cpe != null ? formatCurrency(cpe) : 'N/A'}</p>
              </div>
            </div>

            {/* Two-column layout: Tier Distribution + Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Tier Distribution */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Performance Tier Distribution</h3>
                {totalScored === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No scored assets yet</p>
                ) : (
                  <div className="space-y-3">
                    {(['S', 'A', 'B', 'C', 'D'] as const).map((tier) => {
                      const count = tierCounts[tier];
                      const pct = totalScored > 0 ? (count / totalScored) * 100 : 0;
                      const cfg = TIER_CONFIG[tier];
                      return (
                        <div key={tier}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">{cfg.label}</span>
                            <span className="text-xs text-gray-500">{count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${cfg.color} rounded-full transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Performers */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Top 5 by Engagement Rate</h3>
                {topPerformers.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No engagement data yet</p>
                ) : (
                  <div className="space-y-3">
                    {topPerformers.map((m, i) => {
                      const thumb = m.inspo_item?.thumbnail_url || m.inspo_item?.file_url;
                      return (
                        <div key={m.id} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-4 font-mono">{i + 1}</span>
                          <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                                📷
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {m.athlete_name || 'Unknown athlete'}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {m.platform || 'Unknown'} · {formatNumber(m.d7_views)} views
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-blue-400">{formatRate(m.d7_engagement_rate)}</p>
                            {m.performance_tier && (
                              <p className="text-[10px] text-gray-500">Tier {m.performance_tier}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Asset Breakdown Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h3 className="text-sm font-semibold text-gray-300">Asset Breakdown</h3>
                <p className="text-xs text-gray-500 mt-0.5">{metrics.length} assets tracked</p>
              </div>

              {metrics.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  No assets to show. Log performance data on the Performance page first.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-xs text-gray-500 font-normal px-4 py-3">Asset</th>
                        <th className="text-left text-xs text-gray-500 font-normal px-4 py-3">Platform</th>
                        <th className="text-right text-xs text-gray-500 font-normal px-4 py-3">Views</th>
                        <th className="text-right text-xs text-gray-500 font-normal px-4 py-3">Engagements</th>
                        <th className="text-right text-xs text-gray-500 font-normal px-4 py-3">Eng Rate</th>
                        {totalSpend != null && (
                          <>
                            <th className="text-right text-xs text-gray-500 font-normal px-4 py-3">Spend</th>
                            <th className="text-right text-xs text-gray-500 font-normal px-4 py-3">CPV</th>
                            <th className="text-right text-xs text-gray-500 font-normal px-4 py-3">CPE</th>
                          </>
                        )}
                        <th className="text-center text-xs text-gray-500 font-normal px-4 py-3">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((m) => {
                        const engagements = (m.d7_likes || 0) + (m.d7_comments || 0) + (m.d7_shares || 0) + (m.d7_saves || 0);
                        const assetCpv = perAssetSpend && (m.d7_views || 0) > 0 ? perAssetSpend / (m.d7_views || 1) : null;
                        const assetCpe = perAssetSpend && engagements > 0 ? perAssetSpend / engagements : null;
                        const tierCfg = m.performance_tier ? TIER_CONFIG[m.performance_tier] : null;

                        return (
                          <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded bg-white/5 overflow-hidden flex-shrink-0">
                                  {(m.inspo_item?.thumbnail_url || m.inspo_item?.file_url) ? (
                                    <img
                                      src={m.inspo_item.thumbnail_url || m.inspo_item.file_url!}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                                      📷
                                    </div>
                                  )}
                                </div>
                                <span className="text-white truncate max-w-[140px]">
                                  {m.athlete_name || 'Unknown'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-400 capitalize">{m.platform || '--'}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{formatNumber(m.d7_views)}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{formatNumber(engagements)}</td>
                            <td className="px-4 py-3 text-right text-blue-400">{formatRate(m.d7_engagement_rate)}</td>
                            {totalSpend != null && (
                              <>
                                <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(perAssetSpend)}</td>
                                <td className="px-4 py-3 text-right text-gray-300">{assetCpv != null ? formatCurrency(assetCpv) : '--'}</td>
                                <td className="px-4 py-3 text-right text-gray-300">{assetCpe != null ? formatCurrency(assetCpe) : '--'}</td>
                              </>
                            )}
                            <td className="px-4 py-3 text-center">
                              {tierCfg ? (
                                <span className={`inline-block w-6 h-6 rounded-full ${tierCfg.color}/20 text-xs font-bold leading-6 text-center`}>
                                  {m.performance_tier}
                                </span>
                              ) : (
                                <span className="text-gray-600">--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white shadow-lg animate-pulse">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
