"use client";

// Profile v5 (postgame-app.html — profiletab, Phase 2R): identity card with
// real name/handles/school/sport + real DEALS + EARNED stats, a campaign
// history rail from the athlete's own opt-ins, and a settings card whose rows
// open sheets. Edit Profile, Platforms and Payment settings perform real
// own-profile writes; Squad/Contracts/Shipping are honest empty states (no
// backing tables yet).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import AthleteSheet from "@/components/athlete/AthleteSheet";
import PayPalLinkForm from "@/components/athlete/PayPalLinkForm";
import SignOutButton from "@/components/athlete/SignOutButton";
import { formatMoney } from "@/lib/athlete-format";

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
  paypalLinked: boolean;
  paypalEmail: string | null;
  reach: string;
  dealsCount: number;
  earnedCents: number;
  campaigns: RailItem[];
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
        <div className="a-idmeta">{[props.school, props.sport].filter(Boolean).join(" · ") || "Add your school & sport"}</div>

        {/* Stats */}
        <div className="a-pstat">
          <div className="s2">
            <div className="v2">{props.reach}</div>
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
        <SettingRow label="Your squad" onClick={() => setSheet("squad")} />
        <SettingRow label="Contracts" onClick={() => setSheet("contracts")} />
        <SettingRow label="Shipping & sizes" onClick={() => setSheet("shipping")} />
        <SettingRow
          label="Payment settings"
          onClick={() => setSheet("payment")}
          dot={props.paypalLinked ? "ok" : "due"}
          status={props.paypalLinked ? "Linked" : "Not linked"}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <SignOutButton />
      </div>

      {/* ---------- Sheets ---------- */}
      <EditSheet {...props} open={sheet === "edit"} onClose={close} supabase={supabase} router={router} />
      <PlatformsSheet {...props} open={sheet === "platforms"} onClose={close} supabase={supabase} router={router} />

      <AthleteSheet open={sheet === "squad"} onClose={close} title="Your squad" subtitle="Invite teammates and track who you brought in.">
        <div className="a-sheet-empty">Squad invites are coming soon. Athletes you refer to Postgame will show up here.</div>
      </AthleteSheet>

      <AthleteSheet open={sheet === "contracts"} onClose={close} title="Contracts" subtitle="Your signed deal paperwork, in one place.">
        <div className="a-sheet-empty">Contracts you sign through Postgame will be stored here.</div>
      </AthleteSheet>

      <AthleteSheet open={sheet === "shipping"} onClose={close} title="Shipping & sizes" subtitle="So brands can send you product.">
        <div className="a-sheet-empty">Add your sizes and shipping address so brands can send you product — coming soon.</div>
      </AthleteSheet>

      <AthleteSheet open={sheet === "payment"} onClose={close} title="Payment settings" subtitle="Where your payouts land.">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0 14px" }}>
          <span className={`a-dot-s ${props.paypalLinked ? "ok" : "due"}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: "bold" }}>PayPal</div>
            <div style={{ fontSize: 11, color: "rgba(250,248,245,0.5)" }}>
              {props.paypalLinked ? props.paypalEmail : "Not linked yet"}
            </div>
          </div>
        </div>
        <PayPalLinkForm initialEmail={props.paypalEmail} onSuccess={close} />
      </AthleteSheet>
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

// --- Edit Profile sheet (writes name/school/sport to own profile row) ---
function EditSheet({
  open,
  onClose,
  name,
  school,
  sport,
  profileId,
  supabase,
  router,
}: any) {
  const [n, setN] = useState(name ?? "");
  const [sc, setSc] = useState(school ?? "");
  const [sp, setSp] = useState(sport ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: n.trim() || null, school: sc.trim() || null, sport: sp.trim() || null })
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
