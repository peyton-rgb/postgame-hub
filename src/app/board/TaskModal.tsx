"use client";

// ============================================================
// /board — v5 add / edit / delete modal (all fields)
// ============================================================

import { useEffect, useState } from "react";
import type { BoardTask, TaskDraft } from "./types";
import { SECTIONS, LANES, COURTS, SOURCE_KEYS, SOURCE_LABEL, sectionForKey } from "./board-config";

const PRIORITIES = ["urgent", "high", "normal", "low"];

export default function TaskModal({
  task,
  defaultSection,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  task: BoardTask | null;
  defaultSection: string;
  saving: boolean;
  onSave: (draft: TaskDraft) => void;
  onDelete: (task: BoardTask) => void;
  onClose: () => void;
}) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [detail, setDetail] = useState(task?.detail ?? "");
  const [section, setSection] = useState(task ? sectionForKey(task.section) : defaultSection);
  const [court, setCourt] = useState(task?.court ?? "You");
  const [timing, setTiming] = useState(task?.timing ?? "");
  const [nextStep, setNextStep] = useState(task?.next_step ?? "");
  const [lane, setLane] = useState((task?.lane ?? "BUILD").toUpperCase());
  const [priority, setPriority] = useState((task?.priority ?? "normal").toLowerCase());
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [source, setSource] = useState(task?.source ?? "");
  const [sourceUrl, setSourceUrl] = useState(task?.source_url ?? "");
  const [isAgent, setIsAgent] = useState(!!task?.is_agent);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
      section,
      court,
      timing: timing.trim(),
      next_step: nextStep.trim(),
      due_date: dueDate || null,
      source: source.trim(),
      source_url: sourceUrl.trim(),
      is_agent: isAgent,
    });
  }

  return (
    <div
      className="tb-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tb-modal" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit task" : "New task"}>
        <h2>{isEdit ? "Edit Task" : "New Task"}</h2>

        <label className="tb-label">Title</label>
        <input
          autoFocus
          className="tb-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it?"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />

        <label className="tb-label">Context</label>
        <textarea
          className="tb-input"
          rows={2}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="One line of background…"
          style={{ resize: "none" }}
        />

        <label className="tb-label">Next action</label>
        <textarea
          className="tb-input"
          rows={2}
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="The concrete next step…"
          style={{ resize: "none" }}
        />

        <div className="tb-row">
          <div>
            <label className="tb-label">Section</label>
            <select className="tb-input" value={section} onChange={(e) => setSection(e.target.value)}>
              {SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tb-label">Court</label>
            <select className="tb-input" value={court} onChange={(e) => setCourt(e.target.value)}>
              {COURTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tb-row">
          <div>
            <label className="tb-label">Timing label</label>
            <input
              className="tb-input"
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
              placeholder="Ready now, Blocked, No date…"
            />
          </div>
          <div>
            <label className="tb-label">Due date</label>
            <input type="date" className="tb-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <label className="tb-label">Lane</label>
        <div className="tb-chips">
          {LANES.map((l) => (
            <button key={l} className={`tb-pick${lane === l ? " on" : ""}`} onClick={() => setLane(l)}>
              {l}
            </button>
          ))}
        </div>

        <label className="tb-label">Priority</label>
        <div className="tb-chips">
          {PRIORITIES.map((p) => (
            <button key={p} className={`tb-pick${priority === p ? " on" : ""}`} onClick={() => setPriority(p)}>
              {p}
            </button>
          ))}
        </div>

        <div className="tb-row">
          <div>
            <label className="tb-label">Source</label>
            <select className="tb-input" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">None</option>
              {SOURCE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SOURCE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tb-label">Source link</label>
            <input
              className="tb-input"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <label className="tb-label">Agent flag</label>
        <div className="tb-chips">
          <button className={`tb-pick${isAgent ? " on" : ""}`} onClick={() => setIsAgent((v) => !v)}>
            {isAgent ? "AGENT ✓" : "Mark as agent-runnable"}
          </button>
        </div>

        <div className="tb-modal-actions">
          {isEdit &&
            (confirmDelete ? (
              <button className="tb-btn danger-solid" disabled={saving} onClick={() => onDelete(task!)}>
                Confirm delete
              </button>
            ) : (
              <button className="tb-btn danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            ))}
          <button className="tb-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="tb-btn primary" disabled={!canSave} onClick={submit}>
            {saving ? "Saving…" : isEdit ? "Save" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}
