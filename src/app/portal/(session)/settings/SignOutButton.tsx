"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

// There is no sign-out ROUTE in this repo — every existing sign-out is a
// client-side supabase.auth.signOut() (DashboardSidebar, dashboard/page,
// dashboard/bts). This follows that pattern rather than adding a second
// mechanism, and lands on /portal/login so a brand user sees their own door.
export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="pgd-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await createBrowserSupabase().auth.signOut();
        } finally {
          window.location.href = "/portal/login";
        }
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
