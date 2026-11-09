// Carousels are pinned DARK regardless of the user's theme — the editor is a
// colour-judging surface (same reason as inspo triage): footage graded against
// a bright chrome reads wrong.
export default function CarouselsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" className="min-h-screen bg-ground text-ink-1">
      {children}
    </div>
  );
}
