import { RunOfShow } from "@/components/RunOfShow";
import { getShoot } from "@/lib/run-of-show-data";
import type { Metadata } from "next";

const shoot = getShoot("denver")!;

export const metadata: Metadata = {
  title: `${shoot.city} — Run of Show | Postgame x Raising Cane's`,
  description: `Run of show for ${shoot.parade} — ${shoot.date}`,
};

export default function DenverRunOfShow() {
  return <RunOfShow shoot={shoot} />;
}
