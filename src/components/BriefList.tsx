"use client";

// ============================================================
// Legacy Briefs (?tab=briefs) — READ-ONLY ARCHIVE
//
// `briefs` is the frozen legacy link-doc product: a template produced a
// full HTML document into `html_content`, served publicly at
// /brief/[slug]. Those URLs are live addresses that have been handed
// out, so the rows stay and the public renderer stays.
//
// Nothing writes to `briefs` again. This component used to own the only
// two writers in the app — a create modal (insert) and a delete button
// (delete) — and both are gone. "+ New Brief" now goes to
// /dashboard/briefs/new, the 14-section brand-brief form that writes
// `campaign_briefs`. Briefs created there are a different product and
// will NOT appear in this list; this list only ever shows the archive.
//
// The old modal's template picker died with it. It fed the legacy HTML
// flow via SYSTEM_TEMPLATES (src/lib/brief-template.ts) and passed a
// ?template= index that the detail page never read — broken from birth.
// Not ported. Recorded here for the design ledger.
// ============================================================

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Brief } from "@/lib/types";
import Link from "next/link";

export default function BriefList() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadBriefs();
  }, []);

  async function loadBriefs() {
    const { data } = await supabase
      .from("briefs")
      .select("*")
      .order("created_at", { ascending: false });
    setBriefs(data || []);
    setLoading(false);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-gray-600">
          Archived link-docs. New brand briefs are created in the 14-section form.
        </p>
        <Link
          href="/dashboard/briefs/new"
          className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407]"
        >
          + New Brief
        </Link>
      </div>

      {/* Brief list */}
      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading...</div>
      ) : briefs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No archived briefs.</p>
          <Link
            href="/dashboard/briefs/new"
            className="text-[#D73F09] font-bold text-sm hover:underline"
          >
            Create a brand brief →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {briefs.map((brief) => (
            <div
              key={brief.id}
              className="relative p-6 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors group"
            >
              {brief.external_url ? (
                <a
                  href={brief.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-0"
                />
              ) : (
                <Link
                  href={`/dashboard/briefs/${brief.id}`}
                  className="absolute inset-0 z-0"
                />
              )}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {brief.client_name}
                </span>
                {/* Archive: no delete control — `briefs` is write-free. */}
                <span
                  className={`text-xs font-bold px-2 py-1 rounded ${
                    brief.external_url
                      ? "bg-blue-900/30 text-blue-400"
                      : brief.published
                      ? "bg-green-900/30 text-green-400"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {brief.external_url ? "External" : brief.published ? "Published" : "Draft"}
                </span>
              </div>
              <h3 className="text-lg font-black mb-2">{brief.title}</h3>
              <p className="text-xs text-gray-600">
                {new Date(brief.created_at).toLocaleDateString()}
                {brief.published && (
                  <span className="ml-2 text-[#D73F09]">/brief/{brief.slug}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
