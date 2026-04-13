# Postgame Hub

Internal web app for Postgame — a sports marketing agency specializing in NIL brand campaigns with college athletes.

Live app: https://postgame-hub.vercel.app
GitHub: https://github.com/peyton-rgb/postgame-hub
Supabase project: xqaybwhpgxillpbbqtks

## What This App Does

- Public pages: case studies, press, campaigns, deals, services, pitches
- Client-facing pages: briefs, recaps, opt-in forms, campaign instructions
- Private dashboard: manage all content, brands, athletes, media
- Google Drive integration: import and manage campaign media
- AI-powered pitch builder: generate pitch decks with Claude

## Tech Stack

- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Database: Supabase (Postgres)
- Auth: Supabase Auth
- File storage: Supabase Storage
- Deployment: Vercel
- AI: Anthropic Claude API
- Media: Google Drive API

## Running the App Locally

Locally means running the app on your own computer instead of at the live URL.
Changes you make locally do not affect the live site until you push to GitHub.

FIRST TIME SETUP:

Step 1 — Check Node.js is installed:
  node --version
  If you see a version number you are good. If not, download from nodejs.org.

Step 2 — Go to the repo folder:
  cd ~/postgame/hub

Step 3 — Install dependencies:
  npm install

Step 4 — Create your local environment file:
  cp .env.local.example .env.local
  Then open .env.local and fill in your actual keys from Vercel.

STARTING THE APP:
  cd ~/postgame/hub
  npm run dev
  Then open your browser to: http://localhost:3000
  To stop it: press Control + C in Terminal.

## Deploying to Production

You almost never need to do this manually. It happens automatically.

The automatic flow:
1. You make a change on your computer
2. You run: git add . && git commit -m "describe your change" && git push
3. Vercel detects the push to main branch
4. Vercel builds and deploys automatically (takes about 2 minutes)
5. Your change is live at postgame-hub.vercel.app

To check deployment status: go to vercel.com, open your project, click Deployments tab.

## Environment Variables

Secret keys your app needs to work. They live in Vercel, not in this repo.

NEXT_PUBLIC_SUPABASE_URL — Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY — Public Supabase key (safe to expose)
SUPABASE_SERVICE_ROLE_KEY — Private Supabase key (never expose publicly)
ANTHROPIC_API_KEY — Claude AI key (for pitch generation)
GOOGLE_CLIENT_ID — Google Drive API credentials
GOOGLE_CLIENT_SECRET — Google Drive API credentials
GOOGLE_REFRESH_TOKEN — Google Drive API credentials

For local development: copy .env.local.example to .env.local and fill in your values.

## Project Structure

postgame-hub/
  src/
    app/          — Every page and API route
      dashboard/  — Private dashboard (login required)
      api/        — Backend API endpoints
      [pages]/    — Public pages
    components/   — Reusable UI building blocks
    lib/          — Helper functions and utilities
    types/        — TypeScript type definitions
    hooks/        — Custom React hooks
    styles/       — Extra CSS files
    middleware.ts — Protects dashboard from public access
  public/         — Static files (images, videos)
  supabase/       — Raw SQL migration files
  scripts/        — One-off data utilities (should move outside repo)

## Two Machines

This repo is cloned on two machines:

iMac — username: billjula — repo at: ~/postgame/hub
MacBook Air — username: peytonjula — repo at: ~/postgame/hub

IMPORTANT: Before starting work on either machine, run:
  git pull
This downloads the latest code from GitHub.

After finishing work, run:
  git push
This sends your changes back up to GitHub.

## Database

Provider: Supabase
Project ID: xqaybwhpgxillpbbqtks
Tables: approximately 21 active tables (post-cleanup)
Records: 120 brands, 1083 campaigns, 1280 athletes, 1305 media files

To view or edit the database: go to supabase.com, open your project, click Table Editor.

Last updated: April 2026
