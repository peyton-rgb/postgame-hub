import { config } from '../capture.config';
import { setupBrowser, waitForImagesToLoad } from '../utils/browser';
import { captureScrollSequence } from '../utils/scroll';
import { createVideos, extractPoster } from '../utils/ffmpeg';
import fs from 'fs';
import path from 'path';

export async function run() {
  const flowName = '04-recap';
  console.log(`\n--- Starting flow: ${flowName} ---`);
  
  const framesDir = path.join(config.outDir, `${flowName}-frames`);
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  const { browser, context, page } = await setupBrowser();

  try {
    const url = `${config.baseUrl}/recap/spf-cvs-2026`;
    console.log(`Navigating to ${url}`);
    await page.goto(url);
    await waitForImagesToLoad(page);
    await page.waitForTimeout(2000);

    // 32s total: ~30s of scrolling, 2s hold on button
    // Find the button to calculate how far to scroll
    const button = page.locator('text="EXPORT POWERPOINT"').first();
    let targetY = 3000; // default assumption
    if (await button.isVisible()) {
      const box = await button.boundingBox();
      if (box) {
        // Scroll so the button is near the center
        targetY = box.y - (config.viewport.height / 2) + (box.height / 2);
      }
    }

    console.log(`Capturing frame sequence for ${flowName}...`);
    await captureScrollSequence(page, framesDir, 30, targetY, 'vertical');

    // Rest for 2s (60 frames)
    const startFrame = 30 * config.fps + 1;
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
