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

### 3 · Real thumbnails, generated once

`scripts/generate-portal-thumbnails.js`, run for CVS. **410 of 411 media rows
now have a generated 600px thumbnail in the bucket.**

| | rows | stored |
|---|---|---|
| generated from the original | 307 | 68.3 MB |
| generated from a video poster | 103 | 15.5 MB |
| unreadable, left alone | 1 | — |

**The 40-tile Content page, measured three times:**

| | total | transform calls |
|---|---|---|
| before pass 3 | 78.21 MB | 3 |
| pass 3 (every tile through the transform) | 9.69 MB | 40 |
| now (stored thumbnails) | **9.69 MB** | **1** |

Same bytes, and the transform is off the critical path: a tile no longer
depends on a separate service being up and unthrottled to render.

**Three things went wrong, and each changed the job.**

**1 · The transform rate-limits.** A first run at concurrency 6 lost 108 of 307
rows to `429`s. Added exponential backoff with jitter and dropped the default
concurrency to 3 with a breath between requests — the endpoint is shared with
the live site's own image loads. A 429 means "later", not "no".

**2 · The transform refuses very large originals.** 16 rows returned `400` no
matter how patiently retried. They are 27–33 MB and **45–50 megapixels** —
past Supabase's transform input limit. Those are now resized locally with
`sharp` instead (already a dependency), with `limitInputPixels` raised because
these ARE the huge ones and the default guard is about untrusted input, not
our own bucket.

  **This was a live bug, not just a job problem.** Since pass 3 the portal
  routes every tile through the transform — so those 16 tiles have been
  rendering as broken images in production. My pass-3 measurement sampled 40
  tiles and happened to contain none of them.

**3 · "Distinct" is not "small", and skipping on it was wrong.** The first cut
treated any `thumbnail_url` differing from `file_url` as done. Measuring CVS's
104 such rows: they average **3,957 KB** and the largest is **22.12 MB** —
full-size images, mostly video poster frames, living at another path. Reading
them directly took the same 40-tile page to **25.23 MB**, worse than the
transform call it replaced.

  So the "done" test became "the thumbnail is one this job made"
  (`/portal-thumbs/`), and video rows are now resized **from their poster**
  rather than skipped — an image transform cannot open an `.mp4`, but the
  poster is an image, and those 103 posters were the heaviest tiles on the
  page. 162.3 MB of posters became 15.5 MB.

**The one failure** is an extensionless file whose poster is also extensionless
and is not a decodable image (`CVS_postgame_video_-_Callie_Freeman`) — the same
family as the two unidentifiable rows logged in pass 1. Neither the transform
nor sharp can read it. The job writes only on success, so that row keeps what
it had and the app's fallback carries it.

**Reading order in the app is now:** stored thumbnail (if web-safe and not
just the original) → transform of the original → the original. A stored
thumbnail still needs a fallback because an object can go missing; the
transform path stays for rows no job has reached — other brands, and anything
imported since.
