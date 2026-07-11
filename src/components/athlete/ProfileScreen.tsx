"use client";

// Profile v5 (postgame-app.html — profiletab). Phase 3 wires the settings
// sheets to real data now that the tables exist: Contracts, Shipping & sizes,
// Your Squad and the W-9 row in Payment all read/write real rows; the identity
// card surfaces class year and synced reach. Edit Profile, Platforms and
// Payment perform real own-profile writes.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import AthleteSheet from "@/components/athlete/AthleteSheet";
import ContractsSheet from "@/components/athlete/ContractsSheet";
import ShippingSheet from "@/components/athlete/ShippingSheet";
import SquadSheet from "@/components/athlete/SquadSheet";
import PaymentSheet from "@/components/athlete/PaymentSheet";
import SignOutButton from "@/components/athlete/SignOutButton";
import { formatMoney, formatReach, formatLongDate } from "@/lib/athlete-format";
import type { ContractRow, ShippingRow, SquadInvite } from "@/lib/athlete-account";

export type RailItem = {
  optinId: string;
  title: string;
  brandName: string | null;
  brandLogo: string | null;
  heroImage: string | null;
  pill: { text: string; kind: "due" | "ok" | "neutral" };
};

type Props = {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  igHandle: string | null;
  tiktokHandle: string | null;
  school: string | null;
  sport: string | null;
  classYear: string | null;
  paypalLinked: boolean;
  paypalEmail: string | null;
  reachTotal: number | null;
  reachSyncedAt: string | null;
  dealsCount: number;
  earnedCents: number;
  campaigns: RailItem[];
  contracts: ContractRow[];
  shipping: ShippingRow | null;
  squad: SquadInvite[];
  w9Status: string;
  w9Year: number | null;
};

function cleanHandle(v: string) {
  return v.trim().replace(/^@+/, "");
}

type SheetKey = "edit" | "platforms" | "squad" | "contracts" | "shipping" | "payment" | null;

