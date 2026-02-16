import {
  createSVG, rect, text, group, addArrowMarker, curvedArrow,
  animate, easeOutCubic, createToggle, createButton, COLORS,
} from './shared.js';

const TOKENS = ['The', 'curious', 'cat', 'quietly', 'watched', 'the', 'bird', 'fly'];

// Causal attention weights (lower triangular) — row = attending token, col = attended-to token
const ATTENTION = [
  [1.0,  0,    0,    0,    0,    0,    0,    0   ],
  [0.6,  0.4,  0,    0,    0,    0,    0,    0   ],
  [0.25, 0.35, 0.4,  0,    0,    0,    0,    0   ],
  [0.15, 0.2,  0.3,  0.35, 0,    0,    0,    0   ],
  [0.1,  0.15, 0.2,  0.25, 0.3,  0,    0,    0   ],
  [0.08, 0.1,  0.12, 0.2,  0.22, 0.28, 0,    0   ],
  [0.05, 0.08, 0.1,  0.15, 0.18, 0.2,  0.24, 0   ],
  [0.04, 0.06, 0.08, 0.12, 0.15, 0.18, 0.17, 0.2 ],
];

const VB_W = 800, VB_H = 320;
const TOKEN_W = 80, TOKEN_H = 34;
const KV_W = 56, KV_H = 26;
const GAP = 15;
const N = TOKENS.length;
const SPACING = (VB_W - 40) / N;
const START_X = 20 + SPACING / 2;
const TOKEN_Y = 50;
const KV_Y = TOKEN_Y + TOKEN_H + GAP;

function tokenCenterX(i) { return START_X + i * SPACING; }

