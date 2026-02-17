# Architecture

## Overview

An interactive article demonstrating that LLMs do more than "just predict the next token." Each demo is a self-contained SVG animation that visualizes a different aspect of how transformers process sequences — from the naive myopic view to KV cache mechanics. Built as vanilla JS ES modules with no build step; served as static files.

## Directory Structure

```
not-just-next-token/
  index.html              # Article shell — imports and mounts all demos
  style.css               # Global styles (CSS custom properties for shared palette)
  data/
    activations.json      # Sample activation/probability data for future demos
  demos/
    shared.js             # SVG primitives, animation helpers, UI controls
    demo1-myopic.js       # Demo 1: naive next-token prediction loop
    demo1-standalone.html  # Standalone page for Demo 1 (used by tests)
    demo2-kv-cache.js     # Demo 2: KV cache visualization
    demo2-standalone.html  # Standalone page for Demo 2 (used by tests)
    archived-drafts/      # Earlier demo iterations (not imported anywhere)
  tests/
    demo1.spec.js         # Playwright tests for Demo 1
    demo2.spec.js         # Playwright tests for Demo 2
    *.png                 # Visual regression snapshots
  docs/plans/             # Design docs and implementation plans
  screenshots/            # Reference screenshots
  playwright.config.js    # Test config — spins up `serve` on :3000
  package.json            # Scripts: test, test:headed, serve
```

## Entry Points

- `index.html` — Article page. Imports both demos as ES modules and mounts them into `#demo-myopic` and `#demo-kv` containers.
- `demos/demo1-standalone.html` — Isolated Demo 1 page (test harness target).
- `demos/demo2-standalone.html` — Isolated Demo 2 page (test harness target).

## Key Abstractions

- **`demos/shared.js`** — The shared foundation. Provides SVG element factories (`rect`, `text`, `path`, `group`, `line`), arrow markers (`addArrowMarker`, `curvedArrow`), a cancellable `animate()` loop, easing functions, color interpolation (`valueToColor`, `lerp`, `lerpGrid`), and DOM control builders (`createButton`, `createToggle`, `createSlider`). Every demo imports from here.

- **Demo `init(container)` pattern** — Each demo exports a single `init` function that takes a DOM container element and builds the entire visualization inside it (SVG + controls). No shared state between demos; each is fully self-contained.

- **Animation lifecycle** — Demos use a 4-phase step animation (input arrows → layer activation → output/prediction → collapse into token row), driven by chained `animate()` calls. Each animation returns a cancel function tracked in `activeCancellers[]` so Reset can abort mid-flight.

## Data Flow

1. `index.html` imports `init` from each demo module
2. Each `init()` creates an SVG canvas and Play/Step/Reset controls
3. User clicks Step → multi-phase animation sequence:
   - Arrows animate from tokens/KV into model box
   - Internal layers light up sequentially
   - Prediction token appears below model
   - Prediction slides up into the token row
4. State is local to each demo closure (`revealedCount`, `animating`, `playing`)

## Module Dependencies

```
index.html
  ├── demos/demo1-myopic.js ──→ demos/shared.js
  └── demos/demo2-kv-cache.js ─→ demos/shared.js
```

Standalone HTML files mirror the same pattern (one demo per page).

## Testing

Playwright browser tests run against standalone HTML pages. The test server (`npx serve -l 3000 .`) is auto-started by `playwright.config.js`. Tests verify initial render state, button presence, animation side effects (token counts, KV slice counts), and visual regression via screenshot comparison.

## Configuration

- `playwright.config.js` — test directory, base URL, web server command
- No environment variables required
- No build step — serve the directory directly
