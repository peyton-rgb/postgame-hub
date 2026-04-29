"use client";

import { useState } from "react";
import type {
  CollageSectionData,
  HeroPlatePosition,
} from "@/types/pitch";

interface Props {
  data: CollageSectionData;
  onChange: (data: CollageSectionData) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

export default function CollageEditor({ data, onChange }: Props) {
  const patch = (p: Partial<CollageSectionData>) => onChange({ ...data, ...p });
  const [openPlateIdx, setOpenPlateIdx] = useState<number | null>(null);

  function updatePlate(i: number, field: keyof HeroPlatePosition, val: string) {
    const arr = [...(data.heroPlates ?? [])];
    arr[i] = { ...arr[i], [field]: val } as HeroPlatePosition;
    patch({ heroPlates: arr });
  }
  function addPlate() {
    patch({
      heroPlates: [
        ...(data.heroPlates ?? []),
        { athleteName: "", left: "10%", bottom: "4%" },
      ],
    });
  }
  function removePlate(i: number) {
    patch({
      heroPlates: (data.heroPlates ?? []).filter((_, idx) => idx !== i),
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Heading
        </label>
        <input
          value={data.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value || undefined })}
          placeholder="e.g. NOTABLE POSTGAME ALUM"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Hero Image URL
        </label>
        <input
          value={data.heroImageUrl ?? ""}
          onChange={(e) =>
            patch({ heroImageUrl: e.target.value || undefined })
          }
          placeholder="/pitch-collage/hero-collage.jpg"
          className={inputClass}
        />
        <p className="text-xs text-gray-500 mt-1">
          Pre-composed athlete collage image. When set, overrides per-athlete
          tile layout.
        </p>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Sport filter
        </label>
        <input
          value={data.sport ?? ""}
          onChange={(e) => patch({ sport: e.target.value || undefined })}
          placeholder="football"
          className={inputClass}
        />
        <p className="text-xs text-gray-500 mt-1">
          Filters pitch_collage_athletes by sport when not in hero-image mode.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Hero Plates ({data.heroPlates?.length ?? 0})
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Floating name plates over the hero image. Each plate is positioned
          by left/bottom % values.
        </p>
        {(data.heroPlates ?? []).map((p, i) => (
          <div
            key={i}
            className="border border-gray-800 rounded-lg p-3 mb-2 space-y-2"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#D73F09]">
                Plate {i + 1}
              </span>
              <button
                onClick={() => removePlate(i)}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                &times;
              </button>
            </div>
            <input
              value={p.athleteName}
              onChange={(e) => updatePlate(i, "athleteName", e.target.value)}
              placeholder="Athlete name (must match pitch_collage_athletes)"
              className={inputClass}
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                value={p.left}
                onChange={(e) => updatePlate(i, "left", e.target.value)}
                placeholder="left (e.g. 10%)"
                className={inputClass}
              />
              <input
                value={p.bottom ?? ""}
                onChange={(e) => updatePlate(i, "bottom", e.target.value)}
                placeholder="bottom (e.g. 4%)"
                className={inputClass}
              />
              <select
                value={p.align ?? "left"}
                onChange={(e) => updatePlate(i, "align", e.target.value)}
                className={inputClass}
              >
                <option value="left">Left-anchor</option>
                <option value="center">Center-anchor</option>
                <option value="right">Right-anchor</option>
              </select>
            </div>
          </div>
        ))}
        <button
          onClick={addPlate}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add plate
        </button>
      </div>
    </div>
  );
}
