// ============================================================
// /admin/view-as/athlete/[athleteId] — the athlete app as one app user
// sees it (prototype MODE = "athlete"): the shell stays, the left nav
// becomes the app's tabs, and each screen is the app in a phone frame.
//
// "Athlete" here means an app USER — profiles.access_level = 'athlete'
// — not a roster row in `athletes` or `people`. Read-only preview.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadAthleteOptions, loadBrandOptions, loadPreviewAthlete } from "@/lib/admin/view-as/queries";
import PreviewFrame from "@/components/admin/view-as/PreviewFrame";
import { initialsOf } from "@/components/admin/ops-bits";

export const dynamic = "force-dynamic";

export default async function AthletePreviewLayout({
  params,
  children,
}: {
  params: { athleteId: string };
  children: React.ReactNode;
}) {
  await requireAdmin("staff");
  const a = await loadPreviewAthlete(params.athleteId);
  if (!a) notFound();
  const [brands, athletes] = await Promise.all([loadBrandOptions(), loadAthleteOptions()]);
  const base = `/admin/view-as/athlete/${a.id}`;

  return (
    <PreviewFrame
      mode="athlete"
      brands={brands}
      athletes={athletes}
      athleteId={a.id}
      note={<>Preview of the Postgame app as {a.name} sees it. Read-only.</>}
      nav={{
        who: a.name,
        sub: [a.school, a.sport].filter(Boolean).join(" · ") || "Athlete",
        logo: a.avatarUrl,
        initials: initialsOf(a.name),
        items: [
          { href: base, label: "Home", icon: "home", exact: true },
          { href: `${base}/campaigns`, label: "Campaigns", icon: "mega" },
          { href: `${base}/deals`, label: "My deals", icon: "handshake" },
          { href: `${base}/submit`, label: "Submit content", icon: "inbox" },
          { href: `${base}/payments`, label: "Payments", icon: "dollar" },
          { href: `${base}/profile`, label: "Profile", icon: "user" },
        ],
        settings: { href: `${base}/profile?section=settings`, label: "Settings", icon: "cog", exact: true },
        footLine: `${a.igHandle ?? a.email ?? a.name} · Athlete`,
      }}
    >
      {children}
    </PreviewFrame>
  );
}
