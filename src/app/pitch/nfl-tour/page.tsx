// NFL Tour — "The Pop Out" pitch (static site served from /public/nfl-tour)
// Pattern mirrors the redbull-tailgate iframe embed. Unlisted: linked nowhere, noindex on the page itself.
export const metadata = {
  title: "The Pop Out — NFL Tour | Postgame × CBFWA × The Journey Media",
  robots: { index: false, follow: false },
};

export default function NflTourPitch() {
  return (
    <iframe
      src="/nfl-tour/index.html"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
      title="The Pop Out — NFL Tour"
    />
  );
}
