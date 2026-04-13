# Postgame Hub — Architecture Guide

Plain-English map of every file and folder in this repo.
Last updated: April 2026

## The Big Picture

Your repo lives at ~/postgame/hub on your iMac (and now also your MacBook Air).
Your live app runs at postgame-hub.vercel.app.

The repo has two main parts:
- src/ — Your actual app code. This is what matters.
- Everything else at the root — Config files, scripts, and some things that should not be here.

## src/app/ — Every Page Your App Has

Each folder here is one room in your app. Next.js turns folders into URLs automatically.
So src/app/press/page.tsx becomes postgame-hub.vercel.app/press.

PUBLIC PAGES (anyone can visit):
- page.tsx (root) → / — Your homepage
- about/team/ → /about/team — Team page
- contact/ → /contact — Contact form
- press/ → /press — Press articles
- campaigns/ → /campaigns — Campaigns listing
- case-studies/ → /case-studies — Case studies listing
- case-studies/[slug]/ → /case-studies/anything — Individual case study
- clients/ → /clients — Clients listing
- deals/ → /deals — Deals listing
- deals/[id]/ → /deals/anything — Individual deal
- athletes/[slug]/ → /athletes/anything — Athlete profile
- services/always-on/ → /services/always-on
- services/elevated/ → /services/elevated
- services/experiential/ → /services/experiential
- services/scaled/ → /services/scaled
- media-library/ → /media-library — Media browser

CLIENT-FACING PAGES (you send these links to clients or athletes):
- pitch/[slug]/ → /pitch/anything — Brand pitch decks
- brief/[slug]/ → /brief/anything — Campaign briefs
- recap/[slug]/ → /recap/anything — Campaign recaps
- campaign-optin/[slug]/ → /campaign-optin/anything — Athlete opt-in forms
- campaign-instructions/[slug]/ → /campaign-instructions/anything — Instructions for athletes
- optin/[slug]/ → /optin/anything — Alternate opt-in pages (may be duplicate)

RUN-OF-SHOW PAGES (event logistics):
- run-of-show/ — Main listing
- run-of-show/[slug]/ — Dynamic by slug
- run-of-show/[slug]/[city]/ — City-specific
- run-of-show/baton-rouge/ — Hardcoded city page
- run-of-show/chicago/ — Hardcoded city page
- run-of-show/dallas/ — Hardcoded city page
- run-of-show/denver/ — Hardcoded city page
- run-of-show/philadelphia/ — Hardcoded city page
- run-of-show/phoenix/ — Hardcoded city page
- run-of-show/pittsburgh/ — Hardcoded city page

PRIVATE DASHBOARD (requires login — all under /dashboard/):
- dashboard/page.tsx — Dashboard home
- dashboard/brands/ — Browse brands
- dashboard/brands/[id]/ — Edit a brand
- dashboard/deals/[id]/ — Edit a deal
- dashboard/press/[id]/ — Edit a press article
- dashboard/case-studies/[id]/ — Edit a case study
- dashboard/pitches/[id]/ — Edit a pitch page
- dashboard/briefs/[id]/ — Edit a brief
- dashboard/trackers/[id]/ — Edit a tracker
- dashboard/run-of-show/ — Manage run-of-show events
- dashboard/run-of-show/[id]/ — Edit a run-of-show
- dashboard/campaign-optin/ — Manage opt-ins
- dashboard/campaign-optin/[id]/ — Edit an opt-in
- dashboard/campaign-instructions/ — Manage instructions
- dashboard/homepage/ — Edit homepage content
- dashboard/services/ — Edit services pages
- dashboard/team/ — Edit team page
- dashboard/newsletter/ — Newsletter management
- dashboard/contact/ — View contact submissions
- dashboard/website/ — Website-wide settings

AUTH PAGES:
- login/ — Login page
- reset-password/ — Password reset

SPECIAL FILES:
- layout.tsx — Wrapper around every page (nav, footer, fonts)
- globals.css — Global styles for every page

## src/app/api/ — Behind-the-Scenes Functions

These are not pages. They are endpoints your app calls internally to do work.
Think of them as the kitchen — customers do not go there but everything gets made there.

