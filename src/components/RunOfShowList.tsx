"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { RunOfShow } from "@/lib/types";
import Link from "next/link";

export default function RunOfShowList() {
  const [rosList, setRosList] = useState<RunOfShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RunOfShow | null>(null);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadRosList();
  }, []);

  async function loadRosList() {
    const { data } = await supabase
      .from("run_of_shows")
      .select("*")
      .order("created_at", { ascending: false });
    setRosList(data || []);
    setLoading(false);
  }

  async function createRos() {
    if (!newName.trim() || !newClient.trim()) return;
    const slug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data } = await supabase
      .from("run_of_shows")
      .insert({
        name: newName,
        slug,
        client_name: newClient,
        event_name: newEventName || null,
        published: false,
        contacts: [
          { name: "Aaron H.", phone: "(941) 786-5956", initials: "AH" },
          { name: "Peyton J.", phone: "(941) 567-8565", initials: "PJ" },
          { name: "Dom M.", phone: "(352) 530-7027", initials: "DM" },
        ],
      })
      .select()
      .single();

    if (data) {
      setRosList([data, ...rosList]);
      setShowCreate(false);
      setNewName("");
      setNewClient("");
      setNewEventName("");
    }
  }

  async function deleteRos(ros: RunOfShow) {
    setDeleting(ros.id);
    await supabase.from("ros_shoots").delete().eq("run_of_show_id", ros.id);
    const { error } = await supabase.from("run_of_shows").delete().eq("id", ros.id);
    if (!error) {
      setRosList((prev) => prev.filter((r) => r.id !== ros.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  return (
    <>
      {/* Create button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-[var(--accent)] text-ink-1 text-sm font-bold rounded-lg hover:bg-[var(--accent)]"
        >
          + New Run of Show
        </button>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 backdrop-blur-sm">
          <div className="bg-surface-card border border-hairline rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-2">Delete Run of Show</h2>
            <p className="text-sm text-ink-3 mb-1">
              Are you sure you want to delete{" "}
              <span className="text-ink-1 font-bold">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-accent/70 mb-6">
              This will permanently remove the run of show and all its shoots. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 border border-hairline rounded-lg text-ink-3 font-bold text-sm hover:border-ink-4 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteRos(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-accent rounded-lg text-ink-1 font-bold text-sm hover:bg-accent disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete Run of Show"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 backdrop-blur-sm">
          <div className="bg-surface-card border border-hairline rounded-2xl p-8 w-[420px]">
            <h2 className="text-lg font-black mb-6">New Run of Show</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Campaign Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Raising Cane's St. Patrick's Day 2026"
              className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 mb-4 focus:border-[var(--accent)] outline-none"
            />
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Brand / Client
            </label>
            <input
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              placeholder="e.g. Raising Cane's"
              className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 mb-4 focus:border-[var(--accent)] outline-none"
            />
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-4 mb-2">
              Event Name (optional)
            </label>
            <input
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              placeholder="e.g. St. Patrick's Day 2026"
              className="w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 mb-6 focus:border-[var(--accent)] outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-3 border border-hairline rounded-lg text-ink-3 font-bold text-sm hover:border-ink-4"
              >
                Cancel
              </button>
              <button
                onClick={createRos}
                className="flex-1 px-4 py-3 bg-[var(--accent)] rounded-lg text-ink-1 font-bold text-sm hover:bg-[var(--accent)]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROS list */}
      {loading ? (
        <div className="text-ink-4 text-center py-20">Loading...</div>
      ) : rosList.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-ink-4 mb-4">No run of shows yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-[var(--accent)] font-bold text-sm hover:underline"
          >
            Create your first run of show →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rosList.map((ros) => (
            <div
              key={ros.id}
              className="relative p-6 bg-surface-card border border-hairline rounded-xl hover:border-ink-4 transition-colors group"
            >
              <Link
                href={`/dashboard/run-of-show/${ros.id}`}
                className="absolute inset-0 z-0"
              />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-4">
                  {ros.client_name}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      ros.published
                        ? "bg-surface-card/30 text-ink-3"
                        : "bg-surface-raised text-ink-4"
                    }`}
                  >
                    {ros.published ? "Published" : "Draft"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(ros);
                    }}
                    className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-ink-4 hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete run of show"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-black mb-1">{ros.name}</h3>
              {ros.event_name && (
                <p className="text-sm text-ink-3 mb-2">{ros.event_name}</p>
              )}
              <p className="text-xs text-ink-4">
                {new Date(ros.created_at).toLocaleDateString()}
                {ros.published && (
                  <span className="ml-2 text-[var(--accent)]">
                    /run-of-show/{ros.slug}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
