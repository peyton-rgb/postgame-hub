"use client";

// ============================================================
// <CampaignEditorBanner> — a small, dismissible pointer shown at the
// top of the recap editor (/dashboard/[id]) during the slot-editor
// migration. It tells the user that public campaign-page heroes +
// gallery are now edited in the Phase 4 Campaign Page Editor, and
// links straight there.
//
// Deliberately self-contained so the (protected) recap editor only
// needs an import + one line. Subtle by design, and dismissible —
// once closed it stays hidden across every recap (localStorage).
// ============================================================

import { useEffect, useState } from "react";

const DISMISS_KEY = "pg_hide_campaign_editor_banner";

export default function CampaignEditorBanner({ recapId }: { recapId: string }) {
  // Start hidden to avoid a flash before we can read the dismiss flag.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || !recapId) return null;

  const href = `/dashboard/website?page=campaign&id=${recapId}`;

  return (
    <div className="px-8 py-2 flex items-center justify-between gap-3 text-xs border-b border-gray-800 bg-[#D73F09]/5">
      <div className="text-gray-400">
        Editing the <span className="text-gray-300 font-semibold">public campaign page</span> (heroes &amp; gallery)?{" "}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#D73F09] hover:underline"
        >
          Open the Campaign Page Editor →
        </a>
      </div>
      <button
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
          setHidden(true);
        }}
        aria-label="Dismiss"
        className="text-gray-600 hover:text-white flex-shrink-0 leading-none"
      >
        ✕
      </button>
    </div>
  );
}
