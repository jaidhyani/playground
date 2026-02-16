import { test, expect } from '@playwright/test';

test.describe('Demo 4 – The Hidden State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo4-standalone.html');
  });

  test('both panels render', async ({ page }) => {
    await expect(page.locator('.rnn-panel')).toBeVisible();
    await expect(page.locator('.transformer-panel')).toBeVisible();
  });

  test('starts at step 0 with no KV blocks', async ({ page }) => {
    const rnnBlocks = page.locator('.rnn-panel .kv-block');
    const tfBlocks = page.locator('.transformer-panel .kv-block');
    await expect(rnnBlocks).toHaveCount(0);
    await expect(tfBlocks).toHaveCount(0);
    await expect(page.locator('.demo-label')).toContainText('0 of 6');
  });

  test('stepping forward adds elements to both panels', async ({ page }) => {
    const stepBtn = page.getByRole('button', { name: 'Step' });

    await stepBtn.click();
    await expect(page.locator('.rnn-panel .kv-block')).toHaveCount(1);
    await expect(page.locator('.transformer-panel .kv-block')).toHaveCount(1);

    await stepBtn.click();
    await expect(page.locator('.rnn-panel .kv-block')).toHaveCount(2);
    await expect(page.locator('.transformer-panel .kv-block')).toHaveCount(2);
  });

  test('after 3 steps, transformer has 3 full-opacity KV blocks, RNN fades earlier ones', async ({ page }) => {
    const stepBtn = page.getByRole('button', { name: 'Step' });
    await stepBtn.click();
    await stepBtn.click();
    await stepBtn.click();

    // Transformer: all 3 blocks at full opacity
    const tfBlocks = page.locator('.transformer-panel .kv-block');
    await expect(tfBlocks).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const opacity = await tfBlocks.nth(i).getAttribute('opacity');
      expect(parseFloat(opacity)).toBe(1.0);
    }

    // RNN: 3 blocks, but only the last at full opacity
    const rnnBlocks = page.locator('.rnn-panel .kv-block');
    await expect(rnnBlocks).toHaveCount(3);

    const lastOpacity = await rnnBlocks.nth(2).getAttribute('opacity');
    expect(parseFloat(lastOpacity)).toBe(1.0);

    // Earlier blocks should be faded
    for (let i = 0; i < 2; i++) {
      const opacity = await rnnBlocks.nth(i).getAttribute('opacity');
      expect(parseFloat(opacity)).toBeLessThan(1.0);
    }
  });

  test('back button decrements step', async ({ page }) => {
    const stepBtn = page.getByRole('button', { name: 'Step' });
    const backBtn = page.getByRole('button', { name: 'Back' });

    await stepBtn.click();
    await stepBtn.click();
    await expect(page.locator('.demo-label')).toContainText('Token 2 of 6');

    await backBtn.click();
    await expect(page.locator('.demo-label')).toContainText('Token 1 of 6');
    await expect(page.locator('.rnn-panel .kv-block')).toHaveCount(1);
  });

  test('reset returns to initial state', async ({ page }) => {
    const stepBtn = page.getByRole('button', { name: 'Step' });
    const resetBtn = page.getByRole('button', { name: 'Reset' });

    await stepBtn.click();
    await stepBtn.click();
    await stepBtn.click();
    await resetBtn.click();

    await expect(page.locator('.demo-label')).toContainText('0 of 6');
    await expect(page.locator('.rnn-panel .kv-block')).toHaveCount(0);
    await expect(page.locator('.transformer-panel .kv-block')).toHaveCount(0);
  });

  test('screenshot at step 4', async ({ page }) => {
    const stepBtn = page.getByRole('button', { name: 'Step' });
    for (let i = 0; i < 4; i++) await stepBtn.click();

    await expect(page.locator('.demo-label')).toContainText('Token 4 of 6');
    await page.screenshot({
      path: 'tests/demo4-step4.png',
      fullPage: true,
    });
  });
});
