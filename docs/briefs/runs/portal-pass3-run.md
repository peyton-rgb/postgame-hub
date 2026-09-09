# Portal pass 3 — run log

Branch `portal/pass-3` off `main` at 8ef5b7f (#263 merged). Every judgement
call, in the order the work was done.

## How this was verified

Same harness as passes 1–2: a throwaway `/portal/zz-preview-DELETE-ME` route
in the worktree, never committed, rendered by a CDP client at real 1440×900
and 390 viewports (headless Chrome clamps `--window-size` to 500px, so
`Emulation.setDeviceMetricsOverride` is what makes 390 mean 390).

**The harness renders as `anon`**, which sees a different CVS to a signed-in
brand contact: 0 live campaigns / 10 wrapped / 751 athletes, against 6 / 46 /
1,501 for `authenticated`. Two states therefore cannot occur in a render and
are checked with an explicit harness-only override, noted where used: live
campaign cards, and the in-progress live campaign.

---

## Bugs

### 1 · Search "does nothing" — already shipped, and verified

**No code defect found.** Search shipped in #262 and works. Verified three
ways before touching anything:

- `input.pgd-search` is hit-testable — `document.elementFromPoint` at the
  field's centre returns the input itself, on both the dashboard and the
  campaigns page, with `pointer-events: auto`, not disabled, not readonly.
- Typing through the real CDP input pipeline fills the field, and a synthetic
  Enter navigates: the URL went from the harness page to `/portal/search`.
- `/portal/search?q=jordan` on production returns **307 → /portal/login**,
  i.e. the route exists and is gated. A route that did not exist returns 404,
  which `/portal/nonexistent-xyz` does.

The report predates #262: through Phase 3b the box was a decorative `<span>`
that ignored every keystroke, which is exactly "typing + Enter does nothing".

**Judgement call:** rather than "fix" a working feature, the change is an
affordance. A lone unadorned pill gives no sign it is a control, and the only
way to discover Enter did something was to guess — so the field now carries a
submit button. Enter still works; it is no longer the only way in.

### 2 · Roster sticky header — the diagnosis was not z-order

Reported as z-order/background. Both were already correct, and measuring said
so: the `th` computed to `position: sticky`, `z-index: 1`, background
`rgb(17,17,20)` — fully opaque — and `elementFromPoint` at the header's centre
returned the `th`, not a row.

**The cause was `border-collapse: collapse`.** With collapsed borders the
header's own `border-bottom` is collapsed away, so the sticky cell carried no
visible boundary and the row scrolling beneath it ran straight into the header
text. Cropped and compared the header band under both modes at 2× to confirm:
under `collapse` there is no hairline under "School / Followers / Top reel";
under `separate` there is. `border-spacing: 0` keeps the layout identical, and
nothing in this table needs merged borders — `th` and `td` each set only their
own bottom edge.

A second, real defect surfaced while measuring: a row could sit half under the
header — Jordan Seaton's row began 22px inside a 34px header band — leaving a
row sliced through the middle of its type. Fixed with `scroll-snap-type: y
proximity` plus `scroll-margin-top: 34px` on the rows, so "aligned to the
start" means "aligned under the header". `proximity`, not `mandatory`, so a
deliberate small scroll is still possible.

### 3 · Campaign hero "eyes-only" — geometry, not a crop point

**A whole face was impossible at any crop point, and the arithmetic is the
answer.** Measured every CVS hero by reading the JPEG headers directly:

| campaign | source | orientation | band shows |
|---|---|---|---|
| SPF | 2400×3200 | portrait | **12.5%** of the image height |
| W/CWS | 4000×6000 | portrait | 11.1% |
| The Tournament | 3772×4715 | portrait | 13.3% |
| Minute Clinic | 3944×3944 | square | 16.6% |
| Holiday | 8192×5464 | landscape | 24.9% |

In a 1325×220 full-bleed band, `object-fit: cover` scales SPF's portrait to
1325×1767 and shows 220 of those 1767px. A head in a close-up occupies far
more than 12.5% of the frame, so every possible `object-position` was a slice
of a face. Shifting the crop point could only change *which* slice.

**Judgement call: the hero became a split** — the name on a dark ground, the
photo taking the right 46%. That drops the scale to 0.25, so the same 220px
shows **27%** of the image and a whole face fits, which the render confirms.
The 220px height from pass 2 is kept. It also gives item 4 its "hero as a dark
gradient with the name" for free, so both states are one component.

On the phone the split comes off and the photo goes full-bleed behind the
name: a 390×180 box scales SPF by 0.16 and shows 32% of the frame — more than
the desktop split. The geometry that forced the split does not exist there.

**Correction to an earlier run log.** A pass-2 note called `media.focal_y` a
missing column and logged adding it as the follow-up. It exists. It is
populated on **2 of 63** hero rows (320 of 4,533 media rows overall), so the
follow-up is *populating* it, not adding it. It is now read where present and
applied through a `--hero-focal` custom property; 26% is the default, which
suits a portrait, where faces sit in the upper third. A value outside 0–1 is
ignored rather than clamped: out of range means the column was written with a
different convention, and guessing which would move every crop.

### 4 · The in-progress live campaign

Hero as the dark gradient with the name, one line — "This campaign is in
progress — athletes and content will appear as they're confirmed." — and the
contact card. Nothing else renders: At a glance would be three absent figures
and Objective an empty brief.

Tabs are now only the ones with something behind them. Overview always shows;
Athletes needs a roster, Content needs media, Results needs figures,
takeaways or top content. With one tab left there is no tab row at all.

**The Approvals tab is gone, and not because it is empty.** It cannot be
sourced: `review_sessions.campaign_id` is a foreign key to `brand_campaigns`,
not `campaign_recaps` (CLAUDE.md's name twins), so no review session can ever
match a campaign on this page — not "has no rows yet", but structurally
incapable, even once the table fills. A tab that can never show anything is
worse than no tab. **Follow-up:** per-campaign approvals need that foreign key
resolved first.

### 5 · Tab history

`window.history.pushState` and a `popstate` listener, not `router.push`. The
tab lives entirely in a client component; a router push would round-trip the
server component — a fresh query for 132 athletes and 89 media rows — to
change which `div` is displayed. `?tab=` still works on a cold load and the
URL is still shareable, which is what the round trip would have bought.

Verified in a browser: clicking Athletes → Content → Results pushes each, and
three back presses walk `content` → `athletes` → Overview, with the URL and
the active tab agreeing at every step.
