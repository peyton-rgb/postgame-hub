"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { PitchPage, PitchSectionData } from "@/types/pitch";
import { SECTION_TYPE_LABELS } from "@/types/pitch";
import { getDefaultPitchSections } from "@/lib/pitch/defaultTemplate";
import Link from "next/link";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Lazy-loaded editors
import TickerEditor from "@/components/pitch/editors/TickerEditor";
import HeroEditor from "@/components/pitch/editors/HeroEditor";
import ThesisEditor from "@/components/pitch/editors/ThesisEditor";
import RosterEditor from "@/components/pitch/editors/RosterEditor";
import PullQuoteEditor from "@/components/pitch/editors/PullQuoteEditor";
import CapabilitiesEditor from "@/components/pitch/editors/CapabilitiesEditor";
import IdeasEditor from "@/components/pitch/editors/IdeasEditor";
import CtaEditor from "@/components/pitch/editors/CtaEditor";
import WhyYouEditor from "@/components/pitch/editors/WhyYouEditor";
import CollageEditor from "@/components/pitch/editors/CollageEditor";
import TalentRosterEditor from "@/components/pitch/editors/TalentRosterEditor";
import TabbedCapabilitiesEditor from "@/components/pitch/editors/TabbedCapabilitiesEditor";
import AgencyComparisonEditor from "@/components/pitch/editors/AgencyComparisonEditor";
import EarningsComparisonEditor from "@/components/pitch/editors/EarningsComparisonEditor";
import OpportunitiesEditor from "@/components/pitch/editors/OpportunitiesEditor";

// Editors for new section types (collage, opportunities, whyYou) are
// deferred to a future session. Until those editor components exist,
// the dashboard simply won't show those types in the "add section"
// dropdown. The map is now Partial<Record<...>> so the missing entries
// don't break the build.
const EDITOR_MAP: Partial<Record<PitchSectionData["type"], React.ComponentType<{ data: any; onChange: (d: any) => void }>>> = {
  ticker: TickerEditor,
  hero: HeroEditor,
  thesis: ThesisEditor,
  roster: RosterEditor,
  pullQuote: PullQuoteEditor,
  capabilities: CapabilitiesEditor,
  ideas: IdeasEditor,
  cta: CtaEditor,
  whyYou: WhyYouEditor,
  collage: CollageEditor,
  talentRoster: TalentRosterEditor,
  tabbedCapabilities: TabbedCapabilitiesEditor,
  agencyComparison: AgencyComparisonEditor,
  earningsComparison: EarningsComparisonEditor,
  opportunities: OpportunitiesEditor,
};

const ALL_SECTION_TYPES: PitchSectionData["type"][] = [
  "ticker", "hero", "thesis", "roster", "pullQuote", "capabilities", "ideas", "cta",
];

function SortableItem({
  section,
  index,
  isSelected,
  onSelect,
  onToggleVisibility,
}: {
  section: PitchSectionData;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `${section.type}-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? "bg-[#D73F09]/10 border border-[#D73F09]/30"
          : "border border-transparent hover:bg-white/5"
      }`}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="8" cy="5" r="2" />
          <circle cx="16" cy="5" r="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="16" cy="12" r="2" />
          <circle cx="8" cy="19" r="2" />
          <circle cx="16" cy="19" r="2" />
        </svg>
      </div>
      <span className={`text-sm font-bold flex-1 ${isSelected ? "text-[#D73F09]" : "text-gray-300"}`}>
        {SECTION_TYPE_LABELS[section.type]}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className={`text-xs px-1.5 py-0.5 rounded ${
          section.visible
            ? "text-green-400 hover:text-green-300"
            : "text-gray-600 hover:text-gray-400"
        }`}
        title={section.visible ? "Visible" : "Hidden"}
      >
        {section.visible ? "ON" : "OFF"}
      </button>
    </div>
  );
}

