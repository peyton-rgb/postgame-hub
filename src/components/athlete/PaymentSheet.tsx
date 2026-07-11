"use client";

// Payment settings sheet (Phase 3). PayPal link (unchanged from 2R) plus a W-9
// row driven by profiles.w9_status. 'needed' shows the orange treatment and an
// UPDATE action that opens a small confirm sheet; confirming flips the athlete's
// own row to w9_status='on_file', w9_year=2026. Real tax-doc collection is a
// later phase — the confirm copy says so; this only records the status.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import AthleteSheet from "@/components/athlete/AthleteSheet";
import PayPalLinkForm from "@/components/athlete/PayPalLinkForm";

const W9_YEAR = 2026;

export default function PaymentSheet({
  open,
  onClose,
  profileId,
  paypalLinked,
  paypalEmail,
  w9Status,
  w9Year,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  paypalLinked: boolean;
  paypalEmail: string | null;
  w9Status: string;
  w9Year: number | null;
}) {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const w9OnFile = w9Status === "on_file";

  async function markOnFile() {
    setError("");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ w9_status: "on_file", w9_year: W9_YEAR })
      .eq("id", profileId);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setConfirmOpen(false);
    onClose();
    router.refresh();
  }

  return (
    <>
      <AthleteSheet open={open} onClose={onClose} title="Payment settings" subtitle="Where your payouts land.">
        {/* PayPal */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0 14px" }}>
          <span className={`a-dot-s ${paypalLinked ? "ok" : "due"}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: "bold" }}>PayPal</div>
            <div style={{ fontSize: 11, color: "rgba(250,248,245,0.5)" }}>
              {paypalLinked ? paypalEmail : "Not linked yet"}
            </div>
          </div>
        </div>
        <PayPalLinkForm initialEmail={paypalEmail} onSuccess={onClose} />

        {/* W-9 */}
        <div style={{ borderTop: "1px solid var(--a-line)", marginTop: 18, paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className={`a-dot-s ${w9OnFile ? "ok" : "due"}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: "bold" }}>Tax form (W-9)</div>
              <div style={{ fontSize: 11, color: "rgba(250,248,245,0.5)" }}>
                {w9OnFile ? `On file${w9Year ? ` · ${w9Year}` : ""}` : "Needed before you get paid"}
              </div>
            </div>
            {!w9OnFile && (
              <button className="a-w9update" onClick={() => setConfirmOpen(true)}>Update</button>
            )}
          </div>
        </div>
      </AthleteSheet>

      {/* Confirm sub-sheet */}
      <AthleteSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm your W-9"
        subtitle="Required so Postgame can pay you and report correctly."
      >
        <div style={{ fontSize: 13, color: "rgba(250,248,245,0.75)", lineHeight: 1.55 }}>
          For now this marks your W-9 as on file for {W9_YEAR}. Full tax-document collection is coming in a later
          update — your Postgame manager will follow up if anything else is needed.
        </div>
        {error && <div className="a-err" style={{ marginTop: 12 }}>{error}</div>}
        <button className="a-cta" style={{ marginTop: 16 }} onClick={markOnFile} disabled={saving}>
          <span className="a-anton" style={{ fontSize: 15 }}>{saving ? "SAVING…" : "MARK W-9 AS ON FILE"}</span>
        </button>
        <div className="a-sheet-cancel" onClick={() => setConfirmOpen(false)}>Not now</div>
      </AthleteSheet>
    </>
  );
}
