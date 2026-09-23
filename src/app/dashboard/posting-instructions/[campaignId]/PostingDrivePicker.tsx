'use client';

// ============================================================
// Single-file Drive picker for one posting slot.
//
// The AthleteDriveFolderPicker pattern (paste a folder URL → thumbnails →
// pick), cut down to one file and pointed at the posting attach route. The
// recap pickers are untouched. Lists through /api/drive/list-folder-files
// (no recapId → no "already imported" greying) and shows thumbnails through
// the existing /api/drive/thumbnail proxy.
//
// The last folder URL is remembered per posting campaign in localStorage —
// a convenience only, wrapped so private mode can't break the picker.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import type { Slot, StaffPackage } from '@/lib/posting-packages';

type PickerFile = { id: string; name: string; mimeType: string; isVideo: boolean; size: string | null };

const SLOT_LABEL: Record<Slot, string> = { video: 'video', cover: 'cover photo', photo: 'feed photo' };

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
  onAttached: (updated: StaffPackage) => void;
}) {
  const [folderUrl, setFolderUrl] = useState('');
  const [files, setFiles] = useState<PickerFile[] | null>(null);
  const [folderName, setFolderName] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<'list' | 'attach' | null>(null);
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

  async function list() {
    if (!folderUrl.trim()) return;
    setBusy('list');
    setError(null);
    setPicked(null);
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
    const file = shown.find((f) => f.id === picked);
    if (!file) return;
    setBusy('attach');
    setError(null);
    try {
      const res = await fetch(`/api/posting-packages/${pkg.id}/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, driveFileId: file.id, fileName: file.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Copying the file failed.');
      onAttached(body.package as StaffPackage);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Copying the file failed.');
      setBusy(null);
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`Choose the ${SLOT_LABEL[slot]} from Drive`}>
      <div className="box">
        <div className="mhead">
          <div>
            <p className="lab">Choose from Drive · {pkg.athlete_name.trim()}</p>
            <div style={{ color: 'var(--ink-1)', fontWeight: 700, marginTop: 4 }}>
              The {SLOT_LABEL[slot]}
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
              </p>
              {shown.length === 0 ? (
                <p className="empty">No {wantVideo ? 'videos' : 'images'} in this folder.</p>
              ) : (
                <div className="grid">
                  {shown.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="tile"
                      aria-pressed={picked === f.id}
                      onClick={() => setPicked(f.id)}
                      title={f.name}
                    >
                      <div className="th">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/drive/thumbnail/${f.id}`} alt="" loading="lazy" />
                        {f.isVideo && <span className="st ok kind"><i />Video</span>}
                      </div>
                      <div className="nm">{f.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="dfoot">
          <p className="hint" style={{ marginRight: 'auto', alignSelf: 'center' }}>
            Copies the file into the Hub. Saves straight away.
          </p>
          <button type="button" className="btn g" onClick={onClose} disabled={busy === 'attach'}>
            Cancel
          </button>
          <button type="button" className="btn p" onClick={attach} disabled={!picked || busy !== null}>
            {busy === 'attach' ? 'Copying…' : 'Use this file'}
          </button>
        </div>
      </div>
    </div>
  );
}
