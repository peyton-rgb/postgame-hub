// Postgame × CBFWA pitch deck (static page served from /public/cbfwa)
// Same pattern as the Red Bull Tailgate pitch: full-screen iframe of a
// hand-built HTML file. Unlisted: linked nowhere, noindex on both layers.
export const metadata = {
  title: "Postgame × CBFWA",
  robots: { index: false, follow: false },
};

export default function CbfwaPitch() {
  return (
    <iframe
      src="/cbfwa/index.html"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
      title="Postgame × CBFWA"
      allow="fullscreen"
      allowFullScreen
    />
  );
}
