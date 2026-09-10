# Portal pass 4 — run log

Branch `portal/pass-4` off `main` at bd4053c (#266 merged).

Harness caveat as always: it renders as `anon` (0 live campaigns / 10 wrapped /
751 athletes) against 6 / 46 / 1,501 for a signed-in contact, so figures in the
attached shots are the anon view.

## Global

### 1 · The portal is branded for the brand

The brand's own dark-surface lockup sits left of the page title with "Brand
portal" beneath it, separated by a hairline so the two are read as two things
rather than one lockup. The Postgame mark stays in the rail — the two marks
never compete for the same corner.

**Nothing new is queried.** `attachPortalLogo()` already resolves a
dark-surface lockup from `brand_logos` for every session page, so the shell
only renders what `resolveSessionPortal()` had already fetched.

**A bug I wrote and then caught in the render:** the first cut used
`brand.portalLogo` directly and produced `src="[object Object]"` — that field
is the resolved logo ROW, not a URL. Probing the rendered `<img>` is what
surfaced it (`naturalWidth: 0`, src `/portal/[object%20Object]`); the file
itself was fine, 200 and 186KB.

**Not `pickBrandLogo()`, deliberately.** That shared helper's fallback chain
reaches `logo_dark_url` before `logo_light_url`, and per CLAUDE.md those names
describe the INK, not the background — `logo_dark_url` is dark ink for a LIGHT
background, which on this near-black ground renders as an invisible smudge.
The portal uses its own accessor that prefers the resolved dark-surface row and
then light-ink columns only. Brands with `brand_logos` rows are unaffected;
this only changes which legacy column a brand without them falls back to, and
`pickBrandLogo` is left alone for the light-background surfaces that use it
(invite email).

No logo on file sets the brand's NAME in Bebas. A name is a fact; a
placeholder square is not. And a client logo is never redrawn or generated —
it is the file from `brand_logos` or it is type.

### 2 · Labelled rail

200px with icon + label for the five destinations, Postgame mark at the top,
Settings and the account at the foot. Collapses to the 72px icon rail under
1100px, where the tooltips come back — they are what a collapsed rail falls
back to, and with a label beside the icon a tooltip repeating it is noise. The
phone tab bar below 640px is unchanged.

The account disc carries **initials**, not an empty circle: a blank disc reads
as a missing avatar, initials read as a person we have no photo of — the same
rule the roster, the athletes directory and Top athletes already follow. The
label is the signed-in person from `chrome.personLabel`, which exists on both
the brand-session and admin-preview branches.

### 4 · Search

"Search campaigns, athletes", and the field widened 260 → 320px. The placeholder
is 210px at 14px Arimo, so the old width truncated it before anyone typed
anything.
