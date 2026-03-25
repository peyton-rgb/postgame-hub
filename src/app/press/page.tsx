import { createPlainSupabase } from "@/lib/supabase";
import type { PressArticle } from "@/lib/types";
import type { Metadata } from "next";

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
  const highlightedArticle = allArticles.length > 0 ? allArticles[0] : null;
  const rest = allArticles.slice(1);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAF8", fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <img src="/postgame-logo-black.png" alt="Postgame" className="h-6 md:h-8 object-contain mx-auto mb-4" />
          <h1 className="text-5xl md:text-7xl font-black text-gray-900" style={{ fontFamily: "Arial, sans-serif" }}>
            Press & News
          </h1>
          <div className="w-16 h-0.5 bg-[#D73F09] mx-auto mt-6" />
        </div>
      </div>

      {highlightedArticle && (
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D73F09] bg-[#D73F09]/10 px-3 py-1 rounded-full">
              Latest
            </span>
          </div>
          <a
            href={highlightedArticle.external_url || "#"}
            target={highlightedArticle.external_url ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {highlightedArticle.image_url && (
                <div className="relative rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={highlightedArticle.image_url}
                    alt={highlightedArticle.title}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {highlightedArticle.show_logo && (
                    <img
                      src="/postgame-logo-white.png"
                      alt="Postgame"
                      className="absolute bottom-3 left-3 h-4 md:h-5 object-contain drop-shadow-lg"
                    />
                  )}
                </div>
              )}
              <div className={highlightedArticle.image_url ? "" : "md:col-span-2 max-w-2xl"}>
                <div className="flex items-center gap-3 mb-4">
                  {highlightedArticle.category && (
                    <span className="text-xs font-bold uppercase tracking-wider text-[#D73F09]">
                      {highlightedArticle.category}
                    </span>
                  )}
                  {highlightedArticle.published_date && (
                    <span className="text-xs text-gray-400">
                      {new Date(highlightedArticle.published_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 group-hover:text-[#D73F09] transition-colors" style={{ fontFamily: "Arial, sans-serif" }}>
                  {highlightedArticle.title}
                </h2>
                {highlightedArticle.excerpt && (
                  <p className="text-gray-600 text-lg leading-relaxed mb-4">{highlightedArticle.excerpt}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {highlightedArticle.publication && (
                    <span className="font-bold">{highlightedArticle.publication}</span>
                  )}
                  {highlightedArticle.author && highlightedArticle.publication && <span>\u00b7</span>}
                  {highlightedArticle.author && <span>{highlightedArticle.author}</span>}
                </div>
              </div>
            </div>
          </a>
        </section>
      )}

      {rest.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="columns-1 md:columns-2 lg:columns-3 gap-8" style={{ columnFill: "balance" }}>
            {rest.map((article) => (
              <a
                key={article.id}
                href={article.external_url || "#"}
                target={article.external_url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="block group mb-8 break-inside-avoid"
              >
                {article.image_url && (
                  <div className="relative rounded-lg overflow-hidden bg-gray-100 mb-4">
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {article.show_logo && (
                      <img
                        src="/postgame-logo-white.png"
                        alt="Postgame"
                        className="absolute bottom-2 left-2 h-3 md:h-4 object-contain drop-shadow-lg"
                      />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  {article.category && (
                    <span className="text-xs font-bold uppercase tracking-wider text-[#D73F09]">
                      {article.category}
                    </span>
                  )}
                  {article.published_date && (
                    <span className="text-xs text-gray-400">
                      {new Date(article.published_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2 group-hover:text-[#D73F09] transition-colors" style={{ fontFamily: "Arial, sans-serif" }}>
                  {article.title}
                </h3>
                {article.excerpt && (
                  <p className="text-gray-600 text-sm line-clamp-3 mb-2">{article.excerpt}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {article.publication && <span className="font-bold">{article.publication}</span>}
                  {article.author && article.publication && <span>\u00b7</span>}
                  {article.author && <span>{article.author}</span>}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {allArticles.length === 0 && (
        <div className="text-center py-32 text-gray-400">
          <p className="text-lg">No press articles published yet.</p>
        </div>
      )}
    </div>
  );
}
