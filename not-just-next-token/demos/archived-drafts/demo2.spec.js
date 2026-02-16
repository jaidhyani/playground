import { test, expect } from '@playwright/test';

test.describe('Demo 2: Where the Gradients Go', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo2-standalone.html');
    await expect(page.locator('.token-block').first()).toBeAttached();
  });

  test('renders 8 token blocks and 8 KV blocks', async ({ page }) => {
    const tokens = page.locator('.token-block');
    await expect(tokens).toHaveCount(8);
    const kvs = page.locator('.kv-block');
    await expect(kvs).toHaveCount(8);
  });

  test('clicking a token shows forward arrows', async ({ page }) => {
    // Click token 4 ("watched") — should produce arrows from tokens 0-3
    const tokens = page.locator('.token-block');
    await tokens.nth(4).click();

    const arrows = page.locator('.forward-arrow');
    await expect(arrows).toHaveCount(4);
  });

  test('toggling to Backward shows gradient arrows', async ({ page }) => {
    // Select token 5 ("the") then toggle to Backward
    const tokens = page.locator('.token-block');
    await tokens.nth(5).click();

    const backwardBtn = page.locator('.toggle-btn', { hasText: 'Backward' });
    await backwardBtn.click();

    const arrows = page.locator('.gradient-arrow');
    await expect(arrows).toHaveCount(5);

    // Forward arrows should be gone
    const forwardArrows = page.locator('.forward-arrow');
    await expect(forwardArrows).toHaveCount(0);
  });

  test('Show All Gradients button works', async ({ page }) => {
    const backwardBtn = page.locator('.toggle-btn', { hasText: 'Backward' });
    await backwardBtn.click();

    const showAllBtn = page.locator('.show-all-btn');
    await expect(showAllBtn).toBeVisible();
    await showAllBtn.click();

    // Should render many gradient arrows (all future->past pairs)
    const arrows = page.locator('.gradient-arrow');
    const count = await arrows.count();
    expect(count).toBeGreaterThan(10);
  });

  test('Show All button is hidden in Forward mode', async ({ page }) => {
    const showAllBtn = page.locator('.show-all-btn');
    await expect(showAllBtn).toBeHidden();
  });

  test('screenshot baseline - forward view', async ({ page }) => {
    const tokens = page.locator('.token-block');
    await tokens.nth(5).click();
    // Wait for arrow animation
    await page.waitForTimeout(500);

    const container = page.locator('#demo-gradients');
    await expect(container).toHaveScreenshot('demo2-forward.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('screenshot baseline - backward view', async ({ page }) => {
    const tokens = page.locator('.token-block');
    await tokens.nth(5).click();

    const backwardBtn = page.locator('.toggle-btn', { hasText: 'Backward' });
    await backwardBtn.click();
    await page.waitForTimeout(500);

    const container = page.locator('#demo-gradients');
    await expect(container).toHaveScreenshot('demo2-backward.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
