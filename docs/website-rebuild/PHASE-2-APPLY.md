# Phase 2 — Apply Guide (for Claude Code)

**Goal:** add the reusable `<SlotEditor>` + a public homepage hero carousel, proving the slot system end-to-end. When done, you can add images to a "Hero Carousel" in `/dashboard/website` (Homepage tab) and they appear behind the headline on `/homepage`.

**What Cowork already did (no action needed):**
- Created the `slot_assignments` table (migration `website_rebuild_phase1_slot_assignments`).
- Added a `file_url` column (migration `website_rebuild_phase1b_slot_file_url`) so slots store image URLs, matching how the rest of the editor works.
- Backfilled 9 curated rows (6 Adidas brand heroes + 3 campaign heroes). The homepage hero slot starts empty — that's expected; Peyton fills it in the editor.

**Design decisions baked in (different from the original brief, on purpose):**
- Slots store the image **URL** in `slot_assignments.file_url`, not a `media_id`. Reason: your `CampaignMediaPicker` browses Supabase Storage and returns URLs; lots of those files have no `media` table row. URL-based matches your whole editor. `media_id` stays optional (the backfilled rows have it).
- `SlotEditor` **reuses your existing `CampaignMediaPicker`** instead of a new `MediaPicker.tsx`. No second picker to maintain.

---

## Step 1 (recommended): regenerate Supabase types

`slot_assignments` is new, so your `src/lib/database.types.ts` doesn't know it yet. Regenerate so TypeScript is happy:

```bash
npx supabase gen types typescript --project-id xqaybwhpgxillpbbqtks > src/lib/database.types.ts
```

(If you skip this, the code still compiles — `SlotEditor.tsx` and the homepage query use small `as any` casts as a safety net. Regenerating just makes it properly typed.)

---

## Step 2: add the two new component files

Copy these into the repo as-is:
- `phase2/SlotEditor.tsx`  →  `src/components/SlotEditor.tsx`
- `phase2/HomeHeroSlides.tsx`  →  `src/components/HomeHeroSlides.tsx`

---

## Step 3: edit the website editor — `src/app/dashboard/website/page.tsx`

**3a. Add the import** next to the other component imports (just below the `CampaignMediaPicker` import on ~line 11):

```tsx
import SlotEditor from "@/components/SlotEditor";
```

**3b. Add a "Hero Carousel" section** at the very top of `HomepageEditor`'s scroll area. Find this line (~line 230):

```tsx
      <div style={S.editScroll}>

        {/* Hero */}
        <SectionCard title="Hero">
```

Insert a new `SectionCard` **between** `<div style={S.editScroll}>` and `{/* Hero */}`:

```tsx
      <div style={S.editScroll}>

        {/* Hero Carousel (Phase 2 — slot_assignments) */}
        <SectionCard title="Hero Carousel">
          <SlotEditor
            slotKey="homepage.hero_carousel"
            title="Hero Images"
            maxItems={8}
            onSaved={onSaved}
          />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
            Cross-campaign images shown behind the homepage headline. Saves instantly — hit Republish (or wait ~60s) to push live.
          </div>
        </SectionCard>

        {/* Hero */}
        <SectionCard title="Hero">
```

Nothing else in `HomepageEditor` changes.

---

## Step 4: edit the public homepage — `src/app/homepage/page.tsx`

**4a. Add two imports** at the top (with the other imports):

```tsx
import { createPlainSupabase } from "@/lib/supabase";
import HomeHeroSlides, { type HeroSlide } from "@/components/HomeHeroSlides";
```

**4b. Load the hero slots.** Inside `HomepagePage`, just after this line:

```tsx
  const { page, sections } = data;
```

add:

```tsx
  // Hero carousel images (Phase 2 — slot_assignments). Empty = text-only hero.
  let heroSlides: HeroSlide[] = [];
  try {
    const sb = createPlainSupabase();
    const { data: slotRows } = await (sb as any)
      .from("slot_assignments")
      .select("file_url, focal_x, focal_y, scale, position")
      .eq("slot_key", "homepage.hero_carousel")
      .is("scope_id", null)
      .order("position", { ascending: true });
    heroSlides = (slotRows || [])
      .filter((r: any) => r.file_url)
      .map((r: any) => ({
        url: r.file_url as string,
        focalX: r.focal_x ?? 0.5,
        focalY: r.focal_y ?? 0.5,
        scale: r.scale ?? 1,
      }));
  } catch {}
```

**4c. Render the carousel behind the hero text.** Find the hero section:

```tsx
      {/* Hero */}
      <section className="hp-hero">
        <div className="hp-hero-inner">
```

Insert `<HomeHeroSlides>` as the **first child** of `<section className="hp-hero">`, right before `<div className="hp-hero-inner">`:

```tsx
      {/* Hero */}
      <section className="hp-hero">
        <HomeHeroSlides slides={heroSlides} />
        <div className="hp-hero-inner">
```

That's it. `.hp-hero` is already `position:relative; overflow:hidden`, and `.hp-hero-inner` is already `z-index:1`, so the images sit safely behind the headline. When `heroSlides` is empty, `HomeHeroSlides` renders nothing and the hero looks exactly as it does today.

> Note: `/homepage` uses `export const revalidate = 60`, so edits appear within ~60 seconds, or immediately when you hit Republish (Vercel revalidation).

---

## Step 5: verify, commit, push

Local check (`npm run dev`):
1. Open `/dashboard/website` → Homepage tab → see the new "Hero Carousel" section at top.
2. Click **+ Add Media**, pick 3 images, set a focal point on one (click the thumbnail) and a zoom.
3. Open `/homepage` → the 3 images crossfade behind the headline, in order, with your focal point applied; text stays readable; no black flashes.
4. Reorder with ▲▼ and confirm the order changes on `/homepage`.

Commit + push:

```
[website-rebuild phase 2] add SlotEditor + reuse CampaignMediaPicker; homepage hero carousel
```

Then tell Peyton it's live and green, and Cowork will start Phase 3 (migrating the Deals/Campaigns/Services carousels to `<SlotEditor>`).

---

## Files in this folder
- `SlotEditor.tsx` → `src/components/SlotEditor.tsx` (new)
- `HomeHeroSlides.tsx` → `src/components/HomeHeroSlides.tsx` (new)
- `PHASE-2-APPLY.md` → this guide (not copied into the repo)
