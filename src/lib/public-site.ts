import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface PageSection {
  id: string;
  page_id: string;
  section_type: string;
  title: string | null;
  subtitle: string | null;
  content: Record<string, unknown>;
  sort_order: number;
  visible: boolean;
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
  const { data: page, error } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", "homepage")
    .eq("published", true)
    .single();

  if (error || !page) return null;

  const { data: sections } = await supabase
    .from("page_sections")
    .select("*")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true });

  return { page: page as Page, sections: (sections || []) as PageSection[] };
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

export async function getBrands() {
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });
  return data || [];
}
