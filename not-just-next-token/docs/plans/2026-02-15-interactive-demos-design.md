# Interactive Demos: LLMs Aren't Just Next-Token Predictors

## Purpose

A set of interactive demos embedded in a blog post / article. The article argues that LLMs are always planning ahead — producing KV activations optimized for long-range prediction, not just the immediately next token. The prose is author-written; these demos are the interactive visual elements that make the mechanical insights tangible.

Target audience: smart generalists familiar with "LLMs are next-token predictors" who haven't thought about what training actually optimizes.

Distribution: social sharing (Twitter/HN/Reddit). Must load fast, look polished, work on mobile.

## The Demos

### Demo 1: The Myopic Model

The straw man — shows the "next-token predictor" mental model so the author can subvert it.

A sequence of tokens. Each position looks only at the immediately next token. Context window slides forward, a single prediction pops out, repeat. Visually simple, deliberately boring. This is what the reader already believes.

### Demo 2: Where the Gradients Go

The mechanical heart of the argument. A sequence of ~6-8 tokens laid out horizontally, each with a KV block beneath it.

**Forward pass view:** User clicks a target token. Arrows flow from earlier KV blocks into that token's attention computation. Arrow thickness = attention weight.

**Backward pass view:** Gradient arrows flow backward from the target token's loss through all KV blocks it attended to. Then: show gradients from ALL tokens simultaneously. Token 1's KV block lights up with accumulated gradient from tokens 2, 3, 4, 5, 6, 7, 8. Early positions receive optimization pressure from the entire future.

User can toggle forward/backward, click different target tokens, see gradient accumulation.

### Demo 3: Two Outputs

A single position zoomed in. It takes context and produces two things side by side:
- Left: next-token probability distribution (bar chart over vocabulary)
- Right: KV activation (heatmap/pattern visualization)

Training optimizes both. User drags a slider between "optimized for next token only" and "optimized for all future tokens." The KV pattern changes dramatically; the next-token prediction barely changes. Point: the KV activation carries the bulk of the information that training cares about.

Uses pre-computed or synthetic activation data at both extremes, interpolated by the slider.

### Demo 4: The Hidden State

Side-by-side: simple RNN on the left, transformer on the right. Both processing the same short sequence.

RNN: hidden state vector passed forward step by step, compressed into fixed size.
Transformer: KV cache growing at each step, full history accessible via attention.

Visual parallel: both pass learned representations forward through time. Mechanical difference: RNNs compress, transformers keep full history. User steps through token-by-token.

## Priority

Demo 2 is essential — it IS the argument. Demo 3 makes "two outputs" visceral. Demos 1 and 4 are supporting context. If cutting scope: 2 > 3 > 1 > 4.

## Visual Design

**Theme:** Light background (white/light gray). Clean, Distill.pub-adjacent. Accessible to general audiences.

**Color system:**
- Background: clean white / light gray
- Token blocks: dark gray, subtle border
- KV activations: blue/indigo fills
- Next-token predictions: amber/orange fills
- Forward pass arrows: medium gray
- Gradient/backward arrows: magenta/rose
- Attention weights: blue, opacity-coded by strength
- Interactive highlights: teal or violet on hover/selection

**Interactions:** Click to select, hover to highlight, toggle switches, sliders, step buttons. No scroll hijacking or fixed positioning tricks.

## Technical Design

**Stack:** Vanilla JS + SVG. No build step, no framework. SVG for clickable/hoverable elements and CSS transitions. requestAnimationFrame for particle-flow animations if needed, but SVG-first.

**File structure:**
```
not-just-next-token/
  index.html
  style.css
  demos/
    shared.js
    demo1-myopic.js
    demo2-gradients.js
    demo3-two-outputs.js
    demo4-hidden-state.js
  data/
    activations.json
```

Each demo exports `init(containerElement)`. Embedded via:
```html
<div id="demo-gradients" class="demo-container"></div>
<script type="module">
  import { init } from './demos/demo2-gradients.js';
  init(document.getElementById('demo-gradients'));
</script>
```

**Responsive:** Each demo detects container width and scales. Side-by-side layouts stack on narrow screens (<600px).

## Implementation Approach

Each demo built by a separate teammate in parallel. Playwright used to validate appearance and functionality. May generate multiple candidates per demo for comparison.
