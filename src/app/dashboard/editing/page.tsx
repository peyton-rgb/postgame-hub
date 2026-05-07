// ============================================================
// Editing Queue — /dashboard/editing
//
// This page shows all content that has passed Gate 1
// (Postgame internal approval) and is waiting to be edited.
//
// Think of it as the editor's to-do list:
//   - Content arrives here after being approved in the Intake
//     Approval Queue (triage_status = 'approved' or 'auto_approved')
//   - Editors can see the AI tags, mood, shot type, and quality
//     tier to understand what they're working with
//   - Content is grouped by campaign → athlete for easy scanning
//   - Editors update the editing_status as they work:
//     pending → in_progress → complete
//   - Once editing is complete, content moves to Gate 2
//     (Brand Approval Queue) for client review
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

interface EditingItem {
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
  editing_status: 'pending' | 'in_progress' | 'complete' | null;
  triage_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  notes: string | null;
  // Joined fields
  campaign_name?: string;
  brand_name?: string;
}

// What each editing status means for the editor
const EDITING_STATUS_LABELS: Record<string, string> = {
  pending: 'Ready to Edit',
  in_progress: 'Editing',
  complete: 'Edit Complete',
};

const EDITING_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30',
  in_progress: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  complete: 'bg-green-600/20 text-green-300 border-green-600/30',
};

const QUALITY_COLORS: Record<string, string> = {
  a_roll_hero: 'bg-purple-600/20 text-purple-300',
  b_roll_support: 'bg-blue-600/20 text-blue-300',
  bts_candid: 'bg-orange-600/20 text-orange-300',
  filler: 'bg-zinc-600/20 text-zinc-400',
};

const QUALITY_LABELS: Record<string, string> = {
  a_roll_hero: 'A-Roll Hero',
  b_roll_support: 'B-Roll Support',
  bts_candid: 'BTS Candid',
  filler: 'Filler',
};

const TIER_COLORS: Record<number, string> = {
  1: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  2: 'bg-slate-400/20 text-slate-300 border-slate-400/40',
  3: 'bg-orange-700/20 text-orange-400 border-orange-700/40',
};

