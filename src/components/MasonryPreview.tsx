"use client";

import { CampaignRecap } from "./CampaignRecap";
import { Top50Recap } from "./Top50Recap";
import { detectCollabGroups } from "@/lib/csv-parser";
import type { Campaign, Athlete, Media } from "@/lib/types";

export function MasonryPreview({
  campaign,
  athletes,
  allAthletes,
  media,
  onBack,
  onPublish,
  publishing,
}: {
  campaign: Campaign;
  athletes: Athlete[];
  allAthletes?: Athlete[];
  media: Record<string, Media[]>;
  onBack: () => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  return (
    <div>
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-50 px-6 md:px-8 py-3 border-b border-gray-800 bg-black/95 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-700 rounded-lg text-sm font-bold text-white hover:border-gray-500"
          >
            ← Back to Editor
          </button>
          <span className="text-sm font-bold text-white/50">
            Preview &mdash; this is how clients will see it
          </span>
        </div>

        <div className="flex items-center gap-3">
          {campaign.published ? (
            <>
              <a
                href={`/recap/${campaign.slug}`}
                target="_blank"
                className="text-[#D73F09] text-sm font-bold hover:underline"
              >
                View Live →
              </a>
              <button
                onClick={onPublish}
                disabled={publishing}
                className="px-5 py-2 text-sm font-bold rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50"
              >
                {publishing ? "..." : "Unpublish"}
              </button>
            </>
          ) : (
            <button
              onClick={onPublish}
              disabled={publishing}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-500 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish Recap"}
            </button>
          )}
        </div>
      </div>

      {/* Exact same component the public page renders */}
      {campaign.settings?.campaign_type === "top_50" ? (
        <Top50Recap campaign={campaign} athletes={allAthletes || athletes} media={media} />
      ) : (
        <CampaignRecap
          campaign={campaign}
          athletes={athletes}
          allAthletes={allAthletes}
          media={media}
          collabGroups={detectCollabGroups<Athlete>(allAthletes || athletes, (a) => a.id).collabGroups}
        />
      )}
    </div>
  );
}
