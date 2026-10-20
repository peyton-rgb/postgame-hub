"use client";

// ============================================================
// CardsTable — interactive table for /admin/mobile-app/cards
// Matching prototype screen S["app-cards"].
// Supports drag-and-drop reordering calling reorderCards action,
// delete card action with confirmation, and displays card type,
// status, layout, aspect, visibility, and updated timestamp.
// ============================================================

import { useState } from "react";
import Link from "next/link";
import {
  CARD_SPEC,
  isVideoUrl,
  visibilityLabel,
  type CardRow,
  type Whitelist,
} from "@/lib/admin/mobile-app/types";
import { deleteCard, reorderCards } from "@/app/admin/mobile-app/cards/actions";

interface CardsTableProps {
  initialCards: CardRow[];
  whitelists: Record<string, Whitelist>;
}

function layoutOf(c: CardRow): string {
  if (c.card_type === "strip_banner") return "strip";
  if (isVideoUrl(c.media_url)) return "video_bg";
  if (c.media_url) return "image_bg";
  return "—";
}

function formatUpdated(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function CardsTable({ initialCards, whitelists }: CardsTableProps) {
  const [cards, setCards] = useState<CardRow[]>(initialCards);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDragStart = (idx: number) => {
    setDraggingIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggingIdx === null || draggingIdx === targetIdx) return;

    const updated = [...cards];
    const [moved] = updated.splice(draggingIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setDraggingIdx(targetIdx);
    setCards(updated);
  };

  const handleDragEnd = async () => {
    setDraggingIdx(null);
    const ids = cards.map((c) => c.id);
    setReordering(true);
    setReorderMsg(null);
    try {
      const fd = new FormData();
      fd.append("ids", JSON.stringify(ids));
      const res = await reorderCards(fd);
      if (res.ok) {
        setReorderMsg("Order saved.");
        setTimeout(() => setReorderMsg(null), 3000);
      } else {
        setReorderMsg(res.message);
      }
    } catch {
      setReorderMsg("Failed to save order.");
    } finally {
      setReordering(false);
    }
  };

  const moveCard = async (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= cards.length) return;

    const updated = [...cards];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setCards(updated);

    const ids = updated.map((c) => c.id);
    setReordering(true);
    setReorderMsg(null);
    try {
      const fd = new FormData();
      fd.append("ids", JSON.stringify(ids));
      const res = await reorderCards(fd);
      if (res.ok) {
        setReorderMsg("Order saved.");
        setTimeout(() => setReorderMsg(null), 3000);
      } else {
        setReorderMsg(res.message);
      }
    } catch {
      setReorderMsg("Failed to save order.");
    } finally {
      setReordering(false);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <rect x="13" y="13" width="7" height="7" rx="1.5" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-stone-900">No mobile app cards</h3>
        <p className="mt-1 text-[13px] text-stone-500">
          Create cards to show NIL opportunities, upcoming drops, and banners on the athlete home feed.
        </p>
        <div className="mt-5">
          <Link
            href="/admin/mobile-app/cards/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#D73F09] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#B33407]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Card
          </Link>
        </div>
      </div>
    );
  }

  // Group cards for the display if desired, or show flat order
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {reorderMsg && (
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-[12px] text-stone-600 flex items-center justify-between">
          <span>{reorderMsg}</span>
          {reordering && <span className="text-[#D73F09]">Saving…</span>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              <th className="w-10 px-3 py-3 text-center"></th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Layout</th>
              <th className="px-3 py-3">Aspect</th>
              <th className="px-3 py-3">Visibility</th>
              <th className="px-3 py-3">Updated</th>
              <th className="w-12 px-3 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {cards.map((c, idx) => {
              const spec = CARD_SPEC[c.card_type];
              const isDragging = draggingIdx === idx;
              return (
                <tr
                  key={c.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={
                    "group transition hover:bg-stone-50/60 " +
                    (isDragging ? "bg-amber-50/60 opacity-60" : "")
                  }
                >
                  {/* Grip / reorder handle */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span
                        title="Drag to reorder"
                        className="cursor-grab text-stone-400 hover:text-stone-700 active:cursor-grabbing"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <circle cx="8" cy="6" r="1.5" />
                          <circle cx="16" cy="6" r="1.5" />
                          <circle cx="8" cy="12" r="1.5" />
                          <circle cx="16" cy="12" r="1.5" />
                          <circle cx="8" cy="18" r="1.5" />
                          <circle cx="16" cy="18" r="1.5" />
                        </svg>
                      </span>
                      <div className="hidden sm:inline-flex flex-col opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => moveCard(idx, "up")}
                          disabled={idx === 0 || reordering}
                          aria-label="Move up"
                          className="text-[9px] text-stone-400 hover:text-stone-800 disabled:opacity-20"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCard(idx, "down")}
                          disabled={idx === cards.length - 1 || reordering}
                          aria-label="Move down"
                          className="text-[9px] text-stone-400 hover:text-stone-800 disabled:opacity-20"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/mobile-app/cards/${c.id}`}
                      className="font-medium text-stone-900 hover:text-[#D73F09] hover:underline"
                    >
                      {c.name || "Untitled card"}
                    </Link>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-3 text-stone-700">
                    {spec.label}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3">
                    {c.status === "live" ? (
                      <span className="inline-block rounded-full bg-[#D73F09] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        live
                      </span>
                    ) : c.status === "draft" ? (
                      <span className="inline-block rounded-full bg-[#E9EBEE] px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
                        draft
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-400">
                        archived
                      </span>
                    )}
                  </td>

                  {/* Layout */}
                  <td className="px-3 py-3 font-mono text-[12px] text-stone-600">
                    {layoutOf(c)}
                  </td>

                  {/* Aspect */}
                  <td className="px-3 py-3 font-mono text-[12px] text-stone-600">
                    {spec.aspect}
                  </td>

                  {/* Visibility */}
                  <td className="px-3 py-3 text-[12px] text-stone-500">
                    {visibilityLabel(c, whitelists[c.id])}
                  </td>

                  {/* Updated */}
                  <td className="px-3 py-3 text-[12px] text-stone-500 whitespace-nowrap">
                    {formatUpdated(c.updated_at)}
                  </td>

                  {/* Actions / Delete */}
                  <td className="px-3 py-3 text-right">
                    <form
                      action={deleteCard}
                      onSubmit={(e) => {
                        if (!confirm(`Are you sure you want to delete "${c.name || "this card"}"?`)) {
                          e.preventDefault();
                        } else {
                          setDeletingId(c.id);
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        disabled={deletingId === c.id}
                        title="Delete card"
                        aria-label={`Delete ${c.name || "card"}`}
                        className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-40"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
