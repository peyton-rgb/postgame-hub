// ============================================================
// Opt-in page renderer — the real page athletes see, in three views:
//   app      the athlete app screen (dark sheet, 54px OPT IN pill)
//   mweb     the same screen in a phone browser, with web chrome
//   desktop  the landing-page layout for a wide browser
//
// Pure render, no hooks: the builder renders it from live form state,
// the public /join page renders it on the server. Copy and measurements
// follow the approved prototype (appScreen / deskScreen). The brand
// mark is the brands row's light-ink logo; it is never typed as text.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import type { OptinEventInfo, OptinPageData } from "@/lib/admin/campaigns/optin-page";
import { formatClock, formatDeadline, formatEventDate } from "@/lib/admin/campaigns/optin-page";
import type { CampaignType } from "@/lib/admin/campaigns/types";
import s from "./optin.module.css";

export type OptinView = "app" | "mweb" | "desktop";

export interface OptinPreviewProps {
  data: OptinPageData;
  campaignName: string;
  brandName: string | null;
  /** light-ink brand mark (for the dark page) */
  brandLogoUrl: string | null;
  /** Postgame light-ink wordmark for the web chrome (from the brands table) */
  postgameLogoUrl: string | null;
  campaignType: CampaignType;
  event: OptinEventInfo | null;
  /** where the OPT IN button goes; null renders an inert button (builder preview) */
  optInHref: string | null;
  /** shown in the fake browser / Safari bars */
  publicUrl: string;
  /** hero media fallback (campaign's app card) when data.hero_media_url is empty */
  heroFallbackUrl?: string | null;
}

const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

function Media({ url, className }: { url: string | null; className: string }) {
  return (
    <div className={className}>
      {url ? (
        isVideo(url) ? (
          <video src={url} muted playsInline autoPlay loop />
        ) : (
          <img src={url} alt="" />
        )
      ) : null}
    </div>
  );
}

function Sect({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.sec}>
      <div className={s.lbl}>{label}</div>
      {children}
    </div>
  );
}

function Dash() {
  return <span style={{ color: "#AAAAB0" }}>—</span>;
}

