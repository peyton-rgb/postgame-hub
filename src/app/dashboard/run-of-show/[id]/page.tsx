"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type {
  RunOfShow,
  RosShoot,
  RosContact,
  RosShotSection,
  RosTimelineItem,
} from "@/lib/types";
import Link from "next/link";

// ─── Default shot list templates ───────────────────────────
const defaultParadeShotList: RosShotSection[] = [
  {
    category: "Parade & Restaurant Shots (Top Priority)",
    shots: [
      "Hero shot: float passing in front of a restaurant (if applicable)",
      "Float in front of local landmarks / points of interest",
      "Any branded signage/moments along parade route",
      "Wide shot of float moving with crowd showing branding",
    ],
  },
  {
    category: "Crew & Gear",
    shots: [
      "Crew members wearing branded gear participating in parade",
      "Crew on foot interacting with crowd — throwing/handing out items",
      "Crew on float — waving, throwing items",
      "Close-ups of branded swag being distributed",
      "Crew holding parade sponsor banner in front of float",
    ],
  },
  {
    category: "Float Coverage",
    shots: [
      "All four sides of float — wide, panning to show entire side",
      "All four sides of float — close, panning to show detail",
      "Close-ups of branded swag",
    ],
  },
  {
    category: "Crowd & Atmosphere",
    shots: [
      "Cheering attendees — close-ups showing excitement",
      "Cheering attendees — wide shots to show size of crowds",
    ],
  },
];

const defaultStandardShotList: RosShotSection[] = [
  {
    category: "Hero Shots (Top Priority)",
    shots: [
      "Wide establishing shot of the venue/location",
      "Close-ups of branded signage or materials",
      "Key talent/athlete shots with branding visible",
    ],
  },
  {
    category: "Action & Content",
    shots: [
      "Action footage of talent performing/working",
      "Behind-the-scenes moments",
      "Product/brand interaction shots",
    ],
  },
  {
    category: "Atmosphere",
    shots: [
      "Crowd/audience reactions",
      "Detail shots of environment and setup",
      "Wide shots showing scale and energy",
    ],
  },
];

const defaultParadeTimeline: RosTimelineItem[] = [
  {
    time: "",
    title: "Arrive On Location",
    description:
      "Set up gear, scout shooting positions, confirm float/crew location",
    highlight: true,
  },
  {
    time: "",
    title: "Event Begins",
    description: "Start capturing coverage and atmosphere",
  },
  {
    time: "Ongoing",
    title: "Main Coverage",
    description: "Capture all priority shots, crew interactions, branded moments",
  },
  {
    time: "Ongoing",
    title: "Crowd & Atmosphere",
    description: "Wide and close crowd shots, landmark shots, branded signage",
  },
  {
    time: "End",
    title: "Wrap",
    description:
      "Final shots, review footage, confirm all shot list items captured",
  },
];

