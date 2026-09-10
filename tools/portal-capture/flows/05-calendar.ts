import { config } from '../capture.config';
import { setupBrowser, waitForImagesToLoad } from '../utils/browser';
import { captureScrollSequence } from '../utils/scroll';
import { createVideos, extractPoster } from '../utils/ffmpeg';
import fs from 'fs';
import path from 'path';

export async function run() {
  const flowName = '05-calendar';
  console.log(`\n--- Starting flow: ${flowName} ---`);
  
  const framesDir = path.join(config.outDir, `${flowName}-frames`);
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  const { browser, context, page } = await setupBrowser();

  try {
    const url = `${config.baseUrl}/recap/spf-cvs-2026`;
    await page.goto(url);
    await waitForImagesToLoad(page);
    await page.waitForTimeout(2000);

    // Navigate to "What's Next?" section
    const heading = page.locator('text="What\'s Next"').first();
    if (await heading.isVisible()) {
      await heading.scrollIntoViewIfNeeded();
    }
    
    // Find the calendar container (assuming it's horizontally scrollable)
    // We'll scroll the page horizontally or a specific container
    // We want to rest on "Holiday". Let's assume we can scroll the window horizontally.
    let targetX = 2000; // Assumption
    const holidayText = page.locator('text="Holiday"').first();
    if (await holidayText.isVisible()) {
      const box = await holidayText.boundingBox();
      if (box) {
        targetX = box.x - (config.viewport.width / 2);
      }
    }

    console.log(`Capturing frame sequence for ${flowName}...`);
    // 26s total capture. 24s horizontal scroll, 2s rest.
    await captureScrollSequence(page, framesDir, 24, targetX, 'horizontal');

    const startFrame = 24 * config.fps + 1;
    for (let i = 0; i < 60; i++) {
      const frameNumber = String(startFrame + i).padStart(5, '0');
      await page.screenshot({ path: path.join(framesDir, `frame-${frameNumber}.png`) });
    }

  } catch (error) {
    console.error(`Error in flow ${flowName}:`, error);
  } finally {
    await context.close();
    await browser.close();
  }

  await createVideos(flowName, framesDir, config.outDir);
  const movPath = path.join(config.outDir, `${flowName}.mov`);
  await extractPoster(flowName, movPath, config.outDir);
  
  fs.rmSync(framesDir, { recursive: true, force: true });
}
