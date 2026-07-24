"use client";

// ============================================================
// /board — add / edit task modal
//
// One modal serves both create (task === null) and edit. Delete lives
// here too, behind a confirm step. Returns a TaskDraft to the parent,
// which owns all Supabase writes + optimistic state.
// ============================================================

import { useEffect, useState } from "react";
import type { BoardTask, TaskDraft } from "./types";
import { COLUMNS, LANES, PRIORITIES, columnForStatus, laneStyle, priorityStyle } from "./board-config";

export default function TaskModal({
  task,
  defaultStatus,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  task: BoardTask | null;
  defaultStatus: string;
  saving: boolean;
  onSave: (draft: TaskDraft) => void;
  onDelete: (task: BoardTask) => void;
  onClose: () => void;
}) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [detail, setDetail] = useState(task?.detail ?? "");
  const [lane, setLane] = useState((task?.lane ?? "BUILD").toUpperCase());
  const [priority, setPriority] = useState((task?.priority ?? "normal").toLowerCase());
  const [status, setStatus] = useState<string>(task ? columnForStatus(task.status) : defaultStatus);
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = title.trim().length > 0 && !saving;

  function submit() {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      detail: detail.trim(),
      lane,
      priority,
      status,
      due_date: dueDate ? dueDate : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[10000] grid place-items-center p-4"
      style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] rounded-3xl p-6 pg-board-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit task" : "New task"}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="d text-[24px] text-white tracking-wide">{isEdit ? "Edit Task" : "New Task"}</h2>
          <button onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white text-2xl leading-none">
            ×
          </button>
        </div>

        <label className="pg-board-label">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="What needs doing?"
          className="pg-board-input"
        />

        <label className="pg-board-label mt-3">Detail</label>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Notes, context, links…"
          rows={3}
          className="pg-board-input resize-none"
        />

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="pg-board-label">Column</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="pg-board-input">
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="pg-board-label">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="pg-board-input" />
          </div>
        </div>

        <div className="mt-3">
          <label className="pg-board-label">Lane</label>
          <div className="flex gap-2">
            {LANES.map((l) => {
              const s = laneStyle(l);
              const active = lane === l;
              return (
                <button
                  key={l}
                  onClick={() => setLane(l)}
                  className="flex-1 text-[12px] font-semibold uppercase tracking-wide py-2 rounded-lg transition"
                  style={{
                    color: active ? s.color : "rgba(255,255,255,0.5)",
                    background: active ? s.bg : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? s.border : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <label className="pg-board-label">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => {
              const s = priorityStyle(p);
              const active = priority === p;
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="flex-1 text-[12px] font-semibold capitalize py-2 rounded-lg transition"
                  style={{
                    color: active ? s.color : "rgba(255,255,255,0.5)",
                    background: active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? s.accent : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          {isEdit &&
            (confirmDelete ? (
              <div className="flex items-center gap-2 mr-auto">
                <button
                  onClick={() => onDelete(task!)}
                  disabled={saving}
                  className="text-[13px] font-semibold text-white px-3 py-2 rounded-lg"
                  style={{ background: "#c0281a" }}
                >
                  Confirm delete
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-[13px] text-white/50 hover:text-white">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="mr-auto text-[13px] text-white/45 hover:text-[#ff6b6b] transition"
              >
                Delete
              </button>
            ))}
          <button onClick={onClose} className="text-[13px] text-white/55 hover:text-white px-3 py-2">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSave}
            className="text-[13px] font-semibold text-white px-4 py-2 rounded-lg transition disabled:opacity-40"
            style={{ background: "var(--orange)" }}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}
