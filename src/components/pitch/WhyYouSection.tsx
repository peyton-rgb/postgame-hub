import type { WhyYouSectionData } from "@/types/pitch";
import CampaignCarousel from "@/components/pitch/CampaignCarousel";
import { sumFollowerCounts } from "@/lib/pitch/socialFormat";

/**
 * Personalized "WHY YOU, [FIRSTNAME]" section — magazine-cover redesign.
 *
 * Layout, top to bottom:
 *
 *  1. HERO BANNER — wide photo (or gradient fallback) with:
 *     - PROFILE / 01 label, top-left
 *     - Up-to-4 social-handle badges, top-right
 *     - Profile circle hanging off the banner's bottom edge
 *     - Name + nickname + meta line, anchored next to the circle
 *
 *  2. THE OPENING — first bio paragraph rendered as a feature lead.
 *
 *  3. RECENT + BY THE NUMBERS — two-column block:
 *     - Left: numbered highlights (01, 02, 03 …)
 *     - Right: stat tiles (auto-summed combined followers + any
 *       socialStats entries already on the section data)
 *
 *  4. PULL QUOTE — orange-bordered editorial block. Optional.
 *
 *  5. THE PITCH — remaining bio paragraphs as standard body copy.
 *
 *  6. WHAT WE'D LINE UP — campaigns carousel.
 */
