"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BG, ORANGE, OFFWHITE, BEBAS } from "@/lib/portal";

// Per-side IG metrics. Shape mirrors athletes.metrics.ig_feed / .ig_reel — a
// loose bag of optional numbers + a post_url. Empty objects are normalized to
// null on the server, so a non-null value here means "has something".
export type SideMetrics = Record<string, number | string | null | undefined>;

type PostKind = "feed" | "reel";

// One post the athlete made in this campaign. An athlete can have several
// (e.g. two feed posts), each from its own `athletes` row with its own media +
// metrics + link.
export type PortalPost = {
  key: string;
  kind: PostKind;
  label: string; // "Feed", "Feed Post 1", "Reel Post 2", ...
  rowId: string; // the athletes row this post came from
  images: { fileUrl: string; thumb: string }[]; // feed carousel
  video: { fileUrl: string; poster: string | null } | null; // reel
  metrics: SideMetrics | null;
  postUrl: string | null;
};

export type PortalAthlete = {
  id: string; // group id (campaign + name)
  name: string;
  campaignId: string;
  campaignName: string; // already brandSafe()'d on the server
  posts: PortalPost[];
  school: string | null;
  sport: string | null;
  igHandle: string | null;
  igFollowers: number | null;
};

// Which metric fields to surface per kind, in display order.
const FIELDS: Record<PostKind, ReadonlyArray<readonly [string, string]>> = {
  feed: [
    ["Reach", "reach"],
    ["Impressions", "impressions"],
    ["Likes", "likes"],
    ["Comments", "comments"],
    ["Engagements", "total_engagements"],
    ["Eng. Rate", "engagement_rate"],
  ],
  reel: [
    ["Views", "views"],
    ["Likes", "likes"],
    ["Comments", "comments"],
    ["Engagements", "total_engagements"],
    ["Eng. Rate", "engagement_rate"],
  ],
};

