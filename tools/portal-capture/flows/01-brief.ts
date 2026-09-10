import { config } from '../capture.config';
import { setupBrowser, waitForImagesToLoad } from '../utils/browser';
import { clickWithCursor } from '../utils/cursor';
import { conformVideo, extractPoster } from '../utils/ffmpeg';
import fs from 'fs';
import path from 'path';

export async function run() {
  const flowName = '01-brief';
  console.log(`\n--- Starting flow: ${flowName} ---`);
  
  const rawVideoDir = path.join(config.outDir, `${flowName}-raw`);
  if (!fs.existsSync(rawVideoDir)) {
    fs.mkdirSync(rawVideoDir, { recursive: true });
  }

  const { browser, context, page } = await setupBrowser(rawVideoDir);

  try {
    const url = `${config.baseUrl}/portal/${config.portalToken}`;
    console.log(`Navigating to ${url}`);
    await page.goto(url);
    await waitForImagesToLoad(page);

    // 26s capture total. We'll divide the time.
    await page.waitForTimeout(4000); // Wait on home

    // Assuming we can find the SPF campaign by text "SPF"
    console.log('Clicking into SPF campaign...');
    await clickWithCursor(page, 'text="SPF"');
    
    // Wait for the brief to be visible
    // We assume the brief is shown upon navigating to the campaign or there's a Brief tab
    await page.waitForTimeout(2000);
    // If it's a tab, we click it. We assume it's default or accessible.
    // Ensure we capture up to ~26 seconds total
    await page.waitForTimeout(20000);

  } catch (error) {
    console.error(`Error in flow ${flowName}:`, error);
  } finally {
    await context.close();
    await browser.close();
  }

  // Find the generated webm video
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
