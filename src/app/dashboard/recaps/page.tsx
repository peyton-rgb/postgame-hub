// ============================================================
// Campaign Recaps Page — /dashboard/recaps
//
// Two tabs (Active = drafts, Published), a 4:5 card grid, and a
// compact list view. Implements the approved redesign prototype
// (recaps-page.html) 1:1.
//
// Notes for anyone editing this file:
//   • Card photos go through supabaseImageUrl() — full-resolution
//     covers average 5.6 MB, the transform lands them at ~15-40 KB.
//     Never render thumbnail_url raw here.
//   • Brand colour comes from brands.fill_color. The older colour
//     columns on brands hold fabricated values and must not be read.
//   • Athlete/asset counts are grouped by PostgREST in the same
//     request (athletes(count), media(count)) — never N+1 per card.
//
// Pulls from: campaign_recaps (joined with brands, athletes, media)
// ============================================================

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import { supabaseImageUrl } from '@/lib/supabase-image';

// ---- Types ----

interface BrandRef {
  id: string;
  name: string;
  slug: string;
  logo_light_url: string | null;
  logo_url: string | null;
  logo_mark_url: string | null;
  fill_color: string | null;
}

interface CampaignRecap {
  id: string;
  name: string;
  slug: string;
  client_name: string;
  status: string;
  type: string;
  published: boolean;
  featured: boolean;
  thumbnail_url: string | null;
  hero_image_url: string | null;
  created_at: string;
  updated_at: string;
  brand: BrandRef | null;
  athleteCount: number;
  assetCount: number;
}

// PostgREST returns embedded aggregates as a single-element array:
// athletes(count) -> athletes: [{ count: 23 }]. Supabase's generated
// types don't model that, so the raw row is typed here and flattened
// in fetchRecaps().
type CountEmbed = { count: number }[] | null;

// ---- Status ----

type RecapStatus = 'published' | 'draft' | 'archived';

// Only 'draft' and 'published' exist in the data today; 'archived' is
// reachable through the card's ⋯ menu and disappears from both tabs.
function normalizeStatus(status: string | null | undefined): RecapStatus {
  if (status === 'published' || status === 'archived') return status;
  return 'draft';
}

// The two tabs in the header. Archive is not a tab — see the ⋯ menu.
type TabKey = 'draft' | 'published';

// ---- Brand mark resolution ----
//
// These two lists describe how a mark RENDERS, not which file it is —
// that's why they live here and the file paths don't. A separate DB job
// is fixing the underlying rows so brandMark() is correct for every
// brand; both lists are expected to shrink as logo files improve.

// Square badge marks — contained to a circle instead of stretched to
// wordmark width.
const SQUARE_MARKS = ['Whoop', 'Athlete Ally'];

// Single-colour dark artwork rendered knocked out to white on photos.
const KNOCKOUT_MARKS = ['UMG'];

// Wordmark for the dark card. Square-badge brands keep their mark
// column, which is where their (correct) square artwork already lives.
function brandMark(brand: BrandRef | null): string | null {
  if (!brand) return null;
  if (SQUARE_MARKS.includes(brand.name)) {
    return brand.logo_mark_url ?? brand.logo_light_url ?? brand.logo_url;
  }
  return brand.logo_light_url ?? brand.logo_url;
}

// Neutral, and deliberately not orange — fill_color is populated on 25
// of the 30 brands with published recaps; the rest land here.
const NEUTRAL_FILL = '#3a3a42';

function brandFill(brand: BrandRef | null): string {
  return brand?.fill_color || NEUTRAL_FILL;
}

// Soft brand-tinted plate behind a logo chip when there's no photo.
function chipTint(brand: BrandRef | null): string {
  const c = brandFill(brand);
  return `linear-gradient(150deg, ${c}38 0%, #0d0d11 62%, ${c}1f 100%)`;
}

function initials(name: string): string {
  return name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// The cover a card renders, if any. Both null => the no-content state.
function coverUrl(recap: CampaignRecap, thumbnailOverride: string | null): string | null {
  return thumbnailOverride || recap.hero_image_url || null;
}

// ---- Icons ----

const IconEye = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconPen = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

const IconCam = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

const IconDots = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="19" r="1.7" />
  </svg>
);

