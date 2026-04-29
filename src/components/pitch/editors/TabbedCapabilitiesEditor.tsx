"use client";

import type {
  TabbedCapabilitiesSectionData,
  CapabilityItem,
} from "@/types/pitch";

interface Props {
  data: TabbedCapabilitiesSectionData;
  onChange: (data: TabbedCapabilitiesSectionData) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

export default function TabbedCapabilitiesEditor({ data, onChange }: Props) {
  const patch = (p: Partial<TabbedCapabilitiesSectionData>) =>
    onChange({ ...data, ...p });

  function updateItem(i: number, field: keyof CapabilityItem, val: string) {
    const items = [...data.items];
    items[i] = { ...items[i], [field]: val };
    patch({ items });
  }
  function addItem() {
    const idx = String(data.items.length + 1).padStart(2, "0");
    patch({ items: [...data.items, { index: idx, title: "", description: "" }] });
  }
  function removeItem(i: number) {
    patch({ items: data.items.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Heading (HTML)
        </label>
        <input
          value={data.heading}
          onChange={(e) => patch({ heading: e.target.value })}
          placeholder="What we do"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Description
        </label>
        <textarea
          value={data.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          className={`${inputClass} resize-y`}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Tabs ({data.items.length})
        </label>
        {data.items.map((item, i) => (
          <div
            key={i}
            className="border border-gray-800 rounded-lg p-3 mb-3 space-y-2"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#D73F09]">
                Tab {i + 1}
              </span>
              <button
                onClick={() => removeItem(i)}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                &times; Remove
              </button>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <input
                value={item.index}
                onChange={(e) => updateItem(i, "index", e.target.value)}
                placeholder="01"
                className={inputClass}
              />
              <input
                value={item.title}
                onChange={(e) => updateItem(i, "title", e.target.value)}
                placeholder="Title"
                className={inputClass}
              />
            </div>
            <textarea
              value={item.description}
              onChange={(e) => updateItem(i, "description", e.target.value)}
              rows={4}
              placeholder="Description body"
              className={`${inputClass} resize-y`}
            />
          </div>
        ))}
        <button
          onClick={addItem}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add tab
        </button>
      </div>
    </div>
  );
}
