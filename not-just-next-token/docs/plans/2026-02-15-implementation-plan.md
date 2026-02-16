# Interactive LLM Demos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build 4 interactive SVG visualizations demonstrating that LLMs produce KV activations optimized for long-range prediction, not just next-token prediction.

**Architecture:** Each demo is a standalone ES module exporting `init(container)`. Demos are developed independently with their own standalone HTML pages, then integrated into a final article shell. Playwright validates both rendering and interactivity.

**Tech Stack:** Vanilla JS, SVG, CSS. No build step. Playwright for testing.

---

## Task 0: Project Scaffolding

**Files:**
- Create: `style.css`
- Create: `demos/shared.js`
- Create: `index.html`
- Create: `package.json`
- Create: `playwright.config.js`

**Step 1: Create package.json with Playwright dependency**

```json
{
  "name": "not-just-next-token",
  "private": true,
  "scripts": {
    "test": "npx playwright test",
    "test:headed": "npx playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0"
  }
}
```

**Step 2: Create playwright.config.js**

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npx serve -l 3000 -s .',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

**Step 3: Install dependencies**

Run: `npm install && npx playwright install chromium`

**Step 4: Create style.css**

Light theme. Clean typography. Demo containers with consistent sizing, subtle borders, padding. Responsive breakpoints at 600px. Specific classes:
- `.demo-container` — max-width 800px, centered, light border, border-radius, padding
- `.demo-controls` — flex row for buttons/toggles/sliders below the SVG
- `.demo-label` — small caps label text
- `.token-block` — styles for token rectangles
- `.kv-block` — styles for KV activation blocks
- Toggle button styles (active/inactive states)
- Slider styles

Color CSS custom properties matching the design doc:
```css
:root {
  --color-token: #374151;
  --color-token-border: #d1d5db;
  --color-kv: #4f46e5;
  --color-pred: #f59e0b;
  --color-forward: #9ca3af;
  --color-gradient: #e11d48;
  --color-attention: #3b82f6;
  --color-highlight: #0d9488;
  --color-bg: #ffffff;
  --color-bg-alt: #f9fafb;
  --color-text: #1f2937;
  --color-text-light: #6b7280;
}
```

**Step 5: Create demos/shared.js**

Shared utilities used by all demos:

```js
export const SVG_NS = 'http://www.w3.org/2000/svg';

export const COLORS = {
  token: '#374151',
  tokenBorder: '#d1d5db',
  kv: '#4f46e5',
  kvLight: '#c7d2fe',
  pred: '#f59e0b',
  predLight: '#fde68a',
  forward: '#9ca3af',
  gradient: '#e11d48',
  gradientLight: '#fecdd3',
  attention: '#3b82f6',
  highlight: '#0d9488',
  bg: '#ffffff',
  bgAlt: '#f9fafb',
  text: '#1f2937',
  textLight: '#6b7280',
};

// Create an SVG element inside a container, responsive to container width
export function createSVG(container, viewBoxWidth, viewBoxHeight) { ... }

// Create basic SVG shapes: rect, text, line, path
export function rect(svg, x, y, w, h, fill, opts = {}) { ... }
export function text(svg, x, y, content, opts = {}) { ... }

// Create a curved arrow between two points with optional arrowhead
export function arrow(svg, x1, y1, x2, y2, opts = {}) { ... }

// Create a group element
export function group(svg, className) { ... }

// Simple easing functions
export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Animate a numeric property over time
export function animate(duration, callback) { ... }

// Create a toggle button pair (e.g., Forward / Backward)
export function createToggle(container, labelA, labelB, onChange) { ... }

// Create a labeled slider
export function createSlider(container, label, min, max, initial, onChange) { ... }

// Create step buttons (< Step >)
export function createStepButtons(container, onPrev, onNext) { ... }
```

**Step 6: Create index.html shell**

Minimal HTML with `<section>` placeholders for each demo. Author will fill in prose. Each demo section has a `<div class="demo-container" id="demo-N">` and the corresponding script import.

**Step 7: Create tests/ directory**

Run: `mkdir tests`

