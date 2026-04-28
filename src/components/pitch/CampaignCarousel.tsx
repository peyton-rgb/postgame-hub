import type { WhyYouUpcomingCampaign } from "@/types/pitch";

/**
 * Velocity scroller for the WhyYou section's "what we'd line up" block.
 *
 * Renders the brand logos in a continuously scrolling horizontal track
 * with no card chrome — logos float on the page background. The track
 * loops seamlessly via CSS animation (cards array is doubled and the
 * keyframe runs from translateX(0) to translateX(-50%)).
 *
 * The viewport has a CSS mask that fades the left and right edges to
 * transparent so logos appear/disappear smoothly as they scroll past.
 */
export default function CampaignCarousel({
  campaigns,
}: {
  campaigns: WhyYouUpcomingCampaign[];
}) {
  if (!campaigns || campaigns.length === 0) return null;
  // Duplicate the list so the keyframe -50% lands cleanly on the
  // boundary between original and copy — perfectly seamless loop.
  const doubled = [...campaigns, ...campaigns];

  return (
    <div className="campaign-velocity" aria-hidden="true">
      <div className="campaign-velocity__viewport">
        <div className="campaign-velocity__track">
          {doubled.map((c, i) => (
            <div className="campaign-velocity__item" key={i}>
              {c.logoUrl ? (
                <img
                  className="campaign-velocity__logo"
                  src={c.logoUrl}
                  alt={c.title}
                />
              ) : (
                <div className="campaign-velocity__logo-fallback">
                  {c.title}
                </div>
              )}
              <div className="campaign-velocity__name">{c.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
