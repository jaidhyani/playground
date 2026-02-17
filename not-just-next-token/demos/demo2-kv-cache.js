import {
  SVG_NS, createSVG, rect, text, path, group, addArrowMarker,
  createButton, animate, easeOutCubic, COLORS, lerp,
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

const KV_TAB_W = 30, KV_TAB_GAP = 5;

function tokenX(i, total) {
  const totalWidth = total * TOKEN_W + (total - 1) * TOKEN_GAP;
  const startX = (VB_W - totalWidth) / 2;
  return startX + i * (TOKEN_W + TOKEN_GAP);
}

export function init(container) {
  const svg = createSVG(container, VB_W, VB_H);
  addArrowMarker(svg, 'arrow-input', COLORS.forward, 6);
  addArrowMarker(svg, 'arrow-output', COLORS.pred, 7);
  addArrowMarker(svg, 'arrow-kv', COLORS.kvGreen, 6);

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

    const tokenEls = [];
    for (let i = 0; i < revealedCount; i++) {
      const x = tokenX(i, revealedCount);
      const r = rect(tokenGroup, x, TOKEN_ROW_Y, TOKEN_W, TOKEN_H, COLORS.token, {
        rx: TOKEN_RX, stroke: COLORS.token, strokeWidth: 1.5, className: 'token-block',
      });
      const t = text(tokenGroup, x + TOKEN_W / 2, TOKEN_ROW_Y + TOKEN_H / 2, TOKENS[i], {
        fontSize: 12, fontWeight: '600', fill: '#ffffff',
      });
      tokenEls.push({ rect: r, text: t });
    }

    const kvSliceEls = [];
    let kvLabelEl = null;
    for (let i = 0; i < revealedCount - 1; i++) {
      const x = tokenX(i, revealedCount);
      const slices = [];
      for (let s = 0; s < LAYER_COUNT; s++) {
        const sy = KV_ZONE_TOP + s * (KV_SLICE_H + KV_SLICE_GAP);
        const r = rect(kvGroup, x, sy, TOKEN_W, KV_SLICE_H, COLORS.kvGreenLight, {
          rx: 2, stroke: COLORS.kvGreen, strokeWidth: 1, className: 'kv-slice',
        });
        slices.push(r);
      }
      if (i === 0) {
        kvLabelEl = text(kvGroup, x - 4, KV_ZONE_TOP + KV_SLICE_H / 2, 'KV', {
          fontSize: 9, fill: COLORS.kvGreen, anchor: 'end', fontWeight: '600',
        });
      }
      kvSliceEls.push(slices);
    }

    return { tokenEls, kvSliceEls, kvLabelEl };
  }

  function step() {
    if (revealedCount >= TOKENS.length || animating) return;
    animating = true;
    const { tokenEls, kvSliceEls, kvLabelEl } = render();

    const currentIdx = revealedCount - 1;
    const nextToken = TOKENS[revealedCount];
    const modelTopY = MODEL_Y;
    const modelBottomY = MODEL_Y + MODEL_H;
    const modelCenterX = VB_W / 2;

    // --- Phase 1: Input arrows fade in ---
    const phase1Els = [];

    // Gray arrow from current token to model center
    const tx = tokenX(currentIdx, revealedCount) + TOKEN_W / 2;
    const ty = TOKEN_ROW_Y + TOKEN_H;
    const cpTokenY = (ty + modelTopY) / 2 - 5;
    const tokenArrowD = `M ${tx} ${ty} Q ${(tx + modelCenterX) / 2} ${cpTokenY} ${modelCenterX} ${modelTopY}`;
    const tokenArrow = path(arrowGroup, tokenArrowD, {
      stroke: COLORS.forward, strokeWidth: 1.5,
      markerEnd: 'url(#arrow-input)', opacity: 0,
      className: 'input-arrow',
    });
    phase1Els.push({ el: tokenArrow, maxOpacity: 0.7 });

    // KV selection box + right-angle arrow (step 2+ only)
    if (currentIdx > 0) {
      const boxPad = 4;
      const firstKvX = tokenX(0, revealedCount);
      const lastKvX = tokenX(currentIdx - 1, revealedCount) + TOKEN_W;
      const kvBottom = KV_ZONE_TOP + (LAYER_COUNT - 1) * (KV_SLICE_H + KV_SLICE_GAP) + KV_SLICE_H;

      const boxX = firstKvX - boxPad;
      const boxY = KV_ZONE_TOP - boxPad;
      const boxW = lastKvX - firstKvX + boxPad * 2;
      const boxH = kvBottom - KV_ZONE_TOP + boxPad * 2;

      const selBox = rect(arrowGroup, boxX, boxY, boxW, boxH, 'none', {
        rx: 4, stroke: COLORS.kvGreen, strokeWidth: 2, opacity: 0,
        className: 'kv-selection-box',
      });
      selBox.setAttribute('stroke-dasharray', '6 3');
      phase1Els.push({ el: selBox, maxOpacity: 0.8 });

      // Right-angle path: box center-bottom → down → horizontal to model center → down into model
      const boxCenterX = boxX + boxW / 2;
      const boxBottomY = boxY + boxH;
      const midY = (boxBottomY + modelTopY) / 2;
      const kvArrowD = `M ${boxCenterX} ${boxBottomY} L ${boxCenterX} ${midY} L ${modelCenterX} ${midY} L ${modelCenterX} ${modelTopY}`;
      const kvArrow = path(arrowGroup, kvArrowD, {
        stroke: COLORS.kvGreen, strokeWidth: 2,
        markerEnd: 'url(#arrow-kv)', opacity: 0,
        className: 'kv-arrow',
      });
      phase1Els.push({ el: kvArrow, maxOpacity: 0.6 });
    }

    activeCancellers.push(animate(ANIM_MS, (t) => {
      const e = easeOutCubic(t);
      phase1Els.forEach(({ el, maxOpacity }) => el.setAttribute('opacity', String(e * maxOpacity)));

      if (t < 1) return;

      // --- Phase 2: Layers light up sequentially ---
      let layerIdx = 0;
      const layerInterval = setInterval(() => {
        if (layerIdx < LAYER_COUNT) {
          layerRects[layerIdx].setAttribute('fill', '#c7d2fe');
          layerIdx++;
          return;
        }
        clearInterval(layerInterval);

        // --- Phase 3a: KV output tabs emerge from model layers ---
        const kvOutputEls = [];
        for (let s = 0; s < LAYER_COUNT; s++) {
          const layerCenterY = layersStartY + s * (LAYER_H + LAYER_GAP) + LAYER_H / 2;
          const tabStartX = MODEL_X + MODEL_W + KV_TAB_GAP;
          const tabStartY = layerCenterY - KV_SLICE_H / 2;

          const tabLine = path(arrowGroup,
            `M ${MODEL_X + MODEL_W} ${layerCenterY} L ${tabStartX} ${layerCenterY}`, {
              stroke: COLORS.kvGreen, strokeWidth: 1.5, opacity: 0,
            });
          const tab = rect(kvGroup, tabStartX, tabStartY, KV_TAB_W, KV_SLICE_H, COLORS.kvGreenLight, {
            rx: 2, stroke: COLORS.kvGreen, strokeWidth: 1, opacity: 0, className: 'kv-slice',
          });
          kvOutputEls.push({ tab, tabLine, startX: tabStartX, startY: tabStartY, delay: s * 50 });
        }

        let newKvLabel = null;
        if (currentIdx === 0) {
          const labelX = tokenX(0, revealedCount) - 4;
          newKvLabel = text(kvGroup, labelX, KV_ZONE_TOP + KV_SLICE_H / 2, 'KV', {
            fontSize: 9, fill: COLORS.kvGreen, anchor: 'end', fontWeight: '600',
          });
          newKvLabel.setAttribute('opacity', '0');
        }

        const staggerTotal = (LAYER_COUNT - 1) * 50;
        activeCancellers.push(animate(ANIM_MS + staggerTotal, (t2) => {
          const elapsed = t2 * (ANIM_MS + staggerTotal);

          kvOutputEls.forEach(({ tab, tabLine, delay }) => {
            const progress = Math.max(0, Math.min(1, (elapsed - delay) / ANIM_MS));
            const e2 = easeOutCubic(progress);
            tab.setAttribute('opacity', String(e2));
            tabLine.setAttribute('opacity', String(e2 * 0.7));
          });

          if (t2 < 1) return;

          // --- Phase 3b: KV tabs fly up to position + prediction emerges ---
          const finalKvX = tokenX(currentIdx, revealedCount);

          const predX = tokenX(revealedCount, revealedCount + 1);
          const predCenterX = predX + TOKEN_W / 2;
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

          activeCancellers.push(animate(ANIM_MS, (t3) => {
            const e3 = easeOutCubic(t3);

            // KV tabs fly from model side to final position, expanding to full width
            kvOutputEls.forEach(({ tab, tabLine, startX, startY }, s) => {
              const finalY = KV_ZONE_TOP + s * (KV_SLICE_H + KV_SLICE_GAP);
              tab.setAttribute('x', String(lerp(startX, finalKvX, e3)));
              tab.setAttribute('y', String(lerp(startY, finalY, e3)));
              tab.setAttribute('width', String(lerp(KV_TAB_W, TOKEN_W, e3)));
              tabLine.setAttribute('opacity', String(0.7 * (1 - e3)));
            });

            if (newKvLabel) newKvLabel.setAttribute('opacity', String(e3));

            outArrow.setAttribute('opacity', String(e3));
            predRect.setAttribute('opacity', String(e3));
            predText.setAttribute('opacity', String(e3));

            if (t3 < 1) return;

            // --- Phase 4: Prediction slides up, tokens shift, arrows fade ---
            activeCancellers.push(animate(ANIM_MS, (t4) => {
              const e4 = easeOutCubic(t4);

              // Prediction slides up
              const predY = PRED_Y + (TOKEN_ROW_Y - PRED_Y) * e4;
              predRect.setAttribute('y', String(predY));
              predText.setAttribute('y', String(predY + TOKEN_H / 2));

              // Existing tokens shift to accommodate the new token
              tokenEls.forEach(({ rect: r, text: t }, i) => {
                const curX = lerp(tokenX(i, revealedCount), tokenX(i, revealedCount + 1), e4);
                r.setAttribute('x', String(curX));
                t.setAttribute('x', String(curX + TOKEN_W / 2));
              });

              // Existing KV stacks shift with their tokens
              kvSliceEls.forEach((slices, i) => {
                const curX = lerp(tokenX(i, revealedCount), tokenX(i, revealedCount + 1), e4);
                slices.forEach(slice => slice.setAttribute('x', String(curX)));
              });

              // New KV stack (just placed for currentIdx) also shifts
              const newKvCurX = lerp(tokenX(currentIdx, revealedCount), tokenX(currentIdx, revealedCount + 1), e4);
              kvOutputEls.forEach(({ tab }) => tab.setAttribute('x', String(newKvCurX)));

              // KV label shifts
              if (kvLabelEl) {
                kvLabelEl.setAttribute('x', String(lerp(tokenX(0, revealedCount) - 4, tokenX(0, revealedCount + 1) - 4, e4)));
              }
              if (newKvLabel) {
                newKvLabel.setAttribute('x', String(lerp(tokenX(0, revealedCount) - 4, tokenX(0, revealedCount + 1) - 4, e4)));
              }

              // Arrows fade out
              phase1Els.forEach(({ el, maxOpacity }) =>
                el.setAttribute('opacity', String(maxOpacity * (1 - e4)))
              );
              outArrow.setAttribute('opacity', String(1 - e4));

              if (t4 < 1) return;

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
