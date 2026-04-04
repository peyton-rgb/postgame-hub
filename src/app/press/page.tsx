import { createPlainSupabase } from "@/lib/supabase";
import type { PressArticle } from "@/lib/types";
import type { Metadata } from "next";
import PressContent from "./PressContent";
import SiteFooter from "@/components/SiteFooter";

export const revalidate = 60;

export const metadata: Metadata = { title: "Press | Postgame" };

export default async function PressPage() {
  const supabase = createPlainSupabase();
  const { data: articles } = await supabase
    .from("press_articles")
    .select("*")
    .eq("published", true)
    .eq("archived", false)
    .order("featured", { ascending: false })
    .order("published_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (
    <>
      <PressContent articles={(articles || []) as PressArticle[]} />
      <SiteFooter />
    </>
  );
}
