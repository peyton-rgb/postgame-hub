import { config } from '../capture.config';
import { setupBrowser, waitForImagesToLoad } from '../utils/browser';
import { captureScrollSequence } from '../utils/scroll';
import { createVideos, extractPoster } from '../utils/ffmpeg';
import fs from 'fs';
import path from 'path';

export async function run() {
  const flowName = '02-roster';
  console.log(`\n--- Starting flow: ${flowName} ---`);
  
  const framesDir = path.join(config.outDir, `${flowName}-frames`);
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  const { browser, context, page } = await setupBrowser();

  try {
    // Assume roster is accessible directly or via campaign page.
    // For simplicity, we navigate directly if possible, or from home.
    // We'll navigate to home, click SPF, then click Roster.
    const url = `${config.baseUrl}/portal/${config.portalToken}`;
    await page.goto(url);
    await waitForImagesToLoad(page);

    await page.locator('text="SPF"').first().click();
    await page.waitForTimeout(2000);
    
    // Assuming a 'Roster' tab or section
    const rosterTab = page.locator('text="Roster"').first();
    if (await rosterTab.isVisible()) {
      await rosterTab.click();
      await page.waitForTimeout(2000);
    }
    
    await waitForImagesToLoad(page);

    console.log(`Capturing frame sequence for ${flowName}...`);
    // 32s capture total
    // Let's scroll down 3000 pixels over 32 seconds
    await captureScrollSequence(page, framesDir, 32, 3000, 'vertical');

  } catch (error) {
    console.error(`Error in flow ${flowName}:`, error);
  } finally {
    await context.close();
    await browser.close();
  }

  await createVideos(flowName, framesDir, config.outDir);
  const movPath = path.join(config.outDir, `${flowName}.mov`);
  await extractPoster(flowName, movPath, config.outDir);
  
  // Cleanup frames
  fs.rmSync(framesDir, { recursive: true, force: true });
}
