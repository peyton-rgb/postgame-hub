// ============================================================
// InspoPickerModal — modal that lets a CM choose one or more
// approved inspo_items from the library to use as the source asset
// (and/or reference) for an AI edit.
//
// Single-select by default; pass `multiSelect` to allow several.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

export interface SelectedInspoItem {
  id: string;
  thumbnail_url: string | null;
  file_url: string | null;
  content_type: 'video' | 'image' | string;
  visual_description?: string | null;
  athlete_name?: string | null;
  sport?: string | null;
  brand_id?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (items: SelectedInspoItem[]) => void;
  multiSelect?: boolean;
  // Optional content-type filter — most callers want videos only.
  contentType?: 'video' | 'image';
  title?: string;
}

const PAGE_SIZE = 30;

export default function InspoPickerModal({
  open,
  onClose,
  onSelect,
  multiSelect = false,
  contentType,
  title = 'Pick from Inspo Library',
}: Props) {
  const [items, setItems] = useState<SelectedInspoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, SelectedInspoItem>>({});

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    const supabase = createBrowserSupabase();

    let q = supabase
      .from('inspo_items')
      .select('id, thumbnail_url, file_url, content_type, visual_description, athlete_name, sport, brand_id')
      .eq('triage_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (contentType) q = q.eq('content_type', contentType);

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      // Match on the most useful free-text columns; OR-style filter.
      q = q.or(
        `visual_description.ilike.${term},athlete_name.ilike.${term},sport.ilike.${term}`
      );
    }

    const { data, error } = await q;
    if (error) {
      console.error('Inspo load failed:', error);
      setItems([]);
    } else {
      setItems((data as SelectedInspoItem[]) || []);
    }
    setLoading(false);
  }, [open, contentType, search]);

  useEffect(() => {
    if (open) {
      load();
      setSelected({});
    }
  }, [open, load]);

  function toggle(item: SelectedInspoItem) {
    setSelected((prev) => {
      if (multiSelect) {
        const next = { ...prev };
        if (next[item.id]) {
          delete next[item.id];
        } else {
          next[item.id] = item;
        }
        return next;
      }
      // single-select: replace
      return { [item.id]: item };
    });
  }

  function confirm() {
    const list = Object.values(selected);
    if (list.length === 0) return;
    onSelect(list);
    onClose();
  }

  if (!open) return null;

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#141414] border border-[#262626] rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#262626]">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="p-5 border-b border-[#262626]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            placeholder="Search by description, athlete, sport…"
            className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-600"
          />
          <button
            onClick={load}
            className="mt-2 text-xs text-orange-600 hover:text-orange-500"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center text-gray-500 py-12">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              No approved inspo items match your search.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((item) => {
                const isSel = !!selected[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors text-left ${
                      isSel
                        ? 'border-orange-600 ring-2 ring-orange-600/40'
                        : 'border-[#262626] hover:border-[#404040]'
                    }`}
                  >
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnail_url}
                        alt={item.visual_description || 'inspo'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center text-xs text-gray-600">
                        no thumbnail
                      </div>
                    )}
                    {item.content_type === 'video' && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold tracking-wider">
                        VIDEO
                      </span>
                    )}
                    {isSel && (
                      <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">
                        ✓
                      </span>
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="text-xs text-white truncate">
                        {item.athlete_name || item.sport || item.visual_description || ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-[#262626]">
          <div className="text-sm text-gray-500">
            {selectedCount === 0
              ? 'Select an item to continue'
              : `${selectedCount} selected`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#262626] hover:bg-[#333] text-gray-200 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use {selectedCount > 1 ? `${selectedCount} items` : 'this item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export named for the page imports — they expect both forms.
export { InspoPickerModal };
