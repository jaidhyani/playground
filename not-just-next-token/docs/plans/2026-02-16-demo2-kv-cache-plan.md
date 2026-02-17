# Demo 2: KV Cache Visualization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Interactive SVG demo showing that each LLM forward pass produces both a token prediction AND KV activations, and that subsequent passes use the latest token + accumulated KV cache (not all previous tokens).

**Architecture:** Single ES module (`demo2-kv-cache.js`) exporting `init(container)`, same pattern as Demo 1. Uses shared SVG utilities from `shared.js`. Standalone HTML for isolated testing, Playwright spec for functional verification.

**Tech Stack:** Vanilla JS ES modules, SVG, Playwright for testing.

---

### Task 1: Fix Demo 1 token visibility

Tokens in Demo 1 are currently all visible from the start (gray placeholders). They should only appear when generated. This also applies to Demo 2, so fix the pattern here first.

**Files:**
- Modify: `demos/demo1-myopic.js`
- Test: `tests/demo1.spec.js`

**Step 1: Update demo1-myopic.js — only show revealed tokens**

In `init()`, change the initial token rendering: only create SVG elements for `revealedCount` tokens, not all 8. The `render()` function should add/remove token elements dynamically.

Key changes:
- Remove the `TOKENS.forEach` block that pre-creates all 8 token rects/texts
- In `render()`, clear and recreate only the revealed tokens (centered based on current count)
- The `tokenX()` function already takes `total` — use `revealedCount` as the total for positioning
- First token "The" starts visible with dark fill (it's the prompt)

```js
function render() {
  // Clear all dynamic groups
  while (tokenGroup.firstChild) tokenGroup.removeChild(tokenGroup.firstChild);
  while (arrowGroup.firstChild) arrowGroup.removeChild(arrowGroup.firstChild);
  while (predGroup.firstChild) predGroup.removeChild(predGroup.firstChild);

  // Reset layer colors
  layerRects.forEach((r, i) => {
    r.setAttribute('fill', i === LAYER_COUNT - 1 ? '#e0e7ff' : '#f1f5f9');
  });

  // Only draw revealed tokens, centered based on how many exist
  for (let i = 0; i < revealedCount; i++) {
    const x = tokenX(i, revealedCount);
    rect(tokenGroup, x, TOKEN_ROW_Y, TOKEN_W, TOKEN_H, COLORS.token, {
      rx: TOKEN_RX, stroke: COLORS.token, strokeWidth: 1.5, className: 'token-block',
    });
    text(tokenGroup, x + TOKEN_W / 2, TOKEN_ROW_Y + TOKEN_H / 2, TOKENS[i], {
      fontSize: 12, fontWeight: '600', fill: '#ffffff',
    });
  }
}
```

**Step 2: Update the step() animation to account for dynamic positioning**

Since tokens re-center as more are added, arrow source positions must use the *current* token positions for the current `revealedCount`, and the prediction slide-up target must use the position for `revealedCount + 1`.

After the prediction slides up and `revealedCount++`, call `render()` which re-centers everything.

**Step 3: Fix demo1 tests**

Update `tests/demo1.spec.js`:
- Change "renders 8 token blocks" → "renders 1 token block initially" (only "The" is visible)
- Update screenshot baseline (delete old snapshot, regenerate)

```js
test('renders 1 token block initially', async ({ page }) => {
  const blocks = page.locator('.token-block');
  await expect(blocks).toHaveCount(1);
});
```

**Step 4: Run tests, verify, commit**

Run: `cd not-just-next-token && npx playwright test tests/demo1.spec.js --update-snapshots`

```bash
git add demos/demo1-myopic.js tests/demo1.spec.js tests/demo1.spec.js-snapshots/
git commit -m "fix: demo 1 tokens only appear when generated"
```

---

### Task 2: Create demo2-kv-cache.js scaffold + standalone HTML

**Files:**
- Create: `demos/demo2-kv-cache.js`
- Create: `demos/demo2-standalone.html`

**Step 1: Create standalone HTML**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demo 2: KV Cache</title>
  <link rel="stylesheet" href="../style.css">
</head>
<body>
  <div class="article">
    <h2>Demo 2: The KV Cache</h2>
    <p>Each forward pass produces two outputs: a prediction and KV activations.</p>
    <div class="demo-container" id="demo-kv"></div>
  </div>
  <script type="module">
    import { init } from './demo2-kv-cache.js';
    init(document.getElementById('demo-kv'));
  </script>
</body>
</html>
```

**Step 2: Create demo2-kv-cache.js with static layout (no animation yet)**

Module structure with constants, `init()` that renders:
- LLM box with 4 layers (reuse Demo 1 pattern)
- First token "The" in the token row (dark fill, single token centered)
- Controls: Play, Step, Reset buttons
- Empty KV zone and prediction zone

```js
import {
  SVG_NS, createSVG, rect, text, path, group, addArrowMarker,
  createButton, animate, easeOutCubic, COLORS,
} from './shared.js';

const TOKENS = ['The', 'cat', 'sat', 'on', 'the', 'warm', 'sunny', 'windowsill'];

const VB_W = 800, VB_H = 520;
const TOKEN_W = 80, TOKEN_H = 34, TOKEN_GAP = 5, TOKEN_RX = 6;
const TOKEN_ROW_Y = 30;

// KV slices sit directly below each token
const KV_SLICE_H = 10, KV_SLICE_GAP = 2;
const KV_ZONE_TOP = TOKEN_ROW_Y + TOKEN_H + 8;
const LAYER_COUNT = 4;

// Model box positioned below the KV zone
const MODEL_W = 200, MODEL_H = 100, MODEL_RX = 10;
const MODEL_X = (VB_W - MODEL_W) / 2;
const MODEL_Y = KV_ZONE_TOP + LAYER_COUNT * (KV_SLICE_H + KV_SLICE_GAP) + 40;
const LAYER_H = 14, LAYER_GAP = 5;

const PRED_Y = MODEL_Y + MODEL_H + 50;
const ANIM_MS = 350;
```

State: `revealedCount = 1`, `kvStacks = []` (array of arrays — `kvStacks[tokenIndex]` holds refs to that token's KV slice elements).

`render()` draws:
- Only revealed tokens (centered for current count)
- KV slices beneath each token that has been processed (all except the latest, which gets its KV during the step animation)
- LLM box with layers

**Step 3: Verify it loads in browser**

Open `demos/demo2-standalone.html` in browser, confirm SVG renders with "The" token and LLM box.

**Step 4: Commit scaffold**

```bash
git add demos/demo2-kv-cache.js demos/demo2-standalone.html
git commit -m "feat: scaffold demo 2 KV cache with static layout"
```

---

### Task 3: Implement step animation

**Files:**
- Modify: `demos/demo2-kv-cache.js`

**Step 1: Implement step() — Phase 1: Input arrows**

For the current token being processed (index = `revealedCount - 1`):
- Gray arrow from current token → model top
- If there are previous tokens with KV stacks: indigo arrows from each KV slice stack → model top
  - One arrow per KV stack (not per slice — one arrow from the bottom of each stack)
  - Indigo color, 0.5 opacity
  - Fan across model's top edge

```js
// Arrow from current token (gray)
const tokCx = tokenX(currentIdx, revealedCount) + TOKEN_W / 2;
const tokBy = TOKEN_ROW_Y + TOKEN_H;
// ...curved path to MODEL_X + MODEL_W/2, MODEL_Y

// Arrows from previous KV stacks (indigo)
for (let i = 0; i < currentIdx; i++) {
  const kvX = tokenX(i, revealedCount) + TOKEN_W / 2;
  const kvBottom = KV_ZONE_TOP + LAYER_COUNT * (KV_SLICE_H + KV_SLICE_GAP);
  const targetX = MODEL_X + 15 + (MODEL_W - 30) * ((i + 0.5) / revealedCount);
  // ...curved indigo path
}
```

Arrows fade in over ANIM_MS with easeOutCubic.

**Step 2: Implement step() — Phase 2: Layers light up**

Same as Demo 1: sequential layer highlighting at 80ms intervals.

**Step 3: Implement step() — Phase 3: Two outputs emerge**

After layers finish:
1. **KV slices** fade in beneath the current token, staggered 50ms per slice (top to bottom). Each slice: indigo fill (`COLORS.kvLight`), indigo stroke (`COLORS.kv`), same width as token. Add "KV" label on first token's first slice only.
2. **Prediction token** fades in at PRED_Y (amber, same as Demo 1).

Both emerge simultaneously (KV stacks upward from token, prediction downward from model).

**Step 4: Implement step() — Phase 4: Prediction slides up, row re-centers**

1. Prediction slides from PRED_Y up to where it will land in the token row
2. Target position: `tokenX(revealedCount, revealedCount + 1)` — its position in the *expanded* row
3. All arrows fade out
4. On completion: `revealedCount++`, call `render()` which re-centers the whole row including KV stacks

**Step 5: Implement play/reset**

Same pattern as Demo 1:
- `togglePlay()`: sets `playing`, calls `step()` in loop with 400ms delay
- `reset()`: clears state, `revealedCount = 1`, `render()`

**Step 6: Verify visually in browser, commit**

```bash
git add demos/demo2-kv-cache.js
git commit -m "feat: demo 2 step animation with KV slices and dual outputs"
```

---

### Task 4: Write Playwright tests

**Files:**
- Create: `tests/demo2.spec.js`

**Step 1: Write the test spec**

```js
import { test, expect } from '@playwright/test';

test.describe('Demo 2: KV Cache', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo2-standalone.html');
    await page.waitForSelector('.model-box');
  });

  test('renders initial state with one token', async ({ page }) => {
    const tokens = page.locator('.token-block');
    await expect(tokens).toHaveCount(1);
    // No KV slices yet (token hasn't been processed through a step)
    const kvSlices = page.locator('.kv-slice');
    await expect(kvSlices).toHaveCount(0);
  });

  test('Play, Step, Reset buttons exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('Step produces KV slices and prediction', async ({ page }) => {
    await page.getByRole('button', { name: 'Step' }).click();

    // After step: KV slices appear under "The" (4 slices, one per layer)
    const kvSlices = page.locator('.kv-slice');
    await expect(kvSlices).toHaveCount(4, { timeout: 5000 });

    // Prediction token appears
    const pred = page.locator('.prediction-token');
    await expect(pred).toHaveCount(1, { timeout: 5000 });
  });

  test('after step completes, token count increases', async ({ page }) => {
    await page.getByRole('button', { name: 'Step' }).click();
    // Wait for animation to complete — token slides up and joins row
    await expect(page.locator('.token-block')).toHaveCount(2, { timeout: 5000 });
  });

  test('second step shows KV arrows (indigo)', async ({ page }) => {
    // Step 1
    await page.getByRole('button', { name: 'Step' }).click();
    await expect(page.locator('.token-block')).toHaveCount(2, { timeout: 5000 });

    // Step 2 — should produce indigo KV input arrows
    await page.getByRole('button', { name: 'Step' }).click();
    const kvArrows = page.locator('.kv-arrow');
    await expect(kvArrows).toHaveCount(1, { timeout: 5000 });
    // 1 KV stack (from "The") feeds in
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
```

**Step 2: Run tests with snapshot update**

Run: `cd not-just-next-token && npx playwright test tests/demo2.spec.js --update-snapshots`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add tests/demo2.spec.js tests/demo2.spec.js-snapshots/
git commit -m "test: add playwright tests for demo 2 KV cache"
```

---

### Task 5: Polish and integration

**Files:**
- Modify: `index.html` (add Demo 2 section placeholder)
- Modify: `demos/demo2-kv-cache.js` (any visual polish)

**Step 1: Add Demo 2 to index.html**

Add a new section after Demo 1:

```html
<section id="section-kv-cache">
  <!-- Author prose goes here -->
  <div class="demo-container" id="demo-kv"></div>
</section>
```

And the import in the script block:

```js
import { init as initDemo2 } from './demos/demo2-kv-cache.js';
initDemo2(document.getElementById('demo-kv'));
```

**Step 2: Run full test suite**

Run: `cd not-just-next-token && npx playwright test`
Expected: All tests pass (demo1 + demo2).

**Step 3: Commit**

```bash
git add index.html demos/demo2-kv-cache.js
git commit -m "feat: integrate demo 2 into article shell"
```
