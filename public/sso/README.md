# SSO provider marks

Official provider artwork for the brand-portal sign-in buttons (`/portal/login`).
Both files are the providers' own artwork. Neither was drawn, redrawn, traced,
or AI-generated — the same standard the design system applies to client logos.

## Google

| File | What it is |
|---|---|
| `google-button-dark-source.svg` | Google's file, **unmodified**. From `Android + Web/SVG/Dark/Theme=Dark, Show text=No, Shape=Square` in the official bundle. |
| `google-g.svg` | The bare "G", cropped from the file above. **This is the one the button uses.** |

Bundle: `https://developers.google.com/static/identity/images/signin-assets.zip`
(downloaded 2026-09-08).

**Why a crop was needed.** The bundle ships complete Google-designed *buttons*,
not a standalone mark — every file in it draws its own container. The 40×40 dark
file paints a `#131314` rounded rect with a `#8E918F` stroke and then places the
mark inside. Nesting that container inside our glass button would mean showing a
button within a button, so the mark had to come out of it.

**What the crop did — and did not do.** Two elements were removed: the container
fill path and the container stroke path. The canvas was then reframed from
`viewBox="0 0 40 40"` to `viewBox="10 10 20 20"`, which is the mark's own 20×20
box as declared by Google's `<mask>` in that same file. No path data was edited,
no colour was changed, nothing was rescaled or redrawn. The transform is
mechanical and reproducible from the source file sitting next to it.

**Rules this mark carries.** Full colour always — never mono, never inverted,
never recoloured, never on an orange fill. Its size is fixed at render (20px)
rather than stretched to a box. Google's own geometry centres the 20px mark in a
40px button, i.e. 10px of clear space on every side; the button reproduces that
padding at the same ratio.

The file keeps one oddity from Google's Figma export: a `<path>` whose `fill`
attribute contains a JSON gradient descriptor instead of a colour. It is invalid
SVG, browsers ignore it, and the visible mark comes from the masked group. It was
left exactly as Google shipped it rather than "tidied", so this file stays
diffable against the source.

## Microsoft

`microsoft-logo.svg` — the official four-square symbol from Microsoft's
identity-platform branding guidance, byte-for-byte as supplied (343 bytes, 21×21,
`MS-SymbolLockup`). The symbol on its own is the approved form for a dark button.

Colours are `#f25022` `#7fba00` `#00a4ef` `#ffb900`. **Never recoloured** — not
tinted, not mono, not faded. If it cannot appear in full colour, it does not
appear.

## Adding another provider

Get the official asset from the provider, commit it unmodified, and note the
source and date here. If a crop or reframe is unavoidable, keep the untouched
original beside it, as `google-button-dark-source.svg` is kept, so the derivation
stays checkable.
