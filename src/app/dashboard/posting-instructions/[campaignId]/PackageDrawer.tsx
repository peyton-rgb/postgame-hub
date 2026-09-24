'use client';

// ============================================================
// Edit panel for one athlete's posts — redesigned (Step 3).
//
// Adds a READY CHECKLIST: the handful of things that must be true before a
// link is worth texting, each ticked or not. It reads the same rules the
// roster's pipeline uses (captionApproved / videoReady in posting-packages.ts),
// so the panel and the roster can never disagree about whether a post is ready.
//
// Feed photos have no approval field in the database, so the Feed checklist
// has three items, not four. Nothing here adds a column.
//
// A right-side drawer (full-screen sheet on phones). It is a
// div[role=dialog], not an <aside>: DashboardShell hides every <aside>
// inside page content.
//
// Edits are held in local state per post until Save; school / handle belong
// to the athlete, so they are written to every one of their posts. Attaching
// a file from Drive is the exception — it saves straight away, and the panel
// says so. So is everything on a Feed post's photo list: adding, reordering
// and removing a carousel photo each write immediately.
//
// Two confirmations, both inline (no browser dialogs):
//   • a live link marks the post Posted and starts payment;
//   • closing with unsaved edits discards them.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAPTION_LIMIT,
  PACKAGE_STATUSES,
  REVIEW_STATUSES,
  STATUS_LABEL,
  captionApproved,
  deliverUrl,
  formatPostDate,
  isPosted,
  pillsFor,
  statusPill,
  videoReady,
  slotColumn,
  slotsFor,
  type AthleteRow,
  type PackageStatus,
  type PostingPhoto,
  type Slot,
  type StaffPackage,
} from '@/lib/posting-packages';
import { checkLiveUrl } from '@/lib/post-link';
import PostingDrivePicker from './PostingDrivePicker';

type Draft = Partial<
  Pick<
    StaffPackage,
    | 'intended_post_date'
    | 'post_date_label'
    | 'date_conditional'
    | 'caption_medium'
    | 'caption_status'
    | 'video_status'
    | 'live_url'
  >
>;

const SLOT_LABEL: Record<Slot, string> = {
  video: 'Video · the post',
  cover: 'Photo · the cover',
  photo: 'Photo · in-feed post',
};

function tabLabel(p: StaffPackage): string {
  const kind = p.deliverable_key === 'feed' ? 'Feed' : p.deliverable_key === 'reel' ? 'Reel' : 'Post';
  return `${kind} · ${formatPostDate(p.intended_post_date) ?? 'No date'}`;
}

// The athlete-facing stage (Phase 1's athleteStage): timestamps count too.
function stageOf(p: StaffPackage): PackageStatus {
  if (p.status === 'metrics_due' || p.status === 'complete') return p.status;
  if (isPosted(p)) return 'posted';
  if (p.confirmed_at || p.status === 'confirmed') return 'confirmed';
  if (p.sent_at || p.status === 'sent') return 'sent';
  return 'draft';
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall back */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* nothing else */
  }
  document.body.removeChild(ta);
}

/**
 * The carousel photo list for a Feed post.
 *
 * Order here IS the order the athlete posts in, so moving a photo changes the
 * post. Every action writes straight away through
 * /api/posting-packages/[id]/photos and the server answers with the whole
 * list back, so what's on screen is always what's stored — no optimistic
 * ordering that could drift from the database.
 */
function PhotoList({
  photos,
  packageId,
  disabled,
  onAdd,
  onChanged,
  onError,
}: {
  photos: PostingPhoto[];
  packageId: string;
  disabled: boolean;
  onAdd: () => void;
  onChanged: (photos: PostingPhoto[]) => void;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function send(method: 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    setBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/posting-packages/${packageId}/photos`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'That did not save.');
      onChanged((payload.photos as PostingPhoto[]) ?? []);
    } catch (e: any) {
      onError(e?.message || 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, by: -1 | 1) {
    const next = photos.slice();
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    send('PATCH', { order: next.map((p) => p.id) });
  }

  return (
    <>
      {photos.length === 0 ? (
        <p className="empty">No photos yet. A feed post needs at least one.</p>
      ) : (
        <ol className="photolist">
          {photos.map((photo, i) => (
            <li className="photorow" key={photo.id}>
              <span className="pos">{i + 1}</span>
              <div className="thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Photo ${i + 1}`} />
              </div>
              <div className="pmeta">
                <div className="pname" title={photo.file_name ?? undefined}>
                  {photo.file_name ?? 'Photo'}
                </div>
              </div>
              <div className="pactions">
                <button
                  type="button"
                  className="btn g sm"
                  onClick={() => move(i, -1)}
                  disabled={disabled || busy || i === 0}
                  aria-label={`Move photo ${i + 1} earlier`}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn g sm"
                  onClick={() => move(i, 1)}
                  disabled={disabled || busy || i === photos.length - 1}
                  aria-label={`Move photo ${i + 1} later`}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn g sm"
                  onClick={() => send('DELETE', { photoId: photo.id })}
                  disabled={disabled || busy}
                  aria-label={`Remove photo ${i + 1}`}
                  title="Remove"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="btn g sm"
        style={{ marginTop: 10 }}
        onClick={onAdd}
        disabled={disabled || busy}
      >
        {busy ? 'Saving…' : 'Add from Drive'}
      </button>
    </>
  );
}

