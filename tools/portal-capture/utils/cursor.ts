import { Page } from '@playwright/test';

// Inject a synthetic cursor into the page
export async function injectCursor(page: Page) {
  await page.addInitScript(() => {
    const cursor = document.createElement('div');
    cursor.id = 'playwright-synthetic-cursor';
    cursor.style.position = 'fixed';
    cursor.style.top = '0';
    cursor.style.left = '0';
    cursor.style.width = '20px';
    cursor.style.height = '20px';
    cursor.style.borderRadius = '50%';
    cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    cursor.style.border = '2px solid white';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '2147483647';
    cursor.style.transform = 'translate(-50%, -50%)';
    cursor.style.transition = 'top 0.3s ease-in-out, left 0.3s ease-in-out';
    
    // Start offscreen
    cursor.style.top = '-100px';
    cursor.style.left = '-100px';
    
    document.documentElement.appendChild(cursor);

    // Update cursor position on mouse events
    document.addEventListener('mousemove', (e) => {
      cursor.style.top = `${e.clientY}px`;
      cursor.style.left = `${e.clientX}px`;
    });
  });
}

// Move the mouse deliberately to a target (which moves the synthetic cursor)
export async function animateMouse(page: Page, x: number, y: number, steps = 10) {
  // Note: playwright's mouse.move does not have duration, we can simulate it
  // or rely on the CSS transition we injected above.
  // Actually, we'll just use page.mouse.move with steps.
  await page.mouse.move(x, y, { steps });
  // Wait a beat for the CSS transition to catch up if we just jumped
  await page.waitForTimeout(300);
}

export async function clickWithCursor(page: Page, selector: string) {
  const el = await page.locator(selector).first();
  const box = await el.boundingBox();
  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await animateMouse(page, x, y, 20);
    await el.click();
  } else {
    // Fallback if not visible
    await el.click();
  }
}
