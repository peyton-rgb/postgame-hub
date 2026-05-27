"use client";

// ============================================================
// <RecapSlotEditor> — picks CAMPAIGN RECAPS (not media) into a slot.
//
// Used by the brand "Featured Campaigns" slot
// (brand.{slug}.featured_campaigns). Rows live in slot_assignments
// with `recap_id` set (and file_url null). This is intentionally a
// separate component from <SlotEditor> because the UX is different:
// you pick from the brand's campaign_recaps and just order/remove —
// no focal point, zoom, or logo.
//
// Keys purely by slot_key (scope_id is unused, per Phase 4 cleanup).
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

const C = {
  orange: "#D73F09",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.13)",
  surface2: "#161616",
  text: "#fff",
  text2: "rgba(255,255,255,0.6)",
  text3: "rgba(255,255,255,0.35)",
};

interface Props {
  slug: string;
  brandName: string;
  title?: string;
  onSaved?: () => void;
}

interface RecapRow {
  id: string;
  name: string | null;
  slug: string | null;
}
interface SlotRecapRow {
  id: string;
  recap_id: string | null;
  position: number;
  campaign_recaps: { name: string | null } | null;
}

export default function RecapSlotEditor({ slug, brandName, title, onSaved }: Props) {
  const supabase = createBrowserSupabase();
  const db = supabase as any;
  const slotKey = `brand.${slug}.featured_campaigns`;

  const [rows, setRows] = useState<SlotRecapRow[]>([]);
  const [brandRecaps, setBrandRecaps] = useState<RecapRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await db
      .from("slot_assignments")
      .select("id, recap_id, position, campaign_recaps(name)")
      .eq("slot_key", slotKey)
      .order("position", { ascending: true });
    setRows(data || []);
    setLoading(false);
  }, [slotKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // Resolve brand_id from slug (fallback to name), then load the brand's recaps.
  useEffect(() => {
    (async () => {
      let brandId: string | null = null;
      const { data: b1 } = await db.from("brands").select("id").eq("slug", slug).maybeSingle();
      brandId = b1?.id ?? null;
      if (!brandId && brandName) {
        const { data: b2 } = await db.from("brands").select("id").ilike("name", brandName).maybeSingle();
        brandId = b2?.id ?? null;
      }
      if (!brandId) {
        setBrandRecaps([]);
        return;
      }
      const { data } = await db
        .from("campaign_recaps")
        .select("id, name, slug")
        .eq("brand_id", brandId)
        .eq("type", "recap")
        .order("created_at", { ascending: false })
        .limit(200);
      setBrandRecaps(data || []);
    })();
  }, [slug, brandName]); // eslint-disable-line react-hooks/exhaustive-deps

  const addedIds = new Set(rows.map((r) => r.recap_id));

  async function addRecap(recapId: string) {
    const nextPos = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
    await db.from("slot_assignments").insert({ slot_key: slotKey, recap_id: recapId, position: nextPos });
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

  const available = brandRecaps.filter((r) => !addedIds.has(r.id));

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: C.text3 }}>
          {title || "Featured Campaigns"}
        </div>
        <div style={{ fontSize: 11, color: C.text3 }}>
          {rows.length} {rows.length === 1 ? "campaign" : "campaigns"}
        </div>
      </div>

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.length === 0 && (
            <div style={{ fontSize: 12, color: C.text3 }}>
              None picked — the brand page shows all of this brand’s campaigns automatically.
            </div>
          )}
          {rows.map((r, idx, arr) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 11, color: C.text3, width: 18 }}>{idx + 1}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.campaign_recaps?.name || "(untitled campaign)"}
              </span>
              <button onClick={() => move(idx, -1)} disabled={idx === 0} style={iconBtn(idx === 0)} title="Move up">▲</button>
              <button onClick={() => move(idx, 1)} disabled={idx === arr.length - 1} style={iconBtn(idx === arr.length - 1)} title="Move down">▼</button>
              <button
                onClick={() => remove(r.id)}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,80,80,0.25)", background: "none", color: "#ff6b6b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          ))}

          <button
            onClick={() => setPickerOpen(true)}
            style={{ padding: "8px 14px", borderRadius: 8, border: `1px dashed ${C.border2}`, background: "none", color: C.text3, fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
          >
            + Add Campaign
          </button>
        </div>
      )}

      {pickerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPickerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a1a", border: `1px solid ${C.border2}`, borderRadius: 16, padding: 24, width: 520, maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto", color: C.text }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Add a campaign — {brandName}</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>Pick which campaign recaps appear, in order, on the brand page.</div>
            {available.length === 0 ? (
              <div style={{ fontSize: 13, color: C.text3, padding: "16px 0" }}>No more campaigns for this brand.</div>
            ) : (
              available.map((r) => (
                <div
                  key={r.id}
                  onClick={() => { addRecap(r.id); setPickerOpen(false); }}
                  style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(215,63,9,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {r.name || "(untitled campaign)"}
                </div>
              ))
            )}
            <div style={{ textAlign: "right", marginTop: 12 }}>
              <button onClick={() => setPickerOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border2}`, background: "none", color: C.text2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Done</button>
            </div>
          </div>
        </div>
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
