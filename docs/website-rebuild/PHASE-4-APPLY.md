# Phase 4 — Apply Guide (for Claude Code)

**Goal:** add brand-page and campaign-page editors inside the website editor, and move the public brand + campaign pages onto `slot_assignments` — **with graceful fallback** so nothing goes blank.

**Two decisions Peyton made that shape this phase:**
1. **Empty hero slot → fall back to today's auto behavior** (don't blank). Only Adidas (6 rows) and one campaign (3 rows) have curated heroes right now; everything else keeps working exactly as today.
2. **Grids/galleries: the slot is an *optional override*.** If `featured_campaigns` / `gallery` slots have rows, use them; if empty, show today's full automatic list. No brand grid or campaign gallery ever goes blank.

**Architecture notes (decided after reading the live code):**
- The website editor is **one component** using `?page=` query params, not separate routes. So the brand/campaign editors plug in as `?page=brand&slug=…` and `?page=campaign&id=…` sub-views inside the existing shell (keeps the sidebar + live preview). This is the v3 brief's allowed "sub-route inside the existing editor" option.
- **Brand list comes from the static `src/lib/data/brands.ts`** (`allBrands`), NOT the DB. `brands.show_on_clients_page` is `true` for 0 rows, so the brief's DB filter would be empty. The nav uses the `featured` + `partner` tiers (~30 brands that actually have rich pages).
- **`featured_campaigns` picks recaps, not media** → a dedicated `<RecapSlotEditor>` (new file), not an overload of `<SlotEditor>`.
- **Slots are keyed by `slot_key` alone** (Cowork nulled `scope_id` on all rows; the slug/id is already in the key). Call `SlotEditor` without `scopeId`.

---

## Step 0 — what Cowork already did (no action needed)

Against `xqaybwhpgxillpbbqtks`:
- **Fixed a Phase 1 gap:** the 9 backfilled rows had `media_id` but no `file_url`; populated `file_url` from `media` (Adidas hero ×6, campaign hero ×3 now render).
- **Normalized `scope_id` to null** on all rows (slots key purely by `slot_key`).
- **Did NOT drop `brand_heroes` yet** — see Step 6. (Good news: the live brand page reads `campaign_recaps.featured`, not `brand_heroes`, so the drop is low-risk and not blocking.)

(Optional, recommended) regenerate types: `npx supabase gen types typescript --project-id xqaybwhpgxillpbbqtks > src/lib/database.types.ts`

---

## Step 1 — add three new component files

Copy from this folder into the repo:
- `RecapSlotEditor.tsx`   → `src/components/RecapSlotEditor.tsx`
- `BrandPageEditor.tsx`    → `src/components/BrandPageEditor.tsx`
- `CampaignPageEditor.tsx` → `src/components/CampaignPageEditor.tsx`

(`SlotEditor` already exists from Phases 2–3 and is reused.)

---

## Step 2 — wire the editors into the shell (`src/app/dashboard/website/page.tsx`)

**2a. Imports** (with the other component imports near the top):
```tsx
import BrandPageEditor from "@/components/BrandPageEditor";
import CampaignPageEditor from "@/components/CampaignPageEditor";
import { allBrands } from "@/lib/data/brands";
```

**2b. Inside `WebsiteEditorInner()`**, just after `const setPage = (p: string) => …;`, add state + helpers:
```tsx
  const supabase = createBrowserSupabase();
  const brandSlug = params.get("slug") || "";
  const campaignId = params.get("id") || "";
  const [clientsOpen, setClientsOpen] = useState(activePage === "brand");
  const [campaignsOpen, setCampaignsOpen] = useState(activePage === "campaign");
  const [navRecaps, setNavRecaps] = useState<{ id: string; name: string | null; slug: string | null; brandSlug: string | null }[]>([]);

  useEffect(() => {
    (supabase as any)
      .from("campaign_recaps")
      .select("id, name, slug, brands(slug)")
      .eq("type", "recap")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }: any) =>
        setNavRecaps((data || []).map((r: any) => ({ id: r.id, name: r.name, slug: r.slug, brandSlug: r.brands?.slug ?? null })))
      );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navBrands = allBrands.filter((b) => b.tier === "featured" || b.tier === "partner");
  const go = (qs: string) => router.push(`/dashboard/website?${qs}`, { scroll: false });
  const headerLabel = activePage === "brand" ? "Brand Page" : activePage === "campaign" ? "Campaign Page" : activeMeta.label;
```

**2c. Preview URL.** Replace:
```tsx
  const previewUrl = activeMeta.url;
```
with:
```tsx
  let previewUrl = activeMeta.url;
  if (activePage === "brand" && brandSlug) previewUrl = `/clients/${brandSlug}`;
  if (activePage === "campaign" && campaignId) {
    const r = navRecaps.find((x) => x.id === campaignId);
    previewUrl = r?.brandSlug && r?.slug ? `/clients/${r.brandSlug}/${r.slug}` : "/campaigns";
  }
```

