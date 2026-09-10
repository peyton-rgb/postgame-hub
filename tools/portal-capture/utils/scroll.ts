import { Page } from 'playwright';
import { easeInOutCubic, config } from '../capture.config';
import path from 'path';

export async function captureScrollSequence(page: Page, framesDir: string, durationSeconds: number, scrollDistance: number, direction: 'vertical' | 'horizontal' = 'vertical') {
  const totalFrames = durationSeconds * config.fps;
  
  const initialScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));

  for (let i = 0; i < totalFrames; i++) {
    // Math logic: t is 0 to 1
    const t = i / (totalFrames - 1);
    const easedT = Math.min(1, Math.max(0, easeInOutCubic(t)));
    
    if (direction === 'vertical') {
      const currentScrollY = initialScroll.y + scrollDistance * easedT;
      await page.evaluate((y) => window.scrollTo(initialScroll.x, y), currentScrollY);
    } else {
      const currentScrollX = initialScroll.x + scrollDistance * easedT;
      await page.evaluate((x) => window.scrollTo(x, initialScroll.y), currentScrollX);
    }
    
    // Allow any very quick repaints, though Playwright screenshot implicitly waits for the frame
    const frameNumber = String(i + 1).padStart(5, '0');
    await page.screenshot({ path: path.join(framesDir, `frame-${frameNumber}.png`) });
  }
}
