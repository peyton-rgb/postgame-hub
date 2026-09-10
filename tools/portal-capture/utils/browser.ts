import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { config } from '../capture.config';
import { injectCursor } from './cursor';

export async function setupBrowser(recordVideoPath?: string) {
  const browser = await chromium.launch({
    headless: false, // Useful for debugging, but let's default to true later or configurable
    // Or just headless: true, wait, headful might capture better if there are OS level things? No, headless is fine.
  });

  const contextOptions: any = {
    viewport: config.viewport,
    deviceScaleFactor: config.deviceScaleFactor,
    reducedMotion: 'no-preference',
  };

  if (recordVideoPath) {
    contextOptions.recordVideo = {
      dir: recordVideoPath,
      size: config.viewport,
    };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Hide scrollbars via injected CSS
  await page.addStyleTag({
    content: `
      ::-webkit-scrollbar {
        display: none !important;
      }
      * {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }
    `
  });

  await injectCursor(page);

  return { browser, context, page };
}

export async function waitForImagesToLoad(page: Page) {
  // Scroll through once to trigger loading
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  });

  // Wait for network idle and for all <img> elements to report complete
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', reject);
        });
      })
    );
  });

  // Return to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500); // Give it a moment to settle
}
