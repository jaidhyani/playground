import { test, expect } from '@playwright/test';

test.describe('Demo 1: The Myopic Model', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo1-standalone.html');
    await page.waitForSelector('.token-block');
  });

  test('renders 8 token blocks', async ({ page }) => {
    const blocks = page.locator('.token-block');
    await expect(blocks).toHaveCount(8);
  });

  test('Play, Step, and Reset buttons exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('clicking Step causes a prediction to appear', async ({ page }) => {
    const predBefore = page.locator('.prediction-token');
    await expect(predBefore).toHaveCount(0);

    await page.getByRole('button', { name: 'Step' }).click();

    const predAfter = page.locator('.prediction-token');
    await expect(predAfter).toHaveCount(1, { timeout: 5000 });
  });

  test('screenshot baseline', async ({ page }) => {
    const container = page.locator('#demo-myopic');
    await expect(container).toHaveScreenshot('demo1-initial.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