function Posts({ d, type, wide = false }: { d: OptinPageData; type: CampaignType; wide?: boolean }) {
  return (
    <Sect label={type === "event" ? "Posts around the event" : "Required posts"}>
      {d.required_posts.length ? (
        <ul className={s.ul + (wide ? " " + s.lpUl : "")}>
          {d.required_posts.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <div className={s.p}>
          <Dash />
        </div>
      )}
    </Sect>
  );
}

function Elig({ d }: { d: OptinPageData }) {
  const items = [d.eligibility.who, d.eligibility.sports, d.eligibility.colleges, d.eligibility.min_followers].filter(Boolean);
  if (!d.eligibility.show || items.length === 0) return null;
  return (
    <Sect label="Who's eligible">
      <div className={s.elig}>
        {items.map((x, i) => (
          <span key={i}>{x}</span>
        ))}
      </div>
    </Sect>
  );
}

function Timeline({ d, horizontal = false }: { d: OptinPageData; horizontal?: boolean }) {
  const steps = d.timeline.filter((st) => st.label);
  return (
    <Sect label="What happens next">
      {steps.length > 0 && (
        <div className={s.tl + (horizontal ? " " + s.tlH : "")}>
          {steps.map((st, i) => (
            <div key={i} className={s.tlI}>
              <span className={s.tlN}>{i + 1}</span>
              <div>
                <b>{st.label}</b>
                {st.date && <div className={s.sub}>{st.date}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {d.next_steps ? (
        <p className={s.p} style={{ marginTop: steps.length ? 14 : 0, maxWidth: horizontal ? 620 : undefined }}>
          {d.next_steps}
        </p>
      ) : steps.length === 0 ? (
        <div className={s.p}>
          <Dash />
        </div>
      ) : null}
    </Sect>
  );
}

function Examples({ d, grid = false }: { d: OptinPageData; grid?: boolean }) {
  if (d.examples.length === 0) return null;
  return (
    <Sect label="Content examples">
      <div className={grid ? s.lpEx : s.exRow}>
        {d.examples.map((ex, i) => (
          <div key={i} style={grid ? undefined : { flex: "0 0 150px" }}>
            <div className={s.exTile} title={ex.caption}>
              {ex.url ? (
                isVideo(ex.url) ? (
                  <video src={ex.url} muted playsInline />
                ) : (
                  <img src={ex.url} alt="" />
                )
              ) : (
                <span className={s.play + " " + s.playSm}>▶</span>
              )}
            </div>
            {grid && ex.caption && <div className={s.exCap}>{ex.caption}</div>}
          </div>
        ))}
      </div>
    </Sect>
  );
}

function Tags({ d, flat = false }: { d: OptinPageData; flat?: boolean }) {
  const ig = [...d.ig_mentions, ...d.ig_hashtags];
  const tt = [...d.tiktok_mentions, ...d.tiktok_hashtags];
  if (ig.length + tt.length === 0) return null;
  if (flat) {
    const all = Array.from(new Set([...ig, ...tt]));
    return (
      <Sect label="Tags">
        <div className={s.dkTags}>
          {all.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </Sect>
    );
  }
  return (
    <Sect label="Tags">
      {ig.length > 0 && (
        <>
          <div className={s.sub}>Instagram</div>
          <div className={s.tags}>
            {ig.map((t) => (
              <span key={"ig" + t}>{t}</span>
            ))}
          </div>
        </>
      )}
      {tt.length > 0 && (
        <>
          <div className={s.sub}>TikTok</div>
          <div className={s.tags}>
            {tt.map((t) => (
              <span key={"tt" + t}>{t}</span>
            ))}
          </div>
        </>
      )}
    </Sect>
  );
}

function EventBlock({ event }: { event: OptinEventInfo | null }) {
  if (!event || (!event.date && !event.venue)) return null;
  return (
    <Sect label="Event">
      <div className={s.eventBox}>
        <div className={s.val}>
          {formatEventDate(event.date) || "Date to be confirmed"}
          {event.start_time ? ` · ${formatClock(event.start_time)}` : ""}
        </div>
        {(event.venue || event.call_time) && (
          <p className={s.p} style={{ marginTop: 4 }}>
            {event.venue}
            {event.venue && event.call_time ? " · " : ""}
            {event.call_time ? `arrive by ${formatClock(event.call_time)}` : ""}
          </p>
        )}
      </div>
    </Sect>
  );
}

function OptInButton({ href, className }: { href: string | null; className: string }) {
  return href ? (
    <a href={href} className={className}>
      OPT IN&nbsp;›
    </a>
  ) : (
    <button type="button" className={className} tabIndex={-1} aria-disabled>
      OPT IN&nbsp;›
    </button>
  );
}

function BrandMark({ name, url, className }: { name: string | null; url: string | null; className: string }) {
  // Logo from the brands row; when the brand has no light-ink mark we
  // show nothing rather than typing the name as a wordmark.
  return <div className={className}>{url ? <img src={url} alt={name ?? ""} /> : null}</div>;
}

// ------------------------------------------------------------
// App screen (also the mobile web body)
// ------------------------------------------------------------

export function AppScreen(p: OptinPreviewProps & { web?: boolean }) {
  const { data: d, campaignType: type } = p;
  const hero = d.hero_media_url || p.heroFallbackUrl || null;
  const deadline = formatDeadline(d.optin_deadline);
  return (
    <div className={s.ap}>
      <div className={s.hero + (p.web ? " " + s.heroMw : "")}>
        <Media url={hero} className={s.media} />
        <span className={s.circ}>‹</span>
        <BrandMark name={p.brandName} url={p.brandLogoUrl} className={s.brand} />
        <span className={s.circ}>⤴</span>
      </div>
      <div className={s.sheet}>
        <div className={s.handle} />
        <div className={s.eyebrow}>NIL Opportunity</div>
        <h1 className={s.h1}>{d.headline || p.campaignName}</h1>
        <div className={s.stats}>
          <div className={s.stat}>
            <div className={s.lbl}>You earn</div>
            <div className={s.val}>{d.compensation || <Dash />}</div>
          </div>
          <div className={s.stat}>
            <div className={s.lbl}>You create</div>
            <div className={s.val}>{d.content_type || <Dash />}</div>
          </div>
        </div>
        {type === "event" && <EventBlock event={p.event} />}
        <Sect label="Description">
          <p className={s.p}>{d.description || <Dash />}</p>
        </Sect>
        {d.about && (
          <Sect label="About the campaign">
            <p className={s.p}>{d.about}</p>
          </Sect>
        )}
        <Posts d={d} type={type} />
        <Elig d={d} />
        <Sect label="Opt-in deadline">
          <div className={s.val}>{deadline || <Dash />}</div>
        </Sect>
        {d.bonus_note && (
          <Sect label="Bonus">
            <p className={s.p}>{d.bonus_note}</p>
          </Sect>
        )}
        <Examples d={d} />
        <Tags d={d} />
        <Timeline d={d} />
      </div>
      <div className={s.cta}>
        <OptInButton href={p.optInHref} className={s.btn} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Desktop landing page
// ------------------------------------------------------------

export function DeskScreen(p: OptinPreviewProps) {
  const { data: d, campaignType: type } = p;
  const hero = d.hero_media_url || p.heroFallbackUrl || null;
  const deadline = formatDeadline(d.optin_deadline);
  return (
    <div className={s.ap + " " + s.dk}>
      <WebTop p={p} />
      <div className={s.lpHero}>
        <Media url={hero} className={s.media} />
        <div className={s.lpHeroIn}>
          <BrandMark name={p.brandName} url={p.brandLogoUrl} className={s.brand + " " + s.dkBrand} />
          <div className={s.eyebrow}>NIL Opportunity</div>
          <h1 className={s.h1 + " " + s.lpH1}>{d.headline || p.campaignName}</h1>
          <div className={s.lpChips}>
            <span>
              <i>You earn</i>
              {d.compensation || "—"}
            </span>
            <span>
              <i>You create</i>
              {d.content_type || "—"}
            </span>
            <span>
              <i>Opt in by</i>
              {deadline.replace(/^\w+, /, "") || "—"}
            </span>
          </div>
          <OptInButton href={p.optInHref} className={s.btn + " " + s.lpBtn} />
        </div>
      </div>
      <div className={s.lpWrap}>
        {type === "event" && <EventBlock event={p.event} />}
        <div className={s.lp2}>
          <Sect label="Description">
            <p className={s.p}>{d.description || <Dash />}</p>
          </Sect>
          {d.about && (
            <Sect label="About the campaign">
              <p className={s.p}>{d.about}</p>
            </Sect>
          )}
        </div>
        <Posts d={d} type={type} wide />
        <Examples d={d} grid />
        <Elig d={d} />
        <Timeline d={d} horizontal />
        <div className={s.lp2}>
          {d.bonus_note && (
            <Sect label="Bonus">
              <p className={s.p}>{d.bonus_note}</p>
            </Sect>
          )}
          <Tags d={d} flat />
        </div>
        <div className={s.lpFoot}>
          <div>
            <b>Ready?</b>
            <div className={s.sub} style={{ margin: 0 }}>
              {deadline ? `Opt in by ${deadline}. ` : ""}You&apos;ll hear back within a week.
            </div>
          </div>
          <OptInButton href={p.optInHref} className={s.btn + " " + s.lpBtn} />
        </div>
      </div>
    </div>
  );
}

function WebTop({ p, small = false }: { p: OptinPreviewProps; small?: boolean }) {
  return (
    <div className={small ? s.mwTop : s.dkNav}>
      <b className={s.logo}>
        {p.postgameLogoUrl ? <img src={p.postgameLogoUrl} alt="Postgame" style={{ height: small ? 15 : 18 }} /> : null}
      </b>
      <a href="/athlete/signup" className={s.get + (small ? " " + s.getSm : "")}>
        Get the app
      </a>
    </div>
  );
}

// ------------------------------------------------------------
// Device frames
// ------------------------------------------------------------

export function IPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.iph}>
      <div className={s.iphBtn} style={{ left: -4, top: 120, height: 32 }} />
      <div className={s.iphBtn} style={{ left: -4, top: 175, height: 62 }} />
      <div className={s.iphBtn} style={{ left: -4, top: 250, height: 62 }} />
      <div className={s.iphBtn} style={{ right: -4, top: 200, height: 96 }} />
      <div className={s.iphScreen}>
        <div className={s.iphStatus}>
          <span>9:41</span>
          <span className={s.iphIsland} />
          <span className={s.iphIcons}>
            <i className={s.sig} />
            <i className={s.wifi} />
            <i className={s.bat} />
          </span>
        </div>
        <div className={s.iphScroll}>{children}</div>
        <div className={s.iphHome} />
      </div>
    </div>
  );
}

export function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className={s.brw}>
      <div className={s.brwBar}>
        <span className={s.brwDots}>
          <i style={{ background: "#FF5F57" }} />
          <i style={{ background: "#FEBC2E" }} />
          <i style={{ background: "#28C840" }} />
        </span>
        <span className={s.brwUrl}>🔒 {url}</span>
      </div>
      <div className={s.brwPage}>{children}</div>
    </div>
  );
}

/** Mobile web = the app screen with the Safari bar and the web top strip. */
export function MobileWebScreen(p: OptinPreviewProps) {
  return (
    <>
      <div className={s.safari}>🔒 {p.publicUrl}</div>
      <WebTop p={p} small />
      <AppScreen {...p} web />
    </>
  );
}

/** The builder's preview: one of the three views inside a device frame. */
export default function OptinPreview({ view, ...p }: OptinPreviewProps & { view: OptinView }) {
  if (view === "desktop") {
    return (
      <div className={s.stage} style={{ padding: 12 }}>
        <BrowserFrame url={p.publicUrl}>
          <DeskScreen {...p} />
        </BrowserFrame>
      </div>
    );
  }
  return (
    <div className={s.stage} style={{ padding: "16px 6px" }}>
      <IPhoneFrame>{view === "mweb" ? <MobileWebScreen {...p} /> : <AppScreen {...p} />}</IPhoneFrame>
    </div>
  );
}

/** The public page: mobile web layout on phones, landing layout on wide screens (CSS-switched). */
export function PublicJoinPage(p: OptinPreviewProps) {
  return (
    <>
      <div className={s.joinMobile}>
        <WebTop p={p} small />
        <AppScreen {...p} web />
      </div>
      <div className={s.joinDesktop}>
        <DeskScreen {...p} />
      </div>
    </>
  );
}
