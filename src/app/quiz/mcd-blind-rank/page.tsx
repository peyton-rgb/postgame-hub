"use client";

/**
 * McDonald's × Postgame blind ranking — /quiz/mcd-blind-rank
 *
 * Sister page to /quiz/mcd-drinks and built the same way: self-contained (no
 * Supabase, no auth, no shared components, no animation libraries), same
 * branding system — dark ground, gold Arches leading in the header, Postgame
 * wordmark signing the footer, Arches Gold on every accent, McDonald's Red used
 * exactly once. Photos are the shared assets under /quiz/mcd-drinks/ — this page
 * points at them, it does not copy them.
 *
 * The format is the point: drinks arrive one at a time in a fresh random order,
 * and a slot is final the moment it is tapped. No undo, no back button.
 *
 * /quiz is excluded from SiteNav's HIDDEN_ROUTES and PageWrapper's Postgame
 * loader (see feat/mcd-drink-quiz), so no Postgame chrome renders above this.
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Arimo } from "next/font/google";

// Bebas Neue (--font-bebas) and JetBrains Mono (--font-mono) come from the root
// layout. Arimo does not, so it loads here — scoped to this page rather than
// added to a layout that feeds every other surface.
const arimo = Arimo({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-arimo",
  display: "swap",
});

/* ─────────────────────────── brand tokens ─────────────────────────── */

const GOLD = "#FFC72C"; // Arches Gold — every accent
const RED = "#DA291C"; // McDonald's Red — the winning slot's glow, nothing else
const GOLD_INK = "#27251F"; // type on gold

const ARCHES_LOGO =
  "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/brand-kits/9ecac2a1-1449-4daf-bc62-78fe4feb9091/primary-logo.png";
const POSTGAME_WORDMARK =
  "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/brand-kits/1774632094358-hv0c0rmo.png";

/* ────────────────────────────── data ────────────────────────────── */

type DrinkKey =
  | "orangeDream"
  | "strawberryWatermelon"
  | "spriteBerryBlast"
  | "dirtyDrPepper"
  | "blackberryPassionFruit"
  | "dragonberry"
  | "mangoPineapple";

type Drink = {
  name: string;
  src: string;
  /** Intrinsic pixel size, so next/image can reserve the right aspect box. */
  width: number;
  height: number;
};

