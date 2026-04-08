"use client";

import type { TickerSectionData } from "@/types/pitch";

interface Props {
  data: TickerSectionData;
  onChange: (data: TickerSectionData) => void;
}

export default function TickerEditor({ data, onChange }: Props) {
  function updateItem(index: number, value: string) {
    const items = [...data.items];
    items[index] = value;
    onChange({ ...data, items });
  }

  function addItem() {
    onChange({ ...data, items: [...data.items, "New headline"] });
  }

  function removeItem(index: number) {
    onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
        Ticker Items
      </label>
      {data.items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
          />
          <button
            onClick={() => removeItem(i)}
            className="px-2 text-gray-500 hover:text-red-400 text-sm"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="text-xs text-[#D73F09] font-bold hover:underline"
      >
        + Add item
      </button>
    </div>
  );
}
