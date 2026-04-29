"use client";

import type { OpportunitiesSectionData } from "@/types/pitch";

interface Props {
  data: OpportunitiesSectionData;
  onChange: (data: OpportunitiesSectionData) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

/**
 * Opportunities pulls actual opportunity rows from the
 * pitch_page_opportunities junction table (joined to pitch_opportunities)
 * at render time. So per-pitch editing of the opportunity LIST is
 * managed via that join — not in this editor. This editor only controls
 * the section heading and visibility.
 */
export default function OpportunitiesEditor({ data, onChange }: Props) {
  const patch = (p: Partial<OpportunitiesSectionData>) =>
    onChange({ ...data, ...p });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Heading
        </label>
        <input
          value={data.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value || undefined })}
          placeholder="WHAT WE HAVE LINED UP"
          className={inputClass}
        />
      </div>
      <p className="text-xs text-gray-500">
        Opportunity rows themselves are managed via the
        <code className="px-1 mx-1 bg-black/50 rounded">pitch_page_opportunities</code>
        junction table, not this editor. Add or remove opportunities by SQL or
        a future Opportunities admin.
      </p>
    </div>
  );
}