**Step 8: Commit scaffolding**

```bash
git add -A not-just-next-token/
git commit -m "feat: project scaffolding with shared utilities and playwright config"
```

---

## Task 1: Demo 1 — The Myopic Model

**Context:** This demo shows the standard "next-token predictor" mental model. A sentence of ~8 tokens displayed horizontally. An animated "context window" highlights tokens 1..N, produces a prediction for token N+1, then advances. Each prediction appears to only consider the immediately preceding context with no forward planning.

**Files:**
- Create: `demos/demo1-myopic.js`
- Create: `demos/demo1-standalone.html`
- Create: `tests/demo1.spec.js`

### Visual Spec

The SVG shows a horizontal row of token blocks (rounded rects with word text inside). Below the row is a "prediction zone" — a single highlighted slot where the predicted next token appears.

Animation sequence:
1. Tokens 1..N highlighted (context window), rest grayed out
2. A single arrow from the context to the prediction zone
3. Predicted token appears in the slot with a brief fade-in
4. The predicted token moves up into position N+1 in the sequence
5. Context window advances by one, repeat

A "play/pause" button and a "step" button let the user control the animation. A "reset" button returns to the start.

The deliberate visual message: this looks mechanical and shallow. One arrow, one prediction, move on.

**Step 1: Create demo1-standalone.html**

Minimal HTML page that loads style.css, shared.js, and demo1-myopic.js. Contains a single `<div id="demo" class="demo-container">`.

**Step 2: Create demo1-myopic.js with init()**

The module should:
- Define a hardcoded sentence: `["The", "cat", "sat", "on", "the", "warm", "sunny", "windowsill"]`
- Create the SVG with token blocks laid out horizontally
- Implement the animation loop described above
- Add play/pause, step, and reset controls via shared.js helpers
- Export `init(container)`

**Step 3: Create Playwright test**

```js
// tests/demo1.spec.js
import { test, expect } from '@playwright/test';

test.describe('Demo 1: Myopic Model', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo1-standalone.html');
  });

  test('renders token sequence', async ({ page }) => {
    const tokens = page.locator('.token-block');
    await expect(tokens).toHaveCount(8);
  });

  test('has play/pause and step controls', async ({ page }) => {
    await expect(page.locator('button:has-text("Play")')).toBeVisible();
    await expect(page.locator('button:has-text("Step")')).toBeVisible();
  });

  test('step advances the context window', async ({ page }) => {
    await page.click('button:has-text("Step")');
    // After stepping, a prediction should appear
    const prediction = page.locator('.prediction-token');
    await expect(prediction).toBeVisible();
  });

  test('screenshot baseline', async ({ page }) => {
    await expect(page).toHaveScreenshot('demo1-initial.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
```

**Step 4: Run tests, verify render and interaction work**

Run: `npm test -- tests/demo1.spec.js`

**Step 5: Commit**

```bash
git add demos/demo1-myopic.js demos/demo1-standalone.html tests/demo1.spec.js
git commit -m "feat: Demo 1 - myopic next-token predictor visualization"
```

---

## Task 2: Demo 2 — Where the Gradients Go

**Context:** This is the most important demo. A horizontal sequence of ~6-8 tokens, each with a visible KV block beneath. Two views toggled by the user: Forward Pass and Backward Pass.

**Files:**
- Create: `demos/demo2-gradients.js`
- Create: `demos/demo2-standalone.html`
- Create: `tests/demo2.spec.js`

### Visual Spec

**Layout:** Top row = token blocks (rounded rects, dark gray, word text). Below each token = a KV block (smaller rect, blue/indigo fill). Spacing generous enough for arrows between them.

**Forward Pass View:**
- User clicks a target token (e.g., token 6). It highlights with teal border.
- Curved arrows animate from each earlier KV block UP to the selected token.
- Arrow opacity/thickness varies to suggest attention weights (predefined plausible values).
- Small label above arrows: "attention".

