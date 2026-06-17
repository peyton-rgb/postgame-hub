# Postgame Edit Engine — Handoff / Integration Seam

This documents the **single, well-named seam** where the Postgame Edit Engine
plugs into the Auto Editor feature. The Auto Editor (curate → suggest → gate) is
built and live on `feature/athlete-app`; the heavy engine is **not built here**.

## Where uploaded content lives
- Athlete + videographer uploads land on `public.athlete_deliverables`
  (`file_url`, `storage_path`, `storage_bucket`, `media_type`, `slot`,
  `optin_campaign_id`, `athlete_id`). One row per slot (feed/reel).
- The "house checklist" (Postgame's rubric) is editable data in
  `public.house_checklist_items` — no code change to tweak it.

## (a) Twelve Labs — video understanding
Today, **photos** are judged directly by a vision model; **videos** get a
PRELIMINARY evaluation (brief + checklist + metadata only) and are clearly
labelled. The two seams to fill:

1. **Phase 2 — video scoring.** `src/lib/auto-editor.ts` → `runAutoEditor()`
   splits `videos` from `photos` and scores videos via the preliminary path
   (`is_preliminary: true`). Replace that branch with a Twelve Labs call:
   index the `file_url`, pull scene/hook/audio/brand-visibility signals, and
   produce the same `Evaluation` shape (category subscores + `compliance_pass`
   + `compliance_flags` + `rationale`). Set `is_preliminary: false` once real
   frame analysis is in. The compliance HARD GATE (e.g. copyrighted-music mute,
   competitor in-frame) becomes enforceable on video here.
2. **Phase 3 — video suggestions.** `src/lib/suggestions.ts` →
   `modelSuggestions()` currently limits video to caption/disclosure/length.
   With Twelve Labs scene data, add frame-level suggestions (trim, reframe,
   hook fix) with the same `Suggestion` shape.

Gate it behind an env var (e.g. `TWELVE_LABS_API_KEY`) and keep the preliminary
path as the no-key fallback — exactly as the Anthropic scoring already does.

## (b) The edit-job worker (OTIO execution)
The "Approve & auto-edit" button is real; **execution is stubbed**. Approving a
suggestion writes a row to `public.athlete_edit_jobs`:

```
athlete_edit_jobs (
  id, deliverable_id, suggestion_id, type, params jsonb,
  status text  -- 'queued' | 'running' | 'done' | 'failed'
  result_url, error, created_at, updated_at
)
```

A worker is the only thing that touches the heavy engine:

1. Poll `select * from athlete_edit_jobs where status = 'queued'`.
2. Set `status = 'running'`. Fetch the source file from the deliverable
   (`athlete_deliverables.file_url` / `storage_path` in the `campaign-media`
   bucket). `params` carries the suggestion (`type`, `summary`, `detail`).
3. Execute the edit (OTIO timeline → render). Upload the result to storage.
4. Write `result_url`, set `status = 'done'` (or `'failed'` + `error`).
5. (Optional) surface the rendered result back on the deliverable / notify.

No other part of the feature needs to change — the curator, suggestions, and
the gate all already read/write these tables. The worker is the whole engine
boundary.

## Env vars
- `ANTHROPIC_API_KEY` — photo scoring + suggestions (set; stubs without it).
- `AUTO_EDITOR_MODEL` — optional model override (default `claude-opus-4-8`).
- `TWELVE_LABS_API_KEY` — **TODO**: enables video understanding (seam above).