export default function PackageDrawer({
  athlete,
  activeId,
  campaignId,
  brandName,
  onSelect,
  onClose,
  onUpdated,
  photos,
  onPhotosChanged,
}: {
  athlete: AthleteRow;
  activeId: string;
  campaignId: string;
  brandName: string | null;
  onSelect: (pkgId: string) => void;
  onClose: () => void;
  onUpdated: (updated: StaffPackage[]) => void;
  /** Carousel photos by package id, each list already in order. */
  photos: Record<string, PostingPhoto[]>;
  onPhotosChanged: (packageId: string, photos: PostingPhoto[]) => void;
}) {
  const posts = useMemo(
    () => [athlete.reel, athlete.feed, ...athlete.other].filter((p): p is StaffPackage => !!p),
    [athlete]
  );
  const pkg = posts.find((p) => p.id === activeId) ?? posts[0];

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [school, setSchool] = useState(athlete.school ?? '');
  const [handle, setHandle] = useState(athlete.handle ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [picker, setPicker] = useState<Slot | null>(null);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  // ---- draft helpers ----
  const draft = drafts[pkg.id] ?? {};
  const val = <K extends keyof Draft>(k: K): StaffPackage[K] => (k in draft ? (draft[k] as StaffPackage[K]) : pkg[k]);
  const set = (patch: Draft) =>
    setDrafts((d) => ({ ...d, [pkg.id]: { ...(d[pkg.id] ?? {}), ...patch } }));

  const changesFor = useCallback(
    (p: StaffPackage): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      const d = drafts[p.id] ?? {};
      for (const [k, v] of Object.entries(d)) {
        const saved = (p as Record<string, unknown>)[k];
        const norm = (x: unknown) => (typeof x === 'string' ? x.trim() : x ?? null) || null;
        if (norm(v) !== norm(saved) && !(typeof v === 'boolean' && v === saved)) out[k] = v;
      }
      if ((school.trim() || null) !== (athlete.school ?? null)) out.school = school;
      if ((handle.trim().replace(/^@+/, '') || null) !== (athlete.handle ?? null)) out.ig_handle = handle;
      return out;
    },
    [drafts, school, handle, athlete.school, athlete.handle]
  );
  const dirtyPosts = posts.filter((p) => Object.keys(changesFor(p)).length > 0);
  const dirty = dirtyPosts.length > 0;

  // Warn before a tab close / reload with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }, [dirty, onClose, saving]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !picker) requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose, picker]);

  // ---- date: keep the athlete-facing label in step with the date ----
  function changeDate(next: string) {
    const oldDate = val('intended_post_date');
    const label = (val('post_date_label') ?? '').trim();
    const followsDate = !label || label === formatPostDate(oldDate);
    set({
      intended_post_date: next || null,
      ...(followsDate ? { post_date_label: formatPostDate(next) } : {}),
    });
  }

  // ---- save ----
  const liveDraft = (val('live_url') ?? '').trim();
  const liveChanging = posts.some((p) => {
    const d = drafts[p.id]?.live_url;
    return typeof d === 'string' && d.trim() && d.trim() !== (p.live_url ?? '');
  });

  async function patch(p: StaffPackage, body: Record<string, unknown>) {
    const res = await fetch(`/api/posting-packages/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Saving ${tabLabel(p)} failed`);
    return json as StaffPackage;
  }

  async function save(opts: { confirmed?: boolean; thenMarkSent?: boolean } = {}) {
    setError(null);
    setNotice(null);
    // Validate links before asking anyone to confirm payment.
    for (const p of dirtyPosts) {
      const d = drafts[p.id]?.live_url;
      if (typeof d === 'string' && d.trim()) {
        const c = checkLiveUrl(d);
        if (!c.ok) {
          onSelect(p.id);
          setError(c.error);
          return;
        }
      }
    }
    if (liveChanging && !opts.confirmed) {
      setConfirmLive(true);
      return;
    }
    setConfirmLive(false);
    setSaving(true);
    const updated: StaffPackage[] = [];
    try {
      for (const p of dirtyPosts) {
        const body = changesFor(p);
        if ('live_url' in body) body.confirm = true; // confirmed above
        updated.push(await patch(p, body));
      }
      if (opts.thenMarkSent) {
        const fresh = updated.find((u) => u.id === pkg.id) ?? pkg;
        updated.push(await patch(fresh, { status: 'sent' }));
      }
      setDrafts({});
      setNotice(opts.thenMarkSent ? 'Saved and marked as sent.' : 'Saved.');
    } catch (e: any) {
      setError(e?.message || 'Saving failed.');
    } finally {
      if (updated.length) onUpdated(updated);
      setSaving(false);
    }
  }

  // ---- render ----
  const stage = stageOf(pkg);
  const stageIdx = PACKAGE_STATUSES.indexOf(stage);
  const caption = val('caption_medium') ?? '';
  const slots = slotsFor(pkg.deliverable_key);
  const pkgPhotos = photos[pkg.id] ?? [];
  // The athlete's ONE link — always their first post's token, never the
  // selected tab's. Both tokens open the same page, but the link staff copy
  // must not change as they click between posts.
  const url = deliverUrl(athlete.link.delivery_token);
  const canMarkSent = stage === 'draft';
  // Undo is offered only from 'sent'. Once an athlete has confirmed or posted,
  // walking the status backwards would contradict something they did.
  const canUndoSent = stage === 'sent';
  const brandPossessive = brandName ? (/['’]s$/i.test(brandName) ? brandName : `${brandName}'s`) : 'the brand';

  // ---- ready checklist ----
  // Built from the values ON SCREEN (val/drafts), so ticks move as you edit
  // rather than only after a save.
  const draftPkg = { ...pkg, ...(drafts[pkg.id] ?? {}) } as StaffPackage;
  const isFeed = pkg.deliverable_key === 'feed';
  const checklist: { label: string; done: boolean }[] = isFeed
    ? [
        { label: 'Caption approved', done: captionApproved(draftPkg) },
        { label: 'At least 1 photo', done: pkgPhotos.length > 0 },
        { label: 'Date set', done: !!val('intended_post_date') },
      ]
    : [
        { label: 'Caption approved', done: captionApproved(draftPkg) },
        { label: 'Video approved', done: videoReady(draftPkg) },
        { label: 'Cover attached', done: !!pkg.cover_url },
        { label: 'Date set', done: !!val('intended_post_date') },
      ];
  const left = checklist.filter((c) => !c.done).length;
  const sentAlready = stage !== 'draft';

  // ---- what the athlete will see for the date ----
  const previewDate = formatPostDate(val('intended_post_date')) ?? null;
  const previewLabel = (val('post_date_label') ?? '').trim() || previewDate;
  const schoolWord = school.trim() || athlete.school || 'they';
  const datePreview = previewLabel
    ? `${previewLabel} · ${val('date_conditional') ? `only if ${schoolWord} wins` : 'any time that day works'}`
    : 'No date yet — the athlete sees “Date TBC”.';

  async function undoSent() {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const updated = await patch(pkg, { status: 'draft', sent_at: null });
      onUpdated([updated]);
      setNotice('Marked back to draft.');
    } catch (e: any) {
      setError(e?.message || 'Could not undo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="scrim" onClick={requestClose} aria-hidden="true" />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="pi-drawer-name">
        <div className="dhead">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="eye">Athlete</p>
              <h2 className="dname" id="pi-drawer-name">{athlete.name}</h2>
            </div>
            <button ref={closeRef} type="button" className="close" onClick={requestClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="row2" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="lab" htmlFor="pi-school">School</label>
              <input id="pi-school" className="inp" value={school} placeholder="Not on file" onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div className="field">
              <label className="lab" htmlFor="pi-handle">Instagram handle</label>
              <input id="pi-handle" className="inp" value={handle} placeholder="Not on file" onChange={(e) => setHandle(e.target.value)} />
            </div>
          </div>
          <div className="tokenrow">
            <code title={url}>{url.replace(/^https?:\/\//, '')}</code>
            <button
              type="button"
              className="btn g sm"
              onClick={async () => {
                await copyText(url);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a className="btn g sm" href={`/deliver/${athlete.link.delivery_token}`} target="_blank" rel="noopener noreferrer">
              Preview
            </a>
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            One link per athlete — it covers every post below.
          </p>

          {posts.length > 1 && (
            <div className="ptabs" role="tablist" aria-label="Posts">
              {posts.map((p, i) => {
                const pill = statusPill(p, (photos[p.id] ?? []).length, brandName);
                const on = p.id === pkg.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    className={`ptab${on ? ' on' : ''}`}
                    aria-selected={on}
                    onClick={() => onSelect(p.id)}
                  >
                    <span className="t">
                      {i + 1} · {p.deliverable_key === 'feed' ? 'Feed post' : 'Reel + cover'}
                      {Object.keys(changesFor(p)).length > 0 && <b aria-label="unsaved"> •</b>}
                    </span>
                    <span className="s">
                      {formatPostDate(p.intended_post_date) ?? 'No date'} · {pill.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="dbody">
          {/* status track */}
          <div className="field">
            <span className="lab">Status</span>
            <div className="track6">
              {PACKAGE_STATUSES.map((s, i) => (
                <span key={s} className={`bar${i <= stageIdx ? ' on' : ''}`} />
              ))}
            </div>
            <div className="track6l">
              {PACKAGE_STATUSES.map((s) => (
                <span key={s} className={`lab${s === stage ? ' cur' : ''}`}>
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          </div>

          {/* ready checklist */}
          <div className={`ready ${sentAlready ? 'sent' : left === 0 ? 'ok' : 'warn'}`}>
            <div className="rt">
              {sentAlready ? 'Link sent' : left === 0 ? 'Ready to send' : `Not ready to send · ${left} left`}
            </div>
            <ul>
              {checklist.map((c) => (
                <li key={c.label} className={c.done ? 'done' : ''}>
                  <span className="tick" aria-hidden="true">
                    {c.done && (
                      <svg viewBox="0 0 16 16" fill="none">
                        <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          {/* post date */}
          <div className="field">
            <span className="lab">Post date</span>
            <div className="row2">
              <div className="field">
                <label className="lab" htmlFor="pi-date">Date</label>
                <input
                  id="pi-date"
                  className="inp"
                  type="date"
                  value={val('intended_post_date') ?? ''}
                  onChange={(e) => changeDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="lab" htmlFor="pi-datelabel">Shown to athlete</label>
                <input
                  id="pi-datelabel"
                  className="inp"
                  value={val('post_date_label') ?? ''}
                  placeholder={previewDate ?? 'e.g. Sat, Sept 26'}
                  onChange={(e) => set({ post_date_label: e.target.value })}
                />
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={!!val('date_conditional')}
                onChange={(e) => set({ date_conditional: e.target.checked })}
              />
              <span>Only if they win that day</span>
            </label>
            <p className="preview">
              <span className="lab">Athlete sees</span>
              {datePreview}
            </p>
          </div>

          {/* files */}
          {slots.includes('photo') ? (
            <div className="field">
              <span className="lab">Photos · the carousel, in posting order</span>
              <PhotoList
                photos={pkgPhotos}
                packageId={pkg.id}
                disabled={saving}
                onAdd={() => setPicker('photo')}
                onChanged={(next) => onPhotosChanged(pkg.id, next)}
                onError={setError}
              />
              <p className="hint">
                Athletes see them as soon as they&apos;re attached. Adding, moving and removing
                all save straight away.
              </p>
            </div>
          ) : (
            <div className="field">
              <span className="lab">Files · athletes see them as soon as they&apos;re attached</span>
              <div className="slots two">
                {slots.map((slot) => {
                  const column = slotColumn(slot);
                  const fileUrl = column ? pkg[column] : null;
                  const pill = pillsFor(pkg, pkgPhotos.length).find(
                    (x) => x.label === (slot === 'video' ? 'Video' : 'Cover')
                  );
                  return (
                    <div className="slot" key={slot}>
                      <span className="lab">{SLOT_LABEL[slot]}</span>
                      <div className={`pv${fileUrl ? ' has' : ''}`}>
                        {fileUrl ? (
                          slot === 'video' ? (
                            <video src={fileUrl} controls playsInline preload="metadata" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fileUrl} alt="" />
                          )
                        ) : (
                          <span className="em">—</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {slot === 'video' ? (
                          <select
                            className="inp"
                            aria-label="Video status"
                            value={val('video_status') ?? ''}
                            onChange={(e) => set({ video_status: e.target.value })}
                          >
                            {!val('video_status') && <option value="">Status…</option>}
                            {REVIEW_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          pill && (
                            <span className={`st ${pill.state}`}>
                              <i />
                              {fileUrl ? 'Attached' : 'Not added yet'}
                            </span>
                          )
                        )}
                      </div>
                      <button type="button" className="btn g sm" onClick={() => setPicker(slot)} disabled={saving}>
                        {fileUrl ? 'Replace' : 'From Drive'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="hint">Choosing a file copies it into the Hub and saves straight away.</p>
            </div>
          )}

          {/* caption */}
          <div className="field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <label className="lab" htmlFor="pi-cap">Caption</label>
              <select
                className="inp"
                aria-label="Caption status"
                value={val('caption_status') ?? ''}
                onChange={(e) => set({ caption_status: e.target.value })}
              >
                {!val('caption_status') && <option value="">Status…</option>}
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <textarea
              id="pi-cap"
              className="inp"
              rows={4}
              value={caption}
              placeholder="Not written yet"
              onChange={(e) => set({ caption_medium: e.target.value })}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span className="lab" style={caption.length > CAPTION_LIMIT ? { color: 'rgb(var(--status-bad-ink-rgb))' } : undefined}>
                {caption.length.toLocaleString()} / {CAPTION_LIMIT.toLocaleString()}
              </span>
            </div>
          </div>

          {/* live link */}
          <div className="field">
            <label className="lab" htmlFor="pi-live">Link to their live post</label>
            {pkg.live_url ? (
              <a href={pkg.live_url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>
                {pkg.live_url}
              </a>
            ) : (
              <>
                <input
                  id="pi-live"
                  className="inp"
                  type="url"
                  value={liveDraft}
                  placeholder="The athlete submits this. Paste it here only if they sent it another way."
                  onChange={(e) => {
                    set({ live_url: e.target.value });
                    setConfirmLive(false);
                  }}
                />
                <p className="hint">Saving a link marks this post Posted and starts payment.</p>
              </>
            )}
          </div>

          {confirmLive && (
            <div className="confirm" role="alert">
              <div className="t">Saving this marks the post Posted and starts payment.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn p sm" onClick={() => save({ confirmed: true })} disabled={saving}>
                  Yes, save and mark Posted
                </button>
                <button type="button" className="btn g sm" onClick={() => setConfirmLive(false)} disabled={saving}>
                  Not yet
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="dfoot">
          {confirmClose ? (
            <>
              <p className="hint" style={{ marginRight: 'auto', alignSelf: 'center', color: 'var(--ink-1)' }}>
                You have unsaved changes.
              </p>
              <button type="button" className="btn g" onClick={() => setConfirmClose(false)}>
                Keep editing
              </button>
              <button type="button" className="btn g" onClick={onClose}>
                Discard
              </button>
            </>
          ) : (
            <>
              <div style={{ marginRight: 'auto', alignSelf: 'center', minWidth: 0 }}>
                {error && <p className="err" role="alert">{error}</p>}
                {!error && notice && <p className="okmsg" role="status">{notice}</p>}
                {!error && !notice && (
                  <p className="hint">
                    {dirty ? 'Unsaved changes' : 'Changes save straight away; files copy into the Hub when chosen.'}
                  </p>
                )}
              </div>
              {canUndoSent ? (
                <button type="button" className="btn g" onClick={undoSent} disabled={saving} title="Put this post back to draft">
                  Undo sent
                </button>
              ) : (
                <button
                  type="button"
                  className="btn g"
                  onClick={() => save({ thenMarkSent: true })}
                  disabled={saving || !canMarkSent}
                  title={canMarkSent ? 'Records that this link went out' : 'Already sent'}
                >
                  Mark as sent
                </button>
              )}
              <button type="button" className="btn p" onClick={() => save()} disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {picker && (
        <PostingDrivePicker
          pkg={pkg}
          slot={picker}
          campaignId={campaignId}
          onClose={() => setPicker(null)}
          onAttached={({ package: updated, photos: nextPhotos }) => {
            if (updated) onUpdated([updated]);
            if (nextPhotos) onPhotosChanged(pkg.id, nextPhotos);
            setNotice(nextPhotos ? 'Photos attached.' : 'File attached.');
          }}
        />
      )}
    </>
  );
}
