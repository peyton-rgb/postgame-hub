"use client";

import { useState } from "react";
import type { RosterSectionData, RosterAthlete } from "@/types/pitch";
import CampaignMediaPicker from "@/components/CampaignMediaPicker";

interface Props {
  data: RosterSectionData;
  onChange: (data: RosterSectionData) => void;
}

const EMPTY_ATHLETE: RosterAthlete = {
  number: "",
  tag: "",
  tagStyle: "default",
  name: "",
  role: "",
  moment: "",
  date: "",
  photoUrl: "",
  size: "std",
};

export default function RosterEditor({ data, onChange }: Props) {
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);

  function updateAthlete(index: number, field: keyof RosterAthlete, val: string) {
    const athletes = [...data.athletes];
    athletes[index] = { ...athletes[index], [field]: val };
    onChange({ ...data, athletes });
  }

  function addAthlete() {
    const num = data.athletes.length + 1;
    onChange({
      ...data,
      athletes: [
        ...data.athletes,
        { ...EMPTY_ATHLETE, number: `\u2116 ${String(num).padStart(2, "0")}` },
      ],
    });
  }

  function removeAthlete(index: number) {
    onChange({ ...data, athletes: data.athletes.filter((_, i) => i !== index) });
  }

  function handlePhotoSelect(index: number, result: { url: string }) {
    updateAthlete(index, "photoUrl", result.url);
    setEditingPhotoIndex(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Heading (HTML)</label>
        <input type="text" value={data.heading} onChange={(e) => onChange({ ...data, heading: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Meta Label</label>
          <input type="text" value={data.metaLabel} onChange={(e) => onChange({ ...data, metaLabel: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Meta Detail</label>
          <input type="text" value={data.metaDetail} onChange={(e) => onChange({ ...data, metaDetail: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Athletes ({data.athletes.length})
        </label>
        {data.athletes.map((a, i) => (
          <div key={i} className="border border-gray-800 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#D73F09]">{a.number || `Athlete ${i + 1}`}</span>
              <button onClick={() => removeAthlete(i)} className="text-xs text-gray-500 hover:text-red-400">&times; Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={a.number} onChange={(e) => updateAthlete(i, "number", e.target.value)} placeholder="No 01" className="px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
              <input value={a.name} onChange={(e) => updateAthlete(i, "name", e.target.value)} placeholder="Name" className="px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
            </div>
            <input value={a.role} onChange={(e) => updateAthlete(i, "role", e.target.value)} placeholder="Position / School" className="w-full px-3 py-2 mb-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
            <textarea value={a.moment} onChange={(e) => updateAthlete(i, "moment", e.target.value)} placeholder="Key moment (HTML)" rows={3} className="w-full px-3 py-2 mb-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input value={a.tag} onChange={(e) => updateAthlete(i, "tag", e.target.value)} placeholder="Tag text" className="px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
              <select value={a.tagStyle} onChange={(e) => updateAthlete(i, "tagStyle", e.target.value)} className="px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none">
                <option value="default">Default</option>
                <option value="live">Live</option>
                <option value="poy">POY / Rising</option>
              </select>
              <select value={a.size} onChange={(e) => updateAthlete(i, "size", e.target.value)} className="px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none">
                <option value="feature">Feature (6 col)</option>
                <option value="wide">Wide (4 col)</option>
                <option value="std">Standard (3 col)</option>
              </select>
            </div>
            <input value={a.date} onChange={(e) => updateAthlete(i, "date", e.target.value)} placeholder="Date line" className="w-full px-3 py-2 mb-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />

            {/* Photo */}
            <div className="flex items-center gap-2">
              {a.photoUrl ? (
                <div className="flex items-center gap-2 flex-1">
                  <img src={a.photoUrl} alt="" className="w-10 h-10 rounded object-cover border border-gray-700" />
                  <span className="text-xs text-gray-400 truncate flex-1">{a.photoUrl.split("/").pop()}</span>
                  <button onClick={() => updateAthlete(i, "photoUrl", "")} className="text-xs text-gray-500 hover:text-red-400">&times;</button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingPhotoIndex(i)}
                  className="text-xs px-3 py-2 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-[#D73F09] hover:border-[#D73F09] transition-colors w-full"
                >
                  + Select Photo from Media Library
                </button>
              )}
            </div>
          </div>
        ))}
        <button onClick={addAthlete} className="text-xs text-[#D73F09] font-bold hover:underline">+ Add athlete</button>
      </div>

      {editingPhotoIndex !== null && (
        <CampaignMediaPicker
          open={true}
          onClose={() => setEditingPhotoIndex(null)}
          onSelect={(result) => handlePhotoSelect(editingPhotoIndex, result)}
        />
      )}
    </div>
  );
}
