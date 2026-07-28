# Claude Code Brief — Catalogue Rebuild (Download → QC → Wire brand.html)

Repo: ~/postgame/hub. Run from repo root. Manifest file: `catalogue-render-manifest.json`
(place it in the repo root temporarily — do NOT commit it; it's a scratch file).

## Phase 1 — Download all renders
1. `git checkout main && git pull origin main`, then create branch `feat/catalogue-renders`.
2. Verify where brand.html and its assets live (expected: `public/brand.html`, `public/brand-assets/`).
   Investigate before assuming — `ls public/` first.
3. Create `public/brand-assets/catalogue-live/` and `public/brand-assets/catalogue-mockups/`.
4. For each entry in the manifest's `live` array: download `url` → `public/brand-assets/catalogue-live/{file}`.
   Same for `mockups` → `public/brand-assets/catalogue-mockups/{file}`.
   Use curl with retries; verify every file is >50KB after download; report any failures and stop if any.
5. Total expected: 69 live + 36 mockup files.

## Phase 2 — QC review sheet (STOP for Peyton's approval after this)
1. Generate a single throwaway `qc-review.html` in the repo root (do NOT commit):
   a grid of all 105 images with filename + product-name captions, live section first.
2. Open it for Peyton (`open qc-review.html`). He reviews every wordmark and color.
3. STOP. Wait for his explicit approval or a list of bad renders before Phase 3.
   Bad renders get re-rolled in the Claude chat, not fixed locally.

## Phase 3 — Rewrite the brand.html catalogue arrays (only after QC approval)
1. In brand.html, find the block between `/* CATALOGUE:START */` and `/* CATALOGUE:END */`.
2. Replace `catalogueLive` with 69 entries pointing at `brand-assets/catalogue-live/{file}`,
   in this order: school hoodies (alphabetical), school tees (alphabetical), then core products
   (definition tees, long sleeves, crops, bra, leggings, hoodies, tees, headwear, tank, shiesty).
3. Replace `catalogueMockups` with: the 36 entries at `brand-assets/catalogue-mockups/{file}`
   + the 3 existing spin video entries (keep their current paths unchanged).
4. Old image references that are no longer used: leave the old files in place for now
   (delete in a later cleanup pass — safer than deleting during the swap).
5. Do not touch anything outside the CATALOGUE block.

## Phase 4 — Verify and ship
1. Open brand.html locally, confirm: Live carousel shows charcoal renders, popup toggle works,
   Mockups shows white-studio renders + 3 videos.
2. One commit: "Catalogue: replace Live with charcoal product renders, Mockups with white-studio renders".
   `git add` only: brand.html + the two new asset folders. Nothing else.
3. Push branch, open PR on GitHub, merge there (never terminal merge), verify production.

## Notes
- The manifest CDN URLs are Higgsfield-hosted and may not live forever — that's why we copy
  into the repo now.
- Known QC risk spots: def-tee-white-back and longsleeve-back (small text), the 5 model-shot
  conversions (cotton-tee, dri-fit-tee, hoodie-black, hoodie-pink, hoodie-yellow), and the
  mockup "extract from model" items.
