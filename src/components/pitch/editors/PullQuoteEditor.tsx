"use client";

import type { PullQuoteSectionData } from "@/types/pitch";

interface Props {
  data: PullQuoteSectionData;
  onChange: (data: PullQuoteSectionData) => void;
}

export default function PullQuoteEditor({ data, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Quote</label>
        <textarea
          value={data.quote}
          onChange={(e) => onChange({ ...data, quote: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Citation</label>
        <input
          type="text"
          value={data.cite}
          onChange={(e) => onChange({ ...data, cite: e.target.value })}
          className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
        />
      </div>
    </div>
  );
}