function trimDecimal(v: number): string {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

// 7508 -> "7.5K", 1200000 -> "1.2M"
function formatCount(n: number): string {
  if (!isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs < 1000) return String(n);
  if (abs < 1_000_000) return `${trimDecimal(n / 1000)}K`;
  return `${trimDecimal(n / 1_000_000)}M`;
}

// 4.87 -> "4.87%"
function formatRate(r: number | string): string {
  const n = Number(r);
  if (!isFinite(n)) return String(r);
  return `${Math.round(n * 100) / 100}%`;
}

function buildCards(metrics: SideMetrics | null, kind: PostKind) {
  if (!metrics) return [] as { label: string; value: string }[];
  const out: { label: string; value: string }[] = [];
  for (const [label, key] of FIELDS[kind]) {
    const v = metrics[key];
    if (v === null || v === undefined || v === "") continue;
    out.push({
      label,
      value: key === "engagement_rate" ? formatRate(v) : formatCount(Number(v)),
    });
  }
  return out;
}

export default function AssetModal({
  athletes,
  startIndex,
  startPostIndex,
  onClose,
}: {
  athletes: PortalAthlete[];
  startIndex: number;
  startPostIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [postIdx, setPostIdx] = useState(startPostIndex);
  const [slide, setSlide] = useState(0);
  // Reel videos autoplay MUTED (browsers block sound-autoplay); the user taps to
  // unmute, Instagram-style. videoRef lets us flip mute imperatively so React
  // doesn't re-apply the static `muted` attribute and re-mute on every render.
  const [reelMuted, setReelMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const athlete = athletes[idx];

  const toggleReelMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setReelMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  };

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const next = useCallback(
    () => setIdx((i) => Math.min(athletes.length - 1, i + 1)),
    [athletes.length]
  );

  // Moving between athletes resets to their first post. Skip the very first run
  // so the tile-selected post (startPostIndex) survives mount.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setPostIdx(0);
    setSlide(0);
    setReelMuted(true); // new athlete's reel restarts muted
  }, [idx]);

  // Switching posts (tabs) resets the carousel and re-mutes the reel.
  useEffect(() => {
    setSlide(0);
    setReelMuted(true);
  }, [postIdx]);

  // Keyboard nav + body scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [prev, next, onClose]);

  if (!athlete) return null;

  const posts = athlete.posts;
  const post = posts[Math.min(postIdx, posts.length - 1)] || posts[0];
  const showTabs = posts.length > 1;

  const slides = post.kind === "feed" ? post.images : [];
  const cards = buildCards(post.metrics, post.kind);
  const postUrl = post.postUrl || null;
  const downloadUrl =
    post.kind === "feed" ? slides[slide]?.fileUrl : post.video?.fileUrl;

  return (
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(4,4,7,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
    >
      {/* Athlete nav — prev */}
      <NavArrow
        dir="left"
        disabled={idx === 0}
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1040px] max-h-[90vh] overflow-hidden rounded-[24px] grid grid-rows-[auto] md:grid-cols-[1.15fr_0.85fr]"
        style={{
          background: BG,
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Media side */}
        <div
          className="relative bg-black flex items-center justify-center"
          style={{ minHeight: "min(50vh, 420px)" }}
        >
          {post.kind === "reel" ? (
            post.video ? (
              <>
                <video
                  key={post.video.fileUrl}
                  ref={videoRef}
                  src={post.video.fileUrl}
                  poster={post.video.poster || undefined}
                  controls
                  autoPlay
                  muted
                  playsInline
                  className="max-h-[82vh] w-auto max-w-full object-contain"
                />
                {/* Tap-to-unmute control — sits above the native control bar */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleReelMute();
                  }}
                  aria-label={reelMuted ? "Unmute" : "Mute"}
                  title={reelMuted ? "Tap to unmute" : "Mute"}
                  className="absolute bottom-16 right-4 z-[2] grid place-items-center w-10 h-10 rounded-full transition-colors hover:bg-black/80"
                  style={{ background: "rgba(0,0,0,0.6)", color: "#fff", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
                >
                  {reelMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                  )}
                </button>
              </>
            ) : (
              <EmptyMedia label="No video" />
            )
          ) : slides.length > 0 ? (
            <>
              <img
                src={slides[slide]?.fileUrl}
                alt={athlete.name}
                className="max-h-[82vh] w-auto max-w-full object-contain"
              />
              {slides.length > 1 ? (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-3 px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
                  <CarouselBtn dir="left" onClick={() => setSlide((s) => (s - 1 + slides.length) % slides.length)} />
                  <div className="flex items-center gap-1.5">
                    {slides.map((_, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: i === slide ? ORANGE : "rgba(255,255,255,0.4)" }}
                      />
                    ))}
                  </div>
                  <CarouselBtn dir="right" onClick={() => setSlide((s) => (s + 1) % slides.length)} />
                </div>
              ) : null}
            </>
          ) : (
            <EmptyMedia label="No photos" />
          )}
        </div>

        {/* Info side */}
        <div className="p-6 md:p-7 flex flex-col overflow-y-auto" style={{ maxHeight: "90vh" }}>
          <p className="text-[10px] font-bold uppercase tracking-[2.5px] mb-2" style={{ color: ORANGE }}>
            {athlete.campaignName}
          </p>
          <h2 className="uppercase leading-[0.92] tracking-[0.5px]" style={{ ...BEBAS, color: OFFWHITE, fontSize: "clamp(30px, 4vw, 44px)" }}>
            {athlete.name}
            <span style={{ color: "rgba(255,255,255,0.45)" }}> · {post.label}</span>
          </h2>

          {/* Post tabs — one per post */}
          {showTabs ? (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {posts.map((p, i) => {
                const active = i === postIdx;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPostIdx(i)}
                    className="px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[1.5px] transition-colors"
                    style={{
                      background: active ? ORANGE : "rgba(255,255,255,0.06)",
                      color: active ? "#fff" : "rgba(255,255,255,0.6)",
                      border: `1px solid ${active ? ORANGE : "rgba(255,255,255,0.12)"}`,
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Metrics */}
          <div className="mt-6">
            {cards.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {cards.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-[14px] px-3 py-3.5 text-center"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div className="leading-none" style={{ ...BEBAS, color: OFFWHITE, fontSize: 30 }}>
                      {c.value}
                    </div>
                    <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {c.label}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                Metrics not available
              </p>
            )}
          </div>

          {/* Identity — who the creator is */}
          {athlete.igHandle || athlete.school || athlete.sport || athlete.igFollowers != null ? (
            <div
              className="mt-6 pt-6 flex items-end justify-between gap-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="min-w-0">
                {athlete.igHandle ? (
                  <a
                    href={`https://instagram.com/${athlete.igHandle.replace(/^@+/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15px] font-bold tracking-[0.3px] hover:underline"
                    style={{ color: ORANGE }}
                  >
                    @{athlete.igHandle.replace(/^@+/, "")}
                  </a>
                ) : null}
                {athlete.school || athlete.sport ? (
                  <div className="mt-1 text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {[athlete.school, athlete.sport].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
              {athlete.igFollowers != null ? (
                <div className="text-right shrink-0">
                  <div className="leading-none" style={{ ...BEBAS, color: OFFWHITE, fontSize: 28 }}>
                    {formatCount(athlete.igFollowers)}
                  </div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Followers
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-auto pt-7">
            {postUrl ? (
              <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[1.5px] transition-colors"
                style={{ background: ORANGE, color: "#fff" }}
              >
                View post
              </a>
            ) : null}
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download
                aria-label="Download"
                title="Download"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[1.5px] transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", color: OFFWHITE, border: "1px solid rgba(255,255,255,0.14)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </a>
            ) : null}
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-full transition-colors hover:bg-white/10"
          style={{ background: "rgba(0,0,0,0.45)", color: "#fff", backdropFilter: "blur(6px)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Athlete nav — next */}
      <NavArrow
        dir="right"
        disabled={idx === athletes.length - 1}
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
      />
    </div>
  );
}

function NavArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "left" | "right";
  disabled: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Previous athlete" : "Next athlete"}
      className="absolute top-1/2 -translate-y-1/2 z-[1] grid place-items-center w-11 h-11 rounded-full transition-opacity disabled:opacity-25"
      style={{
        [dir === "left" ? "left" : "right"]: "max(8px, 2vw)",
        background: "rgba(0,0,0,0.5)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(6px)",
      } as React.CSSProperties}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

function CarouselBtn({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={dir === "left" ? "Previous photo" : "Next photo"} className="grid place-items-center w-6 h-6 rounded-full hover:bg-white/15" style={{ color: "#fff" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

function EmptyMedia({ label }: { label: string }) {
  return (
    <div className="grid place-items-center text-[12px] uppercase tracking-[2px]" style={{ color: "rgba(255,255,255,0.35)" }}>
      {label}
    </div>
  );
}
