// ============================================================
// /desktop — postgame1.com/desktop: the public page videographers land on
// from the download link. They create their account here first (Step 1
// of 2), then download Postgame Desktop (Step 2 of 2). Videographers
// upload through the desktop app only.
//
// Layout and copy are the approved prototype's S["vg-onboarding"] screen
// in its clean white `.dl-*` style (see ./desktop.css). The Postgame mark
// comes from the brands table (dark-ink variant on this white page,
// light-ink in the dark footer) — never typed as text.
//
// Public: no auth. The only server-side state is "is someone already
// signed in?", used to open the card on Step 2 when afterSignup() sends a
// videographer back here with ?step=download.
// ============================================================

import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase-server";
import { getPostgameLogos } from "@/lib/signup/postgameLogo";
import DesktopSignupCard, { type CardMode } from "@/components/signup/DesktopSignupCard";
import { LUCIDLINK_ICON, GOOGLE_DRIVE_LOGO } from "@/components/signup/partnerLogos";
import "./desktop.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Postgame Desktop for videographers",
  description:
    "The desktop app for videographers who shoot Postgame campaigns. Create your account, download the app, drop your clips.",
  robots: { index: false, follow: false },
};

const STEPS: Array<[string, string]> = [
  ["Create your account", "Sign up here on the web in about a minute, then download the app and sign in."],
  ["See your assignments", "The campaigns and athletes you're booked on appear automatically. No links to keep track of."],
  ["Drop your clips", "Pick the athlete and drag in files or a whole card. Big files keep uploading in the background, and pick up where they left off if your connection drops."],
  ["We take it from there", "Postgame reviews, edits and delivers. You'll see each file go to “In LucidLink ✓” so you know it arrived."],
];

const FEATURES: Array<[string, string]> = [
  ["Named and numbered for you", "Every file is renamed to Postgame's standard: athlete, type, number, brand, campaign, year. You never touch a file name."],
  ["Built for big files", "10 GB clips, whole camera cards, slow hotel Wi-Fi. Uploads resume, retry and finish on their own."],
  ["Only your folders", "You see the campaigns and athletes you're assigned to, and nothing else. Access is granted when you're booked and removed when the job wraps."],
  ["Nothing gets lost", "Files are never deleted automatically. If anything fails, you see it in the queue and can retry with one click."],
];

const FAQ: Array<[string, string]> = [
  ["Do I need a LucidLink account?", "No. Postgame handles storage access behind the scenes. You only sign in to Postgame."],
  ["Can I create my account inside the app instead?", "Yes. The app has the same Create account form. Signing up here first just means you're ready the moment it opens."],
  ["Is it free?", "Yes. The app is free for videographers assigned to Postgame campaigns."],
  ["What file types can I upload?", "MOV, MP4, JPG, PNG and HEIC. Raw clips are fine; we rename on the way in."],
  ["Can I upload from my phone?", "Not yet. The desktop app is built for full-size footage. For photos from a phone, your Postgame contact can send you a web link."],
  ["Who do I talk to if something breaks?", "Email support@pstgm.com or message your campaign contact. We answer within one business day."],
];

function envUrl(value: string | undefined): string | null {
  const v = (value ?? "").trim();
  return /^https?:\/\//.test(v) ? v : null;
}

