// ============================================================
// Publishing Calendar — /dashboard/publishing
//
// Content calendar and publishing queue for Station 4.
// Two views:
//   1. Calendar (month) — shows scheduled posts as colored
//      dots by channel on each day
//   2. List view — upcoming scheduled posts with full details
//
// CMs can reschedule, mark as published (manual), or remove
// items from the queue. Channel filter tabs across the top.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

interface QueueItem {
  id: string;
  created_at: string;
  updated_at: string;
  channel: string;
  caption: string | null;
  hashtags: string[];
  asset_url: string | null;
  asset_urls: string[];
  thumbnail_url: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
  athlete_name: string | null;
  campaign_id: string | null;
  notes: string | null;
  publish_error: string | null;
}

// --- Channel config ---

const CHANNELS = [
  { key: 'all', label: 'All', icon: '', color: '' },
  { key: 'instagram', label: 'Instagram', icon: 'IG', color: 'bg-pink-600' },
  { key: 'tiktok', label: 'TikTok', icon: 'TT', color: 'bg-gray-800 border border-white/20' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'LI', color: 'bg-blue-700' },
  { key: 'youtube', label: 'YouTube', icon: 'YT', color: 'bg-red-600' },
  { key: 'twitter/x', label: 'Twitter/X', icon: 'X', color: 'bg-gray-700' },
  { key: 'newsletter', label: 'Newsletter', icon: 'NL', color: 'bg-emerald-700' },
];

const CHANNEL_DOT_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  tiktok: 'bg-white',
  linkedin: 'bg-blue-500',
  youtube: 'bg-red-500',
  'twitter/x': 'bg-gray-400',
  twitter: 'bg-gray-400',
  newsletter: 'bg-emerald-500',
};

// --- Status badges ---

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  approved: { label: 'Approved', classes: 'bg-green-600/20 text-green-300 border-green-600/30' },
  scheduled: { label: 'Scheduled', classes: 'bg-blue-600/20 text-blue-300 border-blue-600/30' },
  published: { label: 'Published', classes: 'bg-purple-600/20 text-purple-300 border-purple-600/30' },
  failed: { label: 'Failed', classes: 'bg-red-600/20 text-red-300 border-red-600/30' },
};

