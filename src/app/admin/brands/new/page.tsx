// ============================================================
// /admin/brands/new — Add brand (the Lovable "New account" dialog,
// as its own page): name, industry, website. Creates the brands row
// and opens the brand detail page.
//
// Logos, colours and fonts are not set here — they belong to the
// brand-kit flow, and a logo is never typed in as text.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { createBrand } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBrandPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");

  const input = "mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900";

  return (
    <div className="max-w-lg">
      <div className="pb-1 text-[12px] text-stone-500">
        <Link href="/admin/brands" className="hover:text-stone-900">
          Brands
        </Link>
      </div>
      <PageHeader title="Add brand" subtitle="Name is required. Everything else can be filled in later." />

      {searchParams.result === "name-required" && <ErrorNote message="Brand name is required." />}
      {searchParams.result === "bad-website" && (
        <ErrorNote message="Website must be a full http:// or https:// address. Nothing was saved." />
      )}
      {searchParams.result === "error" && <ErrorNote message="Could not create the brand. Nothing was saved." />}

      <form action={createBrand} className="mt-2 space-y-4 rounded-lg border border-stone-200 bg-white p-5">
        <label className="block text-[12px] font-medium text-stone-600">
          Brand name
          <input name="name" required placeholder="e.g. adidas" className={input} />
        </label>
        <label className="block text-[12px] font-medium text-stone-600">
          Industry
          <input name="industry" placeholder="e.g. Apparel" className={input} />
        </label>
        <label className="block text-[12px] font-medium text-stone-600">
          Website
          <input name="website" type="url" placeholder="https://" className={input} />
        </label>
        <p className="text-[12px] leading-5 text-stone-500">
          Logos, colours and fonts are added from the brand kit, not here.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Link href="/admin/brands" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700">
            Cancel
          </Link>
          <button type="submit" className="rounded-md bg-[#D73F09] px-4 py-1.5 text-[13px] font-medium text-white">
            Create brand
          </button>
        </div>
      </form>
    </div>
  );
}
