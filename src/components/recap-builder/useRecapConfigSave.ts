"use client";

// Saving, mirrored from the live editor at /dashboard/[id] so the habit is the
// one people already have: a 1500ms debounced autosave, a JSON snapshot of the
// last-saved payload, an explicit Save, and Republish.
//
// The snapshot ref IS the #208 protection. Dirty is "the payload we WOULD
// persist differs from the last one we did", not "a dependency changed
// identity" — several deps are objects that are re-created on load with no
// edit behind them, and without the comparison merely opening a campaign
// writes to it and moves updated_at.
//
// Revalidation goes through /api/revalidate?path=, the route the editor
// already uses. One path, not two: a second mechanism doing the same job is
// how two callers end up disagreeing about whether the live page is fresh.
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { canonicalise, validateRecapConfig, type RecapConfig } from "@/lib/recap-v2/config";

const DEBOUNCE_MS = 1500;

export interface SaveState {
  isDirty: boolean;
  saving: boolean;
  justSaved: boolean;
  republishFlash: boolean;
  lastSavedAt: string | null;
  issues: string[];
  save: () => Promise<void>;
  republish: () => Promise<void>;
}

const fmtTime = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function useRecapConfigSave({
  campaignId,
  slug,
  config,
  initialConfig,
}: {
  campaignId: string;
  slug: string;
  /** The payload as it currently stands in the editor. */
  config: RecapConfig;
  /** What was loaded from the row. Seeds the snapshot. */
  initialConfig: RecapConfig;
}): SaveState {
  const supabase = createBrowserSupabase();

  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [republishFlash, setRepublishFlash] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  // Seeded from what was loaded, so a freshly opened builder reads clean.
  const savedSnapshot = useRef<string>(canonicalise(initialConfig));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = canonicalise(config);
  const isDirty = current !== savedSnapshot.current;

  // The unmount flush and the beforeunload handler read these rather than
  // closing over a first-render value.
  const configRef = useRef(config);
  const dirtyRef = useRef(isDirty);
  useEffect(() => {
    configRef.current = config;
    dirtyRef.current = isDirty;
  });

  const persist = useCallback(
    async (payload: RecapConfig) => {
      // Store what the validator produces, never what the editor happens to
      // hold — the page and the builder then read the same normalised shape.
      const { config: clean, issues: found } = validateRecapConfig(payload);
      const { error } = await supabase
        .from("campaign_recaps")
        .update({ recap_config: clean, updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) return { ok: false as const, error: error.message };
      savedSnapshot.current = canonicalise(clean);
      setIssues(found);
      setLastSavedAt(fmtTime());
      // The public recap serves a cached copy; this is what makes the save show.
      await fetch(`/api/revalidate?path=/recap/${slug}`);
      return { ok: true as const };
    },
    [campaignId, slug, supabase],
  );

  // ── Debounced autosave ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void (async () => {
        setSaving(true);
        await persist(configRef.current);
        setSaving(false);
      })();
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, isDirty, persist]);

  // ── Flush on unmount ──────────────────────────────────────────────────────
  // An SPA route change with a pending debounce must not discard it.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirtyRef.current) void persist(configRef.current);
    };
  }, [persist]);

  // ── Hard unloads ──────────────────────────────────────────────────────────
  // Reload and tab-close cannot await a save, so warn instead.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    const res = await persist(configRef.current);
    setSaving(false);
    if (res.ok) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  }, [persist]);

  const republish = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    await persist(configRef.current);
    setSaving(false);
    setRepublishFlash(true);
    setTimeout(() => setRepublishFlash(false), 2500);
  }, [persist]);

  return { isDirty, saving, justSaved, republishFlash, lastSavedAt, issues, save, republish };
}
