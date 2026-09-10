import { config } from '../capture.config';
import { setupBrowser, waitForImagesToLoad } from '../utils/browser';
import { clickWithCursor, animateMouse } from '../utils/cursor';
import { conformVideo, extractPoster } from '../utils/ffmpeg';
import fs from 'fs';
import path from 'path';

export async function run() {
  const flowName = '03-assets';
  console.log(`\n--- Starting flow: ${flowName} ---`);
  
  const rawVideoDir = path.join(config.outDir, `${flowName}-raw`);
  if (!fs.existsSync(rawVideoDir)) fs.mkdirSync(rawVideoDir, { recursive: true });

  const { browser, context, page } = await setupBrowser(rawVideoDir);

  try {
    const url = `${config.baseUrl}/portal/${config.portalToken}`;
    await page.goto(url);
    await waitForImagesToLoad(page);

    // Assume Assets is a top-level tab or we navigate through SPF
    await clickWithCursor(page, 'text="Assets"');
    await waitForImagesToLoad(page);
    await page.waitForTimeout(2000);

    // Click a filter
    console.log('Clicking a filter...');
    await clickWithCursor(page, 'button:has-text("Filter")');
    await page.waitForTimeout(1000);
    // Click the first filter option (making an assumption)
    const filterOption = page.locator('[role="menuitem"], [role="option"], label').first();
    if (await filterOption.isVisible()) {
      await filterOption.click();
    }
    
    await page.waitForTimeout(2000); // Wait for reflow

    // Hover one asset
    console.log('Hovering an asset...');
    const asset = page.locator('img').nth(2); // pick a random image
    const assetBox = await asset.boundingBox();
    if (assetBox) {
      await animateMouse(page, assetBox.x + assetBox.width / 2, assetBox.y + assetBox.height / 2, 20);
      await asset.hover();
      await page.waitForTimeout(2000);
    }

    // Trigger one download
    console.log('Triggering download...');
    const downloadBtn = page.locator('a[download], button:has-text("Download"), [aria-label="Download"]').first();
    if (await downloadBtn.isVisible()) {
      // Prevent actual download dialogue from blocking
      await clickWithCursor(page, 'a[download], button:has-text("Download"), [aria-label="Download"]');
    }

    // Hold to reach ~26s
    await page.waitForTimeout(16000);

  } catch (error) {
    console.error(`Error in flow ${flowName}:`, error);
  } finally {
    await context.close();
    await browser.close();
  }

  const files = fs.readdirSync(rawVideoDir);
  const webmFile = files.find(f => f.endsWith('.webm'));
  if (webmFile) {
    const webmPath = path.join(rawVideoDir, webmFile);
    await conformVideo(flowName, webmPath, config.outDir);
    const movPath = path.join(config.outDir, `${flowName}.mov`);
    await extractPoster(flowName, movPath, config.outDir);
  } else {
    console.error(`No raw video found for ${flowName}`);
  }
}
