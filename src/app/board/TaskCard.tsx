"use client";

// ============================================================
// /board — v5 task card
// ============================================================

import { useState } from "react";
import type { BoardTask } from "./types";
import { daysUntil, isHot, sourceKey, SOURCE_LABEL, SHIPPED_KEY } from "./board-config";
import { SOURCE_ICON, CheckIcon, BoltIcon } from "./icons";

export default function TaskCard({
  task,
  onToggleDone,
  onEdit,
}: {
  task: BoardTask;
  onToggleDone: (task: BoardTask) => void;
  onEdit: (task: BoardTask) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deployMsg, setDeployMsg] = useState(false);

  const du = daysUntil(task.due_date);
  const soon = du !== null && du >= 0 && du <= 4;
  const overdue = du !== null && du < 0;
  const done = (task.section || "") === SHIPPED_KEY;

  const sk = sourceKey(task.source);
  const icon = SOURCE_ICON[sk];
  const label = SOURCE_LABEL[sk];

  const cls = ["card", soon || overdue ? "duesoon" : "", done ? "done" : "", open ? "open" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      {overdue && (
        <div className="stamp">
          <span className="rd" />
          Overdue
        </div>
      )}
      {!overdue && soon && (
        <div className="stamp">
          <span className="rd" />
          Due {du === 0 ? "today" : du === 1 ? "tomorrow" : `${du} days`}
        </div>
      )}

      <div
        className="check"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "Reopen task" : "Mark task done"}
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(task);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleDone(task);
          }
        }}
      >
        {CheckIcon}
      </div>

      <div className="cbody" onClick={() => setOpen((o) => !o)}>
        <div className="ctitle">{task.title}</div>
        {task.detail && <div className="cctx">{task.detail}</div>}
        <div className="tags">
          {task.court && <span className="tag">{task.court}</span>}
          {task.timing && <span className={`tag ${isHot(task.priority) ? "hot" : ""}`}>{task.timing}</span>}

          {task.source_url ? (
            <a
              className="srclink"
              href={task.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {icon}
              {label}
              <span className="ext">↗</span>
            </a>
          ) : (
            <span className="srclink nolink">
              {icon}
              {label}
            </span>
          )}

          {task.is_agent && (
            <button
              className={`deploy${deployMsg ? " queued" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (deployMsg) return;
                setDeployMsg(true);
                setTimeout(() => setDeployMsg(false), 1900);
              }}
            >
              {deployMsg ? (
                "Phase 3 — not wired yet"
              ) : (
                <>
                  {BoltIcon}
                  Deploy Agent
                </>
              )}
            </button>
          )}
        </div>

        {task.next_step && (
          <div className="next">
            <div className="al">
              <span className="lab">Next Action</span>
              {task.next_step}
            </div>
          </div>
        )}
      </div>

      <button
        className="card-edit"
        aria-label="Edit task"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(task);
        }}
      >
        Edit
      </button>
    </div>
  );
}
