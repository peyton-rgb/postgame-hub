// Shared audience-segment filter logic — used by the /admin/audiences
// page and its CSV export route so the two can never drift.

import { sanitizeFilterValue } from "@/lib/admin/db";

export interface AudienceFilters {
  state: string;
  gender: string;
  sport: string;
  college: string;
  minFollowers: number | null;
  maxFollowers: number | null;
  rating: string;
}

export function buildAudienceFilters(
  searchParams: Record<string, string | undefined>
): AudienceFilters {
  return {
    state: sanitizeFilterValue(searchParams.state ?? ""),
    gender: sanitizeFilterValue(searchParams.gender ?? ""),
    sport: sanitizeFilterValue(searchParams.sport ?? ""),
    college: sanitizeFilterValue(searchParams.college ?? ""),
    minFollowers: /^\d+$/.test(searchParams.min ?? "") ? parseInt(searchParams.min!, 10) : null,
    maxFollowers: /^\d+$/.test(searchParams.max ?? "") ? parseInt(searchParams.max!, 10) : null,
    rating: sanitizeFilterValue(searchParams.rating ?? ""),
  };
}

export function applyAudienceFilters(query: any, f: AudienceFilters) {
  query = query
    .eq("is_archived", false)
    .eq("is_active", true)
    .in("person_type", ["Athlete", "Former Athlete"]);
  if (f.state) query = query.eq("college_state", f.state.toUpperCase());
  if (f.gender) query = query.eq("gender", f.gender);
  if (f.sport) query = query.ilike("sport", `%${f.sport}%`);
  if (f.college) query = query.ilike("college_raw", `%${f.college}%`);
  if (f.minFollowers != null) query = query.gte("instagram_followers", f.minFollowers);
  if (f.maxFollowers != null) query = query.lte("instagram_followers", f.maxFollowers);
  if (f.rating) query = query.eq("rating", f.rating);
  return query;
}