export default function WhyYouSection({ data }: { data: WhyYouSectionData }) {
  if (!data.visible) return null;

  const firstName = data.athleteName.trim().split(/\s+/)[0] ?? "";
  const headingFirstName = firstName.toUpperCase();
  const initials = getInitials(data.athleteName);

  // Display name. If a nickname is provided, render "Legal / Nickname".
  const displayName = data.nickname
    ? `${data.athleteName} / ${data.nickname}`
    : data.athleteName;

  // Bio paragraphs — split into "opening" (first) and "the pitch" (rest).
  const allParagraphs: string[] =
    data.paragraphs && data.paragraphs.length > 0
      ? data.paragraphs
      : data.paragraph
      ? [data.paragraph]
      : [];
  const openingParagraph = allParagraphs[0] ?? "";
  const pitchParagraphs = allParagraphs.slice(1);

  // Compose meta line for the nameblock (e.g. "WR · FRESHMAN · RALEIGH, NC")
  const metaParts = [data.position, data.classYear, data.hometown].filter(
    Boolean,
  );

  // Auto-summed combined followers across all parseable handles.
  const followerSum = sumFollowerCounts(data.socialHandles);

  // Background style for the hero banner — image when provided, otherwise
  // the dark crimson-to-black gradient used in the mockup.
  const bannerStyle: React.CSSProperties = data.bannerImageUrl
    ? {
        backgroundImage: `url(${data.bannerImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {};

  return (
    <section className="pitch-why-you wrap">
      <div className="pitch-why-you__card">
        {/* ============== HERO BANNER ============== */}
        <div
          className={`pitch-why-you__hero ${
            data.bannerImageUrl ? "pitch-why-you__hero--photo" : "pitch-why-you__hero--gradient"
          }`}
          style={bannerStyle}
        >
          <div className="pitch-why-you__hero-overlay" />
          <div className="pitch-why-you__label">
            WHY YOU{headingFirstName ? `, ${headingFirstName}` : ""}
          </div>
          {data.socialHandles && data.socialHandles.length > 0 ? (
            <div className="pitch-why-you__hero-badges">
              {data.socialHandles.slice(0, 4).map((h, i) => (
                <a
                  key={i}
                  className="pitch-why-you__hero-badge"
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${platformLabel(h.platform)} — ${h.followers ?? "follow"}`}
                >
                  <span className="pitch-why-you__hero-badge-icon">
                    <PlatformIcon platform={h.platform} />
                  </span>
                  {h.followers ? (
                    <span className="pitch-why-you__hero-badge-count">
                      {h.followers}
                    </span>
                  ) : null}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {/* ============== PROFILE + NAMEBLOCK ============== */}
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
            {metaParts.length > 0 ? (
              <div className="pitch-why-you__meta">{metaParts.join(" · ")}</div>
            ) : null}
          </div>
          {data.schoolLogoUrl ? (
            <img
              className="pitch-why-you__school"
              src={data.schoolLogoUrl}
              alt="School logo"
            />
          ) : null}
        </div>

        {/* ============== THE OPENING ============== */}
        {openingParagraph ? (
          <div className="pitch-why-you__block">
            <div className="pitch-why-you__block-label">THE OPENING</div>
            <p className="pitch-why-you__lead">{openingParagraph}</p>
          </div>
        ) : null}

        {/* ============== RECENT + BY THE NUMBERS ==============
            Layout switches based on what data is present:
              - Both highlights AND stats → 2-column grid
              - Only stats              → full-width horizontal strip
              - Only highlights         → full-width single column
              - Neither                 → nothing rendered  */}
        {(() => {
          const hasHighlights =
            !!data.highlights && data.highlights.length > 0;
          const hasStats =
            followerSum.parsedCount >= 2 ||
            !!(data.socialStats && data.socialStats.length > 0);
          if (!hasHighlights && !hasStats) return null;

          const statTiles = (
            <div className="pitch-why-you__stat-tiles">
              {followerSum.parsedCount >= 2 ? (
                <div className="pitch-why-you__stat-tile pitch-why-you__stat-tile--accent">
                  <div className="pitch-why-you__stat-value">
                    {followerSum.formatted}
                  </div>
                  <div className="pitch-why-you__stat-label">
                    Combined followers
                  </div>
                </div>
              ) : null}
              {(data.socialStats ?? []).map((s, i) => (
                <div className="pitch-why-you__stat-tile" key={i}>
                  <div className="pitch-why-you__stat-value">{s.value}</div>
                  <div className="pitch-why-you__stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          );

          // Two-column layout when both sides have content.
          if (hasHighlights && hasStats) {
            return (
              <div className="pitch-why-you__body-grid">
                <div className="pitch-why-you__highlights-col">
                  <div className="pitch-why-you__block-label">RECENT</div>
                  <ol className="pitch-why-you__highlights-numbered">
                    {data.highlights!.map((h, i) => (
                      <li key={i}>
                        <span className="pitch-why-you__highlight-num">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="pitch-why-you__highlight-text">
                          {h}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="pitch-why-you__stats-col">
                  <div className="pitch-why-you__block-label">
                    BY THE NUMBERS
                  </div>
                  {statTiles}
                </div>
              </div>
            );
          }

          // Stats only → full-width horizontal strip (tiles in a row).
          if (hasStats) {
            return (
              <div className="pitch-why-you__numbers-strip">
                <div className="pitch-why-you__block-label">
                  BY THE NUMBERS
                </div>
                <div className="pitch-why-you__stat-tiles pitch-why-you__stat-tiles--row">
                  {followerSum.parsedCount >= 2 ? (
                    <div className="pitch-why-you__stat-tile pitch-why-you__stat-tile--accent">
                      <div className="pitch-why-you__stat-value">
                        {followerSum.formatted}
                      </div>
                      <div className="pitch-why-you__stat-label">
                        Combined followers
                      </div>
                    </div>
                  ) : null}
                  {(data.socialStats ?? []).map((s, i) => (
                    <div className="pitch-why-you__stat-tile" key={i}>
                      <div className="pitch-why-you__stat-value">{s.value}</div>
                      <div className="pitch-why-you__stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // Highlights only → full-width single column.
          return (
            <div className="pitch-why-you__numbers-strip">
              <div className="pitch-why-you__block-label">RECENT</div>
              <ol className="pitch-why-you__highlights-numbered">
                {data.highlights!.map((h, i) => (
                  <li key={i}>
                    <span className="pitch-why-you__highlight-num">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="pitch-why-you__highlight-text">{h}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })()}

        {/* ============== PULL QUOTE ============== */}
        {data.quote ? (
          <blockquote className="pitch-why-you__quote">
            <span className="pitch-why-you__quote-text">{data.quote}</span>
          </blockquote>
        ) : null}

        {/* ============== THE PITCH ============== */}
        {pitchParagraphs.length > 0 ? (
          <div className="pitch-why-you__block">
            <div className="pitch-why-you__block-label">THE PITCH</div>
            <div className="pitch-why-you__body">
              {pitchParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        ) : null}

        {/* ============== WHAT WE'D LINE UP ============== */}
        {data.upcomingCampaigns && data.upcomingCampaigns.length > 0 ? (
          <div className="pitch-why-you__campaigns">
            <div className="pitch-why-you__block-label">
              WHAT WE&apos;D LINE UP
            </div>
            <CampaignCarousel campaigns={data.upcomingCampaigns} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

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

// Outline platform glyphs sized to fit inside the hero badges.
// They take their color from `currentColor` (set on the badge wrapper),
// so a single SVG works on both light and dark accent backgrounds.
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

function getInitials(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  return (tokens[0].charAt(0) + tokens[tokens.length - 1].charAt(0)).toUpperCase();
}
