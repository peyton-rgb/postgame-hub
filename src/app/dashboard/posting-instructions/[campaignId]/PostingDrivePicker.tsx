'use client';

// ============================================================
// Drive picker for one posting slot.
//
// The AthleteDriveFolderPicker pattern (paste a folder URL → thumbnails →
// pick), pointed at the posting attach route. The recap pickers are
// untouched. Lists through /api/drive/list-folder-files (no recapId → no
// "already imported" greying) and shows thumbnails through the existing
// /api/drive/thumbnail proxy.
//
// The video and cover slots take ONE file. The photo slot is a carousel, so
// it takes several: tapping toggles a file in or out and the tiles show the
// order they'll be added in — which is the order they'll be posted in. They
// are copied one at a time, because each copy is its own attach call, and a
// failure halfway still keeps the photos that made it.
//
// The last folder URL is remembered per posting campaign in localStorage —
// a convenience only, wrapped so private mode can't break the picker.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import type { PostingPhoto, Slot, StaffPackage } from '@/lib/posting-packages';

type PickerFile = { id: string; name: string; mimeType: string; isVideo: boolean; size: string | null };

const SLOT_LABEL: Record<Slot, string> = { video: 'video', cover: 'cover photo', photo: 'feed photos' };

function folderKey(campaignId: string) {
  return `pg-posting-folder:${campaignId}`;
}

