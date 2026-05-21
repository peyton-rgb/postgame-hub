// ============================================================
// Public Athlete Delivery Portal — /deliver/[token]
//
// The athlete-facing page. When a posting package is created,
// the athlete gets a unique link to this page. No auth needed.
//
// They see their content, captions, hashtags, mentions, FTC
// requirements, and posting window. They can confirm receipt
// ("I Got It") and later submit their live post URL.
//
// Design: Light, clean, professional — white cards on gray
// gradient with Postgame orange (#D73F09) accents.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// --- Types ---

interface PostingPackage {
  id: string;
  created_at: string;
  athlete_name: string;
  video_url: string | null;
  caption_short: string | null;
  caption_medium: string | null;
  caption_long: string | null;
  hashtags: string[];
  mentions: string[];
  platform_notes: string | null;
  ftc_note: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  status: string;
  sent_at: string | null;
  confirmed_at: string | null;
  posted_at: string | null;
  live_url: string | null;
  am_notes: string | null;
}

// --- Helpers ---

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- Copy button helper ---

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          {label || 'Copy'}
        </>
      )}
    </button>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function AthleteDeliveryPage() {
  const params = useParams();
  const token = params.token as string;

  const [pkg, setPkg] = useState<PostingPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Action states
  const [confirming, setConfirming] = useState(false);
  const [showPostedForm, setShowPostedForm] = useState(false);
  const [liveUrl, setLiveUrl] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Fetch the package
  useEffect(() => {
    const fetchPackage = async () => {
      try {
        const res = await fetch(`/api/deliver/${token}`);
        if (res.ok) {
          const data = await res.json();
          setPkg(data);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };

    fetchPackage();
  }, [token]);

  // Confirm receipt
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/deliver/${token}/confirm`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPkg(data);
      }
    } catch (err) {
      console.error('Failed to confirm:', err);
    }
    setConfirming(false);
  };

  // Submit posted URL
  const handlePosted = async () => {
    setSubmittingPost(true);
    try {
      const res = await fetch(`/api/deliver/${token}/posted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ live_url: liveUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setPkg(data);
        setShowPostedForm(false);
      }
    } catch (err) {
      console.error('Failed to submit post:', err);
    }
    setSubmittingPost(false);
  };

  // Determine if the content URL is a video
  const isVideo = pkg?.video_url
    ? /\.(mp4|mov|webm|avi|m4v)(\?|$)/i.test(pkg.video_url)
    : false;

  // Caption variants that exist
  const captions = [
    { label: 'Short', text: pkg?.caption_short },
    { label: 'Medium', text: pkg?.caption_medium },
    { label: 'Long', text: pkg?.caption_long },
  ].filter((c) => c.text);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-gray-400">Loading your package...</div>
      </div>
    );
  }

  // --- 404 state ---
  if (notFound || !pkg) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Package Not Found</h1>
          <p className="text-gray-500">
            Double-check the link you received. If the problem persists, contact your Postgame rep.
          </p>
        </div>
      </div>
    );
  }

  // --- Main render ---
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Postgame Logo Mark */}
            <div className="w-9 h-9 rounded-lg bg-[#D73F09] flex items-center justify-center">
              <span className="text-white font-bold text-sm">PG</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Your Content Package</h1>
              <p className="text-xs text-gray-500">
                {pkg.athlete_name ? `For ${pkg.athlete_name}` : 'From Postgame'}
              </p>
            </div>
          </div>

          {/* Status indicator */}
          {pkg.status === 'posted' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Posted
            </span>
          )}
          {pkg.status === 'confirmed' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Confirmed
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Video / Image Preview */}
        {pkg.video_url && (
          <div className="rounded-2xl overflow-hidden bg-black shadow-xl">
            {isVideo ? (
              <video
                src={pkg.video_url}
                controls
                className="w-full"
                playsInline
              />
            ) : (
              <img
                src={pkg.video_url}
                alt="Content preview"
                className="w-full"
              />
            )}
          </div>
        )}

        {/* Captions */}
        {captions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Captions</h2>
            {captions.map((caption) => (
              <div
                key={caption.label}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {caption.label}
                  </span>
                  <CopyButton text={caption.text!} />
                </div>
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {caption.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Platform Notes */}
        {pkg.platform_notes && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Platform Notes</h3>
            <p className="text-gray-800 text-sm">{pkg.platform_notes}</p>
          </div>
        )}

        {/* Hashtags */}
        {pkg.hashtags && pkg.hashtags.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hashtags</h3>
              <CopyButton text={pkg.hashtags.join(' ')} label="Copy All" />
            </div>
            <div className="flex flex-wrap gap-2">
              {pkg.hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 font-medium"
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mentions */}
        {pkg.mentions && pkg.mentions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mentions</h3>
              <CopyButton text={pkg.mentions.join(' ')} label="Copy All" />
            </div>
            <div className="flex flex-wrap gap-2">
              {pkg.mentions.map((mention, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700 font-medium"
                >
                  {mention.startsWith('@') ? mention : `@${mention}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* FTC Disclosure */}
        {pkg.ftc_note && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-amber-800 mb-1">FTC Disclosure Required</h3>
                <p className="text-sm text-amber-700">{pkg.ftc_note}</p>
              </div>
            </div>
          </div>
        )}

        {/* Posting Window */}
        {(pkg.posting_window_start || pkg.posting_window_end) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Posting Window</h3>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#D73F09]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <p className="text-gray-800 text-sm">
                {pkg.posting_window_start && pkg.posting_window_end ? (
                  <>
                    Please post between{' '}
                    <span className="font-semibold">{formatDateTime(pkg.posting_window_start)}</span>
                    {' '}and{' '}
                    <span className="font-semibold">{formatDateTime(pkg.posting_window_end)}</span>
                  </>
                ) : pkg.posting_window_start ? (
                  <>
                    Post after{' '}
                    <span className="font-semibold">{formatDateTime(pkg.posting_window_start)}</span>
                  </>
                ) : (
                  <>
                    Post before{' '}
                    <span className="font-semibold">{formatDateTime(pkg.posting_window_end!)}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Already posted */}
          {pkg.status === 'posted' && (
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-purple-800">
                  Posted{pkg.posted_at ? ` on ${formatDate(pkg.posted_at)}` : ''}
                </span>
              </div>
              {pkg.live_url && (
                <a
                  href={pkg.live_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-600 hover:underline break-all"
                >
                  {pkg.live_url}
                </a>
              )}
            </div>
          )}

          {/* Already confirmed but not posted */}
          {pkg.status === 'confirmed' && (
            <>
              <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-green-800">
                    Confirmed{pkg.confirmed_at ? ` on ${formatDate(pkg.confirmed_at)}` : ''}
                  </span>
                </div>
              </div>

              {/* I Posted It button */}
              {!showPostedForm ? (
                <button
                  onClick={() => setShowPostedForm(true)}
                  className="w-full px-5 py-3 rounded-xl bg-[#D73F09] text-white font-semibold text-sm hover:bg-[#c13808] transition-colors shadow-sm"
                >
                  I Posted It
                </button>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Paste the link to your live post
                  </label>
                  <input
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D73F09]/50 focus:border-[#D73F09]"
                    placeholder="https://instagram.com/p/..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handlePosted}
                      disabled={submittingPost}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-[#D73F09] text-white font-medium text-sm hover:bg-[#c13808] disabled:opacity-50 transition-colors"
                    >
                      {submittingPost ? 'Submitting...' : 'Submit'}
                    </button>
                    <button
                      onClick={() => setShowPostedForm(false)}
                      className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Not yet confirmed — show both buttons */}
          {pkg.status === 'sent' && (
            <>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full px-5 py-3.5 rounded-xl bg-[#D73F09] text-white font-semibold text-sm hover:bg-[#c13808] disabled:opacity-50 transition-colors shadow-sm"
              >
                {confirming ? 'Confirming...' : 'I Got It'}
              </button>

              {!showPostedForm ? (
                <button
                  onClick={() => setShowPostedForm(true)}
                  className="w-full px-5 py-3 rounded-xl bg-white text-gray-700 font-medium text-sm border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  I Already Posted It
                </button>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Paste the link to your live post
                  </label>
                  <input
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D73F09]/50 focus:border-[#D73F09]"
                    placeholder="https://instagram.com/p/..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handlePosted}
                      disabled={submittingPost}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-[#D73F09] text-white font-medium text-sm hover:bg-[#c13808] disabled:opacity-50 transition-colors"
                    >
                      {submittingPost ? 'Submitting...' : 'Submit'}
                    </button>
                    <button
                      onClick={() => setShowPostedForm(false)}
                      className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* AM Notes */}
        {pkg.am_notes && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes from Your Rep</h3>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{pkg.am_notes}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <p className="text-sm text-gray-400">
            Questions? Contact your Postgame rep.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-6 h-6 rounded bg-[#D73F09] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">PG</span>
            </div>
            <span className="text-xs text-gray-400">Postgame</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
