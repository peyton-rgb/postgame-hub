// ============================================================
// Concept Deck Page — /dashboard/campaign-briefs/[id]/concepts
// Shows AI-generated concept proposals as cards.
// The AM can generate concepts, approve/reject them, iterate, or edit manually.
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Concept, Brief, CreativeSeed } from '@/lib/types/briefs';

type GenerationMode = 'fresh' | 'collaborate';

const SCOPE_LABELS: Record<string, string> = {
  ugc_only: 'UGC Only',
  hybrid: 'Hybrid',
  full_production: 'Full Production',
};

const SCOPE_COLORS: Record<string, string> = {
  ugc_only: 'bg-green-900/50 text-green-300',
  hybrid: 'bg-blue-900/50 text-blue-300',
  full_production: 'bg-purple-900/50 text-purple-300',
};

const STATUS_LABELS: Record<string, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  rejected: 'Rejected',
  iterating: 'Iterating',
  archived: 'Archived',
};

export default function ConceptDeckPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const briefId = params.id;

  const [brief, setBrief] = useState<Brief | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [iteratingConceptId, setIteratingConceptId] = useState<string | null>(null);
  const [iterationFeedback, setIterationFeedback] = useState('');
  const [iterationLoading, setIterationLoading] = useState(false);

  const [rejectingConceptId, setRejectingConceptId] = useState<string | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState('');

  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Concept>>({});

  // --- Creative Input panel state (Phase 3) ---
  // 'fresh' = old behavior (no extra context). 'collaborate' = exposes panel.
  const [mode, setMode] = useState<GenerationMode>('fresh');
  const [athleteName, setAthleteName] = useState('');
  const [refImageUrls, setRefImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [seeds, setSeeds] = useState<CreativeSeed[]>([{ name: '', description: '' }]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addSeed() {
    setSeeds((prev) => [...prev, { name: '', description: '' }]);
  }

  function removeSeed(idx: number) {
    setSeeds((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function updateSeed(idx: number, patch: Partial<CreativeSeed>) {
    setSeeds((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('brief_id', briefId);
      Array.from(files).forEach((f) => form.append('file', f));

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      const data = (await res.json()) as { urls: string[] };
      setRefImageUrls((prev) => [...prev, ...data.urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploading(false);
  }

  function removeRefImage(url: string) {
    setRefImageUrls((prev) => prev.filter((u) => u !== url));
  }

  useEffect(() => {
    async function fetchData() {
      const [briefRes, conceptsRes] = await Promise.all([
        fetch(`/api/campaign-briefs/${briefId}`),
        fetch(`/api/concepts?brief_id=${briefId}`),
      ]);

      if (briefRes.ok) setBrief(await briefRes.json());
      if (conceptsRes.ok) setConcepts(await conceptsRes.json());
      setLoading(false);
    }
    fetchData();
  }, [briefId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      // Only send collab fields when collaborate mode is on AND something
      // was actually filled in. Empty seeds are filtered so the agent
      // doesn't get noise.
      const payload: Record<string, unknown> = { brief_id: briefId };
      if (mode === 'collaborate') {
        if (athleteName.trim()) payload.athlete_name = athleteName.trim();
        if (refImageUrls.length > 0) payload.reference_image_urls = refImageUrls;
        const cleanedSeeds = seeds
          .map((s) => ({ name: s.name.trim(), description: s.description.trim() }))
          .filter((s) => s.name || s.description);
        if (cleanedSeeds.length > 0) payload.creative_seeds = cleanedSeeds;
      }

      const res = await fetch('/api/concepts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }

      const data = await res.json();
      setConcepts((prev) => [...prev, ...data.concepts]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate concepts');
    }
    setGenerating(false);
  }

  async function handleApprove(conceptId: string) {
    try {
      const res = await fetch(`/api/concepts/${conceptId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = await res.json();
        setConcepts((prev) => prev.map((c) => (c.id === conceptId ? updated : c)));
      }
    } catch (err) {
      console.error('Approve failed:', err);
    }
  }

  async function handleReject(conceptId: string) {
    if (!rejectionFeedback.trim()) return;

    try {
      const res = await fetch(`/api/concepts/${conceptId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: rejectionFeedback }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConcepts((prev) => prev.map((c) => (c.id === conceptId ? updated : c)));
        setRejectingConceptId(null);
        setRejectionFeedback('');
      }
    } catch (err) {
      console.error('Reject failed:', err);
    }
  }

  async function handleIterate(conceptId: string) {
    if (!iterationFeedback.trim()) return;

    setIterationLoading(true);
    try {
      const res = await fetch(`/api/concepts/${conceptId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: iterationFeedback }),
      });
      if (res.ok) {
        const refreshRes = await fetch(`/api/concepts?brief_id=${briefId}`);
        if (refreshRes.ok) setConcepts(await refreshRes.json());
        setIteratingConceptId(null);
        setIterationFeedback('');
      }
    } catch (err) {
      console.error('Iterate failed:', err);
    }
    setIterationLoading(false);
  }

  async function handleSaveEdit(conceptId: string) {
    try {
      const res = await fetch(`/api/concepts/${conceptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setConcepts((prev) => prev.map((c) => (c.id === conceptId ? updated : c)));
        setEditingConceptId(null);
        setEditForm({});
      }
    } catch (err) {
      console.error('Save edit failed:', err);
    }
  }

  const activeConcepts = concepts.filter((c) => c.status !== 'archived');
  const archivedConcepts = concepts.filter((c) => c.status === 'archived');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading concepts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push(`/dashboard/campaign-briefs/${briefId}`)}
          className="text-gray-400 hover:text-white mb-6 text-sm"
        >
          &larr; Back to Brief
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Creative Concepts</h1>
            <p className="text-gray-400 mt-1">{brief?.name}</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || uploading || brief?.status === 'draft'}
            className="px-6 py-3 bg-[#D73F09] hover:bg-[#b33507] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              'Generate Concepts'
            )}
          </button>
        </div>

        {/* Creative Input panel — Phase 3 collaborative mode */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl mb-8 overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-gray-800">
            <button
              onClick={() => setMode('fresh')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'fresh'
                  ? 'bg-white text-[#07070a]'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Start Fresh
            </button>
            <button
              onClick={() => setMode('collaborate')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'collaborate'
                  ? 'bg-[#D73F09] text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Collaborate
            </button>
            <span className="text-xs text-gray-500 ml-3">
              {mode === 'fresh'
                ? 'Generate concepts from the brief alone.'
                : 'Add athlete, references, or seed ideas to bias generation.'}
            </span>
          </div>

          {mode === 'collaborate' && (
            <div className="p-6 space-y-6">
              {/* Athlete */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Athlete Name (optional)</label>
                <input
                  type="text"
                  value={athleteName}
                  onChange={(e) => setAthleteName(e.target.value)}
                  placeholder="e.g. Caitlin Clark"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
                />
              </div>

              {/* Reference images */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Reference Images (optional)
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileUpload(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-lg p-6 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <p className="text-gray-400 text-sm">
                    {uploading ? 'Uploading...' : 'Drag images here or click to upload'}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">PNG / JPG / WEBP — up to 15 MB each</p>
                </div>

                {refImageUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    {refImageUrls.map((url) => (
                      <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="reference" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeRefImage(url)}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Creative seeds */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Your Creative Ideas (optional)
                </label>
                <div className="space-y-3">
                  {seeds.map((seed, idx) => (
                    <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={seed.name}
                          onChange={(e) => updateSeed(idx, { name: e.target.value })}
                          placeholder="Concept name"
                          className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09] text-sm"
                        />
                        {seeds.length > 1 && (
                          <button
                            onClick={() => removeSeed(idx)}
                            className="text-gray-500 hover:text-red-400 px-2"
                            aria-label="Remove idea"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <textarea
                        value={seed.description}
                        onChange={(e) => updateSeed(idx, { description: e.target.value })}
                        placeholder="Describe the angle, vibe, or visual direction..."
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09] text-sm resize-y"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={addSeed}
                  className="mt-3 text-sm text-[#D73F09] hover:text-[#b33507]"
                >
                  + Add another idea
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-200">
              Dismiss
            </button>
          </div>
        )}

        {generating && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center mb-6">
            <div className="w-12 h-12 border-4 border-[#D73F09]/30 border-t-[#D73F09] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Creative Director is thinking...</p>
            <p className="text-gray-400 mt-2 text-sm">
              Reviewing the brief, searching inspo, and crafting 3-5 distinct concepts. This usually takes 20-60 seconds.
            </p>
          </div>
        )}

        {activeConcepts.length === 0 && !generating && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-xl font-medium">No concepts yet</p>
            <p className="text-gray-400 mt-2">
              Click &quot;Generate Concepts&quot; to have the Creative Director propose 3-5 creative directions for this brief.
            </p>
          </div>
        )}

        <div className="grid gap-6">
          {activeConcepts.map((concept) => (
            <div
              key={concept.id}
              className={`bg-gray-900 border rounded-xl p-6 ${
                concept.status === 'approved'
                  ? 'border-green-600'
                  : concept.status === 'rejected'
                  ? 'border-red-800 opacity-60'
                  : 'border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  {editingConceptId === concept.id ? (
                    <input
                      type="text"
                      value={editForm.name ?? concept.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="text-xl font-bold bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white w-full"
                    />
                  ) : (
                    <h3 className="text-xl font-bold">{concept.name}</h3>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${SCOPE_COLORS[concept.production_scope]}`}>
                      {SCOPE_LABELS[concept.production_scope]}
                    </span>
                    {concept.estimated_assets && (
                      <span className="text-xs text-gray-500">
                        ~{concept.estimated_assets} assets
                      </span>
                    )}
                    <span className="text-xs text-gray-600">
                      {concept.generated_by === 'claude' ? 'AI Generated' : 'Manual'}
                    </span>
                    {concept.status !== 'proposed' && (
                      <span className={`text-xs font-medium ${
                        concept.status === 'approved' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {STATUS_LABELS[concept.status]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {editingConceptId === concept.id ? (
                <textarea
                  rows={4}
                  value={editForm.hook ?? concept.hook}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, hook: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-300 mb-4"
                />
              ) : (
                <p className="text-gray-300 mb-4 leading-relaxed">{concept.hook}</p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                {concept.athlete_archetype && (
                  <div>
                    <span className="text-gray-500">Athlete Archetype:</span>
                    <p className="text-gray-300 mt-1">{concept.athlete_archetype}</p>
                  </div>
                )}
                {concept.settings_suggestions.length > 0 && (
                  <div>
                    <span className="text-gray-500">Settings:</span>
                    <p className="text-gray-300 mt-1">{concept.settings_suggestions.join(', ')}</p>
                  </div>
                )}
              </div>

              {concept.inspo_references.length > 0 && (
                <div className="text-xs text-gray-600 mb-4">
                  Inspo refs: {concept.inspo_references.length} items
                </div>
              )}

              {concept.status === 'proposed' && (
                <div className="flex gap-3 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => handleApprove(concept.id)}
                    className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingConceptId(concept.id)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setIteratingConceptId(concept.id);
                      setIterationFeedback('');
                    }}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
                  >
                    Iterate
                  </button>
                  <button
                    onClick={() => {
                      setEditingConceptId(concept.id);
                      setEditForm({ name: concept.name, hook: concept.hook });
                    }}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}

              {editingConceptId === concept.id && (
                <div className="flex gap-3 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => handleSaveEdit(concept.id)}
                    className="px-4 py-2 bg-[#D73F09] hover:bg-[#b33507] text-white rounded-lg text-sm font-medium"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => { setEditingConceptId(null); setEditForm({}); }}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {rejectingConceptId === concept.id && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <label className="text-sm text-gray-400 mb-2 block">
                    Why are you rejecting this? (This helps the AI learn)
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionFeedback}
                    onChange={(e) => setRejectionFeedback(e.target.value)}
                    placeholder='e.g. "Too product-forward, we want lifestyle first"'
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(concept.id)}
                      disabled={!rejectionFeedback.trim()}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => { setRejectingConceptId(null); setRejectionFeedback(''); }}
                      className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {iteratingConceptId === concept.id && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <label className="text-sm text-gray-400 mb-2 block">
                    What should the Creative Director change?
                  </label>
                  <textarea
                    rows={3}
                    value={iterationFeedback}
                    onChange={(e) => setIterationFeedback(e.target.value)}
                    placeholder='e.g. "More athletic, less product-forward, use BTS aesthetic"'
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleIterate(concept.id)}
                      disabled={!iterationFeedback.trim() || iterationLoading}
                      className="px-4 py-2 bg-[#D73F09] hover:bg-[#b33507] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {iterationLoading ? 'Regenerating...' : 'Send Feedback'}
                    </button>
                    <button
                      onClick={() => { setIteratingConceptId(null); setIterationFeedback(''); }}
                      className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {concept.status === 'rejected' && concept.rejection_feedback && (
                <div className="mt-4 pt-4 border-t border-gray-800 text-sm">
                  <span className="text-gray-500">Rejection reason:</span>
                  <p className="text-gray-400 mt-1 italic">&quot;{concept.rejection_feedback}&quot;</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {archivedConcepts.length > 0 && (
          <details className="mt-8">
            <summary className="text-gray-500 cursor-pointer hover:text-gray-300 text-sm">
              {archivedConcepts.length} archived concept{archivedConcepts.length !== 1 ? 's' : ''}
            </summary>
            <div className="grid gap-4 mt-4 opacity-50">
              {archivedConcepts.map((concept) => (
                <div key={concept.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <h4 className="font-medium">{concept.name}</h4>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{concept.hook}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
