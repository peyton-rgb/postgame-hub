# CVS Portal Capture Harness

Automated Playwright harness to capture deterministic UI footage from the Postgame portal for the explainer film.

## Prerequisites

1. Set up the required environment variables in `.env.local`:
   - `CAPTURE_BASE_URL` (e.g., `https://postgame-hub.vercel.app`)
   - `CAPTURE_PORTAL_TOKEN` (The unique portal token)
   **Never commit these values.**

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure you have `ffmpeg` installed globally (e.g., `brew install ffmpeg`), as this script uses it directly, bypassing the broken Fly.io worker.

## Usage

You can run individual flows or all flows sequentially. Output is saved to `tools/portal-capture/out/` (ignored by git).

To run all flows:
```bash
npx tsx tools/portal-capture/runner.ts all
```

To run a specific flow:
```bash
npx tsx tools/portal-capture/runner.ts 01-brief
npx tsx tools/portal-capture/runner.ts 02-roster
npx tsx tools/portal-capture/runner.ts 03-assets
npx tsx tools/portal-capture/runner.ts 04-recap
npx tsx tools/portal-capture/runner.ts 05-calendar
```

## Outputs

Each flow generates:
- `<flow>.mov` — Edit master (ProRes 422, 1920x1080, 30fps)
- `<flow>.mp4` — Review proxy (H.264, 1920x1080, 30fps)
- `<flow>-poster.png` — Single representative poster frame

A single `manifest.json` will be updated with metadata for each successful capture run.
