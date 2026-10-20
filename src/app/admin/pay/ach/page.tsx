// /admin/pay/ach — old ACH / Wire / Zelle queue + history. It's the
// "ACH / Wire / Zelle" method filter on /admin/pay/athletes now.
import { redirect } from "next/navigation";

export default function AchRedirect({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  redirect(searchParams.tab === "history" ? "/admin/pay/athletes?tab=all&method=bank" : "/admin/pay/athletes?method=bank");
}
