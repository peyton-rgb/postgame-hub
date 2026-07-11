"use client";

// Your Squad sheet (Phase 3). Lists the athlete's own `squad_invites` and lets
// them add a new one (name + contact -> a real 'pending' row via the browser
// client; RLS: own insert/select/update). RESEND is a local tap-state stub —
// no messaging is sent yet (invite delivery is deferred).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import AthleteSheet from "@/components/athlete/AthleteSheet";
import type { SquadInvite } from "@/lib/athlete-account";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function InviteRow({ invite }: { invite: SquadInvite }) {
  const [sent, setSent] = useState(false);
  const joined = invite.status === "joined";
  return (
    <div className="a-srow">
      <div className={`a-sav ${joined ? "joined" : ""}`}>{initials(invite.inviteeName)}</div>
      <div className="sbody">
        <div className="sname">{invite.inviteeName}</div>
        <div className="ssub">{invite.inviteeContact || (joined ? "On Postgame" : "Invite pending")}</div>
      </div>
      {joined ? (
        <span className="a-sjoined">Joined</span>
      ) : (
        <button
          className={`a-invitebtn ${sent ? "sent" : ""}`}
          onClick={() => {
            if (sent) return;
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
            setSent(true);
          }}
        >
          {sent ? "Sent" : "Resend"}
        </button>
      )}
    </div>
  );
}

export default function SquadSheet({
  open,
  onClose,
  profileId,
  invites,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  invites: SquadInvite[];
}) {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setError("");
    if (!name.trim()) {
      setError("Add a name.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("squad_invites").insert({
      inviter_id: profileId,
      invitee_name: name.trim(),
      invitee_contact: contact.trim() || null,
      status: "pending",
    });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setName("");
    setContact("");
    setAdding(false);
    router.refresh();
  }

  return (
    <AthleteSheet open={open} onClose={onClose} title="Your squad" subtitle="Invite teammates and track who you brought in.">
      {invites.length === 0 && !adding ? (
        <div className="a-sheet-empty">
          No invites yet. Add a teammate and we&apos;ll track who&apos;s on Postgame — invite delivery is coming soon.
        </div>
      ) : (
        <div>
          {invites.map((i) => (
            <InviteRow key={i.id} invite={i} />
          ))}
        </div>
      )}

      {adding ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          <div>
            <label className="a-label">Teammate name</label>
            <input className="a-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Marcus Torres" />
          </div>
          <div>
            <label className="a-label">Phone or email (optional)</label>
            <input className="a-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="so we can reach them" />
          </div>
          {error && <div className="a-err">{error}</div>}
          <button className="a-cta" onClick={add} disabled={saving}>
            <span className="a-anton" style={{ fontSize: 15 }}>{saving ? "ADDING…" : "ADD TO SQUAD"}</span>
          </button>
          <div className="a-sheet-cancel" onClick={() => { setAdding(false); setError(""); }}>Cancel</div>
        </div>
      ) : (
        <button className="a-ghost" style={{ marginTop: 16 }} onClick={() => setAdding(true)}>
          <span className="a-anton" style={{ fontSize: 14 }}>+ ADD A TEAMMATE</span>
        </button>
      )}
    </AthleteSheet>
  );
}
