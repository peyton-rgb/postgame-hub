// ============================================================
// The recap-readiness report body.
//
// Split from the cron route so it can be rendered and reviewed without running
// the route — the report is the deliverable, and a body you cannot look at
// before scheduling it is a body nobody proofreads.
//
// Plain text on purpose: a list of campaigns with links gains nothing from
// HTML and stays readable in any client.
// ============================================================

import { siteUrl } from "@/lib/site-url";
import type { ReadinessCheck } from "@/lib/recap-readiness";

/** The window the sweep reports on. */
export const WINDOW_DAYS = 120;

/** "3 files", "1 file". */
function files(n: number): string {
  return `${n} file${n === 1 ? "" : "s"}`;
}

/**
 * The report body. Plain text: it is a list of campaigns with links, which
 * gains nothing from HTML and stays readable in any client.
 */
export function renderReadinessEmail(checks: ReadinessCheck[]): { subject: string; text: string } {
  const ready = checks.filter((c) => c.ready);
  const notReady = checks.filter((c) => !c.ready);
  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const lines: string[] = [
    `Recap readiness — ${today}`,
    "",
    `${checks.length} delivered campaign${checks.length === 1 ? "" : "s"} in the last ${WINDOW_DAYS} days.`,
    `${ready.length} ready, ${notReady.length} not.`,
    "",
  ];

  lines.push(`READY (${ready.length})`);
  if (ready.length === 0) {
    lines.push("  none");
  } else {
    for (const c of ready) {
      const counts = [
        c.driveFileCount != null ? `${files(c.driveFileCount)} in Drive` : null,
        c.mediaCount > 0 ? `${c.mediaCount} media` : null,
        c.tier3Count > 0 ? `${c.tier3Count} submission${c.tier3Count === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      lines.push(`  ${c.clientName} · ${c.name}`);
      lines.push(`    ${counts.join(" · ")}`);
      lines.push(`    ${siteUrl()}/dashboard/${c.recapId}`);
    }
  }

  lines.push("");
  lines.push(`NOT READY (${notReady.length})`);
  if (notReady.length === 0) {
    lines.push("  none");
  } else {
    for (const c of notReady) {
      lines.push(`  ${c.clientName} · ${c.name}`);
      lines.push(`    missing: ${c.missing.join("; ")}`);
      lines.push(`    ${siteUrl()}/dashboard/${c.recapId}`);
    }
  }

  lines.push("");
  lines.push("Ready means the campaign has files in its Drive content folder or media rows in the Hub.");
  lines.push("A tracker sheet and brief doc are reported but do not decide readiness.");

  return { subject: `Recap readiness — ${today}`, text: lines.join("\n") };
}

