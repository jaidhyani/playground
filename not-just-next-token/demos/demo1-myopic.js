import {
  createSVG, rect, text, group, addArrowMarker,
  createButton, animate, easeOutCubic, COLORS,
} from './shared.js';

const TOKENS = ['The', 'cat', 'sat', 'on', 'the', 'warm', 'sunny', 'windowsill'];

const VB_W = 800, VB_H = 280;
const TOKEN_W = 85, TOKEN_H = 40, TOKEN_GAP = 6, TOKEN_RX = 8;
const TOKEN_Y = 40;
const PRED_ZONE_Y = 180;
const ARROW_COLOR = COLORS.pred;
const ANIM_MS = 400;

function tokenX(i, totalTokens) {
  const totalWidth = totalTokens * TOKEN_W + (totalTokens - 1) * TOKEN_GAP;
  const startX = (VB_W - totalWidth) / 2;
  return startX + i * (TOKEN_W + TOKEN_GAP);
}

export function init(container) {
  const svg = createSVG(container, VB_W, VB_H);
  addArrowMarker(svg, 'arrow-myopic', ARROW_COLOR, 7);

  const tokenGroup = group(svg, 'token-row');
  const arrowGroup = group(svg, 'arrow-layer');
  const predGroup = group(svg, 'prediction-layer');

  let revealedCount = 1;
  let playing = false;
  let playTimer = null;

  const tokenRects = [];
  const tokenTexts = [];

  TOKENS.forEach((tok, i) => {
    const x = tokenX(i, TOKENS.length);
    const r = rect(tokenGroup, x, TOKEN_Y, TOKEN_W, TOKEN_H, COLORS.bgAlt, {
      rx: TOKEN_RX, stroke: COLORS.tokenBorder, strokeWidth: 1.5, className: 'token-block',
    });
    const t = text(tokenGroup, x + TOKEN_W / 2, TOKEN_Y + TOKEN_H / 2, tok, {
      fontSize: 13, fontWeight: '500', fill: COLORS.textLight,
    });
    tokenRects.push(r);
    tokenTexts.push(t);
  });

  // "Prediction zone" label
  text(svg, VB_W / 2, PRED_ZONE_Y + 55, 'next-token prediction', {
    fontSize: 11, fill: COLORS.textLight, fontWeight: '500',
  });

  function render() {
    // Clear dynamic elements
    while (arrowGroup.firstChild) arrowGroup.removeChild(arrowGroup.firstChild);
    while (predGroup.firstChild) predGroup.removeChild(predGroup.firstChild);

    TOKENS.forEach((_, i) => {
      const inContext = i < revealedCount;
      tokenRects[i].setAttribute('fill', inContext ? COLORS.token : COLORS.bgAlt);
      tokenRects[i].setAttribute('stroke', inContext ? COLORS.token : COLORS.tokenBorder);
      tokenTexts[i].setAttribute('fill', inContext ? '#ffffff' : COLORS.textLight);
      tokenTexts[i].setAttribute('font-weight', inContext ? '600' : '500');
    });
  }

  function step() {
    if (revealedCount >= TOKENS.length) return;

    render();

    const nextIdx = revealedCount;
    const nextToken = TOKENS[nextIdx];
    const nextX = tokenX(nextIdx, TOKENS.length);
    const contextCenterX = tokenX(revealedCount - 1, TOKENS.length) + TOKEN_W / 2;
    const predCenterX = nextX + TOKEN_W / 2;

    // Arrow from context to prediction zone
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const arrowStartY = TOKEN_Y + TOKEN_H;
    const d = `M ${contextCenterX} ${arrowStartY} L ${predCenterX} ${PRED_ZONE_Y}`;
    arrowPath.setAttribute('d', d);
    arrowPath.setAttribute('fill', 'none');
    arrowPath.setAttribute('stroke', ARROW_COLOR);
    arrowPath.setAttribute('stroke-width', '2');
    arrowPath.setAttribute('marker-end', 'url(#arrow-myopic)');
    arrowPath.setAttribute('opacity', '0');
    arrowGroup.appendChild(arrowPath);

    // Prediction token (in the zone)
    const predRect = rect(predGroup, nextX, PRED_ZONE_Y, TOKEN_W, TOKEN_H, COLORS.predLight, {
      rx: TOKEN_RX, stroke: COLORS.pred, strokeWidth: 2, className: 'prediction-token',
    });
    const predText = text(predGroup, predCenterX, PRED_ZONE_Y + TOKEN_H / 2, nextToken, {
      fontSize: 13, fontWeight: '700', fill: COLORS.pred,
    });
    predRect.setAttribute('opacity', '0');
    predText.setAttribute('opacity', '0');

    // Phase 1: arrow appears
    animate(ANIM_MS, (t) => {
      const e = easeOutCubic(t);
      arrowPath.setAttribute('opacity', String(e));

      if (t >= 1) {
        // Phase 2: prediction fades in
        animate(ANIM_MS, (t2) => {
          const e2 = easeOutCubic(t2);
          predRect.setAttribute('opacity', String(e2));
          predText.setAttribute('opacity', String(e2));

          if (t2 >= 1) {
            // Phase 3: token moves up into position
            const startY = PRED_ZONE_Y;
            const endY = TOKEN_Y;
            animate(ANIM_MS, (t3) => {
              const e3 = easeOutCubic(t3);
              const y = startY + (endY - startY) * e3;
              predRect.setAttribute('y', String(y));
              predText.setAttribute('y', String(y + TOKEN_H / 2));
              arrowPath.setAttribute('opacity', String(1 - e3));

              if (t3 >= 1) {
                revealedCount++;
                render();
                if (playing && revealedCount < TOKENS.length) {
                  playTimer = setTimeout(step, 300);
                } else {
                  playing = false;
                  updateButtons();
                }
              }
            });
          }
        });
      }
    });
  }

  function reset() {
    playing = false;
    clearTimeout(playTimer);
    revealedCount = 1;
    render();
    updateButtons();
  }

  function togglePlay() {
    if (revealedCount >= TOKENS.length) return;
    if (playing) {
      playing = false;
      clearTimeout(playTimer);
    } else {
      playing = true;
      step();
    }
    updateButtons();
  }

  // Controls
  const controls = document.createElement('div');
  controls.className = 'demo-controls';
  container.appendChild(controls);

  const playBtn = createButton(controls, 'Play', togglePlay);
  const stepBtn = createButton(controls, 'Step', () => {
    if (!playing && revealedCount < TOKENS.length) step();
  });
  const resetBtn = createButton(controls, 'Reset', reset);

  function updateButtons() {
    playBtn.textContent = playing ? 'Pause' : 'Play';
  }

  render();
}
