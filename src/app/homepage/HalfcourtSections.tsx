"use client";

import { useEffect, useRef } from "react";
import styles from "./halfcourt-sections.module.css";

/**
 * Credentials + three campaign proof blocks, lifted from the Half Court pitch
 * (public/halfcourt/index.html). Source classnames are extremely generic
 * (.title, .bg, .split, .melt…), so every one is remapped through the CSS
 * module — nothing here can restyle the rest of the Hub, or be restyled by it.
 *
 * Behaviours ported from the source's inline <script> blocks:
 *   - .rv scroll reveal (IntersectionObserver → adds `in`, then unobserves)
 *   - statnum count-up (reads data-n / data-suf, animates 0→n once, in view)
 *   - autoplay videos play only while in view (muted, loop, playsinline)
 *   - reduced-motion honoured (reveal/count-up/marquee disabled via CSS + JS)
 */
export default function HalfcourtSections() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observers: IntersectionObserver[] = [];

    // ---- scroll reveal ----
    const revealEls = Array.from(
      root.querySelectorAll<HTMLElement>(`.${styles.rv}`)
    );
    if (reduce) {
      revealEls.forEach((el) => el.classList.add(styles.in));
    } else {
      const rio = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add(styles.in);
              rio.unobserve(e.target);
            }
          });
        },
        { threshold: 0.16 }
      );
      revealEls.forEach((el) => rio.observe(el));
      observers.push(rio);
    }

    // ---- statnum count-up ----
    const statEls = Array.from(
      root.querySelectorAll<HTMLElement>(`.${styles.statnum}`)
    );
    const setFinal = (el: HTMLElement) => {
      const n = Number(el.dataset.n || 0);
      el.textContent = `${n}${el.dataset.suf || ""}`;
    };
    if (reduce) {
      statEls.forEach(setFinal);
    } else {
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const sio = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            const el = e.target as HTMLElement;
            if (!e.isIntersecting || el.dataset.done) return;
            el.dataset.done = "1";
            const n = Number(el.dataset.n || 0);
            const suf = el.dataset.suf || "";
            const t0 = performance.now();
            const D = 1500;
            const tick = (now: number) => {
              const p = Math.min(1, (now - t0) / D);
              el.textContent = `${Math.round(n * ease(p))}${suf}`;
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        },
        { threshold: 0.5 }
      );
      statEls.forEach((el) => sio.observe(el));
      observers.push(sio);
    }

    // ---- autoplay videos only while in view ----
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video"));
    const vio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.35 }
    );
    videos.forEach((v) => vio.observe(v));
    observers.push(vio);

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // tap-for-sound: unmute the nearest video in the same section
  const toggleSound = (e: React.MouseEvent<HTMLButtonElement>) => {
    const chip = e.currentTarget;
    const v = chip.closest("section")?.querySelector("video");
    if (!v) return;
    v.muted = !v.muted;
    chip.textContent = v.muted ? "🔇 tap for sound" : "🔊 sound on";
    if (!v.muted) v.play().catch(() => {});
  };

  const rv = (...extra: string[]) => [styles.rv, ...extra].join(" ");

  return (
    <div ref={rootRef} className={styles.root}>
      {/* ============ WHO WE ARE — CREDENTIALS ============ */}
      <section className={styles.intro}>
        <div className={styles.scrim} style={{ overflow: "hidden" }}>
          <img src="/home/logo_pg_primary.png" alt="" className={styles.introBgLogo} />
        </div>
        <div className={styles.introInner}>
          <div className={rv(styles.folio)}>Who we are</div>
          <h2 className={rv(styles.title, styles.d1, styles.introTitle)}>
            The leading NIL agency
            <br />
            <span>in college sports.</span>
          </h2>
          <div className={rv(styles.d2, styles.introBody)}>
            <p className={styles.caption}>
              Since 2021, Postgame has been the leading NIL agency in all of
              college sports. 70,000+ college athletes have been paid through
              Postgame NIL deals negotiated between brands, collectives and more.
            </p>
            <p className={styles.caption}>
              We&apos;ve worked with nearly every big-name college athlete —
              connecting them to the world&apos;s most recognized brands. Our
              understanding of a player&apos;s worth on and off the field means
              every activation lands with the right athletes, contracted right,
              delivered white-glove.
            </p>
          </div>
          <div className={rv(styles.d3, styles.statGrid)}>
            <div className={styles.statCell}>
              <div className={styles.statKicker}>Athletes paid</div>
              <div
                className={`${styles.title} ${styles.statnum} ${styles.statNum}`}
                data-n="70"
                data-suf="K+"
              >
                0K+
              </div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statKicker}>Brand partners</div>
              <div
                className={`${styles.title} ${styles.statnum} ${styles.statNum}`}
                data-n="100"
                data-suf="+"
              >
                0+
              </div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statKicker}>NIL campaigns</div>
              <div
                className={`${styles.title} ${styles.statnum} ${styles.statNum}`}
                data-n="300"
                data-suf="+"
              >
                0+
              </div>
            </div>
          </div>
          <div className={rv(styles.d3, styles.brandtick)}>
            <div className={styles.btrow}>
              {BRAND_TICKS.map((b, i) => (
                <img key={`a${i}`} src={b.src} alt={b.alt} />
              ))}
              {/* duplicated row keeps the marquee loop seamless */}
              {BRAND_TICKS.map((b, i) => (
                <img key={`b${i}`} src={b.src} alt={b.alt} aria-hidden="true" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ 2026 · EVENT ACTIVATION — CANE'S ============ */}
      <section className={styles.split}>
        <div className={`${styles.side} ${styles.right}`}>
          <video
            poster="/home/canes_poster.jpg"
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src="/home/canes_recap.mp4" type="video/mp4" />
            <source src="/home/canes_recap.webm" type="video/webm" />
          </video>
        </div>
        <div className={`${styles.melt} ${styles.meltToR}`} />
        <button
          type="button"
          className={`${styles.sndhint} ${styles.r}`}
          onClick={toggleSound}
        >
          🔇 tap for sound
        </button>
        <div className={`${styles.txt} ${styles.canesText}`}>
          <img className={rv(styles.brandlogo)} src="/home/logo_canes.png" alt="Raising Cane's" />
          <div className={rv(styles.folio)}>2026 · Event activation</div>
          <h2
            className={rv(styles.title, styles.d1)}
            style={{ fontSize: "clamp(40px,4.8vw,62px)", marginTop: 12 }}
          >
            Raising Cane&apos;s
            <br />× Fanatics Fest
          </h2>
          <p
            className={rv(styles.d1)}
            style={{
              fontWeight: 600,
              color: "rgba(255,255,255,.85)",
              marginTop: 12,
              fontSize: 16,
            }}
          >
            The Dunk Tank — with Tom Brady &amp; Rob Gronkowski
          </p>
          <p className={rv(styles.caption, styles.d2)} style={{ marginTop: 14, maxWidth: "44ch" }}>
            A full activation floor at Fanatics Fest NYC: the celebrity dunk
            tank, Sauce Dunk, the Chicken-Finger Hail Mary, Cane&apos;s Cam, and a
            VIP lounge — concepted, produced, shot, and turned into a same-day
            content engine. <b>Teaser live by noon; the dunk reel posted before
            the crowd left the building.</b>
          </p>
          <div className={rv(styles.d3)} style={{ display: "flex", gap: 36, marginTop: 26 }}>
            <div>
              <div className={styles.statN}>6</div>
              <div className={styles.statL}>event segments</div>
            </div>
            <div>
              <div className={styles.statN}>2</div>
              <div className={styles.statL}>GOAT-level celebrities</div>
            </div>
            <div>
              <div className={`${styles.statN} ${styles.accent}`} style={{ fontSize: 30, paddingTop: 8 }}>
                Same-day
              </div>
              <div className={styles.statL}>turnaround</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 2026 · CHAMPIONSHIP MOMENT — C4 ============ */}
      <section className={styles.split}>
        <div className={styles.c4Cutout}>
          <img
            src="/home/c4_martin.jpg"
            alt="Alijah Martin — national champion, C4 band on"
          />
        </div>
        <div className={`${styles.side} ${styles.left} ${styles.c4Video}`}>
          <video
            poster="/home/c4_poster.jpg"
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src="/home/c4_tiktok.mp4" type="video/mp4" />
            <source src="/home/c4_tiktok.webm" type="video/webm" />
          </video>
        </div>
        <div
          className={styles.melt}
          style={{
            background:
              "linear-gradient(90deg,rgba(10,10,14,0) 0%,rgba(10,10,14,0) 24%,rgba(10,10,14,.85) 35%,rgba(10,10,14,.96) 44%,rgba(10,10,14,.96) 60%,rgba(10,10,14,.85) 69%,rgba(10,10,14,0) 80%,rgba(10,10,14,0) 100%),linear-gradient(180deg,var(--hc-ink) 0%,rgba(10,10,14,0) 14%,rgba(10,10,14,0) 86%,var(--hc-ink) 100%)",
          }}
        />
        <button
          type="button"
          className={`${styles.sndhint} ${styles.l}`}
          onClick={toggleSound}
        >
          🔇 tap for sound
        </button>
        <div className={`${styles.txt} ${styles.c4Text}`}>
          <img className={rv(styles.brandlogo)} src="/home/logo_c4.png" alt="C4 Energy" />
          <div className={rv(styles.folio)}>2026 · Championship moment</div>
          <h2
            className={rv(styles.title, styles.d1)}
            style={{ fontSize: "clamp(38px,4.4vw,56px)", marginTop: 12 }}
          >
            C4 Energy
            <br />× The Natty
          </h2>
          <p
            className={rv(styles.d1)}
            style={{
              fontWeight: 600,
              color: "rgba(255,255,255,.85)",
              marginTop: 12,
              fontSize: 15,
            }}
          >
            National-championship activation · Florida basketball
          </p>
          <p className={rv(styles.caption, styles.d2)} style={{ marginTop: 14 }}>
            An energy-drink brand, a championship moment, and the school&apos;s
            basketball stars. The trophy shot ran with the C4 band front and
            centre, carried by the athlete&apos;s own channels.
          </p>
        </div>
      </section>

      {/* ============ 2026 · LICENSED DESIGN COLLAB — HOLLISTER ============ */}
      <section className={styles.split}>
        <div
          className={styles.bg}
          style={{
            backgroundImage: "url('/home/hollister_lineup.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 15%",
            filter: "saturate(1.05)",
          }}
        />
        <div
          className={styles.scrim}
          style={{
            background:
              "linear-gradient(90deg,rgba(10,10,14,.96) 0%,rgba(10,10,14,.88) 34%,rgba(10,10,14,.35) 62%,rgba(10,10,14,.15) 100%),linear-gradient(180deg,rgba(10,10,14,.85) 0%,rgba(10,10,14,0) 22%,rgba(10,10,14,0) 74%,var(--hc-ink) 100%)",
          }}
        />
        <div className={`${styles.side} ${styles.right} ${styles.hollisterSide}`}>
          <img
            src="/home/hollister_qbs.jpg"
            alt="DJ Lagway and Tommy Castellanos — the rivalry frame"
          />
        </div>
        <div
          className={styles.melt}
          style={{
            background:
              "linear-gradient(270deg,rgba(10,10,14,0) 0%,rgba(10,10,14,0) 24%,rgba(10,10,14,.8) 34%,rgba(10,10,14,0) 46%),linear-gradient(180deg,var(--hc-ink) 0%,rgba(10,10,14,0) 14%,rgba(10,10,14,0) 86%,var(--hc-ink) 100%)",
          }}
        />
        <div className={`${styles.txt} ${styles.hollisterText}`}>
          <img
            className={rv(styles.brandlogo)}
            src="/home/logo_hollister.png"
            alt="Hollister"
            style={{ height: 38 }}
          />
          <div className={rv(styles.folio)}>2026 · Licensed design collab</div>
          <h2
            className={rv(styles.title, styles.d1)}
            style={{ fontSize: "clamp(38px,4.6vw,58px)", marginTop: 12 }}
          >
            Design Collab
            <br />— Rivalry Week
          </h2>
          <p className={rv(styles.caption, styles.d2)} style={{ marginTop: 14, maxWidth: "42ch" }}>
            Licensed design collab and photoshoot built around rivalry week —
            Texas, Ohio State, Michigan, Florida, FSU and more, athletes fronting
            the looks and carrying the drop to their own audiences. QBs DJ Lagway
            and Tommy Castellanos squared up across the state line. <b>Proof we
            run brand-side creative and athlete draw as one production.</b>
          </p>
          <div className={rv(styles.d3)} style={{ marginTop: 16 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--hc-faint)",
              }}
            >
              <b style={{ color: "#fff" }}>The pattern —</b> rivalry energy +
              athlete-fronted creative = the drop sells itself
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

const BRAND_TICKS: { src: string; alt: string }[] = [
  { src: "/home/tick_canes.png", alt: "Raising Cane's" },
  { src: "/home/tick_adidas.png", alt: "adidas" },
  { src: "/home/tick_hollister.png", alt: "Hollister" },
  { src: "/home/tick_cvs.png", alt: "CVS" },
  { src: "/home/tick_wendys.png", alt: "Wendy's" },
  { src: "/home/tick_goodr.png", alt: "goodr" },
  { src: "/home/tick_stanley.png", alt: "Stanley" },
  { src: "/home/tick_heydude.svg", alt: "HEYDUDE" },
  { src: "/home/tick_crocs.svg", alt: "Crocs" },
  { src: "/home/tick_7eleven.png", alt: "7-Eleven" },
  { src: "/home/tick_tacojohns.png", alt: "Taco John's" },
  { src: "/home/tick_armani.png", alt: "Armani" },
  { src: "/home/tick_c4.png", alt: "C4 Energy" },
];
