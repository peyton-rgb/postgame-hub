// Client-safe formatting helpers for the athlete app. Kept separate from
// payouts.ts (which imports the service-role Supabase client and must never be
// bundled into a client component).

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Longer date for "signed"/"synced" captions, e.g. "Jul 10, 2026".
export function formatLongDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Compact follower/reach count, e.g. 18200 -> "18.2K", 1200000 -> "1.2M".
export function formatReach(n: number | null): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  const m = n / 1_000_000;
  return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
}
