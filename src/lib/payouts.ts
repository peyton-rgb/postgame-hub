// ============================================================
// Payouts — created when a deal is fully verified.
//
// Phase 4 placeholder: real payout-record creation + the 30-day schedule and
// the (stubbed) PayPal execution land in Phase 5 along with the payouts
// table. Kept as a safe no-op so verification works before that migration.
// ============================================================

// Create a pending payout for a fully-verified opt-in. Implemented in Phase 5.
export async function createPendingPayout(_optinId: string): Promise<void> {
  // TODO(Phase 5): insert a row into the payouts table with status 'pending'
  // and scheduled_for = now() + 30 days, then surface it on the earnings
  // screen. No real money moves — PayPal execution stays stubbed.
  return;
}
