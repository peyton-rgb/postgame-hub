"use client";

// ============================================================
// /board — a single kanban column (droppable + sortable list)
// ============================================================

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { BoardTask } from "./types";
import type { ColumnKey } from "./board-config";
import TaskCard from "./TaskCard";

export default function TaskColumn({
  columnKey,
  label,
  tasks,
  onOpenTask,
  onAdd,
}: {
  columnKey: ColumnKey;
  label: string;
  tasks: BoardTask[];
  onOpenTask: (task: BoardTask) => void;
  onAdd: (columnKey: ColumnKey) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });

  return (
    <div className="pg-board-col flex flex-col min-w-[280px] w-[280px] flex-shrink-0">
      <div className="flex items-center justify-between px-1 pb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="d text-[19px] leading-none text-white/90 tracking-wide">{label}</h2>
          <span className="text-[12px] text-white/35 tabular-nums">{tasks.length}</span>
        </div>
        <button
          onClick={() => onAdd(columnKey)}
          aria-label={`Add task to ${label}`}
          className="w-6 h-6 grid place-items-center rounded-md text-white/45 hover:text-white hover:bg-white/10 transition"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={`pg-board-dropzone flex-1 rounded-2xl p-2 flex flex-col gap-2 transition-colors ${
          isOver ? "pg-board-dropzone--over" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={onOpenTask} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <button
            onClick={() => onAdd(columnKey)}
            className="flex-1 min-h-[80px] w-full rounded-xl border border-dashed border-white/10 text-white/25 text-[12px] hover:border-white/20 hover:text-white/40 transition grid place-items-center"
          >
            Drop here or + add
          </button>
        )}
      </div>
    </div>
  );
}
