"use client";

// ============================================================
// The searchable half of the admin preview picker.
//
// Client-side only because of the filter box. The brand list itself is
// loaded on the server and handed down, so this component never queries
// anything and holds no access decision — picking a brand here just
// navigates to /portal/preview, which re-checks that the viewer is an
// admin before it agrees to anything.
// ============================================================

import { useMemo, useState } from "react";
import { MONO, CARD, CARD_B, ORANGE } from "@/lib/portal";

export interface PickerBrand {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
}

export default function BrandPicker({ brands }: { brands: PickerBrand[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search brands…"
        aria-label="Search brands"
        style={{
          width: "100%",
          background: CARD,
          border: `1px solid ${CARD_B}`,
          borderRadius: 12,
          padding: "13px 14px",
          fontSize: 16,
          color: "rgba(250,248,245,1)",
          outline: "none",
        }}
      />

      <p style={{ ...MONO, fontSize: 10, color: "rgba(250,248,245,.50)", margin: "16px 0 10px" }}>
        {filtered.length} {filtered.length === 1 ? "brand" : "brands"}
      </p>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 16, color: "rgba(250,248,245,.50)", padding: "24px 0" }}>
          No brands match that.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((b) => (
            <a
              key={b.id}
              href={`/portal/preview?brand=${encodeURIComponent(b.slug || b.id)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 14px",
                borderRadius: 12,
                background: CARD,
                border: `1px solid ${CARD_B}`,
                textDecoration: "none",
                color: "rgba(250,248,245,.90)",
              }}
            >
              {/* Hard rule 2: client logos come from the database. A brand
                  with no logo on file gets a labelled empty slot, never a
                  drawn or approximated mark. */}
              <span
                aria-hidden
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "rgba(250,248,245,.05)",
                  border: `1px solid ${CARD_B}`,
                  flex: "0 0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {b.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.logo}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
                  />
                ) : (
                  <span style={{ ...MONO, fontSize: 9, color: "rgba(250,248,245,.38)" }}>
                    No logo
                  </span>
                )}
              </span>

              <span style={{ fontSize: 16, minWidth: 0, flex: 1 }}>{b.name}</span>

              <span style={{ ...MONO, fontSize: 10, color: ORANGE, whiteSpace: "nowrap" }}>
                View as
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
