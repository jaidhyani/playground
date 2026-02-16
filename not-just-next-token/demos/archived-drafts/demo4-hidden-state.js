import {
  createSVG, rect, text, line, path, group, addArrowMarker,
  curvedArrow, createButton, COLORS, valueToColor,
} from './shared.js';

const TOKENS = ['The', 'cat', 'watched', 'the', 'bird', 'fly'];

// Synthetic 4x4 hidden states for each step.
// RNN: entirely new each step (overwritten).
// Transformer: each token gets its own KV that persists unchanged.
const RNN_STATES = [
  [[0.9,0.1,0.3,0.6],[0.2,0.8,0.1,0.4],[0.5,0.3,0.7,0.2],[0.1,0.6,0.4,0.9]],
  [[0.3,0.7,0.5,0.2],[0.8,0.1,0.6,0.9],[0.4,0.5,0.2,0.3],[0.7,0.2,0.8,0.1]],
  [[0.6,0.4,0.8,0.1],[0.1,0.9,0.3,0.7],[0.8,0.2,0.5,0.4],[0.3,0.6,0.1,0.8]],
  [[0.2,0.5,0.1,0.8],[0.7,0.3,0.9,0.2],[0.1,0.8,0.4,0.6],[0.9,0.1,0.7,0.3]],
  [[0.8,0.2,0.6,0.3],[0.4,0.7,0.1,0.5],[0.3,0.9,0.8,0.1],[0.6,0.4,0.2,0.7]],
  [[0.1,0.8,0.4,0.7],[0.5,0.2,0.7,0.3],[0.9,0.1,0.3,0.8],[0.2,0.7,0.6,0.1]],
];

const KV_STATES = [
  [[0.9,0.2,0.5,0.3],[0.1,0.7,0.4,0.8],[0.6,0.3,0.8,0.1],[0.4,0.9,0.2,0.6]],
  [[0.3,0.8,0.1,0.6],[0.7,0.4,0.9,0.2],[0.2,0.6,0.3,0.7],[0.8,0.1,0.5,0.4]],
  [[0.5,0.1,0.7,0.9],[0.3,0.6,0.2,0.5],[0.8,0.4,0.1,0.3],[0.1,0.7,0.9,0.2]],
  [[0.7,0.3,0.4,0.1],[0.9,0.5,0.8,0.6],[0.2,0.1,0.6,0.9],[0.5,0.8,0.3,0.4]],
  [[0.4,0.6,0.9,0.2],[0.1,0.8,0.3,0.7],[0.7,0.2,0.5,0.8],[0.3,0.5,0.1,0.9]],
  [[0.2,0.9,0.6,0.4],[0.8,0.3,0.1,0.9],[0.4,0.7,0.2,0.5],[0.6,0.1,0.8,0.3]],
];

const CELL = 12;
const GRID = 4;
const BLOCK_W = CELL * GRID;
const GAP = 16;
const TOKEN_Y = 40;
const HEATMAP_Y = 64;
const PANEL_W = 380;
const PANEL_H = 220;

function drawHeatmap(parent, x, y, grid, opacity) {
  const g = group(parent);
  if (opacity != null) g.setAttribute('opacity', opacity);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const color = valueToColor(grid[r][c], '#e0e7ff', '#4338ca');
      rect(g, x + c * CELL, y + r * CELL, CELL, CELL, color, {
        stroke: '#c7d2fe', strokeWidth: 0.5,
      });
    }
  }
  return g;
}

function blockX(index) {
  const totalWidth = BLOCK_W;
  const spacing = totalWidth + GAP;
  const startX = 30;
  return startX + index * spacing;
}