**2d. Edit-pane title.** In the edit header, change `{activeMeta.label}` to `{headerLabel}`.

**2e. Sidebar expansion.** Replace the section-map block (the `{["Public Pages", "Services"].map(section => ( … ))}` block) with this version, which adds collapsible brand/campaign sub-lists under Clients and Campaigns:
```tsx
          {["Public Pages", "Services"].map(section => (
            <div key={section}>
              <div style={S.sidebarSection}>{section}</div>
              {PAGES.filter(p => p.section === section).map(p => (
                <div key={p.key}>
                  <div
                    style={S.sidebarItem(activePage === p.key)}
                    onClick={() => {
                      if (p.key === "clients") setClientsOpen(o => !o);
                      else if (p.key === "campaigns") setCampaignsOpen(o => !o);
                      setPage(p.key);
                    }}
                  >
                    <span style={{ fontSize:14 }}>{p.icon}</span>
                    <span>{p.label}</span>
                    {(p.key === "clients" || p.key === "campaigns") && (
                      <span style={{ marginLeft:"auto", fontSize:10, color:C.text3 }}>
                        {(p.key === "clients" ? clientsOpen : campaignsOpen) ? "▾" : "▸"}
                      </span>
                    )}
                  </div>

                  {p.key === "clients" && clientsOpen && navBrands.map(b => (
                    <div key={b.slug} onClick={() => go(`page=brand&slug=${b.slug}`)}
                      style={{ ...S.sidebarItem(activePage === "brand" && brandSlug === b.slug), marginLeft:14, padding:"6px 16px" }}>
                      <span style={{ fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.name}</span>
                    </div>
                  ))}

                  {p.key === "campaigns" && campaignsOpen && navRecaps.map(r => (
                    <div key={r.id} onClick={() => go(`page=campaign&id=${r.id}`)}
                      style={{ ...S.sidebarItem(activePage === "campaign" && campaignId === r.id), marginLeft:14, padding:"6px 16px" }}>
                      <span style={{ fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name || "(untitled)"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
```

**2f. Render the editors.** Right after the `svc-experiential` conditional render line, add:
```tsx
          {activePage === "brand"    && <BrandPageEditor slug={brandSlug} onSaved={handleSaved} />}
          {activePage === "campaign" && <CampaignPageEditor recapId={campaignId} onSaved={handleSaved} />}
```

---

## Step 3 — public brand page (`src/app/clients/[slug]/page.tsx`)

All edits are inside `loadBrandPageData(brand)` plus one new render block. The page already builds `featuredHero`, `coverHero`, `heroPool`, and `campaignList`.

**3a. Read the slots** (add near the end of `loadBrandPageData`, before the `return`):
```tsx
  const slug = brand.slug;
  const { data: slotRows } = await supabase
    .from("slot_assignments")
    .select("slot_key, file_url, text_value, recap_id, position")
    .in("slot_key", [`brand.${slug}.hero_carousel`, `brand.${slug}.featured_campaigns`, `brand.${slug}.pull_quote`])
    .order("position", { ascending: true });
  const slots = (slotRows || []) as any[];
  const heroSlotImages = slots.filter(s => s.slot_key === `brand.${slug}.hero_carousel` && s.file_url).map(s => s.file_url as string);
  const featuredRecapIds = slots.filter(s => s.slot_key === `brand.${slug}.featured_campaigns` && s.recap_id).map(s => s.recap_id as string);
  const pq = slots.find(s => s.slot_key === `brand.${slug}.pull_quote`);
  const pullQuote = pq ? { image: pq.file_url as string | null, text: pq.text_value as string | null } : null;
```

**3b. Hero fallback.** Change the existing `heroPool` line:
```tsx
  const heroPool: string[] = featuredHero.length > 0 ? featuredHero : coverHero;
```
to:
```tsx
  const heroPool: string[] =
    heroSlotImages.length > 0 ? heroSlotImages
    : featuredHero.length > 0 ? featuredHero
    : coverHero;
```

**3c. Featured-campaigns override.** After `campaignList` is built, add:
```tsx
  const orderedCampaigns = featuredRecapIds.length > 0
    ? featuredRecapIds.map(id => campaignList.find(c => c.id === id)).filter(Boolean) as CampaignRow[]
    : campaignList;
```
Return `orderedCampaigns` as `campaigns` (and add `pullQuote` to the returned object). Update the destructure in `BrandPage` to pull `pullQuote`.

**3d. Render the pull quote** (in `BrandPage`, e.g. right before the `{/* ================== CAMPAIGN GRID */}` section):
```tsx
      {pullQuote && (pullQuote.image || pullQuote.text) && (
        <section className="bp-pullquote" style={{ position:"relative", padding:"64px 48px", textAlign:"center" }}>
          {pullQuote.image && (
            <img src={pullQuote.image} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.25 }} />
          )}
          {pullQuote.text && (
            <p style={{ position:"relative", maxWidth:780, margin:"0 auto", fontSize:"clamp(22px,3vw,34px)", lineHeight:1.3, fontWeight:700 }}>
              {pullQuote.text}
            </p>
          )}
        </section>
      )}
```
(Style it to taste — the data contract is `pullQuote.image` + `pullQuote.text`.)

