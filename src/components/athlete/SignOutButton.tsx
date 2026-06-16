"use client";

// Signs the athlete out (clears the cookie session) and returns to login.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserSupabase();

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/athlete/login");
    router.refresh();
  }

  return (
    <button className="a-ghost" onClick={signOut} disabled={loading}>
      <span style={{ fontSize: 13 }}>{loading ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
