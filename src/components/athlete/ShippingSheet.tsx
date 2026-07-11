"use client";

// Shipping & sizes sheet (Phase 3). A real editable form over the athlete's own
// `athlete_shipping` row (RLS: full own-row access), so SAVE upserts and the
// values survive reload. Writes go through the browser client directly — no
// service route needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import AthleteSheet from "@/components/athlete/AthleteSheet";
import type { ShippingRow } from "@/lib/athlete-account";

export default function ShippingSheet({
  open,
  onClose,
  profileId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  initial: ShippingRow | null;
}) {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [shirt, setShirt] = useState(initial?.shirtSize ?? "");
  const [shoe, setShoe] = useState(initial?.shoeSize ?? "");
  const [pants, setPants] = useState(initial?.pantsSize ?? "");
  const [hat, setHat] = useState(initial?.hatSize ?? "");
  const [line1, setLine1] = useState(initial?.addressLine1 ?? "");
  const [line2, setLine2] = useState(initial?.addressLine2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [zip, setZip] = useState(initial?.zip ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clean = (v: string) => {
    const t = v.trim();
    return t.length ? t : null;
  };

  async function save() {
    setError("");
    setSaving(true);
    const { error } = await supabase.from("athlete_shipping").upsert(
      {
        athlete_id: profileId,
        shirt_size: clean(shirt),
        shoe_size: clean(shoe),
        pants_size: clean(pants),
        hat_size: clean(hat),
        address_line1: clean(line1),
        address_line2: clean(line2),
        city: clean(city),
        state: clean(state),
        zip: clean(zip),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "athlete_id" }
    );
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <AthleteSheet open={open} onClose={onClose} title="Shipping & sizes" subtitle="So brands can send you product.">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="a-label">Sizes</label>
          <div className="a-sizegrid">
            <input className="a-input" value={shirt} onChange={(e) => setShirt(e.target.value)} placeholder="Shirt (e.g. L)" />
            <input className="a-input" value={shoe} onChange={(e) => setShoe(e.target.value)} placeholder="Shoe (e.g. 11)" />
            <input className="a-input" value={pants} onChange={(e) => setPants(e.target.value)} placeholder="Pants (e.g. 34)" />
            <input className="a-input" value={hat} onChange={(e) => setHat(e.target.value)} placeholder="Hat (e.g. 7 1/4)" />
          </div>
        </div>

        <div>
          <label className="a-label">Shipping address</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input className="a-input" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" autoComplete="address-line1" />
            <input className="a-input" value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Apt, suite (optional)" autoComplete="address-line2" />
            <div className="a-fieldrow">
              <input className="a-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" autoComplete="address-level2" />
              <input className="a-input" style={{ flex: "0 0 74px" }} value={state} onChange={(e) => setState(e.target.value)} placeholder="State" autoComplete="address-level1" />
              <input className="a-input" style={{ flex: "0 0 96px" }} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" autoComplete="postal-code" />
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: "rgba(250,248,245,0.5)", lineHeight: 1.5 }}>
          Only shared with brands sending you product for a deal you&apos;re in. Never sold or shown publicly.
        </div>
        {error && <div className="a-err">{error}</div>}
        <button className="a-cta" onClick={save} disabled={saving}>
          <span className="a-anton" style={{ fontSize: 15 }}>{saving ? "SAVING…" : "SAVE"}</span>
        </button>
      </div>
    </AthleteSheet>
  );
}
