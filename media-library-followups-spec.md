# Media Library: Always-Available Drive Import + Per-Athlete Manual Upload

**For:** Claude Code
**Status:** Final spec, ready to build (HOLD until current Cowork session on the repo finishes — do NOT start while Cowork is editing)
**Author:** Peyton (via planning session with Claude)
**Repo:** `github.com/peyton-rgb/postgame-hub`
**Supabase project ID:** `xqaybwhpgxillpbbqtks` (project name: "recap")
**Builds on:** PR #20 (Media Library Drive import for empty-state campaigns)

---

## ⚠️ Read this first — Claude Code briefing

**Before writing any code:**

1. Verify Cowork is **not currently editing** the repo. Run `git fetch` and confirm `origin/main` is at PR #20's merge commit (`555e5e9` or later — the Media Library Drive import). If there are newer commits past PR #20, fast-forward, read what changed, and surface anything that conflicts with this spec to Peyton before starting.
2. Read this spec end to end.
3. Confirm back to Peyton in plain English what you understand the scope to be and what files you plan to touch. List by full path.
4. Wait for Peyton's explicit approval before starting any edits.
5. Do NOT touch files marked under "Files Claude Code must NOT touch" without surfacing the conflict first.

**Critical context — the same guardrails as PR #20 apply.** The May 2026 incident is still recent; the recap editor, public site, and public recap components stay protected. This work is purely additive to the Media Library.

---

## Purpose

PR #20 added a Drive-import doorway, but only for **empty** campaigns. Two real-world gaps surfaced during testing:

1. *Once a campaign has content, there's no UI to import more from Drive.* You'd have to wipe the campaign or do it from the recap editor. This is wrong — you should be able to drop more Drive folders into an already-populated campaign at any time.
2. *Some content doesn't live in Drive.* Photos from a phone, files from a laptop, ad-hoc assets. There's currently no way to attach those to a specific athlete from the Media Library.

This spec adds both: an always-available Drive importer that grays-out already-imported files, and a per-athlete manual upload dropzone for local files.

---

## Feature 1 — Always-available Drive importer

### User flow

