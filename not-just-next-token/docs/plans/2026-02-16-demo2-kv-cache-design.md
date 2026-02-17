# Demo 2: KV Cache Visualization — Design

## Goal

Show that each forward pass produces TWO outputs: a token prediction AND KV activations. Show that subsequent passes use the latest token + accumulated KV activations (not all previous tokens).

## Visual Language

Builds on Demo 1's vocabulary (token row, LLM box with 4 layers, arrows, prediction zone) but introduces:
- **KV slices**: small indigo rectangles stacked below each processed token (one per layer)
- **Two arrow colors**: gray for token→model input, indigo for KV→model input
- Tokens appear only when generated (no pre-laid placeholder tokens)

## Layout

```
ViewBox: 800 x 520

TOKEN ROW (y≈30) — grows rightward as tokens are generated
KV ZONE (y≈70-130) — indigo slices stack beneath each token
LLM BOX (y≈200) — same as Demo 1, 4 internal layers
PREDICTION ZONE (y≈350) — amber prediction, slides up to join token row
```

Tokens + KV stacks re-center horizontally as the row grows.

## Animation Sequence

### Step 1 (prompt token "The")
1. "The" visible (user prompt, dark fill)
2. Gray arrow from "The" → model
3. Layers light up sequentially (80ms each)
4. Two outputs emerge:
   - 4 indigo KV slices fade in beneath "The" (staggered ~50ms per slice)
   - Amber prediction "cat" fades in below model
5. "cat" slides up to token row, arrows fade

### Step 2+ (e.g. processing "cat")
1. "The" has KV slices beneath it. "cat" just joined the row.
2. Arrows into model from two sources:
   - Gray arrow from "cat" (new token)
   - Indigo arrows from KV slices under "The"
3. Layers light up
4. Two outputs: KV slices under "cat" + prediction "sat"
5. "sat" slides up, arrows fade, row re-centers

### Step N
Latest token + ALL accumulated KV stacks → model → KV slices + prediction.

## Visual Details

- KV slices: same width as parent token (~80px), 10px tall, 2px gap. Indigo fill, lighter indigo stroke.
- "KV" label on first token's first slice only (9px, subtle).
- Token→model arrows: gray (COLORS.forward). KV→model arrows: indigo (COLORS.kv), 0.5 opacity.
- Curved arrow paths fan across model's top edge to avoid overlap.
- First token "The" is pre-filled (dark bg, white text). Generated tokens start amber, transition to dark on confirmation.

## Controls

Same as Demo 1: Play, Step, Reset.

## Timing

~350ms arrows in → ~320ms layers → ~350ms outputs → ~350ms slide up. ~1.4s per step.

## Tokens

Same sequence as Demo 1: ['The', 'cat', 'sat', 'on', 'the', 'warm', 'sunny', 'windowsill']
