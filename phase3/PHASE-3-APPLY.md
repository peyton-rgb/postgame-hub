# Phase 3 — Apply Guide (for Claude Code)

**Scope this phase (revised after verification):**
- ✅ **Services carousels → `<SlotEditor>`** (data already migrated by Cowork; preserves the optional per-photo brand logo).
- ✅ **Campaigns index hero → new `campaigns.hero` slot** (greenfield; additive crossfade behind the existing text hero).
- ⛔ **Deals: intentionally NOT changed.** Verification showed the Deals hero is auto-built from `deals.featured` rows with per-device focal/zoom and on-image deal nameplates — `slot_assignments` can't represent that without regressing it. Leave `/deals` and `DealsEditor` exactly as they are.

---

## Step 0 — what Cowork already did (no action needed)

Run against project `xqaybwhpgxillpbbqtks`:
- `website_rebuild_phase3_slot_logo_url` — added `slot_assignments.logo_url` (per-photo brand-logo overlay).
- Migrated the 4 Services carousels into `slot_assignments`: **32 rows** (8 each) with slot keys `svc-elevated.carousel`, `svc-scaled.carousel`, `svc-always-on.carousel`, `svc-experiential.carousel`. Each row has `file_url` (the public campaign-media URL), `focal_x=0.5`, `focal_y=0.2` (matches the old `"50% 20%"` default), `scale=1`. No logos were set in the source data, so `logo_url` is null on all — the capability is just ready for future use.

Verify if you want:
```sql
select slot_key, count(*) from slot_assignments where slot_key like 'svc-%.carousel' group by slot_key order by slot_key;
-- expect 8 rows for each of the four svc-*.carousel keys
```

(Optional, recommended) regenerate types so `logo_url`/`file_url` are known to TS:
```bash
npx supabase gen types typescript --project-id xqaybwhpgxillpbbqtks > src/lib/database.types.ts
```

---

## Step 1 — update the SlotEditor component

Replace `src/components/SlotEditor.tsx` with `phase3/SlotEditor.tsx`. The only change vs Phase 2 is a new optional `acceptsLogo` prop (adds a per-row brand-logo dropdown that writes `slot_assignments.logo_url`). Existing usages (the homepage hero) are unaffected.

> The `import SlotEditor from "@/components/SlotEditor";` line was already added to `dashboard/website/page.tsx` in Phase 2 — no need to add it again.

---

## Step 2 — Campaigns tab editor (`src/app/dashboard/website/page.tsx`)

In `CampaignsEditor`, add a hero slot above the existing "Campaigns" toggle list. Find:

```tsx
      <div style={S.editScroll}>
        <SectionCard title="Campaigns">
          <div style={{ fontSize:12, color:C.text3, marginBottom:12 }}>Toggle campaigns to control visibility on the public campaigns page.</div>
```

Insert a new `SectionCard` between `<div style={S.editScroll}>` and `<SectionCard title="Campaigns">`:

```tsx
      <div style={S.editScroll}>
        <SectionCard title="Page Hero">
          <SlotEditor slotKey="campaigns.hero" title="Campaigns Page Hero" maxItems={3} onSaved={onSaved} />
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:6 }}>
            Optional images shown behind the Campaigns page headline. Leave empty for the text-only hero.
          </div>
        </SectionCard>
        <SectionCard title="Campaigns">
```

---

## Step 3 — public Campaigns page (`src/app/campaigns/page.tsx`)

This is a server component that already uses `createClient` from `@supabase/supabase-js`.

**3a.** Add an import at the top (with the others):
```tsx
import HomeHeroSlides, { type HeroSlide } from "@/components/HomeHeroSlides";
```

**3b.** Add a loader next to `getCampaigns()`:
```tsx
async function getHeroSlides(): Promise<HeroSlide[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("slot_assignments")
      .select("file_url, focal_x, focal_y, scale, position")
      .eq("slot_key", "campaigns.hero")
      .is("scope_id", null)
      .order("position", { ascending: true });
    return (data || [])
      .filter((r: any) => r.file_url)
      .map((r: any) => ({ url: r.file_url, focalX: r.focal_x ?? 0.5, focalY: r.focal_y ?? 0.5, scale: r.scale ?? 1 }));
  } catch {
    return [];
  }
}
```

**3c.** In `CampaignsPage`, fetch the slides next to the campaigns:
```tsx
  const campaigns = await getCampaigns();
  const heroSlides = await getHeroSlides();   // add this line
```

**3d.** Wrap the hero content and drop the slides behind it. Replace this block:
```tsx
      <section className="hero">
        <div className="eyebrow">Our Work</div>
        <h1 className="d hero-title">394+ Campaigns.<br />One Playbook.</h1>
        <p className="hero-desc">From single-athlete posts to full-scale, multi-school activations — this is what athlete-powered marketing looks like at scale.</p>
      </section>
```
with:
```tsx
      <section className="hero" style={{ position: "relative", overflow: "hidden" }}>
        <HomeHeroSlides slides={heroSlides} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="eyebrow">Our Work</div>
          <h1 className="d hero-title">394+ Campaigns.<br />One Playbook.</h1>
          <p className="hero-desc">From single-athlete posts to full-scale, multi-school activations — this is what athlete-powered marketing looks like at scale.</p>
        </div>
      </section>
```
When `heroSlides` is empty, `HomeHeroSlides` renders nothing, so the page looks exactly as it does today.

