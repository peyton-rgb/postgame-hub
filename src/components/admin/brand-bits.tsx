// ============================================================
// Brand bits shared by /admin/brands and /admin/brands/[id] —
// the logo mark cell, the portal status pill, and the rule that
// turns a portal link row (+ the legacy brands.portal_token) into
// a status. Server-safe: no client hooks.
//
// Logos only ever come from the brands row's logo columns. When a
// brand has none we show an empty tile, never its name as text.
// ============================================================

/* eslint-disable @next/next/no-img-element */

export interface PortalLinkRow {
  brand_id: string;
  active: boolean | null;
}

export type PortalState = "live" | "paused" | "none";

/**
 * brand_portal_links (migration 083) is the new per-brand portal link.
 * Until it is applied — and for brands that haven't been given one —
 * the live portal is still /portal/{brands.portal_token}, so a token
 * counts as "live" too.
 */
export function portalState(link: PortalLinkRow | undefined, portalToken: string | null): PortalState {
  if (link) return link.active === false ? "paused" : "live";
  return portalToken ? "live" : "none";
}

export function PortalPill({ state }: { state: PortalState }) {
  if (state === "none") return <span className="text-stone-400">—</span>;
  if (state === "paused") {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-status-warn">
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-status-ok">
      Live
    </span>
  );
}

/** 30px logo tile (the prototype's `.mk`). Empty when the brand has no logo on file. */
export function BrandMark({
  src,
  name,
  size = 30,
}: {
  src: string | null;
  name: string | null;
  size?: number;
}) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-[7px] border border-stone-200 bg-white"
      style={{ width: size, height: size, padding: Math.round(size * 0.13) }}
      title={src ? undefined : "No logo on file"}
    >
      {src ? (
        <img src={src} alt={name ? `${name} logo` : ""} className="h-full w-full object-contain" />
      ) : (
        <span className="h-full w-full rounded-[3px] bg-stone-100" aria-hidden />
      )}
    </span>
  );
}
