"use client";

/**
 * Blind Rank — camera version. /quiz/mcd-blind-rank-cam
 *
 * The athlete films themselves playing the blind ranking game: the camera feed
 * and the game overlays are composited onto one 9:16 canvas, and that canvas is
 * what gets recorded. Everything is local — getUserMedia in, MediaRecorder out,
 * an object URL to download. No uploads, no Supabase, no auth.
 *
 * Game rules are the same as /quiz/mcd-blind-rank: a fresh Fisher-Yates shuffle
 * of all seven drinks, one reveal at a time, and a slot is final the moment it
 * is tapped.
 *
 * CANVAS TAINT — the export depends on this: every image drawn to the canvas is
 * same-origin (the card PNGs in /public) and the camera MediaStream, neither of
 * which taints. The Arches and Postgame logos are hotlinked from Supabase, so
 * they appear only as ordinary DOM images on the intro and review screens and
 * are never drawn to the canvas. Drawing one would taint it and toBlob/
 * captureStream would fail — no in-frame watermark in v1 for exactly this
 * reason.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Arimo } from "next/font/google";

const arimo = Arimo({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-arimo",
  display: "swap",
});

/* ─────────────────────────── brand tokens ─────────────────────────── */

const GOLD = "#FFC72C";
const GOLD_INK = "#27251F";

/** DOM-only. Never drawn to the canvas — see the taint note above. */
const ARCHES_LOGO =
  "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/brand-kits/9ecac2a1-1449-4daf-bc62-78fe4feb9091/primary-logo.png";
const POSTGAME_WORDMARK =
  "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/brand-kits/1774632094358-hv0c0rmo.png";

const EYEBROW = "font-mono text-[11px] font-bold uppercase tracking-[0.22em]";
const DISPLAY = "font-display uppercase leading-[0.95]";
const GLASS = "rounded-2xl border border-[#FAF8F5]/10 bg-[#FAF8F5]/[0.04]";
const CTA =
  "min-h-[52px] rounded-full px-9 font-mono text-[13px] font-bold uppercase tracking-[0.18em] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.98] disabled:opacity-40";

/* ────────────────────────────── data ────────────────────────────── */

type DrinkKey =
  | "orangeDream"
  | "strawberryWatermelon"
  | "spriteBerryBlast"
  | "dirtyDrPepper"
  | "blackberryPassionFruit"
  | "dragonberry"
  | "mangoPineapple";

/** Pre-branded 1000x1000 cards — gold ground, drink and name baked in. */
const CARDS: Record<DrinkKey, { name: string; src: string }> = {
  orangeDream: {
    name: "Orange Dream",
    src: "/quiz/mcd-blind-rank-cam/card_orange-dream-hi-c.png",
  },
  strawberryWatermelon: {
    name: "Strawberry Watermelon",
    src: "/quiz/mcd-blind-rank-cam/card_strawberry-watermelon.png",
  },
  spriteBerryBlast: {
    name: "Sprite Berry Blast",
    src: "/quiz/mcd-blind-rank-cam/card_sprite-berry-blast.png",
  },
  dirtyDrPepper: {
    name: "Dirty Dr. Pepper",
    src: "/quiz/mcd-blind-rank-cam/card_dirty-dr-pepper.png",
  },
  blackberryPassionFruit: {
    name: "Blackberry Passion Fruit",
    src: "/quiz/mcd-blind-rank-cam/card_blackberry-passion-fruit.png",
  },
  dragonberry: {
    name: "Dragonberry",
    src: "/quiz/mcd-blind-rank-cam/card_redbull-dragonberry-energizer.png",
  },
  mangoPineapple: {
    name: "Mango Pineapple",
    src: "/quiz/mcd-blind-rank-cam/card_mango-pineapple-popping-tropic.png",
  },
};

const ALL_DRINKS: DrinkKey[] = [
  "orangeDream",
  "strawberryWatermelon",
  "spriteBerryBlast",
  "dirtyDrPepper",
  "blackberryPassionFruit",
  "dragonberry",
  "mangoPineapple",
];

const SLOT_COUNT = ALL_DRINKS.length;

