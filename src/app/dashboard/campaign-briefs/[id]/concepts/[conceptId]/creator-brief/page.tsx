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

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type {
  CreatorBrief,
  CreatorBriefSection,
} from '@/lib/types/briefs';
import SectionEditor from './section-editor';

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
        setBrief(active || list[0] || null);
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
                <SectionEditor
                  section={section}
                  onChange={(next) => updateSection(idx, next)}
                />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
