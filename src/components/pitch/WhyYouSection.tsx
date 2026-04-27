import type { WhyYouSectionData } from "@/types/pitch";

/**
 * Personalized "WHY YOU, [FIRSTNAME]" section.
 *
 * Pulls the athlete's first name out of athleteName (split on whitespace,
 * take the first token) and uppercases it for the section heading.
 *
 * Renders an avatar (photo if athletePhotoUrl, otherwise initials in a
 * 64px circle), the athlete's name + optional subtitle, and a body
 * paragraph. Background tints slightly orange when `tinted` is true
 * (default).
 */
export default function WhyYouSection({ data }: { data: WhyYouSectionData }) {
  if (!data.visible) return null;

  const firstName = data.athleteName.trim().split(/\s+/)[0] ?? "";
  const headingFirstName = firstName.toUpperCase();
  const initials = getInitials(data.athleteName);

  const tinted = data.tinted !== false; // default true

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
      </div>

      <p className="pitch-why-you__body">{data.paragraph}</p>
    </section>
  );
}

function getInitials(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  return (tokens[0].charAt(0) + tokens[tokens.length - 1].charAt(0)).toUpperCase();
}
