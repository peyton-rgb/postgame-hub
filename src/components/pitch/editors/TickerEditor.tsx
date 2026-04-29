"use client";

import type { TickerSectionData, TickerItem } from "@/types/pitch";

interface Props {
  data: TickerSectionData;
  onChange: (data: TickerSectionData) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

/**
 * Each ticker item is either a plain text string OR an image item
 * `{ logoUrl, alt }`. The editor exposes both forms with a toggle.
 */
export default function TickerEditor({ data, onChange }: Props) {
  function isImage(item: TickerItem): item is { logoUrl: string; alt: string } {
    return typeof item !== "string";
  }

  function updateItem(index: number, value: TickerItem) {
    const items = [...data.items];
    items[index] = value;
    onChange({ ...data, items });
  }

  function setItemKind(index: number, kind: "text" | "image") {
    const item = data.items[index];
    if (kind === "text") {
      updateItem(index, isImage(item) ? item.alt : item);
    } else {
      updateItem(
        index,
        isImage(item)
          ? item
          : { logoUrl: "", alt: typeof item === "string" ? item : "" },
      );
    }
  }

  function addItem() {
    onChange({ ...data, items: [...data.items, "New headline"] });
  }

  function removeItem(index: number) {
    onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
        Ticker Items ({data.items.length})
      </label>
      {data.items.map((item, i) => (
        <div
          key={i}
          className="border border-gray-800 rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <select
              value={isImage(item) ? "image" : "text"}
              onChange={(e) =>
                setItemKind(i, e.target.value as "text" | "image")
              }
              className="text-xs px-2 py-1 bg-black border border-gray-700 rounded text-white focus:border-[#D73F09] outline-none"
            >
              <option value="text">Text</option>
              <option value="image">Logo</option>
            </select>
            <button
              onClick={() => removeItem(i)}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              &times;
            </button>
          </div>
          {isImage(item) ? (
            <>
              <input
                value={item.logoUrl}
                onChange={(e) =>
                  updateItem(i, { ...item, logoUrl: e.target.value })
                }
                placeholder="Logo URL"
                className={inputClass}
              />
              <input
                value={item.alt}
                onChange={(e) =>
                  updateItem(i, { ...item, alt: e.target.value })
                }
                placeholder="Alt text / brand name"
                className={inputClass}
              />
            </>
          ) : (
            <input
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder="Text"
              className={inputClass}
            />
          )}
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
