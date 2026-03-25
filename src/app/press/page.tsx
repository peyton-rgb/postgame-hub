import { createPlainSupabase } from "@/lib/supabase";
import type { PressArticle } from "@/lib/types";
import type { Metadata } from "next";
import PressContent from "./PressContent";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Press | Postgame",
};

export default async function PressPage() {
  const supabase = createPlainSupabase();
  const { data: articles } = await supabase
    .from("press_articles")
    .select("*")
    .eq("published", true)
    .eq("archived", false)
    .order("published_date", { ascending: false });

  const allArticles = (articles || []) as PressArticle[];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <img src="/postgame-logo-black.png" alt="Postgame" className="h-10 md:h-14 object-contain mx-auto mb-4" />
        <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight mb-2">
          Press &amp; News
        </h1>
        <p className="text-gray-400 text-base md:text-lg mt-3 max-w-2xl mx-auto text-center">Your source for all the latest press coverage and media highlights from Postgame NIL campaigns.</p>
        <div className="w-12 h-0.5 bg-orange-500 mx-auto mt-6 mb-10" />

        <PressContent articles={allArticles} />
      </div>
    </div>
  );
}
