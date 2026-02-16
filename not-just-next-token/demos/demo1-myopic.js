import {
  SVG_NS, createSVG, rect, text, path, group, addArrowMarker,
  createButton, animate, easeOutCubic, COLORS,
} from './shared.js';

const TOKENS = ['The', 'cat', 'sat', 'on', 'the', 'warm', 'sunny', 'windowsill'];

const VB_W = 800, VB_H = 400;
const TOKEN_W = 80, TOKEN_H = 34, TOKEN_GAP = 5, TOKEN_RX = 6;
const TOKEN_ROW_Y = 30;

// The model box
const MODEL_W = 200, MODEL_H = 100, MODEL_RX = 10;
const MODEL_X = (VB_W - MODEL_W) / 2;
const MODEL_Y = 140;
const LAYER_COUNT = 4;
const LAYER_H = 14;
const LAYER_GAP = 5;

// Prediction zone below the model
const PRED_Y = MODEL_Y + MODEL_H + 50;

const ANIM_MS = 350;

function tokenX(i, total) {
  const totalWidth = total * TOKEN_W + (total - 1) * TOKEN_GAP;
  const startX = (VB_W - totalWidth) / 2;
  return startX + i * (TOKEN_W + TOKEN_GAP);
}

export function init(container) {
  const svg = createSVG(container, VB_W, VB_H);
  addArrowMarker(svg, 'arrow-input', COLORS.forward, 6);
  addArrowMarker(svg, 'arrow-output', COLORS.pred, 7);

  const tokenGroup = group(svg, 'token-row');
  const arrowGroup = group(svg, 'arrow-layer');
  const modelGroup = group(svg, 'model-layer');
  const predGroup = group(svg, 'prediction-layer');

  // Draw the model box
  rect(modelGroup, MODEL_X, MODEL_Y, MODEL_W, MODEL_H, '#f8fafc', {
    rx: MODEL_RX, stroke: COLORS.token, strokeWidth: 2, className: 'model-box',
  });
  text(modelGroup, VB_W / 2, MODEL_Y + 14, 'LLM', {
    fontSize: 11, fontWeight: '700', fill: COLORS.textLight,
  });

  // Draw internal layers
  const layerRects = [];
  const layersStartY = MODEL_Y + 28;
  const layerW = MODEL_W - 30;
  const layerX = MODEL_X + 15;
  for (let i = 0; i < LAYER_COUNT; i++) {
    const y = layersStartY + i * (LAYER_H + LAYER_GAP);
    const layerColor = i === LAYER_COUNT - 1 ? '#e0e7ff' : '#f1f5f9';
    const r = rect(modelGroup, layerX, y, layerW, LAYER_H, layerColor, {
      rx: 3, stroke: '#cbd5e1', strokeWidth: 1,
    });
    layerRects.push(r);
  }

  // "next-token prediction" label
  text(svg, VB_W / 2, PRED_Y + TOKEN_H + 14, 'next-token prediction', {
    fontSize: 11, fill: COLORS.textLight, fontWeight: '500',
  });

  let revealedCount = 1;
  let playing = false;
  let playTimer = null;
  let animating = false;

  const tokenRects = [];
  const tokenTexts = [];

  TOKENS.forEach((tok, i) => {
    const x = tokenX(i, TOKENS.length);
    const r = rect(tokenGroup, x, TOKEN_ROW_Y, TOKEN_W, TOKEN_H, COLORS.bgAlt, {
      rx: TOKEN_RX, stroke: COLORS.tokenBorder, strokeWidth: 1.5, className: 'token-block',
    });
    const t = text(tokenGroup, x + TOKEN_W / 2, TOKEN_ROW_Y + TOKEN_H / 2, tok, {
      fontSize: 12, fontWeight: '500', fill: COLORS.textLight,
    });
    tokenRects.push(r);
    tokenTexts.push(t);
  });

  function render() {
    while (arrowGroup.firstChild) arrowGroup.removeChild(arrowGroup.firstChild);
    while (predGroup.firstChild) predGroup.removeChild(predGroup.firstChild);

    // Reset layer colors
    layerRects.forEach((r, i) => {
      r.setAttribute('fill', i === LAYER_COUNT - 1 ? '#e0e7ff' : '#f1f5f9');
    });

    TOKENS.forEach((_, i) => {
      const inContext = i < revealedCount;
      tokenRects[i].setAttribute('fill', inContext ? COLORS.token : COLORS.bgAlt);
      tokenRects[i].setAttribute('stroke', inContext ? COLORS.token : COLORS.tokenBorder);
      tokenTexts[i].setAttribute('fill', inContext ? '#ffffff' : COLORS.textLight);
      tokenTexts[i].setAttribute('font-weight', inContext ? '600' : '500');
    });
  }

  function step() {
    if (revealedCount >= TOKENS.length || animating) return;
    animating = true;
    render();

    const nextIdx = revealedCount;
    const nextToken = TOKENS[nextIdx];
    const modelCenterX = VB_W / 2;
    const modelTopY = MODEL_Y;
    const modelBottomY = MODEL_Y + MODEL_H;

    // Phase 1: arrows from ALL context tokens into the model
    const inputArrows = [];
    for (let i = 0; i < revealedCount; i++) {
      const tx = tokenX(i, TOKENS.length) + TOKEN_W / 2;
      const ty = TOKEN_ROW_Y + TOKEN_H;
      const targetX = MODEL_X + 15 + (MODEL_W - 30) * ((i + 0.5) / revealedCount);
      const clampedX = Math.max(MODEL_X + 10, Math.min(MODEL_X + MODEL_W - 10, targetX));
      const cpY = (ty + modelTopY) / 2 - 5;
      const d = `M ${tx} ${ty} Q ${(tx + clampedX) / 2} ${cpY} ${clampedX} ${modelTopY}`;
      const arrow = path(arrowGroup, d, {
        stroke: COLORS.forward, strokeWidth: 1.5,
        markerEnd: 'url(#arrow-input)', opacity: 0,
        className: 'input-arrow',
      });
      inputArrows.push(arrow);
    }

    animate(ANIM_MS, (t) => {
      const e = easeOutCubic(t);
      inputArrows.forEach(a => a.setAttribute('opacity', String(e * 0.7)));

      if (t >= 1) {
        // Phase 2: layers light up sequentially
        let layerIdx = 0;
        const layerInterval = setInterval(() => {
          if (layerIdx < LAYER_COUNT) {
            layerRects[layerIdx].setAttribute('fill', '#c7d2fe');
            layerIdx++;
          } else {
            clearInterval(layerInterval);

            // Phase 3: output arrow + prediction
            const predX = tokenX(nextIdx, TOKENS.length);
            const predCenterX = predX + TOKEN_W / 2;
            const cpY = (modelBottomY + PRED_Y) / 2;
            const d = `M ${modelCenterX} ${modelBottomY} Q ${(modelCenterX + predCenterX) / 2} ${cpY} ${predCenterX} ${PRED_Y}`;
            const outArrow = path(arrowGroup, d, {
              stroke: COLORS.pred, strokeWidth: 2,
              markerEnd: 'url(#arrow-output)', opacity: 0,
            });

            const predRect = rect(predGroup, predX, PRED_Y, TOKEN_W, TOKEN_H, COLORS.predLight, {
              rx: TOKEN_RX, stroke: COLORS.pred, strokeWidth: 2, className: 'prediction-token',
            });
            const predText = text(predGroup, predCenterX, PRED_Y + TOKEN_H / 2, nextToken, {
              fontSize: 12, fontWeight: '700', fill: COLORS.pred,
            });
            predRect.setAttribute('opacity', '0');
            predText.setAttribute('opacity', '0');

            animate(ANIM_MS, (t2) => {
              const e2 = easeOutCubic(t2);
              outArrow.setAttribute('opacity', String(e2));
              predRect.setAttribute('opacity', String(e2));
              predText.setAttribute('opacity', String(e2));

              if (t2 >= 1) {
                // Phase 4: prediction slides up into the token row
                animate(ANIM_MS, (t3) => {
                  const e3 = easeOutCubic(t3);
                  const y = PRED_Y + (TOKEN_ROW_Y - PRED_Y) * e3;
                  predRect.setAttribute('y', String(y));
                  predText.setAttribute('y', String(y + TOKEN_H / 2));
                  // Fade out arrows
                  inputArrows.forEach(a => a.setAttribute('opacity', String(0.7 * (1 - e3))));
                  outArrow.setAttribute('opacity', String(1 - e3));

                  if (t3 >= 1) {
                    revealedCount++;
                    animating = false;
                    render();
                    if (playing && revealedCount < TOKENS.length) {
                      playTimer = setTimeout(step, 400);
                    } else {
                      playing = false;
                      updateButtons();
                    }
                  }
                });
              }
            });
          }
        }, 80);
      }
    });
  }

  function reset() {
    playing = false;
    animating = false;
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

  const controls = document.createElement('div');
  controls.className = 'demo-controls';
  container.appendChild(controls);

  const playBtn = createButton(controls, 'Play', togglePlay);
  createButton(controls, 'Step', () => { if (!playing) step(); });
  createButton(controls, 'Reset', reset);

  function updateButtons() {
    playBtn.textContent = playing ? 'Pause' : 'Play';
  }

  render();
}
