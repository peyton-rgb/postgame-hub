// ============================================================
// Brief List Page — /dashboard/briefs
// Shows all briefs with filters for status, brand, and creator.
// This is the "filing cabinet" view of all campaign briefs.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import type { Brief, BriefStatus } from '@/lib/types/briefs';

// Human-readable labels for status values
const STATUS_LABELS: Record<BriefStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  in_production: 'In Production',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

// Color coding for status badges
const STATUS_COLORS: Record<BriefStatus, string> = {
  draft: 'bg-surface-raised text-ink-2',
  published: 'bg-blue-600 text-blue-100',
  in_production: 'bg-accent text-white',
  complete: 'bg-green-600 text-green-100',
  cancelled: 'bg-red-900 text-red-200',
};

export default function BriefListPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch briefs on load and when filter changes
  useEffect(() => {
    async function fetchBriefs() {
      setLoading(true);
      let url = '/api/campaign-briefs';
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBriefs(data);
      }
      setLoading(false);
    }

    fetchBriefs();
  }, [statusFilter]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Campaign Briefs</h1>
          <p className="text-ink-3 mt-1">
            All campaign briefs across every brand
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/briefs/new')}
          className="px-6 py-3 bg-accent hover:bg-brand-dark text-white font-semibold rounded-lg transition-colors"
        >
          + New Brief
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['all', 'draft', 'published', 'in_production', 'complete'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-ink-1 text-ground'
                : 'bg-surface-card text-ink-2 hover:bg-surface-raised'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s as BriefStatus]}
          </button>
        ))}
      </div>

      {/* Brief cards */}
      {loading ? (
        <div className="text-ink-3 text-center py-20">Loading briefs...</div>
      ) : briefs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-ink-3 text-lg">No briefs yet</p>
          <p className="text-ink-4 mt-2">
            Click &quot;New Brief&quot; to create your first campaign brief.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {briefs.map((brief) => (
            <div
              key={brief.id}
              onClick={() => router.push(`/dashboard/briefs/${brief.id}`)}
              className="bg-surface-card border border-hairline-soft rounded-xl p-6 cursor-pointer hover:border-hairline transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{brief.name}</h3>
                  <p className="text-ink-3 mt-1">
                    {brief.brand?.name || 'Unknown brand'}
                    {brief.campaign_type !== 'standard' && (
                      <span className="ml-2 text-ink-4">
                        &middot; {brief.campaign_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    STATUS_COLORS[brief.status]
                  }`}
                >
                  {STATUS_LABELS[brief.status]}
                </span>
              </div>
              <div className="flex gap-6 mt-4 text-sm text-ink-4">
                {brief.start_date && (
                  <span>Starts: {new Date(brief.start_date).toLocaleDateString()}</span>
                )}
                {brief.target_launch_date && (
                  <span>Launch: {new Date(brief.target_launch_date).toLocaleDateString()}</span>
                )}
                {brief.budget && (
                  <span>Budget: ${Number(brief.budget).toLocaleString()}</span>
                )}
                {brief.version > 1 && (
                  <span>v{brief.version}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