function drawRNNPanel(svg, step) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  addArrowMarker(svg, 'rnn-arrow', COLORS.forward, 6);

  text(svg, PANEL_W / 2, 16, 'Recurrent Neural Network', {
    fontSize: '13', fontWeight: '600', fill: COLORS.textLight,
  });

  for (let i = 0; i < step; i++) {
    const x = blockX(i);
    const isLast = i === step - 1;
    const opacity = isLast ? 1.0 : 0.3;

    text(svg, x + BLOCK_W / 2, TOKEN_Y, TOKENS[i], {
      fontSize: '12', fontWeight: '500', opacity,
    });

    const hm = drawHeatmap(svg, x, HEATMAP_Y, RNN_STATES[i], opacity);
    hm.setAttribute('class', 'kv-block');

    // Arrow from this block to the next
    if (i < step - 1) {
      const arrowX1 = x + BLOCK_W + 2;
      const arrowX2 = blockX(i + 1) - 2;
      const arrowY = HEATMAP_Y + (CELL * GRID) / 2;
      line(svg, arrowX1, arrowY, arrowX2, arrowY, {
        stroke: COLORS.forward, markerEnd: 'url(#rnn-arrow)',
      });
      // Add arrowhead via path since line doesn't support markerEnd directly
      const arrowPath = path(svg,
        `M ${arrowX1} ${arrowY} L ${arrowX2} ${arrowY}`,
        { stroke: COLORS.forward, markerEnd: 'url(#rnn-arrow)', opacity: 0.5 }
      );
      // Remove the plain line, keep the path
      svg.removeChild(arrowPath.previousSibling);
    }
  }

  // Label under heatmap area
  if (step > 0) {
    const lastX = blockX(step - 1);
    text(svg, lastX + BLOCK_W / 2, HEATMAP_Y + CELL * GRID + 18,
      'hidden state (fixed size)', {
        fontSize: '10', fill: COLORS.textLight, anchor: 'middle',
      });
  }
}

function drawTransformerPanel(svg, step) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  addArrowMarker(svg, 'tf-arrow', COLORS.attention, 5);

  text(svg, PANEL_W / 2, 16, 'Transformer', {
    fontSize: '13', fontWeight: '600', fill: COLORS.textLight,
  });

  for (let i = 0; i < step; i++) {
    const x = blockX(i);

    text(svg, x + BLOCK_W / 2, TOKEN_Y, TOKENS[i], {
      fontSize: '12', fontWeight: '500',
    });

    const hm = drawHeatmap(svg, x, HEATMAP_Y, KV_STATES[i], 1.0);
    hm.setAttribute('class', 'kv-block');
  }

  // Attention arrows: from each previous KV block to the latest one
  if (step > 1) {
    const targetX = blockX(step - 1) + BLOCK_W / 2;
    const targetY = HEATMAP_Y - 4;
    for (let i = 0; i < step - 1; i++) {
      const srcX = blockX(i) + BLOCK_W / 2;
      const srcY = HEATMAP_Y - 4;
      curvedArrow(svg, srcX, srcY, targetX, targetY, {
        stroke: COLORS.attention, strokeWidth: 1.2,
        direction: 'up', curvature: 0.25,
        markerEnd: 'url(#tf-arrow)', opacity: 0.6,
      });
    }
  }

  // Label under KV area
  if (step > 0) {
    const midX = (blockX(0) + blockX(step - 1) + BLOCK_W) / 2;
    text(svg, midX, HEATMAP_Y + CELL * GRID + 18,
      `KV cache (${step} block${step > 1 ? 's' : ''}, growing)`, {
        fontSize: '10', fill: COLORS.textLight, anchor: 'middle',
      });
  }
}

export function init(container) {
  let currentStep = 0;

  const wrapper = document.createElement('div');
  wrapper.className = 'side-by-side';
  wrapper.style.display = 'flex';
  wrapper.style.gap = '1rem';
  container.appendChild(wrapper);

  const leftPanel = document.createElement('div');
  leftPanel.className = 'rnn-panel';
  leftPanel.style.flex = '1';
  wrapper.appendChild(leftPanel);

  const rightPanel = document.createElement('div');
  rightPanel.className = 'transformer-panel';
  rightPanel.style.flex = '1';
  wrapper.appendChild(rightPanel);

  const rnnSvg = createSVG(leftPanel, PANEL_W, PANEL_H);
  const tfSvg = createSVG(rightPanel, PANEL_W, PANEL_H);

  const controls = document.createElement('div');
  controls.className = 'demo-controls';
  container.appendChild(controls);

  const backBtn = createButton(controls, 'Back', () => {
    if (currentStep > 0) { currentStep--; render(); }
  });
  const stepBtn = createButton(controls, 'Step', () => {
    if (currentStep < TOKENS.length) { currentStep++; render(); }
  });
  const resetBtn = createButton(controls, 'Reset', () => {
    currentStep = 0; render();
  });

  const label = document.createElement('span');
  label.className = 'demo-label';
  controls.appendChild(label);

  function render() {
    backBtn.disabled = currentStep === 0;
    stepBtn.disabled = currentStep === TOKENS.length;

    label.textContent = currentStep === 0
      ? `0 of ${TOKENS.length} tokens`
      : `Token ${currentStep} of ${TOKENS.length}`;

    drawRNNPanel(rnnSvg, currentStep);
    drawTransformerPanel(tfSvg, currentStep);
  }

  render();
}
