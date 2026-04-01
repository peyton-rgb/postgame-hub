import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface PageSection {
  id: string;
  page_id: string;
  type: string;
  title: string | null;
  subtitle?: string | null;
  content: Record<string, unknown>;
  sort_order: number;
  visible?: boolean;
  created_at: string;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HomepageData {
  page: Page;
  sections: PageSection[];
}

export async function getHomepage(): Promise<HomepageData | null> {
  // Use foreign key embedding to fetch page + sections in one query.
  // This goes through the pages table RLS policy (anon can read published pages),
  // avoiding the separate page_sections RLS that may block direct anon SELECT.
  const { data: page, error } = await supabase
    .from("pages")
    .select("*, page_sections(*)")
    .eq("slug", "homepage")
    .eq("published", true)
    .order("sort_order", { referencedTable: "page_sections", ascending: true })
    .single();

  if (error || !page) {
    // Fallback: try fetching page and sections separately (in case embedding isn't set up)
    const { data: pageOnly } = await supabase
      .from("pages")
      .select("*")
      .eq("slug", "homepage")
      .eq("published", true)
      .single();

    if (!pageOnly) return null;

    const { data: sections } = await supabase
      .from("page_sections")
      .select("*")
      .eq("page_id", pageOnly.id)
      .order("sort_order", { ascending: true });

    return { page: pageOnly as Page, sections: (sections || []) as PageSection[] };
  }

  const { page_sections: sections, ...pageData } = page as any;
  return { page: pageData as Page, sections: (sections || []) as PageSection[] };
}

export async function getPress(limit = 10) {
  const { data } = await supabase
    .from("press_articles")
    .select("*")
    .eq("published", true)
    .order("published_date", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getDeals(limit = 10) {
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .limit(limit);
  return data || [];
}

export async function getDealTracker() {
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true });
  return data || [];
}

export async function getBrandLogos() {
  const { data } = await supabase.from('brands').select('name, logo_url, logo_light_url').eq('archived', false);
  const map = new Map<string, string>();
  data?.forEach((b: any) => {
    if (b.logo_light_url) map.set(b.name.toLowerCase(), b.logo_light_url);
    else if (b.logo_url) map.set(b.name.toLowerCase(), b.logo_url);
  });
  return map;
}

export async function getBrands() {
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });
  return data || [];
}
