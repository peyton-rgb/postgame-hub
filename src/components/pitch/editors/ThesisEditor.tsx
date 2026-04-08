"use client";

import type { ThesisSectionData } from "@/types/pitch";

interface Props {
  data: ThesisSectionData;
  onChange: (data: ThesisSectionData) => void;
}

export default function ThesisEditor({ data, onChange }: Props) {
  function updateParagraph(index: number, val: string) {
    const paragraphs = [...data.paragraphs];
    paragraphs[index] = val;
    onChange({ ...data, paragraphs });
  }

  function updatePillar(index: number, field: "label" | "text", val: string) {
    const pillars = [...data.pillars];
    pillars[index] = { ...pillars[index], [field]: val };
    onChange({ ...data, pillars });
  }

  function addPillar() {
    onChange({ ...data, pillars: [...data.pillars, { label: "New Pillar", text: "Description" }] });
  }

  function removePillar(index: number) {
    onChange({ ...data, pillars: data.pillars.filter((_, i) => i !== index) });
  }

  function addParagraph() {
    onChange({ ...data, paragraphs: [...data.paragraphs, ""] });
  }

  function removeParagraph(index: number) {
    onChange({ ...data, paragraphs: data.paragraphs.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-5">
      <Field label="Section Label" value={data.sectionLabel} onChange={(v) => onChange({ ...data, sectionLabel: v })} />
      <TextArea label="Heading (HTML)" value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} />
      <Field label="Background Word" value={data.bgWord} onChange={(v) => onChange({ ...data, bgWord: v })} />

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Paragraphs (HTML)</label>
        {data.paragraphs.map((p, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <textarea value={p} onChange={(e) => updateParagraph(i, e.target.value)} rows={3} className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
            <button onClick={() => removeParagraph(i)} className="px-2 text-gray-500 hover:text-red-400 text-sm self-start">&times;</button>
          </div>
        ))}
        <button onClick={addParagraph} className="text-xs text-[#D73F09] font-bold hover:underline">+ Add paragraph</button>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Pillars</label>
        {data.pillars.map((pillar, i) => (
          <div key={i} className="border border-gray-800 rounded-lg p-3 mb-3">
            <div className="flex gap-2 mb-2">
              <input value={pillar.label} onChange={(e) => updatePillar(i, "label", e.target.value)} placeholder="Label" className="w-40 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
              <button onClick={() => removePillar(i)} className="px-2 text-gray-500 hover:text-red-400 text-sm">&times;</button>
            </div>
            <textarea value={pillar.text} onChange={(e) => updatePillar(i, "text", e.target.value)} rows={2} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
          </div>
        ))}
        <button onClick={addPillar} className="text-xs text-[#D73F09] font-bold hover:underline">+ Add pillar</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
    </div>
  );
}
