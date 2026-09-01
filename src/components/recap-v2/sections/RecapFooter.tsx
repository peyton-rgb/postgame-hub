// Footer always renders — it is the page's floor and carries attribution.
import type { Campaign } from "@/lib/types";
import { PostgameLogo } from "@/components/PostgameLogo";

export function RecapFooter({ campaign }: { campaign: Campaign }) {
  const line = [
    campaign.name,
    campaign.client_name ? `Prepared for ${campaign.client_name}` : null,
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  return (
    <footer
      data-recap-v2="footer"
      className="flex flex-wrap items-center justify-between gap-6 border-t border-[color:var(--rv-line)] px-[var(--gutter)] pb-[var(--s5)] pt-[var(--s4)]"
    >
      <PostgameLogo size="sm" />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--rv-dim2)]">
        {line.join(" · ")}
      </span>
    </footer>
  );
}
