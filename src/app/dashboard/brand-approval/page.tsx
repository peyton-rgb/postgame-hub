// ============================================================
// Gate 2 — Brand Approval Queue
// /dashboard/brand-approval
//
// This is the SECOND gate in the two-gate approval system.
// Content arrives here AFTER:
//   1. Being uploaded and AI-tagged (Intake)
//   2. Passing Postgame internal approval (Gate 1)
//   3. Being edited by the editing team
//   4. Being reviewed internally by Postgame (editing_status = 'complete')
//
// This is where the BRAND / CLIENT reviews the final edited
// content before it goes to publishing. They can:
//   - Approve → content moves to Publishing queue
//   - Request changes → content goes back to editing
//   - Leave feedback for the Postgame team
//
// IMPORTANT: Postgame ALWAYS sees content before clients.
// "Complete" in editing means Postgame reviewed the edit —
// THEN it lands here for the brand's eyes.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

interface BrandApprovalItem {
  id: string;
  file_url: string | null;
  thumbnail_url: string | null;
  mime_type: string | null;
  athlete_name: string | null;
  athlete_tier: number | null;
  sport: string | null;
  content_type: string;
  campaign_id: string | null;
  brand_id: string | null;
  shot_type: string | null;
  scene_setting: string | null;
  action_description: string | null;
  mood_tags: string[] | null;
  content_quality: string | null;
  visual_description: string | null;
  brand_approval_status: 'pending' | 'approved' | 'changes_requested' | null;
  brand_approved_by: string | null;
  brand_approved_at: string | null;
  brand_feedback: string | null;
  editing_status: string | null;
  duration_seconds: number | null;
  created_at: string;
  notes: string | null;
  // Joined fields
  campaign_name?: string;
  brand_name?: string;
}

const APPROVAL_LABELS: Record<string, string> = {
  pending: 'Awaiting Brand Review',
  approved: 'Brand Approved',
  changes_requested: 'Changes Requested',
};

const APPROVAL_COLORS: Record<string, string> = {
  // State by weight, not hue — the chip text already names it. Only
  // changes_requested asks for action, so only it takes accent.
  pending: 'bg-surface-card text-ink-4 border-hairline',
  approved: 'bg-surface-card text-ink-3 border-hairline',
  changes_requested: 'bg-accent/15 text-accent border-accent/30',
};

const TIER_COLORS: Record<number, string> = {
  1: 'bg-accent/20 text-ink-2 border-accent/40',
  2: 'bg-slate-400/20 text-slate-300 border-slate-400/40',
  3: 'bg-accent/20 text-accent border-accent/40',
};

