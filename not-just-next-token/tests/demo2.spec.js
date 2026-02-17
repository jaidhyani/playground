import { test, expect } from '@playwright/test';

test.describe('Demo 2: KV Cache', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo2-standalone.html');
    await page.waitForSelector('.model-box');
  });

  test('renders initial state with one token and no KV slices', async ({ page }) => {
    await expect(page.locator('.token-block')).toHaveCount(1);
    await expect(page.locator('.kv-slice')).toHaveCount(0);
  });

  test('Play, Step, and Reset buttons exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('Step produces KV slices and prediction', async ({ page }) => {
    await page.getByRole('button', { name: 'Step' }).click();
    // Prediction is transient (disappears after animation completes), check it first
    await expect(page.locator('.prediction-token')).toHaveCount(1, { timeout: 5000 });
    // KV slices persist after the animation (4 layers for the processed token)
    await expect(page.locator('.kv-slice')).toHaveCount(4, { timeout: 5000 });
  });

  test('after step completes, token count increases', async ({ page }) => {
    await page.getByRole('button', { name: 'Step' }).click();
    await expect(page.locator('.token-block')).toHaveCount(2, { timeout: 5000 });
  });

  test('second step shows KV arrows from cached tokens', async ({ page }) => {
    await page.getByRole('button', { name: 'Step' }).click();
    await expect(page.locator('.token-block')).toHaveCount(2, { timeout: 5000 });

    await page.getByRole('button', { name: 'Step' }).click();
    // Green right-angle KV arrow from selection box to the model
    await expect(page.locator('.kv-arrow')).toHaveCount(1, { timeout: 5000 });
  });

  test('Reset returns to initial state', async ({ page }) => {
    await page.getByRole('button', { name: 'Step' }).click();
    await expect(page.locator('.token-block')).toHaveCount(2, { timeout: 5000 });

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('.token-block')).toHaveCount(1);
    await expect(page.locator('.kv-slice')).toHaveCount(0);
  });

  test('screenshot baseline', async ({ page }) => {
    const container = page.locator('#demo-kv');
    await expect(container).toHaveScreenshot('demo2-initial.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