/** Shared with /quiz/mcd-drinks — same files, referenced not duplicated. */
const DRINKS: Record<DrinkKey, Drink> = {
  orangeDream: {
    name: "Orange Dream",
    src: "/quiz/mcd-drinks/drink_orange-dream-hi-c.png",
    width: 552,
    height: 982,
  },
  strawberryWatermelon: {
    name: "Strawberry Watermelon",
    src: "/quiz/mcd-drinks/drink_strawberry-watermelon.png",
    width: 342,
    height: 633,
  },
  spriteBerryBlast: {
    name: "Sprite Berry Blast",
    src: "/quiz/mcd-drinks/drink_sprite-berry-blast.png",
    width: 559,
    height: 985,
  },
  dirtyDrPepper: {
    name: "Dirty Dr. Pepper",
    src: "/quiz/mcd-drinks/drink_dirty-dr-pepper.png",
    width: 427,
    height: 754,
  },
  blackberryPassionFruit: {
    name: "Blackberry Passion Fruit",
    src: "/quiz/mcd-drinks/drink_blackberry-passion-fruit.png",
    width: 558,
    height: 1016,
  },
  dragonberry: {
    // Short form, as on the drink quiz's cards — slot rows are tight.
    name: "Dragonberry",
    src: "/quiz/mcd-drinks/drink_redbull-dragonberry-energizer.png",
    width: 303,
    height: 621,
  },
  mangoPineapple: {
    name: "Mango Pineapple",
    src: "/quiz/mcd-drinks/drink_mango-pineapple-popping-tropic.png",
    width: 555,
    height: 1011,
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

const SLOT_COUNT = ALL_DRINKS.length; // 7 drinks, 7 slots

/**
 * Fisher–Yates. Deliberately not `sort(() => Math.random() - 0.5)`, which is
 * neither uniform nor stable across engines.
 *
 * Only ever called from an event handler, never during render — this page is
 * statically prerendered, and randomness at render time would hydrate mismatched.
 */
function shuffle(keys: DrinkKey[]): DrinkKey[] {
  const out = [...keys];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ───────────────────────── shared styles ───────────────────────── */

/** Mono eyebrow: uppercase, letterspaced. Gold unless told otherwise. */
const EYEBROW = "font-mono text-[11px] font-bold uppercase tracking-[0.22em]";
/** Bebas display: uppercase, tight. */
const DISPLAY = "font-display uppercase leading-[0.95]";
/** Glass surface — locked slots and the callout. */
const GLASS = "rounded-2xl border border-[#FAF8F5]/10 bg-[#FAF8F5]/[0.04]";
/** Gold CTA — matches the drink quiz's button. */
const CTA =
  "min-h-[52px] rounded-full px-9 font-mono text-[13px] font-bold uppercase tracking-[0.18em] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.98]";

/* ───────────────────────────── page ───────────────────────────── */

type Stage = "intro" | "placing" | "board";

export default function McdBlindRankPage() {
  const [stage, setStage] = useState<Stage>("intro");
  /** The run's drink order — a fresh shuffle each time, set on Start. */
  const [order, setOrder] = useState<DrinkKey[]>([]);
  const [index, setIndex] = useState(0);
  const [slots, setSlots] = useState<(DrinkKey | null)[]>(
    Array(SLOT_COUNT).fill(null),
  );
  /** Which slot was just locked, so only that thumb animates in. */
  const [justLocked, setJustLocked] = useState<number | null>(null);

  const current = order[index];

  const start = () => {
    setOrder(shuffle(ALL_DRINKS));
    setIndex(0);
    setSlots(Array(SLOT_COUNT).fill(null));
    setJustLocked(null);
    setStage("placing");
  };

  const place = (slot: number) => {
    // Locked is locked — the whole format rests on this.
    if (slots[slot] !== null || !current) return;

    const next = [...slots];
    next[slot] = current;
    setSlots(next);
    setJustLocked(slot);

    if (index + 1 >= SLOT_COUNT) setStage("board");
    else setIndex(index + 1);
  };

  // Let the lock-in animation play once, then stop flagging that slot.
  useEffect(() => {
    if (justLocked === null) return;
    const t = setTimeout(() => setJustLocked(null), 600);
    return () => clearTimeout(t);
  }, [justLocked]);

  const board = useMemo(
    () => slots.map((key) => (key ? DRINKS[key] : null)),
    [slots],
  );

  return (
    <main
      className={`${arimo.variable} flex min-h-[100dvh] flex-col bg-[#07070A] text-[#FAF8F5] antialiased`}
      style={{ fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif" }}
    >
      <style>{KEYFRAMES}</style>

      {/* McDonald's leads. The source PNG carries ~9% transparent padding, so a
          34px box lands the visible mark at ~31px — tighter than the quiz page
          because the placing screen has to fit seven slots without scrolling. */}
      <header className="flex w-full shrink-0 justify-center px-5 pb-2 pt-4">
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

      {stage === "intro" && (
        <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8 sm:max-w-lg">
          <div className="mcdq-enter">
            <p className={EYEBROW} style={{ color: GOLD }}>
              Blind ranking
            </p>
            <h1 className={`${DISPLAY} mt-4 text-[42px] sm:text-[54px]`}>
              7 drinks. One at a time. No takebacks.
            </h1>
            <p className="mt-5 text-[16px] leading-[1.55] text-[#FAF8F5]/60">
              Each drink shows up on its own, in a random order. Lock it into a
              slot from 1 to 7 — once it&rsquo;s placed, it stays there. You
              won&rsquo;t know what&rsquo;s coming next.
            </p>
            <button
              type="button"
              onClick={start}
              className={`${CTA} mt-9`}
              style={{ backgroundColor: GOLD, color: GOLD_INK }}
            >
              Start ranking
            </button>
          </div>
        </section>
      )}

      {stage === "placing" && current && (
        <section className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-3 pt-1 sm:max-w-lg">
          <p className={`${EYEBROW} shrink-0`} style={{ color: GOLD }}>
            Drink {index + 1} of {SLOT_COUNT}
          </p>

          {/* The drink on offer. Keyed by index so each new one replays the
              drop-and-settle rather than cross-fading in place. */}
          <div key={index} className="mcdq-drop shrink-0 pt-2">
            <div className="relative flex w-full items-center justify-center">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[240px] w-[240px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  // 3D / 1F / 00 are hex alpha for 24% / 12% / 0%.
                  background: `radial-gradient(circle, ${GOLD}3D 0%, ${GOLD}1F 45%, ${GOLD}00 70%)`,
                }}
              />
              <span className="mcdq-float relative z-[1] flex items-end justify-center">
                <Image
                  src={DRINKS[current].src}
                  alt={DRINKS[current].name}
                  width={DRINKS[current].width}
                  height={DRINKS[current].height}
                  sizes="240px"
                  priority
                  className="h-[clamp(104px,21dvh,185px)] w-auto max-w-full object-contain"
                />
              </span>
            </div>

            <h2 className={`${DISPLAY} mt-1.5 text-center text-[30px] sm:text-[34px]`}>
              {DRINKS[current].name}
            </h2>
            <p className="mt-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FAF8F5]/45">
              Tap a slot to lock it in
            </p>
          </div>

          {/* Seven slots share the leftover height so the board never needs
              scrolling on a phone; min-h keeps every tap target at 48px+ and
              max-h stops them ballooning on a desktop viewport. */}
          <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-1">
            {slots.map((key, i) => (
              <Slot
                key={i}
                position={i + 1}
                drink={key ? DRINKS[key] : null}
                onPlace={() => place(i)}
                animateIn={justLocked === i}
              />
            ))}
          </div>
        </section>
      )}

      {stage === "board" && (
        <section className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-1 sm:max-w-lg">
          <p className={`${EYEBROW} shrink-0`} style={{ color: GOLD }}>
            Your final board
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            {board.map((drink, i) => (
              <Slot
                key={i}
                position={i + 1}
                drink={drink}
                winner={i === 0}
                onBoard
              />
            ))}
          </div>

          <div className={`${GLASS} mcdq-fade-in mt-7 w-full px-5 py-5 text-center`}>
            <p className="text-[15px] leading-[1.5] text-[#FAF8F5]/[0.68]">
              Order using the{" "}
              <span style={{ color: GOLD }}>McDonald&rsquo;s App</span> or
              in-store digital kiosk. Download the McDonald&rsquo;s App for
              deals, rewards, and local offers.
            </p>
          </div>

          <div className="mcdq-fade-in mt-7 flex justify-center">
            {/* Straight into a fresh run — new shuffle, empty board, drink 1 of
                7 — rather than making them read the intro again. */}
            <button
              type="button"
              onClick={start}
              className={CTA}
              style={{ backgroundColor: GOLD, color: GOLD_INK }}
            >
              Run it again
            </button>
          </div>
        </section>
      )}

      {/* Postgame signs. */}
      {/* Tighter than the drink quiz's footer on purpose — the placing screen has
          to seat a hero plus seven 48px slots without scrolling. */}
      <footer className="flex w-full shrink-0 flex-col items-center gap-1 px-5 pb-4 pt-3 opacity-55">
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
    </main>
  );
}

/* ───────────────────────────── slot ───────────────────────────── */

function Slot({
  position,
  drink,
  onPlace,
  animateIn,
  winner,
  onBoard,
}: {
  position: number;
  drink: Drink | null;
  onPlace?: () => void;
  animateIn?: boolean;
  winner?: boolean;
  onBoard?: boolean;
}) {
  const shell =
    "relative flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-3 text-left";
  const shared = onBoard ? shell : `${shell} max-h-[76px] flex-1`;

  const number = (
    <span
      className="w-5 shrink-0 text-center font-mono text-[13px] font-bold leading-none"
      style={{ color: GOLD }}
    >
      {position}
    </span>
  );

  // Empty: dashed gold outline, waiting for a tap. A real button — the only
  // thing on the placing screen that is.
  if (!drink) {
    return (
      <button
        type="button"
        onClick={onPlace}
        className={`${shared} border border-dashed transition-colors duration-150 hover:bg-[#FAF8F5]/[0.04]`}
        style={{ borderColor: `${GOLD}80` }}
      >
        {number}
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FAF8F5]/40">
          Tap to place
        </span>
      </button>
    );
  }

  // Locked: not a button at all, so tapping it genuinely does nothing.
  return (
    <div
      className={`${shared} ${GLASS} ${animateIn ? "mcdq-lock" : ""}`}
      style={winner ? { borderColor: GOLD } : undefined}
    >
      {winner && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-[320px] max-w-[110vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            // The one and only use of McDonald's Red — a glow, never a surface.
            background: `radial-gradient(circle, ${RED}4D 0%, ${RED}24 42%, ${RED}00 70%)`,
          }}
        />
      )}
      {number}
      <span className="relative z-[1] flex h-[34px] w-[24px] shrink-0 items-end justify-center">
        <Image
          src={drink.src}
          alt=""
          width={drink.width}
          height={drink.height}
          sizes="48px"
          className="h-[34px] w-auto max-w-full object-contain"
        />
      </span>
      <span className={`${DISPLAY} relative z-[1] flex-1 text-[19px]`}>
        {drink.name}
      </span>
      <span className="relative z-[1] ml-auto font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#FAF8F5]/30">
        Locked
      </span>
    </div>
  );
}

/* ─────────────────────────── keyframes ───────────────────────────
   Plain CSS in the component: no animation library, and nothing here needs to
   exist outside this page. Loops are switched off under prefers-reduced-motion;
   entrances degrade to a plain fade with no transform. */

const KEYFRAMES = `
@keyframes mcdq-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes mcdq-drop  { 0% { opacity: 0; transform: translateY(-26px); } 70% { opacity: 1; transform: translateY(3px); } 100% { opacity: 1; transform: none; } }
@keyframes mcdq-float { 0%, 100% { transform: translateY(-4px); } 50% { transform: translateY(4px); } }
@keyframes mcdq-lock  { 0% { opacity: 0; transform: translateY(-14px) scale(0.94); } 100% { opacity: 1; transform: none; } }
@keyframes mcdq-fade  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.mcdq-enter { animation: mcdq-enter 320ms ease-out both; }
.mcdq-drop  { animation: mcdq-drop 420ms cubic-bezier(0.3, 1.3, 0.6, 1) both; }
.mcdq-lock  { animation: mcdq-lock 340ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.mcdq-fade-in { animation: mcdq-fade 500ms ease-out 200ms both; }

/* Starts only after the drop has settled, so the two never fight. */
.mcdq-float {
  animation: mcdq-float 3s ease-in-out infinite;
  animation-delay: 480ms;
}

@media (prefers-reduced-motion: reduce) {
  .mcdq-float { animation: none; }
  .mcdq-enter, .mcdq-drop, .mcdq-lock, .mcdq-fade-in {
    animation-duration: 200ms;
    animation-timing-function: ease;
    animation-name: mcdq-fade-plain;
  }
  @keyframes mcdq-fade-plain { from { opacity: 0; } to { opacity: 1; } }
}
`;