// ---- Page styles ----
//
// Ported from the approved prototype. Every selector is scoped under
// .rcp-page so nothing leaks into the rest of the dashboard, and the
// prototype's webfonts are mapped onto the ones layout.tsx already
// loads (Bebas Neue, JetBrains Mono) — Anton is not loaded outside the
// athlete app, so the display fallbacks use Bebas.
function RecapsStyles() {
  return (
    <style jsx global>{`
      .rcp-page {
        --orange: #d73f09;
        --raised: rgba(250, 248, 245, 0.07);
        --card: rgba(250, 248, 245, 0.04);
        --line: rgba(250, 248, 245, 0.1);
        --line-soft: rgba(250, 248, 245, 0.06);
        --t1: #faf8f5;
        --t2: rgba(250, 248, 245, 0.62);
        --t3: rgba(250, 248, 245, 0.38);
        --t4: rgba(250, 248, 245, 0.22);

        color: var(--t1);
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        -webkit-font-smoothing: antialiased;
      }
      .rcp-page .mono {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
      }
      .rcp-page .disp {
        font-family: var(--font-bebas), 'Bebas Neue', sans-serif;
        letter-spacing: 0.01em;
      }

      /* ---------- shell ---------- */
      .rcp-page .wrap {
        max-width: 1440px;
        margin: 0 auto;
        padding: 28px 32px 80px;
      }

      /* ---------- masthead ---------- */
      .rcp-page .eyebrow {
        font-size: 10px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--orange);
        margin-bottom: 8px;
      }
      .rcp-page .mast {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .rcp-page h1.disp {
        font-size: 52px;
        line-height: 0.92;
      }
      .rcp-page .lede {
        font-size: 13px;
        color: var(--t3);
        margin-top: 8px;
      }

      /* ---------- toolbar ---------- */
      .rcp-page .bar {
        position: sticky;
        top: 0;
        z-index: 20;
        background: rgba(7, 7, 10, 0.86);
        backdrop-filter: blur(26px);
        -webkit-backdrop-filter: blur(26px);
        border-bottom: 1px solid var(--line-soft);
        margin: 24px -32px 0;
        padding: 12px 32px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .rcp-page .seg {
        display: flex;
        gap: 2px;
        background: var(--card);
        border: 1px solid var(--line-soft);
        border-radius: 11px;
        padding: 3px;
      }
      .rcp-page .seg button {
        border: 0;
        background: transparent;
        color: var(--t3);
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        font-weight: 600;
        padding: 7px 14px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 7px;
        transition: 0.15s;
      }
      .rcp-page .seg button:hover {
        color: var(--t1);
      }
      .rcp-page .seg button.on {
        background: rgba(250, 248, 245, 0.09);
        color: var(--t1);
      }
      .rcp-page .seg .n {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 10px;
        color: var(--t4);
      }
      .rcp-page .seg button.on .n {
        color: var(--orange);
      }
      .rcp-page .grow {
        flex: 1;
        min-width: 180px;
        position: relative;
      }
      .rcp-page .grow > svg {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.32;
        pointer-events: none;
      }
      .rcp-page input[type='text'],
      .rcp-page select {
        width: 100%;
        background: var(--card);
        border: 1px solid var(--line-soft);
        border-radius: 10px;
        color: var(--t1);
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        padding: 10px 12px;
        outline: 0;
      }
      .rcp-page input[type='text'] {
        padding-left: 36px;
      }
      .rcp-page input::placeholder {
        color: var(--t4);
      }
      .rcp-page select {
        width: auto;
        min-width: 150px;
        cursor: pointer;
      }
      .rcp-page select option {
        background: #141418;
      }
      .rcp-page input:focus,
      .rcp-page select:focus {
        border-color: rgba(215, 63, 9, 0.55);
      }
      .rcp-page .view {
        display: flex;
        gap: 2px;
        background: var(--card);
        border: 1px solid var(--line-soft);
        border-radius: 10px;
        padding: 3px;
      }
      .rcp-page .view button {
        border: 0;
        background: transparent;
        color: var(--t3);
        padding: 7px 9px;
        border-radius: 7px;
        cursor: pointer;
        line-height: 0;
      }
      .rcp-page .view button.on {
        background: rgba(250, 248, 245, 0.09);
        color: var(--t1);
      }

      .rcp-page .rowmeta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 20px 0 14px;
        gap: 16px;
      }
      .rcp-page .rowmeta .c {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--t4);
      }

      /* ---------- grid ---------- */
      .rcp-page .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 18px;
      }
      @media (max-width: 1360px) {
        .rcp-page .grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media (max-width: 1040px) {
        .rcp-page .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 660px) {
        .rcp-page .grid {
          grid-template-columns: 1fr;
        }
        .rcp-page .wrap {
          padding: 20px 16px 60px;
        }
        .rcp-page .bar {
          margin: 20px -16px 0;
          padding: 12px 16px;
        }
        .rcp-page h1.disp {
          font-size: 38px;
        }
      }

      .rcp-page .card {
        background: var(--card);
        border: 1px solid var(--line-soft);
        border-radius: 16px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.26s cubic-bezier(0.2, 0.7, 0.3, 1), border-color 0.26s,
          background 0.26s;
        display: flex;
        flex-direction: column;
        position: relative;
        text-align: left;
      }
      .rcp-page .card:hover {
        transform: translateY(-4px);
        border-color: rgba(250, 248, 245, 0.2);
        background: var(--raised);
      }
      .rcp-page .well {
        position: relative;
        aspect-ratio: 4 / 5;
        background: #0d0d11;
        overflow: hidden;
        flex: none;
      }
      .rcp-page .well img.ph {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .rcp-page .scrim {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 42%;
        background: linear-gradient(
          to top,
          rgba(7, 7, 10, 0.8) 0%,
          rgba(7, 7, 10, 0.32) 48%,
          rgba(7, 7, 10, 0) 100%
        );
        pointer-events: none;
      }
      .rcp-page .edgefade {
        position: absolute;
        inset: 0;
        pointer-events: none;
        box-shadow: inset 0 0 0 1px rgba(250, 248, 245, 0.05),
          inset 0 -1px 40px rgba(7, 7, 10, 0.35);
      }
      /* brand mark centred on the photo */
      .rcp-page .mark {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 58%;
        height: 30%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .rcp-page .mark.sq {
        width: auto;
        height: 27%;
        aspect-ratio: 1 / 1;
      }
      .rcp-page .mark.sq img {
        max-height: 100%;
        width: auto;
      }
      .rcp-page .mark img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 3px 16px rgba(7, 7, 10, 0.75));
        transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
      }
      .rcp-page .card:hover .mark img {
        transform: scale(1.05);
      }
      .rcp-page .mark .txt {
        font-family: var(--font-bebas), 'Bebas Neue', sans-serif;
        font-size: 26px;
        letter-spacing: 0.04em;
        color: rgba(250, 248, 245, 0.94);
        text-shadow: 0 3px 16px rgba(7, 7, 10, 0.8);
        text-align: center;
        line-height: 1.05;
      }
      .rcp-page .mark img.knockout {
        filter: brightness(0) invert(1) drop-shadow(0 3px 16px rgba(7, 7, 10, 0.75));
      }
      .rcp-page .emptywell img.knockout {
        filter: brightness(0) invert(1);
        opacity: 0.34;
      }
      .rcp-page .card.empty-card:hover .emptywell img.knockout {
        filter: brightness(0) invert(1);
        opacity: 0.62;
      }
      .rcp-page .tint {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: rgba(7, 7, 10, 0.36);
        transition: background 0.28s;
      }
      .rcp-page .card:hover .tint {
        background: rgba(7, 7, 10, 0.24);
      }
      .rcp-page .vign {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(
          ellipse at 50% 46%,
          rgba(7, 7, 10, 0.22) 0%,
          rgba(7, 7, 10, 0.06) 50%,
          rgba(7, 7, 10, 0) 74%
        );
      }
      .rcp-page .flag {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        gap: 6px;
      }
      .rcp-page .pill {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 9px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 4px 9px;
        border-radius: 99px;
        background: rgba(7, 7, 10, 0.6);
        border: 1px solid var(--line);
        backdrop-filter: blur(10px);
        color: var(--t2);
      }
      .rcp-page .pill.hot {
        background: var(--orange);
        border-color: var(--orange);
        color: #fff;
      }
      .rcp-page .kebab {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        border-radius: 9px;
        background: rgba(7, 7, 10, 0.62);
        border: 1px solid var(--line);
        backdrop-filter: blur(10px);
        color: var(--t2);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: 0.18s;
        cursor: pointer;
        padding: 0;
      }
      .rcp-page .card:hover .kebab,
      .rcp-page .kebab.open {
        opacity: 1;
      }
      .rcp-page .kebab:hover {
        background: rgba(7, 7, 10, 0.9);
        color: var(--t1);
      }
      .rcp-page .cam {
        position: absolute;
        bottom: 10px;
        right: 10px;
        height: 30px;
        border-radius: 9px;
        background: rgba(7, 7, 10, 0.62);
        border: 1px solid var(--line);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: var(--t2);
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 10px;
        opacity: 0;
        transition: 0.18s;
        cursor: pointer;
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 9px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .rcp-page .card:hover .cam {
        opacity: 1;
      }
      .rcp-page .cam:hover {
        background: rgba(7, 7, 10, 0.92);
        border-color: rgba(215, 63, 9, 0.6);
        color: var(--orange);
      }
      .rcp-page .card.empty-card .cam {
        opacity: 0.85;
        bottom: 12px;
        right: 50%;
        transform: translateX(50%);
        background: rgba(250, 248, 245, 0.07);
      }
      .rcp-page .card.empty-card:hover .cam {
        opacity: 1;
        border-color: rgba(215, 63, 9, 0.6);
        color: var(--orange);
      }

      /* Touch devices: the hover state IS the resting state. Without
         this the ⋯ menu and the cover button are unreachable on a
         phone, where there is no hover to reveal them. */
      @media (hover: none), (max-width: 750px) {
        .rcp-page .kebab,
        .rcp-page .cam {
          opacity: 1;
        }
        .rcp-page .lr .kb {
          opacity: 1;
        }
      }

      .rcp-page .body {
        padding: 13px 15px 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
      }
      .rcp-page .brandline {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.17em;
        text-transform: uppercase;
        color: var(--t3);
        margin-bottom: -4px;
      }
      .rcp-page .card.empty-card .brandline {
        color: var(--t4);
      }
      .rcp-page .ttl {
        font-family: var(--font-bebas), 'Bebas Neue', sans-serif;
        font-size: 27px;
        font-weight: 400;
        line-height: 1.06;
        letter-spacing: 0.012em;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        min-height: 57px;
      }
      .rcp-page .stats {
        display: flex;
        align-items: center;
        gap: 14px;
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 11px;
        color: var(--t3);
        margin-top: auto;
        padding-top: 11px;
        border-top: 1px solid var(--line-soft);
      }
      .rcp-page .stats b {
        color: var(--t1);
        font-weight: 500;
      }
      .rcp-page .stats .sp {
        margin-left: auto;
        color: var(--t4);
      }

      /* card action buttons */
      .rcp-page .acts {
        display: flex;
        gap: 8px;
        margin-top: 2px;
      }
      .rcp-page .act {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 9px 10px;
        border-radius: 9px;
        border: 1px solid var(--line);
        background: var(--raised);
        color: var(--t2);
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.11em;
        text-transform: uppercase;
        cursor: pointer;
        transition: 0.16s;
        white-space: nowrap;
      }
      .rcp-page .act:hover {
        background: rgba(250, 248, 245, 0.12);
        border-color: rgba(250, 248, 245, 0.3);
        color: var(--t1);
      }
      .rcp-page .act.live {
        border-color: var(--orange);
        background: var(--orange);
        color: #fff;
        font-weight: 500;
      }
      .rcp-page .act.live:hover {
        background: #e8480f;
        border-color: #e8480f;
        color: #fff;
      }
      .rcp-page .act.live svg {
        opacity: 1;
      }
      .rcp-page .act.grey {
        border-color: var(--line);
        background: rgba(250, 248, 245, 0.06);
        color: var(--t3);
      }
      .rcp-page .act.grey:hover {
        background: rgba(250, 248, 245, 0.12);
        border-color: rgba(250, 248, 245, 0.26);
        color: var(--t1);
      }
      .rcp-page .act.edit {
        border-color: rgba(215, 63, 9, 0.4);
        background: rgba(215, 63, 9, 0.12);
        color: var(--orange);
      }
      .rcp-page .act.edit:hover {
        background: rgba(215, 63, 9, 0.22);
        border-color: rgba(215, 63, 9, 0.7);
        color: #ff6a33;
      }
      .rcp-page .act svg {
        opacity: 0.85;
        flex: none;
      }

      /* empty card — no content yet */
      .rcp-page .card.empty-card {
        opacity: 0.62;
        transition: opacity 0.26s, transform 0.26s cubic-bezier(0.2, 0.7, 0.3, 1),
          border-color 0.26s, background 0.26s;
      }
      .rcp-page .card.empty-card:hover {
        opacity: 1;
      }
      .rcp-page .card.empty-card .well {
        background: rgba(250, 248, 245, 0.035);
        border-bottom: 1px solid var(--line-soft);
      }
      .rcp-page .emptywell {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        position: relative;
      }
      .rcp-page .emptywell img {
        max-width: 56%;
        max-height: 30%;
        object-fit: contain;
        filter: grayscale(1) brightness(1.9);
        opacity: 0.4;
        transition: 0.26s;
      }
      .rcp-page .card.empty-card:hover .emptywell img {
        opacity: 0.72;
        filter: grayscale(0.35) brightness(1.4);
      }
      .rcp-page .emptywell .init {
        font-family: var(--font-bebas), 'Bebas Neue', sans-serif;
        font-size: 40px;
        letter-spacing: 0.05em;
        color: rgba(250, 248, 245, 0.28);
      }
      .rcp-page .emptywell .lbl {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 9px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--t4);
      }
      .rcp-page .card.empty-card .ttl {
        color: var(--t2);
      }
      .rcp-page .card.empty-card .stats b {
        color: var(--t3);
      }

      /* ---------- ⋯ menu ---------- */
      .rcp-page .menu {
        position: absolute;
        top: 44px;
        right: 10px;
        z-index: 30;
        min-width: 186px;
        background: rgba(14, 14, 18, 0.97);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 5px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .rcp-page .menu button {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        border: 0;
        background: transparent;
        color: var(--t2);
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        text-align: left;
        padding: 9px 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: 0.14s;
      }
      .rcp-page .menu button:hover {
        background: rgba(250, 248, 245, 0.09);
        color: var(--t1);
      }
      .rcp-page .menu button.danger:hover {
        background: rgba(239, 68, 68, 0.16);
        color: #fca5a5;
      }
      .rcp-page .menu .sep {
        height: 1px;
        background: var(--line-soft);
        margin: 4px 2px;
      }

      /* ---------- inline archive confirm ---------- */
      .rcp-page .confirm {
        position: absolute;
        inset: 0;
        z-index: 40;
        background: rgba(7, 7, 10, 0.86);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 18px;
        text-align: center;
      }
      .rcp-page .confirm p {
        font-size: 12px;
        line-height: 1.6;
        color: var(--t2);
      }
      .rcp-page .confirm p b {
        color: var(--t1);
      }
      .rcp-page .confirm .row {
        display: flex;
        gap: 8px;
      }
      .rcp-page .confirm button {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.11em;
        text-transform: uppercase;
        padding: 8px 14px;
        border-radius: 9px;
        border: 1px solid var(--line);
        background: var(--raised);
        color: var(--t2);
        cursor: pointer;
      }
      .rcp-page .confirm button.go {
        background: var(--orange);
        border-color: var(--orange);
        color: #fff;
      }

      /* ---------- list ---------- */
      /* overflow stays visible so a row's ⋯ menu isn't clipped by the
         container; the corner rounding the prototype got from
         overflow:hidden is put back on the first/last rows instead. */
      .rcp-page .list {
        border: 1px solid var(--line-soft);
        border-radius: 14px;
        background: var(--card);
      }
      .rcp-page .lh {
        border-radius: 13px 13px 0 0;
      }
      .rcp-page .lr:last-child {
        border-radius: 0 0 13px 13px;
      }
      .rcp-page .lh,
      .rcp-page .lr {
        display: grid;
        grid-template-columns: minmax(0, 2.4fr) minmax(0, 1.3fr) 88px 88px 108px 44px;
        align-items: center;
        gap: 14px;
        padding: 11px 16px;
      }
      .rcp-page .lh {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--t4);
        border-bottom: 1px solid var(--line-soft);
        background: rgba(250, 248, 245, 0.02);
      }
      .rcp-page .lr {
        border-bottom: 1px solid var(--line-soft);
        cursor: pointer;
        transition: background 0.15s;
        position: relative;
        text-align: left;
        width: 100%;
        border-left: 0;
        border-right: 0;
        border-top: 0;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .rcp-page .lr:last-child {
        border-bottom: 0;
      }
      .rcp-page .lr:hover {
        background: rgba(250, 248, 245, 0.045);
      }
      .rcp-page .lname {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .rcp-page .chip {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1px solid var(--line-soft);
      }
      .rcp-page .chip img {
        max-width: 76%;
        max-height: 60%;
        object-fit: contain;
      }
      .rcp-page .chip.photo img {
        max-width: 100%;
        max-height: 100%;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .rcp-page .chip .i {
        font-family: var(--font-bebas), 'Bebas Neue', sans-serif;
        font-size: 14px;
        opacity: 0.7;
      }
      .rcp-page .lname .n {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rcp-page .lbrand {
        font-size: 13px;
        color: var(--t2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rcp-page .num {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 12px;
        color: var(--t2);
        text-align: right;
      }
      .rcp-page .num.zero {
        color: var(--t4);
      }
      .rcp-page .ldate {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 11px;
        color: var(--t3);
      }
      .rcp-page .lr .kb {
        color: var(--t4);
        text-align: center;
        opacity: 0;
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 4px;
        line-height: 0;
      }
      .rcp-page .lr:hover .kb {
        opacity: 1;
      }
      .rcp-page .lr .menu {
        top: 40px;
        right: 12px;
      }

      /* ---------- brand group headers ---------- */
      .rcp-page .bgroup {
        margin-bottom: 40px;
      }
      .rcp-page .bghead {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-bottom: 12px;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--line-soft);
      }
      .rcp-page .bghead .nm {
        font-family: var(--font-bebas), 'Bebas Neue', sans-serif;
        font-size: 26px;
      }
      .rcp-page .bghead .ct {
        font-family: var(--font-mono), 'JetBrains Mono', monospace;
        font-size: 11px;
        color: var(--t4);
      }

      /* ---------- empty / loading ---------- */
      .rcp-page .empty {
        text-align: center;
        padding: 80px 20px;
      }
      .rcp-page .empty .h {
        font-family: var(--font-bebas), 'Bebas Neue', sans-serif;
        font-size: 30px;
        color: var(--t3);
      }
      .rcp-page .empty .p {
        font-size: 13px;
        color: var(--t4);
        margin-top: 6px;
      }
      .rcp-page .skel {
        background: var(--card);
        border: 1px solid var(--line-soft);
        border-radius: 16px;
        overflow: hidden;
      }
      .rcp-page .skel .w {
        aspect-ratio: 4 / 5;
        background: rgba(250, 248, 245, 0.04);
      }
      .rcp-page .skel .b {
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .rcp-page .skel .l {
        height: 10px;
        border-radius: 4px;
        background: rgba(250, 248, 245, 0.05);
      }
      @keyframes rcpPulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.45;
        }
      }
      .rcp-page .skel {
        animation: rcpPulse 1.6s ease-in-out infinite;
      }
    `}</style>
  );
}
// ---- Card Photo Picker Modal ----

