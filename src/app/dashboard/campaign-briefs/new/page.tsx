// ============================================================
// New Campaign Brief Form — /dashboard/campaign-briefs/new
// A multi-step form that walks the AM through creating a new brief.
// Steps: Brand → Basics → Production → Content → Athletes → Review
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import type {
  CreateBriefInput,
  BriefCampaignType,
  BriefProductionConfig,
  AthleteTargeting,
} from '@/lib/types/briefs';

const STEPS = [
  'Brand',
  'Campaign Basics',
  'Production',
  'Brief Content',
  'Athlete Targeting',
  'Review & Publish',
];

const CAMPAIGN_TYPES: { value: BriefCampaignType; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: 'Regular brand campaign' },
  { value: 'top_50', label: 'Top 50', description: 'Top 50 athlete program' },
  { value: 'ambassador_program', label: 'Ambassador', description: 'Ongoing ambassador partnership' },
  { value: 'gifting', label: 'Gifting', description: 'Product gifting campaign' },
  { value: 'experiential', label: 'Experiential', description: 'Live event or experience' },
  { value: 'recap_only', label: 'Recap Only', description: 'Recap of existing campaign' },
];

const PRODUCTION_CONFIGS: { value: BriefProductionConfig; label: string; description: string }[] = [
  { value: 'vid_is_editor', label: 'Videographer Edits', description: 'The videographer also handles editing' },
  { value: 'split_team', label: 'Split Team', description: 'Separate videographer and editor' },
  { value: 'no_production', label: 'No Production', description: 'No video production needed' },
];

