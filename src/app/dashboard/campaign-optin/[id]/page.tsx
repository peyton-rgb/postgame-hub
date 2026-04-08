import { createServiceSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import OptInEditor from "@/components/OptInEditor";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OptInEditorPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServiceSupabase();

  const [{ data: campaign }, { data: brands }] = await Promise.all([
    supabase
      .from("optin_campaigns")
      .select("*, brands(id, name, logo_light_url, logo_url, primary_color)")
      .eq("id", id)
      .single(),
    supabase
      .from("brands")
      .select("id, name, logo_light_url, logo_url, primary_color")
      .eq("archived", false)
      .order("name"),
  ]);

  if (!campaign) notFound();

  return <OptInEditor initialCampaign={campaign as any} brands={(brands || []) as any} />;
}