export default function PostingDrivePicker({
  pkg,
  slot,
  campaignId,
  onClose,
  onAttached,
}: {
  pkg: StaffPackage;
  slot: Slot;
  campaignId: string;
  onClose: () => void;
  onAttached: (result: { package?: StaffPackage; photos?: PostingPhoto[] }) => void;
}) {
  // A carousel takes many files; every other slot takes exactly one.
  const multi = slot === 'photo';

  const [folderUrl, setFolderUrl] = useState('');
  const [files, setFiles] = useState<PickerFile[] | null>(null);
  const [folderName, setFolderName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<'list' | 'attach' | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(folderKey(campaignId));
      if (saved) setFolderUrl(saved);
    } catch {
      /* ignore */
    }
  }, [campaignId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && busy !== 'attach') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const wantVideo = slot === 'video';
  const shown = useMemo(
    () => (files ?? []).filter((f) => (wantVideo ? f.isVideo : f.mimeType.startsWith('image/'))),
    [files, wantVideo]
  );
  const hiddenCount = (files?.length ?? 0) - shown.length;

  function toggle(id: string) {
    setPicked((prev) => {
      if (!multi) return prev[0] === id ? [] : [id];
      return prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
    });
  }

  async function list() {
    if (!folderUrl.trim()) return;
    setBusy('list');
    setError(null);
    setPicked([]);
    try {
      const res = await fetch('/api/drive/list-folder-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrl: folderUrl.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not open that folder.');
      setFiles(body.files ?? []);
      setFolderName(body.folderName ?? 'Drive folder');
      try {
        window.localStorage.setItem(folderKey(campaignId), folderUrl.trim());
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setFiles(null);
      setError(e?.message || 'Could not open that folder.');
    } finally {
      setBusy(null);
    }
  }

  async function attach() {
    const chosen = picked
      .map((id) => shown.find((f) => f.id === id))
      .filter((f): f is PickerFile => !!f);
    if (!chosen.length) return;

    setBusy('attach');
    setError(null);
    setProgress({ done: 0, total: chosen.length });

    let lastPhotos: PostingPhoto[] | undefined;
    let lastPackage: StaffPackage | undefined;

    // One at a time: each copy pulls the bytes through the server, and the
    // photo's position is read-then-written, so parallel calls would race.
    for (let i = 0; i < chosen.length; i++) {
      const file = chosen[i];
      try {
        const res = await fetch(`/api/posting-packages/${pkg.id}/attach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot, driveFileId: file.id, fileName: file.name }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Copying the file failed.');
        if (body.photos) lastPhotos = body.photos as PostingPhoto[];
        if (body.package) lastPackage = body.package as StaffPackage;
        setProgress({ done: i + 1, total: chosen.length });
      } catch (e: any) {
        // Hand back whatever landed before the failure, so the drawer shows
        // the photos that did copy rather than losing them.
        if (lastPhotos || lastPackage) onAttached({ package: lastPackage, photos: lastPhotos });
        setError(
          chosen.length > 1
            ? `${file.name}: ${e?.message || 'copying failed'}. ${i} of ${chosen.length} added.`
            : e?.message || 'Copying the file failed.'
        );
        setBusy(null);
        setProgress(null);
        setPicked((prev) => prev.filter((id) => chosen.slice(0, i).every((c) => c.id !== id)));
        return;
      }
    }

    onAttached({ package: lastPackage, photos: lastPhotos });
    onClose();
  }

  const actionLabel = multi
    ? picked.length > 1
      ? `Add ${picked.length} photos`
      : 'Add photo'
    : 'Use this file';

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`Choose the ${SLOT_LABEL[slot]} from Drive`}>
      <div className="box">
        <div className="mhead">
          <div>
            <p className="lab">Choose from Drive · {pkg.athlete_name.trim()}</p>
            <div style={{ color: 'var(--ink-1)', fontWeight: 700, marginTop: 4 }}>
              {multi ? 'The feed photos' : `The ${SLOT_LABEL[slot]}`}
            </div>
          </div>
          <button type="button" className="close" onClick={onClose} disabled={busy === 'attach'} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mbody">
          <div className="field">
            <label className="lab" htmlFor="pi-folder">Drive folder link</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="pi-folder"
                className="inp"
                type="url"
                placeholder="https://drive.google.com/drive/folders/…"
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') list();
                }}
              />
              <button type="button" className="btn g" onClick={list} disabled={!folderUrl.trim() || busy !== null}>
                {busy === 'list' ? 'Opening…' : 'Open'}
              </button>
            </div>
            <p className="hint">The folder must be shared with the Postgame Google account.</p>
          </div>

          {error && <p className="err" role="alert">{error}</p>}

          {files && (
            <>
              <p className="hint">
                {folderName} · {shown.length} {wantVideo ? 'video' : 'image'}
                {shown.length === 1 ? '' : 's'}
                {hiddenCount > 0 ? ` (${hiddenCount} other file${hiddenCount === 1 ? '' : 's'} hidden — wrong type for this slot)` : ''}
                {multi && shown.length > 0 ? ' · tap them in the order they should appear in the post' : ''}
              </p>
              {shown.length === 0 ? (
                <p className="empty">No {wantVideo ? 'videos' : 'images'} in this folder.</p>
              ) : (
                <div className="grid">
                  {shown.map((f) => {
                    const at = picked.indexOf(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className="tile"
                        aria-pressed={at >= 0}
                        onClick={() => toggle(f.id)}
                        disabled={busy === 'attach'}
                        title={f.name}
                      >
                        <div className="th">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/drive/thumbnail/${f.id}`} alt="" loading="lazy" />
                          {f.isVideo && <span className="st ok kind"><i />Video</span>}
                          {multi && at >= 0 && <span className="pickno">{at + 1}</span>}
                        </div>
                        <div className="nm">{f.name}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <div className="dfoot">
          <p className="hint" style={{ marginRight: 'auto', alignSelf: 'center' }}>
            {busy === 'attach' && progress
              ? `Copying ${progress.done + 1} of ${progress.total}…`
              : multi
                ? 'Copies each file into the Hub, in the order you tapped them.'
                : 'Copies the file into the Hub. Saves straight away.'}
          </p>
          <button type="button" className="btn g" onClick={onClose} disabled={busy === 'attach'}>
            Cancel
          </button>
          <button type="button" className="btn p" onClick={attach} disabled={picked.length === 0 || busy !== null}>
            {busy === 'attach' ? 'Copying…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