interface MediaImage {
  id: string;
  file_url: string;
  thumbnail_url: string | null;
  type: string;
  is_hero: boolean;
}

function CardPhotoPicker({
  recapId,
  currentThumbnailUrl,
  isOpen,
  onClose,
  onSelect,
}: {
  recapId: string;
  currentThumbnailUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (fileUrl: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setLoading(true);
      setImages([]);
      setError(null);
      setSavingId(null);
      return;
    }
    let cancelled = false;
    async function load() {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from('media')
        .select('id, file_url, thumbnail_url, type, is_hero')
        .eq('campaign_id', recapId)
        .eq('type', 'image')
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setImages((data as MediaImage[]) || []);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, recapId]);

  async function selectImage(img: MediaImage) {
    if (savingId) return;
    setSavingId(img.id);
    const supabase = createBrowserSupabase();
    try {
      // Drive the card thumbnail + the public hero off one photo.
      await supabase
        .from('campaign_recaps')
        .update({ thumbnail_url: img.file_url })
        .eq('id', recapId);
      await supabase.from('media').update({ is_hero: false }).eq('campaign_id', recapId);
      await supabase
        .from('media')
        .update({ is_hero: true, hero_order: 0 })
        .eq('id', img.id);
      onSelect(img.file_url);
      onClose();
    } catch (e: any) {
      setError(String(e?.message || e));
      setSavingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !savingId) onClose();
      }}
    >
      <div className="w-[95vw] h-[85vh] max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-widest text-[#D73F09] uppercase">
              Card photo
            </div>
            <h2 className="text-xl font-black text-white truncate">Choose card photo</h2>
            <div className="text-xs text-gray-500 mt-0.5">
              Sets the card thumbnail and the public hero image.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <svg className="animate-spin h-8 w-8 text-[#D73F09]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 mt-20 text-sm">{error}</div>
          ) : images.length === 0 ? (
            <div className="text-center text-gray-500 mt-20 text-sm">
              No images found for this campaign.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {images.map((img) => {
                const isCurrent = img.file_url === currentThumbnailUrl;
                const isSaving = savingId === img.id;
                return (
                  <button
                    key={img.id}
                    onClick={() => selectImage(img)}
                    disabled={!!savingId}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all disabled:cursor-wait ${
                      isCurrent
                        ? 'border-[#D73F09] ring-2 ring-[#D73F09]/30'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="aspect-square bg-black">
                      <img
                        src={supabaseImageUrl(img.thumbnail_url || img.file_url, 400) || img.file_url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (!el.dataset.fellBack) {
                            el.dataset.fellBack = '1';
                            el.src = img.file_url;
                          }
                        }}
                      />
                    </div>
                    {isCurrent && (
                      <div className="absolute top-2 left-2 bg-[#D73F09] px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-wide">
                        Current
                      </div>
                    )}
                    {isSaving && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <svg className="animate-spin h-6 w-6 text-[#D73F09]" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ---- Delete Dialog ----

interface DeletePreflight {
  recap: { id: string; name: string };
  blockers: { table: string; label: string; count: number }[];
  warnings: { mediaCount: number; athleteCount: number; slotCount: number; slotted: boolean };
}

function DeleteRecapDialog({
  recap,
  onClose,
  onDeleted,
}: {
  recap: CampaignRecap;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [preflight, setPreflight] = useState<DeletePreflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/recaps/${recap.id}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Failed to load delete details');
        } else {
          setPreflight(json as DeletePreflight);
        }
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      }
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [recap.id]);

  async function doDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/recaps/${recap.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Delete failed');
        setDeleting(false);
        return;
      }
      onDeleted(recap.id);
    } catch (e: any) {
      setError(String(e?.message || e));
      setDeleting(false);
    }
  }

  const blockers = preflight?.blockers ?? [];
  const isBlocked = blockers.length > 0;
  const w = preflight?.warnings;
  const canDelete = !isBlocked && !deleting && confirmText.trim().toUpperCase() === 'DELETE';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <div className="text-[10px] font-bold tracking-widest text-red-400 uppercase">
            Delete recap
          </div>
          <h2 className="text-lg font-black text-white truncate">{recap.name}</h2>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-7 w-7 text-white/40" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : isBlocked ? (
            // Blockers: explanation instead of a delete control.
            <div>
              <p className="text-sm text-white/70 leading-relaxed mb-3">
                This recap can&apos;t be deleted — it&apos;s referenced by:
              </p>
              <ul className="space-y-1.5 mb-4">
                {blockers.map((b) => (
                  <li key={b.table} className="text-sm text-white/80 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-400" />
                    {b.count} {b.label}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-white/40 leading-relaxed">
                Remove or re-point those references first, then delete this recap.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-white/70 leading-relaxed mb-3">
                This permanently deletes{' '}
                <span className="font-semibold text-white">{w?.mediaCount ?? 0} media files</span> and{' '}
                <span className="font-semibold text-white">{w?.athleteCount ?? 0} athlete rows</span>.
                This cannot be undone.
              </p>
              {w?.slotted && (
                <p className="text-sm text-red-400 leading-relaxed mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  ⚠ This recap is live on the website ({w.slotCount} slot
                  {w.slotCount === 1 ? '' : 's'}) — deleting removes that content from the public
                  site.
                </p>
              )}
              <label className="block text-xs text-white/50 mb-1.5">
                Type <span className="font-mono font-semibold text-white/80">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-red-500/50 transition-colors"
                placeholder="DELETE"
              />
            </div>
          )}

          {error && <div className="mt-4 text-sm text-red-400">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
          >
            {isBlocked ? 'Close' : 'Cancel'}
          </button>
          {!loading && !isBlocked && (
            <button
              onClick={doDelete}
              disabled={!canDelete}
              title={!canDelete && !deleting ? "Type DELETE in the box above to confirm" : undefined}
              className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-500/85 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Delete recap'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
// ---- ⋯ Menu ----
//
// Replaces the delete ✕, the archive button and the loose controls that
// used to float on the photo. The camera button is a shortcut to the
// same picker this menu opens — two entry points, one dialog.

function CardMenu({
  status,
  onChooseCover,
  onArchive,
  onUnarchive,
  onDelete,
  onClose,
}: {
  status: RecapStatus;
  onChooseCover: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <div className="menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button onClick={onChooseCover}>Choose cover photo</button>
      {status === 'published' && <button onClick={onArchive}>Archive</button>}
      {status === 'archived' && <button onClick={onUnarchive}>Unarchive</button>}
      <div className="sep" />
      <button className="danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

// ---- Recap Card ----

function RecapCard({
  recap,
  tab,
  onArchive,
  onUnarchive,
  onRequestDelete,
}: {
  recap: CampaignRecap;
  tab: TabKey;
  onArchive: (r: CampaignRecap) => void;
  onUnarchive: (r: CampaignRecap) => void;
  onRequestDelete: (r: CampaignRecap) => void;
}) {
  const router = useRouter();
  const status = normalizeStatus(recap.status);
  const brandName = recap.brand?.name || recap.client_name;
  const mark = brandMark(recap.brand);
  const isSquare = SQUARE_MARKS.includes(brandName);
  const isKnockout = KNOCKOUT_MARKS.includes(brandName);

  const [thumbnailUrl, setThumbnailUrl] = useState(recap.thumbnail_url);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const cover = coverUrl(recap, thumbnailUrl);

  // Published cards lead with viewing; unpublished ones have editing as
  // the only move, so it takes the orange.
  const actions =
    tab === 'published' ? (
      <div className="acts">
        <Link
          href={`/recap/${recap.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="act live"
          style={{ flex: 1.35 }}
          onClick={(e) => e.stopPropagation()}
        >
          <IconEye /> View live
        </Link>
        <Link
          href={`/dashboard/${recap.id}`}
          className="act grey"
          onClick={(e) => e.stopPropagation()}
        >
          <IconPen /> Edit recap
        </Link>
      </div>
    ) : (
      <div className="acts">
        <Link
          href={`/dashboard/${recap.id}`}
          className="act edit"
          style={{ flex: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <IconPen /> Edit recap
        </Link>
      </div>
    );

  const kebab = (
    <button
      className={`kebab${menuOpen ? ' open' : ''}`}
      aria-label="More actions"
      onClick={(e) => {
        e.stopPropagation();
        setMenuOpen((v) => !v);
      }}
    >
      <IconDots />
    </button>
  );

  const body = (
    <div className="body">
      <div className="brandline">{brandName}</div>
      <div className="ttl">{recap.name}</div>
      <div className="stats">
        <span>
          <b>{recap.athleteCount}</b> athletes
        </span>
        <span>
          <b>{recap.assetCount}</b> assets
        </span>
        <span className="sp">{formatDate(recap.created_at)}</span>
      </div>
      {actions}
    </div>
  );

  return (
    <>
      <article
        className={`card${cover ? '' : ' empty-card'}`}
        onClick={() => router.push(`/dashboard/${recap.id}`)}
      >
        <div className="well">
          {cover ? (
            <>
              {/* Full-resolution covers average 5.6 MB; the transform
                  serves the same frame at ~15-40 KB. srcSet carries the
                  retina step, onError falls back to the original so a
                  failed transform never leaves a blank card. */}
              <img
                className="ph"
                src={supabaseImageUrl(cover, 600) ?? cover}
                srcSet={
                  supabaseImageUrl(cover, 600) === cover
                    ? undefined
                    : `${supabaseImageUrl(cover, 600)} 600w, ${supabaseImageUrl(cover, 1200)} 1200w`
                }
                sizes="(max-width: 660px) 92vw, (max-width: 1040px) 46vw, (max-width: 1360px) 31vw, 340px"
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (!el.dataset.fellBack) {
                    el.dataset.fellBack = '1';
                    el.srcset = '';
                    el.src = cover;
                  }
                }}
              />
              <div className="tint" />
              <div className="vign" />
              {mark ? (
                <div className={`mark${isSquare ? ' sq' : ''}`}>
                  <img className={isKnockout ? 'knockout' : ''} src={mark} alt={brandName} />
                </div>
              ) : (
                <div className="mark">
                  <span className="txt">{brandName}</span>
                </div>
              )}
              <div className="scrim" />
              <div className="edgefade" />
              <div className="flag">{recap.featured && <span className="pill hot">Featured</span>}</div>
              {kebab}
              <button
                className="cam"
                title="Choose cover photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerOpen(true);
                }}
              >
                <IconCam /> Cover
              </button>
            </>
          ) : (
            <>
              <div className="emptywell">
                {mark ? (
                  <img className={isKnockout ? 'knockout' : ''} src={mark} alt={brandName} />
                ) : (
                  <span className="init">{initials(brandName)}</span>
                )}
                <span className="lbl">No content yet</span>
              </div>
              <div className="edgefade" />
              {kebab}
              <button
                className="cam"
                title="Choose cover photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerOpen(true);
                }}
              >
                <IconCam /> Add cover
              </button>
            </>
          )}

          {confirmArchive && (
            <div className="confirm" onClick={(e) => e.stopPropagation()}>
              <p>
                Archive <b>{recap.name}</b>? It leaves the public site and this grid but stays in
                the brand&apos;s portal.
              </p>
              <div className="row">
                <button onClick={() => setConfirmArchive(false)}>Cancel</button>
                <button
                  className="go"
                  onClick={() => {
                    setConfirmArchive(false);
                    onArchive(recap);
                  }}
                >
                  Archive
                </button>
              </div>
            </div>
          )}
        </div>

        {menuOpen && (
          <CardMenu
            status={status}
            onChooseCover={() => {
              setMenuOpen(false);
              setPickerOpen(true);
            }}
            onArchive={() => {
              setMenuOpen(false);
              setConfirmArchive(true);
            }}
            onUnarchive={() => {
              setMenuOpen(false);
              onUnarchive(recap);
            }}
            onDelete={() => {
              setMenuOpen(false);
              onRequestDelete(recap);
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}

        {body}
      </article>

      <CardPhotoPicker
        recapId={recap.id}
        currentThumbnailUrl={thumbnailUrl}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(fileUrl) => setThumbnailUrl(fileUrl)}
      />
    </>
  );
}

// ---- List Row ----

function ListRow({
  recap,
  onArchive,
  onUnarchive,
  onRequestDelete,
}: {
  recap: CampaignRecap;
  onArchive: (r: CampaignRecap) => void;
  onUnarchive: (r: CampaignRecap) => void;
  onRequestDelete: (r: CampaignRecap) => void;
}) {
  const router = useRouter();
  const status = normalizeStatus(recap.status);
  const brandName = recap.brand?.name || recap.client_name;
  const mark = brandMark(recap.brand);

  const [thumbnailUrl, setThumbnailUrl] = useState(recap.thumbnail_url);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const cover = coverUrl(recap, thumbnailUrl);

  return (
    <>
      <div className="lr" onClick={() => router.push(`/dashboard/${recap.id}`)}>
        <div className="lname">
          {cover ? (
            <span className="chip photo">
              {/* 34px chip — 100w is all it can show. */}
              <img
                src={supabaseImageUrl(cover, 100) ?? cover}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (!el.dataset.fellBack) {
                    el.dataset.fellBack = '1';
                    el.src = cover;
                  }
                }}
              />
            </span>
          ) : (
            <span className="chip" style={{ background: chipTint(recap.brand) }}>
              {mark ? (
                <img src={mark} alt="" />
              ) : (
                <span className="i" style={{ color: brandFill(recap.brand) }}>
                  {initials(brandName)}
                </span>
              )}
            </span>
          )}
          <span className="n">{recap.name}</span>
        </div>
        <div className="lbrand">{brandName}</div>
        <div className={`num${recap.athleteCount ? '' : ' zero'}`}>
          {recap.athleteCount || '—'}
        </div>
        <div className={`num${recap.assetCount ? '' : ' zero'}`}>{recap.assetCount || '—'}</div>
        <div className="ldate">{formatDate(recap.created_at)}</div>
        <button
          className="kb"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <IconDots size={14} />
        </button>

        {menuOpen && (
          <CardMenu
            status={status}
            onChooseCover={() => {
              setMenuOpen(false);
              setPickerOpen(true);
            }}
            onArchive={() => {
              setMenuOpen(false);
              onArchive(recap);
            }}
            onUnarchive={() => {
              setMenuOpen(false);
              onUnarchive(recap);
            }}
            onDelete={() => {
              setMenuOpen(false);
              onRequestDelete(recap);
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      <CardPhotoPicker
        recapId={recap.id}
        currentThumbnailUrl={thumbnailUrl}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(fileUrl) => setThumbnailUrl(fileUrl)}
      />
    </>
  );
}

// ---- Main Page ----

type SortKey = 'newest' | 'oldest' | 'az' | 'brand' | 'athletes';

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  az: 'Name A–Z',
  brand: 'Group by brand',
  athletes: 'Most athletes',
};

export default function RecapsPage() {
  const [recaps, setRecaps] = useState<CampaignRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('draft');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [deleteTarget, setDeleteTarget] = useState<CampaignRecap | null>(null);

  useEffect(() => {
    async function fetchRecaps() {
      const supabase = createBrowserSupabase();
      // Explicit column list: select('*') drags four large jsonb columns
      // (settings, public_sections, metric_overrides) across 626 rows that
      // no card reads. athletes(count)/media(count) are PostgREST
      // aggregates — Postgres groups them server-side in this one request,
      // so the counts cost no extra round trips and no per-card queries.
      const { data, error } = await supabase
        .from('campaign_recaps')
        .select(
          `
          id, name, slug, client_name, status, type, published, featured,
          thumbnail_url, hero_image_url, created_at, updated_at,
          athletes(count), media(count),
          brand:brands!campaigns_brand_id_fkey (
            id, name, slug, logo_light_url, logo_url, logo_mark_url, fill_color
          )
        `
        )
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRecaps(
          (data as any[]).map((r) => ({
            ...r,
            athleteCount: (r.athletes as CountEmbed)?.[0]?.count ?? 0,
            assetCount: (r.media as CountEmbed)?.[0]?.count ?? 0,
          })) as CampaignRecap[]
        );
      }
      setLoading(false);
    }
    fetchRecaps();
  }, []);

  // Tab counts over the full loaded list. Archived rows belong to
  // neither tab — archiving removes a recap from this page entirely.
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { draft: 0, published: 0 };
    for (const r of recaps) {
      const s = normalizeStatus(r.status);
      if (s === 'draft' || s === 'published') counts[s]++;
    }
    return counts;
  }, [recaps]);

  const brandCount = useMemo(
    () => new Set(recaps.map((r) => r.brand?.id).filter(Boolean)).size,
    [recaps]
  );

  // Brand dropdown — distinct brands across both tabs, keyed by brand_id.
  const brandOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recaps) if (r.brand?.id) map.set(r.brand.id, r.brand.name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [recaps]);

  const visible = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    const list = recaps.filter((r) => {
      if (normalizeStatus(r.status) !== tab) return false;
      if (brandFilter !== 'all' && r.brand?.id !== brandFilter) return false;
      if (!s) return true;
      const brandName = r.brand?.name || r.client_name;
      return r.name.toLowerCase().includes(s) || brandName.toLowerCase().includes(s);
    });

    const byCreated = (a: CampaignRecap, b: CampaignRecap) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    switch (sortBy) {
      case 'oldest':
        return list.sort((a, b) => -byCreated(a, b));
      case 'az':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'athletes':
        return list.sort((a, b) => b.athleteCount - a.athleteCount || byCreated(a, b));
      case 'brand':
        return list.sort(
          (a, b) =>
            (a.brand?.name || a.client_name).localeCompare(b.brand?.name || b.client_name) ||
            byCreated(a, b)
        );
      case 'newest':
      default:
        return list.sort(byCreated);
    }
  }, [recaps, tab, brandFilter, searchTerm, sortBy]);

  // "Group by brand" renders section headers above sub-grids — adidas
  // alone has 22 published recaps, CVS 14.
  const brandGroups = useMemo(() => {
    if (sortBy !== 'brand') return [];
    const groups = new Map<string, { key: string; brand: BrandRef | null; name: string; recaps: CampaignRecap[] }>();
    for (const r of visible) {
      const name = r.brand?.name || r.client_name;
      const key = r.brand?.id || `client:${r.client_name}`;
      if (!groups.has(key)) groups.set(key, { key, brand: r.brand, name, recaps: [] });
      groups.get(key)!.recaps.push(r);
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sortBy, visible]);

  // Optimistically flip a recap's status, then persist. Revert on error.
  async function setRecapStatus(recap: CampaignRecap, newStatus: RecapStatus) {
    const prevStatus = recap.status;
    setRecaps((rs) => rs.map((r) => (r.id === recap.id ? { ...r, status: newStatus } : r)));
    const supabase = createBrowserSupabase();
    const { error } = await supabase
      .from('campaign_recaps')
      .update({ status: newStatus })
      .eq('id', recap.id);
    if (error) {
      setRecaps((rs) => rs.map((r) => (r.id === recap.id ? { ...r, status: prevStatus } : r)));
      alert(
        `Failed to ${newStatus === 'archived' ? 'archive' : 'unarchive'} "${recap.name}": ${error.message}`
      );
    }
  }

  const handleArchive = (r: CampaignRecap) => setRecapStatus(r, 'archived');
  const handleUnarchive = (r: CampaignRecap) => setRecapStatus(r, 'published');

  function handleDeleted(id: string) {
    setRecaps((rs) => rs.filter((r) => r.id !== id));
    setDeleteTarget(null);
  }

  const cardProps = {
    onArchive: handleArchive,
    onUnarchive: handleUnarchive,
    onRequestDelete: setDeleteTarget,
  };

  const filtersActive = searchTerm.trim() !== '' || brandFilter !== 'all';

  return (
    <div className="rcp-page">
      <RecapsStyles />

      <div className="wrap">
        {/* Masthead */}
        <div className="mast">
          <div>
            <div className="eyebrow">Campaign library</div>
            <h1 className="disp">Campaign Recaps</h1>
            <div className="lede">
              {loading
                ? 'Loading…'
                : `${tabCounts.draft} active · ${tabCounts.published} published · ${brandCount} brands`}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bar">
          <div className="seg">
            {([
              { key: 'draft' as TabKey, label: 'Active' },
              { key: 'published' as TabKey, label: 'Published' },
            ]).map((t) => (
              <button
                key={t.key}
                className={tab === t.key ? 'on' : ''}
                onClick={() => setTab(t.key)}
              >
                {t.label} <span className="n">{tabCounts[t.key]}</span>
              </button>
            ))}
          </div>

          <div className="grow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search campaigns or brands"
            />
          </div>

          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="all">All brands</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>

          <div className="view">
            <button
              className={view === 'grid' ? 'on' : ''}
              title="Grid"
              aria-label="Grid view"
              onClick={() => setView('grid')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              className={view === 'list' ? 'on' : ''}
              title="List"
              aria-label="List view"
              onClick={() => setView('list')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="rowmeta">
          <div className="c">
            {loading
              ? ''
              : visible.length
              ? `${visible.length} of ${tabCounts[tab]} ${
                  tab === 'draft' ? 'active campaigns' : 'published recaps'
                } · sorted by ${SORT_LABELS[sortBy].toLowerCase()}`
              : ''}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="skel">
                <div className="w" />
                <div className="b">
                  <div className="l" style={{ width: '40%' }} />
                  <div className="l" style={{ width: '80%', height: 16 }} />
                  <div className="l" style={{ width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid — grouped under brand headers when sorting by brand */}
        {!loading && visible.length > 0 && view === 'grid' && sortBy === 'brand' && (
          <div>
            {brandGroups.map((g) => (
              <section key={g.key} className="bgroup">
                <div className="bghead">
                  <span className="chip" style={{ background: chipTint(g.brand) }}>
                    {brandMark(g.brand) ? (
                      <img src={brandMark(g.brand) as string} alt="" />
                    ) : (
                      <span className="i" style={{ color: brandFill(g.brand) }}>
                        {initials(g.name)}
                      </span>
                    )}
                  </span>
                  <span className="nm">{g.name}</span>
                  <span className="ct">{g.recaps.length}</span>
                </div>
                <div className="grid">
                  {g.recaps.map((r) => (
                    <RecapCard key={r.id} recap={r} tab={tab} {...cardProps} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Grid — flat */}
        {!loading && visible.length > 0 && view === 'grid' && sortBy !== 'brand' && (
          <div className="grid">
            {visible.map((r) => (
              <RecapCard key={r.id} recap={r} tab={tab} {...cardProps} />
            ))}
          </div>
        )}

        {/* List */}
        {!loading && visible.length > 0 && view === 'list' && (
          <div className="list">
            <div className="lh">
              <div>Campaign</div>
              <div>Brand</div>
              <div style={{ textAlign: 'right' }}>Athletes</div>
              <div style={{ textAlign: 'right' }}>Assets</div>
              <div>Created</div>
              <div />
            </div>
            {visible.map((r) => (
              <ListRow key={r.id} recap={r} {...cardProps} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && visible.length === 0 && (
          <div className="empty">
            <div className="h">{filtersActive ? 'Nothing matches' : 'Nothing here yet'}</div>
            <div className="p">
              {filtersActive
                ? 'Try a different search or clear the brand filter.'
                : tab === 'draft'
                ? 'Active campaigns appear here as they are created.'
                : 'Recaps appear here once they are published.'}
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteRecapDialog
          recap={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
