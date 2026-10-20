// /admin/pay/bonus — old Bonus Payments screen. Now the Bonuses tab of
// /admin/pay/bonus-affiliate.
import { redirect } from "next/navigation";

export default function BonusRedirect() {
  redirect("/admin/pay/bonus-affiliate");
}