export default function ProfileScreen(props: Props) {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [sheet, setSheet] = useState<SheetKey>(null);
  const close = () => setSheet(null);

  // Name: last word orange.
  const parts = props.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : null;
  const first = parts.join(" ");
  const initial = (props.name || "?").charAt(0).toUpperCase();
  const linkedPlatforms = [props.igHandle, props.tiktokHandle].filter(Boolean).length;

  const metaLine =
    [props.school, props.sport, props.classYear].filter(Boolean).join(" · ") || "Add your school & sport";

  const pendingInvites = props.squad.filter((i) => i.status !== "joined").length;
  const w9Needed = props.w9Status !== "on_file";
  const paymentStatus = !props.paypalLinked ? "Not linked" : w9Needed ? "W-9 needed" : "Linked";
  const paymentDot: "due" | "ok" = props.paypalLinked && !w9Needed ? "ok" : "due";

  return (
    <div style={{ padding: "0 18px" }}>
      {/* Top: eyebrow + edit */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0 4px" }}>
        <div className="a-eyebrow">Profile</div>
        <button className="a-pill a-pill-neutral" onClick={() => setSheet("edit")} style={{ border: "none", cursor: "pointer" }}>
          Edit profile
        </button>
      </div>

      {/* Identity card */}
      <div className="a-pcard">
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <div className="a-avphoto">
            {props.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.avatarUrl} alt={props.name} />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="a-idname">
              {first && <>{first} </>}
              {last && <span className="o">{last}</span>}
            </div>
            <div className="a-vchip">
              <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: "currentColor", strokeWidth: 3, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M5 12.5l4 4 9-10" />
              </svg>
              Verified athlete
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: 12.5, color: "rgba(250,248,245,0.7)" }}>
          {props.igHandle ? `@${props.igHandle}` : "Add your Instagram in Platforms"}
        </div>
        <div className="a-idmeta">{metaLine}</div>

        {/* Stats */}
        <div className="a-pstat">
          <div className="s2">
            <div className="v2">{formatReach(props.reachTotal)}</div>
            <div className="u2">Reach</div>
          </div>
          <div className="s2">
            <div className="v2">{props.dealsCount}</div>
            <div className="u2">Deals</div>
          </div>
          <div className="s2">
            <div className="v2 green">{formatMoney(props.earnedCents)}</div>
            <div className="u2">Earned</div>
          </div>
        </div>
        {props.reachTotal != null && props.reachSyncedAt && (
          <div style={{ textAlign: "center", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,248,245,0.35)", marginTop: 8 }}>
            Reach synced {formatLongDate(props.reachSyncedAt)}
          </div>
        )}

        <button
          className="a-cta"
          style={{ marginTop: 16 }}
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
          }}
        >
          <span className="a-anton" style={{ fontSize: 14 }}>SHARE MY CARD</span>
        </button>
      </div>

      {/* Campaign history rail */}
      {props.campaigns.length > 0 && (
        <>
          <div className="a-muted" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", margin: "22px 0 12px" }}>
            Campaign history
          </div>
          <div className="a-rail">
            {props.campaigns.map((c) => (
              <Link key={c.optinId} href={`/athlete/my-deals/${c.optinId}`} className="a-railcard">
                <div className="rhero">
                  {c.heroImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="bg" src={c.heroImage} alt="" />
                  )}
                  {c.brandLogo && (
                    <div className="rlogo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.brandLogo} alt={c.brandName || "brand"} />
                    </div>
                  )}
                </div>
                <div className="rbody">
                  <div className="rtitle">{c.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span className={`a-dot-s ${c.pill.kind}`} />
                    <span style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,245,0.55)" }}>
                      {c.pill.text}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Settings */}
      <div className="a-card" style={{ marginTop: 22, padding: "2px 15px" }}>
        <SettingRow label="Linked platforms" onClick={() => setSheet("platforms")} dot="ok" status={`${linkedPlatforms} linked`} />
        <SettingRow
          label="Your squad"
          onClick={() => setSheet("squad")}
          dot={pendingInvites > 0 ? "due" : props.squad.length > 0 ? "ok" : undefined}
          status={pendingInvites > 0 ? `${pendingInvites} pending` : props.squad.length > 0 ? `${props.squad.length}` : undefined}
        />
        <SettingRow
          label="Contracts"
          onClick={() => setSheet("contracts")}
          dot={props.contracts.length > 0 ? "ok" : undefined}
          status={props.contracts.length > 0 ? `${props.contracts.length}` : undefined}
        />
        <SettingRow
          label="Shipping & sizes"
          onClick={() => setSheet("shipping")}
          dot={props.shipping ? "ok" : "due"}
          status={props.shipping ? "Saved" : "Add"}
        />
        <SettingRow label="Payment settings" onClick={() => setSheet("payment")} dot={paymentDot} status={paymentStatus} />
      </div>

      <div style={{ marginTop: 16 }}>
        <SignOutButton />
      </div>

      {/* ---------- Sheets ---------- */}
      <EditSheet {...props} open={sheet === "edit"} onClose={close} supabase={supabase} router={router} />
      <PlatformsSheet {...props} open={sheet === "platforms"} onClose={close} supabase={supabase} router={router} />

      <SquadSheet open={sheet === "squad"} onClose={close} profileId={props.profileId} invites={props.squad} />
      <ContractsSheet open={sheet === "contracts"} onClose={close} contracts={props.contracts} />
      <ShippingSheet open={sheet === "shipping"} onClose={close} profileId={props.profileId} initial={props.shipping} />
      <PaymentSheet
        open={sheet === "payment"}
        onClose={close}
        profileId={props.profileId}
        paypalLinked={props.paypalLinked}
        paypalEmail={props.paypalEmail}
        w9Status={props.w9Status}
        w9Year={props.w9Year}
      />
    </div>
  );
}

function SettingRow({
  label,
  onClick,
  dot,
  status,
}: {
  label: string;
  onClick: () => void;
  dot?: "due" | "ok" | "neutral";
  status?: string;
}) {
  return (
    <button className="a-prowlink" onClick={onClick}>
      <span className="t2">{label}</span>
      {status ? (
        <span className="rstatus">
          {dot && <span className={`a-dot-s ${dot}`} />}
          <span className="rtxt">{status}</span>
          <span className="arrow">›</span>
        </span>
      ) : (
        <span className="arrow">›</span>
      )}
    </button>
  );
}

// --- Edit Profile sheet (writes name/school/sport/class year to own row) ---
function EditSheet({
  open,
  onClose,
  name,
  school,
  sport,
  classYear,
  profileId,
  supabase,
  router,
}: any) {
  const [n, setN] = useState(name ?? "");
  const [sc, setSc] = useState(school ?? "");
  const [sp, setSp] = useState(sport ?? "");
  const [cy, setCy] = useState(classYear ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: n.trim() || null,
        school: sc.trim() || null,
        sport: sp.trim() || null,
        class_year: cy.trim() || null,
      })
      .eq("id", profileId);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <AthleteSheet open={open} onClose={onClose} title="Edit profile" subtitle="This is how brands see you.">
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div>
          <label className="a-label">Name</label>
          <input className="a-input" value={n} onChange={(e) => setN(e.target.value)} placeholder="Jordan Ellis" />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="a-label">School</label>
            <input className="a-input" value={sc} onChange={(e) => setSc(e.target.value)} placeholder="Oregon State" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="a-label">Sport</label>
            <input className="a-input" value={sp} onChange={(e) => setSp(e.target.value)} placeholder="Track & Field" />
          </div>
        </div>
        <div>
          <label className="a-label">Class year</label>
          <input className="a-input" value={cy} onChange={(e) => setCy(e.target.value)} placeholder="2027 · So." />
        </div>
        {error && <div className="a-err">{error}</div>}
        <button className="a-cta" onClick={save} disabled={saving}>
          <span className="a-anton" style={{ fontSize: 15 }}>{saving ? "SAVING…" : "SAVE"}</span>
        </button>
      </div>
    </AthleteSheet>
  );
}

// --- Platforms sheet (writes ig/tiktok handles to own profile row) ---
function PlatformsSheet({ open, onClose, igHandle, tiktokHandle, profileId, supabase, router }: any) {
  const [ig, setIg] = useState(igHandle ?? "");
  const [tt, setTt] = useState(tiktokHandle ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ ig_handle: cleanHandle(ig) || null, tiktok_handle: cleanHandle(tt) || null })
      .eq("id", profileId);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <AthleteSheet open={open} onClose={onClose} title="Linked platforms" subtitle="Verified handles get you picked — and paid.">
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div>
          <label className="a-label">Instagram handle</label>
          <input className="a-input" value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@yourhandle" />
        </div>
        <div>
          <label className="a-label">TikTok handle</label>
          <input className="a-input" value={tt} onChange={(e) => setTt(e.target.value)} placeholder="@yourhandle" />
        </div>
        {error && <div className="a-err">{error}</div>}
        <button className="a-cta" onClick={save} disabled={saving}>
          <span className="a-anton" style={{ fontSize: 15 }}>{saving ? "SAVING…" : "SAVE HANDLES"}</span>
        </button>
      </div>
    </AthleteSheet>
  );
}
