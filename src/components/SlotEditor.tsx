"use client";

// ============================================================
// <SlotEditor> — the single, reusable "slot" remote.  (v2, Phase 3)
//
// Reads/writes the `slot_assignments` table for one slot. Add media
// via the existing CampaignMediaPicker, reorder, set focal point +
// zoom per image, optionally attach one-line text (pull-quote slots),
// and — new in v2 — optionally attach a per-photo brand-logo overlay
// (used by the Services carousels).
//
// v2 change vs Phase 2: added the `acceptsLogo` prop + a per-row brand
// logo picker that writes slot_assignments.logo_url. Everything else
// is unchanged. Safe to drop in over the Phase 2 file.
//
// NOTE: `slot_assignments` (and its file_url / logo_url columns) were
// added by Cowork in Phases 1 & 3. Regenerate Supabase types so TS
// knows them; the `db` cast below keeps the build green either way.
// ============================================================

import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import CampaignMediaPicker, { type MediaPickerResult } from "@/components/CampaignMediaPicker";
import VerticalHeroChoiceModal from "@/components/VerticalHeroChoiceModal";
import { parseResolution, isVertical, probeVideoDimensions } from "@/lib/hero-render";
import { isVideoUrl } from "@/lib/is-video-url";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Surface Supabase write failures instead of swallowing them. Returns true
// when there was an error (caller should bail and skip the success/onSaved
// path), false when the write succeeded.
function reportSlotError(where: string, error: unknown): boolean {
  if (!error) return false;
  console.error(`[SlotEditor] ${where} failed:`, error);
  const e = error as { code?: string; message?: string };
  alert(`Save failed (${where}): ${e.code ?? "?"} — ${e.message ?? String(error)}`);
  return true;
}

const C = {
  orange: "#D73F09",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.13)",
  surface2: "#161616",
  text: "#fff",
  text2: "rgba(255,255,255,0.6)",
  text3: "rgba(255,255,255,0.35)",
};

export interface SlotEditorProps {
  slotKey: string;
  scopeId?: string;
  title?: string;
  maxItems?: number;
  acceptsText?: boolean;
  /** v2: show a per-photo brand-logo picker (Services carousels) */
  acceptsLogo?: boolean;
  /** Hero slots only: picking a vertical video opens the Keep-vertical /
   *  Make-widescreen modal before inserting the row. Defaults to false so
   *  services / pull-quote / gallery slots are unaffected. */
  treatAsHero?: boolean;
  /** When set, the media picker opens locked to this brand's campaigns
   *  (skips the brand-select step). Used by the brand page editor. */
  brandSlug?: string;
  brandName?: string;
  onSaved?: () => void;
}

interface SlotRow {
  id: string;
  slot_key: string;
  scope_id: string | null;
  media_id: string | null;
  recap_id: string | null;
  file_url: string | null;
  logo_url: string | null;
  position: number;
  focal_x: number;
  focal_y: number;
  scale: number;
  text_value: string | null;
  enabled: boolean;
}

interface BrandLogo {
  id: string;
  name: string;
  logo_primary_url: string | null;
}

const FOCAL_PRESETS: { label: string; x: number; y: number }[] = [
  { label: "TL", x: 0, y: 0 },
  { label: "TC", x: 0.5, y: 0 },
  { label: "TR", x: 1, y: 0 },
  { label: "CC", x: 0.5, y: 0.5 },
  { label: "BC", x: 0.5, y: 1 },
];

