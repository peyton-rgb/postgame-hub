export function PostgameLogo({ className = "", size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  const h = size === "md" ? "h-7 md:h-9" : "h-5 md:h-6";
  return (
    <img src="/postgame-logo.svg" className={`${h} object-contain ${className}`} alt="Postgame" />
  );
}