export default async function DesktopDownloadPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const [logos, { data: auth }] = await Promise.all([
    getPostgameLogos(),
    createServerSupabase().auth.getUser(),
  ]);

  const wantsDownload = searchParams.step === "download";
  const initialMode: CardMode = wantsDownload ? (auth.user ? "download" : "signin") : "create";

  const downloads = {
    mac: envUrl(process.env.NEXT_PUBLIC_DESKTOP_MAC_URL),
    windows: envUrl(process.env.NEXT_PUBLIC_DESKTOP_WIN_URL),
    version: (process.env.NEXT_PUBLIC_DESKTOP_VERSION ?? "1.0").trim() || "1.0",
  };
  const termsUrl = envUrl(process.env.NEXT_PUBLIC_TERMS_URL);
  const privacyUrl = envUrl(process.env.NEXT_PUBLIC_PRIVACY_URL);

  return (
    <div className="dl">
      {/* The marketing SiteNav is mounted by the root layout on every public
          route and would float over this page's own header. It hides itself
          by prefix (HIDDEN_ROUTES in src/components/SiteNav.tsx); that file
          is outside this branch, so until "/desktop" is added there this
          page hides it locally. Remove once SiteNav knows about /desktop. */}
      <style>{`.pg-nav{display:none !important}`}</style>

      <header className="dl-nav">
        <div className="dl-wrap dl-nav-in">
          <a className="dl-logo" href="/desktop" aria-label="Postgame">
            <img src={logos.onLight} alt="Postgame" />
          </a>
          <nav aria-label="Audience">
            <a href="/athlete/signup">For athletes</a>
            <a href="/portal/login">For brands</a>
            <a className="on" href="/desktop">For videographers</a>
            <a href="mailto:support@pstgm.com">Support</a>
          </nav>
          <a className="dl-btn sm" href="#signup">Create account</a>
        </div>
      </header>

      <section className="dl-hero">
        <div className="dl-wrap dl-hero-in">
          <div>
            <div className="dl-eyebrow">Postgame Desktop for videographers</div>
            <h1>Shoot it. Drop it. Done.</h1>
            <p className="dl-lead">
              The desktop app for videographers who shoot Postgame campaigns. Pick the athlete, drop
              your clips, and the footage lands in the right place, named the right way, with nothing
              to sort afterwards.
            </p>
            <div className="dl-ctas">
              <a className="dl-btn" href="#signup">Create your account</a>
              <a className="dl-btn ghost" href="#signin">I already have one</a>
            </div>
            <div className="dl-fine">
              Sign up first, then download. macOS 13 or later · Windows 10 or later · Free for
              assigned videographers
            </div>
          </div>
          <div className="dl-shot" aria-hidden="true">
            <AppWindowMock logo={logos.onDark} />
          </div>
        </div>
      </section>

      <section className="dl-signup" id="signup">
        <div className="dl-wrap dl-signup-in">
          <div>
            <div className="dl-eyebrow">Step 1 of 2</div>
            <h2>Create your Postgame account</h2>
            <p>
              This is the account you&rsquo;ll sign in to the desktop app with. Once Postgame assigns
              you to a campaign, it shows up there with the athletes you&rsquo;re shooting.
            </p>
            <ul className="dl-ul">
              <li>Takes about a minute</li>
              <li>No LucidLink account needed, we handle storage access</li>
              <li>Free for assigned videographers</li>
            </ul>
          </div>
          <div className="dl-card">
            <DesktopSignupCard
              initialMode={initialMode}
              downloads={downloads}
              termsUrl={termsUrl}
              privacyUrl={privacyUrl}
            />
          </div>
        </div>
      </section>

      <section className="dl-trust">
        <div className="dl-wrap">
          <div className="dl-trust-in">
            <div>
              <div className="dl-eyebrow">Backed by</div>
              <h2>Your footage is stored on LucidLink and Google Drive.</h2>
              <p>
                Postgame doesn&rsquo;t keep your files on a laptop or a random server. Every clip you
                upload is written straight into Postgame&rsquo;s LucidLink filespace, the same cloud
                storage used by film and broadcast teams, and the approved finals are delivered to
                Google Drive for the brand. Both keep versions, both are encrypted in transit and at
                rest, and nothing is ever deleted automatically.
              </p>
            </div>
            <div className="dl-logos">
              <div className="dl-logo-card">
                <img src={LUCIDLINK_ICON} alt="LucidLink" />
                <div>
                  <b>LucidLink</b>
                  <span>Raw footage and working files</span>
                </div>
              </div>
              <div className="dl-logo-card">
                <img src={GOOGLE_DRIVE_LOGO} alt="Google Drive" />
                <div>
                  <b>Google Drive</b>
                  <span>Approved finals, delivered to the brand</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dl-how">
        <div className="dl-wrap">
          <div className="dl-eyebrow">How it works</div>
          <h2>Four steps, start to finish.</h2>
          <div className="dl-steps">
            {STEPS.map(([h, p], i) => (
              <div className="dl-step" key={h}>
                <span className="dl-n">{i + 1}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dl-feat">
        <div className="dl-wrap">
          <div className="dl-feat-grid">
            {FEATURES.map(([h, p]) => (
              <div className="dl-f" key={h}>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dl-faq">
        <div className="dl-wrap">
          <h2>Common questions</h2>
          {FAQ.map(([q, a]) => (
            <details className="dl-q" key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="dl-cta2">
        <div className="dl-wrap dl-cta2-in">
          <div>
            <h2>Ready to shoot?</h2>
            <p>Create your account, download the app, and you&rsquo;re set for your next Postgame campaign.</p>
          </div>
          <div className="dl-ctas">
            <a className="dl-btn" href="#signup">Create your account</a>
            <a className="dl-btn ghost" href="#signin">Sign in &amp; download</a>
          </div>
        </div>
      </section>

      <footer className="dl-foot">
        <div className="dl-wrap dl-foot-in">
          <div>
            <span className="dl-logo">
              <img src={logos.onDark} alt="Postgame" />
            </span>
            <p>
              Postgame, LLC · 1570 Boulevard of the Arts, Suite 130-3, Sarasota, FL 34236
              <br />
              <a href="mailto:support@pstgm.com">support@pstgm.com</a> ·{" "}
              <a href="https://pstgm.com" rel="noopener noreferrer">pstgm.com</a>
            </p>
          </div>
          <nav aria-label="Footer">
            {privacyUrl && <a href={privacyUrl}>Privacy policy</a>}
            {termsUrl && <a href={termsUrl}>Terms of service</a>}
            <a href="/contact">Contact</a>
            <a href="mailto:support@pstgm.com">Support</a>
          </nav>
          <p className="dl-copy">
            © {new Date().getFullYear()} Postgame, LLC. All rights reserved. LucidLink and Google
            Drive are trademarks of their respective owners.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** The hero's picture of the desktop app — decorative, matches the prototype's dlMock().
 *  Placeholder names only; no real athlete, brand or campaign. */
function AppWindowMock({ logo }: { logo: string }) {
  const queue: Array<[string, number]> = [
    ["Taylor N Reel 01 - Brand Fall Campaign 2026 - v0.mov", 44],
    ["Jordan M Reel 03 - Brand Fall Campaign 2026 - v0.mov", 100],
  ];
  return (
    <div className="dl-win">
      <div className="dl-win-title">
        <span className="dl-dots"><i /><i /><i /></span>
        <img src="/icon.png" alt="" />
        <span>Postgame</span>
      </div>
      <div className="dl-win-body">
        <aside className="dl-win-side">
          <img src={logo} alt="" />
          {["Campaigns", "Upload", "Queue", "Settings"].map((l) => (
            <span className={"dl-win-nav" + (l === "Upload" ? " on" : "")} key={l}>
              {l}
              {l === "Queue" && <span className="c">2</span>}
            </span>
          ))}
        </aside>
        <div className="dl-win-main">
          <div className="dl-win-h">Upload · Fall campaign</div>
          <div className="dl-win-sub">Pick the athlete, then drop clips.</div>
          <div className="dl-chips">
            {["Jordan M", "Taylor N"].map((n, i) => (
              <span className={"dl-chip" + (i === 1 ? " on" : "")} key={n}>
                <span className="dl-av">{n.split(" ").map((w) => w[0]).join("")}</span>
                {n}
              </span>
            ))}
          </div>
          <div className="dl-drop">
            <div className="dl-drop-ico">↑</div>
            <b>Drop clips or a card folder here</b>
            <span>Keeps going if you close the window</span>
          </div>
          {queue.map(([f, p]) => (
            <div className="dl-q-row" key={f}>
              <div className="grow">
                <div className="dl-q-f">{f}</div>
                <div className="dl-bar"><i style={{ width: `${p}%` }} /></div>
              </div>
              <em className={p === 100 ? "ok" : undefined}>{p === 100 ? "In LucidLink ✓" : "Uploading"}</em>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