export default function PitchEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [pitch, setPitch] = useState<PitchPage | null>(null);
  const [sections, setSections] = useState<PitchSectionData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadPitch();
  }, [id]);

  async function loadPitch() {
    const { data } = await supabase.from("pitch_pages").select("*").eq("id", id).single();
    if (data) {
      const p = data as PitchPage;
      setPitch(p);
      setSections(p.content?.sections ?? []);
      setStatus(p.status);
    }
    setLoading(false);
  }

  const debouncedSave = useCallback(
    (updatedSections: PitchSectionData[], updatedStatus?: "draft" | "published") => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        if (!pitch) return;
        setSaving(true);
        await supabase
          .from("pitch_pages")
          .update({
            content: { sections: updatedSections },
            status: updatedStatus ?? status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pitch.id);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        // Reload iframe
        if (iframeRef.current) {
          iframeRef.current.src = iframeRef.current.src;
        }
      }, 800);
    },
    [pitch, status, supabase]
  );

  function updateSection(index: number, data: PitchSectionData) {
    const updated = [...sections];
    updated[index] = data;
    setSections(updated);
    debouncedSave(updated);
  }

  function toggleVisibility(index: number) {
    const updated = [...sections];
    updated[index] = { ...updated[index], visible: !updated[index].visible };
    setSections(updated);
    debouncedSave(updated);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s, i) => `${s.type}-${i}` === active.id);
    const newIndex = sections.findIndex((s, i) => `${s.type}-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(sections, oldIndex, newIndex);
      setSections(reordered);
      if (selectedIndex === oldIndex) setSelectedIndex(newIndex);
      debouncedSave(reordered);
    }
  }

  function addSection(type: PitchSectionData["type"]) {
    const defaults = getDefaultPitchSections();
    const template = defaults.find((s) => s.type === type);
    if (template) {
      const updated = [...sections, template];
      setSections(updated);
      setSelectedIndex(updated.length - 1);
      debouncedSave(updated);
    }
    setShowAddMenu(false);
  }

  function removeSection(index: number) {
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
    if (selectedIndex >= updated.length) setSelectedIndex(Math.max(0, updated.length - 1));
    debouncedSave(updated);
  }

  async function toggleStatus() {
    if (!pitch) return;
    const newStatus = status === "draft" ? "published" : "draft";
    setStatus(newStatus);
    setSaving(true);
    await supabase
      .from("pitch_pages")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", pitch.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white text-sm">
        Loading...
      </div>
    );
  }

  if (!pitch) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white text-sm">
        Pitch not found.
      </div>
    );
  }

  const selectedSection = sections[selectedIndex];
  const EditorComponent = selectedSection ? EDITOR_MAP[selectedSection.type] : null;

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* LEFT — Section List */}
      <div className="w-[240px] flex-shrink-0 flex flex-col border-r border-gray-800">
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => router.push("/dashboard?tab=pitches")}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors flex-shrink-0 text-xs"
            >
              &larr;
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#D73F09]">
                Pitch Editor
              </div>
              <div className="text-xs font-bold text-white truncate">
                {pitch.title || "Untitled"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleStatus}
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                status === "published"
                  ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
              }`}
            >
              {status}
            </button>
            {saving && <span className="text-[10px] text-gray-500">Saving...</span>}
            {saved && <span className="text-[10px] text-green-500">Saved</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((s, i) => `${s.type}-${i}`)}
              strategy={verticalListSortingStrategy}
            >
              {sections.map((section, i) => (
                <SortableItem
                  key={`${section.type}-${i}`}
                  section={section}
                  index={i}
                  isSelected={i === selectedIndex}
                  onSelect={() => setSelectedIndex(i)}
                  onToggleVisibility={() => toggleVisibility(i)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="p-3 border-t border-gray-800 relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-full text-xs font-bold text-gray-400 hover:text-[#D73F09] border border-gray-700 hover:border-[#D73F09]/30 rounded-lg py-2 transition-colors"
          >
            + Add Section
          </button>
          {showAddMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#111] border border-gray-700 rounded-xl shadow-xl overflow-hidden z-10">
              {ALL_SECTION_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => addSection(type)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-[#D73F09] transition-colors"
                >
                  {SECTION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MIDDLE — Section Editor */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-gray-800">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {selectedSection ? SECTION_TYPE_LABELS[selectedSection.type] : "Select a section"}
          </span>
          {selectedSection && (
            <button
              onClick={() => removeSection(selectedIndex)}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {selectedSection && EditorComponent ? (
            <EditorComponent
              data={selectedSection}
              onChange={(d) => updateSection(selectedIndex, d)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Select a section to edit
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Live Preview */}
      <div className="flex-1 flex flex-col bg-[#0a0a0a] min-w-0">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Live Preview
          </span>
          {/* For drafts, append ?preview=1 so the page renders via the
              service-role client (bypasses the public RLS filter that
              hides unpublished pitches → otherwise it 404s). */}
          <Link
            href={
              pitch.status === "published"
                ? `/pitch/${pitch.slug}`
                : `/pitch/${pitch.slug}?preview=1`
            }
            target="_blank"
            className="text-xs px-3 py-1.5 bg-[#D73F09] text-white font-bold rounded-lg hover:bg-[#B33407] transition-colors"
          >
            View Live &rarr;
          </Link>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            src={`/pitch/${pitch.slug}?preview=1`}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
