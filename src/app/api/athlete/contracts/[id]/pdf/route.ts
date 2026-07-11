// GET /api/athlete/contracts/[id]/pdf
//
// Mints a short-lived signed Storage URL for a contract PDF and redirects to
// it. On-demand (only when the athlete taps VIEW PDF), so we never generate
// URLs that expire before use. Ownership is enforced two ways: the athlete
// must be logged in (cookie session) AND the contract row's athlete_id must
// match them — the service client is used only to read the storage path and
// sign the object, never to widen who can see what.
//
// Storage-path convention: `pdf_storage_path` is "<bucket>/<object/path.pdf>".
// The planner seeds it that way; if no bucket prefix is present we fall back to
// the private `contracts` bucket. (That bucket must exist — see PR setup note.)

import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";

const DEFAULT_BUCKET = "contracts";
const SIGNED_TTL_SECONDS = 60;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { data: contract, error } = await service
    .from("contracts")
    .select("athlete_id,pdf_storage_path")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Couldn't load contract." }, { status: 500 });
  }
  // Same 404 for "not found" and "not yours" so we don't leak which ids exist.
  if (!contract || contract.athlete_id !== user.id || !contract.pdf_storage_path) {
    return NextResponse.json({ error: "Contract not found." }, { status: 404 });
  }

  const raw: string = contract.pdf_storage_path;
  const slash = raw.indexOf("/");
  const bucket = slash > 0 ? raw.slice(0, slash) : DEFAULT_BUCKET;
  const objectPath = slash > 0 ? raw.slice(slash + 1) : raw;

  const { data: signed, error: signErr } = await service.storage
    .from(bucket)
    .createSignedUrl(objectPath, SIGNED_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "Couldn't open the PDF." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