---

## Step 4 — Services tab editor (`src/app/dashboard/website/page.tsx`, `ServicesEditor`)

**4a. Swap the carousel UI for `<SlotEditor>`.** Replace the entire `<SectionCard title="Carousel Photos"> … </SectionCard>` block (the thumbnail grid + "+ Add Photo" / "Edit Carousel" buttons) with:

```tsx
        <SectionCard title="Carousel Photos">
          <SlotEditor
            slotKey={`svc-${tab}.carousel`}
            title="Photo Carousel"
            maxItems={12}
            acceptsLogo
            onSaved={onSaved}
          />
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:6 }}>
            Photos save instantly. Use the per-photo focal point, zoom, and optional brand logo. Hit Save Changes to also push hero/feature text + Republish.
          </div>
        </SectionCard>
```

**4b. Remove the now-dead carousel code** in `ServicesEditor` (it's all replaced by `<SlotEditor>`), so there are no unused variables:
- the state/refs: `carouselPickerOpen`, `pendingPhoto`, `carouselBrands`, `carouselEditorOpen`, `carouselEditIdx`, `photoZooms`, `svcCarouselDragging`, `svcCarouselCanvas`
- the `useEffect` that loads `carouselBrands` (the `supabase.from("brands")…setCarouselBrands` one) — `SlotEditor` now loads its own brand logos
- the `useEffect` "Drag handler for services carousel editor"
- the `{carouselPickerOpen && ( <CampaignMediaPicker … /> )}` block
- the `{pendingPhoto && ( … )}` modal
- the `{carouselEditorOpen && (() => { … })()}` full-screen editor block

Keep everything else (`Hero`, `Features`, `CTA` SectionCards, `save()`, the load `useEffect`). **Do not remove the `CampaignMediaPicker` import** — `HomepageEditor` still uses it.

---

## Step 5 — public Services page(s)

I (Cowork) couldn't fetch the public Services file from the repo, so locate it on your side: it renders `/services/elevated`, `/services/scaled`, `/services/always-on`, `/services/experiential` (the editor revalidates exactly those paths). It currently reads the carousel from `pages` (`slug='services'`) → `settings.{service}.carousel_photos`.

**Change only the carousel's data source** to `slot_assignments`. Wherever it builds the carousel image list, replace the `carousel_photos` read with:

```ts
// serviceName = "elevated" | "scaled" | "always-on" | "experiential"
const { data: carouselRows } = await supabase
  .from("slot_assignments")
  .select("file_url, focal_x, focal_y, scale, logo_url, position")
  .eq("slot_key", `svc-${serviceName}.carousel`)
  .is("scope_id", null)
  .order("position", { ascending: true });

const carousel = (carouselRows || []).filter((r: any) => r.file_url);
```

Render each item the same way it renders today, mapping:
- image `src` = `file_url` (already a full public URL — no need to prepend the storage base anymore)
- `object-position` = `` `${focal_x * 100}% ${focal_y * 100}%` `` (the migrated default is `50% 20%`)
- `transform: scale(${scale})` when `scale !== 1`
- if `logo_url` is set, keep the existing bottom-right brand-logo overlay (none are set today, but honor it)

Leave the hero/features/CTA reads (from `pages.settings`) untouched — only the carousel source changes.

> Note: the old `carousel_photos` arrays still sit in `pages.settings` after this — harmless. We can prune them in a later cleanup; leaving them avoids any risk if you need to roll back.

---

## Step 6 — verify, commit, push

Local (`npm run dev`):
1. `/dashboard/website` → **Services → Elevated**: the new SlotEditor shows the 8 migrated photos. Reorder one, set a focal point, pick a brand logo. Open `/services/elevated` → confirm the change shows (Save / Republish triggers revalidation).
2. `/dashboard/website` → **Campaigns**: add 1–2 images to "Campaigns Page Hero". Open `/campaigns` → images crossfade behind "394+ Campaigns. One Playbook."; empty = unchanged text hero.
3. `/deals` — confirm it's **unchanged** (we deliberately didn't touch it).

Commit + push:
```
[website-rebuild phase 3] migrate Services carousels to SlotEditor; add Campaigns page hero; Deals left as-is
```

Then tell Peyton it's green. Phase 4 (brand + campaign page editors) is next — that's where `brand_heroes` finally gets dropped, after the public brand page is moved onto `slot_assignments`.

---

## Files in this folder
- `SlotEditor.tsx` → replaces `src/components/SlotEditor.tsx` (adds `acceptsLogo`)
- `PHASE-3-APPLY.md` → this guide