export default function EditingQueuePage() {
  const [items, setItems] = useState<EditingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'complete'>('all');
  const [groupBy, setGroupBy] = useState<'campaign' | 'athlete' | 'quality'>('campaign');
  const [selectedItem, setSelectedItem] = useState<EditingItem | null>(null);
  const [counts, setCounts] = useState({ pending: 0, in_progress: 0, complete: 0, total: 0 });

  const supabase = createBrowserSupabase();

  // --- Fetch all approved content that's in the editing pipeline ---
  const fetchItems = useCallback(async () => {
    setLoading(true);

    // We want everything that passed Gate 1 (approved or auto_approved)
    // These are the items the editing team needs to work on
    let query = supabase
      .from('inspo_items')
      .select('*')
      .in('triage_status', ['approved', 'auto_approved'])
      .order('created_at', { ascending: false });

    // Filter by editing status if not "all"
    if (filter !== 'all') {
      query = query.eq('editing_status', filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch editing queue:', error);
      setLoading(false);
      return;
    }

    // Get campaign names for grouping
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

    const enriched: EditingItem[] = (data || []).map(item => ({
      ...item,
      editing_status: item.editing_status || 'pending',
      campaign_name: item.campaign_id ? campaignMap[item.campaign_id] || 'Unknown Campaign' : 'No Campaign',
      brand_name: item.brand_id ? brandMap[item.brand_id] || 'Unknown Brand' : 'No Brand',
    }));

    setItems(enriched);

    // Count by editing status
    const pending = enriched.filter(i => i.editing_status === 'pending').length;
    const in_progress = enriched.filter(i => i.editing_status === 'in_progress').length;
    const complete = enriched.filter(i => i.editing_status === 'complete').length;
    setCounts({ pending, in_progress, complete, total: enriched.length });

    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // --- Update editing status on an item ---
  const handleStatusChange = async (itemId: string, newStatus: 'pending' | 'in_progress' | 'complete') => {
    const { error } = await supabase
      .from('inspo_items')
      .update({ editing_status: newStatus })
      .eq('id', itemId);

    if (error) {
      console.error('Failed to update editing status:', error);
      return;
    }

    // Update local state so the UI reflects the change instantly
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, editing_status: newStatus } : item
    ));

    // Update selected item too
    if (selectedItem?.id === itemId) {
      setSelectedItem(prev => prev ? { ...prev, editing_status: newStatus } : null);
    }

    // Recount
    const updated = items.map(item =>
      item.id === itemId ? { ...item, editing_status: newStatus } : item
    );
    setCounts({
      pending: updated.filter(i => i.editing_status === 'pending').length,
      in_progress: updated.filter(i => i.editing_status === 'in_progress').length,
      complete: updated.filter(i => i.editing_status === 'complete').length,
      total: updated.length,
    });
  };

  // --- Group items for display ---
  const groupedItems = (): Record<string, EditingItem[]> => {
    const groups: Record<string, EditingItem[]> = {};

    for (const item of items) {
      let key: string;

      if (groupBy === 'campaign') {
        key = item.campaign_name || 'No Campaign';
      } else if (groupBy === 'athlete') {
        key = item.athlete_name || 'Unknown Athlete';
      } else {
        key = QUALITY_LABELS[item.content_quality || 'filler'] || 'Unscored';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    return groups;
  };

  // --- Render a single content card ---
  const renderCard = (item: EditingItem) => {
    const isVideo = item.mime_type?.startsWith('video/');

    return (
      <div
        key={item.id}
        onClick={() => setSelectedItem(item)}
        className={`
          relative rounded-xl overflow-hidden cursor-pointer border transition-all
          ${selectedItem?.id === item.id
            ? 'border-orange-500 ring-2 ring-orange-500/30'
            : 'border-zinc-700/50 hover:border-zinc-600'
          }
        `}
      >
        {/* Thumbnail */}
        <div className="aspect-video bg-zinc-800 relative">
          {item.thumbnail_url || item.file_url ? (
            isVideo ? (
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
                alt={item.action_description || 'Content'}
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <circle cx="8" cy="8" r="2" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}

          {/* Duration badge for videos */}
          {item.duration_seconds && (
            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
              {Math.floor(item.duration_seconds / 60)}:{String(Math.floor(item.duration_seconds % 60)).padStart(2, '0')}
            </span>
          )}

          {/* Athlete tier badge */}
          {item.athlete_tier && (
            <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full border ${TIER_COLORS[item.athlete_tier] || ''}`}>
              T{item.athlete_tier}
            </span>
          )}

          {/* Content quality badge */}
          {item.content_quality && (
            <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${QUALITY_COLORS[item.content_quality] || ''}`}>
              {QUALITY_LABELS[item.content_quality] || item.content_quality}
            </span>
          )}
        </div>

        {/* Info bar */}
        <div className="p-3 bg-zinc-900/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-white font-medium truncate">
              {item.athlete_name || 'Unknown'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${EDITING_STATUS_COLORS[item.editing_status || 'pending']}`}>
              {EDITING_STATUS_LABELS[item.editing_status || 'pending']}
            </span>
          </div>

          {/* Mood tags */}
          {item.mood_tags && item.mood_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.mood_tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Action description */}
          {item.action_description && (
            <p className="text-xs text-zinc-500 mt-1 truncate">{item.action_description}</p>
          )}
        </div>
      </div>
    );
  };

  const groups = groupedItems();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Editing Queue</h1>
          <p className="text-zinc-400">
            Content approved in Gate 1 — ready for editing. Once complete, moves to Brand Approval.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="text-2xl font-bold">{counts.total}</div>
            <div className="text-sm text-zinc-400">Total Items</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-900/30">
            <div className="text-2xl font-bold text-yellow-300">{counts.pending}</div>
            <div className="text-sm text-zinc-400">Ready to Edit</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-blue-900/30">
            <div className="text-2xl font-bold text-blue-300">{counts.in_progress}</div>
            <div className="text-sm text-zinc-400">In Progress</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-green-900/30">
            <div className="text-2xl font-bold text-green-300">{counts.complete}</div>
            <div className="text-sm text-zinc-400">Edits Complete</div>
          </div>
        </div>

        {/* Filter & Group controls */}
        <div className="flex items-center justify-between mb-6">
          {/* Status filter tabs */}
          <div className="flex gap-2">
            {(['all', 'pending', 'in_progress', 'complete'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-orange-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {status === 'all' ? 'All' : EDITING_STATUS_LABELS[status]}
              </button>
            ))}
          </div>

          {/* Group by selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Group by:</span>
            {(['campaign', 'athlete', 'quality'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  groupBy === g
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex gap-6">
          {/* Content grid */}
          <div className={`flex-1 ${selectedItem ? 'w-2/3' : 'w-full'}`}>
            {loading ? (
              <div className="text-center py-20 text-zinc-500">Loading editing queue...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-zinc-500 text-lg mb-2">No content in the editing queue</div>
                <p className="text-zinc-600 text-sm">
                  Content appears here after being approved in the Intake → Approval Queue.
                </p>
              </div>
            ) : (
              Object.entries(groups).map(([groupName, groupItems]) => (
                <div key={groupName} className="mb-8">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    {groupName}
                    <span className="text-sm text-zinc-500 font-normal">({groupItems.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {groupItems.map(renderCard)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Detail panel (slides in when an item is selected) */}
          {selectedItem && (
            <div className="w-1/3 min-w-[340px] bg-zinc-900 rounded-xl border border-zinc-800 p-5 sticky top-8 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
              {/* Close button */}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 text-zinc-500 hover:text-white"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* Preview */}
              <div className="aspect-video bg-zinc-800 rounded-lg overflow-hidden mb-4">
                {selectedItem.mime_type?.startsWith('video/') ? (
                  <video
                    src={selectedItem.file_url || ''}
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={selectedItem.thumbnail_url || selectedItem.file_url || ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Athlete & Campaign info */}
              <h3 className="text-lg font-bold mb-1">{selectedItem.athlete_name || 'Unknown Athlete'}</h3>
              <p className="text-sm text-zinc-400 mb-4">{selectedItem.campaign_name || 'No Campaign'} · {selectedItem.brand_name || 'No Brand'}</p>

              {/* Editing status controls */}
              <div className="mb-5">
                <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Editing Status</label>
                <div className="flex gap-2">
                  {(['pending', 'in_progress', 'complete'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(selectedItem.id, status)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        selectedItem.editing_status === status
                          ? EDITING_STATUS_COLORS[status]
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      {EDITING_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags & AI info */}
              <div className="space-y-4">
                {/* Shot type & scene */}
                {(selectedItem.shot_type || selectedItem.scene_setting) && (
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">Shot Details</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.shot_type && (
                        <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">
                          📷 {selectedItem.shot_type.replace(/_/g, ' ')}
                        </span>
                      )}
                      {selectedItem.scene_setting && (
                        <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">
                          📍 {selectedItem.scene_setting.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action description */}
                {selectedItem.action_description && (
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">Action</label>
                    <p className="text-sm text-zinc-300">{selectedItem.action_description}</p>
                  </div>
                )}

                {/* Mood tags */}
                {selectedItem.mood_tags && selectedItem.mood_tags.length > 0 && (
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">Mood</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedItem.mood_tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content quality */}
                {selectedItem.content_quality && (
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">Quality Tier</label>
                    <span className={`text-xs px-2 py-1 rounded ${QUALITY_COLORS[selectedItem.content_quality] || ''}`}>
                      {QUALITY_LABELS[selectedItem.content_quality] || selectedItem.content_quality}
                    </span>
                  </div>
                )}

                {/* Athlete tier */}
                {selectedItem.athlete_tier && (
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">Athlete Tier</label>
                    <span className={`text-xs px-2 py-1 rounded-full border ${TIER_COLORS[selectedItem.athlete_tier] || ''}`}>
                      Tier {selectedItem.athlete_tier}
                    </span>
                  </div>
                )}

                {/* Visual description from Claude */}
                {selectedItem.visual_description && (
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">AI Description</label>
                    <p className="text-xs text-zinc-400 leading-relaxed">{selectedItem.visual_description}</p>
                  </div>
                )}

                {/* Approval info */}
                <div className="border-t border-zinc-800 pt-4 mt-4">
                  <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">Gate 1 Approval</label>
                  <p className="text-xs text-zinc-400">
                    {selectedItem.triage_status === 'auto_approved'
                      ? 'Auto-approved (brand settings)'
                      : selectedItem.approved_by
                        ? `Approved by ${selectedItem.approved_by}`
                        : 'Approved'
                    }
                    {selectedItem.approved_at && ` · ${new Date(selectedItem.approved_at).toLocaleDateString()}`}
                  </p>
                </div>

                {/* Notes */}
                {selectedItem.notes && (
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">Notes</label>
                    <p className="text-xs text-zinc-400">{selectedItem.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