- api/claude/ — Sends prompts to Claude AI (used in pitch builder)
- api/drive/campaign-media/ — Fetches media from Google Drive for campaigns
- api/drive/import/ — Imports data from Google Drive into database
- api/drive/rename/ — Renames files in Google Drive
- api/drive/thumbnail/[fileId]/ — Fetches Drive file thumbnails
- api/pitches/generate/ — AI-generates pitch content
- api/revalidate/ — Tells Vercel to refresh cached pages
- api/suggest-athletes/ — Suggests athletes for campaigns
- api/tier3/import/ — Imports Tier 3 athlete data
- api/tier3/list/ — Lists Tier 3 athlete data
- api/tier3/process/ — Processes Tier 3 athlete data

## src/components/ — Reusable Building Blocks

Components are like LEGO bricks. Build once, reuse everywhere.

- SiteNav.tsx — Navigation bar at the top of every page
- SiteFooter.tsx — Footer at the bottom of every page
- PageWrapper.tsx — Consistent padding and layout wrapper
- AnimateIn.tsx — Fade-in animation when scrolling
- PostgameLogo.tsx — Your logo as a reusable component
- PostgameLoader.jsx — Loading spinner
- BrandList.tsx — Displays a list of brands
- BrandKitList.tsx — Displays brand kit items
- CampaignList.tsx — Displays campaigns
- CampaignRecap.tsx — Renders a campaign recap page
- CampaignMediaPicker.tsx — UI for picking campaign media
- CaseStudyList.tsx — Displays case studies
- DealList.tsx — Displays deals
- PressList.tsx — Displays press articles
- BriefList.tsx — Displays campaign briefs
- PitchList.tsx — Displays pitch pages
- OptInList.tsx — Displays opt-in submissions
- OptInEditor.tsx — Editor for opt-in forms
- OptInLanding.tsx — Athlete-facing opt-in page
- TrackerList.tsx — Displays deal trackers
- RunOfShow.tsx — Renders a run-of-show page
- RunOfShowList.tsx — Lists run-of-show events
- DynamicRunOfShow.tsx — Animated run-of-show variant
- DrivePicker.tsx — UI for picking files from Google Drive
- RecapGallery.tsx — Photo/video gallery for recaps
- MasonryPreview.tsx — Masonry-style image grid
- MetricsSpreadsheet.tsx — Campaign metrics table
- ThumbnailModal.tsx — Lightbox for viewing media
- Top50Recap.tsx — Special recap for Top 50 campaigns
- TopPerformerMedia.tsx — Shows top-performing media assets
- SchoolBadge.tsx — Athlete school badge/logo
- Tier3Picker.tsx — UI for Tier 3 athlete selection
- ViewToggle.tsx — Switches between grid and list view
- ComingSoon.tsx — Placeholder for pages not yet built

PITCH BUILDER SECTIONS (each has a display and an editor):
- pitch/HeroSection.tsx + editors/HeroEditor.tsx — Top banner
- pitch/ThesisSection.tsx + editors/ThesisEditor.tsx — Your point of view
- pitch/IdeasSection.tsx + editors/IdeasEditor.tsx — Campaign concepts
- pitch/RosterSection.tsx + editors/RosterEditor.tsx — Athlete lineup
- pitch/CapabilitiesSection.tsx + editors/CapabilitiesEditor.tsx — What you offer
- pitch/PullQuoteSection.tsx + editors/PullQuoteEditor.tsx — Featured quote
- pitch/TickerSection.tsx + editors/TickerEditor.tsx — Scrolling text
- pitch/CtaSection.tsx + editors/CtaEditor.tsx — Call to action

## src/lib/ — Utility Files (Helper Code)

These files do not render anything. They contain functions other files use.
Think of them as reference books on a shelf.

