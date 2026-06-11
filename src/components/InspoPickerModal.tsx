// ============================================================
// Inspo Picker Modal
//
// A reusable modal that lets CMs browse the inspo library
// and select assets to attach to concepts or creator briefs.
// Used on the concepts page (Collaborate mode) and the
// creator brief editor.
//
// Props:
//   - isOpen: boolean — show/hide the modal
//   - onClose: () => void
//   - onSelect: (items: SelectedInspoItem[]) => void
//   - selectedIds: string[] — already-selected item IDs (shown as checked)
//   - maxSelections?: number — limit how many can be picked (default: 20)
//   - filterContentType?: string — pre-filter to photos or videos
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';

// Lightweight type for what the picker returns
export interface SelectedInspoItem {
  id: string;
  file_url: string | null;
  thumbnail_url: string | null;
  mime_type: string | null;
  content_type: string;
  visual_description: string | null;
  sport: string | null;
  athlete_name: string | null;
  search_phrases: string[];
}

interface InspoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (items: SelectedInspoItem[]) => void;
  selectedIds?: string[];
  maxSelections?: number;
  filterContentType?: string;
}

export default function InspoPickerModal({
  isOpen,
  onClose,
  onSelect,
  selectedIds = [],
  maxSelections = 20,
  filterContentType,
}: InspoPickerModalProps) {
  const [items, setItems] = useState<SelectedInspoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [total, setTotal] = useState(0);

  // Sync selectedIds prop
  useEffect(() => {
    setSelected(new Set(selectedIds));
  }, [selectedIds]);

  // Fetch items
  const fetchItems = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);

    const params = new URLSearchParams();
    params.set('tagging_status', 'ready');
    params.set('limit', '60');
    params.set('sort', 'hero_first');
    if (search) params.set('q', search);
    if (filterContentType) params.set('content_type', filterContentType);

    try {
      const res = await fetch(`/api/inspo?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch inspo for picker:', err);
    }

    setLoading(false);
  }, [isOpen, search, filterContentType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Toggle selection
  const toggleItem = (item: SelectedInspoItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else if (next.size < maxSelections) {
        next.add(item.id);
      }
      return next;
    });
  };

  // Confirm selection
  const handleConfirm = () => {
    const selectedItems = items.filter((item) => selected.has(item.id));
    onSelect(selectedItems);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#141414] border border-white/10 rounded-xl w-[90vw] max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Pick from Inspo Library</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {selected.size} selected{maxSelections < 20 ? ` (max ${maxSelections})` : ''}
              {' '}&middot; {total} asset{total !== 1 ? 's' : ''} available
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-white/10">
          <input
            type="text"
            placeholder="Search by vibe, sport, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center text-gray-400 py-10">Loading assets...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              No ready assets found. Upload and tag footage on the Intake page first.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {items.map((item) => {
                const isSelected = selected.has(item.id);
                const thumbUrl = item.thumbnail_url || item.file_url;
                const isVideo = item.mime_type?.startsWith('video/');

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 ring-1 ring-blue-500/30'
                        : 'border-transparent hover:border-white/20'
                    }`}
                  >
                    <div className="aspect-square bg-white/5">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={item.visual_description || ''}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">
                          {isVideo ? '🎬' : '📷'}
                        </div>
                      )}
                    </div>

                    {/* Check overlay */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        ✓
                      </div>
                    )}

                    {/* Video indicator */}
                    {isVideo && (
                      <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/70 text-white text-[9px] rounded">
                        VIDEO
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Attach {selected.size} Asset{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
