"use client";

/**
 * McDonald's × Postgame drink quiz — /quiz/mcd-drinks
 *
 * Branding per the approved mockup: dark base, McDonald's leads (gold Arches in
 * the header on every screen), Postgame signs (white wordmark in the footer).
 * Arches Gold #FFC72C carries every accent; McDonald's Red #DA291C appears
 * exactly once, as the radial glow behind the winner's photo.
 *
 * Still deliberately self-contained: no Supabase, no auth, no shared
 * components, no animation libraries. Data, scoring and keyframes all live
 * here. /quiz is excluded from SiteNav's HIDDEN_ROUTES and from PageWrapper's
 * Postgame loader — the Postgame mark on this page is the footer signature.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Arimo } from "next/font/google";

// Bebas Neue (--font-bebas) and JetBrains Mono (--font-mono) already come from
// the root layout. Arimo does not, so it loads here — scoped to this page
// rather than added to a layout that feeds every other surface.
const arimo = Arimo({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-arimo",
  display: "swap",
});

/* ─────────────────────────── brand tokens ─────────────────────────── */

const GOLD = "#FFC72C"; // Arches Gold — every accent
const RED = "#DA291C"; // McDonald's Red — the winner's glow, nothing else
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
  /** Short name — cards, captions. */
  name: string;
  /** Full product name, used only in the reveal headline. */
  revealName?: string;
  src: string;
  /** Intrinsic pixel size, so next/image can reserve the right aspect box. */
  width: number;
  height: number;
};

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
    name: "Dragonberry",
    revealName: "Red Bull Dragonberry Energizer",
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

/** Stable order — the fallback used if a run somehow scores fewer than 3 drinks. */
const DRINK_ORDER: DrinkKey[] = [
  "orangeDream",
  "strawberryWatermelon",
  "spriteBerryBlast",
  "dirtyDrPepper",
  "blackberryPassionFruit",
  "dragonberry",
  "mangoPineapple",
];

type Question = { q: string; options: { label: string; drink: DrinkKey }[] };

/**
 * Two answers per question. The deck is balanced so no drink can run away with
 * it: every drink appears in 3 questions except Dirty Dr. Pepper, which appears
 * in 2 — 20 slots over 10 questions. A ceiling of 3 points means ties are
 * normal, and the cutline is settled by earliest-scored (see topThree).
 *
 * No three drinks cover all 10 questions (3 appearances each, max 9), so a run
 * always scores at least 4 distinct drinks — the padding in topThree is pure
 * defence, never load-bearing.
 */
const QUESTIONS: Question[] = [
  {
    q: "Sweet or refreshing?",
    options: [
      { label: "Sweet", drink: "orangeDream" },
      { label: "Refreshing", drink: "strawberryWatermelon" },
    ],
  },
  {
    q: "Classic or adventurous?",
    options: [
      { label: "Classic", drink: "dirtyDrPepper" },
      { label: "Adventurous", drink: "blackberryPassionFruit" },
    ],
  },
  {
    q: "Morning or night person?",
    options: [
      { label: "Morning", drink: "dragonberry" },
      { label: "Night", drink: "spriteBerryBlast" },
    ],
  },
  {
    q: "Team leader or hype man?",
    options: [
      { label: "Leader", drink: "dirtyDrPepper" },
      { label: "Hype man", drink: "dragonberry" },
    ],
  },
  {
    q: "Fruit or soda?",
    options: [
      { label: "Fruit", drink: "strawberryWatermelon" },
      { label: "Soda", drink: "spriteBerryBlast" },
    ],
  },
  {
    q: "Play it safe or try something new?",
    options: [
      { label: "Safe", drink: "orangeDream" },
      { label: "Something new", drink: "blackberryPassionFruit" },
    ],
  },
  {
    q: "Pick a vacation",
    options: [
      { label: "Beach", drink: "strawberryWatermelon" },
      { label: "Tropical island", drink: "mangoPineapple" },
    ],
  },
  {
    q: "What’s your game-day vibe?",
    options: [
      { label: "Locked in", drink: "dragonberry" },
      { label: "Chillin’", drink: "orangeDream" },
    ],
  },
  {
    q: "Sweet tooth or flavor explorer?",
    options: [
      // Sweet tooth lands on Mango Pineapple, not Orange Dream — deliberate
      // rebalance so Orange Dream and Mango Pineapple both sit at 3 slots.
      { label: "Sweet tooth", drink: "mangoPineapple" },
      { label: "Flavor explorer", drink: "blackberryPassionFruit" },
    ],
  },
  {
    q: "Post-game reward?",
    options: [
      { label: "Smoothie vibes", drink: "mangoPineapple" },
      { label: "Something fizzy", drink: "spriteBerryBlast" },
    ],
  },
];

