"use client";

import type { HeroSectionData } from "@/types/pitch";

interface Props {
  data: HeroSectionData;
  onChange: (data: HeroSectionData) => void;
}

export default function HeroEditor({ data, onChange }: Props) {
  function updateStat(index: number, field: "value" | "label", val: string) {
    const stats = [...data.stats];
    stats[index] = { ...stats[index], [field]: val };
    onChange({ ...data, stats });
  }

  function updateNavMeta(index: number, field: "label" | "value", val: string) {
    const navMeta = [...data.navMeta];
    navMeta[index] = { ...navMeta[index], [field]: val };
    onChange({ ...data, navMeta });
  }

  function updateDeck(index: number, val: string) {
    const deckParagraphs = [...data.deckParagraphs];
    deckParagraphs[index] = val;
    onChange({ ...data, deckParagraphs });
  }

  return (
    <div className="space-y-5">
      <Field label="Nav Brand" value={data.navBrand} onChange={(v) => onChange({ ...data, navBrand: v })} />

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Nav Meta</label>
        {data.navMeta.map((m, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={m.label} onChange={(e) => updateNavMeta(i, "label", e.target.value)} placeholder="Label" className="w-24 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
            <input value={m.value} onChange={(e) => updateNavMeta(i, "value", e.target.value)} placeholder="Value" className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
          </div>
        ))}
      </div>

      <Field label="Top Left" value={data.topLeft} onChange={(v) => onChange({ ...data, topLeft: v })} />
      <Field label="Top Right" value={data.topRight} onChange={(v) => onChange({ ...data, topRight: v })} />
      <TextArea label="Title (HTML)" value={data.title} onChange={(v) => onChange({ ...data, title: v })} rows={4} />
      <Field label="Stamp Text" value={data.stamp} onChange={(v) => onChange({ ...data, stamp: v })} />
      <TextArea label="Lede (HTML)" value={data.lede} onChange={(v) => onChange({ ...data, lede: v })} rows={3} />

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Deck Paragraphs</label>
        {data.deckParagraphs.map((p, i) => (
          <textarea key={i} value={p} onChange={(e) => updateDeck(i, e.target.value)} rows={3} className="w-full px-3 py-2 mb-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-none" />
        ))}
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Stats</label>
        {data.stats.map((s, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={s.value} onChange={(e) => updateStat(i, "value", e.target.value)} placeholder="Value" className="w-20 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
            <input value={s.label} onChange={(e) => updateStat(i, "label", e.target.value)} placeholder="Label" className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none" />
          </div>
        ))}
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
