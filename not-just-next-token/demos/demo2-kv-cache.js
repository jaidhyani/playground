import {
  SVG_NS, createSVG, rect, text, path, group, addArrowMarker,
  createButton, animate, easeOutCubic, COLORS,
} from './shared.js';

const TOKENS = ['The', 'cat', 'sat', 'on', 'the', 'warm', 'sunny', 'windowsill'];

const VB_W = 800, VB_H = 520;
const TOKEN_W = 80, TOKEN_H = 34, TOKEN_GAP = 5, TOKEN_RX = 6;
const TOKEN_ROW_Y = 30;

const KV_SLICE_H = 10, KV_SLICE_GAP = 2;
const KV_ZONE_TOP = TOKEN_ROW_Y + TOKEN_H + 8;
const LAYER_COUNT = 4;

const MODEL_W = 200, MODEL_H = 100, MODEL_RX = 10;
const MODEL_X = (VB_W - MODEL_W) / 2;
const MODEL_Y = KV_ZONE_TOP + LAYER_COUNT * (KV_SLICE_H + KV_SLICE_GAP) + 50;
const LAYER_H = 14, LAYER_GAP = 5;

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
  addArrowMarker(svg, 'arrow-kv', COLORS.kv, 6);

  const tokenGroup = group(svg, 'token-row');
  const kvGroup = group(svg, 'kv-layer');
  const arrowGroup = group(svg, 'arrow-layer');
  const modelGroup = group(svg, 'model-layer');
  const predGroup = group(svg, 'prediction-layer');

  // Model box
  rect(modelGroup, MODEL_X, MODEL_Y, MODEL_W, MODEL_H, '#f8fafc', {
    rx: MODEL_RX, stroke: COLORS.token, strokeWidth: 2, className: 'model-box',
  });
  text(modelGroup, VB_W / 2, MODEL_Y + 14, 'LLM', {
    fontSize: 11, fontWeight: '700', fill: COLORS.textLight,
  });

  // Internal layers
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

  // Label below prediction zone
  text(svg, VB_W / 2, PRED_Y + TOKEN_H + 14, 'next-token prediction', {
    fontSize: 11, fill: COLORS.textLight, fontWeight: '500',
  });

  let revealedCount = 1;
  let playing = false;
  let playTimer = null;
  let animating = false;
  let activeCancellers = [];

  function render() {
    while (arrowGroup.firstChild) arrowGroup.removeChild(arrowGroup.firstChild);
    while (predGroup.firstChild) predGroup.removeChild(predGroup.firstChild);
    while (tokenGroup.firstChild) tokenGroup.removeChild(tokenGroup.firstChild);
    while (kvGroup.firstChild) kvGroup.removeChild(kvGroup.firstChild);

    layerRects.forEach((r, i) => {
      r.setAttribute('fill', i === LAYER_COUNT - 1 ? '#e0e7ff' : '#f1f5f9');
    });

    // Draw revealed tokens
    for (let i = 0; i < revealedCount; i++) {
      const x = tokenX(i, revealedCount);
      rect(tokenGroup, x, TOKEN_ROW_Y, TOKEN_W, TOKEN_H, COLORS.token, {
        rx: TOKEN_RX, stroke: COLORS.token, strokeWidth: 1.5, className: 'token-block',
      });
      text(tokenGroup, x + TOKEN_W / 2, TOKEN_ROW_Y + TOKEN_H / 2, TOKENS[i], {
        fontSize: 12, fontWeight: '600', fill: '#ffffff',
      });
    }

    // Draw KV slices for all processed tokens (all except the last revealed)
    for (let i = 0; i < revealedCount - 1; i++) {
      const x = tokenX(i, revealedCount);
      for (let s = 0; s < LAYER_COUNT; s++) {
        const sy = KV_ZONE_TOP + s * (KV_SLICE_H + KV_SLICE_GAP);
        rect(kvGroup, x, sy, TOKEN_W, KV_SLICE_H, COLORS.kvLight, {
          rx: 2, stroke: COLORS.kv, strokeWidth: 1, className: 'kv-slice',
        });
      }
      if (i === 0) {
        text(kvGroup, x - 4, KV_ZONE_TOP + KV_SLICE_H / 2, 'KV', {
          fontSize: 9, fill: COLORS.kv, anchor: 'end', fontWeight: '600',
        });
      }
    }
  }

  function step() {
    if (revealedCount >= TOKENS.length || animating) return;
    animating = true;
    render();

    const currentIdx = revealedCount - 1;
    const nextToken = TOKENS[revealedCount];
    const modelTopY = MODEL_Y;
    const modelBottomY = MODEL_Y + MODEL_H;
    const modelCenterX = VB_W / 2;

    // Phase 1: Input arrows fade in
    const inputArrows = [];

    // Gray arrow from current token → model center
    const tx = tokenX(currentIdx, revealedCount) + TOKEN_W / 2;
    const ty = TOKEN_ROW_Y + TOKEN_H;
    const cpTokenY = (ty + modelTopY) / 2 - 5;
    const tokenArrowD = `M ${tx} ${ty} Q ${(tx + modelCenterX) / 2} ${cpTokenY} ${modelCenterX} ${modelTopY}`;
    const tokenArrow = path(arrowGroup, tokenArrowD, {
      stroke: COLORS.forward, strokeWidth: 1.5,
      markerEnd: 'url(#arrow-input)', opacity: 0,
      className: 'input-arrow',
    });
    inputArrows.push({ el: tokenArrow, maxOpacity: 0.7 });

    // Indigo arrows from each previous token's KV stack → model
    for (let i = 0; i < currentIdx; i++) {
      const kvX = tokenX(i, revealedCount) + TOKEN_W / 2;
      const kvBottomY = KV_ZONE_TOP + LAYER_COUNT * (KV_SLICE_H + KV_SLICE_GAP);
      const targetX = MODEL_X + 15 + (MODEL_W - 30) * ((i + 0.5) / currentIdx);
      const clampedX = Math.max(MODEL_X + 10, Math.min(MODEL_X + MODEL_W - 10, targetX));
      const cpKvY = (kvBottomY + modelTopY) / 2 - 5;
      const kvArrowD = `M ${kvX} ${kvBottomY} Q ${(kvX + clampedX) / 2} ${cpKvY} ${clampedX} ${modelTopY}`;
      const kvArrow = path(arrowGroup, kvArrowD, {
        stroke: COLORS.kv, strokeWidth: 1.5,
        markerEnd: 'url(#arrow-kv)', opacity: 0,
        className: 'kv-arrow',
      });
      inputArrows.push({ el: kvArrow, maxOpacity: 0.5 });
    }

    activeCancellers.push(animate(ANIM_MS, (t) => {
      const e = easeOutCubic(t);
      inputArrows.forEach(({ el, maxOpacity }) => el.setAttribute('opacity', String(e * maxOpacity)));

      if (t < 1) return;

      // Phase 2: Layers light up sequentially
      let layerIdx = 0;
      const layerInterval = setInterval(() => {
        if (layerIdx < LAYER_COUNT) {
          layerRects[layerIdx].setAttribute('fill', '#c7d2fe');
          layerIdx++;
          return;
        }
        clearInterval(layerInterval);

        // Phase 3: KV slices + prediction emerge simultaneously
        const kvSliceEls = [];
        for (let s = 0; s < LAYER_COUNT; s++) {
          const sx = tokenX(currentIdx, revealedCount);
          const sy = KV_ZONE_TOP + s * (KV_SLICE_H + KV_SLICE_GAP);
          const slice = rect(kvGroup, sx, sy, TOKEN_W, KV_SLICE_H, COLORS.kvLight, {
            rx: 2, stroke: COLORS.kv, strokeWidth: 1, className: 'kv-slice',
          });
          slice.setAttribute('opacity', '0');
          kvSliceEls.push({ el: slice, delay: s * 50 });
        }

        // "KV" label only on first token's first step
        let kvLabel = null;
        if (currentIdx === 0) {
          const sx = tokenX(0, revealedCount);
          kvLabel = text(kvGroup, sx - 4, KV_ZONE_TOP + KV_SLICE_H / 2, 'KV', {
            fontSize: 9, fill: COLORS.kv, anchor: 'end', fontWeight: '600',
          });
          kvLabel.setAttribute('opacity', '0');
        }

        // Prediction token
        const predX = tokenX(revealedCount, revealedCount + 1);
        const predCenterX = predX + TOKEN_W / 2;

        // Output arrow: model → prediction
        const cpOutY = (modelBottomY + PRED_Y) / 2;
        const outArrowD = `M ${modelCenterX} ${modelBottomY} Q ${(modelCenterX + predCenterX) / 2} ${cpOutY} ${predCenterX} ${PRED_Y}`;
        const outArrow = path(arrowGroup, outArrowD, {
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

        const staggerTotal = (LAYER_COUNT - 1) * 50;
        activeCancellers.push(animate(ANIM_MS + staggerTotal, (t2) => {
          const elapsed = t2 * (ANIM_MS + staggerTotal);

          // KV slices with stagger
          kvSliceEls.forEach(({ el, delay }) => {
            const sliceProgress = Math.max(0, Math.min(1, (elapsed - delay) / ANIM_MS));
            el.setAttribute('opacity', String(easeOutCubic(sliceProgress)));
          });

          if (kvLabel) {
            const labelProgress = Math.min(1, elapsed / ANIM_MS);
            kvLabel.setAttribute('opacity', String(easeOutCubic(labelProgress)));
          }

          // Prediction fades in (no stagger delay)
          const predProgress = Math.min(1, elapsed / ANIM_MS);
          const predE = easeOutCubic(predProgress);
          outArrow.setAttribute('opacity', String(predE));
          predRect.setAttribute('opacity', String(predE));
          predText.setAttribute('opacity', String(predE));

          if (t2 < 1) return;

          // Phase 4: Prediction slides up, arrows fade out
          activeCancellers.push(animate(ANIM_MS, (t3) => {
            const e3 = easeOutCubic(t3);
            const y = PRED_Y + (TOKEN_ROW_Y - PRED_Y) * e3;
            predRect.setAttribute('y', String(y));
            predText.setAttribute('y', String(y + TOKEN_H / 2));

            inputArrows.forEach(({ el, maxOpacity }) =>
              el.setAttribute('opacity', String(maxOpacity * (1 - e3)))
            );
            outArrow.setAttribute('opacity', String(1 - e3));

            if (t3 < 1) return;

            revealedCount++;
            animating = false;
            render();
            if (playing && revealedCount < TOKENS.length) {
              playTimer = setTimeout(step, 400);
            } else {
              playing = false;
              updateButtons();
            }
          }));
        }));
      }, 80);
      activeCancellers.push(() => clearInterval(layerInterval));
    }));
  }

  function reset() {
    activeCancellers.forEach(cancel => cancel());
    activeCancellers = [];
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
