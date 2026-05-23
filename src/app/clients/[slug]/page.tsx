// ============================================================
// Brand Partner Page — /clients/[slug]
//
// Server-rendered showcase for one brand we work with. All
// data is fetched on the server (anon Supabase) so the page
// can never get stuck on a client-side spinner. If a brand
// has no media yet (most don't), it still looks intentional:
// hero + partnership text + branded placeholder campaign cards.
//
// Sections, top to bottom:
//   1. Hero w/ crossfading recap reel + brand stats
//   2. Athlete montage (two marquees) — hidden if too sparse
//   3. Partnership/About + metadata side panel
//   4. Campaign grid (real photo if present, branded placeholder otherwise)
//   5. Closing "Work With Postgame" CTA
//
// Nav is the global SiteNav rendered from layout.tsx — we do
// NOT add a second nav here. Just the "← All Clients" crumb.
// ============================================================

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBrandBySlug, type Brand } from '@/lib/data/brands';
import { createPlainSupabase } from '@/lib/supabase';
import HeroSlideshow from './HeroSlideshow';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
};

interface CampaignRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hero_image_url: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
}

interface AthleteImage {
  athlete_name: string;
  sport: string | null;
  school: string | null;
  file_url: string;
}

// ------------------------------------------------------------
// Data load — server-side, all defensive, never throws upstream.
// ------------------------------------------------------------

