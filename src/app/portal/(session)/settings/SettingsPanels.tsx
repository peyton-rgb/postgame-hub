import { TileEmpty } from "@/components/portal/PortalShell";
import { resolveBrandLogo, type BrandLogoRow } from "@/lib/brand-logo";
import type { SettingsData } from "@/lib/portal/pages-data";
import SignOutButton from "./SignOutButton";

// The Settings body, extracted so the page and the render harness draw the
// SAME markup. They had drifted: the harness carried an abridged copy with no
// empty state on "Your team" and no Session panel, which made the review
// screenshot show a bare heading over nothing and hide sign-out entirely.
// One component, one truth.

const TOGGLES = [
  "Email me when content is ready to review",
  "Email me when posts go live",
  "Email me when a recap is delivered",
];

export default function SettingsPanels({ data }: { data: SettingsData }) {
  // Hard rule 2: the client logo comes from brand_logos, on the variant for a
  // dark ground. No file means a labelled empty slot, never an approximation.
  const logo = resolveBrandLogo(data.logos as BrandLogoRow[], {
    surface: "dark",
    prefer: "lockup",
  });

  return (
    <div className="pgd-page">
      <section className="pgd-panel">
        <h3>Your team</h3>
        {data.team.length === 0 ? (
          <TileEmpty
            line="No team members yet"
            note="Your Postgame contact adds people who can sign in here."
          />
        ) : (
          <div className="pgd-rows">
            {data.team.map((t) => (
              <div className="pgd-row" key={t.id}>
                <span className="pgd-row-main">
                  {/* Never a placeholder name: if the identity row carries no
                      name we show the address, which is a real fact. */}
                  <b>{t.name || t.email || "Invited"}</b>
                  {t.name && t.email ? <span>{t.email}</span> : null}
                </span>
                {/* Role and status as plain words, not pills. Two chips per
                    row on a five-row list was ten boxes saying two things. */}
                {t.role ? <span className="pgd-row-note">{t.role}</span> : null}
                <span className="pgd-row-note">{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pgd-panel">
        <h3>Brand logo</h3>
        {logo?.url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.url}
              alt=""
              style={{ height: 30, width: "auto", objectFit: "contain" }}
            />
            <span className="pgd-card-meta">
              On file for dark backgrounds. Managed by Postgame.
            </span>
          </div>
        ) : (
          <TileEmpty
            line="No logo on file for dark backgrounds"
            note="Send your logo to your Postgame contact and it will appear here."
          />
        )}
      </section>

      <section className="pgd-panel">
        <h3>Notifications</h3>
        <div className="pgd-rows">
          {TOGGLES.map((label) => (
            <div className="pgd-row" key={label}>
              <span className="pgd-row-main">
                <b style={{ fontWeight: 400, color: "rgba(250,248,245,.68)" }}>{label}</b>
              </span>
              <span className="pgd-row-note">Coming soon</span>
              <input type="checkbox" disabled aria-label={label} />
            </div>
          ))}
        </div>
      </section>

      <section className="pgd-panel">
        <h3>Session</h3>
        <SignOutButton />
      </section>
    </div>
  );
}