export function init(container) {
  const svg = createSVG(container, VB_W, VB_H);
  addArrowMarker(svg, 'arrow-forward', COLORS.forward, 6);
  addArrowMarker(svg, 'arrow-gradient', COLORS.gradient, 6);

  let selectedToken = 5;
  let mode = 'Forward';
  let showAllActive = false;

  // --- Draw token and KV blocks ---
  const tokenRects = [];
  const kvRects = [];
  const tokenGroup = group(svg, 'tokens');

  TOKENS.forEach((tok, i) => {
    const cx = tokenCenterX(i);

    const tRect = rect(tokenGroup, cx - TOKEN_W / 2, TOKEN_Y, TOKEN_W, TOKEN_H, COLORS.token, {
      rx: 8, className: 'token-block', cursor: 'pointer',
    });
    const tLabel = text(tokenGroup, cx, TOKEN_Y + TOKEN_H / 2, tok, {
      fontSize: 13, fontWeight: '600', fill: '#fff',
    });
    tLabel.style.pointerEvents = 'none';
    tokenRects.push(tRect);

    const kRect = rect(tokenGroup, cx - KV_W / 2, KV_Y, KV_W, KV_H, COLORS.kv, {
      rx: 6, className: 'kv-block',
    });
    const kvLabel = text(tokenGroup, cx, KV_Y + KV_H / 2, 'KV', {
      fontSize: 11, fontWeight: '600', fill: '#fff',
    });
    kvLabel.style.pointerEvents = 'none';
    kvRects.push(kRect);

    tRect.addEventListener('click', () => {
      selectedToken = i;
      showAllActive = false;
      render();
    });
  });

  // Arrow layer sits above tokens so arrows render on top
  const arrowGroup = group(svg, 'arrows');

  // --- Highlight selected token ---
  function updateHighlight() {
    tokenRects.forEach((r, i) => {
      if (i === selectedToken && !showAllActive) {
        r.setAttribute('stroke', COLORS.highlight);
        r.setAttribute('stroke-width', '3');
      } else {
        r.removeAttribute('stroke');
        r.removeAttribute('stroke-width');
      }
    });
  }

  // --- Draw forward arrows: from earlier KVs up to the selected token ---
  function drawForwardArrows() {
    const targetX = tokenCenterX(selectedToken);
    const targetY = TOKEN_Y + TOKEN_H;
    const weights = ATTENTION[selectedToken];

    for (let i = 0; i < selectedToken; i++) {
      const srcX = tokenCenterX(i);
      const srcY = KV_Y;
      const opacity = Math.max(weights[i], 0.08);

      const arrow = curvedArrow(arrowGroup, srcX, srcY, targetX, targetY, {
        direction: 'up',
        curvature: 0.35,
        stroke: COLORS.forward,
        strokeWidth: 1 + weights[i] * 3,
        opacity,
        markerEnd: 'url(#arrow-forward)',
        className: 'forward-arrow',
      });
      animateArrowIn(arrow);
    }
  }

  // --- Draw backward arrows: from selected token's loss down to earlier KVs ---
  function drawBackwardArrows() {
    const srcX = tokenCenterX(selectedToken);
    const srcY = TOKEN_Y + TOKEN_H;
    const weights = ATTENTION[selectedToken];

    for (let i = 0; i < selectedToken; i++) {
      const destX = tokenCenterX(i);
      const destY = KV_Y;
      const opacity = Math.max(weights[i], 0.08);

      const arrow = curvedArrow(arrowGroup, srcX, srcY, destX, destY, {
        direction: 'down',
        curvature: 0.35,
        stroke: COLORS.gradient,
        strokeWidth: 1 + weights[i] * 3,
        opacity,
        markerEnd: 'url(#arrow-gradient)',
        className: 'gradient-arrow',
      });
      animateArrowIn(arrow, i * 60);
    }
  }

  // --- Show All: gradient accumulation across all future tokens ---
  function drawShowAll() {
    // For each KV position, count how many future tokens send gradient to it
    const accumulation = new Array(N).fill(0);
    for (let future = 1; future < N; future++) {
      for (let kv = 0; kv < future; kv++) {
        accumulation[kv] += ATTENTION[future][kv];
      }
    }

    const maxAccum = Math.max(...accumulation);

    // Draw all backward arrows (faintly) and color KV blocks by accumulation
    for (let future = 1; future < N; future++) {
      const srcX = tokenCenterX(future);
      const srcY = TOKEN_Y + TOKEN_H;

      for (let kv = 0; kv < future; kv++) {
        const destX = tokenCenterX(kv);
        const destY = KV_Y;
        const w = ATTENTION[future][kv];

        curvedArrow(arrowGroup, srcX, srcY, destX, destY, {
          direction: 'down',
          curvature: 0.35,
          stroke: COLORS.gradient,
          strokeWidth: 0.8,
          opacity: w * 0.3,
          className: 'gradient-arrow',
        });
      }
    }

    // Color KV blocks by gradient accumulation intensity
    kvRects.forEach((r, i) => {
      const intensity = accumulation[i] / maxAccum;
      r.setAttribute('fill', interpolateColor(COLORS.kv, COLORS.gradient, intensity));
      r.setAttribute('opacity', 0.4 + intensity * 0.6);
    });
  }

  function resetKvBlocks() {
    kvRects.forEach((r) => {
      r.setAttribute('fill', COLORS.kv);
      r.setAttribute('opacity', '1');
    });
  }

  // --- Animate arrow draw-in via stroke-dashoffset ---
  function animateArrowIn(arrowEl, delay = 0) {
    const length = arrowEl.getTotalLength();
    arrowEl.setAttribute('stroke-dasharray', length);
    arrowEl.setAttribute('stroke-dashoffset', length);

    const startTime = performance.now() + delay;
    function tick(now) {
      const elapsed = now - startTime;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const t = Math.min(elapsed / 400, 1);
      arrowEl.setAttribute('stroke-dashoffset', length * (1 - easeOutCubic(t)));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // --- Render ---
  function render() {
    // Clear arrows
    while (arrowGroup.firstChild) arrowGroup.removeChild(arrowGroup.firstChild);
    resetKvBlocks();
    updateHighlight();
    updateShowAllVisibility();

    if (showAllActive) {
      drawShowAll();
    } else if (mode === 'Forward') {
      drawForwardArrows();
    } else {
      drawBackwardArrows();
    }
  }

  // --- Controls ---
  const controls = document.createElement('div');
  controls.className = 'demo-controls';
  container.appendChild(controls);

  const toggle = createToggle(controls, 'Forward', 'Backward', (newMode) => {
    mode = newMode;
    showAllActive = false;
    render();
  });

  const showAllBtn = createButton(controls, 'Show All Gradients', () => {
    showAllActive = !showAllActive;
    render();
  });
  showAllBtn.classList.add('show-all-btn');

  function updateShowAllVisibility() {
    showAllBtn.style.display = mode === 'Backward' ? '' : 'none';
    showAllBtn.textContent = showAllActive ? 'Single Token' : 'Show All Gradients';
  }

  // Initial render
  render();
}

// Blend between two hex colors by t (0..1)
function interpolateColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}
