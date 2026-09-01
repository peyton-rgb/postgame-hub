# BRIEF — Inspo Triage UI

**Date:** 2026-09-01 · **Repo:** `~/postgame/hub` @ `main`
**Route:** `/dashboard/inspo/triage`
**Surface:** Claude Code or Antigravity — repo edits, one branch, PR
**DB:** `xqaybwhpgxillpbbqtks` — **no schema changes required**

---

## 0 · Why this exists

`inspo_items` holds 568 items. 566 are embedded and searchable in principle.
**527 are invisible in practice**, because `/api/search` filters to
`triage_status = 'approved'` and only 40 items have ever been approved.

Verified today: searching "showroom interior design" returned a Big Buck Bunny
test clip, because the one genuinely matching item was `pending`. Approving that
single item moved it to the top at 0.655 similarity against 0.458 for the
runner-up. The vectors work. The gate is the problem.

This screen is also the **only place a human verdict enters the system.**
`approved_by` is null on every row in the table. Until that changes, the library
knows what each item *is* and nothing about what Peyton *likes* — which is the
blocker on everything downstream that's meant to learn.

**Note for whoever picks this up:** `claude_BACKLOG-INVENTORY.md` claims this was
already built on a branch `feat/inspo-triage`. That branch does not exist — not
locally, not on the remote — and `triage_status` appears in no UI component.
This is a build, not a merge.

---

## 1 · Scope

**One screen.** No settings, no bulk operations, no admin surface.

| In | Out |
|---|---|
| Review one pending item at a time | Bulk approve/reject |
| Approve / reject / skip | Editing descriptions or tags |
| Optional one-line reason on reject | Re-running intake or re-tagging |
| Keyboard-first, mobile-capable | Deleting items |
| Progress indicator | Anything touching `embedding` |

---

## 2 · Data

**Read:** `inspo_items` where `triage_status = 'pending'`, ordered `created_at asc`,
one at a time (fetch a small buffer of ~10 to keep it snappy).

Fields needed: `id`, `file_url`, `thumbnail_url`, `visual_description`,
`content_type`, `source`, `mood_tags`, `context_tags`, `pro_tags`,
`search_phrases`, `created_at`.

**Write:** only these three columns.

```
triage_status  → 'approved' | 'rejected'
approved_by    → the current user's profile id
triage_reason  → optional short text (rejects only)
```

**Check `triage_reason` exists before building** — query
`information_schema.columns` for `inspo_items`. If it isn't there, either skip
the reason field or flag it to Peyton for a migration. **Do not add the column
yourself.**

**Media note:** many items are `.mp4` from `inspo-media/instagram/`, and
`thumbnail_url` is null for the entire June 14 batch. So the viewer must handle
video, and cannot rely on a thumbnail existing. Render `<video>` for `.mp4`,
`<img>` for images, decided from the `file_url` extension. File URLs are signed
Supabase Storage URLs and work directly.

---

## 3 · Interaction

The whole design goal is **527 decisions without it feeling like 527 decisions.**

- **Keyboard:** `A` approve · `R` reject · `S` skip · `←` undo last
- **Touch:** large approve/reject buttons, thumb-reachable at the bottom
- **No page reloads.** Optimistic UI — advance to the next item immediately,
  write in the background, roll back visibly if the write fails.
- **Undo** covers the last action only. Mis-hitting a key on item 300 of 527
  must not be unrecoverable.
- **Reject reason** is optional and never blocks. A short free-text line,
  skippable with Enter.
- **Progress:** "68 of 527" plus a thin bar. People need to see the end.
- **Resumable:** always serves the oldest pending item, so closing the tab and
  returning just continues.

---

## 4 · Reuse before rebuild

`src/app/dashboard/inspo/page.tsx` (700 lines) already has the fetch pattern,
the `InspoItem` type from `@/lib/types/intake`, `createBrowserSupabase`, and the
media rendering. **Read it first and reuse those patterns.** Do not refactor that
page — build the new route alongside it.

Add a link to `/dashboard/inspo/triage` from the inspo page and, if it fits the
existing group, one nav entry.

---

## 5 · Design

Follow the `postgame-design-system` skill. Specifically:

- `#07070A` background, `#FAF8F5` text at 68% opacity for body
- `#D73F09` for the approve accent only — **never a background fill**
- Bebas Neue for the count, Arimo for body, JetBrains Mono for the tag chips
- Media on a flat edge over dark gets the soft gradient blend
- Body text never below 16px
- **Mobile-first.** Verify at 390px before desktop. Bottom-anchored controls.

The item's media should dominate the screen. Description and tags sit under it,
readable but secondary. This is a looking task, not a reading task.

---

## 6 · Acceptance

- [ ] `/dashboard/inspo/triage` renders one pending item with working media (both video and image cases)
- [ ] Approve writes `triage_status='approved'` and `approved_by`; verified with a SELECT
- [ ] Reject writes `'rejected'`; optional reason persists if the column exists
- [ ] Skip advances without writing anything
- [ ] Undo reverts the last decision, verified in the DB
- [ ] Progress count is accurate and decrements
- [ ] Works at 390px wide; controls reachable one-handed
- [ ] Closing and reopening resumes at the right place
- [ ] A newly approved item appears in `/api/search` results for a matching query
- [ ] `tsc --noEmit` error count is not above the ~227 baseline

---

## 7 · Guardrails

- No schema changes. If a column is missing, report it — don't add it.
- Never write to `embedding` or `embedding_v2`.
- Do not modify `/dashboard/inspo/page.tsx` beyond adding one link.
- Do not touch `CampaignRecap.tsx`, `Top50Recap.tsx`, `CampaignMediaPicker.tsx`,
  `csv-parser.ts`, `recap-helpers.ts`.
- Stage by explicit filename. One branch. PR — no terminal merge to `main`.
- Verify the Vercel preview before merging.

---

## 8 · After it ships

Triaging 527 items produces the first real verdict data in the system. Two things
become possible that aren't today:

1. **Search covers the library** instead of 7% of it.
2. **`approved_by` stops being null**, which is the input the learning layer needs —
   approved items become the reference set, and rejection reasons become
   candidate rules.

Worth capturing rejection reasons even loosely for that second point. A pattern
across 100 rejects is a design rule waiting to be written down.