/* ──────────────────────────── scoring ──────────────────────────── */

/**
 * Highest three scorers. A tie is broken by which drink scored its first point
 * earliest in the run, so the answer order the user actually gave decides the
 * cutline rather than object key order.
 */
function topThree(answers: DrinkKey[]): DrinkKey[] {
  const tally = new Map<DrinkKey, { score: number; firstAt: number }>();

  answers.forEach((drink, i) => {
    const row = tally.get(drink);
    if (row) row.score += 1;
    else tally.set(drink, { score: 1, firstAt: i });
  });

  const ranked = [...tally.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[1].firstAt - b[1].firstAt)
    .map(([drink]) => drink);

  // Every path through the 10 questions scores at least 3 distinct drinks, but
  // pad defensively so the ranking screen can never render short.
  for (const drink of DRINK_ORDER) {
    if (ranked.length >= 3) break;
    if (!ranked.includes(drink)) ranked.push(drink);
  }

  return ranked.slice(0, 3);
}

/* ───────────────────────── shared styles ───────────────────────── */

/** Mono eyebrow: uppercase, letterspaced. Gold unless told otherwise. */
const EYEBROW = "font-mono text-[11px] font-bold uppercase tracking-[0.22em]";
/** Bebas display: uppercase, tight. */
const DISPLAY = "font-display uppercase leading-[0.95]";
/** Glass surface — answer cards and the reveal callout. */
const GLASS =
  "rounded-2xl border border-[#FAF8F5]/10 bg-[#FAF8F5]/[0.04]";

/**
 * Back control. Lives in a fixed-height slot at the top-left of every screen so
 * the content below doesn't jump between Q1 (no back) and Q2 (back).
 */
function BackSlot({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex w-full min-h-[48px] items-center">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-2 inline-flex min-h-[48px] items-center gap-2 px-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#FAF8F5]/50 transition-colors duration-150 hover:text-[#FAF8F5]/80"
        >
          <svg
            viewBox="0 0 12 12"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7.5 2.25 3.75 6l3.75 3.75" />
          </svg>
          Back
        </button>
      )}
    </div>
  );
}

/* ───────────────────────────── page ───────────────────────────── */

type Stage = "quiz" | "ranking" | "reveal";

