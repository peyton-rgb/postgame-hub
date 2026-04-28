import type { WhyYouSectionData } from "@/types/pitch";
import CampaignCarousel from "@/components/pitch/CampaignCarousel";

/**
 * Personalized "WHY YOU, [FIRSTNAME]" section.
 *
 * Renders an athlete profile with:
 *  - Section label "WHY YOU, FIRSTNAME"
 *  - Athlete header (large avatar + optional school logo + name + meta)
 *  - Social-icon row — outline platform logos in Postgame orange,
 *    follower count below each, clickable
 *  - Multi-paragraph bio
 *  - Optional pull quote
 *  - Optional recent-highlights list
 *  - Optional 3-stat row (followers / engagement / reach)
 *  - Optional upcoming-campaigns list
 */
export default function WhyYouSection({ data }: { data: WhyYouSectionData }) {
  if (!data.visible) return null;

  const firstName = data.athleteName.trim().split(/\s+/)[0] ?? "";
  const headingFirstName = firstName.toUpperCase();
  const initials = getInitials(data.athleteName);
  const tinted = data.tinted !== false;

  // Display name. If a nickname is provided, render "Legal / Nickname".
  const displayName = data.nickname
    ? `${data.athleteName} / ${data.nickname}`
    : data.athleteName;

  // Prefer paragraphs[]; fall back to single paragraph.
  const bodyParagraphs: string[] =
    data.paragraphs && data.paragraphs.length > 0
      ? data.paragraphs
      : data.paragraph
      ? [data.paragraph]
      : [];

  return (
    <section
      className={`pitch-why-you wrap ${tinted ? "pitch-why-you--tinted" : ""}`}
    >
      <div className="pitch-why-you__label">
        WHY YOU{headingFirstName ? `, ${headingFirstName}` : ""}
      </div>

      <div className="pitch-why-you__head">
        <div className="pitch-why-you__avatar">
          {data.athletePhotoUrl ? (
            <img src={data.athletePhotoUrl} alt={data.athleteName} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="pitch-why-you__name-block">
          <div className="pitch-why-you__name">{displayName}</div>
          {data.athleteSubtitle ? (
            <div className="pitch-why-you__subtitle">
              {data.athleteSubtitle}
            </div>
          ) : null}
          {(data.position || data.classYear || data.hometown) && (
            <div className="pitch-why-you__meta">
              {[data.position, data.classYear, data.hometown]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
        {data.schoolLogoUrl ? (
          <img
            className="pitch-why-you__school"
            src={data.schoolLogoUrl}
            alt="School logo"
          />
        ) : null}
      </div>

      {data.socialHandles && data.socialHandles.length > 0 ? (
        <div className="pitch-why-you__handles">
          {data.socialHandles.map((h, i) => (
            <a
              key={i}
              className="pitch-why-you__handle"
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${platformLabel(h.platform)} — @${h.handle}${h.followers ? `, ${h.followers} followers` : ""}`}
            >
              <span className="pitch-why-you__handle-icon">
                <PlatformIcon platform={h.platform} />
              </span>
              {h.followers ? (
                <span className="pitch-why-you__handle-followers">
                  {h.followers}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}

      {bodyParagraphs.length > 0 ? (
        <div className="pitch-why-you__body">
          {bodyParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}

      {data.quote ? (
        <blockquote className="pitch-why-you__quote">{data.quote}</blockquote>
      ) : null}

      {data.highlights && data.highlights.length > 0 ? (
        <div className="pitch-why-you__highlights">
          <div className="pitch-why-you__highlights-label">RECENT HIGHLIGHTS</div>
          <ul className="pitch-why-you__highlights-list">
            {data.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.socialStats && data.socialStats.length > 0 ? (
        <div className="pitch-why-you__stats">
          {data.socialStats.map((s, i) => (
            <div className="pitch-why-you__stat" key={i}>
              <div className="pitch-why-you__stat-value">{s.value}</div>
              <div className="pitch-why-you__stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {data.upcomingCampaigns && data.upcomingCampaigns.length > 0 ? (
        <div className="pitch-why-you__campaigns">
          <div className="pitch-why-you__campaigns-label">
            HERE&apos;S WHAT WE&apos;D LINE UP
          </div>
          <CampaignCarousel campaigns={data.upcomingCampaigns} />
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------
// Platform icons — outline SVGs that take their color from currentColor
// (set to Postgame orange via CSS on the parent). Small enough to be
// inlined here so we don't pull in an icon library for four glyphs.
// ---------------------------------------------------------------------

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "instagram":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 4c0 2.8 2.2 5 5 5" />
        </svg>
      );
    case "youtube":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2.5" y="6" width="19" height="12" rx="3" />
          <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" />
        </svg>
      );
    case "twitter":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l16 16" />
          <path d="M20 4L4 20" />
        </svg>
      );
    default:
      return null;
  }
}

function platformLabel(p: string): string {
  switch (p) {
    case "instagram":
      return "Instagram";
    case "twitter":
      return "X";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
    default:
      return p;
  }
}

function getInitials(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  return (tokens[0].charAt(0) + tokens[tokens.length - 1].charAt(0)).toUpperCase();
}