1. User visits a campaign view in `/media-library` that **already has athletes/files** (e.g. Silver Cleat after PR #20's import)
2. At the top of the athletes grid, sees a button: **"Import more from Drive"**
3. Clicks the button → it expands inline to reveal a paste-URL input + Continue button (same UI as the empty-state form)
4. Pastes a Drive folder URL (could be the same one already linked, or a different one) → clicks **Continue**
5. Hub fetches the folder, finds subfolders, returns athletes + `alreadyImportedFileIds` (same as empty-state path)
6. DrivePicker opens with athletes + files. Already-imported files are greyed-out with the "✓ Imported" badge (this is the **first real-world use** of the already-imported greying-out behavior we built in PR #20)
7. User picks new files only, clicks Import → files import → campaign view refreshes

### Edge cases — same as PR #20

- Flat folder → show flat-folder warning *in place of the expanded paste form*, with a "Try a different URL" button to reset back to the input
- Confirm-replace when a different folder is already linked → same dialog as PR #20
- Invalid URL → button stays disabled
- Permission errors → red inline error

### What this requires (Feature 1)

**File:** `src/app/media-library/page.tsx` (existing — extend)

The athletes-view rendering currently has two branches:
- `athletes.length === 0` → the empty-state import form (built in PR #20)
- `athletes.length > 0` → the grid of athlete cards

Add a third element that appears **above the athlete grid** when `athletes.length > 0`:

- A button labeled **"Import more from Drive"** with an icon (plus icon or similar)
- Click toggles an expanded state showing the same `<DriveImportForm>` block currently rendered in the empty state (paste input, Continue button, error display)
- Form state (urlInput, discovering, discoverError, flatInfo, confirmReplace) should be the same state hooks already on the page — they're already campaign-scoped, just need to be visible in this new context
- A "Cancel" or "X" close button on the expanded state to collapse it back to just the button

**Important DRY refactor:** the existing empty-state already contains this form. The form should be **extracted into a small local component or render-prop helper inside the file** so both the empty state and the new "import more" expansion render the same thing. Do NOT duplicate the JSX into two places. The state and handlers (`handleContinue`, `urlInput`, `setUrlInput`, etc.) stay on the parent — just the rendering is shared.

**No new API endpoint needed.** Feature 1 reuses `/api/drive/discover-folder` from PR #20 exactly as-is. The `alreadyImportedFileIds` returned from that endpoint flows through to the DrivePicker (already wired in PR #20).

### Files Claude Code touches (Feature 1)

| File | Type | What |
|---|---|---|
| `src/app/media-library/page.tsx` | edit | Add "Import more from Drive" button + expansion above athlete grid; extract import form into a shared local component |

### Files Claude Code must NOT touch (Feature 1)

| File | Why |
|---|---|
| `src/app/api/drive/discover-folder/route.ts` | Already works correctly — no changes needed for Feature 1 |
| `src/components/DrivePicker.tsx` | Already accepts `alreadyImportedFileIds` from PR #20 |
| Anything in `src/app/dashboard/[id]/` | Recap editor — out of scope |
| `src/components/CampaignRecap.tsx`, `Top50Recap.tsx` | Public recap pages — out of scope |
| Anything in `src/app/clients/` | Public brand pages — out of scope |

---

## Feature 2 — Per-athlete manual upload

### User flow

1. User visits a campaign view in `/media-library` with athletes
2. Clicks into a specific athlete (e.g. Devin Taylor)
3. Sees Devin Taylor's existing files in a grid (current behavior)
4. Sees a new **dropzone** at the top of the file grid that says **"Drag and drop files here, or click to browse"**
5. Drags one or more image/video files from their computer onto the dropzone (or clicks to open a file picker)
6. Files upload to Supabase Storage and become media rows attached to Devin Taylor
7. Dropzone shows per-file progress as they upload
8. When complete, the file grid refreshes and the new files appear alongside Devin Taylor's existing files

### Accepted file types

- **Images:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`
- **Videos:** `video/mp4`, `video/quicktime` (`.mov`), `video/webm`
- All other types rejected with an inline message ("Only images and videos are supported.")

### Per-file size limit

- Match the existing `/api/drive/import` ceiling (whatever it is — Claude Code should look at how it handles large files and use the same limit)
- If a file exceeds the limit, reject before upload starts with a message naming the offending file
- If no explicit ceiling exists in current code, default to **100 MB per file** with a config constant for easy tuning later

### What this requires (Feature 2)

**File 1 (new):** `src/app/api/media/upload/route.ts`

**Method:** POST (multipart/form-data)
**Body:** form-data with fields:
- `file` — the file blob
- `campaignId` — string
- `athleteId` — string

**Returns:**
```json
{ "success": true, "media": { "id": "...", "file_url": "...", "thumbnail_url": "...", "type": "image" | "video" } }
```
or
```json
{ "error": "Human-readable message" }
```

**Logic:**
1. Validate `campaignId` and `athleteId` exist and the athlete belongs to that campaign
2. Validate MIME type is in the accepted list above
3. Validate file size is under the ceiling
4. Upload the file to Supabase Storage at the same path pattern the existing `/api/drive/import` uses: `campaign-media/[campaignId]/...`
5. For videos: do not generate thumbnails on the server (matches existing import behavior — video thumbnails are handled elsewhere or left null)
6. For images: same handling as `/api/drive/import` (no special processing in v1 — just store as-is)
7. Insert a `media` row with:
   - `campaign_id`
   - `athlete_id`
   - `type` (`image` or `video`)
   - `file_url` (the public Supabase Storage URL)
   - `thumbnail_url` (same as `file_url` for images, null for videos)
   - `is_video_thumbnail: false`
   - **NO `drive_file_id`** — leave it null. These files don't come from Drive.
8. Return the new media row

**Reuse, do not duplicate:** the file-to-storage upload logic in `/api/drive/import` (around the Supabase Storage write) is the pattern to mirror. If that logic is already extracted into a helper in `src/lib/`, use the helper. If not, write the new endpoint with the same patterns inline — do NOT refactor the existing endpoint as part of this work (out of scope, risk to PR #20's work).

**Auth:** uses the same `createServiceSupabase()` pattern as the discover-folder endpoint.

**File 2 (edit):** `src/app/media-library/page.tsx`

When `view.level === "media"` (the athlete-files view), add a dropzone at the top of the file grid:

- Drag-and-drop area with a clear visual border and call-to-action text
- Clicking the area opens a native file picker (`<input type="file" multiple accept="image/*,video/*">`)
- Drag-over should highlight the dropzone
- On drop or file selection:
  - Validate types/sizes client-side first (cheap reject — no need to round-trip to the server for invalid files)
  - POST each file to `/api/media/upload` one at a time (NOT in parallel — match the existing serial DrivePicker import pattern; avoids overwhelming Supabase Storage)
  - Track per-file progress: filename + status (pending / uploading / done / failed)
  - Show a list of files with their status below the dropzone during the upload
  - On all-files-complete, refresh the athlete's media list (re-fetch `view.media` for the current athlete)
- Errors: per-file inline error messages. Don't block other files in the batch from continuing.

### Files Claude Code touches (Feature 2)

| File | Type | What |
|---|---|---|
| `src/app/api/media/upload/route.ts` | **new** | Multipart file upload endpoint |
| `src/app/media-library/page.tsx` | edit | Add dropzone + upload UI to athlete view |

### Files Claude Code must NOT touch (Feature 2)

| File | Why |
|---|---|
| `src/app/api/drive/import/route.ts` | Existing Drive import — out of scope; new endpoint should mirror its patterns, not modify it |
| `src/components/DrivePicker.tsx` | Not involved in manual upload at all |
| `src/components/CampaignMediaPicker.tsx` | This is a different (Supabase-Storage-browsing) picker used in the recap editor. Out of scope. |
| Anything in `src/app/dashboard/[id]/` | Recap editor |
| `src/components/CampaignRecap.tsx`, `Top50Recap.tsx` | Public recaps |
| Anything in `src/app/clients/` | Public brand pages |

---

## Combined data model — no migrations needed

Both features read/write existing tables, no schema changes:

- `media` — Feature 2 writes new rows. `drive_file_id` is left null (it's nullable per schema).
- `athletes` — no changes to either feature
- `campaign_recaps` — no changes to either feature
- Supabase Storage `campaign-media/` bucket — Feature 2 uploads new files alongside existing Drive-imported ones

---

## Acceptance criteria

Each criterion must pass before declaring done.

### Feature 1 — Always-available Drive importer

1. ✅ Visit `/media-library` → Adidas → **Silver Cleat** (which now has athletes from PR #20). See an "Import more from Drive" button above the athlete grid.
2. ✅ Click the button → form expands inline with a URL input + Continue button.
3. ✅ Paste the same Drive folder URL used in PR #20's testing → Continue → DrivePicker opens with the existing 6 athletes pre-loaded.
4. ✅ **The 17 already-imported files appear greyed-out with a "✓ Imported" badge** and cannot be selected. This is the first real-world verification of PR #20's already-imported greying behavior.
5. ✅ If new files exist in the Drive folder that weren't imported before, they're selectable. Import them → they appear in the athlete views afterward.
6. ✅ Click the close/cancel button on the expanded form → returns to just the button.
7. ✅ Visit a campaign that's still empty (no PR #20 import yet) → the empty-state form still renders correctly (no regression from refactoring the import form into a shared component).

### Feature 2 — Per-athlete manual upload

8. ✅ Click into an athlete (e.g. Devin Taylor). See the existing files **and** a new dropzone at the top.
9. ✅ Drag an image file from your computer onto the dropzone → it uploads → appears in the file grid below.
10. ✅ Drop multiple files at once → each shows its own progress → all appear after completion.
11. ✅ Drop a `.pdf` or other unsupported file → see inline error, no upload attempt.
12. ✅ Drop a file over the ceiling (~100 MB or whatever's set) → see inline error naming the file.
13. ✅ Drop a `.heic` from an iPhone → uploads successfully (matches existing Drive-import HEIC handling).
14. ✅ Drop an `.mp4` video → uploads, appears as a video in the grid.
15. ✅ Click into the same athlete from the recap editor (different tab/path) → manually-uploaded files appear there too (DB consistency check).
16. ✅ **Regression:** Recap editor's own file upload (in the CampaignMediaPicker, if applicable) still works identically. No behavior change there.

### Combined regression checks

17. ✅ PR #20's empty-state import flow still works for genuinely empty campaigns.
18. ✅ Recap editor (`/dashboard/[id]`) loads and functions identically to before — no errors, all tabs work.
19. ✅ Public-site pages (`/clients/*`, `/`) load unchanged — no errors in console, no visual changes.
20. ✅ Public recap pages (`/recap/*`) load unchanged.

---

## Out of scope for this PR

Do not build these. Noted for future:

- Manual upload at the **campaign level** (only athlete-level in v1)
- Re-assigning a manually-uploaded file to a different athlete after upload
- Bulk delete from the Media Library
- Sorting/filtering files within an athlete view
- Editing athlete metadata (school, sport, IG handle) from Media Library — still in recap editor
- Replacing/reorganizing already-imported files
- The recap editor passing `alreadyImportedFileIds` to its own DrivePicker — separate future spec

---

## Implementation order (suggested)

1. Pull and verify the repo is at PR #20's merge commit (or later if Cowork has pushed). Surface any conflicts.
2. Feature 1 first (smaller, lower-risk): extract the import form into a shared local component; add the "Import more from Drive" button + expansion to the populated state.
3. Run Feature 1 acceptance criteria (#1–7, #17).
4. Feature 2: build `/api/media/upload/route.ts` endpoint with type/size validation and Supabase Storage write.
5. Feature 2 UI: add the dropzone to the athlete view in `media-library/page.tsx`.
6. Run Feature 2 acceptance criteria (#8–16).
7. Run combined regression checks (#18–20).
8. Report back to Peyton.

---

## One important design assumption

Feature 1 and Feature 2 share `src/app/media-library/page.tsx` — a single file. Both features add UI to different parts of the same page, but they should NOT interfere with each other. Build Feature 1 first, verify it cleanly, then build Feature 2 on top. If you find yourself wanting to refactor the page structure heavily to accommodate both, **stop and surface that to Peyton** — over-refactoring this file is exactly the risk pattern that caused issues in the May incident, even though it's an "allowed" file to edit.

---

## Final note

This spec is sized to be one PR with two clearly-bounded features, OR two PRs if Claude Code prefers to ship Feature 1 first and Feature 2 separately. Either is acceptable. Whatever Claude Code chooses, surface the choice to Peyton in the scope readback before starting work.
