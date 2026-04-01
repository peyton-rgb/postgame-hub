import { getHomepage, getBrandLogos, type HomepageData, type PageSection } from "@/lib/public-site";

export const revalidate = 60;

// ── Styles ──────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

  :root {
    --orange: #D73F09;
    --bg: #0A0A0A;
    --surface: #141414;
    --border: rgba(255,255,255,0.08);
    --text: #FFFFFF;
    --text-muted: rgba(255,255,255,0.55);
    --text-dim: rgba(255,255,255,0.35);
  }

  .hp-body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .hp-display {
    font-family: 'Bebas Neue', Arial, sans-serif;
    letter-spacing: 0.02em;
  }

  /* Nav */
  .hp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 48px;
    transition: background 0.3s, backdrop-filter 0.3s, box-shadow 0.3s;
  }
  .hp-nav.scrolled {
    background: rgba(10,10,10,0.92);
    backdrop-filter: blur(16px);
    box-shadow: 0 1px 0 var(--border);
  }
  .hp-nav-logo { font-size: 22px; font-weight: 900; color: var(--orange); text-decoration: none; }
  .hp-nav-links { display: flex; align-items: center; gap: 32px; }
  .hp-nav-item { position: relative; }
  .hp-nav-item::after {
    content: ''; position: absolute; left: -12px; right: -12px;
    top: 100%; height: 18px;
  }
  .hp-nav-item > button,
  .hp-nav-item > a {
    background: none; border: none; color: var(--text-muted); font-size: 13px;
    font-weight: 700; cursor: pointer; text-decoration: none; padding: 8px 0;
    transition: color 0.2s; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .hp-nav-item:hover > button,
  .hp-nav-item:hover > a { color: var(--text); }
  .hp-nav-dropdown {
    position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 8px 0; min-width: 180px; padding-top: 16px; margin-top: 0;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    opacity: 0; visibility: hidden; pointer-events: none;
    transition: opacity 0.15s ease, visibility 0.15s ease;
  }
  .hp-nav-dropdown > a:first-child { margin-top: -8px; }
  .hp-nav-item:hover .hp-nav-dropdown {
    opacity: 1; visibility: visible; pointer-events: auto;
    transition-delay: 0s;
  }
  .hp-nav-item:not(:hover) .hp-nav-dropdown {
    transition-delay: 0.2s;
  }
  .hp-nav-dropdown a {
    display: block; padding: 10px 20px; font-size: 13px; color: var(--text-muted);
    text-decoration: none; font-weight: 600; transition: all 0.15s;
  }
  .hp-nav-dropdown a:hover { color: var(--text); background: rgba(255,255,255,0.04); }
  .hp-btn-outline {
    padding: 8px 20px; border: 1.5px solid var(--orange); border-radius: 8px;
    color: var(--orange); font-size: 12px; font-weight: 800; text-decoration: none;
    text-transform: uppercase; letter-spacing: 0.06em; transition: all 0.2s;
  }
  .hp-btn-outline:hover { background: var(--orange); color: white; }
  .hp-btn-solid {
    padding: 10px 28px; background: var(--orange); border: none; border-radius: 8px;
    color: white; font-size: 12px; font-weight: 800; text-decoration: none;
    text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; transition: background 0.2s;
  }
  .hp-btn-solid:hover { background: #c43808; }

  /* Hero */
  .hp-hero {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    padding: 140px 24px 80px;
    background: radial-gradient(ellipse at 50% 0%, rgba(215,63,9,0.12) 0%, transparent 60%);
  }
  .hp-eyebrow {
    font-size: 12px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.2em; color: var(--orange); margin-bottom: 20px;
  }
  .hp-hero-title {
    font-size: clamp(48px, 8vw, 96px); line-height: 0.95; margin: 0 0 24px;
    max-width: 900px;
  }
  .hp-hero-desc {
    font-size: 18px; color: var(--text-muted); max-width: 560px;
    line-height: 1.6; margin: 0 0 40px;
  }
  .hp-hero-actions { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }

  /* Fade-up animation */
  .hp-fade-up {
    opacity: 0; transform: translateY(24px);
    animation: hpFadeUp 0.7s ease forwards;
  }
  .hp-fade-up-d1 { animation-delay: 0.1s; }
  .hp-fade-up-d2 { animation-delay: 0.25s; }
  .hp-fade-up-d3 { animation-delay: 0.4s; }
  @keyframes hpFadeUp {
    to { opacity: 1; transform: translateY(0); }
  }

  /* Stats bar */
  .hp-stats {
    display: flex; justify-content: center; gap: 64px;
    padding: 48px 24px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  }
  .hp-stat-num { font-size: 42px; line-height: 1; color: var(--orange); }
  .hp-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-top: 6px; }

  /* Sections */
  .hp-section { padding: 80px 48px; }
  .hp-section-title { font-size: clamp(36px, 5vw, 56px); margin: 0 0 12px; }
  .hp-section-sub { font-size: 15px; color: var(--text-muted); margin: 0 0 48px; max-width: 500px; }

  /* Campaign hero (featured) */
  .hp-campaigns-hero {
    border: 2px solid #D73F09; border-radius: 16px;
    overflow: hidden; position: relative; min-height: 400px;
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: 48px; margin-bottom: 16px;
    box-shadow: 0 0 30px rgba(215,63,9,0.3);
    transition: box-shadow 0.25s;
  }
  .hp-campaigns-hero:hover { box-shadow: 0 0 40px rgba(215,63,9,0.4), 0 16px 48px rgba(0,0,0,0.4); }
  .hp-campaigns-hero .hp-card-brand { font-size: 14px; }
  .hp-campaigns-hero .hp-card-title { font-size: clamp(28px, 5vw, 44px); }
  .hp-campaigns-hero .hp-card-meta { font-size: 14px; }
  .hp-campaigns-hero .hp-card-overlay { background: linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.85) 100%); }

  /* Campaign masonry (non-featured) */
  .hp-campaigns-masonry { column-count: 3; column-gap: 16px; }
  .hp-card {
    border: 1px solid var(--border); border-radius: 12px;
    overflow: hidden; transition: transform 0.25s, box-shadow 0.25s;
    position: relative;
    break-inside: avoid; margin-bottom: 16px;
  }
  .hp-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
  .hp-card-no-media {
    min-height: 200px; display: flex; flex-direction: column;
    justify-content: flex-end; padding: 28px;
  }
  .hp-card-brand { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--orange); margin-bottom: 4px; }
  .hp-card-title { font-size: 24px; line-height: 1.05; margin: 0 0 6px; }
  .hp-card-meta { font-size: 12px; color: var(--text-muted); }

  /* Card content row with logo */
  .hp-card-content-row { display: flex; align-items: center; gap: 12px; }
  .hp-card-logo {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    background: var(--orange); display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 900; color: #fff; overflow: hidden;
  }
  .hp-card-logo img { width: 100%; height: 100%; object-fit: cover; }

  /* Legacy grid class kept for other sections */
  .hp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .rc-1 { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
  .rc-2 { background: linear-gradient(135deg, #1a1a1a 0%, #2d1810 50%, #3d1f14 100%); }
  .rc-3 { background: linear-gradient(135deg, #141414 0%, #1a2a1a 50%, #1e3a1e 100%); }
  .rc-4 { background: linear-gradient(135deg, #1a1a1a 0%, #2a1a2d 50%, #3a1e3d 100%); }
  .rc-5 { background: linear-gradient(135deg, #1a1a1a 0%, #1a2a2a 50%, #1e3a3a 100%); }
  .hp-card-has-img { background-size: cover; background-position: center; }
  .hp-card-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%); border-radius: 16px; }
  .hp-card-overlay-bottom { position: absolute; bottom: 0; left: 0; right: 0; padding: 28px; z-index: 1; }

  /* Athletes */
  .hp-athletes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .hp-athlete {
    position: relative; border-radius: 16px; overflow: hidden;
    border: 1px solid var(--border); transition: border-color 0.2s, transform 0.25s;
    aspect-ratio: 3/4;
  }
  .hp-athlete:hover { border-color: var(--orange); transform: translateY(-4px); }
  .hp-athlete-img {
    width: 100%; height: 100%; object-fit: cover; object-position: center 20%;
    display: block;
  }
  .hp-athlete-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%);
  }
  .hp-athlete-info {
    position: absolute; bottom: 0; left: 0; right: 0; padding: 20px;
  }
  .hp-athlete-brand-logo {
    position: absolute; top: 12px; right: 12px;
    height: 24px; max-width: 60px; object-fit: contain;
    opacity: 0.7; filter: brightness(2);
  }
  .hp-athlete-sport {
    font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--orange); margin-bottom: 6px;
  }
  .hp-athlete-name { font-size: 22px; line-height: 1.05; margin: 0 0 4px; }
  .hp-athlete-school { font-size: 12px; color: var(--text-muted); }

  /* Brand partners */
  .hp-brands {
    display: flex; flex-wrap: wrap; gap: 32px; align-items: center; justify-content: center;
    padding: 24px 0;
  }
  .hp-brand-logo {
    height: 40px; opacity: 0.5; filter: grayscale(1) brightness(2);
    transition: opacity 0.2s, filter 0.2s;
  }
  .hp-brand-logo:hover { opacity: 1; filter: none; }
  .hp-brand-placeholder {
    width: 100px; height: 40px; border-radius: 8px; background: var(--surface);
    border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; color: var(--text-dim); text-transform: uppercase;
    letter-spacing: 0.05em; transition: border-color 0.2s;
  }
  .hp-brand-placeholder:hover { border-color: var(--orange); }

  /* Services — 3x2 grid */
  .hp-services { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .hp-service {
    background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    padding: 40px 28px; transition: border-color 0.25s;
  }
  .hp-service:hover { border-color: var(--orange); }
  .hp-service-accent { border-left: 3px solid var(--orange); }
  .hp-service-num {
    font-size: 11px; font-weight: 800; color: var(--text-dim); letter-spacing: 0.1em;
    margin-bottom: 16px;
  }
  .hp-service-accent .hp-service-num { color: var(--orange); }
  .hp-service-title { font-size: 20px; font-weight: 800; margin: 0 0 10px; }
  .hp-service-desc { font-size: 14px; color: var(--text-muted); line-height: 1.6; margin: 0; }

  /* CTA */
  .hp-cta {
    text-align: center; padding: 100px 24px;
    background: radial-gradient(ellipse at 50% 100%, rgba(215,63,9,0.1) 0%, transparent 60%);
  }
  .hp-cta-title { font-size: clamp(40px, 6vw, 72px); margin: 0 0 16px; }
  .hp-cta-desc { font-size: 16px; color: var(--text-muted); margin: 0 0 36px; max-width: 480px; display: inline-block; line-height: 1.6; }

  /* Footer */
  .hp-footer {
    border-top: 1px solid var(--border); padding: 40px 48px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 12px; color: var(--text-dim);
  }
  .hp-footer a { color: var(--text-muted); text-decoration: none; margin-left: 24px; }
  .hp-footer a:hover { color: var(--text); }

  /* Mobile nav */
  .hp-nav-mobile-toggle { display: none; background: none; border: none; color: var(--text); cursor: pointer; }

  /* Responsive */
  @media (max-width: 900px) {
    .hp-nav { padding: 14px 24px; }
    .hp-nav-links { display: none; }
    .hp-nav-mobile-toggle { display: block; }
    .hp-grid { grid-template-columns: repeat(2, 1fr); }
    .hp-campaigns-masonry { column-count: 2; }
    .hp-campaigns-hero { min-height: 280px; padding: 28px; }
    .hp-athletes { grid-template-columns: repeat(2, 1fr); }
    .hp-services { grid-template-columns: 1fr; }
    .hp-stats { gap: 32px; flex-wrap: wrap; }
    .hp-section { padding: 60px 24px; }
    .hp-footer { flex-direction: column; gap: 16px; text-align: center; }
    .hp-footer a { margin-left: 0; margin: 0 12px; }
  }
  @media (max-width: 600px) {
    .hp-grid { grid-template-columns: 1fr; }
    .hp-campaigns-masonry { column-count: 1; }
    .hp-athletes { grid-template-columns: 1fr; }
    .hp-stats { flex-direction: column; align-items: center; gap: 24px; }
  }
`;

// ── Scroll script ───────────────────────────────────────────
function ScrollScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var nav = document.querySelector('.hp-nav');
            if (!nav) return;
            function onScroll() {
              if (window.scrollY > 40) nav.classList.add('scrolled');
              else nav.classList.remove('scrolled');
            }
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
          })();
        `,
      }}
    />
  );
}

// ── Helpers ─────────────────────────────────────────────────
function getSection(sections: PageSection[], type: string): PageSection | undefined {
  return sections.find((s) => s.type === type && s.visible !== false);
}

function getSetting(page: HomepageData["page"], key: string): unknown {
  return (page.settings as Record<string, unknown>)?.[key];
}

/** Safely extract a display string from a setting that may be a string or {text, url} object */
function settingText(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "text" in val) return String((val as Record<string, unknown>).text);
  return undefined;
}