async function loadBrandPageData(brand: Brand) {
  const supabase = createPlainSupabase();

  // 1) Live brand row (industry, website, logos, color overrides).
  //    Look up by slug first; fall back to case-insensitive name.
  const brandByIdQ = supabase
    .from('brands')
    .select(
      'id, name, slug, industry, website, primary_color, logo_url, logo_light_url, logo_white_url, tagline'
    )
    .eq('slug', brand.slug)
    .maybeSingle();

  const { data: brandRow } = await brandByIdQ;

  let brandDb = brandRow;
  if (!brandDb) {
    const { data: byName } = await supabase
      .from('brands')
      .select(
        'id, name, slug, industry, website, primary_color, logo_url, logo_light_url, logo_white_url, tagline'
      )
      .ilike('name', brand.name)
      .maybeSingle();
    brandDb = byName;
  }

  // 2) Campaigns — anon RLS restricts to published+public so we
  //    only see what we're allowed to show on the public site.
  const campaignsQ = brandDb
    ? supabase
        .from('campaigns')
        .select('id, name, slug, description, hero_image_url, thumbnail_url, created_at')
        .eq('brand_id', brandDb.id)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [] as CampaignRow[], error: null });

  // 3) Athlete-attributed media for marquee + hero reel.
  //    We pull the brand's images (joined to athletes for names/sport)
  //    via campaign_recaps so RLS naturally limits to published ones.
  const mediaQ = brandDb
    ? supabase
        .from('media')
        .select(
          `file_url, type,
           athletes!inner(name, sport, school),
           campaign_recaps!inner(brand_id, published)`
        )
        .eq('type', 'image')
        .eq('campaign_recaps.brand_id', brandDb.id)
        .limit(60)
    : Promise.resolve({ data: [], error: null });

  const [{ data: campaigns, error: campErr }, { data: mediaRows, error: mediaErr }] =
    await Promise.all([campaignsQ, mediaQ]);

  if (campErr) console.error('[clients/[slug]] campaigns error:', campErr.message);
  if (mediaErr) console.error('[clients/[slug]] media error:', mediaErr.message);

  // Normalize athlete-image rows (one per athlete for the marquee).
  const allImages: AthleteImage[] = ((mediaRows as any[] | null) || [])
    .map((r) => {
      const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes;
      if (!a || !a.name || !r.file_url) return null;
      return {
        athlete_name: a.name as string,
        sport: (a.sport as string) ?? null,
        school: (a.school as string) ?? null,
        file_url: r.file_url as string,
      } satisfies AthleteImage;
    })
    .filter((x): x is AthleteImage => x !== null);

  // Keep one image per athlete to avoid duplicate tiles.
  const seenAthletes = new Set<string>();
  const athleteTiles: AthleteImage[] = [];
  for (const img of allImages) {
    if (seenAthletes.has(img.athlete_name)) continue;
    seenAthletes.add(img.athlete_name);
    athleteTiles.push(img);
  }

  // Stats — counted from the full image set (not the deduped tiles).
  const athleteSet = new Set<string>();
  const schoolSet = new Set<string>();
  const sportSet = new Set<string>();
  for (const r of allImages) {
    athleteSet.add(r.athlete_name);
    if (r.school) schoolSet.add(r.school);
    if (r.sport) sportSet.add(r.sport);
  }

  const campaignList: CampaignRow[] = (campaigns as CampaignRow[] | null) || [];

  // "Partner Since" = earliest campaign date we know about.
  let partnerSince: Date | null = null;
  for (const c of campaignList) {
    if (!c.created_at) continue;
    const d = new Date(c.created_at);
    if (Number.isNaN(d.getTime())) continue;
    if (!partnerSince || d < partnerSince) partnerSince = d;
  }

  return {
    brandDb,
    campaigns: campaignList,
    athleteTiles,
    stats: {
      athletes: athleteSet.size,
      campaigns: campaignList.length,
      schools: schoolSet.size,
      sports: sportSet.size,
      partnerSince,
    },
  };
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();

  const { brandDb, campaigns, athleteTiles, stats } = await loadBrandPageData(brand);

  // Color + logo resolution — DB value wins, brands.ts is the fallback.
  const primaryColor = brandDb?.primary_color || brand.primaryColor || '#1A1A1A';
  const heroLogo =
    brandDb?.logo_white_url ||
    brandDb?.logo_light_url ||
    brandDb?.logo_url ||
    brand.logoUrl ||
    null;
  const industry = brandDb?.industry || brand.category || null;
  const website = brandDb?.website || null;

  // Hero reel images (top of the athlete tile list, deduped, photos only).
  const heroImages = athleteTiles.slice(0, 7).map((t) => t.file_url);

  // Marquee data — split into two rows, only show the section if rich enough.
  const marqueeReady = athleteTiles.length >= 8;
  const half = Math.ceil(athleteTiles.length / 2);
  const row1 = athleteTiles.slice(0, half);
  const row2 = athleteTiles.slice(half);

  // Years partnership (rounded down). null when we have no campaigns.
  let partnerYears: number | null = null;
  let partnerSinceLabel: string | null = null;
  if (stats.partnerSince) {
    partnerSinceLabel = stats.partnerSince.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    const now = new Date();
    const months =
      (now.getFullYear() - stats.partnerSince.getFullYear()) * 12 +
      (now.getMonth() - stats.partnerSince.getMonth());
    partnerYears = Math.max(0, Math.floor(months / 12));
  }

  const websiteDisplay = website
    ? website.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : null;

  return (
    <div className="bp-root">
      <style>{BP_CSS}</style>

      {/* Breadcrumb (the only nav on this page — SiteNav is global from layout) */}
      <div className="bp-crumb">
        <Link href="/clients">← All Clients</Link>
      </div>

      {/* ======================= HERO ======================= */}
      <header className="bp-hero">
        <HeroSlideshow images={heroImages} />
        <div className="bp-scrim" style={{ ['--bp-glow' as any]: `${primaryColor}55` }} />

        <div className="bp-hero-inner">
          <div className="bp-kicker">
            Brand Partner{partnerSinceLabel ? ` · Since ${partnerSinceLabel}` : ''}
          </div>

          {heroLogo ? (
            <img
              className="bp-hero-logo"
              src={heroLogo}
              alt={brand.name}
              loading="eager"
            />
          ) : (
            <div className="bp-hero-wordmark">{brand.name}</div>
          )}

          <p className="bp-hero-desc">
            {brand.name} partners with <strong>Postgame</strong> to reach Gen&nbsp;Z
            through college athletes — casting the talent, producing the content,
            and turning campus moments into campaigns that perform where young
            fans live.
          </p>

          <div className="bp-stats">
            <Stat num={stats.athletes} label="Athletes" />
            <Stat num={stats.campaigns} label="Campaigns" />
            <Stat num={stats.schools} label="Schools" />
            <Stat num={stats.sports} label="Sports" />
            {partnerYears !== null && (
              <Stat
                num={partnerYears === 0 ? '<1' : String(partnerYears)}
                label={partnerYears === 1 ? 'Yr Partner' : 'Yrs Partner'}
              />
            )}
          </div>
        </div>
      </header>

      {/* ===================== MONTAGE ===================== */}
      {marqueeReady && (
        <section className="bp-montage">
          <div className="bp-montage-label">
            <b>The Work</b> · athletes {brand.name} has activated through Postgame
          </div>
          <div className="bp-montage-fade l" />
          <div className="bp-montage-fade r" />

          <Marquee tiles={row1} direction="left" />
          {row2.length > 0 && <Marquee tiles={row2} direction="right" />}
        </section>
      )}

      {/* =================== PARTNERSHIP =================== */}
      <section className="bp-about">
        <div>
          <h2 className="bp-about-h">
            Built on <em>real college culture.</em>
          </h2>
          <p>
            Since{' '}
            <strong>{partnerSinceLabel ?? 'launch'}</strong>, Postgame has
            partnered with {brand.name} on{' '}
            <strong>
              {stats.campaigns > 0
                ? `${stats.campaigns} campaign${stats.campaigns === 1 ? '' : 's'}`
                : 'an evolving roster of work'}
            </strong>
            {stats.athletes > 0 ? (
              <>
                {' '}
                across{' '}
                <strong>
                  {stats.athletes} athlete{stats.athletes === 1 ? '' : 's'}
                </strong>
                {stats.schools > 0 ? (
                  <>
                    {' '}
                    and {stats.schools} school{stats.schools === 1 ? '' : 's'}
                  </>
                ) : null}
              </>
            ) : null}
            . Every campaign is cast, produced, and shipped end to end — built
            to show up in college culture as a participant, not an advertiser.
          </p>
          {stats.campaigns === 0 && (
            <p>
              Campaign recaps for {brand.name} will appear here as they go live.
              In the meantime, this page tracks the partnership at a glance.
            </p>
          )}
        </div>
        <aside className="bp-about-side">
          {industry && (
            <div className="bp-row">
              <div className="bp-k">Industry</div>
              <div className="bp-v">{industry}</div>
            </div>
          )}
          {partnerSinceLabel && (
            <div className="bp-row">
              <div className="bp-k">Partner Since</div>
              <div className="bp-v">{partnerSinceLabel}</div>
            </div>
          )}
          <div className="bp-row">
            <div className="bp-k">Program Type</div>
            <div className="bp-v">Always-on athlete content</div>
          </div>
          {website && websiteDisplay && (
            <div className="bp-row">
              <div className="bp-k">Website</div>
              <div className="bp-v">
                <a href={website} target="_blank" rel="noopener noreferrer">
                  {websiteDisplay}&nbsp;↗
                </a>
              </div>
            </div>
          )}
        </aside>
      </section>

      {/* ================== CAMPAIGN GRID ================== */}
      {campaigns.length > 0 && (
        <section className="bp-work">
          <div className="bp-work-head">
            <h2>Campaigns</h2>
            <div className="bp-count">
              {campaigns.length} total
            </div>
          </div>
          <div className="bp-grid">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                brand={brand}
                href={`/clients/${slug}/${c.slug}`}
                primaryColor={primaryColor}
                heroLogo={heroLogo}
              />
            ))}
          </div>
        </section>
      )}

      {/* ===================== CTA ====================== */}
      <section className="bp-cta">
        <div className="bp-cta-inner">
          <div className="bp-cta-kicker">Work With Postgame</div>
          <h2 className="bp-cta-h">
            Want a run like <em>{brand.name}&rsquo;s?</em>
          </h2>
          <p className="bp-cta-p">
            We&rsquo;ll cast the athletes, produce the content, and run the
            campaign end to end — tell us what you&rsquo;re launching.
          </p>
          <div className="bp-cta-btns">
            <Link href="/contact" className="bp-cta-btn solid">
              Start a Campaign
            </Link>
            <Link href="/campaigns" className="bp-cta-btn ghost">
              See Our Work
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------