**Backward Pass View:**
- Toggle to "Backward" view. Same target token selected.
- Arrows reverse direction — magenta/rose, flowing FROM the target token's loss DOWN to earlier KV blocks.
- Animate sequentially: gradient "flows" backward through time.
- Then: "Show All" button. Gradients from ALL tokens shown simultaneously. Each KV block accumulates color intensity based on how many future tokens send gradient to it. Token 1's KV block should be the brightest (receives gradient from 7 future tokens). Token 7's KV block is dim (only token 8 sends gradient to it).
- The gradient accumulation is the key visual: early positions receive the most training signal from the future.

**Interactions:**
- Click any token to select it as the target
- Toggle: Forward / Backward
- Button: "Show All Gradients" (only in backward view)
- Hover any arrow to see a tooltip with simplified info

**Hardcoded data:**
- Sentence: `["The", "curious", "cat", "quietly", "watched", "the", "bird", "fly"]`
- Attention weights: a plausible 8x8 lower-triangular matrix (each row sums to ~1, causal mask)
- Gradient magnitudes: derived from attention weights (simplified: gradient to KV[j] from token[i] proportional to attention[i][j])

**Step 1: Create demo2-standalone.html**

Same pattern as Demo 1.

**Step 2: Implement demo2-gradients.js**

The module should:
- Lay out tokens + KV blocks horizontally
- Handle click-to-select on tokens
- Render forward arrows (gray, attention-weighted) on selection
- Render backward arrows (magenta, gradient) on toggle
- Implement "Show All" gradient accumulation view
- Use animated transitions when switching views
- Export `init(container)`

Key implementation detail for arrows: use SVG `<path>` with quadratic bezier curves. Forward arrows curve upward from KV to token. Backward arrows curve downward from token to KV. This visual direction difference reinforces forward vs backward.

**Step 3: Playwright tests**

```js
// tests/demo2.spec.js
import { test, expect } from '@playwright/test';

test.describe('Demo 2: Gradient Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo2-standalone.html');
  });

  test('renders tokens and KV blocks', async ({ page }) => {
    await expect(page.locator('.token-block')).toHaveCount(8);
    await expect(page.locator('.kv-block')).toHaveCount(8);
  });

  test('clicking a token shows forward arrows', async ({ page }) => {
    await page.locator('.token-block').nth(5).click();
    const arrows = page.locator('.forward-arrow');
    await expect(arrows.first()).toBeVisible();
  });

  test('toggling to backward shows gradient arrows', async ({ page }) => {
    await page.locator('.token-block').nth(5).click();
    await page.click('button:has-text("Backward")');
    const arrows = page.locator('.gradient-arrow');
    await expect(arrows.first()).toBeVisible();
  });

  test('show all gradients highlights early KV blocks more', async ({ page }) => {
    await page.click('button:has-text("Backward")');
    await page.click('button:has-text("Show All")');
    // Token 1 KV should have higher opacity than token 7 KV
    const kv1 = page.locator('.kv-block').first();
    const kv7 = page.locator('.kv-block').nth(6);
    const opacity1 = await kv1.evaluate(el => parseFloat(getComputedStyle(el).opacity || el.getAttribute('opacity') || '1'));
    const opacity7 = await kv7.evaluate(el => parseFloat(getComputedStyle(el).opacity || el.getAttribute('opacity') || '1'));
    // kv1 should be at least as visible as kv7 (checking fill-opacity or similar)
  });

  test('screenshot - forward pass', async ({ page }) => {
    await page.locator('.token-block').nth(5).click();
    await expect(page).toHaveScreenshot('demo2-forward.png', { maxDiffPixelRatio: 0.05 });
  });

  test('screenshot - backward all gradients', async ({ page }) => {
    await page.click('button:has-text("Backward")');
    await page.click('button:has-text("Show All")');
    await expect(page).toHaveScreenshot('demo2-backward-all.png', { maxDiffPixelRatio: 0.05 });
  });
});
```

**Step 4: Run tests**

Run: `npm test -- tests/demo2.spec.js`

**Step 5: Commit**

```bash
git add demos/demo2-gradients.js demos/demo2-standalone.html tests/demo2.spec.js
git commit -m "feat: Demo 2 - forward/backward gradient flow visualization"
```

---

