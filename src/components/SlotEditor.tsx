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
import CampaignMediaPicker from "@/components/CampaignMediaPicker";

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
  onSaved,
}: SlotEditorProps) {
  const supabase = createBrowserSupabase();
  const db = supabase as any; // keeps build green if types aren't regenerated yet

  const [rows, setRows] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [brandLogos, setBrandLogos] = useState<BrandLogo[]>([]);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const textCreating = useRef(false);

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

  // Brand logos for the per-photo overlay picker (only when needed)
  useEffect(() => {
    if (!acceptsLogo) return;
    supabase
      .from("brands")
      .select("id,name,logo_primary_url")
      .order("name")
      .then(({ data }: { data: BrandLogo[] | null }) => setBrandLogos(data || []));
  }, [acceptsLogo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addMedia(url: string) {
    const nextPos = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
    await db.from("slot_assignments").insert({
      slot_key: slotKey,
      scope_id: scopeId ?? null,
      file_url: url,
      position: nextPos,
      focal_x: 0.5,
      focal_y: 0.5,
      scale: 1.0,
    });
    await load();
    onSaved?.();
  }

  async function remove(id: string) {
    await db.from("slot_assignments").delete().eq("id", id);
    await load();
    onSaved?.();
  }

  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[idx];
    const b = rows[j];
    await Promise.all([
      db.from("slot_assignments").update({ position: b.position }).eq("id", a.id),
      db.from("slot_assignments").update({ position: a.position }).eq("id", b.id),
    ]);
    await load();
    onSaved?.();
  }

  function patch(id: string, p: Partial<SlotRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      await db
        .from("slot_assignments")
        .update({ ...p, updated_at: new Date().toISOString() })
        .eq("id", id);
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
    await db.from("slot_assignments").insert({
      slot_key: slotKey,
      scope_id: scopeId ?? null,
      text_value: val,
      position: 0,
    });
    await load();
    textCreating.current = false;
    onSaved?.();
  }

  const overCap = typeof maxItems === "number" && rows.length > maxItems;

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
          {rows
            .filter((r) => r.file_url)
            .map((r, idx, arr) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 10,
                  background: C.surface2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                }}
              >
                <div
                  onMouseDown={(e) => setFocalFromEvent(r.id, e)}
                  onMouseMove={(e) => {
                    if (e.buttons === 1) setFocalFromEvent(r.id, e);
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                          onClick={() => patch(r.id, { focal_x: p.x, focal_y: p.y })}
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
                      onChange={(e) => patch(r.id, { scale: parseFloat(e.target.value) })}
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
                        onChange={(e) => patch(r.id, { logo_url: e.target.value || null })}
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
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} style={iconBtn(idx === 0)} title="Move up">
                      ▲
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === arr.length - 1}
                      style={iconBtn(idx === arr.length - 1)}
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => remove(r.id)}
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
            ))}

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
          onSelect={(item) => {
            addMedia(item.url);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 26,
    height: 24,
    borderRadius: 6,
    border: `1px solid ${C.border2}`,
    background: "none",
    color: disabled ? "rgba(255,255,255,0.15)" : C.text2,
    fontSize: 9,
    cursor: disabled ? "default" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };
}
