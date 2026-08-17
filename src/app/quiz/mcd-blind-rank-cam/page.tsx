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

import { useCallback, useEffect, useRef, useState } from "react";
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

const CANVAS_W = 1080;
const CANVAS_H = 1920;

/** Card sits top-centre at 55% of canvas width; the art is square. */
const CARD = { wFrac: 0.55, topFrac: 0.045 };
/** Slot rail down the left. Seven tiles, ending clear of the bottom edge. */
const RAIL = { xFrac: 0.045, wFrac: 0.2, topFrac: 0.38, tileHFrac: 0.074, gapFrac: 0.01 };

const tileTopFrac = (i: number) => RAIL.topFrac + i * (RAIL.tileHFrac + RAIL.gapFrac);

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

/* ───────────────────────────── page ───────────────────────────── */

type Stage = "intro" | "denied" | "live" | "review";
type Phase = "playing" | "board";
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
  phase: "playing",
});

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

    const W = CANVAS_W;
    const H = CANVAS_H;

    ctx.fillStyle = "#07070A";
    ctx.fillRect(0, 0, W, H);

    if (video && video.readyState >= 2) {
      drawCover(ctx, video, video.videoWidth, video.videoHeight, 0, 0, W, H);
    }

    const { order, index, slots, phase } = gameRef.current;

    // Current card, top-centre.
    if (phase === "playing") {
      const key = order[index];
      const img = key ? imagesRef.current[key] : undefined;
      if (img?.complete && img.naturalWidth) {
        const cw = CARD.wFrac * W;
        const cx = (W - cw) / 2;
        const cy = CARD.topFrac * H;
        ctx.save();
        roundRectPath(ctx, cx, cy, cw, cw, cw * 0.06);
        ctx.clip();
        drawCover(ctx, img, img.naturalWidth, img.naturalHeight, cx, cy, cw, cw);
        ctx.restore();
      }
    } else {
      // Final board: a gold label where the card was.
      ctx.save();
      ctx.fillStyle = GOLD;
      ctx.font = "700 62px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FINAL BOARD", W / 2, CARD.topFrac * H + CARD.wFrac * W * 0.5);
      ctx.restore();
    }

    // Slot rail.
    const rx = RAIL.xFrac * W;
    const rw = RAIL.wFrac * W;
    const th = RAIL.tileHFrac * H;
    const radius = th * 0.28;

    for (let i = 0; i < SLOT_COUNT; i++) {
      const ty = tileTopFrac(i) * H;
      const filled = slots[i];
      const winner = phase === "board" && i === 0;

      ctx.save();
      roundRectPath(ctx, rx, ty, rw, th, radius);
      ctx.fillStyle = filled ? "rgba(7,7,10,0.72)" : "rgba(7,7,10,0.45)";
      ctx.fill();
      ctx.lineWidth = winner ? 7 : 3;
      ctx.strokeStyle = winner ? GOLD : filled ? GOLD : "rgba(255,199,44,0.5)";
      if (!filled) ctx.setLineDash([14, 12]);
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

  /** New shuffle, empty board, recorder rolling — the first drink is on screen. */
  const startRun = useCallback(() => {
    writeGame({ ...emptyGame(), order: shuffle(ALL_DRINKS) });
    startLoop();
    startRecording();
  }, [writeGame, startLoop, startRecording]);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
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
    startRun();
  }, [stage, attachVideo, startRun]);

  const flipCamera = useCallback(async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next, width: { ideal: 1080 }, height: { ideal: 1920 } },
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
      if (g.phase !== "playing") return;
      if (g.slots[slot] !== null) return; // locked is locked
      const key = g.order[g.index];
      if (!key) return;

      const slots = [...g.slots];
      slots[slot] = key;

      if (g.index + 1 >= SLOT_COUNT) {
        writeGame({ ...g, slots, phase: "board" });
        // Let the finished board sit on camera before cutting.
        stopTimerRef.current = setTimeout(() => stopRecording(), 3000);
      } else {
        writeGame({ ...g, slots, index: g.index + 1 });
      }
    },
    [writeGame, stopRecording],
  );

  /* ── teardown ── */
  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
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

  const currentName = game.order[game.index] ? CARDS[game.order[game.index]].name : "";

  return (
    <main
      className={`${arimo.variable} flex min-h-[100dvh] flex-col bg-[#07070A] text-[#FAF8F5] antialiased`}
      style={{ fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif" }}
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
            className="relative"
            style={{ width: "min(100vw, calc(100dvh * 9 / 16))", aspectRatio: "9 / 16" }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="block h-full w-full"
            />

            {/* Tap targets over the rail. HTML, not canvas — the canvas has no
                hit testing of its own. Percentages come from the same geometry
                the drawing uses, so they always line up. */}
            {Array.from({ length: SLOT_COUNT }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => place(i)}
                disabled={game.phase !== "playing" || game.slots[i] !== null}
                aria-label={
                  game.slots[i]
                    ? `Slot ${i + 1}, locked: ${CARDS[game.slots[i] as DrinkKey].name}`
                    : `Put ${currentName} in slot ${i + 1}`
                }
                className="absolute"
                style={{
                  left: `${RAIL.xFrac * 100}%`,
                  top: `${tileTopFrac(i) * 100}%`,
                  width: `${RAIL.wFrac * 100}%`,
                  height: `${RAIL.tileHFrac * 100}%`,
                  minHeight: 48,
                  minWidth: 48,
                  background: "transparent",
                }}
              />
            ))}

            {/* REC badge and timer are DOM overlays — deliberately NOT drawn to
                the canvas, so they never appear in the exported video. */}
            <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5">
              <span className="mcdq-rec h-2.5 w-2.5 rounded-full bg-[#DA291C]" />
              <span className="font-mono text-[11px] font-bold tracking-[0.16em] text-[#FAF8F5]">
                REC {mmss}
              </span>
            </div>

            {errorNote && (
              <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-4 py-3 text-center text-[13px] text-[#FAF8F5]">
                {errorNote}
              </div>
            )}

            <button
              type="button"
              onClick={flipCamera}
              aria-label="Switch camera"
              className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 font-mono text-[10px] font-bold text-[#FAF8F5]"
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
      `}</style>
    </main>
  );
}
