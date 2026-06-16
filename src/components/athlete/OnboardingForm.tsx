"use client";

// Profile setup form (mockup screen 13). Collects IG + TikTok handles,
// school, sport and an avatar, then writes them to the athlete's own
// profile row (RLS: auth.uid() = id) and stamps onboarded_at so the app
// stops redirecting here. Avatar uploads go to the public athlete-profiles
// bucket; failure there never blocks finishing setup.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AthleteProfile } from "@/lib/athlete-auth";
import { createBrowserSupabase } from "@/lib/supabase";

// Strip a leading @ and whitespace so handles store consistently.
function cleanHandle(v: string) {
  return v.trim().replace(/^@+/, "");
}

export default function OnboardingForm({ profile }: { profile: AthleteProfile }) {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [school, setSchool] = useState(profile.school ?? "");
  const [sport, setSport] = useState(profile.sport ?? "");
  const [ig, setIg] = useState(profile.ig_handle ?? "");
  const [tiktok, setTiktok] = useState(profile.tiktok_handle ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!profile.onboarded_at;

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("athlete-profiles")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("athlete-profiles").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err: any) {
      setError(err?.message || "Couldn't upload that image — you can still finish without a photo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        school: school.trim() || null,
        sport: sport.trim() || null,
        ig_handle: cleanHandle(ig) || null,
        tiktok_handle: cleanHandle(tiktok) || null,
        avatar_url: avatarUrl || null,
        onboarded_at: profile.onboarded_at ?? new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }
    router.push(isEdit ? "/athlete/profile" : "/athlete");
    router.refresh();
  }

  const initial = (fullName || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div style={{ padding: "22px 18px 32px" }}>
      <div style={{ marginBottom: 18 }}>
        <div className="a-d" style={{ fontSize: 30 }}>{isEdit ? "EDIT PROFILE" : "SET UP YOUR PROFILE"}</div>
        <div className="a-muted" style={{ fontSize: 13, marginTop: 4 }}>
          This is how brands see you. You can change it anytime.
        </div>
      </div>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", background: "var(--a-orange)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="a-d" style={{ fontSize: 26, color: "#fff" }}>{initial}</span>
          )}
        </div>
        <label style={{ cursor: "pointer" }}>
          <span className="a-pill a-pill-neutral">{uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}</span>
          <input type="file" accept="image/*" onChange={handleAvatar} style={{ display: "none" }} disabled={uploading} />
        </label>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        <div>
          <label className="a-label">Full name</label>
          <input className="a-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jordan Ellis" required />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="a-label">School</label>
            <input className="a-input" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Oregon State" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="a-label">Sport</label>
            <input className="a-input" value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Track & Field" />
          </div>
        </div>
        <div>
          <label className="a-label">Instagram handle</label>
          <input className="a-input" value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@yourhandle" />
        </div>
        <div>
          <label className="a-label">TikTok handle</label>
          <input className="a-input" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@yourhandle" />
        </div>

        {error && <div className="a-err">{error}</div>}

        <button type="submit" className="a-cta" disabled={saving || uploading} style={{ marginTop: 4 }}>
          <span className="a-d" style={{ fontSize: 18 }}>{saving ? "SAVING…" : isEdit ? "SAVE CHANGES" : "FINISH SETUP"}</span>
        </button>
      </form>
    </div>
  );
}
