'use client';

// The carousel editor (batch A of the editing tools): select, move, resize,
// crop edges, reframe, snapping with live measurements, the layer panel, the
// layers list, undo/redo, keyboard nudges — and autosave, where every save is
// also kept as a version. Behaviour follows the old artifact (lib/carousel/edit).

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ClipPicker from './ClipPicker';
import CarouselCanvas, { type CanvasHandle, type CanvasMedia } from './CarouselCanvas';
import LayerProps, { MultiProps } from './LayerProps';
import LayersList from './LayersList';
import { H, SLIDE, W, insetOf, type Layer, type Layout } from '@/lib/carousel/layout';
import { act, applyDrag, applyGroup, boxOf, guidesOf, makeCutout, margins, newCard, newText, pairOf, partnersOf, removeLayers, setGuides, snapGuide, startBodyDrag, startGroup, type Action, type Box, type Drag, type GroupDrag } from '@/lib/carousel/edit';
import type { PickerClip } from './ClipPicker';

type Athlete = { slug: string; name: string; campaign: string | null };
type Loaded = { layout: Layout | null; media: Record<string, CanvasMedia>; savedAt?: string | null; updatedAt?: string | null };
type SaveState = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';
type Tab = 'layer' | 'layers' | 'add';

export default function CarouselEditor({
  athlete, position, total, prevSlug, nextSlug,
}: {
  athlete: Athlete; position: number; total: number; prevSlug: string; nextSlug: string;
}) {
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
  const [tab, setTab] = useState<Tab>('layer');
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
    saveTimer.current = window.setTimeout(() => doSave(next), 1200);
  }, [doSave]);

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
    const slide = sel ? Math.max(0, Math.min(4, Math.floor((sel.x + (sel.type === 'text' ? 0 : sel.w / 2)) / SLIDE))) : 2;
    const r = newText(layout, slide);
    setLayout(r.layout); setSelId(r.id); setTab('layer'); commit(r.layout);
  }, [layout, selId, commit, setSelId]);
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
  const addClip = useCallback(async (c: PickerClip) => {
    if (!layout || adding) return;
    setAdding(c.id);
    flash(`Adding ${c.name}…`);
    try {
      const res = await fetch(`/api/carousels/${athlete.slug}/media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fioId: c.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setLoaded((cur) => (cur ? { ...cur, media: { ...cur.media, [body.key]: body.media } } : cur));
      const sel = layout.layers.find((l) => l.id === selId);
      const slide = sel ? Math.max(0, Math.min(4, Math.floor((sel.x + sel.w / 2) / SLIDE))) : 2;
      const r = newCard(layout, body.key, body.media, c.name.replace(/\.[^.]+$/, ''), slide);
      setLayout(r.layout); setSelId(r.id); setTab('layer'); commit(r.layout);
      flash(c.kind === 'video' ? `Added to slide ${slide + 1} — pick the moment in Clip section` : `Added to slide ${slide + 1}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not add that clip');
    } finally {
      setAdding(null);
    }
  }, [layout, selId, athlete.slug, adding, commit, flash]);

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
  const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
  const saveText = { saved: save.at ? `Saved ${fmt(save.at)}` : 'Saved', unsaved: 'Unsaved changes', saving: 'Saving…', error: 'Not saved — retrying on next change', conflict: 'Saved elsewhere — reload' }[save.state];
  const arrow = 'grid h-10 w-10 place-items-center rounded-full border border-hairline-soft bg-surface-card text-[18px] text-ink-2 hover:text-ink-1';
  const chip = (on: boolean) => `min-h-[36px] rounded-full border px-4 text-[12px] font-bold uppercase tracking-[.12em] disabled:opacity-40 ${on ? 'border-ink-1 bg-ink-1 text-ground' : 'border-hairline-soft bg-surface-card text-ink-3 hover:text-ink-1'}`;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Link href="/dashboard/carousels" className="text-[11px] font-bold uppercase tracking-[.16em] text-ink-3 hover:text-ink-1">
          {athlete.campaign ?? "Raising Cane's Basketball 2027"} · IG feed carousel
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/carousels/${prevSlug}`} aria-label="Previous athlete" className={arrow}>‹</Link>
          <h1 className="font-display text-[44px] leading-none sm:text-[56px]">{athlete.name}</h1>
          <Link href={`/dashboard/carousels/${nextSlug}`} aria-label="Next athlete" className={arrow}>›</Link>
          <span className="text-[14px] text-ink-3">{position} of {total}</span>
          <span role="status" className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] ${
            save.state === 'error' || save.state === 'conflict' ? 'border-status-bad/50 text-status-bad-ink' : 'border-hairline-soft text-ink-3'}`}>
            {saveText}
          </span>
          {save.state === 'conflict' && <button type="button" className={chip(false)} onClick={load}>Reload</button>}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Carousel canvas" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={chip(false)} onClick={undo} disabled={h.pos <= 0} title="Undo (⌘Z)">↶ Undo</button>
            <button type="button" className={chip(false)} onClick={redo} disabled={h.pos >= h.list.length - 1} title="Redo (⇧⌘Z)">↷ Redo</button>
            <span className="mx-1 h-6 w-px bg-hairline" />
            <button type="button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)} className={chip(playing)}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
            <button type="button" aria-pressed={snap} onClick={() => setSnap((s) => !s)} className={chip(snap)}>Snap</button>
            <button type="button" aria-pressed={seams} onClick={() => setSeams((s) => !s)} className={chip(seams)}>Slide edges</button>
            <button type="button" aria-pressed={frameMode} onClick={() => setFrameMode((f) => !f)} className={chip(frameMode)} title="Drag slides the picture inside its frame">Reframe</button>
            {layout && (() => { const G = guidesOf(layout); return (<>
              <button type="button" aria-pressed={G.show} onClick={() => updateGuides({ show: !G.show })} className={chip(G.show)} title="Show guides (⌘;)">Guides{G.v.length + G.h.length ? ` ${G.v.length + G.h.length}` : ''}</button>
              <button type="button" aria-pressed={G.lock} onClick={() => updateGuides({ lock: !G.lock })} className={chip(G.lock)} title="Lock guides (⌥⌘;)">{G.lock ? '🔒 Locked' : 'Lock guides'}</button>
              {G.v.length + G.h.length > 0 && !G.lock && <button type="button" onClick={() => updateGuides({ v: [], h: [] })} className={chip(false)}>Clear guides</button>}
            </>); })()}
            <button type="button" onClick={addText} className={chip(false)} disabled={!layout}>+ Text</button>
            {layout && <span className="ml-1 text-[13px] text-ink-4">{visible} layers</span>}
          </div>

          <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface-card p-3">
            {error && <p className="p-6 text-[14px] text-status-bad-ink">{error}</p>}
            {!error && !loaded && <div className="aspect-[4/1] animate-pulse rounded-lg bg-surface-raised" />}
            {loaded && !layout && <p className="p-6 text-[14px] text-ink-3">{firstName} doesn&apos;t have a saved carousel yet.</p>}
            {layout && (
              <div className="grid grid-cols-[14px_minmax(0,1fr)] grid-rows-[14px_auto]">
                <div />
                <div title="Drag down from here for a horizontal guide" className="cursor-s-resize touch-none bg-surface-raised [background-image:repeating-linear-gradient(90deg,transparent_0,transparent_19.8%,rgb(var(--ink-rgb)/.35)_19.8%,rgb(var(--ink-rgb)/.35)_20%)]"
                  onPointerDown={(e) => startGuide('h', e)} onPointerMove={moveGuide} onPointerUp={onUp} onPointerCancel={onUp} />
                <div title="Drag right from here for a vertical guide" className="cursor-e-resize touch-none bg-surface-raised"
                  onPointerDown={(e) => startGuide('v', e)} onPointerMove={moveGuide} onPointerUp={onUp} onPointerCancel={onUp} />
                <CarouselCanvas ref={canvas} layout={layout} media={media} playing={playing} showSeams={seams}
                  overlay={overlay} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
              </div>
            )}
          </div>
          <p className="text-[13px] text-ink-4">
            Drag to move · ⇧-click to select several · corners resize (⇧ keeps shape) · orange tabs crop · drag a background, or ⌥-drag a card, to slide the picture · drag from the rulers for guides (off the canvas deletes) · arrows nudge (⇧ ×10) · ⌫ deletes · ⌘Z undo
          </p>
          {toast && <p role="status" className="text-[13px] text-ink-2">{toast}</p>}
        </section>

        <section aria-label="Editor panels" className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]">
          <div className="flex gap-1.5" role="tablist">
            {(['layer', 'layers', 'add'] as Tab[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={chip(tab === k)}>
                {{ layer: 'Selected', layers: `Layers ${layout?.layers.length ?? ''}`, add: 'Add' }[k]}
              </button>
            ))}
          </div>
          <div className={`${tab === 'add' ? 'hidden' : ''} min-h-0 flex-1 overflow-y-auto rounded-2xl border border-hairline-soft bg-surface-card p-5`}>
            {tab === 'layer' && multi && layout && (
              <MultiProps layers={layout.layers.filter((l) => selSet.includes(l.id))} media={media}
                onChange={(p, c) => patchMany(selSet, p, c)} onClear={() => setSelId(selId)} onDelete={() => runAct('del')} />
            )}
            {tab === 'layer' && !multi && (
              <LayerProps layer={selected} media={selected ? media[selected.media] : undefined}
                onChange={(p, c) => selected && patchLayer(selected.id, p, c)} onAct={(a) => runAct(a)}
                frameMode={frameMode} setFrameMode={setFrameMode}
                canCutout={!!(selected && media[selected.media]?.cutout && media[media[selected.media]!.cutout!])}
                hasPair={!!(selected && layout && pairOf(layout, selected.id).length > 1)}
                onCutout={cutout} onPair={() => selected && layout && selectMany(pairOf(layout, selected.id))} />
            )}
            {tab === 'layers' && layout && (
              <LayersList layers={layout.layers} media={media} selectedId={selId}
                onSelect={(id, add) => (add ? toggleSel(id) : setSelId(id))} selectedIds={selSet}
                onToggle={(id, k) => { const L = layout.layers.find((l) => l.id === id); if (L) patchLayer(id, { [k]: !L[k] }, true); }}
                onMove={(id, dir) => runAct(dir, id)} />
            )}
          </div>
          <div className={tab === 'add' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <ClipPicker slug={athlete.slug} firstName={firstName}
              onPick={addClip} />
          </div>
        </section>
      </div>
    </div>
  );
}
