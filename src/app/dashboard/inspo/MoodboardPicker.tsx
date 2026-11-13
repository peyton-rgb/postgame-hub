// ============================================================
// Moodboard picker — "add this asset to a moodboard".
//
// Lists the existing moodboards and lets the viewer add the
// asset to one, or name a new board and add the asset to that.
// Reads and writes `moodboards` and `moodboard_items` directly
// through the signed-in browser client; both tables already
// allow signed-in staff full access.
//
// A bottom sheet on a phone, a centred dialog on a wide screen.
// ============================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InspoItem } from '@/lib/types/intake';
import { stillFor } from './inspo-media';

export interface MoodboardRow {
  id: string;
  name: string;
  itemCount: number;
}

// Loads every moodboard with its item count, newest first.
export async function loadMoodboards(supabase: SupabaseClient): Promise<MoodboardRow[]> {
  const { data, error } = await supabase
    .from('moodboards')
    .select('id, name, moodboard_items(count)')
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => {
    const counts = row.moodboard_items as unknown as { count: number }[] | null;
    return { id: row.id as string, name: row.name as string, itemCount: counts?.[0]?.count ?? 0 };
  });
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  // `moodboards.slug` is unique; the suffix keeps two boards with the same
  // name from colliding.
  return `${base || 'board'}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MoodboardPicker({
  item,
  supabase,
  onClose,
  onChanged,
}: {
  item: InspoItem;
  supabase: SupabaseClient;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [boards, setBoards] = useState<MoodboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setBoards(await loadMoodboards(supabase));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Escape closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addTo = async (board: MoodboardRow) => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from('moodboard_items')
      .insert({ moodboard_id: board.id, inspo_item_id: item.id, position: board.itemCount });
    if (error) {
      // 23505 = the (moodboard, asset) pair already exists.
      setMessage(
        error.code === '23505'
          ? { tone: 'ok', text: `Already on "${board.name}".` }
          : { tone: 'bad', text: `Could not add to "${board.name}". ${error.message}` },
      );
    } else {
      setMessage({ tone: 'ok', text: `Added to "${board.name}".` });
      await refresh();
      onChanged();
    }
    setBusy(false);
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase
      .from('moodboards')
      .insert({ name, slug: slugify(name), cover_image_url: stillFor(item) })
      .select('id, name')
      .single();
    if (error || !data) {
      setMessage({ tone: 'bad', text: `Could not create the board. ${error?.message ?? ''}` });
      setBusy(false);
      return;
    }
    setNewName('');
    await addTo({ id: data.id as string, name: data.name as string, itemCount: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end nav:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="moodboard-picker-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full nav:max-w-md max-h-[85vh] overflow-y-auto bg-ground border border-hairline rounded-t-2xl nav:rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="moodboard-picker-title" className="text-base font-semibold">
            Add to moodboard
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* New board */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createAndAdd();
          }}
          className="flex gap-2 mb-4"
        >
          <label htmlFor="new-moodboard-name" className="sr-only">
            New moodboard name
          </label>
          <input
            id="new-moodboard-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New moodboard name"
            className="flex-1 min-w-0 min-h-[44px] px-3 bg-white/5 border border-white/10 rounded-lg text-base text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
          />
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="min-h-[44px] px-4 rounded-lg text-sm font-medium bg-[#D73F09] text-white disabled:opacity-40 transition-opacity"
          >
            Create and add
          </button>
        </form>

        {message && (
          <p
            role="status"
            className={`mb-3 text-sm ${message.tone === 'ok' ? 'text-status-ok-ink' : 'text-status-bad'}`}
          >
            {message.text}
          </p>
        )}

        {/* Existing boards */}
        {loading ? (
          <p className="text-sm text-gray-400 py-4">Loading moodboards...</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            No moodboards yet. Name one above to create it and add this asset.
          </p>
        ) : (
          <ul className="space-y-2">
            {boards.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addTo(board)}
                  className="w-full min-h-[48px] px-3 flex items-center justify-between gap-3 text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  <span className="text-sm font-medium truncate">{board.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {board.itemCount} asset{board.itemCount === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
