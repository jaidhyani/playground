export const SVG_NS = 'http://www.w3.org/2000/svg';

export const COLORS = {
  token: '#374151',
  tokenBorder: '#d1d5db',
  kv: '#4f46e5',
  kvLight: '#c7d2fe',
  kvGreen: '#16a34a',
  kvGreenLight: '#bbf7d0',
  pred: '#f59e0b',
  predLight: '#fde68a',
  forward: '#9ca3af',
  gradient: '#e11d48',
  gradientLight: '#fecdd3',
  attention: '#3b82f6',
  highlight: '#0d9488',
  bg: '#ffffff',
  bgAlt: '#f9fafb',
  text: '#1f2937',
  textLight: '#6b7280',
};

// --- SVG element creation ---

export function createSVG(container, viewBoxWidth, viewBoxHeight) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  container.appendChild(svg);
  return svg;
}

export function rect(parent, x, y, w, h, fill, opts = {}) {
  const el = document.createElementNS(SVG_NS, 'rect');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  el.setAttribute('fill', fill);
  if (opts.rx) el.setAttribute('rx', opts.rx);
  if (opts.ry) el.setAttribute('ry', opts.ry);
  if (opts.stroke) el.setAttribute('stroke', opts.stroke);
  if (opts.strokeWidth) el.setAttribute('stroke-width', opts.strokeWidth);
  if (opts.className) el.setAttribute('class', opts.className);
  if (opts.opacity != null) el.setAttribute('opacity', opts.opacity);
  if (opts.cursor) el.style.cursor = opts.cursor;
  parent.appendChild(el);
  return el;
}

export function text(parent, x, y, content, opts = {}) {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.textContent = content;
  el.setAttribute('text-anchor', opts.anchor || 'middle');
  el.setAttribute('dominant-baseline', opts.baseline || 'central');
  el.setAttribute('fill', opts.fill || COLORS.text);
  el.setAttribute('font-size', opts.fontSize || '14');
  el.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
  if (opts.fontWeight) el.setAttribute('font-weight', opts.fontWeight);
  if (opts.className) el.setAttribute('class', opts.className);
  if (opts.opacity != null) el.setAttribute('opacity', opts.opacity);
  parent.appendChild(el);
  return el;
}

export function line(parent, x1, y1, x2, y2, opts = {}) {
  const el = document.createElementNS(SVG_NS, 'line');
  el.setAttribute('x1', x1);
  el.setAttribute('y1', y1);
  el.setAttribute('x2', x2);
  el.setAttribute('y2', y2);
  el.setAttribute('stroke', opts.stroke || COLORS.forward);
  el.setAttribute('stroke-width', opts.strokeWidth || 1.5);
  if (opts.className) el.setAttribute('class', opts.className);
  if (opts.opacity != null) el.setAttribute('opacity', opts.opacity);
  parent.appendChild(el);
  return el;
}

export function path(parent, d, opts = {}) {
  const el = document.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', d);
  el.setAttribute('fill', opts.fill || 'none');
  el.setAttribute('stroke', opts.stroke || COLORS.forward);
  el.setAttribute('stroke-width', opts.strokeWidth || 1.5);
  if (opts.className) el.setAttribute('class', opts.className);
  if (opts.opacity != null) el.setAttribute('opacity', opts.opacity);
  if (opts.markerEnd) el.setAttribute('marker-end', opts.markerEnd);
  parent.appendChild(el);
  return el;
}

export function group(parent, className) {
  const el = document.createElementNS(SVG_NS, 'g');
  if (className) el.setAttribute('class', className);
  parent.appendChild(el);
  return el;
}

// Create an arrowhead marker definition
export function addArrowMarker(svg, id, color, size = 8) {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.prepend(defs);
  }
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', size);
  marker.setAttribute('markerHeight', size);
  marker.setAttribute('orient', 'auto-start-reverse');
  const markerPath = document.createElementNS(SVG_NS, 'path');
  markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  markerPath.setAttribute('fill', color);
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  return marker;
}

// Curved arrow between two points (quadratic bezier)
// direction: 'up' curves upward, 'down' curves downward
export function curvedArrow(parent, x1, y1, x2, y2, opts = {}) {
  const direction = opts.direction || 'up';
  const curvature = opts.curvature || 0.3;
  const midX = (x1 + x2) / 2;
  const dist = Math.abs(x2 - x1);
  const curveOffset = dist * curvature * (direction === 'up' ? -1 : 1);
  const midY = (y1 + y2) / 2 + curveOffset;
  const d = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
  return path(parent, d, opts);
}

// --- Animation ---

export function animate(duration, callback) {
  let cancelled = false;
  const start = performance.now();
  function tick(now) {
    if (cancelled) return;
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    callback(t);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return () => { cancelled = true; };
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- DOM helpers for controls ---

export function createToggle(container, labelA, labelB, onChange) {
  const div = document.createElement('div');
  div.className = 'toggle-group';
  const btnA = document.createElement('button');
  btnA.className = 'toggle-btn active';
  btnA.textContent = labelA;
  const btnB = document.createElement('button');
  btnB.className = 'toggle-btn';
  btnB.textContent = labelB;
  btnA.addEventListener('click', () => {
    btnA.classList.add('active');
    btnB.classList.remove('active');
    onChange(labelA);
  });
  btnB.addEventListener('click', () => {
    btnB.classList.add('active');
    btnA.classList.remove('active');
    onChange(labelB);
  });
  div.appendChild(btnA);
  div.appendChild(btnB);
  container.appendChild(div);
  return { btnA, btnB, setActive: (label) => {
    btnA.classList.toggle('active', label === labelA);
    btnB.classList.toggle('active', label === labelB);
  }};
}

export function createSlider(container, labelLeft, labelRight, min, max, initial, onChange) {
  const div = document.createElement('div');
  div.className = 'slider-container';
  const left = document.createElement('label');
  left.textContent = labelLeft;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.value = initial;
  input.addEventListener('input', () => onChange(Number(input.value)));
  const right = document.createElement('label');
  right.textContent = labelRight;
  div.appendChild(left);
  div.appendChild(input);
  div.appendChild(right);
  container.appendChild(div);
  return input;
}

export function createButton(container, label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'demo-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  container.appendChild(btn);
  return btn;
}

// Linear interpolation
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpolate between two 2D arrays
export function lerpGrid(gridA, gridB, t) {
  return gridA.map((row, i) =>
    row.map((val, j) => lerp(val, gridB[i][j], t))
  );
}

// Map a value 0-1 to a color on a gradient
export function valueToColor(value, lowColor, highColor) {
  const low = hexToRgb(lowColor);
  const high = hexToRgb(highColor);
  const r = Math.round(lerp(low.r, high.r, value));
  const g = Math.round(lerp(low.g, high.g, value));
  const b = Math.round(lerp(low.b, high.b, value));
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
