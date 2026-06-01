"use client";

import { usePathname } from "next/navigation";
import { ORANGE } from "@/lib/portal";

// Tab nav for the portal's private frame. Highlights the active tab in brand
// orange. Rendered inside the portal layout (which supplies the brand logo).
export default function PortalNav({ token }: { token: string }) {
  const pathname = usePathname();
  const base = `/portal/${token}`;
  const tabs = [
    { label: "Home", href: base },
    { label: "Media Library", href: `${base}/library` },
  ];

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  return (
    <nav className="flex items-center gap-6">
      {tabs.map((t) => {
        const active = isActive(t.href);
        return (
          <a
            key={t.href}
            href={t.href}
            className="relative text-[12px] font-bold uppercase tracking-[2px] py-1 transition-colors"
            style={{ color: active ? ORANGE : "rgba(255,255,255,0.55)" }}
          >
            {t.label}
            {active ? (
              <span
                className="absolute left-0 right-0 -bottom-[3px] h-[2px] rounded-full"
                style={{ background: ORANGE }}
              />
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