/** Fisher-Yates. Called only from event handlers, never during render. */
function shuffle(keys: DrinkKey[]): DrinkKey[] {
  const out = [...keys];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ──────────────────────── canvas geometry ────────────────────────
   Fractions of the canvas, so the same numbers drive both the drawing and the
   percentage-positioned HTML tap targets laid over the rail. */

/** 9:16. The canvas keeps this shape; its pixel size comes from the real feed. */
const TARGET_ASPECT = 9 / 16;
/** Only used if the browser never reports usable video dimensions. */
const FALLBACK_W = 1080;
const FALLBACK_H = 1920;

/**
 * The largest centred region of a native frame matching `aspect` (w/h). When the
 * frame already matches, this is the whole frame — zero crop.
 */
function centreCropTo(nw: number, nh: number, aspect: number) {
  if (!nw || !nh) return { sx: 0, sy: 0, sw: FALLBACK_W, sh: FALLBACK_H };
  let sw: number;
  let sh: number;
  if (nw / nh > aspect) {
    sh = nh; // too wide — trim the sides
    sw = Math.round(nh * aspect);
  } else {
    sw = nw; // too tall — trim top and bottom
    sh = Math.round(nw / aspect);
  }
  return { sx: Math.round((nw - sw) / 2), sy: Math.round((nh - sh) / 2), sw, sh };
}

/**
 * Canvas size from the *rendered* frame, and only from the rendered frame.
 *
 * A portrait frame is used whole — no crop at all, whatever its aspect. Forcing
 * 9:16 on an already-portrait feed was itself a source of zoom: a 3:4 portrait
 * frame lost a quarter of its width to satisfy an aspect nobody asked for.
 * Cropping now happens only when the feed arrives landscape, which is the one
 * case where something has to give.
 */
function deriveCanvasSize(nw: number, nh: number) {
  if (!nw || !nh) return { w: FALLBACK_W, h: FALLBACK_H, cropped: false };
  if (nh >= nw) return { w: nw, h: nh, cropped: false };
  const { sw, sh } = centreCropTo(nw, nh, TARGET_ASPECT);
  return { w: sw, h: sh, cropped: true };
}

/**
 * Reels/TikTok safe zone. Their UI covers the bottom band (caption, handle) and
 * the right band (like/comment/share rail), and the top under the status area —
 * so every overlay we bake into the export has to live inside this rectangle.
 * The camera feed still fills the whole frame; only graphics are constrained.
 */
const SAFE = { topFrac: 0.08, bottomFrac: 0.73, leftFrac: 0.04, rightFrac: 0.86 };

/**
 * Everything positional, derived from the canvas size so it holds for any aspect
 * the camera hands us (9:16, 3:4, whatever). Shared by the canvas renderer and
 * the DOM tap targets, so they cannot drift apart.
 *
 * The rail is what absorbs the squeeze: seven tiles have to fit between the card
 * and the 73% line, so tile height falls out of the arithmetic rather than being
 * a fixed fraction.
 */
function computeLayout(W: number, H: number) {
  const safe = {
    top: SAFE.topFrac * H,
    bottom: SAFE.bottomFrac * H,
    left: SAFE.leftFrac * W,
    right: SAFE.rightFrac * W,
  };

  // 46% rather than the old 55%: the card has to share the safe box with seven
  // slots now, and every point of card width costs the rail height.
  const cardW = 0.46 * W;
  const cardX = (W - cardW) / 2;
  const cardY = safe.top;
  const cardBottom = cardY + cardW; // the art is square

  const promptY = cardBottom + 0.03 * H;
  const railTop = promptY + 0.025 * H;
  const railX = Math.max(0.045 * W, safe.left);
  const railW = 0.2 * W;
  const gap = 0.006 * H;
  const tileH = Math.max((safe.bottom - railTop - gap * 6) / 7, 1);

  return { safe, cardX, cardY, cardW, promptY, railTop, railX, railW, gap, tileH };
}

const tileTop = (l: ReturnType<typeof computeLayout>, i: number) =>
  l.railTop + i * (l.tileH + l.gap);

/* ──────────────────────────── recording ──────────────────────────── */

/**
 * mp4 first for iOS Safari (which records mp4 and cannot play most webm), webm
 * for Chrome/Android. Feature-detected because support varies wildly.
 */
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported?.(mime)) return mime;
    } catch {
      // isTypeSupported can throw on odd strings — treat as unsupported.
    }
  }
  return "";
}

const extensionFor = (mime: string) => (mime.includes("mp4") ? "mp4" : "webm");

/* ───────────────────────── canvas helpers ───────────────────────── */

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  // roundRect is missing on older iOS Safari, so keep the arcTo fallback.
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw a source cover-fitted into a destination box (like object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  if (!sw || !sh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(src, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
}

/** Resolves once the element reports real dimensions, or gives up after ~2.5s. */
function whenVideoSized(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("loadedmetadata", finish);
      video.removeEventListener("resize", finish);
      resolve();
    };
    video.addEventListener("loadedmetadata", finish);
    video.addEventListener("resize", finish);
    setTimeout(finish, 2500);
  });
}

/* ───────────────────────────── page ───────────────────────────── */

type Stage = "intro" | "denied" | "live" | "review";
/** spinning: the randomizer is cycling. placing: it has landed, rail is live. */
type Phase = "spinning" | "placing" | "board";
type Facing = "user" | "environment";

type GameState = {
  order: DrinkKey[];
  index: number;
  slots: (DrinkKey | null)[];
  phase: Phase;
};

const emptyGame = (): GameState => ({
  order: [],
  index: 0,
  slots: Array(SLOT_COUNT).fill(null),
  phase: "spinning",
});

