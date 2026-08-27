"use client";

// The recap builder.
//
// ONE SCROLLING PAGE, not the live editor's step wizard. That wizard exists
// because the editor grew that way: someone building a recap wants to see the
// whole thing and jump to the part that is wrong, not click Back four times —
// and the live preview beside it fights a wizard.
//
// Everything else is the editor's: the 1500ms debounced autosave with a
// snapshot ref, the explicit Save and Republish, the footer status line,
// /api/revalidate?path=, and the section vocabulary and chrome.
import { useEffect, useRef, useState } from "react";
import { HeroBuilder } from "./HeroBuilder";
import { BuilderSection, Field } from "./chrome";
import {
  ContentEditor,
  MetricsEditor,
  PerformersEditor,
  SectionsEditor,
  TakeawaysEditor,
} from "./sections";
import { useRecapConfigSave } from "./useRecapConfigSave";
import type { PickableMedia } from "./MediaPicker";
import type { FocalPoint, RecapConfig } from "@/lib/recap-v2/config";
import type { SectionId } from "@/lib/recap-v2/guards";

export interface BuilderAthlete {
  id: string;
  name: string;
  school: string | null;
  engagements: number;
}

export function RecapBuilder({
  campaignId,
  slug,
  initialConfig,
  heroItems,
  galleryItems,
  athletes,
  availableSections,
  derived,
  hasLegacyTakeaways,
}: {
  campaignId: string;
  slug: string;
  initialConfig: RecapConfig;
  /** Photos only — the hero is a still frame. */
  heroItems: PickableMedia[];
  /** Everything usable, for the gallery. */
  galleryItems: PickableMedia[];
  athletes: BuilderAthlete[];
  availableSections: SectionId[];
  derived: { title: string; brand: string; lede: string };
  hasLegacyTakeaways: boolean;
}) {
  const [config, setConfig] = useState<RecapConfig>(initialConfig);
  const patch = (next: Partial<RecapConfig>) =>
    setConfig((c) => {
      const merged = { ...c, ...next };
      // An absent key means "fall back", so a cleared control removes its key
      // rather than storing an empty value that would read as a choice.
      (Object.keys(next) as (keyof RecapConfig)[]).forEach((k) => {
        if (next[k] === undefined) delete merged[k];
      });
      return merged;
    });

  const setText = (key: "display_name" | "brand", v: string) =>
    patch({ [key]: v.trim() ? v : undefined } as Partial<RecapConfig>);

  const save = useRecapConfigSave({ campaignId, slug, config, initialConfig });

  // Anchor links, so a long page is still navigable — the wizard's job without
  // the wizard.
  const nav: { id: string; label: string }[] = [
    { id: "b-overview", label: "Overview" },
    { id: "b-hero", label: "Hero" },
    { id: "b-take", label: "Takeaways" },
    { id: "b-numbers", label: "Metrics" },
    { id: "b-perf", label: "Performers" },
    { id: "b-bic", label: "Content" },
    { id: "b-sections", label: "Sections" },
  ];

  return (
    <div className="pb-24">
      <nav className="sticky top-0 z-20 -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-gray-800 bg-black/95 px-4 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
        {nav.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 hover:bg-white/5 hover:text-gray-100"
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        <div id="b-overview" className="scroll-mt-20">
          <BuilderSection
            title="Campaign Overview"
            hint="What the client sees at the top of the recap."
          >
            <div className="space-y-4">
              <Field
                label="Display name"
                value={config.display_name ?? ""}
                onChange={(v) => setText("display_name", v)}
                placeholder={derived.title}
                hint={`Campaign is named "${derived.title}" in the admin. The recap prints this at up to 150px, so trademarked terms do not belong here.`}
              />
              <Field
                label="Brand"
                value={config.brand ?? ""}
                onChange={(v) => setText("brand", v)}
                placeholder={derived.brand || "Brand"}
                hint="Separate from the account name on the campaign record."
              />
              <Field
                label="Hero lede"
                value={config.hero?.lede ?? ""}
                onChange={(v) =>
                  patch({
                    hero: {
                      media_ids: config.hero?.media_ids ?? [],
                      focal: config.hero?.focal ?? {},
                      ...(v.trim() ? { lede: v } : {}),
                    },
                  })
                }
                placeholder={derived.lede}
                hint="The line under the title. Separate from the campaign overview prose, which the live editor still owns — one field doing both jobs is what printed the same copy twice."
              />
            </div>
          </BuilderSection>
        </div>

        <div id="b-hero" className="scroll-mt-20">
          <BuilderSection title="Hero" hint="The stills behind the opening block, and how each is framed.">
            <HeroBuilder
              campaignId={campaignId}
              items={heroItems}
              initialSelected={config.hero?.media_ids ?? []}
              initialFocal={config.hero?.focal ?? {}}
              derived={derived}
              onChange={(media_ids: string[], focal: Record<string, FocalPoint>) =>
                patch({
                  hero:
                    media_ids.length === 0 && !config.hero?.lede
                      ? undefined
                      : {
                          media_ids,
                          focal,
                          ...(config.hero?.lede ? { lede: config.hero.lede } : {}),
                        },
                })
              }
            />
          </BuilderSection>
        </div>

        <div id="b-take" className="scroll-mt-20">
          <TakeawaysEditor
            value={config.takeaways}
            onChange={(takeaways) => patch({ takeaways })}
            derivedNote={hasLegacyTakeaways ? "legacy" : null}
          />
        </div>

        <div id="b-numbers" className="scroll-mt-20">
          <MetricsEditor value={config.numbers} onChange={(numbers) => patch({ numbers })} />
        </div>

        <div id="b-perf" className="scroll-mt-20">
          <PerformersEditor
            value={config.performers}
            onChange={(performers) => patch({ performers })}
            athletes={athletes}
          />
        </div>

        <div id="b-bic" className="scroll-mt-20">
          <ContentEditor
            value={config.content}
            onChange={(content) => patch({ content })}
            items={galleryItems}
          />
        </div>

        <div id="b-sections" className="scroll-mt-20">
          <SectionsEditor
            value={config.sections}
            onChange={(sections) => patch({ sections })}
            available={availableSections}
          />
        </div>
      </div>

      <SaveBar {...save} slug={slug} />
    </div>
  );
}

/** The live editor's footer, same states and same wording. */
function SaveBar({
  isDirty,
  saving,
  justSaved,
  republishFlash,
  lastSavedAt,
  issues,
  save,
  republish,
  slug,
}: ReturnType<typeof useRecapConfigSave> & { slug: string }) {
  // Warn about anything the validator adjusted, the way the editor warns about
  // outstanding issues — it never blocks the save.
  const issueRef = useRef<string[]>(issues);
  useEffect(() => {
    issueRef.current = issues;
  }, [issues]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-gray-800 bg-black/95 px-4 py-4 backdrop-blur-xl sm:gap-3 sm:px-8">
      <a
        href={`/recap/${slug}?v2=1`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 whitespace-nowrap rounded-lg border border-gray-700 px-3 py-2 text-sm font-bold hover:border-gray-400 sm:px-5"
      >
        Preview ↗
      </a>

      <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden text-xs sm:flex">
        {republishFlash ? (
          <span className="whitespace-nowrap font-bold text-green-400">Live page updated</span>
        ) : isDirty ? (
          <span className="flex items-center gap-1.5 whitespace-nowrap font-bold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Unsaved changes
          </span>
        ) : saving ? (
          <span className="whitespace-nowrap text-gray-400">Saving…</span>
        ) : lastSavedAt ? (
          <span className="whitespace-nowrap text-gray-500">Saved {lastSavedAt}</span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {issues.length > 0 ? (
          <span
            title={issues.join("\n")}
            className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-[#D73F09]"
          >
            ⚠ {issues.length}
            <span className="hidden sm:inline"> adjusted</span>
          </span>
        ) : null}
        <button
          onClick={save}
          disabled={!isDirty || saving}
          title={!isDirty && !saving ? "Nothing to save — all changes are already stored" : undefined}
          className="whitespace-nowrap rounded-lg border border-gray-600 px-3 py-2 text-sm font-bold transition-colors hover:border-gray-400 disabled:opacity-30 sm:px-5"
        >
          {saving ? "Saving…" : justSaved ? "Saved" : "Save"}
        </button>
        <button
          onClick={republish}
          disabled={saving}
          className="whitespace-nowrap rounded-lg bg-[#D73F09] px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-[#e5551f] disabled:opacity-30 sm:px-5"
        >
          Republish
        </button>
      </div>
    </div>
  );
}
