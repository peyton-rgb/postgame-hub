import { createServerSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { DynamicRunOfShowDetail } from "@/components/DynamicRunOfShow";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; city: string };
}): Promise<Metadata> {
  const supabase = createServerSupabase();

  const { data: ros } = await supabase
    .from("run_of_shows")
    .select("id, name, client_name")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!ros) return { title: "Run of Show | Postgame" };

  const { data: shoot } = await supabase
    .from("ros_shoots")
    .select("city, state, event_name")
    .eq("run_of_show_id", ros.id)
    .eq("slug", params.city)
    .single();

  if (!shoot) return { title: "Run of Show | Postgame" };

  return {
    title: `${shoot.city}, ${shoot.state} — ${shoot.event_name} | Postgame x ${ros.client_name}`,
    description: `Run of show for ${shoot.event_name} in ${shoot.city}, ${shoot.state}`,
  };
}

export default async function DynamicShootPage({
  params,
}: {
  params: { slug: string; city: string };
}) {
  const supabase = createServerSupabase();

  const { data: ros } = await supabase
    .from("run_of_shows")
    .select("*")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!ros) notFound();

  const { data: shoot } = await supabase
    .from("ros_shoots")
    .select("*")
    .eq("run_of_show_id", ros.id)
    .eq("slug", params.city)
    .single();

  if (!shoot) notFound();

  return <DynamicRunOfShowDetail ros={ros} shoot={shoot} />;
}
