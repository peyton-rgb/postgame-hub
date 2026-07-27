// The Postgame mark is a file, never typography.
//
// `ink` picks the variant that reads against the ground the mark sits on:
//   light — white mark, for dark grounds. The default, because every
//           existing consumer sits on black or near-black.
//   dark  — black mark with the orange "+", for light grounds.
//
// Both are served from /public rather than the brand-kit Supabase URLs so a
// core brand mark never depends on a remote fetch. /postgame-logo-black.png
// is byte-identical to the brand kit's logo_dark_url; /postgame-logo-white.png
// is the same white mark as logo_light_url at a size suited to nav/footer use.
export function PostgameLogo({
  className = "",
  size = "sm",
  ink = "light",
}: {
  className?: string;
  size?: "sm" | "md";
  ink?: "light" | "dark";
}) {
  const h = size === "md" ? "h-5 md:h-6" : "h-4 md:h-5";
  const src = ink === "dark" ? "/postgame-logo-black.png" : "/postgame-logo-white.png";
  return (
    <img src={src} className={`${h} object-contain ${className}`} alt="Postgame" />
  );
}
