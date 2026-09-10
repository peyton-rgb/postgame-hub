import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

export const config = {
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  outDir: path.join(__dirname, '..', 'out'),
  fps: 30,
  baseUrl: process.env.CAPTURE_BASE_URL || '',
  portalToken: process.env.CAPTURE_PORTAL_TOKEN || '',
};

if (!config.baseUrl || !config.portalToken) {
  console.error('Error: CAPTURE_BASE_URL and CAPTURE_PORTAL_TOKEN must be set in the environment.');
  process.exit(1);
}

// Easing functions for scrolling
export const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
