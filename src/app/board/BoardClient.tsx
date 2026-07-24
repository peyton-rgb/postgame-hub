"use client";

// ============================================================
// /board — interactive personal task manager
//
// Source of truth:
//   taskById  — id → BoardTask (the row data)
//   groups    — ColumnKey → ordered id[] (column membership + order)
//
// All reads/writes go through createBrowserSupabase() (cookie session,
// RLS "own tasks"). Drag persists status + sort_order; create/edit/delete
// are optimistic with rollback on error.
//
// v1 = personal board. Widening to a team later means changing the fetch
// filter + an RLS policy — the render/DnD layer here doesn't assume one user.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { createBrowserSupabase } from "@/lib/supabase";
import { PostgameLogo } from "@/components/PostgameLogo";
import {
  COLUMNS,
  COLUMN_KEYS,
  LANES,
  columnForStatus,
  statusForColumn,
  laneStyle,
  type ColumnKey,
  type Lane,
} from "./board-config";
import type { BoardTask, TaskDraft } from "./types";
import TaskCard from "./TaskCard";
import TaskColumn from "./TaskColumn";
import TaskModal from "./TaskModal";

type Groups = Record<ColumnKey, string[]>;

function emptyGroups(): Groups {
  return COLUMN_KEYS.reduce((acc, k) => {
    acc[k] = [];
    return acc;
  }, {} as Groups);
}

function nowIso() {
  return new Date().toISOString();
}

