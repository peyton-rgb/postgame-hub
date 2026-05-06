// ============================================================
// Creator Brief Editor (staff)
// /dashboard/campaign-briefs/[id]/concepts/[conceptId]/creator-brief
//
// Mirrors the public brief layout (light bg, white cards, brand
// header) but every block has an ✎ toggle that swaps to inline
// editing. Contacts, videographer, shoot date/time/location live
// at the brief level, not inside a section.
// ============================================================

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type {
  CreatorBrief,
  CreatorBriefSection,
  ShootContact,
} from '@/lib/types/briefs';
import SectionEditor from './section-editor';

// ---- Types for dropdowns ----
interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
}
interface VideographerOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

// ---- Searchable Videographer Dropdown ----
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = videographers
    .filter(
      (v) =>
        v.name.toLowerCase().includes(query.toLowerCase()) ||
        (v.notes || '').toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 20);

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">{selected.name}</div>
          {selected.phone && <div className="text-xs text-gray-500">{selected.phone}</div>}
        </div>
        <button onClick={onClear} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
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
        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D73F09]/30"
      />
      {open && query.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No matches</div>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => { onSelect(v); setQuery(''); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                <div className="text-sm font-medium text-gray-900">{v.name}</div>
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

// ---- Main Page ----
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

  // Which section is in edit mode (index), -1 = none
  const [editingSection, setEditingSection] = useState<number>(-1);
  // Which top-level card is in edit mode
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingShoot, setEditingShoot] = useState(false);

  // Dropdown data
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [vidList, setVidList] = useState<VideographerOption[]>([]);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const staffRef = useRef<HTMLDivElement>(null);

  // Load dropdown options
  useEffect(() => {
    fetch('/api/staff').then((r) => (r.ok ? r.json() : [])).then(setStaffList);
    fetch('/api/videographers').then((r) => (r.ok ? r.json() : [])).then(setVidList);
  }, []);

  // Close staff dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (staffRef.current && !staffRef.current.contains(e.target as Node))
        setStaffDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load brief
  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/creator-briefs?concept_id=${conceptId}`);
      if (res.ok) {
        const list = (await res.json()) as CreatorBrief[];
        const active = list.find((b) => b.status !== 'archived');
        const match = active || list[0] || null;
        if (match) {
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

  // ---- Persistence helpers ----
  const saveField = useCallback(
    async (updates: Partial<CreatorBrief>) => {
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
    },
    [brief],
  );

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

  function toggleStaffContact(member: StaffMember) {
    if (!brief) return;
    const contacts = brief.postgame_contacts || [];
    const exists = contacts.some((c) => c.id === member.id);
    const updated = exists
      ? contacts.filter((c) => c.id !== member.id)
      : [
          ...contacts,
          {
            id: member.id,
            name: member.name,
            phone: member.phone || '',
            role: member.role || '',
            email: member.email,
          },
        ];
    setBrief({ ...brief, postgame_contacts: updated });
  }

  function selectVideographer(v: VideographerOption) {
    if (!brief) return;
    setBrief({
      ...brief,
      videographer: {
        id: v.id,
        name: v.name,
        phone: v.phone || '',
        role: 'Videographer',
        email: v.email || undefined,
      },
    });
  }

  // ---- Rendering ----

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state
  if (!brief) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <button
            onClick={() =>
              router.push(`/dashboard/campaign-briefs/${briefId}/concepts`)
            }
            className="text-gray-500 hover:text-gray-900 mb-6 text-sm block mx-auto"
          >
            &larr; Back to Concepts
          </button>
          <div className="bg-white rounded-2xl shadow-sm p-12">
            <h1 className="text-2xl font-bold text-gray-900">
              No creator brief yet
            </h1>
            <p className="text-gray-500 mt-2 mb-6 text-sm">
              Generate a structured brief for the videographer + athlete based on
              this approved concept.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-8 py-3 bg-[#D73F09] hover:bg-[#b33507] text-white font-bold rounded-xl disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Creator Brief'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const color = brief.brand_color || '#D73F09';
  const isPublished = brief.status === 'published';

  // Separate shoot-related sections from content sections (skip them, we show contacts at top level)
  const isShootSection = (s: CreatorBriefSection) =>
    s.type === 'shoot_logistics' ||
    (s.type === 'concept' &&
      (s.title.toLowerCase().includes('shoot') || s.number === '00'));
  const contentSections = (brief.sections || []).filter(
    (s) => !isShootSection(s),
  );

  // Format date/time for display
  const formattedDate = brief.shoot_date
    ? new Date(brief.shoot_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const formattedTime = brief.shoot_time
    ? new Date(`2000-01-01T${brief.shoot_time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* ---- Sticky toolbar ---- */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() =>
              router.push(`/dashboard/campaign-briefs/${briefId}/concepts`)
            }
            className="text-gray-500 hover:text-gray-900 text-sm"
          >
            &larr; Back
          </button>
          <div className="flex gap-2 items-center">
            {saving && (
              <span className="text-xs text-gray-400 animate-pulse">
                Saving...
              </span>
            )}
            <span
              className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                isPublished
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {brief.status}
            </span>
            {isPublished && (
              <button
                onClick={copyPublicUrl}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium"
              >
                {copySuccess ? 'Copied!' : 'Copy URL'}
              </button>
            )}
            <button
              onClick={handlePublish}
              disabled={publishing || isPublished}
              className="px-4 py-1.5 bg-[#D73F09] hover:bg-[#b33507] text-white font-semibold rounded-lg text-sm disabled:opacity-50"
            >
              {isPublished
                ? 'Published'
                : publishing
                ? 'Publishing...'
                : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex justify-between">
            {error}
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 text-xs ml-4"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ======== CAMPAIGN HEADER ======== */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {editingHeader ? (
            // ---- EDIT MODE ----
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={brief.title}
                    onChange={(e) => setBrief({ ...brief, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#D73F09]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Athlete Name</label>
                  <input
                    type="text"
                    value={brief.athlete_name || ''}
                    onChange={(e) => setBrief({ ...brief, athlete_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#D73F09]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Brand Logo URL</label>
                  <input
                    type="text"
                    value={brief.brand_logo_url || ''}
                    onChange={(e) => setBrief({ ...brief, brand_logo_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D73F09]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Brand Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={brief.brand_color || '#D73F09'}
                      onChange={(e) => setBrief({ ...brief, brand_color: e.target.value })}
                      className="h-9 w-12 rounded cursor-pointer border border-gray-200"
                    />
                    <input
                      type="text"
                      value={brief.brand_color || ''}
                      onChange={(e) => setBrief({ ...brief, brand_color: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D73F09]/30"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Athlete Photo URL</label>
                  <input
                    type="text"
                    value={brief.athlete_photo_url || ''}
                    onChange={(e) => setBrief({ ...brief, athlete_photo_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D73F09]/30"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    saveField({
                      title: brief.title,
                      athlete_name: brief.athlete_name,
                      brand_logo_url: brief.brand_logo_url,
                      brand_color: brief.brand_color,
                      athlete_photo_url: brief.athlete_photo_url,
                    });
                    setEditingHeader(false);
                  }}
                  className="px-4 py-1.5 bg-[#D73F09] text-white rounded-lg text-sm font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingHeader(false)}
                  className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // ---- VIEW MODE (mirrors public page) ----
            <div className="relative group">
              <button
                onClick={() => setEditingHeader(true)}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium"
              >
                Edit
              </button>

              <div className="flex items-center gap-4 mb-4">
                {brief.brand_logo_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={brief.brand_logo_url}
                    alt="Brand"
                    className="h-10 object-contain"
                  />
                )}
                <span className="text-gray-400 text-sm">&times;</span>
                <span className="font-bold text-gray-900 tracking-tight">
                  postgame
                </span>
              </div>

              <span
                className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full text-white mb-4"
                style={{ backgroundColor: color }}
              >
                Videographer Creative Brief
              </span>

              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                {brief.title}
              </h1>

              {brief.athlete_name && (
                <p className="text-gray-500 text-lg mt-2">
                  Athlete: {brief.athlete_name}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======== ATHLETE HERO ======== */}
      {brief.athlete_photo_url && (
        <div className="max-w-3xl mx-auto px-6 -mt-1">
          <div className="rounded-2xl overflow-hidden shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brief.athlete_photo_url}
              alt={brief.athlete_name || 'Athlete'}
              className="w-full h-72 sm:h-96 object-cover"
            />
          </div>
        </div>
      )}

      {/* ======== CONTENT ======== */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* ---- SHOOT DETAILS CARD ---- */}
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-8 relative group">
          <button
            onClick={() => setEditingShoot(!editingShoot)}
            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium z-10"
          >
            {editingShoot ? 'Done' : 'Edit'}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: color }}
            >
              00
            </span>
            <h2 className="text-xl font-bold text-gray-900">Shoot Details</h2>
          </div>
          <hr className="mb-5" style={{ borderColor: color, opacity: 0.3 }} />

          {editingShoot ? (
            // ---- EDIT MODE ----
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Shoot Date</label>
                  <input
                    type="date"
                    value={brief.shoot_date || ''}
                    onChange={(e) => setBrief({ ...brief, shoot_date: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Shoot Time</label>
                  <input
                    type="time"
                    value={brief.shoot_time || ''}
                    onChange={(e) => setBrief({ ...brief, shoot_time: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Location</label>
                  <input
                    type="text"
                    value={brief.location || ''}
                    onChange={(e) => setBrief({ ...brief, location: e.target.value || null })}
                    placeholder="Address or venue"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm"
                  />
                </div>
              </div>

              {/* Postgame Contacts multi-select */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Postgame Contacts
                </label>
                <div ref={staffRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setStaffDropdownOpen(!staffDropdownOpen)}
                    className="w-full text-left px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 flex items-center justify-between shadow-sm"
                  >
                    <span>
                      {(brief.postgame_contacts || []).length === 0
                        ? 'Select team members...'
                        : `${(brief.postgame_contacts || []).length} selected`}
                    </span>
                    <span className="text-gray-400">
                      {staffDropdownOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {staffDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {staffList.map((s) => {
                        const sel = (brief.postgame_contacts || []).some(
                          (c) => c.id === s.id,
                        );
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleStaffContact(s)}
                            className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 ${
                              sel ? 'bg-orange-50' : ''
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                                sel
                                  ? 'bg-[#D73F09] border-[#D73F09] text-white'
                                  : 'border-gray-300'
                              }`}
                            >
                              {sel ? '✓' : ''}
                            </span>
                            <span className="text-sm text-gray-900">
                              {s.name}
                            </span>
                            {s.phone && (
                              <span className="text-xs text-gray-400 ml-auto">
                                {s.phone}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Videographer search */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Videographer
                </label>
                <VideographerSearch
                  videographers={vidList}
                  selected={brief.videographer}
                  onSelect={selectVideographer}
                  onClear={() => setBrief({ ...brief, videographer: null })}
                />
              </div>

              <button
                onClick={() => {
                  saveField({
                    shoot_date: brief.shoot_date,
                    shoot_time: brief.shoot_time,
                    location: brief.location,
                    postgame_contacts: brief.postgame_contacts,
                    videographer: brief.videographer,
                  });
                  setEditingShoot(false);
                }}
                className="px-4 py-1.5 bg-[#D73F09] text-white rounded-lg text-sm font-medium"
              >
                Save Shoot Details
              </button>
            </div>
          ) : (
            // ---- VIEW MODE (mirrors public page) ----
            <div>
              {/* Date / Time / Location */}
              {(formattedDate || formattedTime || brief.location) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  {formattedDate && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Date
                      </div>
                      <div className="text-gray-900 font-semibold">
                        {formattedDate}
                      </div>
                    </div>
                  )}
                  {formattedTime && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Call Time
                      </div>
                      <div className="text-gray-900 font-semibold">
                        {formattedTime}
                      </div>
                    </div>
                  )}
                  {brief.location && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Location
                      </div>
                      <div className="text-gray-900 font-semibold">
                        {brief.location}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contacts */}
              {((brief.postgame_contacts || []).length > 0 ||
                brief.videographer) && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Contacts
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(brief.postgame_contacts || []).map((c) => (
                      <div
                        key={c.id}
                        className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                      >
                        <div className="font-semibold text-gray-900">
                          {c.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {c.role || 'Postgame'}
                        </div>
                        {c.phone && (
                          <div
                            className="text-sm font-medium mt-1"
                            style={{ color }}
                          >
                            {c.phone}
                          </div>
                        )}
                      </div>
                    ))}
                    {brief.videographer && (
                      <div
                        className="bg-white rounded-xl p-4 shadow-sm border-2"
                        style={{ borderColor: color }}
                      >
                        <div className="font-semibold text-gray-900">
                          {brief.videographer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {brief.videographer.role || 'Videographer'}
                        </div>
                        {brief.videographer.phone && (
                          <div
                            className="text-sm font-medium mt-1"
                            style={{ color }}
                          >
                            {brief.videographer.phone}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state if nothing set */}
              {!formattedDate &&
                !formattedTime &&
                !brief.location &&
                (brief.postgame_contacts || []).length === 0 &&
                !brief.videographer && (
                  <p className="text-gray-400 text-sm italic">
                    No shoot details yet — click Edit to add date, location, and
                    contacts.
                  </p>
                )}
            </div>
          )}
        </div>

        {/* ---- CONTENT SECTIONS ---- */}
        <div className="space-y-8">
          {contentSections.map((section, idx) => {
            // Find original index in brief.sections for updateSection
            const originalIdx = (brief.sections || []).indexOf(section);
            const isEditing = editingSection === originalIdx;

            return (
              <div
                key={`${section.type}-${section.number}`}
                className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 relative group"
              >
                <button
                  onClick={() =>
                    setEditingSection(isEditing ? -1 : originalIdx)
                  }
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium z-10"
                >
                  {isEditing ? 'Done' : 'Edit'}
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: color }}
                  >
                    {section.number}
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        updateSection(originalIdx, {
                          ...section,
                          title: e.target.value,
                        } as CreatorBriefSection)
                      }
                      className="text-xl font-bold text-gray-900 bg-transparent border-b-2 border-[#D73F09] focus:outline-none"
                    />
                  ) : (
                    <h2 className="text-xl font-bold text-gray-900">
                      {section.title}
                    </h2>
                  )}
                </div>
                <hr
                  className="mb-4"
                  style={{ borderColor: color, opacity: 0.3 }}
                />

                {isEditing ? (
                  <div>
                    <SectionEditor
                      section={section}
                      onChange={(next) => updateSection(originalIdx, next)}
                    />
                    <button
                      onClick={() => {
                        saveField({ sections: brief.sections });
                        setEditingSection(-1);
                      }}
                      className="mt-4 px-4 py-1.5 bg-[#D73F09] text-white rounded-lg text-sm font-medium"
                    >
                      Save Section
                    </button>
                  </div>
                ) : (
                  <SectionPreview section={section} color={color} />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center text-gray-400 text-xs mt-12 pb-8">
          Postgame — {brief.title} — Editor View
        </div>
      </div>
    </div>
  );
}

// ---- Section Preview (read-only, mirrors public page renderers) ----
function SectionPreview({
  section,
  color,
}: {
  section: CreatorBriefSection;
  color: string;
}) {
  const c = section.content as Record<string, unknown>;

  switch (section.type) {
    case 'concept': {
      const description = (c.description as string) || '';
      const callout = c.callout as { title: string; text: string } | undefined;
      return (
        <div>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
          {callout && (
            <div className="mt-4 rounded-xl p-5 text-white" style={{ backgroundColor: color }}>
              <div className="font-bold text-sm uppercase tracking-wide mb-2 opacity-90">{callout.title}</div>
              <div className="text-sm leading-relaxed opacity-95">{callout.text}</div>
            </div>
          )}
        </div>
      );
    }

    case 'photos': {
      const description = (c.description as string) || '';
      const images = (c.images as { url: string; caption?: string }[]) || [];
      return (
        <div>
          <p className="text-gray-700 leading-relaxed mb-4">{description}</p>
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {images.map((img, i) => (
                <div key={i} className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.caption || `Ref ${i + 1}`} className="w-full h-48 object-cover" />
                  {img.caption && <p className="text-xs text-gray-500 p-2 text-center">{img.caption}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'videos': {
      const description = (c.description as string) || '';
      const videos = (c.videos as { url: string; caption?: string }[]) || [];
      return (
        <div>
          <p className="text-gray-700 leading-relaxed mb-4">{description}</p>
          {videos.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {videos.map((vid, i) => (
                <div key={i} className="border-2 border-dashed border-gray-200 rounded-xl p-4">
                  <a href={vid.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline break-all">
                    {vid.caption || vid.url}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'deliverables': {
      const video = c.video as { title: string; count?: string; description?: string; orientation?: string } | undefined;
      const photography = c.photography as { title: string; minimum?: string; style?: string } | undefined;
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {video && (
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>VIDEO</div>
              <div className="font-semibold text-gray-900">{video.title}</div>
              {video.count && <div className="text-sm text-gray-500 mt-1">{video.count}</div>}
              {video.description && <p className="text-sm text-gray-600 mt-2">{video.description}</p>}
              {video.orientation && <div className="text-xs text-gray-500 mt-2">{video.orientation}</div>}
            </div>
          )}
          {photography && (
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>PHOTOGRAPHY</div>
              <div className="font-semibold text-gray-900">{photography.title}</div>
              {photography.minimum && <div className="text-sm text-gray-500 mt-1">{photography.minimum}</div>}
              {photography.style && <p className="text-sm text-gray-600 mt-2">{photography.style}</p>}
            </div>
          )}
        </div>
      );
    }

    case 'product_reqs': {
      const items = (c.items as { name: string; requirements: string[] }[]) || [];
      return (
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4">
              <div className="font-semibold text-gray-900 mb-2">{item.name}</div>
              <ul className="space-y-1">
                {item.requirements.map((req, j) => (
                  <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">&bull;</span>{req}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    case 'athlete_reqs': {
      const requirements = (c.requirements as string[]) || [];
      const tip = c.tip as { title: string; text: string } | undefined;
      return (
        <div>
          <ul className="space-y-2 mb-4">
            {requirements.map((req, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">&bull;</span>{req}
              </li>
            ))}
          </ul>
          {tip && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="font-semibold text-amber-700 text-sm">{tip.title}</div>
              <div className="text-amber-600 text-sm mt-1">{tip.text}</div>
            </div>
          )}
        </div>
      );
    }

    case 'creative_direction': {
      const tone = (c.tone as string[]) || [];
      const visual_style = (c.visual_style as string) || '';
      const lighting_notes = (c.lighting_notes as string) || '';
      return (
        <div>
          {tone.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tone.map((t, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: color }}>
                  {t}
                </span>
              ))}
            </div>
          )}
          {visual_style && <p className="text-gray-700 leading-relaxed mb-3">{visual_style}</p>}
          {lighting_notes && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lighting Notes</div>
              <p className="text-gray-600 text-sm">{lighting_notes}</p>
            </div>
          )}
        </div>
      );
    }

    case 'camera_specs': {
      const video_settings = (c.video_settings as Record<string, string>) || {};
      const photography_settings = (c.photography_settings as Record<string, string>) || {};
      const lens_recommendation = (c.lens_recommendation as string) || '';
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>VIDEO SETTINGS</div>
            {Object.entries(video_settings).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm mb-1">
                <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="text-gray-900 font-medium">{v}</span>
              </div>
            ))}
          </div>
          {Object.keys(photography_settings).length > 0 && (
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>PHOTO SETTINGS</div>
              {Object.entries(photography_settings).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-gray-900 font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}
          {lens_recommendation && (
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lens Recommendation</div>
              <p className="text-gray-700 text-sm">{lens_recommendation}</p>
            </div>
          )}
        </div>
      );
    }

    case 'workflow': {
      const steps = (c.steps as { number: number; title: string; description: string }[]) || [];
      return (
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: color }}>
                {step.number}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{step.title}</div>
                <p className="text-sm text-gray-600 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'dos_donts': {
      const dos = (c.dos as string[]) || [];
      const donts = (c.donts as string[]) || [];
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="text-green-600 font-semibold text-sm mb-3">Do&apos;s</div>
            <ul className="space-y-2">
              {dos.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5">&#10003;</span>{d}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-red-600 font-semibold text-sm mb-3">Don&apos;ts</div>
            <ul className="space-y-2">
              {donts.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-red-500 mt-0.5">&#10007;</span>{d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    case 'file_delivery': {
      const video_specs = (c.video_specs as Record<string, string>) || {};
      const photo_specs = (c.photo_specs as Record<string, string>) || {};
      const delivery_method = (c.delivery_method as string) || '';
      const deadline = (c.deadline as string) || '';
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>VIDEO SPECS</div>
            {Object.entries(video_specs).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm mb-1">
                <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="text-gray-900 font-medium">{v}</span>
              </div>
            ))}
          </div>
          {Object.keys(photo_specs).length > 0 && (
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>PHOTO SPECS</div>
              {Object.entries(photo_specs).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-gray-900 font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}
          {delivery_method && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Delivery Method</div>
              <p className="text-gray-700 text-sm">{delivery_method}</p>
            </div>
          )}
          {deadline && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Deadline</div>
              <p className="text-gray-700 text-sm font-medium">{deadline}</p>
            </div>
          )}
        </div>
      );
    }

    default:
      return (
        <pre className="text-xs text-gray-500 overflow-auto">
          {JSON.stringify(section.content, null, 2)}
        </pre>
      );
  }
}
