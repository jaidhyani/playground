import { test, expect } from '@playwright/test';

test.describe('Demo 3: Two Outputs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo3-standalone.html');
    await page.waitForSelector('.prob-bar');
  });

  test('renders 8 probability bars', async ({ page }) => {
    const bars = page.locator('.prob-bar');
    await expect(bars).toHaveCount(8);
  });

  test('renders 64 KV cells (8x8)', async ({ page }) => {
    const cells = page.locator('.kv-cell');
    await expect(cells).toHaveCount(64);
  });

  test('slider changes heatmap visually', async ({ page }) => {
    const container = page.locator('#demo-two-outputs');

    // Screenshot at slider=0 (myopic)
    const screenshotBefore = await container.screenshot();

    // Move slider to max
    const slider = page.locator('input[type="range"]');
    await slider.fill('100');

    // Screenshot at slider=100 (full optimization)
    const screenshotAfter = await container.screenshot();

    // The two screenshots should differ (heatmap transforms dramatically)
    expect(Buffer.compare(screenshotBefore, screenshotAfter)).not.toBe(0);
  });

  test('screenshot baseline at full optimization', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await slider.fill('100');

    const container = page.locator('#demo-two-outputs');
    await expect(container).toHaveScreenshot('demo3-full-optimization.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
