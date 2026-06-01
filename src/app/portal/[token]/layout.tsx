import { createServiceSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { BG, OFFWHITE, pickBrandLogo } from "@/lib/portal";
import PortalNav from "./PortalNav";

// Private frame shared by every /portal/[token] route (home + media library).
// Renders the brand logo top-left and the tab nav, on the portal's dark
// background. The token gates everything: no brand match -> 404, and we never
// render another brand's logo. This layout persists across tab navigation, so
// the brand is fetched once. See page.tsx for why we use the service client.

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceSupabase();
  const { data: brand } = await supabase
    .from("brands")
    .select("name, logo_primary_url, logo_dark_url, logo_light_url, logo_white_url")
    .eq("portal_token", token)
    .single();

  if (!brand) notFound();

  const brandLogo = pickBrandLogo(brand);

  return (
    <div style={{ background: BG, color: OFFWHITE, minHeight: "100vh" }} className="w-full">
      <header className="mx-auto max-w-[1200px] px-6 pt-8 pb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={brand.name}
              className="h-9 w-auto max-w-[180px] object-contain object-left"
            />
          ) : (
            <span
              className="text-[15px] font-bold uppercase tracking-[2px] truncate"
              style={{ color: OFFWHITE }}
            >
              {brand.name}
            </span>
          )}
        </div>
        <PortalNav token={token} />
      </header>
      {children}
    </div>
  );
}
