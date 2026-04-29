"use client";

import type {
  TalentRosterSectionData,
  TalentRosterGroup,
  TalentRosterAthlete,
} from "@/types/pitch";

interface Props {
  data: TalentRosterSectionData;
  onChange: (data: TalentRosterSectionData) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none";

export default function TalentRosterEditor({ data, onChange }: Props) {
  const patch = (p: Partial<TalentRosterSectionData>) =>
    onChange({ ...data, ...p });

  function updateGroup(
    gi: number,
    field: keyof TalentRosterGroup,
    val: any,
  ) {
    const groups = [...data.groups];
    groups[gi] = { ...groups[gi], [field]: val } as TalentRosterGroup;
    patch({ groups });
  }
  function addGroup() {
    patch({ groups: [...data.groups, { sport: "", athletes: [] }] });
  }
  function removeGroup(gi: number) {
    patch({ groups: data.groups.filter((_, i) => i !== gi) });
  }

  function updateAthlete(
    gi: number,
    ai: number,
    field: keyof TalentRosterAthlete,
    val: string,
  ) {
    const groups = [...data.groups];
    const athletes = [...groups[gi].athletes];
    athletes[ai] = { ...athletes[ai], [field]: val };
    groups[gi] = { ...groups[gi], athletes };
    patch({ groups });
  }
  function addAthlete(gi: number) {
    const groups = [...data.groups];
    groups[gi] = {
      ...groups[gi],
      athletes: [...groups[gi].athletes, { name: "" }],
    };
    patch({ groups });
  }
  function removeAthlete(gi: number, ai: number) {
    const groups = [...data.groups];
    groups[gi] = {
      ...groups[gi],
      athletes: groups[gi].athletes.filter((_, i) => i !== ai),
    };
    patch({ groups });
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
          placeholder="e.g. TALENT ROSTER"
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
          rows={2}
          placeholder="One-line intro shown above the groups"
          className={`${inputClass} resize-y`}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Sport Groups ({data.groups.length})
        </label>
        {data.groups.map((g, gi) => (
          <div
            key={gi}
            className="border border-gray-800 rounded-lg p-3 mb-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#D73F09]">
                {g.sport || `Group ${gi + 1}`}
              </span>
              <button
                onClick={() => removeGroup(gi)}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                &times; Remove sport
              </button>
            </div>
            <input
              value={g.sport}
              onChange={(e) => updateGroup(gi, "sport", e.target.value)}
              placeholder="Sport (e.g. FOOTBALL)"
              className={inputClass}
            />
            <div className="space-y-2 mt-2">
              {g.athletes.map((a, ai) => (
                <div key={ai} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={a.name}
                    onChange={(e) =>
                      updateAthlete(gi, ai, "name", e.target.value)
                    }
                    placeholder="Athlete name"
                    className={inputClass}
                  />
                  <input
                    value={a.team ?? ""}
                    onChange={(e) =>
                      updateAthlete(gi, ai, "team", e.target.value)
                    }
                    placeholder="Team (optional)"
                    className={inputClass}
                  />
                  <button
                    onClick={() => removeAthlete(gi, ai)}
                    className="text-xs text-gray-500 hover:text-red-400"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={() => addAthlete(gi)}
                className="text-xs text-[#D73F09] font-bold hover:underline"
              >
                + Add athlete
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={addGroup}
          className="text-xs text-[#D73F09] font-bold hover:underline"
        >
          + Add sport group
        </button>
      </div>
    </div>
  );
}
