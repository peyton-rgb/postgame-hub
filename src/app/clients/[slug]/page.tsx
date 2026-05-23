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

import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBrandBySlug, type Brand } from '@/lib/data/brands';
import { createPlainSupabase } from '@/lib/supabase';
import HeroSlideshow from './HeroSlideshow';
import './brand-page.css';

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
          <Image
            src={t.file_url}
            alt={t.athlete_name}
            fill
            sizes="236px"
            style={{ objectFit: 'cover', objectPosition: 'center 15%' }}
          />
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