export default function BrandApprovalPage() {
  const [items, setItems] = useState<BrandApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'changes_requested'>('all');
  const [selectedItem, setSelectedItem] = useState<BrandApprovalItem | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, changes_requested: 0, total: 0 });

  const supabase = createBrowserSupabase();

  const fetchItems = useCallback(async () => {
    setLoading(true);

    // Gate 2 sees content where editing is complete
    // (meaning Postgame has already reviewed the edit)
    let query = supabase
      .from('inspo_items')
      .select('*')
      .eq('editing_status', 'complete')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('brand_approval_status', filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch brand approval queue:', error);
      setLoading(false);
      return;
    }

    // Get campaign names
    const campaignIds = [...new Set((data || []).map(d => d.campaign_id).filter(Boolean))];
    let campaignMap: Record<string, string> = {};

    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('campaign_briefs')
        .select('id, title')
        .in('id', campaignIds);

      if (campaigns) {
        campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c.title]));
      }
    }

    // Get brand names
    const brandIds = [...new Set((data || []).map(d => d.brand_id).filter(Boolean))];
    let brandMap: Record<string, string> = {};

    if (brandIds.length > 0) {
      const { data: brands } = await supabase
        .from('brands')
        .select('id, name')
        .in('id', brandIds);

      if (brands) {
        brandMap = Object.fromEntries(brands.map(b => [b.id, b.name]));
      }
    }

    const enriched: BrandApprovalItem[] = (data || []).map(item => ({
      ...item,
      brand_approval_status: item.brand_approval_status || 'pending',
      campaign_name: item.campaign_id ? campaignMap[item.campaign_id] || 'Unknown Campaign' : 'No Campaign',
      brand_name: item.brand_id ? brandMap[item.brand_id] || 'Unknown Brand' : 'No Brand',
    }));

    setItems(enriched);

    const pending = enriched.filter(i => (i.brand_approval_status || 'pending') === 'pending').length;
    const approved = enriched.filter(i => i.brand_approval_status === 'approved').length;
    const changes_requested = enriched.filter(i => i.brand_approval_status === 'changes_requested').length;
    setCounts({ pending, approved, changes_requested, total: enriched.length });

    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // --- Handle brand approval actions ---
  const handleBrandAction = async (
    itemId: string,
    action: 'approved' | 'changes_requested',
    feedback?: string
  ) => {
    const updateData: Record<string, unknown> = {
      brand_approval_status: action,
      brand_approved_at: new Date().toISOString(),
      brand_approved_by: 'postgame_admin', // TODO: replace with actual user
    };

    if (feedback) {
      updateData.brand_feedback = feedback;
    }

    // If changes requested, send it back to editing
    if (action === 'changes_requested') {
      updateData.editing_status = 'pending';
    }

    const { error } = await supabase
      .from('inspo_items')
      .update(updateData)
      .eq('id', itemId);

    if (error) {
      console.error('Brand approval action failed:', error);
      return;
    }

    // If changes_requested, the item goes back to editing queue,
    // so remove it from this view
    if (action === 'changes_requested') {
      setItems(prev => prev.filter(i => i.id !== itemId));
      setSelectedItem(null);
    } else {
      // Update local state
      setItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, brand_approval_status: action, brand_feedback: feedback || item.brand_feedback }
          : item
      ));
      if (selectedItem?.id === itemId) {
        setSelectedItem(prev => prev
          ? { ...prev, brand_approval_status: action, brand_feedback: feedback || prev.brand_feedback }
          : null
        );
      }
    }

    setFeedbackText('');
    fetchItems(); // Refresh counts
  };

  // --- Group by brand for client-facing view ---
  const groupedByBrand = (): Record<string, BrandApprovalItem[]> => {
    const groups: Record<string, BrandApprovalItem[]> = {};
    for (const item of items) {
      const key = item.brand_name || 'No Brand';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  };

  const groups = groupedByBrand();

  return (
    <div className="min-h-screen bg-ground text-ink-1">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Brand Approval</h1>
            <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent border border-accent/30">
              Gate 2
            </span>
          </div>
          <p className="text-ink-3">
            Edited content ready for client review. Brand approves → Publishing. Changes requested → back to Editing.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-card rounded-xl p-4 border border-hairline">
            <div className="text-2xl font-bold">{counts.total}</div>
            <div className="text-sm text-ink-3">Total</div>
          </div>
          <div className="bg-surface-card rounded-xl p-4 border border-hairline/30">
            <div className="text-2xl font-bold text-ink-4">{counts.pending}</div>
            <div className="text-sm text-ink-3">Awaiting Review</div>
          </div>
          <div className="bg-surface-card rounded-xl p-4 border border-hairline/30">
            <div className="text-2xl font-bold text-ink-3">{counts.approved}</div>
            <div className="text-sm text-ink-3">Approved</div>
          </div>
          <div className="bg-surface-card rounded-xl p-4 border border-hairline/30">
            <div className="text-2xl font-bold text-accent">{counts.changes_requested}</div>
            <div className="text-sm text-ink-3">Changes Requested</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'approved', 'changes_requested'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-accent text-ink-1'
                  : 'bg-surface-raised text-ink-3 hover:bg-surface-raised hover:text-ink-1'
              }`}
            >
              {status === 'all' ? 'All' : APPROVAL_LABELS[status]}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex gap-6">
          {/* Content grid */}
          <div className={`flex-1 ${selectedItem ? 'w-2/3' : 'w-full'}`}>
            {loading ? (
              <div className="text-center py-20 text-ink-4">Loading brand approval queue...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-ink-4 text-lg mb-2">No content awaiting brand approval</div>
                <p className="text-ink-4 text-sm">
                  Content appears here after editing is complete and Postgame has reviewed the edit.
                </p>
              </div>
            ) : (
              Object.entries(groups).map(([brandName, brandItems]) => (
                <div key={brandName} className="mb-8">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    {brandName}
                    <span className="text-sm text-ink-4 font-normal">({brandItems.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {brandItems.map(item => (
                      <div
                        key={item.id}
                        onClick={() => { setSelectedItem(item); setFeedbackText(item.brand_feedback || ''); }}
                        className={`
                          relative rounded-xl overflow-hidden cursor-pointer border transition-all
                          ${selectedItem?.id === item.id
                            ? 'border-accent ring-2 ring-orange-500/30'
                            : 'border-hairline/50 hover:border-ink-4'
                          }
                        `}
                      >
                        {/* Thumbnail */}
                        <div className="aspect-video bg-surface-raised relative">
                          {item.thumbnail_url || item.file_url ? (
                            item.mime_type?.startsWith('video/') ? (
                              <video
                                src={item.file_url || ''}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                onMouseOver={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                                onMouseOut={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                              />
                            ) : (
                              <img
                                src={item.thumbnail_url || item.file_url || ''}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-4">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="2" y="2" width="20" height="20" rx="2" />
                                <circle cx="8" cy="8" r="2" />
                                <path d="M21 15l-5-5L5 21" />
                              </svg>
                            </div>
                          )}

                          {/* Tier badge */}
                          {item.athlete_tier && (
                            <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full border ${TIER_COLORS[item.athlete_tier] || ''}`}>
                              T{item.athlete_tier}
                            </span>
                          )}

                          {/* Approval status badge */}
                          <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full border ${APPROVAL_COLORS[item.brand_approval_status || 'pending']}`}>
                            {APPROVAL_LABELS[item.brand_approval_status || 'pending']}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="p-3 bg-surface-card/80">
                          <div className="text-sm text-ink-1 font-medium truncate">
                            {item.athlete_name || 'Unknown'}
                          </div>
                          <div className="text-xs text-ink-4 truncate mt-0.5">
                            {item.campaign_name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Detail panel */}
          {selectedItem && (
            <div className="w-1/3 min-w-[360px] bg-surface-card rounded-xl border border-hairline p-5 sticky top-8 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
              {/* Close */}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 text-ink-4 hover:text-ink-1"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* Preview */}
              <div className="aspect-video bg-surface-raised rounded-lg overflow-hidden mb-4">
                {selectedItem.mime_type?.startsWith('video/') ? (
                  <video src={selectedItem.file_url || ''} controls className="w-full h-full object-cover" />
                ) : (
                  <img src={selectedItem.thumbnail_url || selectedItem.file_url || ''} alt="" className="w-full h-full object-cover" />
                )}
              </div>

              {/* Info */}
              <h3 className="text-lg font-bold mb-1">{selectedItem.athlete_name || 'Unknown Athlete'}</h3>
              <p className="text-sm text-ink-3 mb-4">
                {selectedItem.campaign_name} · {selectedItem.brand_name}
              </p>

              {/* Current status */}
              <div className="mb-5">
                <label className="text-xs text-ink-4 uppercase tracking-wide mb-2 block">Brand Approval Status</label>
                <span className={`inline-block text-sm px-3 py-1.5 rounded-lg border ${APPROVAL_COLORS[selectedItem.brand_approval_status || 'pending']}`}>
                  {APPROVAL_LABELS[selectedItem.brand_approval_status || 'pending']}
                </span>
              </div>

              {/* Content details */}
              <div className="space-y-3 mb-5">
                {selectedItem.action_description && (
                  <div>
                    <label className="text-xs text-ink-4 uppercase tracking-wide mb-1 block">Description</label>
                    <p className="text-sm text-ink-2">{selectedItem.action_description}</p>
                  </div>
                )}

                {selectedItem.mood_tags && selectedItem.mood_tags.length > 0 && (
                  <div>
                    <label className="text-xs text-ink-4 uppercase tracking-wide mb-1 block">Mood</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedItem.mood_tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 rounded bg-surface-raised text-ink-3">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback textarea */}
              <div className="mb-4">
                <label className="text-xs text-ink-4 uppercase tracking-wide mb-2 block">Brand Feedback</label>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Add feedback or change requests..."
                  rows={3}
                  className="w-full bg-surface-raised border border-hairline rounded-lg px-3 py-2 text-sm text-ink-1 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleBrandAction(selectedItem.id, 'approved', feedbackText || undefined)}
                  className="flex-1 bg-accent hover:opacity-90 text-ink-1 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleBrandAction(selectedItem.id, 'changes_requested', feedbackText || 'Changes needed')}
                  className="flex-1 bg-transparent border border-hairline hover:bg-surface-raised text-ink-2 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  Request Changes
                </button>
              </div>

              {/* When changes are requested, explain what happens */}
              {selectedItem.brand_approval_status === 'changes_requested' && (
                <div className="mt-4 p-3 rounded-lg bg-surface-card/20 border border-hairline/30">
                  <p className="text-xs text-accent">
                    This item has been sent back to the Editing Queue with feedback.
                    The editor will revise and resubmit for review.
                  </p>
                </div>
              )}

              {/* Show existing feedback if any */}
              {selectedItem.brand_feedback && selectedItem.brand_approval_status !== 'pending' && (
                <div className="mt-4 p-3 rounded-lg bg-surface-raised border border-hairline">
                  <label className="text-xs text-ink-4 uppercase tracking-wide mb-1 block">Previous Feedback</label>
                  <p className="text-sm text-ink-2">{selectedItem.brand_feedback}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
