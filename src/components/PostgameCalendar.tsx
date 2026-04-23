'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PostgameCalendar.module.css';
import {
  EVENTS,
  MONTH_NAMES,
  DAYS_IN_MONTH,
  getStartDay,
  type TimelineEvent,
  type EventCategory,
} from '@/data/events';

// Where your processed logo PNGs live. Next.js serves anything under
// /public at the root, so "/logos/events/foo.png" maps to
// /public/logos/events/foo.png on disk.
const LOGO_DIR = '/logos/events/';

// Path to your Postgame brand logo in /public. Drop your logo file at
// /public/postgame-logo.png (or whatever path you prefer) and this
// component will render it in the header.
const POSTGAME_LOGO = '/postgame-logo.png';

const DEFAULT_DESCRIPTION =
  'Every major sports event, NCAA championship, and holiday across the year. Sports sit above the line; holidays hang below. Drag sideways to travel through the calendar.';

// Card geometry for the collision-aware layout
const CARD_W = 96;
const CARD_GAP = 8;
const MIN_SPACING_PX = CARD_W + CARD_GAP;
const MIN_SLOTS = 3;

type FilterValue = 'all' | EventCategory;

interface PostgameCalendarProps {
  /** Optional override for the section description. */
  description?: string;
  /** Optional override for where the timeline should center itself. Defaults to today. */
  focusDate?: Date;
}

interface LaidOutEvent {
  ev: TimelineEvent;
  finalPx: number;
}

function layoutSide(events: TimelineEvent[], monthWidth: number, eventMonth: number): LaidOutEvent[] {
  const daysInMonth = DAYS_IN_MONTH[eventMonth];
  const items: LaidOutEvent[] = events.map((ev) => {
    const day = getStartDay(ev.dateLabel, eventMonth);
    const naturalPx = ((day - 0.5) / daysInMonth) * monthWidth;
    return { ev, finalPx: naturalPx };
  });
  items.sort((a, b) => a.finalPx - b.finalPx);
  if (items.length && items[0].finalPx < CARD_W / 2) {
    items[0].finalPx = CARD_W / 2;
  }
  for (let i = 1; i < items.length; i++) {
    const minAllowed = items[i - 1].finalPx + MIN_SPACING_PX;
    if (items[i].finalPx < minAllowed) items[i].finalPx = minAllowed;
  }
  return items;
}

function getBaseMonthWidth(aboveCount: number, belowCount: number): number {
  const slots = Math.max(MIN_SLOTS, Math.max(aboveCount, belowCount));
  return slots * MIN_SPACING_PX;
}

function isAboveCategory(cat: EventCategory): boolean {
  return cat === 'college' || cat === 'pro-sports';
}

interface MonthLayout {
  month: number;
  width: number;
  above: LaidOutEvent[];
  below: LaidOutEvent[];
}

function buildLayout(): MonthLayout[] {
  const result: MonthLayout[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthEvents = EVENTS.filter((e) => e.month === m);
    if (monthEvents.length === 0) continue;
    const aboveList = monthEvents.filter((e) => isAboveCategory(e.category));
    const belowList = monthEvents.filter((e) => !isAboveCategory(e.category));
    const baseWidth = getBaseMonthWidth(aboveList.length, belowList.length);
    const aboveLaid = layoutSide(aboveList, baseWidth, m);
    const belowLaid = layoutSide(belowList, baseWidth, m);
    const lastAbove = aboveLaid.length ? aboveLaid[aboveLaid.length - 1].finalPx : 0;
    const lastBelow = belowLaid.length ? belowLaid[belowLaid.length - 1].finalPx : 0;
    const widthNeeded = Math.max(lastAbove, lastBelow) + CARD_W / 2 + 16;
    const finalWidth = Math.max(baseWidth, widthNeeded);
    result.push({ month: m, width: finalWidth, above: aboveLaid, below: belowLaid });
  }
  return result;
}

const LAYOUT = buildLayout();

