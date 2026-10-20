// /admin/pay/vendor — old "Pay Vendor" form. The invoice form now lives
// on /admin/pay/invoices?tab=submit (and actually saves, once 083 lands).
import { redirect } from "next/navigation";

export default function PayVendorRedirect() {
  redirect("/admin/pay/invoices?tab=submit");
}
