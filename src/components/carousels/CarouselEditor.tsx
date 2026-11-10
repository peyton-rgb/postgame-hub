'use client';

// The carousel editor (batch A of the editing tools): select, move, resize,
// crop edges, reframe, snapping with live measurements, the layer panel, the
// layers list, undo/redo, keyboard nudges — and autosave, where every save is
// also kept as a version. Behaviour follows the old artifact (lib/carousel/edit).

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AthleteSwitcher, { type AthleteOption } from './AthleteSwitcher';
import { useCallback, useEffect, useRef, useState } from 'react';
import ClipPicker from './ClipPicker';
import CarouselCanvas, { type CanvasHandle, type CanvasMedia } from './CarouselCanvas';
import LayerProps, { MultiProps } from './LayerProps';
import LayersList from './LayersList';
import ClipTimeline from './ClipTimeline';
import GuidesPanel from './GuidesPanel';
import { lookFor, refineLook } from '@/lib/carousel/grade';
import { useScenes } from './gradeImage';
import { H, SLIDE, W, insetOf, vinOf, vlenOf, type Layer, type Layout } from '@/lib/carousel/layout';
import { act, applyDrag, applyGroup, boxOf, guidesOf, makeCutout, margins, moveLayerTo, newCard, swapMedia, newText, pairOf, partnersOf, removeLayers, setGuides, snapGuide, startBodyDrag, startGroup, type Action, type Box, type Drag, type GroupDrag } from '@/lib/carousel/edit';
import type { PickerClip } from './ClipPicker';

type Athlete = { slug: string; name: string; campaign: string | null };
type Loaded = { layout: Layout | null; media: Record<string, CanvasMedia>; savedAt?: string | null; updatedAt?: string | null };
type SaveState = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';
type Tab = 'layer' | 'layers' | 'add';

