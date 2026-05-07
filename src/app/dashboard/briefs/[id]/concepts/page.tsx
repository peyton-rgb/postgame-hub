// ============================================================
// Concept Deck Page — /dashboard/briefs/[id]/concepts
// Shows AI-generated concept proposals as cards.
// The AM can generate concepts, approve/reject them, iterate, or edit manually.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Concept, Brief } from '@/lib/types/briefs';

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

  // Iteration modal state
  const [iteratingConceptId, setIteratingConceptId] = useState<string | null>(null);
  const [iterationFeedback, setIterationFeedback] = useState('');
  const [iterationLoading, setIterationLoading] = useState(false);

  // Rejection modal state
  const [rejectingConceptId, setRejectingConceptId] = useState<string | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState('');

  // Manual edit state
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Concept>>({});

  // Collaborate mode state
  const [mode, setMode] = useState<'fresh' | 'collaborate'>('fresh');
  const [athleteName, setAthleteName] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [location, setLocation] = useState('');
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [refImageInput, setRefImageInput] = useState('');
  const [creativeSeeds, setCreativeSeeds] = useState<string[]>([]);
  const [seedInput, setSeedInput] = useState('');

  // Fetch brief and concepts
  useEffect(() => {
    async function fetchData() {
      const [briefRes, conceptsRes] = await Promise.all([
        fetch(`/api/briefs/${briefId}`),
        fetch(`/api/concepts?brief_id=${briefId}`),
      ]);

      if (briefRes.ok) setBrief(await briefRes.json());
      if (conceptsRes.ok) setConcepts(await conceptsRes.json());
      setLoading(false);
    }
    fetchData();
  }, [briefId]);

  // Generate new concepts
  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      // Build the request body — include collaborate inputs when in Collaborate mode
      const requestBody: Record<string, unknown> = { brief_id: briefId };
      if (mode === 'collaborate') {
        if (athleteName.trim()) requestBody.athlete_name = athleteName.trim();
        if (shootDate) requestBody.shoot_date = shootDate;
        if (location.trim()) requestBody.location = location.trim();
        if (referenceImageUrls.length > 0) requestBody.reference_image_urls = referenceImageUrls;
        if (creativeSeeds.length > 0) requestBody.creative_seeds = creativeSeeds;
      }

      const res = await fetch('/api/concepts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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

  // Approve a concept
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

  // Reject a concept
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

  // Iterate on a concept
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
        const data = await res.json();
        // Re-fetch all concepts to show archived + new
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

  // Save manual edit
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

  // Filter: show active concepts (not archived)
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
        {/* Header */}
        <button
          onClick={() => router.push(`/dashboard/briefs/${briefId}`)}
          className="text-gray-400 hover:text-white mb-6 text-sm"
        >
          &larr; Back to Brief
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Creative Concepts</h1>
            <p className="text-gray-400 mt-1">{brief?.name}</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || brief?.status === 'draft'}
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

        {/* Mode toggle: Start Fresh vs Collaborate */}
        <div className="mb-6">
          <div className="inline-flex rounded-lg border border-gray-800 overflow-hidden">
            <button
              onClick={() => setMode('fresh')}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                mode === 'fresh'
                  ? 'bg-[#D73F09] text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              Start Fresh
            </button>
            <button
              onClick={() => setMode('collaborate')}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                mode === 'collaborate'
                  ? 'bg-[#D73F09] text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              Collaborate
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            {mode === 'fresh'
              ? 'Let the Creative Director generate concepts from the brief alone.'
              : 'Add your own creative input — athlete details, reference images, and ideas.'}
          </p>
        </div>

        {/* Collaborate panel — only visible in Collaborate mode */}
        {mode === 'collaborate' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Your Creative Input</h3>
            <p className="text-gray-400 text-sm mb-6">
              The more details you provide, the more tailored the concepts will be. All fields are optional.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Athlete Name */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Athlete Name</label>
                <input
                  type="text"
                  value={athleteName}
                  onChange={(e) => setAthleteName(e.target.value)}
                  placeholder="e.g. Jordan Smith"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:border-[#D73F09] focus:outline-none"
                />
              </div>

              {/* Shoot Date */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Shoot Date</label>
                <input
                  type="date"
                  value={shootDate}
                  onChange={(e) => setShootDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-[#D73F09] focus:outline-none [color-scheme:dark]"
                />
              </div>

              {/* Location */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, TX — DKR Stadium"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:border-[#D73F09] focus:outline-none"
                />
              </div>
            </div>

            {/* Reference Images */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-1 block">
                Reference Image URLs
                <span className="text-gray-600 ml-1">(paste one URL at a time)</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={refImageInput}
                  onChange={(e) => setRefImageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && refImageInput.trim()) {
                      e.preventDefault();
                      setReferenceImageUrls((prev) => [...prev, refImageInput.trim()]);
                      setRefImageInput('');
                    }
                  }}
                  placeholder="https://example.com/reference.jpg"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:border-[#D73F09] focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (refImageInput.trim()) {
                      setReferenceImageUrls((prev) => [...prev, refImageInput.trim()]);
                      setRefImageInput('');
                    }
                  }}
                  className="px-4 py-2.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
                >
                  Add
                </button>
              </div>
              {referenceImageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {referenceImageUrls.map((url, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300"
                    >
                      <span className="max-w-[200px] truncate">{url}</span>
                      <button
                        onClick={() => setReferenceImageUrls((prev) => prev.filter((_, j) => j !== i))}
                        className="text-gray-500 hover:text-red-400"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Creative Seeds */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Creative Seeds
                <span className="text-gray-600 ml-1">(your ideas for the Creative Director to riff on)</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && seedInput.trim()) {
                      e.preventDefault();
                      setCreativeSeeds((prev) => [...prev, seedInput.trim()]);
                      setSeedInput('');
                    }
                  }}
                  placeholder='e.g. "golden hour training montage" or "locker room prep ritual"'
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:border-[#D73F09] focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (seedInput.trim()) {
                      setCreativeSeeds((prev) => [...prev, seedInput.trim()]);
                      setSeedInput('');
                    }
                  }}
                  className="px-4 py-2.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
                >
                  Add
                </button>
              </div>
              {creativeSeeds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {creativeSeeds.map((seed, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-orange-900/30 border border-orange-800/50 rounded-lg px-3 py-1.5 text-xs text-orange-300"
                    >
                      {seed}
                      <button
                        onClick={() => setCreativeSeeds((prev) => prev.filter((_, j) => j !== i))}
                        className="text-orange-500 hover:text-red-400"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-200">
              Dismiss
            </button>
          </div>
        )}

        {/* Generating state */}
        {generating && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center mb-6">
            <div className="w-12 h-12 border-4 border-[#D73F09]/30 border-t-[#D73F09] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Creative Director is thinking...</p>
            <p className="text-gray-400 mt-2 text-sm">
              Reviewing the brief, searching inspo, and crafting 3-5 distinct concepts. This usually takes 20-60 seconds.
            </p>
          </div>
        )}

        {/* Empty state */}
        {activeConcepts.length === 0 && !generating && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-xl font-medium">No concepts yet</p>
            <p className="text-gray-400 mt-2">
              Click &quot;Generate Concepts&quot; to have the Creative Director propose 3-5 creative directions for this brief.
            </p>
          </div>
        )}

        {/* Concept cards */}
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
              {/* Concept header */}
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

              {/* Hook */}
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

              {/* Details */}
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

              {/* Inspo references */}
              {concept.inspo_references.length > 0 && (
                <div className="text-xs text-gray-600 mb-4">
                  Inspo refs: {concept.inspo_references.length} items
                </div>
              )}

              {/* Action buttons */}
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

              {/* Create Creative Brief — only for approved concepts */}
              {concept.status === 'approved' && (
                <div className="flex gap-3 pt-4 border-t border-gray-800">
                  <button
                    onClick={() =>
                      router.push(
                        `/dashboard/briefs/${briefId}/concepts/${concept.id}/creator-brief`
                      )
                    }
                    className="px-5 py-2 bg-[#D73F09] hover:bg-[#b33507] text-white rounded-lg text-sm font-medium"
                  >
                    Create Creative Brief
                  </button>
                </div>
              )}

              {/* Save/Cancel for manual edit mode */}
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

              {/* Rejection feedback inline */}
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

              {/* Iteration feedback inline */}
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

              {/* Rejection feedback display (after rejected) */}
              {concept.status === 'rejected' && concept.rejection_feedback && (
                <div className="mt-4 pt-4 border-t border-gray-800 text-sm">
                  <span className="text-gray-500">Rejection reason:</span>
                  <p className="text-gray-400 mt-1 italic">&quot;{concept.rejection_feedback}&quot;</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Archived concepts (collapsed by default) */}
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
