import { redirect } from "next/navigation";

// /admin/feed → the first Social tab.
export default function FeedIndex() {
  redirect("/admin/feed/postgame");
}
