// /admin/view-as/brand — no brand chosen: pick one from Brand portals.
import { redirect } from "next/navigation";

export default function ViewAsBrandIndex() {
  redirect("/admin/brand-portals");
}
