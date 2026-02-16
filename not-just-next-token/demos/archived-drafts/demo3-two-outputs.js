import {
  createSVG, rect, text, line, group, addArrowMarker,
  createSlider, COLORS, lerp, lerpGrid, valueToColor,
} from './shared.js';

const DATA = {
  token: 'watched',
  context: ['The', 'curious', 'cat', 'quietly', 'watched'],
  candidates: ['the', 'a', 'as', 'while', 'its', 'with', 'in', 'and'],
  probs_myopic: [0.31, 0.18, 0.14, 0.12, 0.09, 0.07, 0.05, 0.04],
  probs_full:   [0.29, 0.19, 0.15, 0.11, 0.10, 0.07, 0.05, 0.04],
  kv_myopic: [
    [0.12, 0.45, 0.23, 0.67, 0.34, 0.56, 0.18, 0.41],
    [0.55, 0.28, 0.63, 0.15, 0.72, 0.33, 0.48, 0.21],
    [0.37, 0.61, 0.19, 0.52, 0.26, 0.44, 0.59, 0.35],
    [0.48, 0.22, 0.57, 0.31, 0.65, 0.17, 0.42, 0.54],
    [0.29, 0.53, 0.38, 0.46, 0.21, 0.62, 0.27, 0.49],
    [0.61, 0.14, 0.47, 0.58, 0.33, 0.25, 0.51, 0.36],
    [0.43, 0.39, 0.52, 0.24, 0.57, 0.41, 0.16, 0.63],
    [0.26, 0.58, 0.31, 0.43, 0.49, 0.55, 0.38, 0.22],
  ],
  kv_full: [
    [0.95, 0.88, 0.72, 0.15, 0.08, 0.05, 0.03, 0.02],
    [0.82, 0.91, 0.85, 0.22, 0.10, 0.06, 0.04, 0.03],
    [0.65, 0.78, 0.92, 0.68, 0.18, 0.09, 0.05, 0.04],
    [0.12, 0.18, 0.62, 0.90, 0.75, 0.15, 0.08, 0.06],
    [0.06, 0.09, 0.15, 0.72, 0.93, 0.82, 0.20, 0.10],
    [0.04, 0.06, 0.08, 0.18, 0.78, 0.95, 0.85, 0.25],
    [0.03, 0.04, 0.05, 0.10, 0.22, 0.80, 0.94, 0.78],
    [0.02, 0.03, 0.04, 0.06, 0.12, 0.28, 0.82, 0.96],
  ],
};

// Layout constants
const VB_W = 800, VB_H = 370;

// Transformer block
const BLOCK_W = 140, BLOCK_H = 50;
const BLOCK_X = (VB_W - BLOCK_W) / 2, BLOCK_Y = 55;

// Context tokens above the block
const CTX_Y = 25;

// Bar chart (left branch)
const BAR_LABEL_X = 60;
const BAR_X = 110;
const BAR_MAX_W = 160;
const BAR_H = 20;
const BAR_GAP = 4;
const BAR_START_Y = 170;

// Heatmap (right branch)
const CELL = 24;
const GRID_COLS = 8, GRID_ROWS = 8;
const GRID_X = 530;
const GRID_Y = 170;