export default function SlotEditor({
  slotKey,
  scopeId,
  title,
  maxItems,
  acceptsText,
  acceptsLogo,
  treatAsHero,
  brandSlug,
  brandName,
  onSaved,
}: SlotEditorProps) {
  const supabase = createBrowserSupabase();
  const db = supabase as any; // keeps build green if types aren't regenerated yet

  const [rows, setRows] = useState<SlotRow[]>([]);
  const [brandId, setBrandId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [heroChoice, setHeroChoice] = useState<
    | { sourceUrl: string; mediaId?: string; clipLabel?: string }
    | null
  >(null);
  const [brandLogos, setBrandLogos] = useState<BrandLogo[]>([]);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const textCreating = useRef(false);

  // Drag-to-reorder. PointerSensor's 5px activation distance keeps a plain
  // click on the grip from registering as a drag; KeyboardSensor enables
  // keyboard reordering. Same setup as the campaign order lists.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    let q = db.from("slot_assignments").select("*").eq("slot_key", slotKey);
    q = scopeId ? q.eq("scope_id", scopeId) : q.is("scope_id", null);
    const { data } = await q.order("position", { ascending: true });
    setRows((data as SlotRow[]) || []);
    setLoading(false);
  }, [slotKey, scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // Resolve the Supabase brand id from slug (fallback to name) so the picker
  // can open locked to this brand. Mirrors RecapSlotEditor's lookup. When
  // brandSlug/brandName aren't provided, brandId stays undefined and the
  // picker behaves exactly as today.
  useEffect(() => {
    if (!brandSlug && !brandName) {
      setBrandId(undefined);
      return;
    }
    (async () => {
      let resolved: string | null = null;
      if (brandSlug) {
        const { data: b1 } = await db.from("brands").select("id").eq("slug", brandSlug).maybeSingle();
        resolved = b1?.id ?? null;
      }
      if (!resolved && brandName) {
        const { data: b2 } = await db.from("brands").select("id").ilike("name", brandName).maybeSingle();
        resolved = b2?.id ?? null;
      }
      setBrandId(resolved ?? undefined);
    })();
  }, [brandSlug, brandName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brand logos for the per-photo overlay picker (only when needed)
  useEffect(() => {
    if (!acceptsLogo) return;
    supabase
      .from("brands")
      .select("id,name,logo_primary_url")
      .order("name")
      .then(({ data }: { data: BrandLogo[] | null }) => setBrandLogos(data || []));
  }, [acceptsLogo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addMedia(payload: {
    file_url: string;
    hero_source?: "original" | "rendered";
    hero_render_look?: "blur" | "mirror";
    hero_rendered_url?: string;
  }) {
    const nextPos = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
    const { error } = await db.from("slot_assignments").insert({
      slot_key: slotKey,
      scope_id: scopeId ?? null,
      file_url: payload.file_url,
      position: nextPos,
      focal_x: 0.5,
      focal_y: 0.5,
      scale: 1.0,
      hero_source: payload.hero_source ?? "original",
      hero_render_look: payload.hero_render_look ?? null,
      hero_rendered_url: payload.hero_rendered_url ?? null,
    });
    if (reportSlotError("addMedia", error)) return;
    await load();
    onSaved?.();
  }

  /** Picker → orientation branch → either insert directly or open the hero choice modal. */
  async function handlePickerSelect(item: MediaPickerResult) {
    setPickerOpen(false);

    // Non-hero slots and images go straight in (today's behavior).
    if (!treatAsHero || item.type !== "video") {
      await addMedia({ file_url: item.url });
      return;
    }

    // Vertical check — prefer media.resolution, fall back to a client-side probe.
    // If the probe fails, treat as horizontal (safe default — no widescreen render forced).
    let dim = parseResolution(item.resolution);
    if (!dim) {
      try {
        dim = await probeVideoDimensions(item.url);
      } catch {
        await addMedia({ file_url: item.url });
        return;
      }
    }
    if (!isVertical(dim)) {
      await addMedia({ file_url: item.url });
      return;
    }

    // Vertical video → let the editor choose original vs rendered.
    setHeroChoice({
      sourceUrl: item.url,
      mediaId: item.media_id,
      clipLabel: `${item.brand} · ${item.campaign}`,
    });
  }

  async function remove(id: string) {
    const { error } = await db.from("slot_assignments").delete().eq("id", id);
    if (reportSlotError("remove", error)) return;
    await load();
    onSaved?.();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Reorder locally first so the list doesn't jump while the writes land.
    const moved = arrayMove(rows, oldIndex, newIndex);

    // Renumber position to the new visual order; only write the rows whose
    // position actually changed. Same table/field the old ▲▼ arrows wrote to.
    const updates = moved
      .map((r, i) => (r.position !== i ? { id: r.id, position: i } : null))
      .filter((u): u is { id: string; position: number } => u !== null);

    setRows(moved.map((r, i) => ({ ...r, position: i })));

    const results = await Promise.all(
      updates.map((u) =>
        db.from("slot_assignments").update({ position: u.position }).eq("id", u.id),
      ),
    );
    for (const r of results) if (reportSlotError("reorder", r.error)) return;
    await load();
    onSaved?.();
  }

  function patch(id: string, p: Partial<SlotRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      const { error } = await db
        .from("slot_assignments")
        .update({ ...p, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (reportSlotError("patch", error)) return;
      onSaved?.();
    }, 300);
  }

  function setFocalFromEvent(id: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    patch(id, { focal_x: +x.toFixed(3), focal_y: +y.toFixed(3) });
  }

  async function setText(val: string) {
    if (rows.length > 0) {
      patch(rows[0].id, { text_value: val });
      return;
    }
    if (textCreating.current) return;
    textCreating.current = true;
    const { error } = await db.from("slot_assignments").insert({
      slot_key: slotKey,
      scope_id: scopeId ?? null,
      text_value: val,
      position: 0,
    });
    textCreating.current = false;
    if (reportSlotError("setText", error)) return;
    await load();
    onSaved?.();
  }

  const overCap = typeof maxItems === "number" && rows.length > maxItems;
  const visibleRows = rows.filter((r) => r.file_url);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: C.text3 }}>
          {title || slotKey}
        </div>
        <div style={{ fontSize: 11, color: overCap ? C.orange : C.text3 }}>
          {rows.length}
          {typeof maxItems === "number" ? ` / ${maxItems}` : ""} {rows.length === 1 ? "item" : "items"}
        </div>
      </div>

      {acceptsText && (
        <input
          value={rows[0]?.text_value ?? ""}
          onChange={(e) => setText(e.target.value)}
          placeholder="One-line text (testimonial / stat / summary)"
          style={{
            width: "100%",
            padding: "9px 12px",
            background: "#1a1a1a",
            border: `1px solid ${C.border2}`,
            borderRadius: 8,
            color: C.text,
            fontSize: 13,
            fontFamily: "Arial,sans-serif",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 10,
          }}
        />
      )}

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visibleRows.map((r) => (
                  <SortableSlotRow
                    key={r.id}
                    row={r}
                    acceptsLogo={acceptsLogo}
                    brandLogos={brandLogos}
                    onSetFocal={setFocalFromEvent}
                    onPatch={patch}
                    onRemove={remove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button
            onClick={() => setPickerOpen(true)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px dashed ${C.border2}`,
              background: "none",
              color: C.text3,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            + Add Media
          </button>

          {overCap && (
            <div style={{ fontSize: 11, color: C.orange, marginTop: 2 }}>
              Heads up: this slot is designed for about {maxItems}. Extra items still work,
              but the page may not show them all.
            </div>
          )}
        </div>
      )}

      {pickerOpen && (
        <CampaignMediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(item) => { void handlePickerSelect(item); }}
          initialBrand={brandId ? { id: brandId, name: brandName ?? "" } : undefined}
        />
      )}

      {heroChoice && (
        <VerticalHeroChoiceModal
          open={true}
          sourceUrl={heroChoice.sourceUrl}
          mediaId={heroChoice.mediaId}
          clipLabel={heroChoice.clipLabel}
          onCancel={() => setHeroChoice(null)}
          onChoice={async (choice) => {
            if (choice.source === "original") {
              await addMedia({ file_url: heroChoice.sourceUrl });
            } else {
              await addMedia({
                file_url: heroChoice.sourceUrl,
                hero_source: "rendered",
                hero_render_look: choice.look,
                hero_rendered_url: choice.rendered_url,
              });
            }
            setHeroChoice(null);
          }}
        />
      )}
    </div>
  );
}

// One draggable hero-image row. Extracted into its own component because
// `useSortable` is a hook and can't be called inside a .map(). A six-dot grip
// is the only drag handle, so the focal-point picker, zoom slider, and logo
// select inside the row keep working normally.
function SortableSlotRow({
  row: r,
  acceptsLogo,
  brandLogos,
  onSetFocal,
  onPatch,
  onRemove,
}: {
  row: SlotRow;
  acceptsLogo?: boolean;
  brandLogos: BrandLogo[];
  onSetFocal: (id: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onPatch: (id: string, p: Partial<SlotRow>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: r.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex",
        gap: 12,
        padding: 10,
        background: C.surface2,
        border: `1px solid ${isDragging ? C.orange : C.border}`,
        borderRadius: 10,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 50 : "auto",
        position: "relative",
        // Required for drag to work while the rows live in a scroll container
        // (same fix used in the campaign order lists).
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Drag handle (six-dot grip) — only this element starts a drag. */}
      <div
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        aria-label="Drag to reorder"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: 20,
          color: C.text3,
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="8" cy="5" r="2" />
          <circle cx="16" cy="5" r="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="16" cy="12" r="2" />
          <circle cx="8" cy="19" r="2" />
          <circle cx="16" cy="19" r="2" />
        </svg>
      </div>

      <div
        onMouseDown={(e) => onSetFocal(r.id, e)}
        onMouseMove={(e) => {
          if (e.buttons === 1) onSetFocal(r.id, e);
        }}
        title="Click or drag to set the focal point"
        style={{
          position: "relative",
          width: 96,
          height: 96,
          flexShrink: 0,
          borderRadius: 8,
          overflow: "hidden",
          cursor: "crosshair",
          border: `1px solid ${C.border2}`,
        }}
      >
        {isVideoUrl(r.file_url) ? (
          <video
            src={r.file_url as string}
            muted
            playsInline
            preload="metadata"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${r.focal_x * 100}% ${r.focal_y * 100}%`,
              transform: `scale(${r.scale})`,
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.file_url as string}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${r.focal_x * 100}% ${r.focal_y * 100}%`,
              transform: `scale(${r.scale})`,
            }}
          />
        )}
        {/* logo overlay preview */}
        {r.logo_url && (
          <div style={{ position: "absolute", bottom: 3, right: 3, width: 22, height: 22, borderRadius: 4, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.logo_url} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: `${r.focal_x * 100}%`,
            top: `${r.focal_y * 100}%`,
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
            borderRadius: "50%",
            border: "2px solid #fff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FOCAL_PRESETS.map((p) => {
            const active = Math.abs(r.focal_x - p.x) < 0.02 && Math.abs(r.focal_y - p.y) < 0.02;
            return (
              <button
                key={p.label}
                onClick={() => onPatch(r.id, { focal_x: p.x, focal_y: p.y })}
                style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: `1px solid ${active ? C.orange : C.border2}`,
                  background: active ? "rgba(215,63,9,0.12)" : "transparent",
                  color: active ? C.orange : C.text2,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: C.text3, width: 32 }}>Zoom</span>
          <input
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={r.scale}
            onChange={(e) => onPatch(r.id, { scale: parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: C.orange }}
          />
          <span style={{ fontSize: 10, color: C.text3, width: 30, textAlign: "right" }}>
            {r.scale.toFixed(2)}×
          </span>
        </div>

        {/* v2: per-photo brand logo overlay */}
        {acceptsLogo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: C.text3, width: 32 }}>Logo</span>
            <select
              value={r.logo_url ?? ""}
              onChange={(e) => onPatch(r.id, { logo_url: e.target.value || null })}
              style={{
                flex: 1,
                padding: "4px 8px",
                background: "#1a1a1a",
                border: `1px solid ${C.border2}`,
                borderRadius: 6,
                color: r.logo_url ? C.text : C.text3,
                fontSize: 11,
                fontFamily: "Arial,sans-serif",
                cursor: "pointer",
              }}
            >
              <option value="">No logo</option>
              {brandLogos
                .filter((b) => b.logo_primary_url)
                .map((b) => (
                  <option key={b.id} value={b.logo_primary_url as string}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
          <button
            onClick={() => onRemove(r.id)}
            style={{
              marginLeft: "auto",
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,80,80,0.25)",
              background: "none",
              color: "#ff6b6b",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
