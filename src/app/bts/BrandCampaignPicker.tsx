"use client";

import { useState, useMemo, useRef, useEffect } from "react";

type Brand = { id: string; name: string };
type Campaign = { id: string; name: string; brand_id: string };
type Value = { brandId: string | null; campaignId: string | null };

/**
 * Two-field searchable picker for Brand + Campaign.
 *
 * - Brand: type-to-filter input, dropdown shows the top 8 matches.
 * - Campaign: disabled until a brand is selected, then filtered to that
 *   brand and searchable the same way. When brand changes, the selected
 *   campaign is cleared.
 *
 * Keyboard: ArrowUp / ArrowDown navigate, Enter selects, Escape closes.
 * Mouse / touch: tap a row to select.
 *
 * Built from scratch — no external combobox dependency.
 */
export default function BrandCampaignPicker({
  brands,
  campaigns,
  value,
  onChange,
}: {
  brands: Brand[];
  campaigns: Campaign[];
  value: Value;
  onChange: (next: Value) => void;
}) {
  // Per-field search state. When a row is selected, the input displays the
  // selected item's name instead of the raw query.
  const [brandQuery, setBrandQuery] = useState("");
  const [campaignQuery, setCampaignQuery] = useState("");
  const [openField, setOpenField] = useState<"brand" | "campaign" | null>(null);
  const [highlight, setHighlight] = useState(0);

  const selectedBrand = brands.find((b) => b.id === value.brandId) ?? null;
  const selectedCampaign = campaigns.find((c) => c.id === value.campaignId) ?? null;

  // Brand matches: fuzzy contains-match, top 8.
  const brandMatches = useMemo(() => {
    const q = brandQuery.toLowerCase().trim();
    const pool = q ? brands.filter((b) => b.name.toLowerCase().includes(q)) : brands;
    return pool.slice(0, 8);
  }, [brands, brandQuery]);

  // Campaign matches: scoped to selected brand, then filtered by query, top 8.
  const campaignMatches = useMemo(() => {
    if (!value.brandId) return [];
    const scoped = campaigns.filter((c) => c.brand_id === value.brandId);
    const q = campaignQuery.toLowerCase().trim();
    const pool = q ? scoped.filter((c) => c.name.toLowerCase().includes(q)) : scoped;
    return pool.slice(0, 8);
  }, [campaigns, campaignQuery, value.brandId]);

  // Close any open dropdown when the user clicks outside the picker.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenField(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // When the user picks a brand, clear the campaign selection — the old
  // campaign likely doesn't belong to the new brand anymore.
  const pickBrand = (b: Brand) => {
    onChange({ brandId: b.id, campaignId: null });
    setBrandQuery(b.name);
    setCampaignQuery("");
    setOpenField(null);
  };
  const pickCampaign = (c: Campaign) => {
    onChange({ ...value, campaignId: c.id });
    setCampaignQuery(c.name);
    setOpenField(null);
  };

  // Shared keyboard handler: clamps highlight to the visible list length,
  // then delegates to pickBrand / pickCampaign on Enter.
  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "brand" | "campaign"
  ) => {
    const list = field === "brand" ? brandMatches : campaignMatches;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = list[highlight];
      if (!pick) return;
      if (field === "brand") pickBrand(pick as Brand);
      else pickCampaign(pick as Campaign);
    } else if (e.key === "Escape") {
      setOpenField(null);
    }
  };

  // Shared class strings — match the BrandList form convention.
  const inputCls =
    "w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none";
  const labelCls =
    "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2";
  const rowCls =
    "px-4 py-3 cursor-pointer text-white text-sm border-b border-gray-800 last:border-b-0";
  const rowHighlightCls = "bg-white/[0.08]";
  const dropdownCls =
    "absolute z-10 left-0 right-0 mt-1 bg-[#111] border border-gray-700 rounded-lg overflow-hidden max-h-72 overflow-y-auto";

  return (
    <div ref={wrapperRef} className="space-y-4">
      {/* ── Brand field ──────────────────────────────────────── */}
      <div>
        <label className={labelCls}>Brand</label>
        <div className="relative">
          <input
            type="text"
            className={inputCls}
            placeholder="Search brands…"
            value={openField === "brand" ? brandQuery : selectedBrand?.name ?? brandQuery}
            onChange={(e) => {
              setBrandQuery(e.target.value);
              setOpenField("brand");
              setHighlight(0);
            }}
            onFocus={() => {
              setOpenField("brand");
              setHighlight(0);
            }}
            onKeyDown={(e) => onKeyDown(e, "brand")}
          />
          {openField === "brand" && brandMatches.length > 0 && (
            <div className={dropdownCls}>
              {brandMatches.map((b, i) => (
                <div
                  key={b.id}
                  className={`${rowCls} ${i === highlight ? rowHighlightCls : ""}`}
                  // onMouseDown (not onClick) so the pick fires before the
                  // input blur that closes the dropdown.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickBrand(b);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  {b.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Campaign field (disabled until brand picked) ───────── */}
      <div>
        <label className={labelCls}>Campaign</label>
        <div className="relative">
          <input
            type="text"
            className={`${inputCls} ${!value.brandId ? "opacity-50 cursor-not-allowed" : ""}`}
            placeholder={value.brandId ? "Search campaigns…" : "Pick a brand first"}
            disabled={!value.brandId}
            value={
              openField === "campaign"
                ? campaignQuery
                : selectedCampaign?.name ?? campaignQuery
            }
            onChange={(e) => {
              setCampaignQuery(e.target.value);
              setOpenField("campaign");
              setHighlight(0);
            }}
            onFocus={() => {
              if (value.brandId) {
                setOpenField("campaign");
                setHighlight(0);
              }
            }}
            onKeyDown={(e) => onKeyDown(e, "campaign")}
          />
          {openField === "campaign" && campaignMatches.length > 0 && (
            <div className={dropdownCls}>
              {campaignMatches.map((c, i) => (
                <div
                  key={c.id}
                  className={`${rowCls} ${i === highlight ? rowHighlightCls : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickCampaign(c);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  {c.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