## Task 3: Demo 3 — Two Outputs

**Context:** A single transformer position zoomed in. Shows that each position produces TWO things: a next-token probability distribution AND a KV activation vector. A slider lets the user see how the KV activation changes when optimized for "next token only" vs "all future tokens."

**Files:**
- Create: `demos/demo3-two-outputs.js`
- Create: `demos/demo3-standalone.html`
- Create: `data/activations.json`
- Create: `tests/demo3.spec.js`

### Visual Spec

**Layout:** Center of SVG shows a stylized "transformer block" (a rounded rectangle labeled with the current token). Two output branches extend from it:

- **Left branch → "Next Token Prediction":** A horizontal bar chart showing probability distribution over ~8 candidate words. Bars colored amber/orange. The top candidate is highlighted.

- **Right branch → "KV Activation":** A grid/heatmap visualization of a vector (e.g., 8x8 grid of cells colored by value on a blue gradient). Represents the KV activation pattern.

**The Slider:** Below the visualization, a slider labeled:
- Left end: "Optimized for next token only"
- Right end: "Optimized for all future tokens"

As the user drags the slider:
- The bar chart barely changes (next-token prediction is similar either way)
- The KV heatmap transforms dramatically (from noisy/sparse at left to structured/rich at right)

This is the visual punch: training for the long game barely changes what the model predicts RIGHT NOW, but radically changes what it "writes down" for the future.

**Hardcoded data in data/activations.json:**

```json
{
  "token": "watched",
  "candidates": ["the", "a", "as", "while", "its", "with", "in", "and"],
  "probs_myopic": [0.31, 0.18, 0.14, 0.12, 0.09, 0.07, 0.05, 0.04],
  "probs_full": [0.29, 0.19, 0.15, 0.11, 0.10, 0.07, 0.05, 0.04],
  "kv_myopic": [[...8x8 grid of values 0-1, relatively uniform/noisy...]],
  "kv_full": [[...8x8 grid of values 0-1, structured patterns, clear clusters...]]
}
```

The slider linearly interpolates between the two endpoints for both probs and KV values.

**Step 1: Create data/activations.json with synthetic data**

Craft the two activation sets by hand. The myopic KV should look random/uniform. The full KV should have visible structure (diagonal bands, clusters, clear hot spots).

**Step 2: Create demo3-standalone.html**

**Step 3: Implement demo3-two-outputs.js**

- Load activations.json via fetch
- Render the central transformer block, left bar chart, right heatmap
- Implement slider that interpolates between myopic and full endpoints
- Smooth transitions on the heatmap cells and bar widths
- Export `init(container)`

**Step 4: Playwright tests**

```js
// tests/demo3.spec.js
import { test, expect } from '@playwright/test';

test.describe('Demo 3: Two Outputs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo3-two-outputs.html');
  });

  test('renders bar chart and heatmap', async ({ page }) => {
    await expect(page.locator('.prob-bar')).toHaveCount(8);
    await expect(page.locator('.kv-cell')).toHaveCount(64); // 8x8
  });

  test('slider changes heatmap visibly', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    // Screenshot at left extreme
    await slider.fill('0');
    const shot1 = await page.screenshot();
    // Screenshot at right extreme
    await slider.fill('100');
    const shot2 = await page.screenshot();
    // They should differ (heatmap changes)
    expect(shot1).not.toEqual(shot2);
  });

  test('screenshot at full optimization', async ({ page }) => {
    await page.locator('input[type="range"]').fill('100');
    await expect(page).toHaveScreenshot('demo3-full.png', { maxDiffPixelRatio: 0.05 });
  });
});
```

**Step 5: Run tests**

Run: `npm test -- tests/demo3.spec.js`

**Step 6: Commit**

```bash
git add demos/demo3-two-outputs.js demos/demo3-standalone.html data/activations.json tests/demo3.spec.js
git commit -m "feat: Demo 3 - two outputs visualization with optimization slider"
```

---

## Task 4: Demo 4 — The Hidden State (RNN Parallel)