> Leave the existing `featuredMediaQ` (`campaign_recaps.featured`) query in place — it's now the *fallback* hero source. It gets removed in Phase 6 when `featured` is dropped. Do not query `brand_heroes` (the page never did).

---

## Step 4 — public campaign page (`src/app/clients/[slug]/[campaign]/page.tsx`)

The page already builds `heroStills` (from `manualHeroes`/auto-pick) and `images`/`videos` for the gallery.

**4a. Read the slots** (after `media` is loaded and `campaign` is known):
```tsx
  const { data: campSlots } = await supabase
    .from("slot_assignments")
    .select("slot_key, file_url, focal_x, focal_y, scale, position")
    .in("slot_key", [`campaign.${campaign.id}.hero_carousel`, `campaign.${campaign.id}.gallery`])
    .order("position", { ascending: true });
  const cs = (campSlots || []) as any[];
  const heroSlot = cs.filter(s => s.slot_key === `campaign.${campaign.id}.hero_carousel` && s.file_url);
  const gallerySlot = cs.filter(s => s.slot_key === `campaign.${campaign.id}.gallery` && s.file_url);
  const isVid = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
```

**4b. Hero fallback.** Where `heroStills` is built, prefer the slot:
```tsx
  const heroStills: HeroStill[] = heroSlot.length > 0
    ? heroSlot.map((s: any) => ({ src: s.file_url, alt: campaign.name, focalX: s.focal_x ?? 0.5, focalY: s.focal_y ?? 0.5, scale: s.scale ?? 1 }))
    : heroCandidates.map((m: any) => ({ src: m.file_url, alt: campaign.name, focalX: typeof m.focal_x === "number" ? m.focal_x : 0.5, focalY: typeof m.focal_y === "number" ? m.focal_y : 0.5, scale: typeof m.hero_scale === "number" ? m.hero_scale : 1.0 }));
```

**4c. Gallery override.** If `gallerySlot` has rows, build `images`/`videos` from it; otherwise keep today's `allImages`/`allVideos` mapping:
```tsx
  const galleryImages = gallerySlot.length > 0
    ? gallerySlot.filter((s: any) => !isVid(s.file_url)).map((s: any, i: number) => ({ id: `slot-img-${i}`, src: s.file_url, thumb: variantUrl(s.file_url, "w400"), isVideo: false, poster: null, alt: campaign.name, focalX: s.focal_x ?? 0.5, focalY: s.focal_y ?? 0.5 }))
    : images;
  const galleryVideos = gallerySlot.length > 0
    ? gallerySlot.filter((s: any) => isVid(s.file_url)).map((s: any, i: number) => ({ id: `slot-vid-${i}`, src: s.file_url, thumb: s.file_url, isVideo: true, poster: null, alt: campaign.name, focalX: 0.5, focalY: 0.5 }))
    : videos;
```
Then pass `galleryImages` / `galleryVideos` to `<WorkGallery images={…} videos={…} />` (replacing `images`/`videos`).

> Leave the `media.is_hero` columns/queries in place — they're the fallback now and get dropped in Phase 6.

---

## Step 5 — verify, commit, push

`npm run dev`:
1. `/dashboard/website` → **Clients** expands → click **adidas**: 3 slots; hero shows the 6 curated images. `/clients/adidas` still renders its hero (now from the slot).
2. Click another brand (e.g. **Hollister**): empty slots; `/clients/hollister` looks **exactly as before** (auto hero + full campaign grid). Add a hero image → it appears.
3. **Campaigns** expands → pick the backfilled campaign: hero shows 3 images; its public page still works. Pick another campaign: empty hero slot, page auto-picks as before; gallery still shows all media.
4. Spot-check that no brand/campaign page went blank.

Commit + push:
```
[website-rebuild phase 4] brand + campaign page editors; public pages read slot_assignments with auto fallback
```

Tell Peyton it's green. **Then Cowork finishes Phase 4 with Step 6.**

---

## Step 6 — drop `brand_heroes` (Cowork runs this AFTER Phase 4 is live)

Sequencing: Cowork will run `drop table brand_heroes;` only after (a) you confirm Phase 4 is deployed green, and (b) a repo grep for `brand_heroes` confirms nothing reads/writes it. The Adidas data is already preserved in `slot_assignments`, so the drop is non-destructive to the rebuild. **Do not drop it as part of this commit** — ping Cowork when Phase 4 is live and it'll handle the drop + the grep-check.

---

## Files in this folder
- `RecapSlotEditor.tsx` → `src/components/RecapSlotEditor.tsx` (new)
- `BrandPageEditor.tsx` → `src/components/BrandPageEditor.tsx` (new)
- `CampaignPageEditor.tsx` → `src/components/CampaignPageEditor.tsx` (new)
- `PHASE-4-APPLY.md` → this guide