function settingUrl(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "object" && val !== null && "url" in val) return String((val as Record<string, unknown>).url);
  return undefined;
}

/** Get a content field from a section, with fallback */
function contentArr(section: PageSection, ...keys: string[]): Record<string, unknown>[] {
  const c = section.content;
  if (!c) return [];
  for (const k of keys) {
    if (Array.isArray(c[k])) return c[k] as Record<string, unknown>[];
  }
  if (Array.isArray(c)) return c;
  return [];
}
function contentStr(section: PageSection, key: string): string {
  const v = section.content?.[key];
  return typeof v === "string" ? v : "";
}

// ── Fallback ────────────────────────────────────────────────
function FallbackHomepage() {
  return (
    <div className="hp-body">
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <nav className="hp-nav scrolled">
        <a href="/" className="hp-nav-logo">POSTGAME</a>
      </nav>
      <div className="hp-hero">
        <div className="hp-eyebrow hp-fade-up">NIL Campaign Management</div>
        <h1 className="hp-display hp-hero-title hp-fade-up hp-fade-up-d1">
          We Build Athlete-Powered Campaigns
        </h1>
        <p className="hp-hero-desc hp-fade-up hp-fade-up-d2">
          Postgame connects brands with college athletes to create authentic, high-performing social media campaigns.
        </p>
        <div className="hp-hero-actions hp-fade-up hp-fade-up-d3">
          <a href="/deals" className="hp-btn-solid">Tier 1 Deal Tracker</a>
          <a href="mailto:hello@postgame.co" className="hp-btn-outline">Work With Us</a>
        </div>
      </div>
      <footer className="hp-footer">
        <span>&copy; {new Date().getFullYear()} Postgame. All rights reserved.</span>
        <div>
          <a href="/press">Press</a>
          <a href="/deals">Deals</a>
        </div>
      </footer>
      <ScrollScript />
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default async function HomepagePage() {
  let data: HomepageData | null = null;
  let brandLogos = new Map<string, string>();
  try {
    [data, brandLogos] = await Promise.all([getHomepage(), getBrandLogos()]);
  } catch {
    // Supabase unreachable
  }

  if (!data) return <FallbackHomepage />;

  const { page, sections } = data;
  const raw = (key: string) => getSetting(page, key);
  const s = (key: string) => settingText(raw(key));
  const publicSections = (page.settings as Record<string, unknown>)?.public_sections as Record<string, boolean> | undefined;
  const showSection = (key: string) => !publicSections || publicSections[key] !== false;

  const stats = (getSetting(page, "stats") as { value: string; label: string }[] | undefined) || [];
  const featuredCampaigns = getSection(sections, "featured_campaigns");
  const featuredAthletes = getSection(sections, "featured_athletes");
  const brandPartners = getSection(sections, "brand_partners");
  const servicesGrid = getSection(sections, "services_grid");

  return (
    <div className="hp-body">
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

      {/* Nav */}
      <nav className="hp-nav">
        <a href="/" className="hp-nav-logo">POSTGAME</a>
        <div className="hp-nav-links">
          <div className="hp-nav-item">
            <button>Brands</button>
            <div className="hp-nav-dropdown">
              <a href="/deals">Clients</a>
              <a href="/dashboard">Campaigns</a>
            </div>
          </div>
          <div className="hp-nav-item">
            <button>Services</button>
            <div className="hp-nav-dropdown">
              <a href="#services">Elevated</a>
              <a href="#services">Scaled</a>
              <a href="#services">Experiential</a>
            </div>
          </div>
          <div className="hp-nav-item">
            <button>About</button>
            <div className="hp-nav-dropdown">
              <a href="/press">Press</a>
              <a href="/case-studies">Case Studies</a>
              <a href="#team">Our Team</a>
            </div>
          </div>
          <a href="/deals" className="hp-btn-outline">Tier 1 Deal Tracker</a>
          <a href="mailto:hello@postgame.co" className="hp-btn-solid">Work With Us</a>
        </div>
        <button className="hp-nav-mobile-toggle" aria-label="Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </nav>

      {/* Hero */}
      <section className="hp-hero">
        {s("hero_eyebrow") && (
          <div className="hp-eyebrow hp-fade-up">{s("hero_eyebrow")}</div>
        )}
        <h1 className="hp-display hp-hero-title hp-fade-up hp-fade-up-d1">
          {s("hero_title") || "We Build Athlete-Powered Campaigns"}
        </h1>
        {s("hero_desc") && (
          <p className="hp-hero-desc hp-fade-up hp-fade-up-d2">{s("hero_desc")}</p>
        )}
        <div className="hp-hero-actions hp-fade-up hp-fade-up-d3">
          {s("hero_cta_primary") && (
            <a href={settingUrl(raw("hero_cta_primary")) || "/deals"} className="hp-btn-solid">{s("hero_cta_primary")}</a>
          )}
          {s("hero_cta_secondary") && (
            <a href={settingUrl(raw("hero_cta_secondary")) || "mailto:hello@postgame.co"} className="hp-btn-outline">{s("hero_cta_secondary")}</a>
          )}
        </div>
      </section>

      {/* Stats */}
      {showSection("stats") && stats.length > 0 && (
        <div className="hp-stats">
          {stats.map((stat, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div className="hp-display hp-stat-num">{stat.value}</div>
              <div className="hp-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign Highlights */}
      {showSection("featured_campaigns") && featuredCampaigns && (() => {
        const campaigns = contentArr(featuredCampaigns, "campaigns", "items");
        const eyebrow = contentStr(featuredCampaigns, "eyebrow");
        const description = contentStr(featuredCampaigns, "description");
        return campaigns.length > 0 ? (
          <section className="hp-section">
            {eyebrow && <div className="hp-eyebrow">{eyebrow}</div>}
            <h2 className="hp-display hp-section-title">{featuredCampaigns.title || "Campaign Highlights"}</h2>
            {(description || featuredCampaigns.subtitle) && <p className="hp-section-sub">{description || featuredCampaigns.subtitle}</p>}
            {(() => {
              const featuredIdx = campaigns.findIndex((c) => c.featured === true);
              const fi = featuredIdx >= 0 ? featuredIdx : 0;
              const featured = campaigns[fi];
              const rest = campaigns.filter((_, idx) => idx !== fi);

              const renderLogo = (brand: string, logoUrl: string, isHero: boolean) => {
                const resolvedLogo = logoUrl || brandLogos.get(brand.toLowerCase()) || "";
                if (resolvedLogo) {
                  return isHero
                    ? <img src={resolvedLogo} alt={brand} style={{ height: 44, maxWidth: 120, objectFit: 'contain' as const }} />
                    : <img src={resolvedLogo} alt={brand} style={{ height: 32, maxWidth: 80, objectFit: 'contain' as const }} />;
                }
                return (
                  <div className="hp-card-logo">
                    {brand.charAt(0).toUpperCase()}
                  </div>
                );
              };

              const renderCardContent = (item: Record<string, unknown>, isHero: boolean, idx: number) => {
                const brand = String(item.brand || item.brand_name || "");
                const title = String(item.name || item.title || "");
                const meta = String(item.meta || "");
                const gradient = String(item.gradient || `rc-${(idx % 5) + 1}`);
                const imageUrl = String(item.image_url || "");
                const mediaType = String(item.media_type || "image");
                const logoUrl = String(item.brand_logo_url || "");
                const focalPoint = String(item.focal_point || "center 20%");
                const hasMedia = !!imageUrl;
                const isVideo = hasMedia && mediaType === "video";

                const textContent = (
                  <div className="hp-card-content-row">
                    {renderLogo(brand, logoUrl, isHero)}
                    <div>
                      {brand && <div className="hp-card-brand">{brand}</div>}
                      <div className="hp-display hp-card-title">{title}</div>
                      {meta && <div className="hp-card-meta">{meta}</div>}
                    </div>
                  </div>
                );

                // ── Hero card (keeps min-height, background-image/video approach) ──
                if (isHero) {
                  const cls = `hp-campaigns-hero ${hasMedia && !isVideo ? "hp-card-has-img" : !hasMedia ? gradient : ""}`;
                  return (
                    <div
                      key={idx}
                      className={cls}
                      style={hasMedia && !isVideo ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: focalPoint } : undefined}
                    >
                      {isVideo && <video autoPlay muted loop playsInline preload="auto" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: focalPoint }} src={imageUrl} />}
                      {hasMedia && <div className="hp-card-overlay" />}
                      <div style={{ position: "relative", zIndex: 1 }}>{textContent}</div>
                    </div>
                  );
                }

                // ── Masonry card WITHOUT media (gradient fallback) ──
                if (!hasMedia) {
                  return (
                    <div key={idx} className={`hp-card hp-card-no-media ${gradient}`}>
                      {textContent}
                    </div>
                  );
                }

                // ── Masonry card WITH media (natural aspect ratio sizing) ──
                return (
                  <div key={idx} className="hp-card">
                    {isVideo ? (
                      <video autoPlay muted loop playsInline preload="auto" style={{ width: "100%", height: "auto", display: "block", objectPosition: focalPoint }} src={imageUrl} />
                    ) : (
                      <img src={imageUrl} alt={title} style={{ width: "100%", height: "auto", display: "block", objectPosition: focalPoint }} />
                    )}
                    <div className="hp-card-overlay" />
                    <div className="hp-card-overlay-bottom">{textContent}</div>
                  </div>
                );
              };

              return (
                <>
                  {featured && renderCardContent(featured, true, fi)}
                  {rest.length > 0 && (
                    <div className="hp-campaigns-masonry">
                      {rest.map((item, i) => renderCardContent(item, false, i))}
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        ) : null;
      })()}

      {/* Featured Athletes */}
      {showSection("featured_athletes") && featuredAthletes && (() => {
        const athletes = contentArr(featuredAthletes, "athletes", "items");
        const eyebrow = contentStr(featuredAthletes, "eyebrow");
        const description = contentStr(featuredAthletes, "description");
        return athletes.length > 0 ? (
          <section className="hp-section">
            {eyebrow && <div className="hp-eyebrow">{eyebrow}</div>}
            <h2 className="hp-display hp-section-title">{featuredAthletes.title || "Featured Athletes"}</h2>
            {(description || featuredAthletes.subtitle) && <p className="hp-section-sub">{description || featuredAthletes.subtitle}</p>}
            <div className="hp-athletes">
              {athletes.map((item, i) => {
                const name = String(item.name || "");
                const school = String(item.school || "");
                const sport = String(item.sport || "");
                const imageUrl = String(item.image_url || "");
                const brand = String(item.brand || "");
                const brandLogoUrl = brand ? brandLogos.get(brand.toLowerCase()) || "" : "";
                return (
                  <div key={i} className="hp-athlete">
                    {imageUrl ? (
                      <img src={imageUrl} alt={name} className="hp-athlete-img" />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 900, color: "var(--orange)" }}>
                        {name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                    )}
                    <div className="hp-athlete-overlay" />
                    {brandLogoUrl && <img src={brandLogoUrl} alt={brand} className="hp-athlete-brand-logo" />}
                    <div className="hp-athlete-info">
                      {sport && <div className="hp-athlete-sport">{sport}</div>}
                      <div className="hp-display hp-athlete-name">{name}</div>
                      {school && <div className="hp-athlete-school">{school}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null;
      })()}

      {/* Brand Partners */}
      {showSection("brand_partners") && brandPartners && (() => {
        const logos = contentArr(brandPartners, "logos", "items");
        const eyebrow = contentStr(brandPartners, "eyebrow");
        const description = contentStr(brandPartners, "description");
        return (
          <section className="hp-section" style={{ textAlign: "center" }}>
            {eyebrow && <div className="hp-eyebrow">{eyebrow}</div>}
            <h2 className="hp-display hp-section-title">{brandPartners.title || "Brand Partners"}</h2>
            {(description || brandPartners.subtitle) && <p className="hp-section-sub" style={{ margin: "0 auto 48px" }}>{description || brandPartners.subtitle}</p>}
            {logos.length > 0 ? (
              <div className="hp-brands">
                {logos.map((item, i) => {
                  const name = String(item.name || "");
                  const logoUrl = String(item.logo_url || "");
                  const href = String(item.href || "#");
                  return logoUrl ? (
                    <a key={i} href={href}>
                      <img src={logoUrl} alt={name} className="hp-brand-logo" />
                    </a>
                  ) : (
                    <div key={i} className="hp-brand-placeholder">{name}</div>
                  );
                })}
              </div>
            ) : (
              <div className="hp-brands">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="hp-brand-placeholder">Brand</div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {/* Services Grid */}
      {showSection("services_grid") && servicesGrid && (() => {
        const services = contentArr(servicesGrid, "services", "items");
        const eyebrow = contentStr(servicesGrid, "eyebrow");
        const description = contentStr(servicesGrid, "description");
        return services.length > 0 ? (
          <section className="hp-section" id="services">
            {eyebrow && <div className="hp-eyebrow">{eyebrow}</div>}
            <h2 className="hp-display hp-section-title">{servicesGrid.title || "Our Services"}</h2>
            {(description || servicesGrid.subtitle) && <p className="hp-section-sub">{description || servicesGrid.subtitle}</p>}
            <div className="hp-services">
              {services.map((item, i) => {
                const accent = item.accent === true;
                const num = String(item.num || String(i + 1).padStart(2, "0"));
                return (
                  <div key={i} className={`hp-service${accent ? " hp-service-accent" : ""}`}>
                    <div className="hp-service-num">{num}</div>
                    <div className="hp-service-title">{String(item.name || item.title || "")}</div>
                    {(item.desc || item.description) && <p className="hp-service-desc">{String(item.desc || item.description)}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null;
      })()}

      {/* CTA */}
      {showSection("cta") && (s("cta_title") || s("cta_desc")) && (
        <section className="hp-cta">
          {s("cta_title") && <h2 className="hp-display hp-cta-title">{s("cta_title")}</h2>}
          {s("cta_desc") && <p className="hp-cta-desc">{s("cta_desc")}</p>}
          <div>
            <a href="mailto:hello@postgame.co" className="hp-btn-solid">Get In Touch</a>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="hp-footer">
        <span>&copy; {new Date().getFullYear()} Postgame. All rights reserved.</span>
        <div>
          <a href="/press">Press</a>
          <a href="/deals">Deals</a>
          <a href="/case-studies">Case Studies</a>
        </div>
      </footer>

      <ScrollScript />
    </div>
  );
}