**Context:** Side-by-side comparison of an RNN and a transformer processing the same short sequence. Shows that both pass learned representations forward through time — the RNN via its hidden state vector, the transformer via its growing KV cache. The user steps through token by token.

**Files:**
- Create: `demos/demo4-hidden-state.js`
- Create: `demos/demo4-standalone.html`
- Create: `tests/demo4.spec.js`

### Visual Spec

**Layout:** Two panels side by side (stacked on mobile <600px).

**Left panel — "Recurrent Network":**
- A chain of blocks, one per token processed so far
- Each block has: the token text on top, a small colored rectangle representing the hidden state below
- A single arrow passes the hidden state from block N to block N+1
- The hidden state rect is FIXED SIZE (same dimensions at every step) — this is the visual point: RNNs compress everything into a fixed-size bottleneck
- The hidden state color/pattern evolves as more tokens are processed

**Right panel — "Transformer":**
- Same tokens along the top
- Below each token: a KV block
- Unlike the RNN, ALL previous KV blocks remain visible and accessible
- When a new token is processed, arrows fan out from ALL previous KV blocks to the new position
- The KV "memory" GROWS — new blocks appear, old ones persist
- Visual point: the transformer keeps the full history accessible

**Controls:**
- "Step Forward" / "Step Back" buttons
- Token counter: "Processing token 3 of 6"
- "Reset" button

**Hardcoded data:**
- Sentence: `["The", "cat", "watched", "the", "bird", "fly"]`
- RNN hidden states: 6 synthetic patterns (small 4x4 grids that evolve)
- Transformer KV states: 6 synthetic patterns (same 4x4 grids but all remain visible)

**Step 1: Create demo4-standalone.html**

**Step 2: Implement demo4-hidden-state.js**

- Lay out two panels
- Implement step-through logic
- RNN side: show only current hidden state, animate the pass-forward
- Transformer side: show all KV blocks up to current step, animate attention arrows
- Responsive: stack panels on narrow screens
- Export `init(container)`

**Step 3: Playwright tests**

```js
// tests/demo4.spec.js
import { test, expect } from '@playwright/test';

test.describe('Demo 4: Hidden State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/demo4-standalone.html');
  });

  test('renders two panels', async ({ page }) => {
    await expect(page.locator('.rnn-panel')).toBeVisible();
    await expect(page.locator('.transformer-panel')).toBeVisible();
  });

  test('stepping forward adds elements to both panels', async ({ page }) => {
    await page.click('button:has-text("Step")');
    await page.click('button:has-text("Step")');
    await page.click('button:has-text("Step")');
    // RNN should show 1 hidden state (current only)
    // Transformer should show 3 KV blocks (all history)
    const kvBlocks = page.locator('.transformer-panel .kv-block');
    await expect(kvBlocks).toHaveCount(3);
  });

  test('screenshot at step 4', async ({ page }) => {
    for (let i = 0; i < 4; i++) {
      await page.click('button:has-text("Step")');
    }
    await expect(page).toHaveScreenshot('demo4-step4.png', { maxDiffPixelRatio: 0.05 });
  });
});
```

**Step 4: Run tests**

Run: `npm test -- tests/demo4.spec.js`

**Step 5: Commit**

```bash
git add demos/demo4-hidden-state.js demos/demo4-standalone.html tests/demo4.spec.js
git commit -m "feat: Demo 4 - RNN vs transformer hidden state comparison"
```

---

## Task 5: Integration & Polish

**Depends on:** Tasks 0-4 complete.

**Files:**
- Modify: `index.html` — embed all 4 demos with placeholder prose sections
- Create: `tests/integration.spec.js`

**Step 1: Update index.html to embed all demos**

Each demo gets a `<section>` with a heading, a placeholder `<p>` (for the author's prose), and the demo container with its module import.

**Step 2: Integration Playwright test**

Verify all 4 demos render on the single page, no JS errors, basic interaction for each.

**Step 3: Visual review**

Take full-page screenshots at desktop (1280px) and mobile (375px) widths.

**Step 4: Commit**

```bash
git add index.html tests/integration.spec.js
git commit -m "feat: integrate all demos into article shell"
```
