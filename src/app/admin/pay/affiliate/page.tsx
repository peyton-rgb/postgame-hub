// /admin/pay/affiliate — old Affiliate Payments screen. Now the
// Affiliate balances tab of /admin/pay/bonus-affiliate
// (owed → balances, history → payout history, upload → monthly upload).
import { redirect } from "next/navigation";

export default function AffiliateRedirect({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const view = searchParams.tab === "history" ? "&sub=history" : searchParams.tab === "upload" ? "&sub=upload" : "";
  redirect(`/admin/pay/bonus-affiliate?tab=affiliate${view}`);
}
