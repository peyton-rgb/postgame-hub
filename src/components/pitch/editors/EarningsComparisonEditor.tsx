"use client";

import type {
  EarningsComparisonSectionData,
  EarningsScenario,
  EarningsScenarioRow,
} from "@/types/pitch";

interface Props {
  data: EarningsComparisonSectionData;
  onChange: (data: EarningsComparisonSectionData) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

export default function EarningsComparisonEditor({ data, onChange }: Props) {
  const patch = (p: Partial<EarningsComparisonSectionData>) =>
    onChange({ ...data, ...p });

  function updateScenario(
    si: number,
    field: keyof EarningsScenario,
    val: any,
  ) {
    const scenarios = [...data.scenarios];
    scenarios[si] = { ...scenarios[si], [field]: val } as EarningsScenario;
    patch({ scenarios });
  }
  function addScenario() {
    patch({
      scenarios: [
        ...data.scenarios,
        { title: "", rows: [], totalLabel: "Total earned", totalValue: "$0" },
      ],
    });
  }
  function removeScenario(si: number) {
    patch({ scenarios: data.scenarios.filter((_, i) => i !== si) });
  }

  function updateRow(
    si: number,
    ri: number,
    field: keyof EarningsScenarioRow,
    val: string,
  ) {
    const scenarios = [...data.scenarios];
    const rows = [...scenarios[si].rows];
    rows[ri] = { ...rows[ri], [field]: val };
    scenarios[si] = { ...scenarios[si], rows };
    patch({ scenarios });
  }
  function addRow(si: number) {
    const scenarios = [...data.scenarios];
    scenarios[si] = {
      ...scenarios[si],
      rows: [...scenarios[si].rows, { item: "", income: "", playerEarns: "" }],
    };
    patch({ scenarios });
  }
  function removeRow(si: number, ri: number) {
    const scenarios = [...data.scenarios];
    scenarios[si] = {
      ...scenarios[si],
      rows: scenarios[si].rows.filter((_, i) => i !== ri),
    };
    patch({ scenarios });
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
          placeholder="Example Scenario"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Intro
        </label>
        <textarea
          value={data.intro ?? ""}
          onChange={(e) => patch({ intro: e.target.value || undefined })}
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Scenarios ({data.scenarios.length})
        </label>
        {data.scenarios.map((s, si) => (
          <div
            key={si}
            className="border border-gray-800 rounded-lg p-3 mb-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#D73F09]">
                {s.title || `Scenario ${si + 1}`}
              </span>
              <button
                onClick={() => removeScenario(si)}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                &times; Remove
              </button>
            </div>
            <input
              value={s.title}
              onChange={(e) => updateScenario(si, "title", e.target.value)}
              placeholder="Title (e.g. Postgame Representation)"
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={s.emphasized ?? false}
                onChange={(e) =>
                  updateScenario(si, "emphasized", e.target.checked)
                }
              />
              Emphasized (orange highlight)
            </label>

            <div className="space-y-2">
              {s.rows.map((row, ri) => (
                <div
                  key={ri}
                  className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2"
                >
                  <input
                    value={row.item}
                    onChange={(e) =>
                      updateRow(si, ri, "item", e.target.value)
                    }
                    placeholder="Item"
                    className={inputClass}
                  />
                  <input
                    value={row.income}
                    onChange={(e) =>
                      updateRow(si, ri, "income", e.target.value)
                    }
                    placeholder="Income"
                    className={inputClass}
                  />
                  <input
                    value={row.playerEarns}
                    onChange={(e) =>
                      updateRow(si, ri, "playerEarns", e.target.value)
                    }
                    placeholder="Earns"
                    className={inputClass}
                  />
                  <button
                    onClick={() => removeRow(si, ri)}
                    className="text-xs text-gray-500 hover:text-red-400"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={() => addRow(si)}
                className="text-xs text-[#D73F09] font-bold hover:underline"
              >
                + Add row
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={s.totalLabel}
                onChange={(e) =>
                  updateScenario(si, "totalLabel", e.target.value)
                }
                placeholder="Total label"
                className={inputClass}
              />
              <input
                value={s.totalValue}
                onChange={(e) =>
                  updateScenario(si, "totalValue", e.target.value)
                }
                placeholder="Total value"
                className={inputClass}
              />
            </div>
            <input
              value={s.totalNote ?? ""}
              onChange={(e) =>
                updateScenario(si, "totalNote", e.target.value || undefined)
              }
              placeholder="Total note (optional)"
              className={inputClass}
            />
          </div>
        ))}
        <button
          onClick={addScenario}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add scenario
        </button>
      </div>
    </div>
  );
}