function Stat({ num, label }: { num: number | string; label: string }) {
  return (
    <div className="bp-stat">
      <div className="bp-num">{num}</div>
      <div className="bp-lab">{label}</div>
    </div>
  );
}

function Marquee({
  tiles,
  direction,
}: {
  tiles: AthleteImage[];
  direction: 'left' | 'right';
}) {
  const doubled = [...tiles, ...tiles];
  return (
    <div className={`bp-marquee${direction === 'right' ? ' row2' : ''}`}>
      {doubled.map((t, i) => (
        <div key={`${t.athlete_name}-${i}`} className="bp-tile">
          <img src={t.file_url} alt={t.athlete_name} loading="lazy" />
          <div className="bp-tile-cap">
            <div className="bp-nm">{t.athlete_name}</div>
            {t.sport && <div className="bp-mt">{t.sport}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignCard({
  campaign,
  brand,
  href,
  primaryColor,
  heroLogo,
}: {
  campaign: CampaignRow;
  brand: Brand;
  href: string;
  primaryColor: string;
  heroLogo: string | null;
}) {
  const photo = campaign.hero_image_url || campaign.thumbnail_url;
  if (photo) {
    return (
      <Link href={href} className="bp-card">
        <img src={photo} alt={campaign.name} loading="lazy" />
        <div className="bp-card-grad" />
        <div className="bp-card-arrow">↗</div>
        <div className="bp-card-body">
          <div className="bp-ttl">{campaign.name}</div>
          <div className="bp-meta">{brand.name} · Recap</div>
        </div>
      </Link>
    );
  }
  // Branded placeholder — gradient using brand color + centered white logo.
  return (
    <Link
      href={href}
      className="bp-card bp-card-ph"
      style={{
        background: `linear-gradient(155deg, ${primaryColor}cc 0%, ${primaryColor} 55%, #050505 100%)`,
      }}
    >
      <span className="bp-tag">Recap</span>
      {heroLogo && (
        <img className="bp-phlogo" src={heroLogo} alt="" loading="lazy" />
      )}
      <div className="bp-card-grad" />
      <div className="bp-card-arrow">↗</div>
      <div className="bp-card-body">
        <div className="bp-ttl">{campaign.name}</div>
        <div className="bp-meta">{brand.name} · Recap</div>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------
// Inline CSS — scoped to .bp-* so it can't leak.
// Adapted from the approved design mockup; no element selectors
// that could collide with SiteNav or other global styles.
// ------------------------------------------------------------

const BP_CSS = `
.bp-root{--bp-line:rgba(255,255,255,0.09);--bp-line-b:rgba(255,255,255,0.20);--bp-ink:#fff;--bp-dim:#9a9a95;--bp-orange:#D73F09;background:#000;color:var(--bp-ink);font-family:Inter,Arial,system-ui,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased;}
.bp-root em{font-style:normal;color:var(--bp-orange);}
.bp-root a{color:inherit;text-decoration:none;}

.bp-crumb{max-width:1240px;margin:0 auto;padding:96px 32px 0;}
.bp-crumb a{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--bp-dim);}
.bp-crumb a:hover{color:var(--bp-orange);}

.bp-hero{position:relative;width:100%;min-height:88vh;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;border-bottom:1px solid var(--bp-line);}
.bp-slides{position:absolute;inset:0;z-index:0;background:#000;}
.bp-slide{position:absolute;inset:0;opacity:0;transition:opacity 1.4s ease;background-size:cover;background-position:center 18%;animation:bp-kenburns 13s ease-in-out infinite alternate;}
.bp-slide.active{opacity:1;}
@keyframes bp-kenburns{from{transform:scale(1.02);}to{transform:scale(1.09);}}
.bp-dots{position:absolute;bottom:24px;left:32px;z-index:3;display:flex;gap:7px;}
.bp-dots span{width:22px;height:3px;background:rgba(255,255,255,.28);border-radius:2px;transition:background .3s;}
.bp-dots span.on{background:var(--bp-orange);}
.bp-scrim{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.15) 32%,rgba(0,0,0,.55) 68%,rgba(0,0,0,.94) 100%);}
.bp-scrim::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 90% at 18% 100%,var(--bp-glow,rgba(215,63,9,.30)),transparent 55%);opacity:.5;mix-blend-mode:screen;}
.bp-hero-inner{position:relative;z-index:2;max-width:1240px;width:100%;margin:0 auto;padding:0 32px 56px;}

.bp-kicker{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--bp-orange);display:flex;align-items:center;gap:14px;margin-bottom:22px;}
.bp-kicker::before{content:'';width:34px;height:1.5px;background:var(--bp-orange);}

.bp-hero-logo{height:96px;width:auto;max-width:min(440px,80vw);object-fit:contain;object-position:left;margin-bottom:26px;filter:drop-shadow(0 4px 30px rgba(0,0,0,.6));background:rgba(255,255,255,.06);padding:14px 22px;border-radius:8px;}
.bp-hero-wordmark{font-family:var(--font-bebas),Impact,sans-serif;font-size:84px;line-height:.94;letter-spacing:.01em;margin-bottom:26px;color:#fff;}

.bp-hero-desc{max-width:660px;font-size:19px;line-height:1.6;color:#ececec;font-weight:400;}
.bp-hero-desc strong{font-weight:700;color:#fff;}

.bp-stats{display:flex;flex-wrap:wrap;gap:0;margin-top:38px;border-top:1px solid var(--bp-line-b);border-bottom:1px solid var(--bp-line-b);}
.bp-stat{padding:20px 30px 18px 0;margin-right:30px;border-right:1px solid var(--bp-line);min-width:96px;}
.bp-stat:last-child{border-right:none;margin-right:0;}
.bp-num{font-family:var(--font-bebas),Impact,sans-serif;font-size:46px;line-height:.9;letter-spacing:.01em;color:#fff;}
.bp-lab{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--bp-dim);margin-top:8px;}

.bp-montage{position:relative;background:#000;padding:34px 0 38px;border-bottom:1px solid var(--bp-line);overflow:hidden;}
.bp-montage-label{max-width:1240px;margin:0 auto 22px;padding:0 32px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--bp-dim);display:flex;align-items:center;gap:12px;}
.bp-montage-label b{color:var(--bp-orange);font-weight:700;}
.bp-marquee{display:flex;gap:14px;width:max-content;animation:bp-scrollLeft 60s linear infinite;}
.bp-marquee.row2{animation:bp-scrollRight 72s linear infinite;margin-top:14px;}
.bp-montage:hover .bp-marquee{animation-play-state:paused;}
@keyframes bp-scrollLeft{from{transform:translateX(0);}to{transform:translateX(-50%);}}
@keyframes bp-scrollRight{from{transform:translateX(-50%);}to{transform:translateX(0);}}
.bp-tile{position:relative;flex:0 0 auto;width:236px;height:300px;border-radius:6px;overflow:hidden;background:#151518;border:1px solid var(--bp-line);}
.bp-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s ease;}
.bp-tile:hover img{transform:scale(1.05);}
.bp-tile-cap{position:absolute;left:0;right:0;bottom:0;padding:30px 14px 12px;background:linear-gradient(transparent,rgba(0,0,0,.88));}
.bp-nm{font-weight:700;font-size:14px;color:#fff;}
.bp-mt{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--bp-dim);margin-top:3px;}
.bp-montage-fade{position:absolute;top:0;bottom:0;width:120px;z-index:3;pointer-events:none;}
.bp-montage-fade.l{left:0;background:linear-gradient(90deg,#000,transparent);}
.bp-montage-fade.r{right:0;background:linear-gradient(270deg,#000,transparent);}

.bp-about{max-width:1240px;margin:0 auto;padding:80px 32px;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:64px;}
.bp-about-h{font-family:var(--font-bebas),Impact,sans-serif;font-size:64px;line-height:.94;letter-spacing:.01em;margin-bottom:26px;}
.bp-about-h em{color:var(--bp-orange);}
.bp-about p{font-size:17px;line-height:1.75;color:#cfcfca;margin-bottom:18px;max-width:640px;}
.bp-about p strong{color:#fff;font-weight:600;}
.bp-about-side{border-left:1px solid var(--bp-line);padding-left:32px;}
.bp-row{padding:16px 0;border-bottom:1px solid var(--bp-line);}
.bp-row:first-child{padding-top:0;}
.bp-k{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--bp-dim);}
.bp-v{font-size:15px;color:#fff;margin-top:5px;font-weight:600;}
.bp-v a{color:var(--bp-orange);}

.bp-work{max-width:1240px;margin:0 auto;padding:20px 32px 100px;}
.bp-work-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:30px;border-top:1px solid var(--bp-line);padding-top:34px;}
.bp-work-head h2{font-family:var(--font-bebas),Impact,sans-serif;font-size:40px;letter-spacing:.02em;}
.bp-count{font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--bp-dim);}
.bp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.bp-card{position:relative;aspect-ratio:4/5;border-radius:6px;overflow:hidden;background:#151518;border:1px solid var(--bp-line);cursor:pointer;transition:border-color .25s,transform .25s;display:block;}
.bp-card:hover{border-color:var(--bp-orange);transform:translateY(-4px);}
.bp-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62;transition:opacity .3s,transform .5s;}
.bp-card:hover img{opacity:.8;transform:scale(1.05);}
.bp-card-grad{position:absolute;inset:0;background:linear-gradient(transparent 30%,rgba(0,0,0,.9));}
.bp-card-body{position:absolute;left:0;right:0;bottom:0;padding:18px 16px;}
.bp-ttl{font-size:16px;font-weight:700;line-height:1.2;color:#fff;}
.bp-meta{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--bp-dim);margin-top:7px;}
.bp-card-arrow{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:50%;border:1px solid var(--bp-line-b);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;opacity:0;transition:opacity .25s;}
.bp-card:hover .bp-card-arrow{opacity:1;}
.bp-card-ph .bp-phlogo{position:absolute;top:42%;left:50%;transform:translate(-50%,-50%);width:58%;max-width:150px;filter:brightness(0) invert(1);opacity:.92;}
.bp-card-ph::before{content:'';position:absolute;inset:0;background:radial-gradient(80% 60% at 50% 40%,rgba(255,255,255,.06),transparent 70%);}
.bp-tag{position:absolute;top:14px;left:14px;font-family:ui-monospace,Menlo,monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.25);padding:4px 8px;border-radius:2px;z-index:2;}

.bp-cta{position:relative;overflow:hidden;border-top:1px solid var(--bp-line);padding:110px 32px;text-align:center;}
.bp-cta::before{content:'';position:absolute;inset:0;background:radial-gradient(75% 80% at 50% 120%,rgba(215,63,9,.30),transparent 60%);opacity:.7;}
.bp-cta-inner{position:relative;z-index:1;max-width:680px;margin:0 auto;}
.bp-cta-kicker{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--bp-orange);margin-bottom:18px;}
.bp-cta-h{font-family:var(--font-bebas),Impact,sans-serif;font-size:clamp(46px,7vw,84px);line-height:.92;letter-spacing:.01em;}
.bp-cta-h em{color:var(--bp-orange);}
.bp-cta-p{font-size:18px;line-height:1.6;color:#cfcfca;max-width:520px;margin:20px auto 34px;}
.bp-cta-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.bp-cta-btn{font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:16px 28px;border-radius:5px;display:inline-block;}
.bp-cta-btn.solid{background:var(--bp-orange);color:#fff;}
.bp-cta-btn.solid:hover{filter:brightness(1.08);}
.bp-cta-btn.ghost{border:1px solid var(--bp-line-b);color:#fff;}
.bp-cta-btn.ghost:hover{border-color:var(--bp-orange);}

@media(max-width:900px){
  .bp-crumb{padding-top:84px;}
  .bp-about{grid-template-columns:1fr;gap:40px;}
  .bp-about-side{border-left:none;border-top:1px solid var(--bp-line);padding-left:0;padding-top:28px;}
  .bp-grid{grid-template-columns:repeat(2,1fr);}
  .bp-hero-logo{height:66px;}
  .bp-hero-wordmark{font-size:54px;}
  .bp-about-h{font-size:46px;}
  .bp-hero-inner{padding-bottom:40px;}
  .bp-stat{padding-right:18px;margin-right:18px;min-width:80px;}
  .bp-num{font-size:36px;}
}
`;
