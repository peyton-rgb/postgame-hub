import { createPlainSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import OptInLanding from "@/components/OptInLanding";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPlainSupabase();
  const { data: campaign } = await supabase
    .from("optin_campaigns")
    .select("title, brands(name)")
    .eq("slug", slug)
    .eq("status", "live")
    .single();

  if (!campaign) return { title: "Opt-In · Postgame" };

  const brandName = (campaign as any).brands?.name || "";
  return {
    title: `${campaign.title} · ${brandName} · Postgame`,
    description: `New NIL opportunity from ${brandName}. Tap to opt in.`,
  };
}

export default async function OptInPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createPlainSupabase();

  const { data: campaign, error } = await supabase
    .from("optin_campaigns")
    .select(
      "*, brands(id, name, logo_light_url, logo_url, primary_color)"
    )
    .eq("slug", slug)
    .eq("status", "live")
    .single();

  if (error || !campaign) notFound();

  return <OptInLanding campaign={campaign as any} />;
}
