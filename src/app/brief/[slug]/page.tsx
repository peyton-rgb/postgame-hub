export const dynamic = "force-dynamic";
export const revalidate = 0;
import { createPlainSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createPlainSupabase();
  const { data } = await supabase
    .from("briefs")
    .select("title, client_name")
    .eq("slug", params.slug)
    .single();

  return {
    title: data ? `${data.title} | ${data.client_name}` : "Brief Not Found",
  };
}

export default async function BriefPage({ params }: Props) {
  const supabase = createPlainSupabase();
  const { data: brief } = await supabase
    .from("briefs")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!brief || !brief.html_content) {
    notFound();
  }

  // Strip the embedded field data comment before rendering
  const cleanHtml = brief.html_content.replace(
    /<!--BRIEF_FIELDS:.*?-->/s,
    ""
  );

  return (
    <div className="min-h-screen bg-[#f5f0eb]">
      <iframe
        srcDoc={cleanHtml}
        className="w-full border-0"
        style={{ minHeight: "100vh" }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}
