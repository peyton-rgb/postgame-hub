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
                  {h.followers ? `${h.followers} ` : ""}
                  {platformShortLabel(h.platform)}
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

        {/* ============== RECENT + BY THE NUMBERS ============== */}
        {(data.highlights && data.highlights.length > 0) ||
        followerSum.parsedCount >= 2 ||
        (data.socialStats && data.socialStats.length > 0) ? (
          <div className="pitch-why-you__body-grid">
            {data.highlights && data.highlights.length > 0 ? (
              <div className="pitch-why-you__highlights-col">
                <div className="pitch-why-you__block-label">RECENT</div>
                <ol className="pitch-why-you__highlights-numbered">
                  {data.highlights.map((h, i) => (
                    <li key={i}>
                      <span className="pitch-why-you__highlight-num">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="pitch-why-you__highlight-text">{h}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div />
            )}

            <div className="pitch-why-you__stats-col">
              <div className="pitch-why-you__block-label">BY THE NUMBERS</div>
              <div className="pitch-why-you__stat-tiles">
                {/* Auto-summed combined followers — only when 2+ handles
                    contributed to the sum (otherwise it's just a single
                    handle's number repeated). */}
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
          </div>
        ) : null}

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

// Short label for the in-banner badges (e.g. "TT", "IG", "YT", "X").
function platformShortLabel(p: string): string {
  switch (p) {
    case "instagram":
      return "IG";
    case "twitter":
      return "X";
    case "tiktok":
      return "TT";
    case "youtube":
      return "YT";
    default:
      return p.toUpperCase();
  }
}

function getInitials(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  return (tokens[0].charAt(0) + tokens[tokens.length - 1].charAt(0)).toUpperCase();
}
