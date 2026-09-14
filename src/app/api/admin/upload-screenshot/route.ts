import { NextRequest, NextResponse } from "next/server";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const supabase = createLiveServiceSupabase();
  const body = await req.arrayBuffer();
  const name = req.nextUrl.searchParams.get("name") || "screenshot";
  const { error } = await supabase.storage.from("screenshots").upload(`${name}.jpg`, Buffer.from(body), { contentType: "image/jpeg", upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = supabase.storage.from("screenshots").getPublicUrl(`${name}.jpg`);
  return NextResponse.json({ url: data.publicUrl });
}
