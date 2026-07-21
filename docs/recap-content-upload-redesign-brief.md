# Build Brief — Recap "Content Upload" redesign

**For:** Claude Code (terminal), working in `~/postgame/hub`
**Author of design:** planner chat + Peyton. Mockups this brief implements:
`content-upload-mockup-v4.html` (the page) and `bulk-select-mockup.html` (the picker modal).
**Golden rule:** one phase at a time. Finish a phase, show Peyton, get "go," then the next. Do **not** batch phases.

> **Status (2026-07-21):** Phase 0 complete. Phase 1 shipped as roster search + unselected-only
> toggle only (PR #99, squash-merged to main). Change #3 (collab double-import / `source_id` dedup)
> was moved into Phase 2 to avoid touching `import/route.ts` twice. Phase 2 in progress.

---

## What we're building (plain English)

The recap editor's content step is being rebuilt from a modal-first, fuzzy-matching flow into a
visual **Content Upload** page with three stacked sections, in this order:

1. **Top Performers** — the best-performing posts as cards, so their covers get picked first.
2. **Collab Posts** — shared team posts, with each platform marked pooled (collab) or solo.
3. **Content Gallery** — everyone else, by athlete. Each athlete shows selected content, or a
   **Select content** button; a **Bulk select** button opens the full roster picker we use today.

Content sources everywhere: **Drive folder** (from the tracker's Drive-link column) **or local upload**.
Covers: a **photo** highlighted orange when photos exist; a **video-timeline frame** when it's video-only.

---

## Ground rules — do not violate

- **NEVER modify these three files:** `src/components/CampaignRecap.tsx`,
  `src/components/Top50Recap.tsx`, `src/components/CampaignMediaPicker.tsx`.
  They render whatever they're handed; the work here is upstream of them. If a change seems to
  require touching one, **stop and ask Peyton** — it almost certainly doesn't.
- **Investigate before building.** Read the actual file / run a `SELECT` before proposing a change.
  Don't trust a summary over direct inspection.
- **DB writes:** `SELECT` the affected rows first, scope with a `WHERE`, preview, then write, then
  `SELECT` again to verify. For any `UPDATE`/`DELETE`, get an explicit "go" from Peyton first.
- **Git hygiene:** stage by explicit filename (never `git add -A`). Work on a branch. Merge via the
  GitHub PR page (squash-merge), never terminal-to-main. Never force-push. Confirm the Vercel
  preview before merging.
- **Supabase project id:** `xqaybwhpgxillpbbqtks` (always by id).
- **One agent per repo copy.** If Cowork is running against this repo, stop it first.

---

## Reuse — already built, do NOT rebuild (confirmed in code)

**`src/components/DrivePicker.tsx`** already has, and this redesign reuses:
- Modes: connect / selecting / importing / complete.
- Import progress bar + "X of Y files" counter (`importProgress.current / total`).
- Cancel via `AbortController` (`abortController?.abort()`), `wasAborted` handling, escape-lock during import.
- Already-imported greying: `alreadyImportedFileIds` → `alreadyImportedSet`; greyed `opacity-40`,
  "✓ Imported" badge, non-selectable, excluded from select-all and the import payload.
  **NOTE (found in Phase 1):** the campaign-level `<DrivePicker>` call site does not pass this prop
  today, and collab media never stored the real Drive file id — see Phase 2 for the fix.
- Completion state: "Import Complete / Cancelled", "N of M imported", failed-files list, Done button.
- Type filter (All / Image / Video), Select all / Clear, "+ Add folder".
- **Roster search + "Unselected only" toggle** (added in Phase 1).
- Two import paths: `onImport` (per-athlete) and `onImportToCollab` (team/pooled).

**`src/app/dashboard/[id]/page.tsx`** (the editor) already has:
- Cover selection: clicking a thumbnail calls `setCoverPhoto`; the cover gets the orange ring
  (`border-[#D73F09] ring-1`) + a cover star badge. Videos get a purple border + play glyph.
- Remove-single-file on hover (`removeMedia(a.id, m.id)`) on both cover and thumbnails.
- Local upload: hidden `<input type="file" accept="image/*,video/*,.heic,.heif" multiple>` +
  `handleFiles` + `fileRefs` (the "Add photo" button).
- Per-athlete Drive import (`setDriveFolderAthlete` → `AthleteDriveFolderPicker`).
- Drag affordance (`onDragOver` / `preventDefault`) for arranging content.
- Per-athlete Submissions count button.
- `TierPickerAthlete` (gated on `campaign.admin_campaign_id`) and a campaign-level
  `AthleteDriveFolderPicker` for event imports.
- Footer nav: Back / Next / **Preview Recap** (`handlePreviewClick`), gated on `selected.length`.

**`src/lib/csv-parser.ts` → `detectCollabGroups`:** group id = `platform-hash(url)` (stable; re-derived
at render time). The recap page (`src/app/recap/[slug]/page.tsx`) fans media three ways:
`drive_file_id` starting `collab:` (keyed by group id) · direct `athlete_id` · `media_athletes` M2M.

**Everything above must survive the redesign.** The new page re-presents these pieces; it does not
replace their logic.

---

## Preconditions / dependencies

- **Tracker Drive-folder-link column** (Peyton is building it). Confirmed shape: **separate
  per-athlete and per-team columns.** The new page's auto-fill of each athlete/team folder depends
  on it. Until it exists, fall back to the current fuzzy name-match + manual paste. Phase 3's
  auto-fill is gated on this column being live.
- **School-logo asset source** for collab crests — **not sourced yet (2026-07-21).** Use a
  placeholder crest until confirmed. Never AI-generate or redraw a school mark.

---

## Phases

### Phase 0 — Investigate & confirm (COMPLETE)

Findings: the collab content disconnect is caused by the collab group identity being **URL-gated**.
`detectCollabGroups` only emits a group when 2+ athletes share a `metrics[platform].post_url`; the
collab cards and `collabGroupByContainerSlot` are built from those groups, so a team whose post URL
isn't in the tracker yet renders no card and `handleImportToCollab` fails every file with
"No collab group for this team/slot." Live proof: four campaigns (W/CWS, adidas Trick Shot, Always
Open, adidas Holiday 24) have auto-created team containers with 0 collab media; only Diamond Sports
works (its athletes share reel/feed URLs). Containers never store `post_url`/`platform`. All 12
distinct collab tags in the DB are `platform-hash` style; 0 match a container UUID.

### Phase 1 — DrivePicker parity adds (SHIPPED — PR #99)

1. **Roster search box** above the athlete/team sidebar list — filters `athleteTabs` / `teamFolders`
   by name (case-insensitive).
2. **"Unselected only" toggle** in the toolbar — narrows the file grid to items not yet
   selected/imported.

Change #3 (below) was moved to Phase 2.

### Phase 2 — Fix the collab content-selection disconnect + collab double-import

Implement **mechanism B-lite (additive, no migration)**, chosen in Phase 0:
- Keep the `collab:<platform-hash(url)>` key where a shared post URL exists — the recap already reads it.
- For a team whose URL isn't in the tracker yet, emit a **container-derived** collab group + tag so
  content imported before the URL still resolves; reconcile onto the platform-hash key (render-side,
  by matching athlete-set + platform/slot) once the URL appears.
- Do **not** retag the 28 existing rows. No migration, no bulk `UPDATE`/`INSERT`/backfill.

**Folded in from Phase 1 (#3 — collab double-import / `source_id` dedup), same pass since this phase
already edits `import/route.ts`:**
- `import/route.ts` — collab imports also write `source_system:'drive'` + `source_id: fileId`
  (the real Drive id), matching the regular drive-import rows.
- `page.tsx` — compute `alreadyImportedFileIds` for the campaign (real `drive_file_id`s from
  athlete/event imports ∪ `source_id`s from collab imports) and pass it to `<DrivePicker>`
  (fixes greying for the campaign-level and collab flows).
- **Known limitation (note in the PR):** the 28 existing collab rows can't be retro-deduped — their
  real Drive id was never captured — so dedup works going forward only.

Rules: `SELECT`-before-write; preview affected rows and show Peyton before any `UPDATE`/`INSERT`;
explicit "go" first. Verify on a real collab campaign (Diamond Sports softball teams): newly imported
team content shows on the collab card **and** existing collab posts still display.

Checkpoint: branch → build → preview on a real recap → PR squash-merge.

### Phase 3 — Content Upload three-section restructure (the visual redesign)

The big one. Gated on: design locked (done) + tracker column live (for auto folder-fill; else
fall back). Build in sub-steps, each verified before the next:

1. Scaffold the three sections in the editor content step (Top Performers / Collab Posts /
   Content Gallery), reusing the existing cover/remove/drag/upload/DrivePicker machinery.
2. **Top Performers:** rank posts by engagement rate / impressions (from the stats the recap already
   computes), surface those still needing a cover, with a "Ranked by" toggle. No play buttons on
   cards (nothing plays inline).
3. **Collab Posts:** cards with school crest + pooled/solo per platform (straight from
   `detectCollabGroups`), Drive-folder + Upload sources.
4. **Content Gallery:** per-athlete — show selected content (cover photo orange) or a "Select
   content" button (opens that athlete's folder); a "Bulk select content" button opens the roster
   `DrivePicker`. Both Drive + Upload sources; Upload stays enabled even when there's no folder.
5. Keep the footer nav (Back / Next / Preview Recap, gated) and the preview thumbnail gate.

Do NOT touch the three protected files. If a section needs data the protected renderer also uses,
compute it upstream and pass it — don't edit the renderer.

Checkpoint after each sub-step: build → preview → show Peyton → go.

### Phase 4 — Covers (verify + fill the gap)

The photo-highlight cover path already exists. Confirm/complete:
- **Photos present →** orange-highlighted photo is the cover (already works via `setCoverPhoto`).
- **Video only →** cover comes from a **video-timeline frame** (`is_video_thumbnail` + `thumbnail_url`).
  Confirm this exists for athletes with zero photos; if not, add the timeline frame-picker (same
  mechanism used for per-video posters). Ensure it feeds the preview thumbnail gate.

---

## Definition of done (per phase)

- Builds clean (`npm run build`), verified on the Vercel **preview** before merge.
- Mobile-first checked through desktop (Postgame rule).
- No protected file modified.
- Existing behavior preserved (progress/cancel, greying, completion, remove, drag-reorder,
  preview-gate footer).
- Merged via GitHub PR squash-merge; branch only; no force-push.

## Open items to resolve with Peyton before Phase 3

- Tracker Drive-folder-link column: **resolved — separate athlete + team columns.**
- School-logo asset source for crests: **unresolved — placeholder for now.**
- "Top performer" definition: rank by engagement rate, impressions, or both — and top how many?
- Where local uploads are stored (expected: Supabase `campaign-media` bucket directly, stamped with
  athlete_id or the collab group tag — no Drive round-trip).
