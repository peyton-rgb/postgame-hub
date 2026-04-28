import type { WhyYouSectionData } from "@/types/pitch";

/**
 * Personalized "WHY YOU, [FIRSTNAME]" section.
 *
 * Renders an athlete profile with:
 *  - Section label "WHY YOU, FIRSTNAME"
 *  - Athlete header (avatar circle + optional school logo + name + subtitle)
 *  - Body bio (multi-paragraph if `paragraphs`, falls back to single
 *    `paragraph` for backwards compat)
 *  - Optional social/audience stats row (followers / engagement / views)
 *  - Optional upcoming-campaigns list ("HERE'S WHAT WE'D LINE UP")
 */
export default function WhyYouSection({ data }: { data: WhyYouSectionData }) {
  if (!data.visible) return null;

  const firstName = data.athleteName.trim().split(/\s+/)[0] ?? "";
  const headingFirstName = firstName.toUpperCase();
  const initials = getInitials(data.athleteName);

  const tinted = data.tinted !== false;

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
          <div className="pitch-why-you__name">{data.athleteName}</div>
          {data.athleteSubtitle ? (
            <div className="pitch-why-you__subtitle">
              {data.athleteSubtitle}
            </div>
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

      {bodyParagraphs.length > 0 ? (
        <div className="pitch-why-you__body">
          {bodyParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
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
          <div className="pitch-why-you__campaigns-list">
            {data.upcomingCampaigns.map((c, i) => (
              <article className="pitch-why-you__campaign" key={i}>
                <div className="pitch-why-you__campaign-title">{c.title}</div>
                {c.subtitle ? (
                  <div className="pitch-why-you__campaign-sub">
                    {c.subtitle}
                  </div>
                ) : null}
                {c.description ? (
                  <p className="pitch-why-you__campaign-desc">
                    {c.description}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getInitials(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  return (tokens[0].charAt(0) + tokens[tokens.length - 1].charAt(0)).toUpperCase();
}
