// Inspo triage is pinned DARK regardless of the user's theme: it is a
// video-review surface, and judging exposure, contrast and colour in a clip
// against a bright chrome is judging it against the wrong reference. Every
// grading and review tool does this for the same reason.
//
// The attribute is what does the work — the token layer keys off [data-theme]
// and custom properties cascade, so everything inside this wrapper resolves the
// dark palette even though the dashboard wrapper outside it may say light.
// useHubTheme() reads the LAST [data-theme] in the document, which is this one,
// so client components inside here pick the dark-ground logo variants too.
export default function InspoTriageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" className="min-h-screen bg-ground text-ink-1">
      {children}
    </div>
  );
}
