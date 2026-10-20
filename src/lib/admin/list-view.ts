// ============================================================
// Rows / Cards view preference for admin list pages (server side).
//
// Order of precedence:
//   1. ?view=rows|cards in the URL (what the toggle sets)
//   2. the cookie the toggle writes, one per list (admin_view_<key>)
//   3. "rows"
//
// Pair with <ViewToggle listKey="..." view={view} /> from
// src/components/admin/ViewToggle.tsx.
// ============================================================

import { cookies } from "next/headers";

export type ListView = "rows" | "cards";

export function listViewCookie(listKey: string): string {
  return `admin_view_${listKey.replace(/[^a-z0-9_-]/gi, "_")}`;
}

export function getListView(
  listKey: string,
  searchParams?: Record<string, string | string[] | undefined>
): ListView {
  const fromUrl = searchParams?.view;
  if (fromUrl === "rows" || fromUrl === "cards") return fromUrl;
  try {
    const saved = cookies().get(listViewCookie(listKey))?.value;
    if (saved === "rows" || saved === "cards") return saved;
  } catch {
    /* outside a request (build): fall through */
  }
  return "rows";
}