export default function CarouselEditor({
  athlete, athletes, position, total, prevSlug, nextSlug,
}: {
  athlete: Athlete; athletes: AthleteOption[]; position: number; total: number; prevSlug: string; nextSlug: string;
}) {
  const router = useRouter();
  // The change waiting on the 1.2s autosave timer, if any (see goTo).
  const pending = useRef<Layout | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [selId, setSelIdRaw] = useState<string | null>(null);
  const [selSet, setSelSet] = useState<string[]>([]);
  const setSelId = useCallback((id: string | null) => { setSelIdRaw(id); setSelSet(id ? [id] : []); }, []);
  const selectMany = useCallback((ids: string[]) => { setSelSet(ids); setSelIdRaw(ids.length ? ids[ids.length - 1] : null); }, []);
  const toggleSel = useCallback((id: string) => {
    setSelSet((cur) => { const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]; setSelIdRaw(next.length ? next[next.length - 1] : null); return next; });
  }, []);
  const [playing, setPlaying] = useState(true);
  const [seams, setSeams] = useState(true);
  const [snap, setSnap] = useState(true);
  const [frameMode, setFrameMode] = useState(false);
  const [, setTab] = useState<Tab>('layer'); // kept so older calls stay harmless
  const [view, setView] = useState<'all' | number>('all');
  const [drawer, setDrawer] = useState(false);
  // When set, the drawer is in "Replace" mode for this layer (Swap button).
  const [swapId, setSwapId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [seek, setSeek] = useState<{ t: number; n: number } | undefined>();
  const [maxH, setMaxH] = useState(720);
  useEffect(() => {
    const f = () => setMaxH(Math.max(320, window.innerHeight - 300));
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  const [toast, setToast] = useState<string | null>(null);
  const [guide, setGuide] = useState<{ gx: number | null; gy: number | null }>({ gx: null, gy: null });
  const [measureOn, setMeasureOn] = useState(false);
  const [save, setSave] = useState<{ state: SaveState; at?: string | null; msg?: string }>({ state: 'saved' });

  const canvas = useRef<CanvasHandle>(null);
  const hist = useRef<{ list: string[]; pos: number }>({ list: [], pos: 0 });
  const [, bump] = useState(0);
  const base = useRef<string | null>(null); // updated_at we last loaded/saved
  const drag = useRef<
    | { kind: 'one'; d: Drag; p: { x: number; y: number }; start: Layout; paired: boolean }
    | { kind: 'group'; g: GroupDrag; p: { x: number; y: number }; start: Layout }
    | { kind: 'guide'; axis: 'v' | 'h'; i: number; start: Layout; del: boolean }
    | null
  >(null);
  const multi = selSet.length > 1;
  const saveTimer = useRef<number>();
  const nudgeTimer = useRef<number>();
  const firstName = athlete.name.split(' ')[0];
  const media = loaded?.media ?? {};

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 2600);
  }, []);

  // ---------- load ----------
  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/carousels/${athlete.slug}/layout`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setLoaded(body);
      setLayout(body.layout);
      base.current = body.updatedAt ?? null;
      hist.current = { list: body.layout ? [JSON.stringify(body.layout)] : [], pos: 0 };
      setSave({ state: 'saved', at: body.savedAt });
      setSelId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the carousel');
    }
  }, [athlete.slug]);
  useEffect(() => { setLoaded(null); setLayout(null); load(); }, [load]);

  // ---------- save (debounced after each committed change) ----------
  const doSave = useCallback(async (l: Layout) => {
    setSave((s) => ({ ...s, state: 'saving' }));
    try {
      const res = await fetch(`/api/carousels/${athlete.slug}/layout`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: l, baseUpdatedAt: base.current }),
      });
      const body = await res.json();
      if (res.status === 409) { setSave({ state: 'conflict', msg: body.error }); return; }
      if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`);
      base.current = body.updatedAt;
      setSave({ state: 'saved', at: body.savedAt });
    } catch (e) {
      setSave({ state: 'error', msg: e instanceof Error ? e.message : 'Save failed' });
    }
  }, [athlete.slug]);

  const commit = useCallback((next: Layout) => {
    const h = hist.current, s = JSON.stringify(next);
    if (h.list[h.pos] === s) return;
    h.list = h.list.slice(0, h.pos + 1).concat(s).slice(-200);
    h.pos = h.list.length - 1;
    bump((n) => n + 1);
    setSave((v) => (v.state === 'conflict' ? v : { ...v, state: 'unsaved' }));
    window.clearTimeout(saveTimer.current);
    pending.current = next;
    saveTimer.current = window.setTimeout(() => { pending.current = null; doSave(next); }, 1200);
  }, [doSave]);

  // Switch athlete — but save any change still waiting on the timer first, so
  // it lands on this athlete's carousel and isn't lost.
  const goTo = useCallback(async (slug: string) => {
    const p = pending.current;
    if (p) { window.clearTimeout(saveTimer.current); pending.current = null; await doSave(p); }
    router.push(`/dashboard/carousels/${slug}`);
  }, [doSave, router]);

  // Don't lose a pending save when leaving the page.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (save.state === 'unsaved' || save.state === 'saving') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save.state]);

  const undo = useCallback(() => {
    const h = hist.current; if (h.pos <= 0) return;
    h.pos--; const l = JSON.parse(h.list[h.pos]); setLayout(l); bump((n) => n + 1);
    if (selId && !l.layers.some((o: Layer) => o.id === selId)) setSelId(null);
    window.clearTimeout(saveTimer.current); setSave((v) => ({ ...v, state: 'unsaved' }));
    saveTimer.current = window.setTimeout(() => doSave(l), 1200);
  }, [doSave, selId]);
  const redo = useCallback(() => {
    const h = hist.current; if (h.pos >= h.list.length - 1) return;
    h.pos++; const l = JSON.parse(h.list[h.pos]); setLayout(l); bump((n) => n + 1);
    window.clearTimeout(saveTimer.current); setSave((v) => ({ ...v, state: 'unsaved' }));
    saveTimer.current = window.setTimeout(() => doSave(l), 1200);
  }, [doSave]);

  // ---------- layer edits ----------
  const selected = layout?.layers.find((l) => l.id === selId) ?? null;
  const selScene = useScenes([selected && selected.type !== 'text' ? media[selected.media]?.thumb : null]);
  const patchLayer = useCallback((id: string, patch: Partial<Layer>, doCommit: boolean) => {
    setLayout((cur) => {
      if (!cur) return cur;
      const next = { ...cur, layers: cur.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
      if (doCommit) commit(next);
      return next;
    });
  }, [commit]);
  const runAct = useCallback((a: Action, id = selId) => {
    if (!layout || !id) return;
    if (a === 'del' && selSet.length > 1) { const l = removeLayers(layout, selSet); setLayout(l); setSelId(null); commit(l); return; }
    const r = act(layout, id, a);
    setLayout(r.layout); setSelId(r.select); commit(r.layout);
  }, [layout, selId, selSet, commit, setSelId]);
  const patchMany = useCallback((ids: string[], patch: Partial<Layer>, doCommit: boolean) => {
    setLayout((cur) => {
      if (!cur) return cur;
      const next = { ...cur, layers: cur.layers.map((l) => (ids.includes(l.id) && l.type !== 'text' ? { ...l, ...patch } : l)) };
      if (doCommit) commit(next);
      return next;
    });
  }, [commit]);
  const addText = useCallback(() => {
    if (!layout) return;
    const sel = layout.layers.find((l) => l.id === selId);
    const slide = view !== 'all' ? view : sel ? Math.max(0, Math.min(4, Math.floor((sel.x + (sel.type === 'text' ? 0 : sel.w / 2)) / SLIDE))) : 2;
    const r = newText(layout, slide);
    setLayout(r.layout); setSelId(r.id); setTab('layer'); commit(r.layout);
  }, [layout, selId, commit, setSelId, view]);
  const cutout = useCallback(() => {
    if (!layout || !selected) return;
    const r = makeCutout(layout, selected.id, media, isBgLike(selected));
    if (!r) return;
    setLayout(r.layout); selectMany(r.ids); commit(r.layout); flash('Cutout added on top — both selected');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, selId, media, commit, selectMany, flash]);
  const isBgLike = (L: Layer) => L.y <= 0 && L.h >= H && L.w >= SLIDE;
  const updateGuides = useCallback((patch: Parameters<typeof setGuides>[1], doCommit = true) => {
    setLayout((cur) => { if (!cur) return cur; const n = setGuides(cur, patch); if (doCommit) commit(n); return n; });
  }, [commit]);

  // ---------- add a Frame.io clip from the picker ----------
  const [adding, setAdding] = useState<string | null>(null);
  // Records a Frame.io file as usable media for this athlete and loads it.
  const register = useCallback(async (c: PickerClip): Promise<{ key: string; media: CanvasMedia }> => {
    const res = await fetch(`/api/carousels/${athlete.slug}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fioId: c.id }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
    setLoaded((cur) => (cur ? { ...cur, media: { ...cur.media, [body.key]: body.media } } : cur));
    return body;
  }, [athlete.slug]);

  const addClip = useCallback(async (c: PickerClip) => {
    if (!layout || adding) return;
    setAdding(c.id);
    flash(`Adding ${c.name}…`);
    try {
      const body = await register(c);
      const sel = layout.layers.find((l) => l.id === selId);
      const slide = view !== 'all' ? view : sel ? Math.max(0, Math.min(4, Math.floor((sel.x + sel.w / 2) / SLIDE))) : 2;
      const r = newCard(layout, body.key, body.media, c.name.replace(/\.[^.]+$/, ''), slide);
      setLayout(r.layout); setSelId(r.id); setTab('layer'); commit(r.layout);
      flash(c.kind === 'video' ? `Added to slide ${slide + 1} — pick the moment in Clip section` : `Added to slide ${slide + 1}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not add that clip');
    } finally {
      setAdding(null);
    }
  }, [layout, selId, register, adding, commit, flash, view]);

  // Swap: put a different clip/photo into an existing layer's frame.
  const swapClip = useCallback(async (id: string, c: PickerClip) => {
    if (!layout || adding) return;
    setAdding(c.id);
    flash(`Swapping in ${c.name}…`);
    try {
      const body = await register(c);
      const n = swapMedia(layout, id, body.key, c.name.replace(/\.[^.]+$/, ''));
      setLayout(n); setSelId(id); commit(n);
      flash(c.kind === 'video' ? 'Swapped — pick the moment in Clip section' : 'Swapped');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not swap that clip');
    } finally {
      setAdding(null);
    }
  }, [layout, register, adding, commit, flash]);

  // Text boxes are measured from the page so handles/snapping fit the real glyphs.
  const measure = (L: Layer): Box => {
    if (L.type !== 'text') return boxOf(L);
    const el = canvas.current?.el?.querySelector<HTMLElement>(`[data-layer="${L.id}"]`);
    return boxOf(L, el ? { w: el.offsetWidth, h: el.offsetHeight } : undefined);
  };

  // ---------- rulers: drag in from the top for a horizontal guide, from the left for a vertical one ----------
  const startGuide = (axis: 'v' | 'h', e: React.PointerEvent) => {
    if (!layout || !canvas.current) return;
    const G = guidesOf(layout);
    if (G.lock) { flash('Guides are locked'); return; }
    const p = canvas.current.toStage(e.clientX, e.clientY);
    const start = setGuides(layout, { [axis]: [...G[axis], Math.round(axis === 'v' ? p.x : p.y)], show: true });
    setLayout(start);
    drag.current = { kind: 'guide', axis, i: G[axis].length, start, del: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const moveGuide = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g || g.kind !== 'guide' || !canvas.current) return;
    const p = canvas.current.toStage(e.clientX, e.clientY);
    const raw = g.axis === 'v' ? p.x : p.y;
    const v = snap && !e.shiftKey ? snapGuide(g.start, g.axis, raw, canvas.current.scale) : Math.round(raw);
    g.del = g.axis === 'v' ? v < 0 || v > W : v < 0 || v > H;
    const G = guidesOf(g.start), arr = G[g.axis].slice(); arr[g.i] = v;
    setLayout(setGuides(g.start, { [g.axis]: arr }));
    setGuide(g.axis === 'v' ? { gx: g.del ? null : v, gy: null } : { gx: null, gy: g.del ? null : v });
  };

  // ---------- pointer: select / drag / handles ----------
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!layout || !canvas.current || e.button !== 0) return;
    const t = e.target as HTMLElement;
    const p = canvas.current.toStage(e.clientX, e.clientY);
    const cap = () => (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const gl = t.closest<HTMLElement>('[data-guide]');
    if (gl && !guidesOf(layout).lock) {
      const [axis, i] = gl.dataset.guide!.split(':');
      drag.current = { kind: 'guide', axis: axis as 'v', i: +i, start: layout, del: false };
      cap(); e.preventDefault(); return;
    }
    const handle = t.closest<HTMLElement>('[data-corner],[data-edge]');
    if (handle && multi) {
      drag.current = { kind: 'group', g: startGroup(layout, selSet, 'gresize', handle.dataset.corner ?? 'se'), p, start: layout };
      cap(); setMeasureOn(true); e.preventDefault(); return;
    }
    if (handle && selected && !selected.locked) {
      drag.current = handle.dataset.edge
        ? { kind: 'one', d: { mode: 'edge', id: selected.id, edge: handle.dataset.edge as 'n', o: insetOf(selected) }, p, start: layout, paired: false }
        : { kind: 'one', d: { mode: 'resize', id: selected.id, corner: handle.dataset.corner!, o: { x: selected.x, y: selected.y, w: selected.w, h: selected.h }, ratio: selected.w / selected.h }, p, start: layout, paired: false };
      cap(); setMeasureOn(true); e.preventDefault(); return;
    }
    const el = t.closest<HTMLElement>('[data-layer]');
    const L = el ? layout.layers.find((l) => l.id === el.dataset.layer) : null;
    if (L && (e.shiftKey || e.metaKey || e.ctrlKey)) { toggleSel(L.id); setTab('layer'); return; }
    if (L && multi && selSet.includes(L.id)) {
      drag.current = { kind: 'group', g: startGroup(layout, selSet, 'gmove'), p, start: layout };
      cap(); setMeasureOn(true); e.preventDefault(); return;
    }
    setSelId(L?.id ?? null);
    if (L) setTab('layer');
    if (!L || L.locked) return;
    const d = startBodyDrag(L, media, frameMode, e.altKey);
    if (d.mode === 'pan' && d.mw <= L.w + 1 && d.mh <= L.h + 1) flash('No room to slide — raise Zoom a little first');
    const paired = partnersOf(L, layout, media).some((P) => P.x === L.x && P.y === L.y && P.w === L.w && P.h === L.h);
    drag.current = { kind: 'one', d, p, start: layout, paired };
    cap(); setMeasureOn(d.mode === 'move'); e.preventDefault();
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || !canvas.current) return;
    if (g.kind === 'guide') { moveGuide(e); return; }
    const p = canvas.current.toStage(e.clientX, e.clientY);
    const opt = { scale: canvas.current.scale, snap, shift: e.shiftKey };
    if (g.kind === 'group') {
      const r = applyGroup(g.g, g.start, p.x - g.p.x, p.y - g.p.y, opt);
      setGuide({ gx: r.gx, gy: r.gy }); setLayout(r.layout); return;
    }
    const r = applyDrag(g.d, g.start, media, p.x - g.p.x, p.y - g.p.y, opt);
    if (!r) return;
    if (r.paired && !g.paired) flash(`Snapped to its ${media[r.layer.media]?.kind === 'cutout' ? 'photo' : 'cutout'} — lined up exactly`);
    g.paired = r.paired;
    setGuide({ gx: r.gx, gy: r.gy });
    setLayout({ ...g.start, layers: g.start.layers.map((l) => (l.id === r.layer.id ? r.layer : l)) });
  };
  const onUp = () => {
    const g = drag.current;
    if (!g) return;
    drag.current = null;
    setGuide({ gx: null, gy: null }); setMeasureOn(false);
    if (g.kind === 'guide' && g.del) {
      setLayout((cur) => {
        if (!cur) return cur;
        const G = guidesOf(cur), arr = G[g.axis].filter((_, i) => i !== g.i);
        const n = setGuides(cur, { [g.axis]: arr }); commit(n); return n;
      });
      flash('Guide deleted');
      return;
    }
    setLayout((cur) => { if (cur) commit(cur); return cur; });
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const typing = (el: Element | null) => !!el && (['TEXTAREA', 'SELECT'].includes(el.tagName) ||
      (el.tagName === 'INPUT' && !['checkbox', 'button', 'range'].includes((el as HTMLInputElement).type)));
    const onKey = (e: KeyboardEvent) => {
      if (typing(document.activeElement)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.code === 'Semicolon' && layout) {
        e.preventDefault(); const G = guidesOf(layout);
        if (e.altKey) updateGuides({ lock: !G.lock }); else updateGuides({ show: !G.show });
        return;
      }
      if (!selId && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        setView((v) => (v === 'all' ? 0 : Math.max(0, Math.min(4, v + (e.key === 'ArrowRight' ? 1 : -1)))));
        return;
      }
      if (!selId || !layout) return;
      if (e.key === 'Escape') { setSelId(null); return; }
      const st = e.shiftKey ? 10 : 1;
      const mv = ({ ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] } as Record<string, number[]>)[e.key];
      if (mv) {
        e.preventDefault();
        setLayout((cur) => cur && ({ ...cur, layers: cur.layers.map((l) => (selSet.includes(l.id) ? { ...l, x: l.x + mv[0], y: l.y + mv[1] } : l)) }));
        window.clearTimeout(nudgeTimer.current);
        nudgeTimer.current = window.setTimeout(() => setLayout((cur) => { if (cur) commit(cur); return cur; }), 300);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); runAct('del'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, selSet, layout, undo, redo, runAct, commit, updateGuides, setSelId]);

  // ---------- overlay: selection, handles, snap lines, measurements ----------
  const pushMargins = (out: React.ReactNode[], b: Box, px: number) => {
    const m = margins(b);
    const seg = (k: string, x: number, y: number, len: number, dir: 'h' | 'v', eq: boolean) => {
      if (len < 2) return;
      const col = eq ? '#2ee59d' : '#29c5ff';
      out.push(
        <div key={k} className="pointer-events-none absolute" style={dir === 'h'
          ? { left: x, top: y - px, width: len, height: 2 * px, background: col }
          : { left: x - px, top: y, width: 2 * px, height: len, background: col }}>
          <span className="absolute whitespace-nowrap font-bold text-black" style={{
            background: col, fontSize: 12 * px, padding: `0 ${4 * px}px`,
            ...(dir === 'h' ? { left: '50%', top: -18 * px, transform: 'translateX(-50%)' } : { left: 6 * px, top: '50%', transform: 'translateY(-50%)' }),
          }}>{Math.round(len)}{eq ? ' =' : ''}</span>
        </div>,
      );
    };
    if (m.inSlide) { seg('ml', m.s0, b.y + b.h / 2, m.gl, 'h', m.hEq); seg('mr', b.x + b.w, b.y + b.h / 2, m.gr, 'h', m.hEq); }
    if (m.gt >= 0 && m.gb >= 0) { seg('mt', b.x + b.w / 2, 0, m.gt, 'v', m.vEq); seg('mb', b.x + b.w / 2, b.y + b.h, m.gb, 'v', m.vEq); }
  };
  const overlay = (scale: number) => {
    const px = 1 / scale;
    const out: React.ReactNode[] = [];
    const G = layout ? guidesOf(layout) : null;
    if (G?.show) {
      const hit = 9 * px, line = `linear-gradient(var(--d), transparent calc(50% - ${px / 2}px), #ff3cac calc(50% - ${px / 2}px), #ff3cac calc(50% + ${px / 2}px), transparent calc(50% + ${px / 2}px))`;
      G.v.forEach((x, i) => out.push(<div key={`gv${i}`} data-guide={`v:${i}`} title="Drag to move · drag off the canvas to delete"
        className={`absolute top-0 ${G.lock ? 'pointer-events-none' : 'cursor-ew-resize'}`} style={{ left: x - hit / 2, width: hit, height: H, background: line.replace('var(--d)', '90deg') }} />));
      G.h.forEach((y, i) => out.push(<div key={`gh${i}`} data-guide={`h:${i}`} title="Drag to move · drag off the canvas to delete"
        className={`absolute left-0 ${G.lock ? 'pointer-events-none' : 'cursor-ns-resize'}`} style={{ top: y - hit / 2, height: hit, width: W, background: line.replace('var(--d)', '180deg') }} />));
    }
    if (guide.gx != null) out.push(<div key="sx" className="pointer-events-none absolute top-0" style={{ left: guide.gx - px, width: 2 * px, height: H, background: '#ffd400' }} />);
    if (guide.gy != null) out.push(<div key="sy" className="pointer-events-none absolute left-0" style={{ top: guide.gy - px, height: 2 * px, width: W, background: '#ffd400' }} />);
    if (multi && layout) {
      const ls = layout.layers.filter((l) => selSet.includes(l.id));
      ls.forEach((o) => { const b = measure(o); out.push(<div key={`ms${o.id}`} className="pointer-events-none absolute" style={{ left: b.x, top: b.y, width: b.w, height: b.h, outline: `${1.5 * px}px dashed #29c5ff` }} />); });
      const bs = ls.map(measure);
      const x1 = Math.min(...bs.map((q) => q.x)), y1 = Math.min(...bs.map((q) => q.y));
      const b = { x: x1, y: y1, w: Math.max(...bs.map((q) => q.x + q.w)) - x1, h: Math.max(...bs.map((q) => q.y + q.h)) - y1 };
      const hs = 12 * px;
      out.push(
        <div key="gsel" className="pointer-events-none absolute" style={{ left: b.x, top: b.y, width: b.w, height: b.h, outline: `${2 * px}px solid #29c5ff` }}>
          {['nw', 'ne', 'sw', 'se'].map((c) => (
            <div key={c} data-corner={c} className="pointer-events-auto absolute rounded-full bg-white"
              style={{ width: hs, height: hs, border: `${2 * px}px solid #29c5ff`, left: (c[1] === 'w' ? 0 : b.w) - hs / 2, top: (c[0] === 'n' ? 0 : b.h) - hs / 2, cursor: `${c}-resize` }} />
          ))}
        </div>,
      );
      if (measureOn) pushMargins(out, b, px);
    } else if (selected && !selected.hidden && selected.type === 'text') {
      const b = measure(selected);
      out.push(<div key="sel" className="pointer-events-none absolute" style={{ left: b.x, top: b.y, width: b.w, height: b.h, outline: `${2 * px}px solid #29c5ff` }} />);
    } else if (selected && !selected.hidden) {
      const b = boxOf(selected);
      const hs = 12 * px, long = 30 * px, thin = 9 * px;
      const isLogo = media[selected.media]?.kind === 'logo';
      out.push(
        <div key="sel" className="pointer-events-none absolute" style={{ left: b.x, top: b.y, width: b.w, height: b.h, outline: `${2 * px}px solid #29c5ff` }}>
          {!selected.locked && ['nw', 'ne', 'sw', 'se'].map((c) => (
            <div key={c} data-corner={c} className="pointer-events-auto absolute rounded-full bg-white"
              style={{ width: hs, height: hs, border: `${2 * px}px solid #29c5ff`, left: (c[1] === 'w' ? 0 : b.w) - hs / 2, top: (c[0] === 'n' ? 0 : b.h) - hs / 2, cursor: `${c}-resize` }} />
          ))}
          {!selected.locked && !isLogo && (['n', 's', 'e', 'w'] as const).map((ed) => (
            <div key={ed} data-edge={ed} title="Drag to crop this edge" className="pointer-events-auto absolute rounded-full bg-accent"
              style={ed === 'n' || ed === 's'
                ? { width: long, height: thin, left: b.w / 2 - long / 2, top: (ed === 'n' ? 0 : b.h) - thin / 2, cursor: 'ns-resize' }
                : { width: thin, height: long, top: b.h / 2 - long / 2, left: (ed === 'w' ? 0 : b.w) - thin / 2, cursor: 'ew-resize' }} />
          ))}
        </div>,
      );
      if (measureOn) pushMargins(out, b, px);
    }
    return out;
  };

  // ---------- render ----------
  const visible = layout?.layers.filter((l) => !l.hidden).length ?? 0;
  const h = hist.current;
  const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
  const saveText = { saved: save.at ? `Saved ${fmt(save.at)}` : 'Saved', unsaved: 'Unsaved changes', saving: 'Saving…', error: 'Not saved — retrying on next change', conflict: 'Saved elsewhere — reload' }[save.state];
  const G = layout ? guidesOf(layout) : null;
  const step = (d: number) => setView((v) => (v === 'all' ? (d > 0 ? 0 : 4) : Math.max(0, Math.min(4, v + d))));

  // pill-group building blocks (one font everywhere: Arimo)
  const group = 'flex items-center gap-0.5 rounded-full border border-hairline-soft bg-surface-card p-[3px]';
  const seg = (on: boolean) => `grid h-[30px] min-w-[32px] place-items-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[.1em] whitespace-nowrap disabled:opacity-35 ${on ? 'bg-ink-1 text-ground' : 'text-ink-3 hover:text-ink-1'}`;
  const pill = (on = false) => `grid h-9 place-items-center rounded-full border px-4 text-[11px] font-bold uppercase tracking-[.12em] whitespace-nowrap disabled:opacity-40 ${on ? 'border-ink-1 bg-ink-1 text-ground' : 'border-hairline text-ink-1 hover:border-ink-3'}`;
  const arrow = 'grid h-10 w-10 place-items-center rounded-full border border-hairline-soft text-[18px] text-ink-2 hover:text-ink-1';
  const fmtT = (t: number) => `${t.toFixed(1)}s`;

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-6 font-sans sm:px-6 lg:px-8">
      {/* header */}
      <header className="flex flex-col gap-2">
        <Link href="/dashboard/carousels" className="text-[11px] font-bold uppercase tracking-[.16em] text-ink-3 hover:text-ink-1">
          {athlete.campaign ?? "Raising Cane's Basketball 2027"} · IG feed carousel
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => goTo(prevSlug)} aria-label="Previous athlete" className={arrow}>‹</button>
          <AthleteSwitcher current={athlete} athletes={athletes} onGo={goTo} />
          <button type="button" onClick={() => goTo(nextSlug)} aria-label="Next athlete" className={arrow}>›</button>
          <span className="text-[14px] text-ink-3">{position} of {total}</span>
          <span role="status" className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] ${
            save.state === 'error' || save.state === 'conflict' ? 'border-status-bad/50 text-status-bad-ink' : 'border-hairline-soft text-ink-3'}`}>
            {saveText}
          </span>
          {save.state === 'conflict' && <button type="button" className={pill()} onClick={load}>Reload</button>}
        </div>
      </header>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={group}>
          <button type="button" className={seg(false)} onClick={undo} disabled={h.pos <= 0} title="Undo (⌘Z)" aria-label="Undo">↶</button>
          <button type="button" className={seg(false)} onClick={redo} disabled={h.pos >= h.list.length - 1} title="Redo (⇧⌘Z)" aria-label="Redo">↷</button>
        </div>
        <div className={group} role="group" aria-label="View">
          <button type="button" className={seg(view === 'all')} onClick={() => setView('all')}>Full</button>
          {[0, 1, 2, 3, 4].map((k) => (
            <button key={k} type="button" className={seg(view === k)} onClick={() => setView(k)} aria-label={`Slide ${k + 1}`}>{k + 1}</button>
          ))}
        </div>
        <div className={group} role="group" aria-label="Display">
          <button type="button" aria-pressed={snap} className={seg(snap)} onClick={() => setSnap((v) => !v)}>Snap</button>
          <button type="button" aria-pressed={seams} className={seg(seams)} onClick={() => setSeams((v) => !v)}>Edges</button>
          <button type="button" aria-pressed={frameMode} className={seg(frameMode)} onClick={() => setFrameMode((f) => !f)} title="Drag slides the picture inside its frame">Reframe</button>
          {G && <button type="button" aria-pressed={G.show} className={seg(G.show)} onClick={() => updateGuides({ show: !G.show })} title="Show guides (⌘;)">Guides{G.v.length + G.h.length ? ` ${G.v.length + G.h.length}` : ''}</button>}
          {G && <button type="button" aria-pressed={G.lock} className={seg(G.lock)} onClick={() => updateGuides({ lock: !G.lock })} title="Lock guides (⌥⌘;)">{G.lock ? 'Locked' : 'Lock'}</button>}
          {G && G.v.length + G.h.length > 0 && !G.lock && <button type="button" className={seg(false)} onClick={() => updateGuides({ v: [], h: [] })}>Clear</button>}
        </div>
        <div className="flex-1" />
        <button type="button" className={pill()} onClick={addText} disabled={!layout}>+ Text</button>
        <button type="button" onClick={() => { setSwapId(null); setDrawer((d) => !d || swapId !== null); }} aria-expanded={drawer && !swapId}
          className={`grid h-9 place-items-center rounded-full px-4 text-[11px] font-bold uppercase tracking-[.12em] text-white ${drawer ? 'bg-accent/70' : 'bg-accent'}`}>
          + Add from Frame.io
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* canvas column */}
        <section aria-label="Carousel canvas" className="flex min-w-0 flex-col gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-hairline-soft bg-surface-card p-2"
            onWheel={(e) => { if (view !== 'all' && Math.abs(e.deltaX) > 40 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) step(e.deltaX > 0 ? 1 : -1); }}>
            {error && <p className="p-6 text-[14px] text-status-bad-ink">{error}</p>}
            {!error && !loaded && <div className="aspect-[4/1] animate-pulse rounded-lg bg-surface-raised" />}
            {loaded && !layout && <p className="p-6 text-[14px] text-ink-3">{firstName} doesn&apos;t have a saved carousel yet.</p>}
            {layout && (
              <div className="grid grid-cols-[14px_minmax(0,1fr)] grid-rows-[14px_auto]">
                <div />
                <div title="Drag down from here for a horizontal guide" className="cursor-s-resize touch-none rounded-t bg-surface-raised"
                  onPointerDown={(e) => startGuide('h', e)} onPointerMove={moveGuide} onPointerUp={onUp} onPointerCancel={onUp} />
                <div title="Drag right from here for a vertical guide" className="cursor-e-resize touch-none rounded-l bg-surface-raised"
                  onPointerDown={(e) => startGuide('v', e)} onPointerMove={moveGuide} onPointerUp={onUp} onPointerCancel={onUp} />
                <CarouselCanvas ref={canvas} layout={layout} media={media} playing={playing} showSeams={seams}
                  view={view} maxHeight={view === 'all' ? undefined : maxH} seek={seek} onTick={setTime}
                  overlay={overlay} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
              </div>
            )}
            {layout && view !== 'all' && (
              <>
                <button type="button" aria-label="Previous slide" onClick={() => step(-1)} disabled={view === 0}
                  className="absolute left-6 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-ground/70 text-[20px] text-ink-1 disabled:opacity-0">‹</button>
                <button type="button" aria-label="Next slide" onClick={() => step(1)} disabled={view === 4}
                  className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-ground/70 text-[20px] text-ink-1 disabled:opacity-0">›</button>
              </>
            )}
          </div>

          {/* playback */}
          <div className="flex items-center gap-2">
            <button type="button" className={pill(false)} onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
            <button type="button" className={pill(false)} onClick={() => setSeek({ t: 0, n: Date.now() })} aria-label="Restart" title="Back to the start">⟲</button>
            <input type="range" min={0} max={6} step={0.01} value={time} aria-label="Playback position"
              onChange={(e) => { setPlaying(false); setSeek({ t: +e.target.value, n: Date.now() }); }}
              className="flex-1 accent-[#FAF8F5]" />
            <span className="w-[86px] text-right text-[12px] tabular-nums text-ink-3">{fmtT(time)} / 6.0s</span>
          </div>

          {/* clip timeline: full width under the carousel while a video layer is selected */}
          {selected && selected.type !== 'text' && (() => {
            const m = media[selected.media];
            if (!m || m.kind !== 'video' || !m.hasFull || !m.dur) return null;
            return (
              <section aria-label="Clip timeline" className="flex flex-col gap-2 rounded-2xl border border-hairline-soft bg-surface-card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-[15px] font-bold text-ink-1">Clip section</h2>
                  <span className="min-w-0 truncate text-[13px] text-ink-3">{selected.name ?? m.label}</span>
                  <button type="button" className={`${pill(false)} ml-auto`} onClick={() => patchLayer(selected.id, { vin: undefined, vlen: undefined }, true)}>Reset</button>
                </div>
                <ClipTimeline dur={m.dur} vin={vinOf(selected, m)} vlen={vlenOf(selected, m)} strip={m.strip} thumb={m.thumb} scrub={m.scrub} look={refineLook(lookFor(selected, m), (selected.grade ?? 'auto') === 'auto', m.thumb ? selScene[m.thumb] : false)}
                  onChange={(s, c) => patchLayer(selected.id, s, c)} />
              </section>
            );
          })()}

          {/* slide navigator */}
          {layout && (
            <div className="relative w-full max-w-[520px] overflow-hidden rounded-xl">
              <CarouselCanvas layout={layout} media={media} playing={false} still showSeams={false} />
              <div className="absolute inset-0 grid grid-cols-5">
                {[0, 1, 2, 3, 4].map((k) => (
                  <button key={k} type="button" onClick={() => setView(k)} aria-label={`View slide ${k + 1}`}
                    className={`relative border-2 ${view === k ? 'border-ink-1' : 'border-transparent bg-ground/35 hover:bg-transparent'}`}>
                    <span className="absolute bottom-1 left-1.5 text-[11px] font-bold text-white [text-shadow:0_1px_3px_#000]">{k + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {drawer && (
            <ClipPicker slug={athlete.slug} firstName={firstName} busyId={adding}
              replacing={swapId ? layout?.layers.find((l) => l.id === swapId)?.name ?? 'this layer' : null}
              onPick={async (c) => { if (swapId) await swapClip(swapId, c); else await addClip(c); setDrawer(false); setSwapId(null); }}
              onClose={() => { setDrawer(false); setSwapId(null); }} />
          )}

          {layout && (
            <GuidesPanel layout={layout} guides={guidesOf(layout)} view={view} flash={flash}
              onChange={(patch) => updateGuides(patch)} />
          )}

          <p className="text-[12px] leading-relaxed text-ink-4">
            Drag to move · ⇧-click to select several · corners resize (⇧ keeps shape) · orange tabs crop · drag a background, or ⌥-drag a card, to slide the picture · drag from the rulers for guides (off the canvas deletes) · arrows nudge (⇧ ×10), or step slides when nothing is selected · ⌫ deletes · ⌘Z undo
          </p>
          {toast && <p role="status" className="text-[13px] text-ink-2">{toast}</p>}
        </section>

        {/* right column: settings, then layers — both always visible */}
        <section aria-label="Editor panels" className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div className="max-h-[56vh] overflow-y-auto rounded-2xl border border-hairline-soft bg-surface-card p-4">
            <h2 className="mb-3 text-[16px] font-bold text-ink-1">{multi ? 'Selected' : selected ? 'Selected' : 'Nothing selected'}</h2>
            {multi && layout ? (
              <MultiProps layers={layout.layers.filter((l) => selSet.includes(l.id))} media={media}
                onChange={(p, c) => patchMany(selSet, p, c)} onClear={() => setSelId(selId)} onDelete={() => runAct('del')} />
            ) : (
              <LayerProps layer={selected} media={selected ? media[selected.media] : undefined}
                onChange={(p, c) => selected && patchLayer(selected.id, p, c)} onAct={(a) => runAct(a)}
                frameMode={frameMode} setFrameMode={setFrameMode}
                canCutout={!!(selected && media[selected.media]?.cutout && media[media[selected.media]!.cutout!])}
                hasPair={!!(selected && layout && pairOf(layout, selected.id).length > 1)}
                onCutout={cutout} onPair={() => selected && layout && selectMany(pairOf(layout, selected.id))}
                onSwap={() => { if (selected) { setSwapId(selected.id); setDrawer(true); } }} />
            )}
          </div>
          {layout && (
            <div className="min-h-[220px] flex-1 overflow-y-auto rounded-2xl border border-hairline-soft bg-surface-card p-3">
              <div className="mb-1 flex items-baseline justify-between px-1">
                <h2 className="text-[16px] font-bold text-ink-1">Layers</h2>
                <span className="text-[12px] text-ink-4">{visible} showing · {layout.layers.length} total</span>
              </div>
              <p className="mb-2 px-1 text-[11px] text-ink-4">Front at the top · ⇧-click for several</p>
              <LayersList layers={layout.layers} media={media} selectedId={selId} selectedIds={selSet}
                onSelect={(id, add) => {
                  if (add) toggleSel(id); else setSelId(id);
                  const L = layout.layers.find((l) => l.id === id);
                  if (L && view !== 'all' && L.type !== 'text') setView(Math.max(0, Math.min(4, Math.floor((L.x + L.w / 2) / SLIDE))));
                }}
                onToggle={(id, k) => { const L = layout.layers.find((l) => l.id === id); if (L) patchLayer(id, { [k]: !L[k] }, true); }}
                onMove={(id, dir) => runAct(dir, id)}
                onReorder={(id, to) => { if (!layout) return; const n = moveLayerTo(layout, id, to); setLayout(n); commit(n); }} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