export default function McdDrinksQuizPage() {
  const [stage, setStage] = useState<Stage>("quiz");
  const [answers, setAnswers] = useState<DrinkKey[]>([]);
  const [finalists, setFinalists] = useState<DrinkKey[]>([]);
  /** Finalist photos decoded — the top-3 cards stay invisible until all 3 are in. */
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [ranking, setRanking] = useState<DrinkKey[]>([]);
  const [heroLoaded, setHeroLoaded] = useState(false);

  const questionIndex = answers.length;
  const question = QUESTIONS[questionIndex];
  // Counts the question on screen, not the ones behind it — otherwise Q1 shows
  // an empty track and the gold rule reads as missing.
  const progress = ((answers.length + 1) / QUESTIONS.length) * 100;
  const cardsReady = imagesLoaded >= finalists.length && finalists.length > 0;

  const answer = (drink: DrinkKey) => {
    const next = [...answers, drink];
    setAnswers(next);
    if (next.length === QUESTIONS.length) {
      setFinalists(topThree(next));
      setStage("ranking");
    }
  };

  const noteLoaded = useCallback(() => setImagesLoaded((n) => n + 1), []);

  // Fallback: never strand the user behind a photo that stalls or 404s.
  useEffect(() => {
    if (stage !== "ranking" || cardsReady) return;
    const t = setTimeout(() => setImagesLoaded(finalists.length), 2500);
    return () => clearTimeout(t);
  }, [stage, cardsReady, finalists.length]);

  const rank = (drink: DrinkKey) => {
    if (!cardsReady) return;
    setRanking((current) => {
      // Tapping an already-picked card takes it back out; the rest renumber.
      if (current.includes(drink)) return current.filter((d) => d !== drink);
      return current.length >= 3 ? current : [...current, drink];
    });
  };

  // Third tap lands, then the reveal takes over.
  useEffect(() => {
    if (stage !== "ranking" || ranking.length < 3) return;
    const t = setTimeout(() => setStage("reveal"), 450);
    return () => clearTimeout(t);
  }, [stage, ranking.length]);

  /**
   * Undo is exact by construction: `answers` is the only record of scoring, and
   * both the points and the first-hit index that breaks cutline ties are derived
   * from it in topThree on every read. Dropping the last answer therefore leaves
   * the run in precisely the state it was in before that tap — going back and
   * re-answering the same way cannot drift from never having gone back. Nothing
   * subtracts from a running tally, so there is no first-hit bookkeeping to
   * repair. (This is the reason the tally is not kept incrementally in state.)
   */
  const goBack = () => {
    if (stage === "reveal") {
      // Back to the ranking screen with the 1-2-3 picks cleared. Finalists and
      // their loaded photos stay put, so the cards are ready immediately.
      setStage("ranking");
      setRanking([]);
      setHeroLoaded(false);
      return;
    }

    if (stage === "ranking") {
      // Back to Q10, undoing the answer that ended the run. The top 3 is
      // recomputed from scratch when they finish again.
      setStage("quiz");
      setAnswers((current) => current.slice(0, -1));
      setFinalists([]);
      setImagesLoaded(0);
      setRanking([]);
      setHeroLoaded(false);
      return;
    }

    if (answers.length === 0) return; // Q1 has nowhere to go back to
    setAnswers((current) => current.slice(0, -1));
  };

  /** Q1 is the only screen without a back control. */
  const canGoBack = stage !== "quiz" || answers.length > 0;

  const reset = () => {
    setStage("quiz");
    setAnswers([]);
    setFinalists([]);
    setImagesLoaded(0);
    setRanking([]);
    setHeroLoaded(false);
  };

  const [winner, second, third] = useMemo(
    () => ranking.map((key) => DRINKS[key]),
    [ranking],
  );

  return (
    <main
      className={`${arimo.variable} flex min-h-screen flex-col bg-[#07070A] text-[#FAF8F5] antialiased`}
      style={{ fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif" }}
    >
      <style>{KEYFRAMES}</style>

      {/* McDonald's leads: gold Arches centred at the top of every screen. The
          source PNG carries ~9% transparent padding, so a 38px box lands the
          visible mark at the ~34px the mockup calls for. */}
      <header className="flex w-full shrink-0 justify-center px-5 pb-4 pt-7">
        <Image
          src={ARCHES_LOGO}
          alt="McDonald's"
          width={3840}
          height={2160}
          sizes="72px"
          priority
          className="h-[38px] w-auto"
        />
      </header>

      {/* Thin gold progress rule, directly under the Arches per the mockup. */}
      <div className="h-[3px] w-full shrink-0 bg-[#FAF8F5]/10">
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: `${stage === "quiz" ? progress : 100}%`,
            backgroundColor: GOLD,
          }}
        />
      </div>

      <div className="flex w-full flex-1 flex-col justify-center">
        {stage === "quiz" && question && (
          <section className="mx-auto w-full max-w-md px-5 py-10 sm:max-w-lg">
            <BackSlot onBack={canGoBack ? goBack : undefined} />
            <div key={questionIndex} className="mcdq-enter">
              <p className={EYEBROW} style={{ color: GOLD }}>
                Question {questionIndex + 1} of {QUESTIONS.length}
              </p>
              <h1 className={`${DISPLAY} mt-4 text-[42px] sm:text-[54px]`}>
                {question.q}
              </h1>

              <div className="mt-8 flex flex-col gap-3">
                {question.options.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => answer(option.drink)}
                    className={`${GLASS} min-h-[56px] w-full px-5 py-4 text-left text-[17px] transition-[transform,background-color,border-color] duration-150 hover:border-[#FAF8F5]/25 hover:bg-[#FAF8F5]/[0.07] active:scale-[0.98] active:bg-[#FAF8F5]/[0.09]`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {stage === "ranking" && (
          <section className="mx-auto w-full max-w-md px-5 py-10 sm:max-w-lg">
            <BackSlot onBack={goBack} />
            <h2 className={EYEBROW} style={{ color: GOLD }}>
              Your top 3 is in
            </h2>
            <p className="mt-3 text-[16px] text-[#FAF8F5]/60">
              Tap them in order — favorite first.
            </p>

            {/* Cards mount immediately so the photos fetch, but stay hidden
                until every one has decoded — that is the preload. */}
            <div
              className={`mt-7 flex flex-col gap-3 ${cardsReady ? "" : "invisible"}`}
            >
              {finalists.map((key, i) => {
                const drink = DRINKS[key];
                const place = ranking.indexOf(key);
                const picked = place !== -1;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => rank(key)}
                    aria-pressed={picked}
                    className={`${GLASS} flex min-h-[128px] w-full items-center gap-4 px-4 py-3 text-left transition-[border-color,background-color] duration-200 ${
                      // The animation classes land only once the photos are in,
                      // or the staggered entrance burns off behind the gate.
                      cardsReady ? "mcdq-card" : ""
                    } ${picked ? "bg-[#FAF8F5]/[0.06]" : "hover:border-[#FAF8F5]/25"}`}
                    style={
                      {
                        "--mcdq-delay": `${i * 150}ms`,
                        "--mcdq-float-delay": `${520 + i * 150 + i * 220}ms`,
                        ...(picked
                          ? { borderColor: GOLD, boxShadow: `inset 0 0 0 1px ${GOLD}` }
                          : null),
                      } as React.CSSProperties
                    }
                  >
                    <span
                      className={`flex h-[104px] w-[64px] shrink-0 items-end justify-center ${
                        cardsReady ? "mcdq-float" : ""
                      }`}
                    >
                      <Image
                        src={drink.src}
                        alt={drink.name}
                        width={drink.width}
                        height={drink.height}
                        sizes="128px"
                        onLoad={noteLoaded}
                        onError={noteLoaded}
                        className="h-[104px] w-auto max-w-full object-contain"
                      />
                    </span>

                    <span className={`${DISPLAY} flex-1 text-[26px] sm:text-[30px]`}>
                      {drink.name}
                    </span>

                    {picked && (
                      <span
                        className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[14px] font-bold leading-none"
                        style={{ backgroundColor: GOLD, color: GOLD_INK }}
                      >
                        {place + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {stage === "reveal" && winner && (
          <section className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-8 sm:max-w-lg">
            <BackSlot onBack={goBack} />
            {/* w-full matters: as a shrink-to-fit flex item this box would
                collapse to the image's own width, and globals'
                img{max-width:100%} would then size the hero off that collapsed
                width instead of off 55vh. */}
            <div
              className={`relative flex h-[55vh] w-full items-center justify-center ${
                heroLoaded ? "mcdq-pop" : "opacity-0"
              }`}
            >
              {/* The one and only use of McDonald's Red — a glow, never a surface. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[62vh] w-[62vh] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  // 4D / 24 / 00 are hex alpha for 30% / 14% / 0%.
                  background: `radial-gradient(circle, ${RED}4D 0%, ${RED}24 42%, ${RED}00 70%)`,
                }}
              />
              <Image
                src={winner.src}
                alt={winner.name}
                width={winner.width}
                height={winner.height}
                sizes="(max-width: 640px) 70vw, 360px"
                priority
                onLoad={() => setHeroLoaded(true)}
                onError={() => setHeroLoaded(true)}
                className="relative z-[1] h-full w-auto max-w-full object-contain"
              />
            </div>

            <div className="mcdq-fade-in mt-7 text-center">
              {/* Deliberately not text-transform: uppercase — the lowercase "c"
                  in McDONALD'S is how the mark is set. */}
              <p
                className="font-mono text-[11px] font-bold tracking-[0.22em]"
                style={{ color: GOLD }}
              >
                YOUR McDONALD&rsquo;S DRINK IS&hellip;
              </p>
              <h2 className={`${DISPLAY} mt-3 text-[40px] sm:text-[50px]`}>
                {winner.revealName ?? winner.name}
              </h2>
            </div>

            <div className="mcdq-fade-in-late mt-9 flex w-full items-start justify-center gap-9">
              {[second, third].map((drink, i) =>
                drink ? (
                  <div
                    key={drink.src}
                    className="flex w-[108px] flex-col items-center gap-2"
                  >
                    <Image
                      src={drink.src}
                      alt={drink.name}
                      width={drink.width}
                      height={drink.height}
                      sizes="120px"
                      className="h-[84px] w-auto max-w-full object-contain opacity-80"
                    />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#FAF8F5]/40">
                      #{i + 2}
                    </span>
                    <span className={`${DISPLAY} text-center text-[16px] text-[#FAF8F5]/75`}>
                      {drink.name}
                    </span>
                  </div>
                ) : null,
              )}
            </div>

            <div className={`${GLASS} mcdq-fade-in-late mt-9 w-full px-5 py-5 text-center`}>
              <p className="text-[15px] leading-[1.5] text-[#FAF8F5]/[0.68]">
                Order using the{" "}
                <span style={{ color: GOLD }}>McDonald&rsquo;s App</span> or
                in-store digital kiosk. Download the McDonald&rsquo;s App for
                deals, rewards, and local offers.
              </p>
            </div>

            <button
              type="button"
              onClick={reset}
              className="mcdq-fade-in-late mt-8 min-h-[48px] rounded-full px-9 font-mono text-[13px] font-bold uppercase tracking-[0.18em] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.98]"
              style={{ backgroundColor: GOLD, color: GOLD_INK }}
            >
              Run it again
            </button>
          </section>
        )}
      </div>

      {/* Postgame signs. */}
      <footer className="flex w-full shrink-0 flex-col items-center gap-2 px-5 pb-8 pt-10 opacity-55">
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

/* ─────────────────────────── keyframes ───────────────────────────
   Plain CSS in the component: no animation library, and nothing here needs to
   exist outside this page (hence the mcdq- prefix rather than tailwind.config
   entries). Loops are switched off under prefers-reduced-motion; entrances
   degrade to a plain fade with no transform. */

const KEYFRAMES = `
@keyframes mcdq-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes mcdq-rise  { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
@keyframes mcdq-float { 0%, 100% { transform: translateY(-4px); } 50% { transform: translateY(4px); } }
@keyframes mcdq-pop   { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
@keyframes mcdq-fade  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.mcdq-enter { animation: mcdq-enter 320ms ease-out both; }

.mcdq-card {
  animation: mcdq-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--mcdq-delay, 0ms);
}

/* Starts only after the card has finished rising, so the two never fight. */
.mcdq-float {
  animation: mcdq-float 3s ease-in-out infinite;
  animation-delay: var(--mcdq-float-delay, 0ms);
}

.mcdq-pop { animation: mcdq-pop 600ms cubic-bezier(0.34, 1.46, 0.64, 1) both; }
.mcdq-fade-in { animation: mcdq-fade 500ms ease-out 350ms both; }
.mcdq-fade-in-late { animation: mcdq-fade 500ms ease-out 700ms both; }

@media (prefers-reduced-motion: reduce) {
  .mcdq-float { animation: none; }
  .mcdq-enter, .mcdq-card, .mcdq-pop, .mcdq-fade-in, .mcdq-fade-in-late {
    animation-duration: 200ms;
    animation-timing-function: ease;
    animation-name: mcdq-fade-plain;
  }
  @keyframes mcdq-fade-plain { from { opacity: 0; } to { opacity: 1; } }
}
`;