- supabase.ts — Supabase connection (client-side)
- supabase-server.ts — Supabase connection (server-side)
- supabase-image.ts — Helper for Supabase image URLs
- types.ts — Defines what a brand, athlete, campaign looks like in code
- google-drive.ts — Functions for talking to Google Drive
- drive-import.ts — Logic for importing Drive files into Supabase
- csv-parser.ts — Reads and parses CSV files
- brief-template.ts — Template for generating campaign briefs
- recap-helpers.ts — Helper functions for recap pages
- metrics-helpers.ts — Helper functions for campaign metrics
- public-site.ts — Functions used by public-facing pages
- run-of-show-data.ts — Static data for run-of-show events
- pitch/aiPrompts.ts — AI prompts for pitch generation
- pitch/defaultTemplate.ts — Default pitch page structure

## src/types/ — Data Shape Definitions

- pitch.ts — Defines what a pitch object looks like in code
- supabase.ts — Auto-generated types matching your database tables

## src/hooks/ — Custom React Hooks

- useInView.ts — Detects when something scrolls into view (used for animations)

## src/middleware.ts — The Gatekeeper

Runs on every request before the page loads.
Checks: is this person logged in? Are they allowed here?
If not, redirects to login. This protects your dashboard from public access.

## src/styles/ — Extra CSS Files

- motion.css — Animation styles
- pitch.css — Styles specific to pitch pages

## public/ — Static Files

Served directly at their path. No code involved.

- postgame-logo.png/svg — Your logo in multiple formats
- postgame-logo-black.png — Black logo version
- postgame-logo-white.png — White logo version
- google-drive-logo.png — Used in UI
- raising-canes-logo.png — Used in a pitch (verify before deleting)
- crocs-pitch.html — Standalone Crocs pitch HTML (may be redundant)
- example-1.mp4, example-2.mp4 — Example videos (remove if unused)
- drafts/ — Early design mockups and team photos
- top50/ — Photos for Top 50 feature (DJ Lagway, Rori Harmon, Walter Clayton)

## supabase/ — Raw SQL Files

One-off scripts used to set up parts of the database. Not the official migration history.
- migration.sql
- supabase-migration.sql
- add_athlete_fields.sql
- pitch_pages_migration.sql

## scripts/ — Utility Scripts

One-time data tools. Should live outside the repo.
- save-raw-data.sh — Downloads Instagram data (caused the athlete folders problem)
- parse-nil-data.mjs — Parses athlete data
- generate-press-data.mjs — Generates press data
- seed-press-articles.mjs — Seeds press articles
- seed-crocs-pitch.js — Seeds Crocs pitch data

## Root Config Files

- next.config.js — Next.js configuration
- tailwind.config.js — Tailwind CSS configuration
- tsconfig.json — TypeScript configuration
- postcss.config.js — PostCSS configuration
- vercel.json — Vercel deployment configuration
- package.json — Lists all libraries the app depends on
- package-lock.json — Locked library versions (do not edit manually)
- next-env.d.ts — Auto-generated TypeScript declarations
- .env.local.example — Template for environment variables
- README.md — Project documentation

## What Does Not Belong Here

INSTAGRAM ATHLETE FOLDERS (at root level):
b1rron, boogieee, chriscenac1, dailynswain, dillonmit, iamjestinporter,
jbsmoovve, joshua_jefferson5, joyceedwards_8, k0b1g, kyliefeuerbach,
latrell.wrightsell, laywitdabutter, maliqq._, michaelcooperjrr, mkwill12_,
nimari.burnett, roriharmon, saylor.poff, sayviaaa, sm1thb, soloball1,
tajianna.roberts, thats.tj_, thenylaharris, therealmaddieb_, zubyejiofor

What happened: save-raw-data.sh ran from inside the repo folder and downloaded
athlete data into the repo by accident. Will be cleaned up in Day 5.

main file (at root): Unknown file with no extension. Investigate before deleting.
scripts/ folder: Data utilities that should live outside the repo.
public/drafts/: Early mockups. Confirm nothing links to them before deleting.

## How Pages Are Protected

src/middleware.ts enforces one rule:
- Any URL starting with /dashboard → must be logged in
- All other URLs → public, no login needed

Pitch pages, recap pages, and brief pages are public URLs you can share with clients.
Your dashboard is protected.

Generated April 2026 — Day 2 codebase audit.
