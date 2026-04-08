"use client";

import type { IdeasSectionData } from "@/types/pitch";

interface Props {
  data: IdeasSectionData;
  onChange: (data: IdeasSectionData) => void;
}

export default function IdeasEditor({ data, onChange }: Props) {
  function updateIdea(index: number, field: keyof IdeasSectionData["ideas"][number], val: string) {
    const ideas = [...data.ideas];
    ideas[index] = { ...ideas[index], [field]: val };
    onChange({ ...data, ideas });
  }

  function addIdea() {
    onChange({
      ...data,
      ideas: [
        ...data.ideas,
        {
          number: `\u2192 IDEA ${String(data.ideas.length + 1).padStart(2, "0")}`,
          name: '"New Idea"',
          description: "",
          channelLabel: "CHANNEL",
          channelValue: "",
        },
      ],
    });
  }

  function removeIdea(index: number) {
    onChange({ ...data, ideas: data.ideas.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Section Tag</label>
        <input type="text" value={data.sectionTag} onChange={(e) => onChange({ ...data, sectionTag: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Heading (HTML)</label>
        <input type="text" value={data.heading} onChange={(e) => onChange({ ...data, heading: e.target.value })} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Description (HTML)</label>
        <textarea value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} rows={3} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Ideas</label>
        {data.ideas.map((idea, i) => (
          <div key={i} className="border border-gray-800 rounded-lg p-3 mb-3">
            <div className="flex gap-2 mb-2">
              <input value={idea.number} onChange={(e) => updateIdea(i, "number", e.target.value)} placeholder="Idea 01" className="w-28 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
              <input value={idea.name} onChange={(e) => updateIdea(i, "name", e.target.value)} placeholder="Name" className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
              <button onClick={() => removeIdea(i)} className="px-2 text-gray-500 hover:text-red-400 text-sm">&times;</button>
            </div>
            <textarea value={idea.description} onChange={(e) => updateIdea(i, "description", e.target.value)} rows={2} placeholder="Description" className="w-full px-3 py-2 mb-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
            <div className="flex gap-2">
              <input value={idea.channelLabel} onChange={(e) => updateIdea(i, "channelLabel", e.target.value)} placeholder="Label" className="w-24 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
              <input value={idea.channelValue} onChange={(e) => updateIdea(i, "channelValue", e.target.value)} placeholder="Channel" className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
            </div>
          </div>
        ))}
        <button onClick={addIdea} className="text-xs text-[#D73F09] font-bold hover:underline">+ Add idea</button>
      </div>
    </div>
  );
}