// --- Helpers ---

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PublishingPage() {
  const supabase = createBrowserSupabase();

  // --- State ---
  const [items, setItems] = useState<QueueItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // Reschedule modal
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('12:00');

  // --- Fetch items ---
  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '200' });
    if (channelFilter !== 'all') params.set('channel', channelFilter);

    const res = await fetch(`/api/publishing?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setTotalItems(data.total || 0);
    }
    setLoading(false);
  }, [channelFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // --- Calendar navigation ---
  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  const goToday = () => {
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
  };

  // --- Get items for a specific day ---
  const getItemsForDay = (day: number): QueueItem[] => {
    const targetDate = new Date(calYear, calMonth, day);
    return items.filter((item) => {
      if (!item.scheduled_for) return false;
      return isSameDay(new Date(item.scheduled_for), targetDate);
    });
  };

  // --- Reschedule ---
  const handleReschedule = async () => {
    if (!reschedulingId || !rescheduleDate) return;

    const scheduledFor = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();

    const res = await fetch('/api/publishing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_queue_id: reschedulingId,
        scheduled_for: scheduledFor,
      }),
    });

    if (res.ok) {
      setReschedulingId(null);
      setRescheduleDate('');
      setRescheduleTime('12:00');
      fetchItems();
    }
  };

  // --- Mark as published ---
  const handleMarkPublished = async (itemId: string) => {
    await fetch(`/api/captions/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'published',
        posted_at: new Date().toISOString(),
      }),
    });
    fetchItems();
  };

  // --- Remove from queue (back to approved) ---
  const handleRemoveFromQueue = async (itemId: string) => {
    await fetch(`/api/captions/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'approved',
        scheduled_for: null,
      }),
    });
    fetchItems();
  };

  // --- Get channel display ---
  const getChannelConfig = (key: string) => {
    return CHANNELS.find((c) => c.key === key) || CHANNELS[1];
  };

  // --- Build calendar grid ---
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  // Sorted upcoming items (for list view below calendar)
  const upcomingItems = items
    .filter((item) => item.status === 'scheduled' || item.status === 'approved')
    .sort((a, b) => {
      const da = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity;
      const db = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity;
      return da - db;
    });

  return (
    <div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Publishing Calendar</h1>
            <p className="text-gray-400 mt-1">
              Schedule and track your content across all channels
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard/captions"
              className="px-4 py-2 text-sm text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
            >
              Caption Composer
            </a>
          </div>
        </div>

        {/* Channel filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CHANNELS.map((ch) => (
            <button
              key={ch.key}
              onClick={() => setChannelFilter(ch.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                channelFilter === ch.key
                  ? 'bg-[#D73F09]/20 text-[#D73F09] border border-[#D73F09]/30'
                  : 'text-gray-400 border border-gray-800 hover:bg-gray-800'
              }`}
            >
              {ch.icon && (
                <span className={`w-5 h-5 rounded-full ${ch.color} flex items-center justify-center text-[8px] font-bold text-white`}>
                  {ch.icon}
                </span>
              )}
              {ch.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-[#D73F09] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">Loading calendar...</p>
          </div>
        ) : (
          <>
            {/* Calendar */}
            <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 mb-8">
              {/* Calendar header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </h2>
                  <button
                    onClick={goToday}
                    className="px-3 py-1 text-xs text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
                  >
                    Today
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={prevMonth}
                    className="w-8 h-8 flex items-center justify-center border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 transition"
                  >
                    &#8249;
                  </button>
                  <button
                    onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 transition"
                  >
                    &#8250;
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-xs text-gray-600 py-2 font-medium">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before the first */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 bg-[#0f0f0f] rounded-lg" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayItems = getItemsForDay(day);
                  const isToday = isSameDay(new Date(calYear, calMonth, day), today);

                  return (
                    <div
                      key={day}
                      className={`h-20 rounded-lg p-1.5 ${
                        isToday
                          ? 'bg-[#D73F09]/10 border border-[#D73F09]/30'
                          : 'bg-[#0f0f0f] border border-transparent hover:border-gray-700'
                      } transition`}
                    >
                      <span className={`text-xs font-medium ${isToday ? 'text-[#D73F09]' : 'text-gray-500'}`}>
                        {day}
                      </span>
                      {/* Channel dots */}
                      {dayItems.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dayItems.slice(0, 6).map((item) => (
                            <div
                              key={item.id}
                              className={`w-2.5 h-2.5 rounded-full ${
                                CHANNEL_DOT_COLORS[item.channel.toLowerCase()] || 'bg-gray-500'
                              }`}
                              title={`${getChannelConfig(item.channel).label}: ${(item.caption || '').slice(0, 50)}`}
                            />
                          ))}
                          {dayItems.length > 6 && (
                            <span className="text-[9px] text-gray-500">+{dayItems.length - 6}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-800">
                {CHANNELS.filter((c) => c.key !== 'all').map((ch) => (
                  <div key={ch.key} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${CHANNEL_DOT_COLORS[ch.key] || 'bg-gray-500'}`} />
                    <span className="text-xs text-gray-500">{ch.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming posts list */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Upcoming Posts</h2>
                <span className="text-sm text-gray-500">{upcomingItems.length} items</span>
              </div>

              {upcomingItems.length === 0 ? (
                <div className="text-center py-16 border border-gray-800 rounded-xl bg-[#141414]">
                  <div className="text-4xl mb-3 text-gray-700">&#128197;</div>
                  <p className="text-gray-400 font-medium">No upcoming posts</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Head to the{' '}
                    <a href="/dashboard/captions" className="text-[#D73F09] hover:text-[#e8663d]">
                      Caption Composer
                    </a>{' '}
                    to create and approve content
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingItems.map((item) => {
                    const channelConfig = getChannelConfig(item.channel);
                    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.approved;
                    const isExpanded = expandedItem === item.id;

                    return (
                      <div
                        key={item.id}
                        className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden"
                      >
                        {/* Item row */}
                        <div
                          className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition"
                          onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        >
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden">
                            {item.thumbnail_url || item.asset_url ? (
                              <img
                                src={item.thumbnail_url || item.asset_url || ''}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 text-lg">
                                &#128247;
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-200 truncate">
                              {item.caption ? item.caption.slice(0, 80) + (item.caption.length > 80 ? '...' : '') : 'No caption'}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              {item.athlete_name && (
                                <span className="text-xs text-gray-500">{item.athlete_name}</span>
                              )}
                              {item.scheduled_for && (
                                <span className="text-xs text-gray-400">
                                  {new Date(item.scheduled_for).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}{' '}
                                  at{' '}
                                  {new Date(item.scheduled_for).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Channel badge */}
                          <span className={`w-8 h-8 rounded-full ${channelConfig.color} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                            {channelConfig.icon}
                          </span>

                          {/* Status badge */}
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.classes}`}>
                            {statusConfig.label}
                          </span>

                          {/* Expand chevron */}
                          <span className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            &#9660;
                          </span>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="border-t border-gray-800 p-4 bg-[#0f0f0f]">
                            {/* Full caption */}
                            {item.caption && (
                              <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-1">Full Caption</p>
                                <p className="text-sm text-gray-300 whitespace-pre-line">{item.caption}</p>
                              </div>
                            )}

                            {/* Hashtags */}
                            {item.hashtags && item.hashtags.length > 0 && (
                              <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-1">Hashtags</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.hashtags.map((h) => (
                                    <span key={h} className="px-2 py-0.5 bg-blue-600/10 border border-blue-600/20 rounded-full text-xs text-blue-300">
                                      #{h}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Asset */}
                            {(item.asset_url || item.thumbnail_url) && (
                              <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-1">Asset</p>
                                <img
                                  src={item.thumbnail_url || item.asset_url || ''}
                                  alt=""
                                  className="w-32 h-32 object-cover rounded-lg"
                                />
                              </div>
                            )}

                            {/* Error */}
                            {item.publish_error && (
                              <div className="mb-4 p-2 bg-red-600/10 border border-red-600/20 rounded-lg">
                                <p className="text-xs text-red-400">{item.publish_error}</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 pt-2">
                              {/* Reschedule */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReschedulingId(item.id);
                                  if (item.scheduled_for) {
                                    const d = new Date(item.scheduled_for);
                                    setRescheduleDate(d.toISOString().split('T')[0]);
                                    setRescheduleTime(d.toTimeString().slice(0, 5));
                                  }
                                }}
                                className="px-4 py-1.5 bg-blue-600/10 text-blue-400 border border-blue-600/20 rounded-lg text-xs font-medium hover:bg-blue-600/20 transition"
                              >
                                Reschedule
                              </button>

                              {/* Mark as Published */}
                              {item.status !== 'published' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMarkPublished(item.id); }}
                                  className="px-4 py-1.5 bg-purple-600/10 text-purple-400 border border-purple-600/20 rounded-lg text-xs font-medium hover:bg-purple-600/20 transition"
                                >
                                  Mark as Published
                                </button>
                              )}

                              {/* Remove from queue */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveFromQueue(item.id); }}
                                className="px-4 py-1.5 bg-red-600/10 text-red-400 border border-red-600/20 rounded-lg text-xs font-medium hover:bg-red-600/20 transition"
                              >
                                Remove from Queue
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Published items (collapsed section) */}
            {items.filter((i) => i.status === 'published').length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">
                  Recently Published
                  <span className="text-sm text-gray-500 font-normal ml-2">
                    ({items.filter((i) => i.status === 'published').length})
                  </span>
                </h2>
                <div className="space-y-2">
                  {items
                    .filter((i) => i.status === 'published')
                    .sort((a, b) => new Date(b.posted_at || b.updated_at).getTime() - new Date(a.posted_at || a.updated_at).getTime())
                    .slice(0, 10)
                    .map((item) => {
                      const channelConfig = getChannelConfig(item.channel);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 p-3 bg-[#141414] border border-gray-800 rounded-xl"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden">
                            {item.thumbnail_url || item.asset_url ? (
                              <img
                                src={item.thumbnail_url || item.asset_url || ''}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                                &#128247;
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">
                              {item.caption ? item.caption.slice(0, 60) : 'No caption'}
                            </p>
                          </div>
                          <span className={`w-7 h-7 rounded-full ${channelConfig.color} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                            {channelConfig.icon}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-purple-600/20 text-purple-300 border-purple-600/30">
                            Published
                          </span>
                          {item.posted_at && (
                            <span className="text-xs text-gray-600">
                              {new Date(item.posted_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Reschedule modal */}
        {reschedulingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Reschedule Post</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#D73F09]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Time</label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#D73F09]"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setReschedulingId(null);
                    setRescheduleDate('');
                    setRescheduleTime('12:00');
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!rescheduleDate}
                  className="flex-1 px-4 py-2.5 bg-[#D73F09] hover:bg-[#b33507] disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition"
                >
                  Reschedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
