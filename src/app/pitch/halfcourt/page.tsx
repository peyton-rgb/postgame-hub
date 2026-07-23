// Red Bull Half Court — Tailgate Edition pitch (static site served from /public/halfcourt)
// Pattern mirrors the draft-tool iframe embed. Unlisted: linked nowhere, noindex on the page itself.
export const metadata = {
  title: "Red Bull Half Court — Tailgate Edition",
  robots: { index: false, follow: false },
};

export default function HalfCourtPitch() {
  return (
    <iframe
      src="/halfcourt/index.html"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
      title="Red Bull Half Court — Tailgate Edition"
    />
  );
}
