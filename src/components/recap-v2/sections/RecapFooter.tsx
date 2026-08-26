// Footer always renders — it is the page's floor and carries attribution.
import type { Campaign } from "@/lib/types";

export function RecapFooter({ campaign }: { campaign: Campaign }) {
  const parts = [campaign.name, campaign.client_name ? `Prepared for ${campaign.client_name}` : null]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return (
    <footer data-recap-v2="footer">
      <p>{parts.join(" · ")}</p>
    </footer>
  );
}
