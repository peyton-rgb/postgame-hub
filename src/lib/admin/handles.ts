// Shared handle-list parsing for bulk actions (ratings, future
// audience pastes). Dedupes, strips @, lowercases, hard-caps at 500
// per batch — the cap is stated in every UI that uses this.

export function parseHandles(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((h) => h.trim().replace(/^@/, "").toLowerCase())
        .filter((h) => h.length > 0 && h.length <= 64)
    )
  ).slice(0, 500);
}