// ─── Shoot Edit Modal ──────────────────────────────────────
function ShootModal({
  shoot,
  onSave,
  onClose,
}: {
  shoot: Partial<RosShoot> | null;
  onSave: (data: Partial<RosShoot>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<RosShoot>>(shoot || {});
  const [activeTab, setActiveTab] = useState<
    "details" | "shotlist" | "timeline"
  >("details");
  const [newShotCategory, setNewShotCategory] = useState("");
  const [newShotText, setNewShotText] = useState("");

  useEffect(() => {
    setForm(shoot || {});
  }, [shoot]);

  function updateForm(updates: Partial<RosShoot>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function addShotSection() {
    if (!newShotCategory.trim()) return;
    const list = [...(form.shot_list || [])];
    list.push({ category: newShotCategory, shots: [] });
    updateForm({ shot_list: list });
    setNewShotCategory("");
  }

  function addShotToSection(sectionIdx: number) {
    if (!newShotText.trim()) return;
    const list = [...(form.shot_list || [])];
    list[sectionIdx] = {
      ...list[sectionIdx],
      shots: [...list[sectionIdx].shots, newShotText],
    };
    updateForm({ shot_list: list });
    setNewShotText("");
  }

  function removeShotFromSection(sectionIdx: number, shotIdx: number) {
    const list = [...(form.shot_list || [])];
    list[sectionIdx] = {
      ...list[sectionIdx],
      shots: list[sectionIdx].shots.filter((_, i) => i !== shotIdx),
    };
    updateForm({ shot_list: list });
  }

  function removeShotSection(sectionIdx: number) {
    const list = (form.shot_list || []).filter((_, i) => i !== sectionIdx);
    updateForm({ shot_list: list });
  }

  function addTimelineItem() {
    const timeline = [...(form.timeline || [])];
    timeline.push({ time: "", title: "", description: "" });
    updateForm({ timeline });
  }

  function updateTimelineItem(idx: number, updates: Partial<RosTimelineItem>) {
    const timeline = [...(form.timeline || [])];
    timeline[idx] = { ...timeline[idx], ...updates };
    updateForm({ timeline });
  }

  function removeTimelineItem(idx: number) {
    const timeline = (form.timeline || []).filter((_, i) => i !== idx);
    updateForm({ timeline });
  }

  const tabs = [
    { key: "details" as const, label: "Details" },
    { key: "shotlist" as const, label: "Shot List" },
    { key: "timeline" as const, label: "Timeline" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-gray-700 rounded-2xl w-[700px] max-h-[85vh] flex flex-col">
        {/* Modal header */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="text-lg font-black mb-4">
            {shoot?.id ? "Edit Shoot" : "Add Shoot"}
          </h2>
          <div className="flex gap-1 bg-black rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeTab === tab.key
                    ? "bg-[#D73F09] text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-8 pb-4">
          {activeTab === "details" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    City *
                  </label>
                  <input
                    value={form.city || ""}
                    onChange={(e) => updateForm({ city: e.target.value })}
                    placeholder="e.g. Philadelphia"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    State *
                  </label>
                  <input
                    value={form.state || ""}
                    onChange={(e) => updateForm({ state: e.target.value })}
                    placeholder="e.g. PA"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Event Name *
                </label>
                <input
                  value={form.event_name || ""}
                  onChange={(e) => updateForm({ event_name: e.target.value })}
                  placeholder="e.g. The 2026 Philadelphia St. Patrick's Day Parade"
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Date *
                  </label>
                  <input
                    value={form.date || ""}
                    onChange={(e) => updateForm({ date: e.target.value })}
                    placeholder="Saturday, March 14, 2026"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Event Start Time *
                  </label>
                  <input
                    value={form.event_start_time || ""}
                    onChange={(e) =>
                      updateForm({ event_start_time: e.target.value })
                    }
                    placeholder="10:00 AM"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Arrival Time *
                  </label>
                  <input
                    value={form.arrival_time || ""}
                    onChange={(e) =>
                      updateForm({ arrival_time: e.target.value })
                    }
                    placeholder="9:30 AM"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Shoot Type
                  </label>
                  <select
                    value={form.shoot_type || "standard"}
                    onChange={(e) =>
                      updateForm({ shoot_type: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  >
                    <option value="standard">Standard</option>
                    <option value="parade">Parade</option>
                    <option value="river-dyeing">River Dyeing</option>
                    <option value="photo-shoot">Photo Shoot</option>
                    <option value="video-shoot">Video Shoot</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Type Label (badge text, optional)
                  </label>
                  <input
                    value={form.type_label || ""}
                    onChange={(e) =>
                      updateForm({ type_label: e.target.value })
                    }
                    placeholder="e.g. River Dyeing"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Videographer *
                  </label>
                  <input
                    value={form.videographer || ""}
                    onChange={(e) =>
                      updateForm({ videographer: e.target.value })
                    }
                    placeholder="e.g. Trey T."
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Videographer Phone
                  </label>
                  <input
                    value={form.videographer_phone || ""}
                    onChange={(e) =>
                      updateForm({ videographer_phone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Starting Address / Location
                </label>
                <input
                  value={form.starting_address || ""}
                  onChange={(e) =>
                    updateForm({ starting_address: e.target.value })
                  }
                  placeholder="e.g. 16th Street and JFK Boulevard"
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Event Website
                </label>
                <input
                  value={form.website || ""}
                  onChange={(e) => updateForm({ website: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Google Drive Content Folder
                </label>
                <input
                  value={form.content_folder_url || ""}
                  onChange={(e) =>
                    updateForm({ content_folder_url: e.target.value })
                  }
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Client Contact Name
                  </label>
                  <input
                    value={form.client_contact_name || ""}
                    onChange={(e) =>
                      updateForm({ client_contact_name: e.target.value })
                    }
                    placeholder="e.g. Kevin Matthews"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Client Contact Phone
                  </label>
                  <input
                    value={form.client_contact_phone || ""}
                    onChange={(e) =>
                      updateForm({ client_contact_phone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "shotlist" && (
            <div className="space-y-4">
              {(!form.shot_list || form.shot_list.length === 0) && (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-4">
                    No shot list yet. Load a template or add sections manually.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() =>
                        updateForm({
                          shot_list:
                            form.shoot_type === "parade"
                              ? defaultParadeShotList
                              : defaultStandardShotList,
                        })
                      }
                      className="px-4 py-2 bg-[#D73F09] text-white text-xs font-bold rounded-lg hover:bg-[#B33407]"
                    >
                      Load{" "}
                      {form.shoot_type === "parade" ? "Parade" : "Standard"}{" "}
                      Template
                    </button>
                  </div>
                </div>
              )}

              {(form.shot_list || []).map((section, sIdx) => (
                <div
                  key={sIdx}
                  className="bg-black border border-gray-700 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                    <input
                      value={section.category}
                      onChange={(e) => {
                        const list = [...(form.shot_list || [])];
                        list[sIdx] = {
                          ...list[sIdx],
                          category: e.target.value,
                        };
                        updateForm({ shot_list: list });
                      }}
                      className="bg-transparent text-white font-bold text-sm flex-1 outline-none"
                    />
                    <button
                      onClick={() => removeShotSection(sIdx)}
                      className="text-gray-600 hover:text-red-400 text-xs ml-2"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    {section.shots.map((shot, shotIdx) => (
                      <div
                        key={shotIdx}
                        className="flex items-start gap-2 group"
                      >
                        <span className="w-4 h-4 rounded border border-gray-600 flex-shrink-0 mt-1" />
                        <input
                          value={shot}
                          onChange={(e) => {
                            const list = [...(form.shot_list || [])];
                            const shots = [...list[sIdx].shots];
                            shots[shotIdx] = e.target.value;
                            list[sIdx] = { ...list[sIdx], shots };
                            updateForm({ shot_list: list });
                          }}
                          className="flex-1 bg-transparent text-gray-300 text-sm outline-none"
                        />
                        <button
                          onClick={() =>
                            removeShotFromSection(sIdx, shotIdx)
                          }
                          className="text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input
                        placeholder="Add a shot..."
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white outline-none focus:border-[#D73F09]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const target = e.target as HTMLInputElement;
                            if (target.value.trim()) {
                              const list = [...(form.shot_list || [])];
                              list[sIdx] = {
                                ...list[sIdx],
                                shots: [
                                  ...list[sIdx].shots,
                                  target.value.trim(),
                                ],
                              };
                              updateForm({ shot_list: list });
                              target.value = "";
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {(form.shot_list || []).length > 0 && (
                <div className="flex gap-2">
                  <input
                    value={newShotCategory}
                    onChange={(e) => setNewShotCategory(e.target.value)}
                    placeholder="New section name..."
                    className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
                    onKeyDown={(e) => e.key === "Enter" && addShotSection()}
                  />
                  <button
                    onClick={addShotSection}
                    className="px-4 py-3 border border-gray-700 rounded-lg text-gray-400 text-sm font-bold hover:border-[#D73F09] hover:text-[#D73F09]"
                  >
                    + Section
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-4">
              {(!form.timeline || form.timeline.length === 0) && (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-4">
                    No timeline items. Load the default template to start.
                  </p>
                  <button
                    onClick={() =>
                      updateForm({ timeline: defaultParadeTimeline })
                    }
                    className="px-4 py-2 bg-[#D73F09] text-white text-xs font-bold rounded-lg hover:bg-[#B33407]"
                  >
                    Load Default Timeline
                  </button>
                </div>
              )}

              {(form.timeline || []).map((item, idx) => (
                <div
                  key={idx}
                  className="bg-black border border-gray-700 rounded-xl p-4 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          value={item.time}
                          onChange={(e) =>
                            updateTimelineItem(idx, { time: e.target.value })
                          }
                          placeholder="Time"
                          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white outline-none focus:border-[#D73F09]"
                        />
                        <input
                          value={item.title}
                          onChange={(e) =>
                            updateTimelineItem(idx, { title: e.target.value })
                          }
                          placeholder="Title"
                          className="col-span-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white outline-none focus:border-[#D73F09]"
                        />
                      </div>
                      <input
                        value={item.description}
                        onChange={(e) =>
                          updateTimelineItem(idx, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Description"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white outline-none focus:border-[#D73F09]"
                      />
                      <label className="flex items-center gap-2 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={item.highlight || false}
                          onChange={(e) =>
                            updateTimelineItem(idx, {
                              highlight: e.target.checked,
                            })
                          }
                          className="accent-[#D73F09]"
                        />
                        Highlight this item
                      </label>
                    </div>
                    <button
                      onClick={() => removeTimelineItem(idx)}
                      className="text-gray-600 hover:text-red-400 text-xs mt-2"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}

              {(form.timeline || []).length > 0 && (
                <button
                  onClick={addTimelineItem}
                  className="w-full px-4 py-3 border border-dashed border-gray-700 rounded-lg text-gray-500 text-sm font-bold hover:border-[#D73F09] hover:text-[#D73F09]"
                >
                  + Add Timeline Item
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-8 py-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-700 rounded-lg text-gray-400 font-bold text-sm hover:border-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex-1 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm hover:bg-[#B33407]"
          >
            {shoot?.id ? "Save Changes" : "Add Shoot"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Editor Page ──────────────────────────────────────
export default function RunOfShowEditor() {
  const { id } = useParams<{ id: string }>();
  const supabase = createBrowserSupabase();

  const [ros, setRos] = useState<RunOfShow | null>(null);
  const [shoots, setShoots] = useState<RosShoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editShoot, setEditShoot] = useState<Partial<RosShoot> | null>(null);
  const [showShootModal, setShowShootModal] = useState(false);

  // Campaign-level form state
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [eventName, setEventName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [cameraSettings, setCameraSettings] = useState("");
  const [contacts, setContacts] = useState<RosContact[]>([]);
  const [published, setPublished] = useState(false);

  const loadData = useCallback(async () => {
    const [rosRes, shootsRes] = await Promise.all([
      supabase.from("run_of_shows").select("*").eq("id", id).single(),
      supabase
        .from("ros_shoots")
        .select("*")
        .eq("run_of_show_id", id)
        .order("sort_order"),
    ]);

    if (rosRes.data) {
      const r = rosRes.data;
      setRos(r);
      setName(r.name);
      setClientName(r.client_name);
      setEventName(r.event_name || "");
      setSubtitle(r.subtitle || "");
      setCameraSettings(
        r.camera_settings ||
          "Shoot in S-Log · 60fps · Same-day uploads mandatory"
      );
      const defaultContacts = [
        { name: "Aaron H.", phone: "(941) 786-5956", initials: "AH" },
        { name: "Peyton J.", phone: "(941) 567-8565", initials: "PJ" },
        { name: "Dom M.", phone: "(352) 530-7027", initials: "DM" },
      ];
      setContacts(r.contacts && r.contacts.length > 0 ? r.contacts : defaultContacts);
      setPublished(r.published);
    }
    setShoots(shootsRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveCampaignSettings() {
    setSaving(true);
    await supabase
      .from("run_of_shows")
      .update({
        name,
        client_name: clientName,
        event_name: eventName || null,
        subtitle: subtitle || null,
        camera_settings: cameraSettings,
        contacts,
        published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setSaving(false);
  }

  async function saveShoot(data: Partial<RosShoot>) {
    const slug =
      data.slug ||
      (data.city || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const shootData = {
      run_of_show_id: id,
      slug,
      event_name: data.event_name || "",
      city: data.city || "",
      state: data.state || "",
      date: data.date || "",
      event_start_time: data.event_start_time || "",
      arrival_time: data.arrival_time || "",
      videographer: data.videographer || "TBD",
      videographer_phone: data.videographer_phone || null,
      starting_address: data.starting_address || null,
      website: data.website || null,
      shoot_type: data.shoot_type || "standard",
      type_label: data.type_label || null,
      content_folder_url: data.content_folder_url || null,
      client_contact_name: data.client_contact_name || null,
      client_contact_phone: data.client_contact_phone || null,
      shot_list: data.shot_list || [],
      timeline: data.timeline || [],
      sort_order: data.sort_order ?? shoots.length,
    };

    if (data.id) {
      // Update existing
      await supabase.from("ros_shoots").update(shootData).eq("id", data.id);
    } else {
      // Insert new
      await supabase.from("ros_shoots").insert(shootData);
    }

    setShowShootModal(false);
    setEditShoot(null);
    loadData();
  }

  async function deleteShoot(shootId: string) {
    await supabase.from("ros_shoots").delete().eq("id", shootId);
    setShoots((prev) => prev.filter((s) => s.id !== shootId));
  }

  function addContact() {
    setContacts([...contacts, { name: "", phone: "", initials: "" }]);
  }

  function updateContact(idx: number, updates: Partial<RosContact>) {
    const updated = [...contacts];
    updated[idx] = { ...updated[idx], ...updates };
    setContacts(updated);
  }

  function removeContact(idx: number) {
    setContacts(contacts.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!ros) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Run of show not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/run-of-show"
            className="text-xs text-gray-500 hover:text-gray-300 mb-1 block"
          >
            ← Back to Run of Shows
          </Link>
          <div className="text-xs font-bold uppercase tracking-[3px] text-[#D73F09] mb-1">
            {ros.client_name}
          </div>
          <h1 className="text-xl font-black">{ros.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {published && (
            <Link
              href={`/run-of-show/${ros.slug}`}
              target="_blank"
              className="px-4 py-2 border border-gray-700 text-gray-400 text-sm font-bold rounded-lg hover:border-gray-500"
            >
              View Public Page →
            </Link>
          )}
          <button
            onClick={saveCampaignSettings}
            disabled={saving}
            className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="p-8 max-w-5xl mx-auto">
        {/* Campaign Settings */}
        <div className="mb-10">
          <h2 className="text-lg font-black mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D73F09] inline-block" />
            Campaign Settings
          </h2>
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Campaign Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Brand / Client
                </label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Event Name
                </label>
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. St. Patrick's Day 2026"
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Subtitle
                </label>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Run of Shows — 7 Shoots Nationwide"
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Camera Settings Banner
              </label>
              <input
                value={cameraSettings}
                onChange={(e) => setCameraSettings(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="accent-[#D73F09] w-4 h-4"
                />
                <span className="text-sm font-bold text-gray-300">
                  Published
                </span>
              </label>
              {published && (
                <span className="text-xs text-gray-500">
                  Live at /run-of-show/{ros.slug}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Postgame Contacts */}
        <div className="mb-10">
          <h2 className="text-lg font-black mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D73F09] inline-block" />
            Postgame Points of Contact
          </h2>
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
            <div className="space-y-3">
              {contacts.map((contact, idx) => (
                <div key={idx} className="flex items-center gap-3 group">
                  <input
                    value={contact.initials || ""}
                    onChange={(e) =>
                      updateContact(idx, { initials: e.target.value })
                    }
                    placeholder="AB"
                    maxLength={3}
                    className="w-16 px-3 py-3 bg-black border border-gray-700 rounded-lg text-white text-center font-bold focus:border-[#D73F09] outline-none"
                  />
                  <input
                    value={contact.name}
                    onChange={(e) =>
                      updateContact(idx, { name: e.target.value })
                    }
                    placeholder="Name"
                    className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                  <input
                    value={contact.phone}
                    onChange={(e) =>
                      updateContact(idx, { phone: e.target.value })
                    }
                    placeholder="Phone"
                    className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
                  />
                  <button
                    onClick={() => removeContact(idx)}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addContact}
              className="mt-4 px-4 py-2 border border-dashed border-gray-700 rounded-lg text-gray-500 text-sm font-bold hover:border-[#D73F09] hover:text-[#D73F09] w-full"
            >
              + Add Contact
            </button>
          </div>
        </div>

        {/* Shoots */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D73F09] inline-block" />
              Shoots ({shoots.length})
            </h2>
            <button
              onClick={() => {
                setEditShoot({});
                setShowShootModal(true);
              }}
              className="px-4 py-2 bg-[#D73F09] text-white text-xs font-bold rounded-lg hover:bg-[#B33407]"
            >
              + Add Shoot
            </button>
          </div>

          {shoots.length === 0 ? (
            <div className="bg-[#111] border border-gray-800 rounded-xl p-10 text-center">
              <p className="text-gray-500 mb-4">No shoots added yet.</p>
              <button
                onClick={() => {
                  setEditShoot({});
                  setShowShootModal(true);
                }}
                className="text-[#D73F09] font-bold text-sm hover:underline"
              >
                Add your first shoot →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {shoots.map((shoot) => (
                <div
                  key={shoot.id}
                  className="bg-[#111] border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors group"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">
                          {shoot.city}, {shoot.state}
                        </h3>
                        {shoot.type_label && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">
                            {shoot.type_label}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {shoot.event_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                          Date
                        </div>
                        <div className="text-gray-400">{shoot.date}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                          Start
                        </div>
                        <div className="text-gray-400">
                          {shoot.event_start_time}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                          Videographer
                        </div>
                        <div className="text-gray-400">
                          {shoot.videographer}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditShoot(shoot);
                            setShowShootModal(true);
                          }}
                          className="px-3 py-1.5 border border-gray-700 rounded-lg text-gray-400 text-xs font-bold hover:border-[#D73F09] hover:text-[#D73F09] opacity-0 group-hover:opacity-100 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteShoot(shoot.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shoot Edit Modal */}
      {showShootModal && (
        <ShootModal
          shoot={editShoot}
          onSave={saveShoot}
          onClose={() => {
            setShowShootModal(false);
            setEditShoot(null);
          }}
        />
      )}
    </div>
  );
}
