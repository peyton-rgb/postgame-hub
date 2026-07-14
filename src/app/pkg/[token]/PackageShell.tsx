"use client";

import type { AssetPackage } from "@/lib/packages";

// ============================================================
// Postgame shell for the public package page (/pkg/[token]).
//
// Postgame owns the chrome; the client owns the content. This frames the
// existing client-skinned package (PackageClient) in a dark Postgame
// "Liquid Glass" wrapper — sticky header, dark orange-glow background, intro
// line, and footer — so an editor knows it's a Postgame tool delivering a
// client kit. It's brand-agnostic: the outer chrome is always Postgame, and
// the inner card is whatever `brand_id` the package points at, so every
// package gets this frame automatically.
//
// The Postgame mark is the real logo file (/postgame-logo-white.png, the same
// asset the dashboard uses via <PostgameLogo>), never typed text. The share
// token is deliberately kept out of the header — it still lives in the URL.
// ============================================================

const PG_LOGO = "/postgame-logo-white.png";

export default function PackageShell({
  pkg,
  children,
}: {
  pkg: AssetPackage;
  children: React.ReactNode;
}) {
  const isLive = pkg.status === "live";

  return (
    <div className="pg-shell">
      {/* Postgame header — sticky, dark Liquid Glass */}
      <header className="pg-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pg-logo" src={PG_LOGO} alt="Postgame" />
        <div className="pg-crumb">
          ASSET PACKAGES / <b>{pkg.name}</b>
        </div>
        <div className="pg-right">
          {isLive ? <span className="pill live">Live</span> : null}
        </div>
      </header>

      {/* Dark frame with the client "document" card floating inside */}
      <div className="frame">
        <div className="intro">
          <div className="t">Editor Asset Package</div>
          <div className="s">
            Everything an editor needs — brand kit + name tags. Sent by Postgame.
          </div>
        </div>
        {children}
      </div>

      {/* Postgame footer */}
      <footer className="pg-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pg-logo foot" src={PG_LOGO} alt="Postgame" />
        <span className="note">· Editor asset package · works offline</span>
        <span className="r">postgame.com</span>
      </footer>

      <style jsx>{`
        .pg-shell {
          --ink: #07070a;
          --orange: #d73f09;
          --off: #faf8f5;
          --line: rgba(255, 255, 255, 0.1);
          --muted: #9a9aa2;
          min-height: 100vh;
          color: var(--off);
          background: radial-gradient(
              1100px 600px at 82% -10%,
              rgba(215, 63, 9, 0.16),
              transparent 60%
            ),
            radial-gradient(
              800px 500px at -5% 108%,
              rgba(215, 63, 9, 0.07),
              transparent 55%
            ),
            var(--ink);
        }
        /* Postgame header */
        .pg-head {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 26px;
          background: rgba(10, 10, 12, 0.72);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--line);
        }
        .pg-logo {
          height: 26px;
          width: auto;
          object-fit: contain;
          display: block;
        }
        .pg-crumb {
          font-family: var(--font-bebas), "Bebas Neue", Impact, sans-serif;
          font-size: 14px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--muted);
          margin-left: 4px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pg-crumb b {
          color: var(--off);
          font-weight: 400;
        }
        .pg-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          flex: none;
        }
        .pill {
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 5px 10px;
          border-radius: 20px;
        }
        .pill.live {
          background: rgba(46, 160, 90, 0.16);
          color: #57d98a;
          border: 1px solid rgba(46, 160, 90, 0.3);
        }
        /* Frame + intro */
        .frame {
          max-width: 1020px;
          margin: 26px auto;
          padding: 0 22px 40px;
        }
        .intro {
          text-align: center;
          margin-bottom: 18px;
        }
        .intro .t {
          font-family: var(--font-bebas), "Bebas Neue", Impact, sans-serif;
          font-size: 30px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .intro .s {
          color: var(--muted);
          font-size: 13px;
          margin-top: 4px;
        }
        /* Postgame footer */
        .pg-foot {
          max-width: 1020px;
          margin: 0 auto;
          padding: 22px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--muted);
          font-size: 12px;
          border-top: 1px solid var(--line);
        }
        .pg-logo.foot {
          height: 20px;
        }
        .pg-foot .r {
          margin-left: auto;
        }
        @media (max-width: 720px) {
          .pg-head {
            gap: 10px;
            padding: 12px 16px;
          }
          .pg-crumb {
            font-size: 12px;
          }
          .frame {
            padding: 0 14px 32px;
          }
          .pg-foot .note {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
