// /admin/view-as — no mode chosen: the brand list is where "View as brand" starts.
import { redirect } from "next/navigation";

export default function ViewAsIndex() {
  redirect("/admin/brand-portals");
}
