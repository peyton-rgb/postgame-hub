// Red Bull Tailgate — Half Court, Tailgate Edition pitch (static site served from /public/redbull-tailgate)
// Pattern mirrors the halfcourt iframe embed. Unlisted: linked nowhere, noindex on the page itself.
export const metadata = {
  title: "Red Bull Tailgate — Half Court, Tailgate Edition",
  robots: { index: false, follow: false },
};

export default function RedBullTailgatePitch() {
  return (
    <iframe
      src="/redbull-tailgate/index.html"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
      title="Red Bull Tailgate — Half Court, Tailgate Edition"
    />
  );
}
