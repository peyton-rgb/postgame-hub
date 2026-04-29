"use client";

import type {
  AgencyComparisonSectionData,
  AgencyComparisonRow,
  AgencyComparisonBenefit,
} from "@/types/pitch";

interface Props {
  data: AgencyComparisonSectionData;
  onChange: (data: AgencyComparisonSectionData) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

export default function AgencyComparisonEditor({ data, onChange }: Props) {
  const patch = (p: Partial<AgencyComparisonSectionData>) =>
    onChange({ ...data, ...p });

  function updateRow(i: number, field: keyof AgencyComparisonRow, val: string) {
    const rows = [...data.rows];
    rows[i] = { ...rows[i], [field]: val };
    patch({ rows });
  }
  function addRow() {
    patch({
      rows: [
        ...data.rows,
        { criterion: "", postgame: "", otherAgency: "", doItYourself: "" },
      ],
    });
  }
  function removeRow(i: number) {
    patch({ rows: data.rows.filter((_, idx) => idx !== i) });
  }

  function updateBenefit(
    i: number,
    field: keyof AgencyComparisonBenefit,
    val: string,
  ) {
    const arr = [...data.benefits];
    arr[i] = { ...arr[i], [field]: val };
    patch({ benefits: arr });
  }
  function addBenefit() {
    patch({ benefits: [...data.benefits, { title: "" }] });
  }
  function removeBenefit(i: number) {
    patch({ benefits: data.benefits.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Heading
          </label>
          <input
            value={data.heading}
            onChange={(e) => patch({ heading: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Subheading
          </label>
          <input
            value={data.subheading ?? ""}
            onChange={(e) => patch({ subheading: e.target.value || undefined })}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Table Label
        </label>
        <input
          value={data.tableLabel ?? ""}
          onChange={(e) => patch({ tableLabel: e.target.value || undefined })}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Comparison Rows ({data.rows.length})
        </label>
        {data.rows.map((row, i) => (
          <div key={i} className="border border-gray-800 rounded-lg p-3 mb-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#D73F09]">Row {i + 1}</span>
              <button
                onClick={() => removeRow(i)}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                &times;
              </button>
            </div>
            <input
              value={row.criterion}
              onChange={(e) => updateRow(i, "criterion", e.target.value)}
              placeholder="Criterion (e.g. Marketing Deals)"
              className={inputClass}
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                value={row.postgame}
                onChange={(e) => updateRow(i, "postgame", e.target.value)}
                placeholder="Postgame"
                className={inputClass}
              />
              <input
                value={row.otherAgency}
                onChange={(e) => updateRow(i, "otherAgency", e.target.value)}
                placeholder="'Other' Agency"
                className={inputClass}
              />
              <input
                value={row.doItYourself}
                onChange={(e) => updateRow(i, "doItYourself", e.target.value)}
                placeholder="Do It Yourself"
                className={inputClass}
              />
            </div>
          </div>
        ))}
        <button
          onClick={addRow}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add row
        </button>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Benefits Heading + Intro
        </label>
        <input
          value={data.benefitsLabel ?? ""}
          onChange={(e) =>
            patch({ benefitsLabel: e.target.value || undefined })
          }
          placeholder="Benefits Overview"
          className={`${inputClass} mb-2`}
        />
        <textarea
          value={data.benefitsIntro ?? ""}
          onChange={(e) =>
            patch({ benefitsIntro: e.target.value || undefined })
          }
          rows={2}
          placeholder="Intro line above bullets"
          className={`${inputClass} resize-y`}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Benefits ({data.benefits.length})
        </label>
        {data.benefits.map((b, i) => (
          <div key={i} className="border border-gray-800 rounded-lg p-3 mb-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#D73F09]">
                Benefit {i + 1}
              </span>
              <button
                onClick={() => removeBenefit(i)}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                &times;
              </button>
            </div>
            <input
              value={b.title}
              onChange={(e) => updateBenefit(i, "title", e.target.value)}
              placeholder="Title"
              className={inputClass}
            />
            <textarea
              value={b.description ?? ""}
              onChange={(e) =>
                updateBenefit(i, "description", e.target.value)
              }
              rows={3}
              placeholder="Description"
              className={`${inputClass} resize-y`}
            />
          </div>
        ))}
        <button
          onClick={addBenefit}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add benefit
        </button>
      </div>
    </div>
  );
}
