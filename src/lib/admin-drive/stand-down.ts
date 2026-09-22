// ============================================================
// The stand-down switch for the Hub's own Drive provisioning.
//
// Brief 15 ends with two systems able to create the same folders: the Hub's
// nightly /api/sync/drive-folders sweep, and the admin, which now provisions at
// campaign-creation time and hands the ids over. Both running is how a campaign
// ends up with two trees and the Hub pointing at the wrong one — the exact
// failure the 409 rule exists to make visible.
//
// ARMED, NOT PULLED. The default is OFF: provisioning keeps running exactly as
// it does today. Nothing about this PR changes live behaviour. The switch is
// here so that the day the admin's provisioning is trusted end to end, standing
// the Hub down is an environment variable and not a deploy.
//
// It is deliberately NOT flipped in this PR. The admin side has not yet run a
// full campaign through in production, and turning the Hub's sweep off before
// that would leave new campaigns with no folders at all if the handoff failed
// quietly — swapping a visible duplicate for an invisible absence.
// ============================================================

/** Values read as "yes". Anything else, including unset, is no. */
const TRUTHY = new Set(["1", "true", "yes", "on"]);

/**
 * True when the admin owns Drive provisioning and the Hub should not create
 * brand or campaign folders itself.
 *
 * Reads the environment on every call rather than caching at module load: a
 * Vercel env change takes effect on the next invocation, and a cached value
 * would keep a stood-down sweep running until something redeployed.
 */
export function hubProvisioningStoodDown(): boolean {
  const raw = (process.env.ADMIN_OWNS_DRIVE_PROVISIONING ?? "").trim().toLowerCase();
  return TRUTHY.has(raw);
}

/** What the sweep reports when it declines to run. */
export function standDownReport() {
  return {
    ok: true,
    stood_down: true,
    detail:
      "ADMIN_OWNS_DRIVE_PROVISIONING is set: the admin provisions Drive folders and hands the ids to /api/admin-drive/*. The Hub's own provisioning sweep did not run and created nothing.",
    provisioned: 0,
    skipped: [],
  };
}
