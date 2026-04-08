"use client";

import type { CtaSectionData } from "@/types/pitch";

interface Props {
  data: CtaSectionData;
  onChange: (data: CtaSectionData) => void;
}

export default function CtaEditor({ data, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Kicker</label>
        <input type="text" value={data.kicker} onChange={(e) => onChange({ ...data, kicker: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Heading (HTML)</label>
        <textarea value={data.heading} onChange={(e) => onChange({ ...data, heading: e.target.value })} rows={3} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Button Text</label>
        <input type="text" value={data.buttonText} onChange={(e) => onChange({ ...data, buttonText: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Button Link</label>
        <input type="text" value={data.buttonHref} onChange={(e) => onChange({ ...data, buttonHref: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Footer Brand</label>
        <input type="text" value={data.footerBrand} onChange={(e) => onChange({ ...data, footerBrand: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Footer Meta</label>
        <input type="text" value={data.footerMeta} onChange={(e) => onChange({ ...data, footerMeta: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
    </div>
  );
}
