// ============================================================
// robots.txt.
//
// There was none, so nothing was stated either way. The disallow list is the
// set of surfaces that are not for the public: the staff dashboard, the brand
// portal, the API, and the token-gated deliverables — those last ones are
// unguessable URLs rather than secrets, but a crawler that finds one through a
// referrer should not index a client's delivery page.
//
// The sitemap is advertised here so a crawler finds it without being told.
// ============================================================

import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/portal",
          "/api",
          "/admin",
          // Trailing slash matters: "/athlete" is a PREFIX match and would also
          // block /athletes/<slug>, which is the permanent redirect to the new
          // deal URLs. Blocking it would stop a crawler ever following the 308,
          // so any equity on an existing /athletes link would be stranded.
          "/athlete/",
          "/board",
          "/media-library",
          "/packages",
          "/login",
          "/authorize",
          "/reset-password",
          // Token-gated deliverables — one client's assets, not public pages.
          "/deliver/",
          "/pkg/",
          "/review/",
          "/submit/",
          "/v/",
          // Brand- and athlete-facing workflow surfaces.
          "/brief/",
          "/optin/",
          "/campaign-optin/",
          "/campaign-instructions/",
          "/creator-brief/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
