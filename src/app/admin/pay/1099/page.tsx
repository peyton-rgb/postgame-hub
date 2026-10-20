// /admin/pay/1099 — old 1099 Report. Now the "1099 report" tab of
// /admin/pay/history. The CSV route at /admin/pay/1099/export stays.
import { redirect } from "next/navigation";

export default function Report1099Redirect({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const year = /^\d{4}$/.test(searchParams.year ?? "") ? `&year=${searchParams.year}` : "";
  redirect(`/admin/pay/history?tab=1099${year}`);
}
