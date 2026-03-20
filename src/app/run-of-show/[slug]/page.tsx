import { createPlainSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

// Dynamic page for a Run of Show campaign index (e.g. /run-of-show/raising-canes-st-patricks-day-2026)
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = createPlainSupabase();
  const { data: ros } = await supabase
    .from("run_of_shows")
    .select("name, client_name, event_name")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!ros) return { title: "Run of Show | Postgame" };

  return {
    title: `${ros.event_name || ros.name} — Run of Shows | Postgame x ${ros.client_name}`,
    description: `Run of show documents for ${ros.client_name} — ${ros.event_name || ros.name}`,
  };
}

export default async function DynamicRunOfShowIndex({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createPlainSupabase();

  const { data: ros } = await supabase
    .from("run_of_shows")
    .select("*")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!ros) notFound();

  const { data: shoots } = await supabase
    .from("ros_shoots")
    .select("*")
    .eq("run_of_show_id", ros.id)
    .order("sort_order");

  const shootList = shoots || [];

  return (
    <div className="min-h-screen bg-[#f5f5f4] text-gray-900">
      {/* Header */}
      <div className="border-b border-[#222] bg-black">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-center">
          <Image
            src="/postgame-logo.png"
            alt="Postgame"
            width={150}
            height={31}
            priority
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Title */}
        <div className="text-center mb-10">
          {ros.client_logo_url && (
            <div className="flex items-center justify-center mb-4">
              <Image
                src={ros.client_logo_url}
                alt={ros.client_name}
                width={120}
                height={120}
                className="object-contain"
              />
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-black mb-2 text-gray-900">
            {ros.event_name || ros.name}
          </h1>
          {ros.subtitle && <p className="text-gray-500">{ros.subtitle}</p>}
        </div>

        {/* Shoot Cards */}
        <div className="space-y-3">
          {shootList.map((shoot: any) => (
            <Link
              key={shoot.id}
              href={`/run-of-show/${ros.slug}/${shoot.slug}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-[#D73F09] transition-colors group"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-bold text-lg text-gray-900 group-hover:text-[#D73F09] transition-colors">
                      {shoot.city}, {shoot.state}
                    </h2>
                    {shoot.type_label && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {shoot.type_label}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {shoot.event_name}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Date
                    </div>
                    <div className="text-gray-700">{shoot.date}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Start
                    </div>
                    <div className="text-gray-700">
                      {shoot.event_start_time}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Videographer
                    </div>
                    <div className="text-gray-700">{shoot.videographer}</div>
                  </div>
                  <div className="text-gray-300 group-hover:text-[#D73F09] transition-colors">
                    →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center pt-10 mt-10 border-t border-gray-200">
          <Image
            src="/postgame-logo-black.png"
            alt="Postgame"
            width={130}
            height={28}
            className="mb-2"
          />
          <div className="text-xs text-gray-400">
            {ros.client_name} — {ros.event_name || ros.name}
          </div>
        </div>
      </div>
    </div>
  );
}
