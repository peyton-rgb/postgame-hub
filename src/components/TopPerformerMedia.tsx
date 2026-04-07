"use client";

import type { Media } from "@/lib/types";
import { supabaseImageUrl } from "@/lib/supabase-image";

export function TopPerformerMedia({ items, name }: { items: Media[]; name: string }) {
  // Show only the first image — prefer thumbnail, then image file, then fall back to first image in set
  const first = items[0];
  const firstImage = items.find((m) => m.type === "image");
  const displaySrc = first?.thumbnail_url || (first?.type !== "video" ? first?.file_url : firstImage?.file_url ?? null);

  if (!displaySrc) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <span className="text-[10px] text-white/20 font-bold uppercase">No content</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <img
        src={supabaseImageUrl(displaySrc, 1200) ?? displaySrc}
        className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast]"
        draggable={false}
        alt={name}
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src.includes("/render/image/public/")) {
            img.src = img.src.replace("/render/image/public/", "/object/public/").split("?")[0];
          }
        }}
      />
    </div>
  );
}
