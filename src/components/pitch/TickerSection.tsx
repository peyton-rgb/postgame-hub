import type { TickerSectionData } from "@/types/pitch";
import BrandCarousel from "@/components/BrandCarousel";

export default function TickerSection({ data }: { data: TickerSectionData }) {
  if (!data.visible) return null;
  return <BrandCarousel items={data.items} />;
}
