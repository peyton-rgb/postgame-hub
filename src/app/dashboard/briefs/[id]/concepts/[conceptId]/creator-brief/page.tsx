// ============================================================
// Creator Brief Editor — staff-facing page
// /dashboard/briefs/[id]/concepts/[conceptId]/creator-brief
//
// Loads or generates a creator brief for an approved concept.
// Lets the AM fill in shoot logistics (date, time, location,
// Postgame contacts, videographer), edit any section, and publish.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CreatorBrief,
  CreatorBriefSection,
  ShootLogisticsContent,
  ShootContact,
  PostgameStaffMember,
  Videographer,
} from '@/lib/types/briefs';

// ---- Shoot Logistics Editor Component ----
function ShootLogisticsEditor({
  content,
  staff,
  videographers,
  onUpdate,
  onAddVideographer,
}: {
  content: ShootLogisticsContent;
  staff: PostgameStaffMember[];
  videographers: Videographer[];
  onUpdate: (updated: ShootLogisticsContent) => void;
  onAddVideographer: (name: string, phone: string) => void;
}) {
  const [showAddVid, setShowAddVid] = useState(false);
  const [newVidName, setNewVidName] = useState('');
  const [newVidPhone, setNewVidPhone] = useState('');

  function addPostgameContact(staffMember: PostgameStaffMember) {
    if (content.postgame_contacts.length >= 3) return;
    if (content.postgame_contacts.some((c) => c.id === staffMember.id)) return;
    onUpdate({
      ...content,
      postgame_contacts: [
        ...content.postgame_contacts,
        { id: staffMember.id, name: staffMember.name, phone: '', role: '', email: staffMember.email },
      ],
    });
  }

  function updateContact(index: number, field: keyof ShootContact, value: string) {
    const updated = [...content.postgame_contacts];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate({ ...content, postgame_contacts: updated });
  }

  function removeContact(index: number) {
    onUpdate({
      ...content,
      postgame_contacts: content.postgame_contacts.filter((_, i) => i !== index),
    });
  }

  function selectVideographer(vid: Videographer) {
    onUpdate({
      ...content,
      videographer: {
        id: vid.id,
        name: vid.name,
        phone: vid.phone || '',
        role: 'Videographer',
        email: vid.email || undefined,
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Date, Time, Location */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Shoot Date</label>
          <input
            type="date"
            value={content.shoot_date || ''}
            onChange={(e) => onUpdate({ ...content, shoot_date: e.target.value || null })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-[#D73F09] focus:outline-none [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Shoot Time</label>
          <input
            type="time"
            value={content.shoot_time || ''}
            onChange={(e) => onUpdate({ ...content, shoot_time: e.target.value || null })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-[#D73F09] focus:outline-none [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Location</label>
          <input
            type="text"
            value={content.location || ''}
            onChange={(e) => onUpdate({ ...content, location: e.target.value || null })}
            placeholder="e.g. Austin, TX — DKR Stadium"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:border-[#D73F09] focus:outline-none"
          />
        </div>
      </div>

      {/* Postgame Contacts */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">
          Postgame Contacts
          <span className="text-gray-600 ml-1">(up to 3)</span>
        </label>

        {content.postgame_contacts.map((contact, i) => (
          <div key={contact.id} className="flex items-center gap-3 mb-2 bg-gray-800 rounded-lg px-4 py-3">
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="text-white text-sm font-medium">{contact.name}</div>
              <input
                type="text"
                value={contact.phone}
                onChange={(e) => updateContact(i, 'phone', e.target.value)}
                placeholder="Phone"
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white text-sm placeholder-gray-500"
              />
              <input
                type="text"
                value={contact.role}
                onChange={(e) => updateContact(i, 'role', e.target.value)}
                placeholder="Role (e.g. AM, Producer)"
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white text-sm placeholder-gray-500"
              />
            </div>
            <button
              onClick={() => removeContact(i)}
              className="text-gray-500 hover:text-red-400 text-lg"
            >
              &times;
            </button>
          </div>
        ))}

        {content.postgame_contacts.length < 3 && (
          <div className="relative">
            <select
              onChange={(e) => {
                const s = staff.find((m) => m.id === e.target.value);
                if (s) addPostgameContact(s);
                e.target.value = '';
              }}
              defaultValue=""
              className="w-full bg-gray-800 border border-gray-700 border-dashed rounded-lg px-4 py-2.5 text-gray-400 text-sm focus:border-[#D73F09] focus:outline-none appearance-none cursor-pointer"
            >
              <option value="" disabled>
                + Add Postgame contact...
              </option>
              {staff
                .filter((s) => !content.postgame_contacts.some((c) => c.id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Videographer */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Videographer</label>

        {content.videographer ? (
          <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="text-white text-sm font-medium">{content.videographer.name}</div>
              <div className="text-gray-400 text-sm">{content.videographer.phone || 'No phone'}</div>
              <div className="text-gray-400 text-sm">{content.videographer.role}</div>
            </div>
            <button
              onClick={() => onUpdate({ ...content, videographer: null })}
              className="text-gray-500 hover:text-red-400 text-sm"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <select
              onChange={(e) => {
                const v = videographers.find((vid) => vid.id === e.target.value);
                if (v) selectVideographer(v);
                e.target.value = '';
              }}
              defaultValue=""
              className="w-full bg-gray-800 border border-gray-700 border-dashed rounded-lg px-4 py-2.5 text-gray-400 text-sm focus:border-[#D73F09] focus:outline-none appearance-none cursor-pointer"
            >
              <option value="" disabled>
                {videographers.length === 0
                  ? 'No videographers yet — add one below'
                  : '+ Select videographer...'}
              </option>
              {videographers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.phone ? `(${v.phone})` : ''}
                </option>
              ))}
            </select>

            {/* Quick-add videographer */}
            {!showAddVid ? (
              <button
                onClick={() => setShowAddVid(true)}
                className="text-[#D73F09] text-xs hover:underline"
              >
                + Add new videographer
              </button>
            ) : (
              <div className="flex gap-2 items-end">
                <input
                  type="text"
                  value={newVidName}
                  onChange={(e) => setNewVidName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm placeholder-gray-500"
                />
                <input
                  type="tel"
                  value={newVidPhone}
                  onChange={(e) => setNewVidPhone(e.target.value)}
                  placeholder="Phone"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm placeholder-gray-500"
                />
                <button
                  onClick={() => {
                    if (newVidName.trim()) {
                      onAddVideographer(newVidName.trim(), newVidPhone.trim());
                      setNewVidName('');
                      setNewVidPhone('');
                      setShowAddVid(false);
                    }
                  }}
                  className="px-4 py-2 bg-[#D73F09] text-white rounded text-sm font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowAddVid(false)}
                  className="px-3 py-2 bg-gray-800 text-gray-400 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main page component ----
export default function CreatorBriefEditorPage({
  params,
}: {
  params: { id: string; conceptId: string };
}) {
  const router = useRouter();
  const { id: briefId, conceptId } = params;

  const [creatorBrief, setCreatorBrief] = useState<CreatorBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Dropdown data
  const [staff, setStaff] = useState<PostgameStaffMember[]>([]);
  const [videographers, setVideographers] = useState<Videographer[]>([]);

  // Load staff + videographers for dropdowns
  useEffect(() => {
    Promise.all([
      fetch('/api/staff').then((r) => r.ok ? r.json() : []),
      fetch('/api/videographers').then((r) => r.ok ? r.json() : []),
    ]).then(([s, v]) => {
      setStaff(s);
      setVideographers(v);
    });
  }, []);

  // Load existing creator brief or check if one needs to be generated
  useEffect(() => {
    async function load() {
      // Check for an existing creator brief for this concept
      const res = await fetch(`/api/creator-briefs?concept_id=${conceptId}`);
      if (res.ok) {
        const briefs = await res.json();
        if (briefs.length > 0) {
          // Load the full brief
          const fullRes = await fetch(`/api/creator-briefs/${briefs[0].id}`);
          if (fullRes.ok) {
            setCreatorBrief(await fullRes.json());
            setLoading(false);
            return;
          }
        }
      }

      // No existing brief — generate one
      setGenerating(true);
      setLoading(false);
      try {
        const genRes = await fetch('/api/creator-briefs/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ concept_id: conceptId }),
        });
        if (!genRes.ok) {
          const data = await genRes.json();
          throw new Error(data.error || 'Generation failed');
        }
        setCreatorBrief(await genRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate brief');
      }
      setGenerating(false);
    }
    load();
  }, [conceptId]);

  // Auto-save when sections change (debounced)
  const saveToServer = useCallback(async (brief: CreatorBrief) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/creator-briefs/${brief.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: brief.sections,
          title: brief.title,
          athlete_name: brief.athlete_name,
          brand_color: brief.brand_color,
          brand_logo_url: brief.brand_logo_url,
        }),
      });
      if (res.ok) {
        setLastSaved(new Date().toLocaleTimeString());
      }
    } catch {
      // Silent fail on auto-save
    }
    setSaving(false);
  }, []);

  // Update a specific section
  function updateSection(index: number, updated: CreatorBriefSection) {
    if (!creatorBrief) return;
    const newSections = [...creatorBrief.sections];
    newSections[index] = updated;
    const newBrief = { ...creatorBrief, sections: newSections };
    setCreatorBrief(newBrief);
    // Debounced save
    setTimeout(() => saveToServer(newBrief), 500);
  }

  // Update metadata
  function updateMeta(field: string, value: string) {
    if (!creatorBrief) return;
    const newBrief = { ...creatorBrief, [field]: value };
    setCreatorBrief(newBrief);
    setTimeout(() => saveToServer(newBrief), 500);
  }

  // Add a new videographer and select them
  async function handleAddVideographer(name: string, phone: string) {
    try {
      const res = await fetch('/api/videographers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      if (res.ok) {
        const newVid = await res.json();
        setVideographers((prev) => [...prev, newVid]);
        // Auto-select the new videographer
        if (creatorBrief) {
          const shootIdx = creatorBrief.sections.findIndex((s) => s.type === 'shoot_logistics');
          if (shootIdx >= 0) {
            const section = creatorBrief.sections[shootIdx];
            const content = section.content as ShootLogisticsContent;
            updateSection(shootIdx, {
              ...section,
              content: {
                ...content,
                videographer: { id: newVid.id, name: newVid.name, phone: newVid.phone || '', role: 'Videographer' },
              },
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Publish
  async function handlePublish() {
    if (!creatorBrief) return;
    setPublishing(true);
    try {
      // Save first
      await saveToServer(creatorBrief);
      const res = await fetch(`/api/creator-briefs/${creatorBrief.id}/publish`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = await res.json();
        setCreatorBrief(updated);
      } else {
        const data = await res.json();
        setError(data.error || 'Publish failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    }
    setPublishing(false);
  }

  // Copy public URL
  function copyPublicUrl() {
    if (!creatorBrief) return;
    const url = `${window.location.origin}/creator-brief/${creatorBrief.slug}`;
    navigator.clipboard.writeText(url);
  }

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#D73F09]/30 border-t-[#D73F09] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">
            {generating ? 'Brief Writer is crafting your creator brief...' : 'Loading...'}
          </p>
          {generating && (
            <p className="text-gray-400 text-sm mt-2">
              Generating concept overview, deliverables, camera specs, workflow, and more. Usually takes 30-60 seconds.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!creatorBrief) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error || 'Failed to load creator brief'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-gray-800 rounded-lg text-gray-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => router.push(`/dashboard/briefs/${briefId}/concepts`)}
          className="text-gray-400 hover:text-white mb-6 text-sm"
        >
          &larr; Back to Concepts
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Creator Brief</h1>
            <p className="text-gray-400 text-sm mt-1">{creatorBrief.title}</p>
            {creatorBrief.status === 'published' && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-green-400 text-xs font-medium px-2 py-0.5 bg-green-900/50 rounded-full">
                  PUBLISHED
                </span>
                <button
                  onClick={copyPublicUrl}
                  className="text-[#D73F09] text-xs hover:underline"
                >
                  Copy Public URL
                </button>
                <a
                  href={`/creator-brief/${creatorBrief.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 text-xs hover:text-white"
                >
                  Open Public Page ↗
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {saving && <span className="text-gray-500 text-xs">Saving...</span>}
            {lastSaved && !saving && (
              <span className="text-gray-600 text-xs">Saved {lastSaved}</span>
            )}
            {creatorBrief.status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-6 py-2.5 bg-[#D73F09] hover:bg-[#b33507] text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-400">Dismiss</button>
          </div>
        )}

        {/* Brief Metadata */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Published Brief Metadata</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <input
                type="text"
                value={creatorBrief.title}
                onChange={(e) => updateMeta('title', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Athlete Name</label>
              <input
                type="text"
                value={creatorBrief.athlete_name || ''}
                onChange={(e) => updateMeta('athlete_name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Brand Color (hex)</label>
              <input
                type="text"
                value={creatorBrief.brand_color || ''}
                onChange={(e) => updateMeta('brand_color', e.target.value)}
                placeholder="#D73F09"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Brand Logo URL</label>
              <input
                type="url"
                value={creatorBrief.brand_logo_url || ''}
                onChange={(e) => updateMeta('brand_logo_url', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
              />
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-3">
            Saving on blur. Slug: {creatorBrief.slug}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {creatorBrief.sections.map((section, index) => (
            <div key={`${section.type}-${index}`} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[#D73F09] font-mono text-sm font-bold">{section.number}</span>
                <h3 className="text-lg font-semibold">{section.title}</h3>
                <span className="text-gray-600 text-xs">{section.type}</span>
              </div>

              {/* Shoot Logistics gets the special editor */}
              {section.type === 'shoot_logistics' ? (
                <ShootLogisticsEditor
                  content={section.content as ShootLogisticsContent}
                  staff={staff}
                  videographers={videographers}
                  onUpdate={(updated) =>
                    updateSection(index, { ...section, content: updated })
                  }
                  onAddVideographer={handleAddVideographer}
                />
              ) : (
                /* Generic section editor — JSON for now, will upgrade to typed editors */
                <GenericSectionEditor
                  content={section.content as Record<string, unknown>}
                  onChange={(updated) =>
                    updateSection(index, { ...section, content: updated as typeof section.content })
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Generic section editor (renders editable fields from the content object) ----
function GenericSectionEditor({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}) {
  // Recursively render editable fields
  function renderField(key: string, value: unknown, path: string[]) {
    if (typeof value === 'string') {
      const isLong = value.length > 100;
      return (
        <div key={path.join('.')} className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block capitalize">
            {key.replace(/_/g, ' ')}
          </label>
          {isLong ? (
            <textarea
              rows={4}
              value={value}
              onChange={(e) => updateNested(path, e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-y"
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => updateNested(path, e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          )}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={path.join('.')} className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block capitalize">
            {key.replace(/_/g, ' ')}
          </label>
          {value.map((item, i) => {
            if (typeof item === 'string') {
              return (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const arr = [...value];
                      arr[i] = e.target.value;
                      updateNested(path, arr);
                    }}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
                  />
                  <button
                    onClick={() => {
                      const arr = value.filter((_, j) => j !== i);
                      updateNested(path, arr);
                    }}
                    className="text-gray-500 hover:text-red-400 text-sm px-2"
                  >
                    &times;
                  </button>
                </div>
              );
            }
            if (typeof item === 'object' && item !== null) {
              return (
                <div key={i} className="bg-gray-800/50 rounded-lg p-3 mb-2">
                  {Object.entries(item as Record<string, unknown>).map(([k, v]) =>
                    renderField(k, v, [...path, String(i), k])
                  )}
                </div>
              );
            }
            return null;
          })}
          <button
            onClick={() => {
              const sample = value.length > 0 && typeof value[0] === 'string' ? '' : {};
              updateNested(path, [...value, sample]);
            }}
            className="text-[#D73F09] text-xs hover:underline mt-1"
          >
            + Add
          </button>
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div key={path.join('.')} className="mb-3 pl-3 border-l-2 border-gray-800">
          <label className="text-xs text-gray-500 mb-2 block capitalize font-medium">
            {key.replace(/_/g, ' ')}
          </label>
          {Object.entries(value as Record<string, unknown>).map(([k, v]) =>
            renderField(k, v, [...path, k])
          )}
        </div>
      );
    }

    return null;
  }

  function updateNested(path: string[], newValue: unknown) {
    const updated = JSON.parse(JSON.stringify(content));
    let obj = updated;
    for (let i = 0; i < path.length - 1; i++) {
      obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = newValue;
    onChange(updated);
  }

  return (
    <div>
      {Object.entries(content).map(([key, value]) =>
        renderField(key, value, [key])
      )}
    </div>
  );
}
