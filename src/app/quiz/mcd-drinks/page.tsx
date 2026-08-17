"use client";

/**
 * McDonald's drink quiz — /quiz/mcd-drinks
 *
 * A deliberately self-contained client-campaign page: no Supabase, no auth, no
 * shared Postgame components, no animation libraries. Everything the page needs
 * (data, scoring, keyframes) lives in this file so the campaign can be handed
 * over, forked, or deleted without touching the rest of the Hub.
 *
 * Note: /quiz is excluded from SiteNav's HIDDEN_ROUTES check and from
 * PageWrapper's Postgame loader — this surface carries no Postgame branding.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

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

const QUESTIONS: Question[] = [
  {
    q: "Sweet or refreshing?",
    options: [
      { label: "Sweet", drink: "orangeDream" },
      { label: "Refreshing", drink: "strawberryWatermelon" },
      { label: "Both", drink: "spriteBerryBlast" },
    ],
  },
  {
    q: "Classic or adventurous?",
    options: [
      { label: "Classic", drink: "dirtyDrPepper" },
      { label: "Adventurous", drink: "blackberryPassionFruit" },
      { label: "A little of both", drink: "dragonberry" },
    ],
  },
  {
    q: "Morning or night person?",
    options: [
      { label: "Morning", drink: "dragonberry" },
      { label: "Night", drink: "spriteBerryBlast" },
      { label: "Depends", drink: "dirtyDrPepper" },
    ],
  },
  {
    q: "Team leader or hype man?",
    options: [
      { label: "Leader", drink: "dirtyDrPepper" },
      { label: "Hype man", drink: "dragonberry" },
      { label: "The chill one", drink: "orangeDream" },
    ],
  },
  {
    q: "Fruit or soda?",
    options: [
      { label: "Fruit", drink: "strawberryWatermelon" },
      { label: "Soda", drink: "spriteBerryBlast" },
      { label: "Tropical", drink: "mangoPineapple" },
    ],
  },
  {
    q: "Play it safe or try something new?",
    options: [
      { label: "Safe", drink: "orangeDream" },
      { label: "Something new", drink: "blackberryPassionFruit" },
      { label: "New and bold", drink: "dragonberry" },
    ],
  },
  {
    q: "Pick a vacation",
    options: [
      { label: "Beach", drink: "strawberryWatermelon" },
      { label: "Tropical island", drink: "mangoPineapple" },
      { label: "City adventure", drink: "dirtyDrPepper" },
    ],
  },
  {
    q: "What’s your game-day vibe?",
    options: [
      { label: "Locked in", drink: "dragonberry" },
      { label: "Chillin’", drink: "orangeDream" },
      { label: "Bring the energy", drink: "mangoPineapple" },
    ],
  },
  {
    q: "Sweet tooth or flavor explorer?",
    options: [
      { label: "Sweet tooth", drink: "orangeDream" },
      { label: "Flavor explorer", drink: "blackberryPassionFruit" },
      { label: "Refreshing", drink: "strawberryWatermelon" },
    ],
  },
  {
    q: "Post-game reward?",
    options: [
      { label: "Smoothie vibes", drink: "mangoPineapple" },
      { label: "Something fizzy", drink: "spriteBerryBlast" },
      { label: "Something bold", drink: "blackberryPassionFruit" },
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
  const progress = (answers.length / QUESTIONS.length) * 100;
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
    <main className="min-h-screen bg-[#07070A] text-[#FAF8F5] font-sans antialiased">
      <style>{KEYFRAMES}</style>

      {/* Progress — the only always-on chrome. Sits above the notch-safe padding. */}
      <div className="fixed inset-x-0 top-0 z-20 h-[3px] bg-white/10">
        <div
          className="h-full bg-[#D73F09] transition-[width] duration-300 ease-out"
          style={{ width: `${stage === "quiz" ? progress : 100}%` }}
        />
      </div>

      {stage === "quiz" && question && (
        <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pb-12 pt-16 sm:max-w-lg">
          <div key={questionIndex} className="mcdq-enter">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
              Question {questionIndex + 1} of {QUESTIONS.length}
            </p>
            <h1 className="mt-3 text-[30px] font-bold leading-[1.15] sm:text-[36px]">
              {question.q}
            </h1>

            <div className="mt-8 flex flex-col gap-3">
              {question.options.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => answer(option.drink)}
                  className="min-h-[56px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left text-[17px] font-medium transition-[transform,background-color,border-color] duration-150 active:scale-[0.98] active:bg-white/[0.08] hover:border-white/20 hover:bg-white/[0.07]"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {stage === "ranking" && (
        <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pb-12 pt-16 sm:max-w-2xl">
          <h2 className="text-center text-[26px] font-bold leading-tight sm:text-[32px]">
            Your top three
          </h2>
          <p className="mt-2 text-center text-[15px] text-white/55">
            Tap them in order — favorite first.
          </p>

          {/* Cards mount immediately so the photos fetch, but stay hidden until
              every one has decoded — that is the preload. */}
          <div
            className={`mt-8 grid grid-cols-3 gap-2 sm:gap-4 ${
              cardsReady ? "" : "invisible"
            }`}
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
                  className={`group relative flex min-h-[190px] flex-col items-center justify-end gap-3 rounded-2xl border px-2 pb-4 pt-5 transition-[border-color,background-color] duration-200 ${
                    // The animation classes land only once the photos are in, or the
                    // staggered entrance would burn off behind the preload gate.
                    cardsReady ? "mcdq-card" : ""
                  } ${
                    picked
                      ? "border-[#D73F09] bg-white/[0.06] ring-1 ring-[#D73F09]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                  style={
                    {
                      "--mcdq-delay": `${i * 150}ms`,
                      "--mcdq-float-delay": `${520 + i * 150 + i * 220}ms`,
                    } as React.CSSProperties
                  }
                >
                  {picked && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#D73F09] text-[13px] font-bold leading-none text-[#FAF8F5]">
                      {place + 1}
                    </span>
                  )}

                  <span
                    className={`flex h-[120px] items-end justify-center ${
                      cardsReady ? "mcdq-float" : ""
                    }`}
                  >
                    <Image
                      src={drink.src}
                      alt={drink.name}
                      width={drink.width}
                      height={drink.height}
                      sizes="160px"
                      onLoad={noteLoaded}
                      onError={noteLoaded}
                      className="h-[120px] w-auto object-contain"
                    />
                  </span>

                  <span className="text-[12px] font-semibold leading-tight text-white/85 sm:text-[14px]">
                    {drink.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {stage === "reveal" && winner && (
        <section className="mx-auto flex w-full max-w-md flex-col items-center px-5 pb-16 pt-14 sm:max-w-lg">
          {/* w-full matters: as a shrink-to-fit flex item this box would collapse to
              the image's own width, and globals' img{max-width:100%} would then
              size the hero off that collapsed width instead of off 55vh. */}
          <div
            className={`flex h-[55vh] w-full items-center justify-center ${
              heroLoaded ? "mcdq-pop" : "opacity-0"
            }`}
          >
            <Image
              src={winner.src}
              alt={winner.name}
              width={winner.width}
              height={winner.height}
              sizes="(max-width: 640px) 70vw, 360px"
              priority
              onLoad={() => setHeroLoaded(true)}
              onError={() => setHeroLoaded(true)}
              className="h-full w-auto max-w-full object-contain"
            />
          </div>

          <div className="mcdq-fade-in mt-7 text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/45">
              Your McDonald&rsquo;s drink is&hellip;
            </p>
            <h2 className="mt-2 text-[32px] font-bold leading-[1.1] sm:text-[40px]">
              {winner.revealName ?? winner.name}
            </h2>
          </div>

          <div className="mcdq-fade-in-late mt-10 flex w-full items-start justify-center gap-8">
            {[second, third].map((drink, i) =>
              drink ? (
                <div key={drink.src} className="flex w-[104px] flex-col items-center gap-2">
                  <Image
                    src={drink.src}
                    alt={drink.name}
                    width={drink.width}
                    height={drink.height}
                    sizes="120px"
                    className="h-[84px] w-auto object-contain opacity-80"
                  />
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/35">
                    #{i + 2}
                  </span>
                  <span className="text-center text-[12px] font-medium leading-tight text-white/70">
                    {drink.name}
                  </span>
                </div>
              ) : null,
            )}
          </div>

          <div className="mcdq-fade-in-late mt-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 text-center">
            <p className="text-[15px] leading-[1.5] text-white/80">
              Order it on the McDonald&rsquo;s App or the in-store kiosk — download the
              app for deals, rewards, and local offers.
            </p>
          </div>

          <button
            type="button"
            onClick={reset}
            className="mcdq-fade-in-late mt-8 min-h-[48px] rounded-full border border-white/20 px-8 text-[15px] font-semibold transition-colors duration-150 hover:border-white/40 hover:bg-white/[0.06] active:bg-white/[0.1]"
          >
            Run it again
          </button>
        </section>
      )}
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