export function init(container) {
  const svg = createSVG(container, VB_W, VB_H);

  // --- Context tokens ---
  const ctxGroup = group(svg, 'context-tokens');
  const ctxSpacing = 90;
  const ctxStartX = VB_W / 2 - ((DATA.context.length - 1) * ctxSpacing) / 2;
  DATA.context.forEach((tok, i) => {
    const x = ctxStartX + i * ctxSpacing;
    const isCurrent = i === DATA.context.length - 1;
    rect(ctxGroup, x - 32, CTX_Y - 13, 64, 26, isCurrent ? COLORS.token : COLORS.bg, {
      rx: 6, stroke: isCurrent ? COLORS.token : COLORS.tokenBorder, strokeWidth: 1.5,
    });
    text(ctxGroup, x, CTX_Y, tok, {
      fontSize: 13, fontWeight: isCurrent ? '700' : '400',
      fill: isCurrent ? '#fff' : COLORS.text,
    });
  });

  // --- Transformer block ---
  const blockGroup = group(svg, 'transformer-block');
  rect(blockGroup, BLOCK_X, BLOCK_Y, BLOCK_W, BLOCK_H, COLORS.bgAlt, {
    rx: 10, stroke: COLORS.tokenBorder, strokeWidth: 1.5,
  });
  text(blockGroup, BLOCK_X + BLOCK_W / 2, BLOCK_Y + BLOCK_H / 2, 'Transformer Block', {
    fontSize: 13, fontWeight: '600', fill: COLORS.textLight,
  });

  // Arrow from context to block
  line(svg, VB_W / 2, CTX_Y + 14, VB_W / 2, BLOCK_Y, { stroke: COLORS.forward });

  // --- Branch labels ---
  const branchY = BLOCK_Y + BLOCK_H + 14;

  // Left branch arrow + label
  addArrowMarker(svg, 'arrow-pred', COLORS.pred, 6);
  const leftBranchEndX = BAR_X + BAR_MAX_W / 2;
  const leftArrow = line(svg, BLOCK_X + 20, BLOCK_Y + BLOCK_H, leftBranchEndX, branchY + 18, {
    stroke: COLORS.pred, strokeWidth: 1.5,
  });
  leftArrow.setAttribute('marker-end', 'url(#arrow-pred)');

  text(svg, leftBranchEndX, branchY + 36, 'Next Token Prediction', {
    fontSize: 12, fontWeight: '600', fill: COLORS.pred,
  });

  // Right branch arrow + label
  addArrowMarker(svg, 'arrow-kv', COLORS.kv, 6);
  const rightBranchEndX = GRID_X + (GRID_COLS * CELL) / 2;
  const rightArrow = line(svg, BLOCK_X + BLOCK_W - 20, BLOCK_Y + BLOCK_H, rightBranchEndX, branchY + 18, {
    stroke: COLORS.kv, strokeWidth: 1.5,
  });
  rightArrow.setAttribute('marker-end', 'url(#arrow-kv)');

  text(svg, rightBranchEndX, branchY + 36, 'KV Activation', {
    fontSize: 12, fontWeight: '600', fill: COLORS.kv,
  });

  // --- Bar chart ---
  const barGroup = group(svg, 'bar-chart');
  const barEls = [];

  DATA.candidates.forEach((word, i) => {
    const y = BAR_START_Y + i * (BAR_H + BAR_GAP);
    text(barGroup, BAR_LABEL_X, y + BAR_H / 2, word, {
      fontSize: 12, anchor: 'end', fill: COLORS.textLight,
    });
    const w = DATA.probs_myopic[i] * BAR_MAX_W / 0.35;
    const bar = rect(barGroup, BAR_X, y, Math.max(w, 2), BAR_H, COLORS.pred, {
      rx: 3, className: 'prob-bar',
    });
    barEls.push(bar);
  });

  // --- Heatmap ---
  const heatGroup = group(svg, 'kv-heatmap');
  const cellEls = [];

  for (let r = 0; r < GRID_ROWS; r++) {
    cellEls[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      const val = DATA.kv_myopic[r][c];
      const color = valueToColor(val, '#ffffff', COLORS.kv);
      const cell = rect(heatGroup, GRID_X + c * CELL, GRID_Y + r * CELL, CELL - 1, CELL - 1, color, {
        rx: 3, className: 'kv-cell',
      });
      cellEls[r][c] = cell;
    }
  }

  // Heatmap border
  rect(heatGroup, GRID_X - 1, GRID_Y - 1, GRID_COLS * CELL + 1, GRID_ROWS * CELL + 1, 'none', {
    rx: 4, stroke: COLORS.tokenBorder, strokeWidth: 1,
  });

  // --- Slider ---
  const controls = document.createElement('div');
  controls.className = 'demo-controls';
  container.appendChild(controls);

  function update(t) {
    const probs = DATA.probs_myopic.map((v, i) => lerp(v, DATA.probs_full[i], t));
    const grid = lerpGrid(DATA.kv_myopic, DATA.kv_full, t);

    probs.forEach((p, i) => {
      const w = p * BAR_MAX_W / 0.35;
      barEls[i].setAttribute('width', Math.max(w, 2));
    });

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        cellEls[r][c].setAttribute('fill', valueToColor(grid[r][c], '#ffffff', COLORS.kv));
      }
    }
  }

  createSlider(controls, 'Next token only', 'All future tokens', 0, 100, 0, (val) => {
    update(val / 100);
  });
}
