"use client";

import type { CapabilitiesSectionData } from "@/types/pitch";

interface Props {
  data: CapabilitiesSectionData;
  onChange: (data: CapabilitiesSectionData) => void;
}

export default function CapabilitiesEditor({ data, onChange }: Props) {
  function updateItem(index: number, field: "index" | "title" | "description", val: string) {
    const items = [...data.items];
    items[index] = { ...items[index], [field]: val };
    onChange({ ...data, items });
  }

  function addItem() {
    onChange({
      ...data,
      items: [...data.items, { index: String(data.items.length + 1).padStart(3, "0"), title: "New Capability", description: "" }],
    });
  }

  function removeItem(index: number) {
    onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Heading (HTML)</label>
        <input type="text" value={data.heading} onChange={(e) => onChange({ ...data, heading: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Description (HTML)</label>
        <textarea value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} rows={3} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Capabilities</label>
        {data.items.map((item, i) => (
          <div key={i} className="border border-gray-800 rounded-lg p-3 mb-3">
            <div className="flex gap-2 mb-2">
              <input value={item.index} onChange={(e) => updateItem(i, "index", e.target.value)} placeholder="001" className="w-16 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
              <input value={item.title} onChange={(e) => updateItem(i, "title", e.target.value)} placeholder="Title" className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
              <button onClick={() => removeItem(i)} className="px-2 text-gray-500 hover:text-red-400 text-sm">&times;</button>
            </div>
            <textarea value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} rows={2} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
          </div>
        ))}
        <button onClick={addItem} className="text-xs text-[#D73F09] font-bold hover:underline">+ Add capability</button>
      </div>
    </div>
  );
}
