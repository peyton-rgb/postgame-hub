// Shared primitives for the v2 recap. Small on purpose — these exist so the
// three typographic roles (kicker / section title / stat figure) are defined
// once rather than restated with slightly different tracking in nine places.
import type { ReactNode } from "react";

/** Mono, wide-tracked, uppercase. Orange by default; the hero overrides it. */
export function Kicker({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-mono text-[14px] uppercase tracking-[0.34em] text-[color:var(--rv-orange)] ${className}`}
    >
      {children}
    </p>
  );
}

/** Bebas, 68px desktop / 42px below the 1000px break. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-[var(--s1)] font-display text-[42px] leading-none tracking-[0.02em] min-[1001px]:text-[68px]">
      {children}
    </h2>
  );
}

export function SectionHead({
  kicker,
  title,
  tight = false,
}: {
  kicker: string;
  title?: string;
  /** #perf and #bic sit closer to their content than the other sections. */
  tight?: boolean;
}) {
  return (
    <header
      className={
        tight
          ? "mb-[var(--s3)] min-[1001px]:mb-[var(--s4)]"
          : "mb-[var(--s3)] min-[1001px]:mb-[var(--s5)]"
      }
    >
      <Kicker>{kicker}</Kicker>
      {title ? <SectionTitle>{title}</SectionTitle> : null}
    </header>
  );
}

/** The Anton numeral face. Every figure on the page goes through this. */
export function Stat({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    // No line-height here on purpose: several callers set their own, and two
    // competing leading-* utilities resolve by CSS source order rather than by
    // the order they appear in the class string.
    <span className={`font-[family-name:var(--font-anton)] tabular-nums ${className}`}>
      {children}
    </span>
  );
}

/** A section wrapper: top rule, page gutter, and the nav-aware scroll offset. */
export function Section({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-recap-v2={id}
      className="scroll-mt-[var(--nav-h)] border-t border-[color:var(--rv-line)] px-[var(--gutter)] py-[var(--s5)] min-[1001px]:py-[var(--s6)]"
    >
      {children}
    </section>
  );
}

/** Small mono footnote under a section's content. */
export function Foot({ children }: { children: ReactNode }) {
  return (
    <p className="mt-[var(--s2)] font-mono text-[11px] leading-[1.8] tracking-[0.08em] text-[color:var(--rv-dim2)]">
      {children}
    </p>
  );
}
