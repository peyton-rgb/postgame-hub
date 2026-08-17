# ADMIN-REBUILD-OVERNIGHT — RUN STATE

**Brief:** COWORK OVERNIGHT BRIEF — CF Admin → Hub Rebuild (Phases 1–5)
**Attempted:** 2026-08-17 (cloud Cowork session, reaching the Mac over the device bridge)
**Status:** ⛔ STOPPED before Phase 1 build — environment cannot satisfy the git/build guardrails.
**Nothing was built. No branch created. No code or migration files written. No DB writes. Working tree untouched except this file.**

---

## What actually passed vs. blocked (verified by direct inspection, not assumed)

Guardrail [0.1] — the stated STOP precondition — **PASSED**:
- Folder present: `~/postgame/hub` ✓
- Remote correct: `git@github.com:peyton-rgb/postgame-hub.git` ✓

So [0.1]'s own STOP trigger ("folder missing or remote wrong") did NOT fire. The block is downstream, at [0.2] and [0.4]. Three converging reasons, each independently fatal to an overnight autonomous build:

**1. No network on this session's bridge to your Mac.**
`git ls-remote origin` → `CONNECT github.com:22: Forbidden`. This is the *cloud* Cowork session; it reaches your Mac through a sandboxed bridge that has no outbound network. Guardrail [0.2] requires `git fetch origin` → branch `admin-rebuild-overnight` **off `origin/main`**. Without a fetch I cannot see or branch off the latest main. Impossible here.

**2. A stale `.git/index.lock` is present, and this bridge cannot remove it.**
`git status` reported: `unable to unlink '.git/index.lock': Operation not permitted`. The bridge shell can create and edit files but **cannot delete** them. A leftover `index.lock` blocks every git write — `add`, `checkout`, `commit`, branch creation. So even ignoring the network, I could not create the branch or stage files.

**3. The working tree is on an unrelated in-progress branch.**
Current branch: `fix/brand-brief-routes-and-nav`, with untracked work present (`scripts/backfill/`, `.venv-backfill/`, `docs/…`, `claude/…`). Writing the admin rebuild's files here — the only branch reachable without a fetch — would tangle two unrelated work streams into one messy tree you'd have to unpick by hand. That is real risk, not a formality, which is why I did not "just write the files anyway."

`node_modules` DOES exist, so `npm run build` (guardrail [0.4]) might run offline — but with #1 and #2 blocking the branch itself, that never becomes relevant.

---

## Resolution — re-run this exact brief "On your computer"

The on-computer mode runs the task *natively on your Mac* instead of through the network-less cloud bridge: real git/network, no bridge file-permission limits, outputs land straight on disk. That is the environment this brief was written for.

Before re-running, two 10-second cleanups so it starts clean:
1. Clear the stale lock: `rm -f ~/postgame/hub/.git/index.lock`
2. Get off the in-progress branch cleanly — either commit or `git stash` the `fix/brand-brief-routes-and-nav` work, so the admin branch starts from a clean, current main.

Then: desktop app → **"Run this task"** picker (top-right when starting a Cowork task) → **On your computer** → paste the same brief. (Or Settings → Cowork → turn off "Run new tasks in the cloud" to make on-computer the default.)

---

## Salvageable now, from the cloud, with zero repo risk (offered, not yet done)
I have direct read-only Supabase access from here (that does NOT use the bridge). If wanted, I can draft and schema-verify the six §4 migration files as reviewable `.sql` text — `*_admin_access_levels`, `*_campaign_lifecycle`, `*_brand_lifecycle`, `*_dnw_flags`, `*_roster_approval`, `*_admin_audit_log` — so the on-computer run (or Claude Code) just drops in already-checked SQL. No writes to the DB, no writes to the repo.