export default function PostgameCalendar({ description, focusDate }: PostgameCalendarProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeftStart: 0, moved: false });
  const [leftDisabled, setLeftDisabled] = useState(true);
  const [rightDisabled, setRightDisabled] = useState(false);

  // Fade cards in as they scroll into view.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = Math.random() * 120;
            setTimeout(() => el.classList.add(styles.inView), delay);
            io.unobserve(el);
          }
        });
      },
      { root: scroller, threshold: 0.1 },
    );
    scroller.querySelectorAll(`.${styles.eventLogoWrap}`).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // On mount, scroll so today's date is centered in the viewport.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const d = focusDate ?? new Date();
    const currentMonth = d.getMonth() + 1;
    const currentDay = d.getDate();
    const daysInMonth = new Date(d.getFullYear(), currentMonth, 0).getDate();
    const section = scroller.querySelector<HTMLElement>(`[data-month="${currentMonth}"]`);
    if (!section) return;
    const dayPct = (currentDay - 0.5) / daysInMonth;
    const targetLeft = section.offsetLeft + dayPct * section.offsetWidth;
    scroller.scrollLeft = targetLeft - scroller.clientWidth / 2;
  }, [focusDate]);

  // Arrow-button state + keyboard nav
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const update = () => {
      setLeftDisabled(scroller.scrollLeft <= 2);
      setRightDisabled(scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 2);
    };
    update();
    scroller.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') scroller.scrollBy({ left: 500, behavior: 'smooth' });
      if (e.key === 'ArrowLeft') scroller.scrollBy({ left: -500, behavior: 'smooth' });
    };
    document.addEventListener('keydown', key);
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('keydown', key);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setIsDragging(true);
    dragState.current.moved = false;
    dragState.current.startX = e.pageX - scroller.offsetLeft;
    dragState.current.scrollLeftStart = scroller.scrollLeft;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    e.preventDefault();
    const x = e.pageX - scroller.offsetLeft;
    const walk = x - dragState.current.startX;
    if (Math.abs(walk) > 5) dragState.current.moved = true;
    scroller.scrollLeft = dragState.current.scrollLeftStart - walk;
  };
  const stopDrag = () => setIsDragging(false);

  const counts = {
    all: EVENTS.length,
    college: EVENTS.filter((e) => e.category === 'college').length,
    'pro-sports': EVENTS.filter((e) => e.category === 'pro-sports').length,
    'brand-moment': EVENTS.filter((e) => e.category === 'brand-moment').length,
  } as const;

  const scrollBy = (px: number) => {
    scrollerRef.current?.scrollBy({ left: px, behavior: 'smooth' });
  };

  const eventVisible = (ev: TimelineEvent): boolean =>
    filter === 'all' || ev.category === filter;
  const sectionVisible = (layout: MonthLayout): boolean =>
    layout.above.some((i) => eventVisible(i.ev)) || layout.below.some((i) => eventVisible(i.ev));

  return (
    <section id="postgame-calendar" className={styles.wrap}>
      {/* Hero headline — sits above the Postgame Calendar header */}
      <div className={styles.hero}>
        <h2 className={styles.heroHeadline}>What's Next?</h2>
      </div>

      <header className={styles.header}>
        <div className={styles.brandRow}>
          <img
            src={POSTGAME_LOGO}
            alt="Postgame"
            className={styles.brandLogo}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className={styles.title}>Calendar</span>
        </div>
        <p className={styles.subtitle}>{description ?? DEFAULT_DESCRIPTION}</p>
      </header>

      <div className={styles.filterBarWrap}>
        <div className={styles.filterBar}>
          {(
            [
              { k: 'all', label: 'All' },
              { k: 'college', label: 'College' },
              { k: 'pro-sports', label: 'Pro Sports' },
              { k: 'brand-moment', label: 'Holidays' },
            ] as const
          ).map(({ k, label }) => (
            <button
              key={k}
              type="button"
              className={`${styles.filterBtn} ${filter === k ? styles.active : ''}`}
              onClick={() => setFilter(k as FilterValue)}
            >
              {label} <span className={styles.count}>{counts[k as FilterValue]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.hintTop}>Drag · Swipe · Arrow keys</div>

      <div className={styles.scrollerFrame}>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.left}`}
          aria-label="Scroll left"
          onClick={() => scrollBy(-500)}
          disabled={leftDisabled}
        >
          ‹
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.right}`}
          aria-label="Scroll right"
          onClick={() => scrollBy(500)}
          disabled={rightDisabled}
        >
          ›
        </button>

        <div
          ref={scrollerRef}
          className={`${styles.scroller} ${isDragging ? styles.dragging : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onClickCapture={(e) => {
            if (dragState.current.moved) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <div className={styles.timeline}>
            {LAYOUT.map((layout) => {
              const hidden = !sectionVisible(layout);
              return (
                <div
                  key={layout.month}
                  data-month={layout.month}
                  className={`${styles.monthSection} ${hidden ? styles.hidden : ''}`}
                  style={{ width: layout.width }}
                >
                  <div className={`${styles.monthEvents} ${styles.above}`}>
                    {layout.above.map((item) => (
                      <EventCard
                        key={item.ev.id}
                        ev={item.ev}
                        placement="above"
                        posPx={item.finalPx}
                        hidden={!eventVisible(item.ev)}
                      />
                    ))}
                  </div>
                  <div className={styles.spineRow}>
                    <div className={styles.monthLabel}>{MONTH_NAMES[layout.month - 1]}</div>
                  </div>
                  <div className={`${styles.monthEvents} ${styles.below}`}>
                    {layout.below.map((item) => (
                      <EventCard
                        key={item.ev.id}
                        ev={item.ev}
                        placement="below"
                        posPx={item.finalPx}
                        hidden={!eventVisible(item.ev)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function EventCard({
  ev,
  placement,
  posPx,
  hidden,
}: {
  ev: TimelineEvent;
  placement: 'above' | 'below';
  posPx: number;
  hidden: boolean;
}) {
  const classes = [
    styles.event,
    placement === 'below' ? styles.below : '',
    ev.isTentpole ? styles.tentpole : '',
    ev.isQuadrennial ? styles.quadrennial : '',
    hidden ? styles.hidden : '',
  ]
    .filter(Boolean)
    .join(' ');

  // posPx is no longer used for layout — flex handles even spacing.
  // The param stays in the signature so the data pipeline doesn't break,
  // but we ignore it for positioning now.
  void posPx;

  return (
    <div className={classes} data-category={ev.category}>
      <div className={styles.eventLogoWrap}>
        {ev.logoFile ? (
          <img
            src={LOGO_DIR + ev.logoFile}
            alt={`${ev.name} logo`}
            onError={(e) => {
              const fallback = document.createElement('span');
              fallback.className = styles.emojiFallback;
              fallback.textContent = ev.emoji;
              e.currentTarget.replaceWith(fallback);
            }}
          />
        ) : (
          <span className={styles.emojiFallback}>{ev.emoji}</span>
        )}
      </div>
      <div className={styles.eventName}>{ev.name}</div>
      <div className={styles.eventDate}>{ev.dateLabel}</div>
      <div className={styles.eventStem} />
    </div>
  );
}