/** Cycle speed while spinning, then the slowing steps after the tap (~600ms). */
const SPIN_MS = 80;
const DECEL_MS = [90, 120, 160, 230];
/** Scale-pop when the reel lands. */
const POP_MS = 260;

export default function BlindRankCamPage() {
  const [stage, setStage] = useState<Stage>("intro");
  const [facing, setFacing] = useState<Facing>("user");
  const [landscape, setLandscape] = useState(false);
  const [cardsReady, setCardsReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("mp4");
  const [errorNote, setErrorNote] = useState<string | null>(null);

  /** Mirrors game state for the rAF loop, which must not read stale closures. */
  const gameRef = useRef<GameState>(emptyGame());
  const [game, setGame] = useState<GameState>(emptyGame());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  /** The first stream — its audio track stays alive across camera flips. */
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imagesRef = useRef<Partial<Record<DrinkKey, HTMLImageElement>>>({});
  const urlRef = useRef<string | null>(null);
  /**
   * Set when a run should begin as soon as the live stage is on screen. It is
   * consumed by an effect rather than a timer: startRecording needs canvasRef
   * populated, and only a post-commit effect can guarantee that. (A setTimeout
   * here races React's commit — when it lost, drawing still worked because the
   * rAF loop reads the ref per frame, but recording silently never started.)
   */
  const pendingRunRef = useRef(false);
  /**
   * The card currently on screen. Lives only in a ref: the reel swaps it every
   * 80ms and the draw loop reads it per frame, so putting it in state would mean
   * ~12 React renders a second for something no DOM node depends on.
   */
  const showingRef = useRef<DrinkKey | null>(null);
  /** Timestamp the reel landed, for the scale-pop. */
  const popAtRef = useRef<number | null>(null);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Rendered feed size and the canvas derived from it, shown live on screen so a
   * device test can be settled with a screenshot instead of guesswork. Feed dims
   * track the <video> element and update on FLIP; canvas dims are fixed per run.
   */
  const [feedDims, setFeedDims] = useState<{ w: number; h: number } | null>(null);
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null);
  /** Secondary diagnostic only — never used for sizing. */
  const [trackDims, setTrackDims] = useState<string>("—");
  /** Safe-zone guide, viewfinder only. Off by default. */
  const [guides, setGuides] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(true);

  /**
   * Overlay geometry in percentages of the canvas box, from the same
   * computeLayout the renderer uses — so a tap target can never drift off the
   * tile it is sitting on, whatever aspect the camera gave us.
   */
  const overlay = useMemo(() => {
    const W = canvasDims?.w ?? FALLBACK_W;
    const H = canvasDims?.h ?? FALLBACK_H;
    const L = computeLayout(W, H);
    return {
      tiles: Array.from({ length: SLOT_COUNT }, (_, i) => ({
        leftPct: (L.railX / W) * 100,
        topPct: (tileTop(L, i) / H) * 100,
        heightPct: (L.tileH / H) * 100,
      })),
      tapWidthPct: 42,
      safe: {
        leftPct: SAFE.leftFrac * 100,
        topPct: SAFE.topFrac * 100,
        rightPct: (1 - SAFE.rightFrac) * 100,
        bottomPct: (1 - SAFE.bottomFrac) * 100,
      },
    };
  }, [canvasDims]);

  const writeGame = useCallback((next: GameState) => {
    gameRef.current = next; // ref first, so the very next frame draws it
    setGame(next);
  }, []);

  /* ── card preload. Same-origin, so the canvas stays exportable. ── */
  useEffect(() => {
    let cancelled = false;
    let loaded = 0;
    const done = () => {
      loaded += 1;
      if (!cancelled && loaded >= ALL_DRINKS.length) setCardsReady(true);
    };
    ALL_DRINKS.forEach((key) => {
      const img = new window.Image();
      img.onload = done;
      img.onerror = done; // never block the run on one bad file
      img.src = CARDS[key].src;
      imagesRef.current[key] = img;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Keep the readout honest across a FLIP: the <video> fires resize whenever the
   * rendered frame size changes, which is exactly what we size and crop from.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      if (video.videoWidth) setFeedDims({ w: video.videoWidth, h: video.videoHeight });
      const s = videoStreamRef.current?.getVideoTracks()[0]?.getSettings?.();
      setTrackDims(s?.width && s?.height ? `${s.width}×${s.height}` : "—");
    };
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("resize", sync);
    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("resize", sync);
    };
  }, []);

  /* ── portrait lock ── */
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  /* ── the compositor: camera + overlays onto one canvas ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    rafRef.current = requestAnimationFrame(draw);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = "#07070A";
    ctx.fillRect(0, 0, W, H);

    // Fit the feed to whatever the canvas already is — which, for a portrait
    // feed, means the whole frame with no crop. Recomputed per frame because a
    // FLIP can hand back a different resolution mid-run, and the canvas must not
    // be resized once the recorder is attached.
    if (video && video.readyState >= 2 && video.videoWidth) {
      const { sx, sy, sw, sh } = centreCropTo(video.videoWidth, video.videoHeight, W / H);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
    }

    const { slots, phase } = gameRef.current;
    const L = computeLayout(W, H);

    // Current card, top-centre — the reel while spinning, the landed pick after.
    if (phase !== "board") {
      const key = showingRef.current;
      const img = key ? imagesRef.current[key] : undefined;
      if (img?.complete && img.naturalWidth) {
        const base = L.cardW;

        // Scale-pop on landing. Grows from the card's centre so the top edge
        // never rises above the safe line mid-animation.
        let scale = 1;
        if (popAtRef.current != null) {
          const t = (performance.now() - popAtRef.current) / POP_MS;
          if (t >= 1) popAtRef.current = null;
          else scale = 0.82 + 0.18 * (1 - Math.pow(1 - Math.max(t, 0), 3));
        }

        const cw = base * scale;
        const cx = (W - cw) / 2;
        const cy = L.cardY + (base - cw) / 2;
        ctx.save();
        roundRectPath(ctx, cx, cy, cw, cw, cw * 0.06);
        ctx.clip();
        drawCover(ctx, img, img.naturalWidth, img.naturalHeight, cx, cy, cw, cw);
        ctx.restore();
      }

      // Prompt is game content, so it belongs on the canvas (unlike the REC
      // badge, which is DOM and must stay out of the export).
      if (phase === "spinning") {
        ctx.save();
        ctx.fillStyle = GOLD;
        ctx.font = `700 ${Math.round(W * 0.038)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        type Spaced = CanvasRenderingContext2D & { letterSpacing?: string };
        const spaced = ctx as Spaced;
        if ("letterSpacing" in spaced) spaced.letterSpacing = `${Math.round(W * 0.008)}px`;
        ctx.fillText("TAP TO STOP", W / 2, L.promptY);
        if ("letterSpacing" in spaced) spaced.letterSpacing = "0px";
        ctx.restore();
      }
    } else {
      // Final board: a gold label where the card was.
      ctx.save();
      ctx.fillStyle = GOLD;
      ctx.font = `700 ${Math.round(W * 0.058)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FINAL BOARD", W / 2, L.cardY + L.cardW * 0.5);
      ctx.restore();
    }

    // Slot rail — height comes from computeLayout, which fits seven tiles
    // between the card and the safe zone's 73% line.
    const rx = L.railX;
    const rw = L.railW;
    const th = L.tileH;
    const radius = th * 0.28;

    for (let i = 0; i < SLOT_COUNT; i++) {
      const ty = tileTop(L, i);
      const filled = slots[i];
      const winner = phase === "board" && i === 0;

      ctx.save();
      roundRectPath(ctx, rx, ty, rw, th, radius);
      ctx.fillStyle = filled ? "rgba(7,7,10,0.72)" : "rgba(7,7,10,0.45)";
      ctx.fill();
      ctx.lineWidth = winner ? Math.max(th * 0.08, 3) : Math.max(th * 0.04, 2);
      ctx.strokeStyle = winner ? GOLD : filled ? GOLD : "rgba(255,199,44,0.5)";
      if (!filled) ctx.setLineDash([th * 0.22, th * 0.18]);
      ctx.stroke();
      ctx.restore();

      // Rank number.
      ctx.save();
      ctx.fillStyle = GOLD;
      ctx.font = `700 ${Math.round(th * 0.42)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), rx + rw * 0.19, ty + th / 2);
      ctx.restore();

      // Locked: mini card thumb.
      if (filled) {
        const img = imagesRef.current[filled];
        if (img?.complete && img.naturalWidth) {
          const pad = th * 0.13;
          const size = th - pad * 2;
          const tx = rx + rw * 0.36;
          ctx.save();
          roundRectPath(ctx, tx, ty + pad, size, size, size * 0.18);
          ctx.clip();
          drawCover(ctx, img, img.naturalWidth, img.naturalHeight, tx, ty + pad, size, size);
          ctx.restore();
        }
      }
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  /* ── recording ── */
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      // Never fail silently — a stranded live screen with no recording is the
      // worst outcome, since the athlete only finds out afterwards.
      setErrorNote("Couldn’t start the recorder. Reload and try again.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setErrorNote("This browser can’t record video. Try Safari on iPhone or Chrome on Android.");
      return;
    }

    const mime = pickMimeType();
    setVideoExt(extensionFor(mime || "video/webm"));

    const stream = canvas.captureStream(30);
    const audioTrack = audioStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);

    chunksRef.current = [];
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      setErrorNote("This browser can’t record video. Try Safari on iPhone or Chrome on Android.");
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;

      // An empty recording is a real possibility, not a theoretical one: the
      // canvas only emits frames while it is being painted, and browsers pause
      // rAF whenever the page is hidden. Background the app mid-take (a call, an
      // app switch) and the encoder gets nothing. Say so plainly instead of
      // handing over a broken player and a 0-byte download.
      if (blob.size === 0) {
        setVideoUrl(null);
        setErrorNote(
          "That take came out empty — the recording stops if you leave the page or lock the phone. Keep this screen open and give it another go.",
        );
        setStage("review");
        return;
      }

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setVideoUrl(url);
      setStage("review");
    };

    recorderRef.current = recorder;
    recorder.start();

    setElapsed(0);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  }, []);

  /* ── the randomizer reel ── */

  const clearSpin = useCallback(() => {
    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }
  }, []);

  /** Cycle the unplaced drinks until tapped. Cosmetic only — see stopSpin. */
  const beginSpin = useCallback(() => {
    clearSpin();
    const g = gameRef.current;
    const remaining = g.order.slice(g.index);
    if (!remaining.length) return;

    popAtRef.current = null;
    showingRef.current = remaining[0];
    writeGame({ ...g, phase: "spinning" });

    let i = 1;
    const tick = () => {
      const rem = gameRef.current.order.slice(gameRef.current.index);
      if (!rem.length) return;
      showingRef.current = rem[i % rem.length]; // ref only — no re-render per tick
      i += 1;
      spinTimerRef.current = setTimeout(tick, SPIN_MS);
    };
    spinTimerRef.current = setTimeout(tick, SPIN_MS);
  }, [clearSpin, writeGame]);

  /**
   * Tap to stop: slow over ~600ms, then land.
   *
   * The landing card is order[index] — fixed by the shuffle before the reel ever
   * started, so it cannot be timed by tapping on a particular frame. What flickers
   * past on the way down is decoration drawn from the remaining drinks.
   */
  const stopSpin = useCallback(() => {
    const g = gameRef.current;
    if (g.phase !== "spinning") return;
    clearSpin();

    const landing = g.order[g.index];
    const remaining = g.order.slice(g.index);
    let step = 0;

    const run = () => {
      if (step < DECEL_MS.length) {
        showingRef.current = remaining[Math.floor(Math.random() * remaining.length)];
        const wait = DECEL_MS[step];
        step += 1;
        spinTimerRef.current = setTimeout(run, wait);
        return;
      }
      spinTimerRef.current = null;
      showingRef.current = landing;
      popAtRef.current = performance.now();
      writeGame({ ...gameRef.current, phase: "placing" });
    };
    run();
  }, [clearSpin, writeGame]);

  /** New shuffle, empty board, recorder rolling, first reel spinning. */
  const startRun = useCallback(async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Size the canvas from the real feed before the recorder attaches — a
    // resolution change mid-recording is not something encoders take kindly to,
    // so this is the one chance to get it right.
    if (canvas) {
      // Wait for loadedmetadata, then read the RENDERED dimensions. Never
      // track.getSettings(): iOS Safari routinely reports the sensor's landscape
      // dims there while handing the <video> a portrait frame, and sizing off
      // that mismatch is how you end up cropping a frame that needed no crop.
      if (video) await whenVideoSized(video);
      const nw = video?.videoWidth ?? 0;
      const nh = video?.videoHeight ?? 0;
      const { w, h } = deriveCanvasSize(nw, nh);
      canvas.width = w;
      canvas.height = h;
      setCanvasDims({ w, h });
      setFeedDims(nw && nh ? { w: nw, h: nh } : null);
    }

    writeGame({ ...emptyGame(), order: shuffle(ALL_DRINKS) });
    startLoop();
    startRecording();
    beginSpin();
  }, [writeGame, startLoop, startRecording, beginSpin]);

  /* ── camera ── */
  const attachVideo = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    // iOS Safari will not play an inline camera preview without both of these.
    video.muted = true;
    video.playsInline = true;
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  }, []);

  const allowCamera = useCallback(async () => {
    setStarting(true);
    setErrorNote(null);
    try {
      // One prompt for camera + mic. The audio track outlives camera flips.
      //
      // facingMode ONLY — deliberately no width/height. iOS treats size and
      // aspect constraints as licence to crop the sensor to satisfy them, which
      // arrives looking like zoom. Take whatever native frame the camera offers
      // and do every bit of fitting ourselves, on the canvas.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      audioStreamRef.current = stream;
      videoStreamRef.current = stream;
      setFacing("user");
      pendingRunRef.current = true; // the effect below starts the run once mounted
      setStage("live");
    } catch {
      setStage("denied");
    } finally {
      setStarting(false);
    }
  }, []);

  /**
   * Starts the run only once the live stage has actually committed, so the
   * canvas and video refs are guaranteed to exist.
   */
  useEffect(() => {
    if (stage !== "live" || !pendingRunRef.current) return;
    pendingRunRef.current = false;
    const stream = videoStreamRef.current;
    if (stream) attachVideo(stream);
    void startRun();
  }, [stage, attachVideo, startRun]);

  const flipCamera = useCallback(async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // facingMode only, for the same reason as the initial request.
        video: { facingMode: next },
        audio: false,
      });
      // Release only the old camera; the mic track belongs to audioStreamRef.
      videoStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
      videoStreamRef.current = stream;
      setFacing(next);
      attachVideo(stream);
    } catch {
      setErrorNote("Couldn’t switch cameras.");
    }
  }, [facing, attachVideo]);

  /* ── placing a drink ── */
  const place = useCallback(
    (slot: number) => {
      const g = gameRef.current;
      if (g.phase !== "placing") return; // rail is inert until the reel lands
      if (g.slots[slot] !== null) return; // locked is locked
      const key = g.order[g.index];
      if (!key) return;

      const slots = [...g.slots];
      slots[slot] = key;

      if (g.index + 1 >= SLOT_COUNT) {
        popAtRef.current = null;
        showingRef.current = null;
        writeGame({ ...g, slots, phase: "board" });
        // Let the finished board sit on camera before cutting.
        stopTimerRef.current = setTimeout(() => stopRecording(), 3000);
      } else {
        writeGame({ ...g, slots, index: g.index + 1 });
        // Next round spins immediately — including the final one-card round,
        // which still gets a short reel so the rhythm never breaks.
        beginSpin();
      }
    },
    [writeGame, stopRecording, beginSpin],
  );

  /* ── teardown ── */
  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = null;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    videoStreamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      teardown();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [teardown],
  );

  /** Same camera, fresh shuffle, fresh recording. */
  const filmAgain = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setVideoUrl(null);
    setErrorNote(null);
    pendingRunRef.current = true; // same post-commit start path as the first run
    setStage("live");
  }, []);

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60,
  ).padStart(2, "0")}`;

  // Only name the drink once the reel has landed — while spinning there is no
  // "current" pick to announce.
  const currentName =
    game.phase === "placing" && game.order[game.index]
      ? CARDS[game.order[game.index]].name
      : "the drink on screen";

  return (
    <main
      className={`${arimo.variable} mcdq-app flex min-h-[100dvh] flex-col bg-[#07070A] text-[#FAF8F5] antialiased`}
      style={{
        fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif",
        // viewport-fit=cover lets the page paint under the notch and home
        // indicator; these keep actual content clear of both.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* The camera feed. Hidden — the canvas is what anyone sees or records. */}
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />

      {stage !== "live" && (
        <header className="flex w-full shrink-0 justify-center px-5 pb-2 pt-5">
          <Image
            src={ARCHES_LOGO}
            alt="McDonald's"
            width={3840}
            height={2160}
            sizes="64px"
            priority
            className="h-[34px] w-auto"
          />
        </header>
      )}

      {stage === "intro" && (
        <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8 sm:max-w-lg">
          <p className={EYEBROW} style={{ color: GOLD }}>
            Blind ranking — on camera
          </p>
          <h1 className={`${DISPLAY} mt-4 text-[40px] sm:text-[50px]`}>
            Film yourself ranking all 7.
          </h1>
          <p className="mt-5 text-[16px] leading-[1.55] text-[#FAF8F5]/60">
            Your camera records while you play. Drinks come one at a time in a
            random order — tap a slot to lock each one in, and there are no
            takebacks. When the board is full you&rsquo;ll get the video to
            download. Nothing is uploaded; it never leaves your phone.
          </p>
          <button
            type="button"
            onClick={allowCamera}
            disabled={starting || !cardsReady}
            className={`${CTA} mt-9 self-start`}
            style={{ backgroundColor: GOLD, color: GOLD_INK }}
          >
            {starting ? "Starting…" : cardsReady ? "Allow camera to start" : "Loading cards…"}
          </button>
          {errorNote && (
            <p className="mt-4 text-[14px] text-[#FAF8F5]/60">{errorNote}</p>
          )}

          {showInstallHint && (
            <div className="mt-8 flex items-start gap-3 rounded-xl border border-[#FAF8F5]/10 px-4 py-3">
              <p className="flex-1 text-[13px] leading-[1.5] text-[#FAF8F5]/55">
                Best experience: Share → Add to Home Screen, then open from
                there.
              </p>
              <button
                type="button"
                onClick={() => setShowInstallHint(false)}
                aria-label="Dismiss"
                className="-mr-2 -mt-2 flex items-center justify-center px-2 font-mono text-[14px] text-[#FAF8F5]/40"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                ×
              </button>
            </div>
          )}
        </section>
      )}

      {stage === "denied" && (
        <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8 sm:max-w-lg">
          <p className={EYEBROW} style={{ color: GOLD }}>
            Camera blocked
          </p>
          <h1 className={`${DISPLAY} mt-4 text-[36px] sm:text-[44px]`}>
            We need the camera to film this one.
          </h1>
          <p className="mt-5 text-[16px] leading-[1.55] text-[#FAF8F5]/60">
            Allow camera and microphone access for this page, then try again. On
            iPhone that&rsquo;s the <span className="text-[#FAF8F5]/85">aA</span>{" "}
            menu in Safari&rsquo;s address bar → Website Settings; on Android
            it&rsquo;s the padlock next to the address.
          </p>
          <button
            type="button"
            onClick={allowCamera}
            className={`${CTA} mt-9 self-start`}
            style={{ backgroundColor: GOLD, color: GOLD_INK }}
          >
            Try again
          </button>
        </section>
      )}

      {stage === "live" && (
        <section className="flex flex-1 items-center justify-center">
          <div
            className="mcdq-stage relative"
            style={{
              width: canvasDims
                ? `min(100vw, calc(100dvh * ${canvasDims.w} / ${canvasDims.h}))`
                : "min(100vw, calc(100dvh * 9 / 16))",
              aspectRatio: canvasDims ? `${canvasDims.w} / ${canvasDims.h}` : "9 / 16",
            }}
          >
            {/* width/height are placeholders — startRun resizes the canvas to the
                real feed's largest 9:16 crop before the recorder attaches. */}
            <canvas
              ref={canvasRef}
              width={FALLBACK_W}
              height={FALLBACK_H}
              className="block h-full w-full"
            />

            {/* Tap anywhere on the camera to stop the reel. Sits *under* the rail
                targets, which stay mounted-but-disabled while spinning — a
                disabled button swallows the tap rather than letting it bubble
                here, which is what keeps the rail genuinely inert. */}
            {game.phase === "spinning" && (
              <button
                type="button"
                onClick={stopSpin}
                aria-label="Stop the randomizer"
                className="absolute inset-0 z-10"
                style={{ background: "transparent" }}
              />
            )}

            {/* Tap targets over the rail. HTML, not canvas — the canvas has no
                hit testing of its own. Percentages come from the same geometry
                the drawing uses, so they always line up. */}
            {Array.from({ length: SLOT_COUNT }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => place(i)}
                disabled={game.phase !== "placing" || game.slots[i] !== null}
                aria-label={
                  game.slots[i]
                    ? `Slot ${i + 1}, locked: ${CARDS[game.slots[i] as DrinkKey].name}`
                    : `Put ${currentName} in slot ${i + 1}`
                }
                className="absolute z-20"
                style={{
                  left: `${overlay.tiles[i].leftPct}%`,
                  top: `${overlay.tiles[i].topPct}%`,
                  // Vertical bounds match the drawn tile exactly — no minHeight,
                  // because seven tiles inside the safe zone are shorter than
                  // 48px and padded targets would overlap each other, sending
                  // taps to the wrong slot. Width is stretched well past the
                  // drawn tile instead: it costs nothing (the hit area is DOM,
                  // never exported) and gives the thumb somewhere to land.
                  width: `${overlay.tapWidthPct}%`,
                  height: `${overlay.tiles[i].heightPct}%`,
                  background: "transparent",
                }}
              />
            ))}

            {/* Safe-zone guide — viewfinder only, never drawn to the canvas, so
                it cannot reach the export. Helps keep a face out of the bands
                Reels and TikTok cover with their own UI. */}
            {guides && (
              <div
                className="pointer-events-none absolute z-20"
                style={{
                  left: `${overlay.safe.leftPct}%`,
                  top: `${overlay.safe.topPct}%`,
                  right: `${overlay.safe.rightPct}%`,
                  bottom: `${overlay.safe.bottomPct}%`,
                  border: `1px dashed ${GOLD}`,
                  borderRadius: 6,
                }}
              >
                <span
                  className="absolute right-1 top-1 font-mono text-[8px] uppercase tracking-[0.12em]"
                  style={{ color: GOLD }}
                >
                  safe
                </span>
                <span
                  className="absolute -bottom-4 left-0 font-mono text-[8px] uppercase tracking-[0.12em]"
                  style={{ color: GOLD }}
                >
                  caption zone ↓
                </span>
                <span
                  className="absolute -right-1 top-1/2 origin-bottom-right rotate-90 font-mono text-[8px] uppercase tracking-[0.12em]"
                  style={{ color: GOLD }}
                >
                  icons →
                </span>
              </div>
            )}

            {/* REC badge and timer are DOM overlays — deliberately NOT drawn to
                the canvas, so they never appear in the exported video. */}
            <div className="pointer-events-none absolute right-3 top-3 z-30 flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5">
                <span className="mcdq-rec h-2.5 w-2.5 rounded-full bg-[#DA291C]" />
                <span className="font-mono text-[11px] font-bold tracking-[0.16em] text-[#FAF8F5]">
                  REC {mmss}
                </span>
              </div>
              {/* Framing readout. DOM overlay, so it never reaches the export —
                  screenshot this if the framing still looks wrong on device. */}
              <span className="rounded-full bg-black/55 px-2.5 py-1 font-mono text-[9px] tracking-[0.08em] text-[#FAF8F5]/70">
                feed {feedDims ? `${feedDims.w}×${feedDims.h}` : "…"} → canvas{" "}
                {canvasDims ? `${canvasDims.w}×${canvasDims.h}` : "…"}
              </span>
            </div>

            {errorNote && (
              <div className="absolute inset-x-3 bottom-3 z-30 rounded-xl bg-black/75 px-4 py-3 text-center text-[13px] text-[#FAF8F5]">
                {errorNote}
              </div>
            )}

            <button
              type="button"
              onClick={() => setGuides((g) => !g)}
              aria-pressed={guides}
              aria-label="Toggle safe-zone guides"
              className="absolute left-3 top-[68px] z-30 flex items-center justify-center rounded-full bg-black/55 px-3 font-mono text-[10px] font-bold tracking-[0.1em]"
              style={{ minHeight: 48, color: guides ? GOLD : "#FAF8F5" }}
            >
              GUIDES
            </button>

            <button
              type="button"
              onClick={flipCamera}
              aria-label="Switch camera"
              className="absolute left-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 font-mono text-[10px] font-bold text-[#FAF8F5]"
              style={{ minHeight: 48, minWidth: 48 }}
            >
              FLIP
            </button>
          </div>
        </section>
      )}

      {stage === "review" && (
        <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8 sm:max-w-lg">
          <p className={EYEBROW} style={{ color: GOLD }}>
            Your take
          </p>
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              playsInline
              className="mt-4 w-full rounded-2xl"
              style={{ aspectRatio: "9 / 16", background: "#000" }}
            />
          ) : errorNote ? (
            <p className={`${GLASS} mt-4 px-5 py-4 text-[15px] leading-[1.5] text-[#FAF8F5]/75`}>
              {errorNote}
            </p>
          ) : (
            <p className="mt-4 text-[15px] text-[#FAF8F5]/60">Wrapping up the recording…</p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {videoUrl && (
              <a
                href={videoUrl}
                download={`blind-rank-${Date.now()}.${videoExt}`}
                className={`${CTA} flex items-center justify-center`}
                style={{ backgroundColor: GOLD, color: GOLD_INK }}
              >
                Download video
              </a>
            )}
            <button
              type="button"
              onClick={filmAgain}
              className={`${CTA} border border-[#FAF8F5]/20`}
            >
              Film again
            </button>
          </div>

          {videoUrl && (
            <div className={`${GLASS} mt-6 px-5 py-4 text-center`}>
              <p className="text-[14px] leading-[1.5] text-[#FAF8F5]/[0.68]">
                Saved as .{videoExt} — nothing was uploaded. Order using the{" "}
                <span style={{ color: GOLD }}>McDonald&rsquo;s App</span> or
                in-store digital kiosk.
              </p>
            </div>
          )}

          {/* Device QA readout: what the camera actually handed us versus the
              canvas we derived from it. Tells us what iPhones deliver without
              needing devtools on the phone. */}
          {(feedDims || canvasDims) && (
            <p className="mt-4 text-center font-mono text-[10px] tracking-[0.1em] text-[#FAF8F5]/30">
              feed {feedDims ? `${feedDims.w}×${feedDims.h}` : "—"} → canvas{" "}
              {canvasDims ? `${canvasDims.w}×${canvasDims.h}` : "—"} · track {trackDims}
            </p>
          )}
        </section>
      )}

      {stage !== "live" && (
        <footer className="flex w-full shrink-0 flex-col items-center gap-1 px-5 pb-5 pt-4 opacity-55">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.3em]">
            Powered by
          </span>
          <Image
            src={POSTGAME_WORDMARK}
            alt="Postgame"
            width={8790}
            height={1799}
            sizes="96px"
            className="h-[12px] w-auto"
          />
        </footer>
      )}

      {/* Portrait lock. The canvas is 9:16 and the rail needs the height. */}
      {landscape && stage === "live" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#07070A] px-8 text-center">
          <p className={EYEBROW} style={{ color: GOLD }}>
            Rotate your phone
          </p>
          <p className="text-[16px] text-[#FAF8F5]/70">
            Blind Rank films in portrait. Turn your phone upright to keep going —
            the recording is still running.
          </p>
        </div>
      )}

      <style>{`
        @keyframes mcdq-rec { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        .mcdq-rec { animation: mcdq-rec 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .mcdq-rec { animation: none; } }

        /* App feel. Scoped by living in this component's own <style>: it mounts
           and unmounts with the page, so the rest of the Hub keeps normal
           scrolling and selection behaviour. */
        html, body {
          overscroll-behavior: none;   /* no rubber-band or pull-to-refresh mid-take */
          background: #07070A;         /* matches theme-color so Safari's chrome blends */
        }
        .mcdq-app {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none; /* no long-press callout on the viewfinder */
          -webkit-tap-highlight-color: transparent;
          overscroll-behavior: none;
          touch-action: manipulation;  /* kills double-tap zoom, keeps taps instant */
        }
        /* Nothing on the live screen should pan or zoom — it is a viewfinder. */
        .mcdq-stage { touch-action: none; }
      `}</style>
    </main>
  );
}
