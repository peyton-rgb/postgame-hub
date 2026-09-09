"use server";

// ============================================================
// /portal/login write path — start an OAuth handshake.
//
// Deliberately does NOT check whether the address is on a brand account:
// with OAuth we do not know the address until the provider hands it back.
// That check lives in /portal/auth/callback, which is the only gate.
//
// createActionSupabase, NOT createServerSupabase: signInWithOAuth issues a
// PKCE code-verifier that MUST be written to a cookie now and read back in
// the callback. createServerSupabase no-ops its cookie writer, so the
// verifier would be discarded and every callback would fail the exchange.
// ============================================================

import { redirect } from "next/navigation";
import { createActionSupabase } from "@/lib/supabase-server";

/** Providers this door accepts. Anything else is refused, not passed through. */
const PROVIDERS = ["google", "azure"] as const;
type PortalProvider = (typeof PROVIDERS)[number];

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app").replace(
    /\/$/,
    ""
  );
}

export async function startPortalOAuth(formData: FormData): Promise<void> {
  const raw = String(formData.get("provider") ?? "");
  if (!PROVIDERS.includes(raw as PortalProvider)) {
    redirect("/portal/login?error=provider");
  }
  const provider = raw as PortalProvider;

  const supabase = createActionSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl()}/portal/auth/callback`,
      // Return the URL instead of trying to navigate — there is no browser
      // here to redirect, and Next owns the response.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    console.error(
      `[portal-login] could not start ${provider} OAuth: ${error?.message ?? "no url returned"}`
    );
    redirect("/portal/login?error=provider");
  }

  redirect(data.url);
}