export default function BoardClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [taskById, setTaskById] = useState<Record<string, BoardTask>>({});
  const [groups, setGroups] = useState<Groups>(emptyGroups());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [laneFilter, setLaneFilter] = useState<"ALL" | Lane>("ALL");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Modal state: 'new' + a default column, or an existing task, or null.
  const [modal, setModal] = useState<{ task: BoardTask | null; defaultStatus: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Snapshot for drag rollback.
  const dragSnapshot = useRef<{ groups: Groups; taskById: Record<string, BoardTask> } | null>(null);

  // ── Load ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("board_tasks")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      setLoadError(error.message || "Could not load your tasks.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as BoardTask[];
    const byId: Record<string, BoardTask> = {};
    const g = emptyGroups();
    for (const row of rows) {
      byId[row.id] = row;
      g[columnForStatus(row.status)].push(row.id);
    }
    setTaskById(byId);
    setGroups(g);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived: visible ids per column (lane filter) ─────
  const laneMatches = useCallback(
    (id: string) => {
      if (laneFilter === "ALL") return true;
      return (taskById[id]?.lane || "").toUpperCase() === laneFilter;
    },
    [laneFilter, taskById]
  );

  const visibleGroups = useMemo(() => {
    const out = emptyGroups();
    for (const key of COLUMN_KEYS) {
      out[key] = groups[key].filter(laneMatches);
    }
    return out;
  }, [groups, laneMatches]);

  const columnOfId = useCallback(
    (id: string): ColumnKey | null => {
      for (const key of COLUMN_KEYS) {
        if (groups[key].includes(id)) return key;
      }
      return null;
    },
    [groups]
  );

  // ── Sensors ───────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Drag handlers ─────────────────────────────────────
  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    dragSnapshot.current = { groups, taskById };
  }

  function resolveOverColumn(overId: string): ColumnKey | null {
    if ((COLUMN_KEYS as string[]).includes(overId)) return overId as ColumnKey;
    return columnOfId(overId);
  }

  // Move active card into the column it is hovering, live (cross-column only).
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const from = columnOfId(activeIdStr);
    const to = resolveOverColumn(overIdStr);
    if (!from || !to || from === to) return;

    setGroups((prev) => {
      const source = prev[from].filter((x) => x !== activeIdStr);
      const dest = [...prev[to]];
      const overIdx = dest.indexOf(overIdStr);
      const insertAt = overIdx >= 0 ? overIdx : dest.length;
      dest.splice(insertAt, 0, activeIdStr);
      return { ...prev, [from]: source, [to]: dest };
    });
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    const snapshot = dragSnapshot.current;
    dragSnapshot.current = null;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const from = columnOfId(activeIdStr);
    const to = resolveOverColumn(overIdStr);
    if (!from || !to) return;

    // Final reorder within the destination column.
    let finalGroups = groups;
    if (from === to && overIdStr !== to) {
      const col = groups[to];
      const oldIndex = col.indexOf(activeIdStr);
      const newIndex = col.indexOf(overIdStr);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        finalGroups = { ...groups, [to]: arrayMove(col, oldIndex, newIndex) };
        setGroups(finalGroups);
      }
    }

    // Reindex every column. A cross-column move (already applied in dragOver)
    // leaves a gap in the source column's sort_order, so re-number all of them;
    // persistOrder only writes the rows that actually changed.
    await persistOrder(finalGroups, COLUMN_KEYS, snapshot);
  }

  // Reindex sort_order for the affected columns, writing only rows that
  // actually changed. `status` is rewritten to the canonical column slug ONLY
  // for a card that changed columns — a plain within-column reorder updates
  // sort_order alone and preserves the existing (possibly legacy) status
  // string, so we don't collapse legacy labels on every drag.
  async function persistOrder(
    nextGroups: Groups,
    affected: ColumnKey[],
    snapshot: { groups: Groups; taskById: Record<string, BoardTask> } | null
  ) {
    const updates: { id: string; sort_order: number; status?: string }[] = [];
    const nextById = { ...taskById };
    const ts = nowIso();

    for (const col of affected) {
      nextGroups[col].forEach((id, idx) => {
        const t = taskById[id];
        if (!t) return;
        const columnChanged = columnForStatus(t.status) !== col;
        if (t.sort_order !== idx || columnChanged) {
          const update: { id: string; sort_order: number; status?: string } = {
            id,
            sort_order: idx,
          };
          if (columnChanged) update.status = statusForColumn(col);
          updates.push(update);
          nextById[id] = {
            ...t,
            sort_order: idx,
            status: columnChanged ? statusForColumn(col) : t.status,
            updated_at: ts,
          };
        }
      });
    }

    if (updates.length === 0) return;
    setTaskById(nextById); // optimistic

    const results = await Promise.all(
      updates.map((u) => {
        const patch: Record<string, unknown> = { sort_order: u.sort_order, updated_at: ts };
        if (u.status !== undefined) patch.status = u.status;
        return supabase.from("board_tasks").update(patch).eq("id", u.id);
      })
    );

    const failed = results.find((r) => r.error);
    if (failed?.error && snapshot) {
      setGroups(snapshot.groups);
      setTaskById(snapshot.taskById);
      setActionError("Couldn't save that move — reverted. " + failed.error.message);
    }
  }

  // ── Create / edit / delete ────────────────────────────
  async function handleSave(draft: TaskDraft) {
    setSaving(true);
    setActionError(null);
    const editing = modal?.task ?? null;

    try {
      if (editing) {
        const targetCol = columnForStatus(draft.status);
        const prevCol = columnOfId(editing.id);
        const movedColumn = !!prevCol && prevCol !== targetCol;
        const ts = nowIso();
        const patch: Record<string, unknown> = {
          title: draft.title,
          detail: draft.detail || null,
          lane: draft.lane,
          priority: draft.priority,
          status: statusForColumn(targetCol),
          due_date: draft.due_date,
          updated_at: ts,
        };
        // Moving columns via the edit form → drop it at the end of the target
        // column so the persisted sort_order matches what the user sees.
        if (movedColumn) patch.sort_order = groups[targetCol].length;

        const { data, error } = await supabase
          .from("board_tasks")
          .update(patch)
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;

        const updated = data as BoardTask;
        setTaskById((m) => ({ ...m, [updated.id]: updated }));
        if (movedColumn && prevCol) {
          setGroups((g) => ({
            ...g,
            [prevCol]: g[prevCol].filter((x) => x !== updated.id),
            [targetCol]: [...g[targetCol], updated.id],
          }));
        }
      } else {
        const targetCol = columnForStatus(draft.status);
        const sortOrder = groups[targetCol].length; // end of target column
        const { data, error } = await supabase
          .from("board_tasks")
          .insert({
            user_id: userId,
            title: draft.title,
            detail: draft.detail || null,
            lane: draft.lane,
            priority: draft.priority,
            status: statusForColumn(targetCol),
            due_date: draft.due_date,
            sort_order: sortOrder,
          })
          .select()
          .single();
        if (error) throw error;

        const created = data as BoardTask;
        setTaskById((m) => ({ ...m, [created.id]: created }));
        setGroups((g) => ({ ...g, [targetCol]: [...g[targetCol], created.id] }));
      }
      setModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong saving that task.";
      setActionError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(task: BoardTask) {
    setSaving(true);
    setActionError(null);
    // Optimistic remove with rollback.
    const prevGroups = groups;
    const prevById = taskById;
    const col = columnOfId(task.id);
    setGroups((g) => (col ? { ...g, [col]: g[col].filter((x) => x !== task.id) } : g));
    setTaskById((m) => {
      const next = { ...m };
      delete next[task.id];
      return next;
    });
    setModal(null);

    const { error } = await supabase.from("board_tasks").delete().eq("id", task.id);
    if (error) {
      setGroups(prevGroups);
      setTaskById(prevById);
      setActionError("Couldn't delete that task — restored. " + error.message);
    }
    setSaving(false);
  }

  const activeTask = activeId ? taskById[activeId] : null;
  const totalVisible = COLUMN_KEYS.reduce((n, k) => n + visibleGroups[k].length, 0);

  // ── Render ────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-8 h-16"
        style={{
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "var(--blur)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <PostgameLogo size="sm" />
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="d text-[22px] tracking-wide text-white">Board</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Lane filter */}
          <div className="hidden sm:flex items-center gap-1 mr-1">
            <FilterChip active={laneFilter === "ALL"} onClick={() => setLaneFilter("ALL")} label="All" />
            {LANES.map((l) => {
              const s = laneStyle(l);
              return (
                <FilterChip
                  key={l}
                  active={laneFilter === l}
                  onClick={() => setLaneFilter(l)}
                  label={l}
                  color={s.color}
                  bg={s.bg}
                  border={s.border}
                />
              );
            })}
          </div>
          <button
            onClick={() => setModal({ task: null, defaultStatus: "to_do" })}
            className="text-[13px] font-semibold text-white px-3.5 py-2 rounded-lg transition hover:brightness-110"
            style={{ background: "var(--orange)" }}
          >
            + Add task
          </button>
        </div>
      </header>

      {/* Errors */}
      {actionError && (
        <div className="mx-5 md:mx-8 mt-3 flex items-center justify-between gap-3 text-[13px] rounded-lg px-3 py-2"
          style={{ background: "rgba(255,77,77,0.12)", border: "1px solid rgba(255,77,77,0.3)", color: "#ffb4b4" }}>
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-white/50 hover:text-white">×</button>
        </div>
      )}

      {/* Mobile lane filter */}
      <div className="sm:hidden flex items-center gap-1 px-5 pt-3 overflow-x-auto">
        <FilterChip active={laneFilter === "ALL"} onClick={() => setLaneFilter("ALL")} label="All" />
        {LANES.map((l) => {
          const s = laneStyle(l);
          return (
            <FilterChip key={l} active={laneFilter === l} onClick={() => setLaneFilter(l)} label={l} color={s.color} bg={s.bg} border={s.border} />
          );
        })}
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid place-items-center py-32 text-white/40">
          <div className="pg-board-spinner" />
          <p className="mt-3 text-[13px]">Loading your board…</p>
        </div>
      ) : loadError ? (
        <div className="grid place-items-center py-32 text-center">
          <p className="text-white/70 text-[15px]">{loadError}</p>
          <button
            onClick={load}
            className="mt-4 text-[13px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: "var(--orange)", color: "#fff" }}
          >
            Retry
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            const snap = dragSnapshot.current;
            if (snap) {
              setGroups(snap.groups);
              setTaskById(snap.taskById);
            }
            dragSnapshot.current = null;
            setActiveId(null);
          }}
        >
          <div className="flex gap-4 px-5 md:px-8 py-5 overflow-x-auto items-start" style={{ minHeight: "calc(100vh - 8rem)" }}>
            {COLUMNS.map((c) => (
              <TaskColumn
                key={c.key}
                columnKey={c.key}
                label={c.label}
                tasks={visibleGroups[c.key].map((id) => taskById[id]).filter(Boolean)}
                onOpenTask={(t) => setModal({ task: t, defaultStatus: c.key })}
                onAdd={(colKey) => setModal({ task: null, defaultStatus: colKey })}
              />
            ))}
          </div>

          <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {!loading && !loadError && totalVisible === 0 && (
        <p className="text-center text-white/30 text-[13px] pb-10">
          {laneFilter === "ALL" ? "No tasks yet — add your first one." : `No ${laneFilter} tasks.`}
        </p>
      )}

      {modal && (
        <TaskModal
          task={modal.task}
          defaultStatus={modal.defaultStatus}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
  bg,
  border,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  bg?: string;
  border?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[12px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-full transition whitespace-nowrap"
      style={
        active
          ? {
              color: color ?? "#fff",
              background: bg ?? "rgba(255,255,255,0.12)",
              border: `1px solid ${border ?? "rgba(255,255,255,0.25)"}`,
            }
          : { color: "rgba(255,255,255,0.45)", background: "transparent", border: "1px solid rgba(255,255,255,0.08)" }
      }
    >
      {label}
    </button>
  );
}
