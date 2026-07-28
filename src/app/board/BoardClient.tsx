"use client";

// ============================================================
// /board — "THE BOARD" v5, wired live to board_tasks (RLS)
//
// Reads the signed-in user's tasks, groups by `section`, renders the
// v5 layout (masthead · docket · filters · sections · cards). Full
// CRUD + a complete-checkbox that moves a task to SHIPPED. Optimistic
// with rollback. Personal board for now; the fetch doesn't assume a
// single user, so team mode is a later widening.
// ============================================================

import "./board-v5.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import {
  SECTIONS,
  FILTERS,
  SHIPPED_KEY,
  sectionForKey,
  matchesFilter,
  isThisWeek,
  POSTGAME_LOGO_URL,
} from "./board-config";
import type { BoardTask, TaskDraft } from "./types";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";
import Docket from "./Docket";

function nowIso() {
  return new Date().toISOString();
}

export default function BoardClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<{ task: BoardTask | null; defaultSection: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("board_tasks")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      setLoadError(error.message || "Could not load your board.");
      setLoading(false);
      return;
    }
    setTasks((data ?? []) as BoardTask[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Grouping + counts ──
  const grouped = useMemo(() => {
    const g: Record<string, BoardTask[]> = {};
    for (const s of SECTIONS) g[s.key] = [];
    for (const t of tasks) g[sectionForKey(t.section)].push(t);
    return g;
  }, [tasks]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      week: tasks.filter(isThisWeek).length,
      you: tasks.filter((t) => t.court === "You" || t.court === "You + me").length,
      hub: tasks.filter((t) => (t.lane || "").toUpperCase() === "BUILD").length,
      content: tasks.filter((t) => (t.lane || "").toUpperCase() === "CONTENT").length,
    }),
    [tasks]
  );

  // ── Complete toggle (→ shipped, or reopen → ready) ──
  async function handleToggleDone(task: BoardTask) {
    const wasShipped = sectionForKey(task.section) === SHIPPED_KEY;
    const nextSection = wasShipped ? "ready" : SHIPPED_KEY;
    const ts = nowIso();
    const prev = tasks;
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, section: nextSection, updated_at: ts } : t)));

    const { error } = await supabase
      .from("board_tasks")
      .update({ section: nextSection, updated_at: ts })
      .eq("id", task.id);
    if (error) {
      setTasks(prev);
      setActionError("Couldn't update that task — reverted. " + error.message);
    }
  }

  // ── Create / edit ──
  async function handleSave(draft: TaskDraft) {
    setSaving(true);
    setActionError(null);
    const editing = modal?.task ?? null;
    try {
      if (editing) {
        const ts = nowIso();
        const sectionChanged = sectionForKey(editing.section) !== draft.section;
        const patch: Record<string, unknown> = {
          title: draft.title,
          detail: draft.detail || null,
          lane: draft.lane,
          priority: draft.priority,
          section: draft.section,
          court: draft.court || null,
          timing: draft.timing || null,
          next_step: draft.next_step || null,
          due_date: draft.due_date,
          source: draft.source || null,
          source_url: draft.source_url || null,
          is_agent: draft.is_agent,
          updated_at: ts,
        };
        if (sectionChanged) {
          patch.sort_order = grouped[draft.section]?.length ?? 0;
        }
        const { data, error } = await supabase
          .from("board_tasks")
          .update(patch)
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;
        const updated = data as BoardTask;
        setTasks((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const sortOrder = grouped[draft.section]?.length ?? 0;
        const { data, error } = await supabase
          .from("board_tasks")
          .insert({
            user_id: userId,
            title: draft.title,
            detail: draft.detail || null,
            lane: draft.lane,
            priority: draft.priority,
            status: draft.section, // keep legacy status column populated/non-null
            section: draft.section,
            court: draft.court || null,
            timing: draft.timing || null,
            next_step: draft.next_step || null,
            due_date: draft.due_date,
            source: draft.source || null,
            source_url: draft.source_url || null,
            is_agent: draft.is_agent,
            sort_order: sortOrder,
          })
          .select()
          .single();
        if (error) throw error;
        setTasks((list) => [...list, data as BoardTask]);
      }
      setModal(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Something went wrong saving that task.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──
  async function handleDelete(task: BoardTask) {
    setSaving(true);
    setActionError(null);
    const prev = tasks;
    setTasks((list) => list.filter((t) => t.id !== task.id));
    setModal(null);
    const { error } = await supabase.from("board_tasks").delete().eq("id", task.id);
    if (error) {
      setTasks(prev);
      setActionError("Couldn't delete that task — restored. " + error.message);
    }
    setSaving(false);
  }

  const today = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

  return (
    <div className="tb">
      <div className="wrap">
        {/* Masthead */}
        <div className="mh">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={POSTGAME_LOGO_URL} alt="Postgame" />
          <div className="mh-actions">
            <div className="mh-meta">
              <b>Internal Operations</b>
              <br />
              {counts.all} open · {today}
            </div>
            <button className="addbtn" onClick={() => setModal({ task: null, defaultSection: "you" })}>
              + Add
            </button>
          </div>
        </div>

        {/* Head */}
        <div className="head">
          <div className="eyebrow">Operations Board</div>
          <h1>THE BOARD</h1>
          <div className="subline">
            <span className="live">
              <i />
              Live view
            </span>
            &nbsp;·&nbsp; Slack / Gmail / Calendar / Asana / Build threads
          </div>
        </div>

        {actionError && (
          <div className="board-banner">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {/* Docket */}
        <Docket />

        {/* Filters */}
        <div className="filters">
          {FILTERS.map((f) => (
            <div
              key={f.key}
              className={`chip${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilter(f.key);
                }
              }}
            >
              {f.label}
              <span className="n">{counts[f.key as keyof typeof counts]}</span>
            </div>
          ))}
        </div>

        {/* Board */}
        {loading ? (
          <div className="board-loading">Loading your board…</div>
        ) : loadError ? (
          <div className="board-error">
            <div>{loadError}</div>
            <button className="retry" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          SECTIONS.map((s) => {
            const items = grouped[s.key].filter((t) => matchesFilter(t, filter));
            if (items.length === 0 && filter !== "all") return null;
            const cnt = String(items.length).padStart(2, "0");
            return (
              <div className="sec" key={s.key}>
                <div className={`sec-h${s.accent ? " accent" : ""}`}>
                  <span className="num">{s.num}</span>
                  <h2>{s.title}</h2>
                  <span className="c">{cnt}</span>
                  <span className="rule" />
                </div>
                {items.length === 0 ? (
                  <div className="sec-empty">Nothing here yet.</div>
                ) : (
                  items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onToggleDone={handleToggleDone}
                      onEdit={(task) => setModal({ task, defaultSection: s.key })}
                    />
                  ))
                )}
              </div>
            );
          })
        )}

        {/* Footer */}
        <div className="foot">
          <div className="mono">Postgame Internal · Not for distribution</div>
          <b>Live board.</b> Tasks, sections, and priority stamps read straight from Supabase. The docket pulls
          your Google Calendar for the next two weeks. The <b>Deploy Agent</b> button is a Phase-3 preview.
        </div>
      </div>

      {modal && (
        <TaskModal
          task={modal.task}
          defaultSection={modal.defaultSection}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
