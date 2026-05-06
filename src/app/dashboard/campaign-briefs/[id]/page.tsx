// ============================================================
// Campaign Brief Detail Page — /dashboard/campaign-briefs/[id]
// Read-only view of a published brief, with action buttons
// for generating concepts, requesting changes, etc.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Brief } from '@/lib/types/briefs';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  in_production: 'In Production',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-600 text-gray-200',
  published: 'bg-blue-600 text-blue-100',
  in_production: 'bg-[#D73F09] text-white',
  complete: 'bg-green-600 text-green-100',
  cancelled: 'bg-red-900 text-red-200',
};

export default function CampaignBriefDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBrief() {
      const res = await fetch(`/api/campaign-briefs/${params.id}`);
      if (res.ok) {
        setBrief(await res.json());
      }
      setLoading(false);
    }
    fetchBrief();
  }, [params.id]);

  async function handleRequestChanges() {
    setActionLoading('changes');
    try {
      const res = await fetch(`/api/campaign-briefs/${params.id}/request-changes`, {
        method: 'POST',
      });
      if (res.ok) {
        const newVersion = await res.json();
        router.push(`/dashboard/campaign-briefs/${newVersion.id}`);
      }
    } catch (err) {
      console.error('Failed to request changes:', err);
    }
    setActionLoading(null);
  }

  function goToConcepts() {
    router.push(`/dashboard/campaign-briefs/${params.id}/concepts`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading brief...</p>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center">
        <p className="text-gray-400">Brief not found</p>
      </div>
    );
  }

  function extractText(content: Record<string, unknown> | null): string {
    if (!content) return '';
    try {
      const doc = content as { content?: { content?: { text?: string }[] }[] };
      return (
        doc.content
          ?.map((block) =>
            block.content?.map((inline) => inline.text || '').join('') || ''
          )
          .join('\n') || JSON.stringify(content)
      );
    } catch {
      return JSON.stringify(content);
    }
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/campaign-briefs')}
          className="text-gray-400 hover:text-white mb-6 text-sm"
        >
          &larr; Back to Briefs
        </button>

        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{brief.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[brief.status]}`}>
                {STATUS_LABELS[brief.status]}
              </span>
            </div>
            <p className="text-gray-400">
              {brief.brand?.name || 'Unknown brand'}
              {brief.version > 1 && ` · Version ${brief.version}`}
            </p>
          </div>

          <div className="flex gap-3">
            {brief.status === 'draft' && (
              <button
                onClick={() => router.push(`/dashboard/campaign-briefs/new?edit=${brief.id}`)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
              >
                Edit Draft
              </button>
            )}

            {brief.status === 'published' && (
              <>
                <button
                  onClick={handleRequestChanges}
                  disabled={actionLoading === 'changes'}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {actionLoading === 'changes' ? 'Creating...' : 'Request Changes'}
                </button>
                <button
                  onClick={goToConcepts}
                  className="px-4 py-2 bg-[#D73F09] hover:bg-[#b33507] text-white font-semibold rounded-lg text-sm"
                >
                  Generate Concepts
                </button>
              </>
            )}

            {brief.status === 'in_production' && (
              <button
                onClick={goToConcepts}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
              >
                View Concepts
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Campaign Info</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>{' '}
                <span className="capitalize">{brief.campaign_type.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-gray-500">Production:</span>{' '}
                <span className="capitalize">{brief.production_config.replace(/_/g, ' ')}</span>
              </div>
              {brief.start_date && (
                <div>
                  <span className="text-gray-500">Start:</span>{' '}
                  {new Date(brief.start_date).toLocaleDateString()}
                </div>
              )}
              {brief.target_launch_date && (
                <div>
                  <span className="text-gray-500">Launch:</span>{' '}
                  {new Date(brief.target_launch_date).toLocaleDateString()}
                </div>
              )}
              {brief.budget && (
                <div>
                  <span className="text-gray-500">Budget:</span>{' '}
                  ${Number(brief.budget).toLocaleString()}
                </div>
              )}
              {brief.drive_folder_id && (
                <div>
                  <span className="text-gray-500">Drive:</span>{' '}
                  <a
                    href={`https://drive.google.com/drive/folders/${brief.drive_folder_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#D73F09] hover:underline"
                  >
                    Open Folder
                  </a>
                </div>
              )}
              {!brief.drive_folder_id && brief.status !== 'draft' && (
                <div className="col-span-2 text-yellow-500 text-xs">
                  Drive folder not linked — the brand may not have a parent folder set.
                </div>
              )}
            </div>
          </div>

          {brief.brief_content && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Brief</h2>
              <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap">
                {extractText(brief.brief_content)}
              </div>
            </div>
          )}

          {(brief.mandatories.length > 0 || brief.restrictions.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="grid grid-cols-2 gap-6">
                {brief.mandatories.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-400 mb-3">Must Include</h3>
                    <ul className="space-y-1">
                      {brief.mandatories.map((m, i) => (
                        <li key={i} className="text-gray-300 text-sm">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {brief.restrictions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-400 mb-3">Do Not Mention</h3>
                    <ul className="space-y-1">
                      {brief.restrictions.map((r, i) => (
                        <li key={i} className="text-gray-300 text-sm">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {brief.athlete_targeting && Object.values(brief.athlete_targeting).some((v) =>
            Array.isArray(v) ? v.length > 0 : !!v
          ) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Athlete Targeting</h2>
              <div className="flex flex-wrap gap-2">
                {(brief.athlete_targeting.sports || []).map((s: string) => (
                  <span key={s} className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-xs">
                    {s}
                  </span>
                ))}
                {(brief.athlete_targeting.genders || []).map((g: string) => (
                  <span key={g} className="px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full text-xs capitalize">
                    {g}
                  </span>
                ))}
                {(brief.athlete_targeting.follower_tiers || []).map((t: string) => (
                  <span key={t} className="px-3 py-1 bg-green-900/50 text-green-300 rounded-full text-xs capitalize">
                    {t}
                  </span>
                ))}
                {(brief.athlete_targeting.schools || []).map((s: string) => (
                  <span key={s} className="px-3 py-1 bg-orange-900/50 text-orange-300 rounded-full text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-xs text-gray-600">
          Created {new Date(brief.created_at).toLocaleString()}
          {brief.updated_at !== brief.created_at && (
            <> · Updated {new Date(brief.updated_at).toLocaleString()}</>
          )}
        </div>
      </div>
    </div>
  );
}
