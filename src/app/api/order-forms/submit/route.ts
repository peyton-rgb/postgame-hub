// POST /api/order-forms/submit
// The athlete order page sends its answers here. This route finds the right Google Sheet
// for that form, forwards the order to the Sheet's Apps Script, and only reports success
// once the Sheet confirms it saved the row — so an athlete never sees "Order received"
// for an order that didn't land.
// Public on purpose (athletes aren't logged in) — middleware must let it through.
import { NextResponse } from "next/server";
import { ORDER_FORMS } from "@/lib/order-forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED = ["first_name", "last_name", "instagram", "school", "gender", "outfit", "street", "city", "state", "zip"];
const MAX_BYTES = 10_000;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return fail(413, "Too large");

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return fail(400, "Bad request"); }

  const form = ORDER_FORMS.find((f) => f.slug === body.form);
  if (!form) return fail(404, "Unknown order form");
  if (form.status !== "live") return fail(410, "This order form is closed");

  const missing = REQUIRED.filter((k) => !String(body[k] ?? "").trim());
  if (missing.length) return fail(400, `Missing: ${missing.join(", ")}`);

  const sheetUrl = process.env[form.sheetEnv];
  if (!sheetUrl) {
    console.error(`[order-forms] ${form.sheetEnv} is not set`);
    return fail(500, "Order form isn't connected yet");
  }

  const { form: _slug, ...row } = body;
  try {
    // Apps Script answers with a redirect to the real response; fetch follows it.
    const res = await fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(row),
      redirect: "follow",
      cache: "no-store",
    });
    const text = await res.text();
    let out: { ok?: boolean; error?: string } | null = null;
    try { out = JSON.parse(text); } catch { /* not JSON = Apps Script error page */ }
    if (!res.ok || !out?.ok) {
      console.error(`[order-forms] sheet write failed for ${form.slug}`, res.status, out?.error ?? text.slice(0, 300));
      return fail(502, "Couldn't save the order");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[order-forms] sheet unreachable for ${form.slug}`, e);
    return fail(502, "Couldn't reach the order sheet");
  }
}
