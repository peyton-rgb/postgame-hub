import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Browser client (singleton for client components)
let browserClient: ReturnType<typeof createBrowserClient> | null = null;
export function createBrowserSupabase() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}

// Plain client (no cookies — for public server pages that don't need auth)
export function createPlainSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