export default function NewCampaignBriefPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [formData, setFormData] = useState<CreateBriefInput>({
    brand_id: '',
    name: '',
    campaign_type: 'standard',
    start_date: '',
    target_launch_date: '',
    budget: undefined,
    production_config: 'vid_is_editor',
    brief_content: {},
    mandatories: [],
    restrictions: [],
    athlete_targeting: {},
  });

  const [mandatoriesText, setMandatoriesText] = useState('');
  const [restrictionsText, setRestrictionsText] = useState('');

  const [targeting, setTargeting] = useState<AthleteTargeting>({
    sports: [],
    genders: [],
    schools: [],
    follower_tiers: [],
    markets: [],
  });

  const [briefText, setBriefText] = useState('');

  // Load brands directly via Supabase (matches existing BriefList.tsx pattern)
  useEffect(() => {
    async function fetchBrands() {
      const supabase = createBrowserSupabase();
      const { data } = await supabase
        .from('brands')
        .select('id, name')
        .order('name', { ascending: true });
      setBrands((data as { id: string; name: string }[]) || []);
    }
    fetchBrands();
  }, []);

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  function updateField<K extends keyof CreateBriefInput>(
    key: K,
    value: CreateBriefInput[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setError(null);
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setError(null);
    }
  }

  function validateStep(): boolean {
    switch (currentStep) {
      case 0:
        if (!formData.brand_id) {
          setError('Please select a brand');
          return false;
        }
        return true;
      case 1:
        if (!formData.name.trim()) {
          setError('Please enter a campaign name');
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  function handleNext() {
    if (validateStep()) {
      nextStep();
    }
  }

  async function saveDraft(): Promise<string | null> {
    setSaving(true);
    setError(null);

    const payload: CreateBriefInput = {
      ...formData,
      brief_content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: briefText }] }] },
      mandatories: mandatoriesText.split(',').map((s) => s.trim()).filter(Boolean),
      restrictions: restrictionsText.split(',').map((s) => s.trim()).filter(Boolean),
      athlete_targeting: targeting,
    };

    try {
      if (briefId) {
        const res = await fetch(`/api/campaign-briefs/${briefId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setSaving(false);
        return briefId;
      } else {
        const res = await fetch('/api/campaign-briefs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const data = await res.json();
        setBriefId(data.id);
        setSaving(false);
        return data.id as string;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
      setSaving(false);
      return null;
    }
  }

  async function publishBrief() {
    setPublishing(true);
    setError(null);

    let id = briefId;
    if (!id) {
      id = await saveDraft();
    }

    if (!id) {
      setError('Failed to save brief before publishing');
      setPublishing(false);
      return;
    }

    try {
      const res = await fetch(`/api/campaign-briefs/${id}/publish`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error((await res.json()).error);

      const result = await res.json();

      const warnings: string[] = [];
      if (!result.sideEffects.campaign.success) {
        warnings.push(`Campaign record: ${result.sideEffects.campaign.error}`);
      }
      if (result.sideEffects.drive.warning) {
        warnings.push(`Drive: ${result.sideEffects.drive.warning}`);
      }
      if (!result.sideEffects.drive.success && result.sideEffects.drive.error) {
        warnings.push(`Drive folders: ${result.sideEffects.drive.error}`);
      }
      if (!result.sideEffects.slack.success && result.sideEffects.slack.error) {
        warnings.push(`Slack: ${result.sideEffects.slack.error}`);
      }

      if (warnings.length > 0) {
        console.warn('Publish warnings:', warnings);
      }

      router.push(`/dashboard/campaign-briefs/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    }

    setPublishing(false);
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

        <h1 className="text-3xl font-bold mb-2">New Campaign Brief</h1>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8 mt-6">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < currentStep
                    ? 'bg-[#D73F09] text-white'
                    : i === currentStep
                    ? 'bg-white text-[#07070a]'
                    : 'bg-gray-800 text-gray-500'
                }`}
              >
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  i === currentStep ? 'text-white' : 'text-gray-500'
                }`}
              >
                {step}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${i < currentStep ? 'bg-[#D73F09]' : 'bg-gray-800'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          {/* Step 0: Brand Selection */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Select a Brand</h2>
              <p className="text-gray-400 mb-6">
                Which brand is this campaign for? Start typing to search.
              </p>
              <input
                type="text"
                placeholder="Search brands..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
              />
              <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                {filteredBrands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => {
                      updateField('brand_id', brand.id);
                      setBrandSearch(brand.name);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      formData.brand_id === brand.id
                        ? 'bg-[#D73F09] text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {brand.name}
                  </button>
                ))}
                {filteredBrands.length === 0 && brandSearch && (
                  <p className="text-gray-500 text-center py-4">
                    No brands found. You may need to add this brand first.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Campaign Basics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Campaign Basics</h2>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Campaign Name</label>
                <input
                  type="text"
                  placeholder='e.g. "Adidas EVO SL Spring 2026"'
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Campaign Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {CAMPAIGN_TYPES.map((ct) => (
                    <button
                      key={ct.value}
                      onClick={() => updateField('campaign_type', ct.value)}
                      className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                        formData.campaign_type === ct.value
                          ? 'border-[#D73F09] bg-[#D73F09]/10 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium">{ct.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{ct.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => updateField('start_date', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#D73F09]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Target Launch Date</label>
                  <input
                    type="date"
                    value={formData.target_launch_date || ''}
                    onChange={(e) => updateField('target_launch_date', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#D73F09]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Budget (USD)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={formData.budget || ''}
                  onChange={(e) => updateField('budget', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
                />
              </div>
            </div>
          )}

          {/* Step 2: Production Config */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Production Setup</h2>
              <p className="text-gray-400 mb-6">How will the video production work for this campaign?</p>
              <div className="space-y-3">
                {PRODUCTION_CONFIGS.map((pc) => (
                  <button
                    key={pc.value}
                    onClick={() => updateField('production_config', pc.value)}
                    className={`w-full text-left px-6 py-4 rounded-lg border transition-colors ${
                      formData.production_config === pc.value
                        ? 'border-[#D73F09] bg-[#D73F09]/10 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-lg">{pc.label}</div>
                    <div className="text-sm text-gray-500 mt-1">{pc.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Brief Content */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Brief Content</h2>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  What is this campaign about? What does the brand want?
                </label>
                <textarea
                  rows={8}
                  placeholder="Describe the campaign vision, goals, and creative direction..."
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09] resize-y"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be upgraded to a rich text editor. For now, plain text works.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Mandatories (must-include items, comma-separated)
                </label>
                <input
                  type="text"
                  placeholder='e.g. "product close-up, brand logo, athlete in uniform"'
                  value={mandatoriesText}
                  onChange={(e) => setMandatoriesText(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Restrictions (do-not-mention items, comma-separated)
                </label>
                <input
                  type="text"
                  placeholder='e.g. "competitor brands, alcohol, politics"'
                  value={restrictionsText}
                  onChange={(e) => setRestrictionsText(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
                />
              </div>
            </div>
          )}

          {/* Step 4: Athlete Targeting */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Athlete Targeting</h2>
              <p className="text-gray-400 mb-6">
                What kind of athletes should this campaign target? Leave blank for no filter.
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Sports (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder='e.g. "football, basketball, soccer"'
                  value={(targeting.sports || []).join(', ')}
                  onChange={(e) =>
                    setTargeting((prev) => ({
                      ...prev,
                      sports: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Gender</label>
                <div className="flex gap-3">
                  {['male', 'female', 'any'].map((g) => (
                    <button
                      key={g}
                      onClick={() =>
                        setTargeting((prev) => ({
                          ...prev,
                          genders: g === 'any' ? [] : [g],
                        }))
                      }
                      className={`px-6 py-2 rounded-lg border transition-colors capitalize ${
                        (g === 'any' && (!targeting.genders || targeting.genders.length === 0)) ||
                        targeting.genders?.includes(g)
                          ? 'border-[#D73F09] bg-[#D73F09]/10 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Follower Tier
                </label>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { value: 'micro', label: 'Micro (<10K)' },
                    { value: 'mid', label: 'Mid (10K-100K)' },
                    { value: 'macro', label: 'Macro (100K-1M)' },
                    { value: 'mega', label: 'Mega (1M+)' },
                  ].map((tier) => (
                    <button
                      key={tier.value}
                      onClick={() =>
                        setTargeting((prev) => {
                          const current = prev.follower_tiers || [];
                          const updated = current.includes(tier.value)
                            ? current.filter((t) => t !== tier.value)
                            : [...current, tier.value];
                          return { ...prev, follower_tiers: updated };
                        })
                      }
                      className={`px-4 py-2 rounded-lg border transition-colors text-sm ${
                        targeting.follower_tiers?.includes(tier.value)
                          ? 'border-[#D73F09] bg-[#D73F09]/10 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Schools (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder='e.g. "University of Miami, Ohio State"'
                  value={(targeting.schools || []).join(', ')}
                  onChange={(e) =>
                    setTargeting((prev) => ({
                      ...prev,
                      schools: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
                />
              </div>
            </div>
          )}

          {/* Step 5: Review & Publish */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Review Your Brief</h2>

              <div className="space-y-4">
                <div className="border-b border-gray-800 pb-4">
                  <div className="text-sm text-gray-500">Brand</div>
                  <div className="text-lg">{brands.find((b) => b.id === formData.brand_id)?.name || '—'}</div>
                </div>

                <div className="border-b border-gray-800 pb-4">
                  <div className="text-sm text-gray-500">Campaign Name</div>
                  <div className="text-lg">{formData.name || '—'}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <div className="text-sm text-gray-500">Type</div>
                    <div>{CAMPAIGN_TYPES.find((ct) => ct.value === formData.campaign_type)?.label}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Production</div>
                    <div>{PRODUCTION_CONFIGS.find((pc) => pc.value === formData.production_config)?.label}</div>
                  </div>
                </div>

                {briefText && (
                  <div className="border-b border-gray-800 pb-4">
                    <div className="text-sm text-gray-500">Brief Content</div>
                    <div className="text-gray-300 mt-1 whitespace-pre-wrap">{briefText}</div>
                  </div>
                )}

                {mandatoriesText && (
                  <div className="border-b border-gray-800 pb-4">
                    <div className="text-sm text-gray-500">Mandatories</div>
                    <div className="text-gray-300 mt-1">{mandatoriesText}</div>
                  </div>
                )}

                {restrictionsText && (
                  <div className="border-b border-gray-800 pb-4">
                    <div className="text-sm text-gray-500">Restrictions</div>
                    <div className="text-gray-300 mt-1">{restrictionsText}</div>
                  </div>
                )}
              </div>

              <div className="mt-8 p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">
                  Publishing this brief will lock it from further edits, create a campaign record,
                  set up Drive folders, and send a Slack notification.
                  You can save as a draft first if you&apos;re not ready.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <div>
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                &larr; Back
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { void saveDraft(); }}
              disabled={saving || !formData.brand_id || !formData.name}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : briefId ? 'Update Draft' : 'Save Draft'}
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-[#D73F09] hover:bg-[#b33507] text-white font-semibold rounded-lg transition-colors"
              >
                Next &rarr;
              </button>
            ) : (
              <button
                onClick={publishBrief}
                disabled={publishing}
                className="px-8 py-3 bg-[#D73F09] hover:bg-[#b33507] text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Publish Brief'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
