"use client";

// ============================================================
// /board — a single draggable task card
// ============================================================

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardTask } from "./types";
import { laneStyle, priorityStyle } from "./board-config";

function formatDue(due: string | null): { text: string; overdue: boolean; soon: boolean } | null {
  if (!due) return null;
  // Parse yyyy-mm-dd as a local date (avoid UTC shift).
  const [y, m, d] = due.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
  const text = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { text, overdue: diffDays < 0, soon: diffDays >= 0 && diffDays <= 2 };
}

export default function TaskCard({
  task,
  onOpen,
  overlay = false,
}: {
  task: BoardTask;
  onOpen?: (task: BoardTask) => void;
  overlay?: boolean;
}) {
  const sortable = useSortable({ id: task.id, disabled: overlay });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const lane = laneStyle(task.lane);
  const prio = priorityStyle(task.priority);
  const due = formatDue(task.due_date);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.35 : 1,
    borderLeft: `3px solid ${prio.accent}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(task)}
      className={`pg-board-card group ${overlay ? "pg-board-card--overlay" : ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen?.(task);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[11px] font-semibold tracking-wide uppercase px-2 py-[3px] rounded-full"
          style={{ color: lane.color, background: lane.bg, border: `1px solid ${lane.border}` }}
        >
          {lane.label}
        </span>
        {task.priority && task.priority.toLowerCase() !== "normal" && (
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: prio.color }}>
            {prio.label}
          </span>
        )}
      </div>

      <p className="mt-2 text-[14px] leading-snug text-white font-medium">{task.title}</p>

      {task.detail && (
        <p className="mt-1 text-[12px] leading-snug text-white/45 line-clamp-2">{task.detail}</p>
      )}

      {(due || task.source_url) && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {due && (
            <span
              className="text-[11px] px-2 py-[2px] rounded-md"
              style={{
                color: due.overdue ? "#ff6b6b" : due.soon ? "#ff9f45" : "rgba(255,255,255,0.5)",
                background: due.overdue ? "rgba(255,77,77,0.12)" : "rgba(255,255,255,0.05)",
              }}
            >
              {due.overdue ? "⚠ " : ""}
              {due.text}
            </span>
          )}
          {task.source_url && (
            <a
              href={task.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-white/40 hover:text-[color:var(--orange)] underline decoration-white/20"
            >
              {task.source || "link"} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
