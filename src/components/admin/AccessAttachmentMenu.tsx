// ============================================================
// The ⋯ menu on one brand attachment: Resend invite · Change role
// (this brand) · Revoke access (this brand only).
//
// Every item is a real <form> POST into a server action, gated by
// ConfirmSubmit — the dialog states exactly which brand is affected,
// because "revoke" on a multi-brand agency contact is otherwise the
// most dangerous ambiguous verb on the screen.
//
// The panel is position:FIXED, anchored to the button's rect. It cannot
// be a plain absolute child: AdminTable's desktop wrapper sets
// overflow-x-auto (so wide tables scroll), and that clipping context
// sliced the menu down to its header row — every action unreachable on
// desktop. A fixed box is laid out against the viewport, so ancestor
// overflow does not clip it, and no portal (or @types/react-dom, which
// this repo does not carry) is needed. Fixed positioning would be
// contained by a transformed ancestor; the admin shell has none.
// ============================================================

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { changeRole, resendInvite, revokeAccess } from "@/app/admin/access/actions";
import {
  ROLE_LABEL,
  type AttachmentRole,
  type AttachmentStatus,
} from "@/lib/admin/access";

export default function AccessAttachmentMenu({
  attachmentId,
  contactName,
  brandName,
  role,
  status,
  invitedEmail,
}: {
  attachmentId: string;
  contactName: string;
  brandName: string;
  role: AttachmentRole;
  status: AttachmentStatus;
  invitedEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "role" | "resend">("menu");
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const PANEL_W = 268;

  /** Anchor the portalled panel under the ⋯, kept inside the viewport. */
  const place = useCallback(() => {
    const btn = boxRef.current?.getBoundingClientRect();
    if (!btn) return;
    const left = Math.max(8, Math.min(btn.right - PANEL_W, window.innerWidth - PANEL_W - 8));
    setPos({ top: btn.bottom + 4, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, panel, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setPanel("menu");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setPanel("menu");
      }
    }
    // The panel is fixed-positioned, so it must follow scroll/resize.
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const otherRole: AttachmentRole = role === "approver" ? "viewer" : "approver";
  const isRevoked = status === "revoked";
  const inviteVerb = status === "on_file" ? "Invite" : status === "bounced" ? "Fix email & resend" : "Resend invite";

  return (
    <div className="relative inline-block" ref={boxRef}>
      <button
        type="button"
        aria-label={`Actions for ${contactName} on ${brandName}`}
        onClick={() => {
          setOpen((v) => !v);
          setPanel("menu");
        }}
        className="rounded px-1.5 py-0.5 text-[15px] leading-none text-stone-400 hover:bg-stone-100 hover:text-stone-700"
      >
        ⋯
      </button>

      {open && mounted && pos && (
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: PANEL_W }}
          className="z-50 rounded-lg border border-stone-200 bg-white p-2 text-left shadow-lg"
        >
          <div className="px-2 pb-2 pt-1 text-[11px] uppercase tracking-wide text-stone-400">
            {brandName}
          </div>

          {panel === "menu" && (
            <div className="space-y-0.5">
              {!isRevoked && (
                <button
                  type="button"
                  onClick={() => setPanel("resend")}
                  className="block w-full rounded px-2 py-1.5 text-left text-[13px] text-stone-700 hover:bg-stone-50"
                >
                  {inviteVerb}
                </button>
              )}
              {!isRevoked && (
                <button
                  type="button"
                  onClick={() => setPanel("role")}
                  className="block w-full rounded px-2 py-1.5 text-left text-[13px] text-stone-700 hover:bg-stone-50"
                >
                  Change role — currently {ROLE_LABEL[role]}
                </button>
              )}
              {isRevoked ? (
                <form action={resendInvite}>
                  <input type="hidden" name="attachment_id" value={attachmentId} />
                  <ConfirmSubmit
                    variant="quiet"
                    confirmLabel="Re-invite"
                    summary={`Re-invite ${contactName} to ${brandName}? This creates a fresh invite for this brand only and clears the revoked state.`}
                  >
                    Re-invite to {brandName}
                  </ConfirmSubmit>
                </form>
              ) : (
                <div className="border-t border-stone-100 pt-1">
                  <form action={revokeAccess}>
                    <input type="hidden" name="attachment_id" value={attachmentId} />
                    <ConfirmSubmit
                      variant="danger"
                      confirmLabel="Revoke this brand"
                      summary={
                        `Revoke ${contactName}'s access to ${brandName}? ` +
                        `This affects ${brandName} only — their other brand attachments are untouched. ` +
                        `Recorded against your name in the audit log. ` +
                        `Note: today's portal entry is a brand-level link, so this marks the registry, ` +
                        `it does not rotate the brand's portal link.`
                      }
                    >
                      Revoke access
                    </ConfirmSubmit>
                  </form>
                </div>
              )}
            </div>
          )}

          {panel === "role" && (
            <form action={changeRole} className="space-y-2 px-1 pb-1">
              <input type="hidden" name="attachment_id" value={attachmentId} />
              <input type="hidden" name="role" value={otherRole} />
              <p className="px-1 text-[12px] leading-4 text-stone-600">
                Change to <b>{ROLE_LABEL[otherRole]}</b> on {brandName}. Roles are per brand — this
                does not change their role anywhere else.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-stone-300 px-2.5 py-1 text-[12px] text-stone-700"
                  onClick={() => setPanel("menu")}
                >
                  Back
                </button>
                <ConfirmSubmit
                  confirmLabel={`Make ${ROLE_LABEL[otherRole]}`}
                  summary={`Change ${contactName} from ${ROLE_LABEL[role]} to ${ROLE_LABEL[otherRole]} on ${brandName}? Their role on any other brand is unchanged.`}
                >
                  Make {ROLE_LABEL[otherRole]}
                </ConfirmSubmit>
              </div>
            </form>
          )}

          {panel === "resend" && (
            <form action={resendInvite} className="space-y-2 px-1 pb-1">
              <input type="hidden" name="attachment_id" value={attachmentId} />
              <label className="block px-1 text-[12px] font-medium text-stone-600">
                Send to
                <input
                  type="email"
                  name="invited_email"
                  defaultValue={invitedEmail ?? ""}
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-[13px] text-stone-900"
                />
              </label>
              <p className="px-1 text-[11px] leading-4 text-stone-400">
                {status === "bounced"
                  ? "The last invite bounced — correct the address before resending."
                  : "Leave as-is to resend to the same address."}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-stone-300 px-2.5 py-1 text-[12px] text-stone-700"
                  onClick={() => setPanel("menu")}
                >
                  Back
                </button>
                <ConfirmSubmit
                  confirmLabel="Send invite"
                  summary={`Send ${contactName} an invite to ${brandName}? This marks the attachment Invited and holds a seat on that brand.`}
                >
                  Send invite
                </ConfirmSubmit>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
