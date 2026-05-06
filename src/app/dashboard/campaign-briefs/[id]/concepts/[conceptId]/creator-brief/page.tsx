// ============================================================
// Creator Brief Editor (staff)
// /dashboard/campaign-briefs/[id]/concepts/[conceptId]/creator-brief
//
// Looks up the creator brief for this concept. If none exists, the
// CM can generate one. Once a brief exists, the CM can edit metadata,
// sections, and reference images, then publish to make it live at
// /creator-brief/[slug].
// ============================================================

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type {
  CreatorBrief,
  CreatorBriefSection,
  ShootLogisticsContent,
  ShootContact,
} from '@/lib/types/briefs';
import SectionEditor from './section-editor';

// --- Staff / Videographer types for dropdowns ---
interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}
interface VideographerOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null; // city, state
}

// --- Searchable Videographer Dropdown ---
function VideographerSearch({
  videographers,
  selected,
  onSelect,
  onClear,
}: {
  videographers: VideographerOption[];
  selected: ShootContact | null;
  onSelect: (v: VideographerOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = videographers.filter((v) =>
    v.name.toLowerCase().includes(query.toLowerCase()) ||
    (v.notes || '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 20); // Show max 20 results

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{selected.name}</div>
          {selected.phone && <div className="text-xs text-gray-400">{selected.phone}</div>}
        </div>
        <button onClick={onClear} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search videographers by name or city..."
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
      />
      {open && query.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => { onSelect(v); setQuery(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-700/50 last:border-0"
              >
                <div className="text-sm text-white">{v.name}</div>
                <div className="text-xs text-gray-400">
                  {[v.notes, v.phone].filter(Boolean).join(' · ')}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Shoot Logistics Editor ---
function ShootLogisticsEditor({
  content,
  onChange,
}: {
  content: ShootLogisticsContent;
  onChange: (updated: ShootLogisticsContent) => void;
}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [videographers, setVideographers] = useState<VideographerOption[]>([]);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const staffRef = useRef<HTMLDivElement>(null);

  // Load dropdown data
  useEffect(() => {
    fetch('/api/staff').then((r) => r.ok ? r.json() : []).then(setStaff);
    fetch('/api/videographers').then((r) => r.ok ? r.json() : []).then(setVideographers);
  }, []);

  // Close staff dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (staffRef.current && !staffRef.current.contains(e.target as Node)) setStaffDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggleStaffContact(member: StaffMember) {
    const exists = content.postgame_contacts.some((c) => c.id === member.id);
    if (exists) {
      onChange({
        ...content,
        postgame_contacts: content.postgame_contacts.filter((c) => c.id !== member.id),
      });
    } else {
      onChange({
        ...content,
        postgame_contacts: [
          ...content.postgame_contacts,
          { id: member.id, name: member.name, phone: '', role: member.role || '', email: member.email },
        ],
      });
    }
  }

  function updateContactPhone(index: number, phone: string) {
    const updated = [...content.postgame_contacts];
    updated[index] = { ...updated[index], phone };
    onChange({ ...content, postgame_contacts: updated });
  }

  function updateContactRole(index: number, role: string) {
    const updated = [...content.postgame_contacts];
    updated[index] = { ...updated[index], role };
    onChange({ ...content, postgame_contacts: updated });
  }

  function removeContact(index: number) {
    onChange({
      ...content,
      postgame_contacts: content.postgame_contacts.filter((_, i) => i !== index),
    });
  }

  function selectVideographer(v: VideographerOption) {
    onChange({
      ...content,
      videographer: {
        id: v.id,
        name: v.name,
        phone: v.phone || '',
        role: 'Videographer',
        email: v.email || undefined,
      },
    });
  }

  return (
    <div className="space-y-5">
      {/* Date / Time / Location */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Shoot Date</label>
          <input
            type="date"
            value={content.shoot_date || ''}
            onChange={(e) => onChange({ ...content, shoot_date: e.target.value || null })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Shoot Time</label>
          <input
            type="time"
            value={content.shoot_time || ''}
            onChange={(e) => onChange({ ...content, shoot_time: e.target.value || null })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Location</label>
          <input
            type="text"
            value={content.location || ''}
            onChange={(e) => onChange({ ...content, location: e.target.value || null })}
            placeholder="Address or venue"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
          />
        </div>
      </div>

      {/* Postgame Contacts — multi-select dropdown */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Postgame Contacts</label>
        <div ref={staffRef} className="relative">
          <button
            type="button"
            onClick={() => setStaffDropdownOpen(!staffDropdownOpen)}
            className="w-full text-left px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center justify-between"
          >
            <span>
              {content.postgame_contacts.length === 0
                ? 'Select team members...'
                : `${content.postgame_contacts.length} selected`}
            </span>
            <span className="text-gray-500">{staffDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {staffDropdownOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {staff.map((s) => {
                const isSelected = content.postgame_contacts.some((c) => c.id === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStaffContact(s)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 ${
                      isSelected ? 'bg-gray-700/50' : ''
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                      isSelected ? 'bg-[#D73F09] border-[#D73F09] text-white' : 'border-gray-600'
                    }`}>
                      {isSelected ? '✓' : ''}
                    </span>
                    <div>
                      <span className="text-sm text-white">{s.name}</span>
                      {s.role && <span className="text-xs text-gray-400 ml-2">{s.role}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected contacts with phone + role fields */}
        {content.postgame_contacts.length > 0 && (
          <div className="mt-3 space-y-2">
            {content.postgame_contacts.map((contact, i) => (
              <div key={contact.id} className="flex items-center gap-2 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2">
                <span className="text-sm text-white font-medium min-w-[120px]">{contact.name}</span>
                <input
                  type="text"
                  value={contact.role || ''}
                  onChange={(e) => updateContactRole(i, e.target.value)}
                  placeholder="Role"
                  className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs placeholder-gray-500"
                />
                <input
                  type="tel"
                  value={contact.phone || ''}
                  onChange={(e) => updateContactPhone(i, e.target.value)}
                  placeholder="Phone"
                  className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs placeholder-gray-500"
                />
                <button onClick={() => removeContact(i)} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Videographer — searchable dropdown */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Videographer</label>
        <VideographerSearch
          videographers={videographers}
          selected={content.videographer}
          onSelect={selectVideographer}
          onClear={() => onChange({ ...content, videographer: null })}
        />
      </div>
    </div>
  );
}

export default function CreatorBriefEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string; conceptId: string }>();
  const briefId = params.id;
  const conceptId = params.conceptId;

  const [brief, setBrief] = useState<CreatorBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/creator-briefs?concept_id=${conceptId}`);
      if (res.ok) {
        const list = (await res.json()) as CreatorBrief[];
        // Latest non-archived first; otherwise newest archived.
        const active = list.find((b) => b.status !== 'archived');
        const match = active || list[0] || null;
        if (match) {
          // The list endpoint only returns summary fields (no sections).
          // Fetch the full brief by ID to get sections + reference_images.
          const fullRes = await fetch(`/api/creator-briefs/${match.id}`);
          if (fullRes.ok) {
            setBrief(await fullRes.json());
          } else {
            setBrief(match);
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [conceptId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/creator-briefs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept_id: conceptId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setBrief(data.creatorBrief as CreatorBrief);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
    }
    setGenerating(false);
  }

  async function saveField(updates: Partial<CreatorBrief>) {
    if (!brief) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/creator-briefs/${brief.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setBrief(data as CreatorBrief);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  }

  async function handlePublish() {
    if (!brief) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/creator-briefs/${brief.id}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      setBrief(data as CreatorBrief);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    }
    setPublishing(false);
  }

  function copyPublicUrl() {
    if (!brief) return;
    const url = `${window.location.origin}/creator-brief/${brief.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }

  function updateSection(idx: number, next: CreatorBriefSection) {
    if (!brief) return;
    const sections = [...(brief.sections || [])];
    sections[idx] = next;
    setBrief({ ...brief, sections });
  }

  function moveSection(idx: number, dir: -1 | 1) {
    if (!brief) return;
    const sections = [...(brief.sections || [])];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    setBrief({ ...brief, sections });
  }

  function persistSections() {
    if (!brief) return;
    saveField({ sections: brief.sections });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading creator brief...</p>
      </div>
    );
  }

  // Empty state — generate a brief
  if (!brief) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white p-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.push(`/dashboard/campaign-briefs/${briefId}/concepts`)}
            className="text-gray-400 hover:text-white mb-6 text-sm"
          >
            &larr; Back to Concepts
          </button>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <h1 className="text-2xl font-bold">No creator brief yet</h1>
            <p className="text-gray-400 mt-2 mb-6">
              Generate a structured brief for the videographer + athlete based on this approved concept.
            </p>
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-8 py-3 bg-[#D73F09] hover:bg-[#b33507] text-white font-bold rounded-lg disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Creator Brief'}
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Brief Writer usually takes 30-90 seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isPublished = brief.status === 'published';
  const publicUrl = `/creator-brief/${brief.slug}`;

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      <div className="max-w-4xl mx-auto p-8">
        <button
          onClick={() => router.push(`/dashboard/campaign-briefs/${briefId}/concepts`)}
          className="text-gray-400 hover:text-white mb-6 text-sm"
        >
          &larr; Back to Concepts
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Creator Brief</h1>
            <p className="text-gray-400 mt-1 text-sm">
              {brief.campaign_brief?.name} · Status:{' '}
              <span
                className={
                  isPublished
                    ? 'text-green-400 font-medium'
                    : 'text-yellow-400 font-medium'
                }
              >
                {brief.status.toUpperCase()}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            {isPublished && (
              <>
                <button
                  onClick={copyPublicUrl}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm"
                >
                  {copySuccess ? 'Copied!' : 'Copy Public URL'}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm"
                >
                  Open Public Page ↗
                </a>
              </>
            )}
            <button
              onClick={handlePublish}
              disabled={publishing || isPublished}
              className="px-4 py-2 bg-[#D73F09] hover:bg-[#b33507] text-white font-semibold rounded-lg text-sm disabled:opacity-50"
            >
              {isPublished ? 'Published' : publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-400 hover:text-red-200 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Metadata */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Brief Metadata</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Title</label>
              <input
                type="text"
                value={brief.title}
                onChange={(e) => setBrief({ ...brief, title: e.target.value })}
                onBlur={() => saveField({ title: brief.title })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Athlete Name</label>
              <input
                type="text"
                value={brief.athlete_name || ''}
                onChange={(e) => setBrief({ ...brief, athlete_name: e.target.value })}
                onBlur={() => saveField({ athlete_name: brief.athlete_name })}
                placeholder="(none)"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Brand Color (hex)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={brief.brand_color || '#D73F09'}
                  onChange={(e) => setBrief({ ...brief, brand_color: e.target.value })}
                  onBlur={() => saveField({ brand_color: brief.brand_color })}
                  className="h-9 w-12 rounded cursor-pointer bg-gray-800 border border-gray-700"
                />
                <input
                  type="text"
                  value={brief.brand_color || ''}
                  onChange={(e) => setBrief({ ...brief, brand_color: e.target.value })}
                  onBlur={() => saveField({ brand_color: brief.brand_color })}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Brand Logo URL</label>
              <input
                type="text"
                value={brief.brand_logo_url || ''}
                onChange={(e) => setBrief({ ...brief, brand_logo_url: e.target.value })}
                onBlur={() => saveField({ brand_logo_url: brief.brand_logo_url })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Saving on blur. Slug:{' '}
            <code className="text-gray-400">{brief.slug}</code>
          </p>
        </section>

        {/* Sections list */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sections</h2>
            <button
              onClick={persistSections}
              disabled={saving}
              className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Section Edits'}
            </button>
          </div>

          {(brief.sections || []).map((section, idx) => (
            <div
              key={`${section.number}-${idx}`}
              className="bg-gray-900 border border-gray-800 rounded-xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-baseline gap-3">
                  <span className="text-[#D73F09] font-bold text-sm">{section.number}</span>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) =>
                      updateSection(idx, { ...section, title: e.target.value } as CreatorBriefSection)
                    }
                    className="bg-transparent text-white font-semibold focus:outline-none focus:border-b focus:border-[#D73F09]"
                  />
                  <span className="text-xs text-gray-600 font-mono">{section.type}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveSection(idx, -1)}
                    disabled={idx === 0}
                    className="px-2 py-1 text-gray-500 hover:text-white disabled:opacity-30 text-xs"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveSection(idx, 1)}
                    disabled={idx === (brief.sections || []).length - 1}
                    className="px-2 py-1 text-gray-500 hover:text-white disabled:opacity-30 text-xs"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="p-4">
                {section.type === 'shoot_logistics' ? (
                  <ShootLogisticsEditor
                    content={
                      (section.content as ShootLogisticsContent) || {
                        shoot_date: null,
                        shoot_time: null,
                        location: null,
                        postgame_contacts: [],
                        videographer: null,
                      }
                    }
                    onChange={(updated) =>
                      updateSection(idx, {
                        ...section,
                        content: updated,
                      } as CreatorBriefSection)
                    }
                  />
                ) : (
                  <SectionEditor
                    section={section}
                    onChange={(next) => updateSection(idx, next)}
                  />
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
