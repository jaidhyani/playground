const STATES = {
  "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas",
  "06": "California", "08": "Colorado", "09": "Connecticut", "10": "Delaware",
  "11": "District of Columbia", "12": "Florida", "13": "Georgia", "15": "Hawaii",
  "16": "Idaho", "17": "Illinois", "18": "Indiana", "19": "Iowa",
  "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine",
  "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
  "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska",
  "32": "Nevada", "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico",
  "36": "New York", "37": "North Carolina", "38": "North Dakota", "39": "Ohio",
  "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania", "44": "Rhode Island",
  "45": "South Carolina", "46": "South Dakota", "47": "Tennessee", "48": "Texas",
  "49": "Utah", "50": "Vermont", "51": "Virginia", "53": "Washington",
  "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming"
};

const SORTED_STATES = Object.entries(STATES).sort((a, b) => a[1].localeCompare(b[1]));

const STATE_BOUNDS = {
  "01": [-87.6, 30.3, -84.9, 35.0],
  "02": [-172.4, 51.2, -130.0, 68.9],
  "04": [-114.8, 31.3, -109.0, 37.0],
  "05": [-94.4, 33.0, -89.6, 36.5],
  "06": [-124.4, 32.5, -114.1, 42.0],
  "08": [-109.0, 37.0, -102.0, 41.0],
  "09": [-73.7, 40.9, -71.8, 42.1],
  "10": [-75.8, 38.4, -75.0, 39.8],
  "11": [-77.1, 38.7, -76.9, 39.0],
  "12": [-87.6, 24.5, -80.0, 31.0],
  "13": [-85.6, 30.3, -80.8, 35.0],
  "15": [-160.2, 18.9, -154.8, 22.2],
  "16": [-117.2, 42.0, -111.1, 49.0],
  "17": [-91.5, 37.0, -87.0, 42.5],
  "18": [-88.1, 37.7, -84.8, 41.8],
  "19": [-96.6, 40.4, -90.1, 43.5],
  "20": [-102.0, 37.0, -94.6, 40.0],
  "21": [-89.6, 36.5, -81.9, 39.1],
  "22": [-94.0, 29.0, -89.0, 33.0],
  "23": [-71.1, 43.0, -66.9, 47.5],
  "24": [-79.5, 37.9, -75.0, 39.7],
  "25": [-73.5, 41.2, -69.9, 42.9],
  "26": [-90.4, 41.7, -83.4, 48.3],
  "27": [-97.2, 43.5, -89.5, 49.4],
  "28": [-91.7, 30.2, -88.1, 34.9],
  "29": [-95.8, 36.0, -90.1, 40.6],
  "30": [-116.1, 45.0, -104.0, 49.0],
  "31": [-104.1, 40.0, -95.3, 43.0],
  "32": [-120.0, 35.0, -114.6, 42.0],
  "33": [-72.6, 42.7, -70.7, 45.3],
  "34": [-75.6, 38.9, -73.9, 41.4],
  "35": [-109.0, 31.8, -103.0, 37.0],
  "36": [-79.8, 40.5, -71.9, 45.0],
  "37": [-84.3, 33.8, -75.4, 36.6],
  "38": [-104.0, 45.9, -96.6, 49.0],
  "39": [-84.8, 38.4, -80.5, 42.3],
  "40": [-103.0, 33.6, -94.4, 37.0],
  "41": [-124.5, 42.0, -116.4, 46.3],
  "42": [-80.5, 39.7, -74.7, 42.3],
  "44": [-71.9, 41.1, -71.1, 42.0],
  "45": [-83.4, 32.0, -78.5, 35.2],
  "46": [-104.1, 42.5, -96.4, 45.9],
  "47": [-90.3, 35.0, -81.6, 36.7],
  "48": [-106.6, 25.8, -93.5, 36.5],
  "49": [-114.0, 37.0, -109.0, 42.0],
  "50": [-73.4, 42.7, -71.5, 45.0],
  "51": [-83.7, 36.5, -75.2, 39.5],
  "53": [-124.7, 45.6, -116.9, 49.0],
  "54": [-82.6, 37.2, -77.7, 40.6],
  "55": [-92.9, 42.5, -86.8, 47.3],
  "56": [-111.1, 41.0, -104.0, 45.0]
};

const DATA_YEARS = [2000, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

// Plain dark style — no basemap geography, just the tracts
const DARK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0a0a1a' } }]
};

const activePanels = new Map();
let currentYear = 2020;
let zoomSyncEnabled = false;
let syncInProgress = false;

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// ── Fuzzy search ──

function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function createStateSearch(opts) {
  const { onSelect, placeholder, initialFips, container } = opts;

  const wrapper = document.createElement('div');
  wrapper.className = 'state-search';

  const display = document.createElement('div');
  display.className = 'state-search-display';
  display.textContent = initialFips ? STATES[initialFips] : (placeholder || 'Select state...');
  if (!initialFips) display.classList.add('placeholder');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'state-search-input';
  input.placeholder = 'Type to search...';
  input.style.display = 'none';

  const dropdown = document.createElement('div');
  dropdown.className = 'state-search-dropdown';
  dropdown.style.display = 'none';

  wrapper.appendChild(display);
  wrapper.appendChild(input);
  wrapper.appendChild(dropdown);
  (container || document.body).appendChild(wrapper);

  function populateDropdown(filter) {
    dropdown.innerHTML = '';
    const matches = SORTED_STATES.filter(([, name]) =>
      !filter || fuzzyMatch(filter, name)
    );
    for (const [fips, name] of matches) {
      const item = document.createElement('div');
      item.className = 'state-search-item';
      item.textContent = name;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        close();
        display.textContent = name;
        display.classList.remove('placeholder');
        onSelect(fips);
      });
      dropdown.appendChild(item);
    }
  }

  function open() {
    display.style.display = 'none';
    input.style.display = '';
    dropdown.style.display = '';
    input.value = '';
    populateDropdown('');
    input.focus();
  }

  function close() {
    display.style.display = '';
    input.style.display = 'none';
    dropdown.style.display = 'none';
  }

  display.addEventListener('click', open);

  input.addEventListener('input', () => {
    populateDropdown(input.value);
  });

  input.addEventListener('blur', () => {
    setTimeout(close, 150);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') {
      const first = dropdown.querySelector('.state-search-item');
      if (first) first.dispatchEvent(new MouseEvent('mousedown'));
    }
  });

  return {
    el: wrapper,
    setLabel(name) {
      display.textContent = name;
      display.classList.remove('placeholder');
    }
  };
}

// ── Density expression ──

function buildDensityExpr(year) {
  const y = Math.max(DATA_YEARS[0], Math.min(year, DATA_YEARS[DATA_YEARS.length - 1]));
  let lower = DATA_YEARS[0], upper = DATA_YEARS[DATA_YEARS.length - 1];
  for (const ky of DATA_YEARS) {
    if (ky <= y) lower = ky;
    if (ky >= y) { upper = ky; break; }
  }

  let densityExpr;
  if (lower === upper) {
    densityExpr = ['to-number', ['get', `d${lower}`], 0];
  } else {
    const t = (y - lower) / (upper - lower);
    densityExpr = ['+',
      ['to-number', ['get', `d${lower}`], 0],
      ['*', t, ['-',
        ['to-number', ['get', `d${upper}`], 0],
        ['to-number', ['get', `d${lower}`], 0]
      ]]
    ];
  }

  return [
    'interpolate', ['linear'],
    ['log2', ['max', densityExpr, 1]],
    0, '#ffffcc',
    3.3, '#fed976',
    6.6, '#fd8d3c',
    10, '#e31a1c',
    13.3, '#bd0026',
    16, '#4a0014'
  ];
}

function getDecadeForYear(year) {
  return year < 2020 ? 2010 : 2020;
}

// ── Panel management ──

function loadStateIntoPanel(panelId, fips) {
  const panel = activePanels.get(panelId);
  if (!panel) return;

  const oldFips = panel.fips;
  const map = panel.map;

  // Remove old layers/source
  if (oldFips) {
    try {
      if (map.getLayer(`tracts-${panelId}`)) map.removeLayer(`tracts-${panelId}`);
      if (map.getLayer(`tracts-outline-${panelId}`)) map.removeLayer(`tracts-outline-${panelId}`);
      if (map.getSource(`src-${panelId}`)) map.removeSource(`src-${panelId}`);
    } catch (e) { /* ignore */ }
  }

  panel.fips = fips;
  const decade = getDecadeForYear(currentYear);
  panel.currentDecade = decade;
  const sourceId = `src-${panelId}`;

  map.addSource(sourceId, {
    type: 'vector',
    url: `pmtiles://data/pmtiles/${fips}_${decade}.pmtiles`
  });

  map.addLayer({
    id: `tracts-${panelId}`,
    type: 'fill',
    source: sourceId,
    'source-layer': 'tracts',
    paint: {
      'fill-color': buildDensityExpr(currentYear),
      'fill-opacity': 0.85
    }
  });

  map.addLayer({
    id: `tracts-outline-${panelId}`,
    type: 'line',
    source: sourceId,
    'source-layer': 'tracts',
    paint: {
      'line-color': '#222',
      'line-width': 0.3,
      'line-opacity': 0.4
    }
  });

  const bounds = STATE_BOUNDS[fips];
  if (bounds) map.fitBounds(bounds, { padding: 20 });
}

let nextPanelId = 0;

function addPanel(fips) {
  const panelId = `p${nextPanelId++}`;
  const bounds = STATE_BOUNDS[fips];

  const panelEl = document.createElement('div');
  panelEl.className = 'map-panel';

  // State search label (clickable → fuzzy search)
  const search = createStateSearch({
    initialFips: fips,
    container: panelEl,
    onSelect(newFips) {
      if (newFips !== panel.fips) {
        loadStateIntoPanel(panelId, newFips);
        search.setLabel(STATES[newFips]);
      }
    }
  });
  search.el.classList.add('panel-label');

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => removePanel(panelId));

  const mapContainer = document.createElement('div');
  mapContainer.className = 'map-container';

  panelEl.appendChild(removeBtn);
  panelEl.appendChild(mapContainer);
  document.getElementById('map-grid').appendChild(panelEl);

  const map = new maplibregl.Map({
    container: mapContainer,
    style: DARK_STYLE,
    center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
    zoom: 7,
    attributionControl: false
  });

  const panel = { map, container: panelEl, fips: null, currentDecade: null };
  activePanels.set(panelId, panel);

  map.on('load', () => {
    loadStateIntoPanel(panelId, fips);
    addHoverTooltip(map, panelId);

    map.on('moveend', () => {
      if (zoomSyncEnabled && !syncInProgress) syncZoomToAll(map);
    });
  });
}

function removePanel(panelId) {
  const panel = activePanels.get(panelId);
  if (!panel) return;
  panel.map.remove();
  panel.container.remove();
  activePanels.delete(panelId);
}

// ── UI init ──

function initUI() {
  const ySlider = document.getElementById('year-slider');
  const syncCheck = document.getElementById('zoom-sync');

  // Top-bar "add state" fuzzy search
  createStateSearch({
    placeholder: 'Add a state...',
    container: document.getElementById('state-selector'),
    onSelect(fips) { addPanel(fips); }
  });

  ySlider.addEventListener('input', (e) => updateYear(parseFloat(e.target.value)));
  syncCheck.addEventListener('change', (e) => { zoomSyncEnabled = e.target.checked; });

  addPanel('06');
}

// ── Year update ──

function updateYear(year) {
  currentYear = year;
  document.getElementById('year-display').textContent =
    Number.isInteger(year) ? year.toString() : year.toFixed(1);

  const colorExpr = buildDensityExpr(year);

  for (const [panelId, panel] of activePanels) {
    if (!panel.fips) continue;
    const newDecade = getDecadeForYear(year);

    if (newDecade !== panel.currentDecade) {
      const map = panel.map;
      const sourceId = `src-${panelId}`;
      try {
        map.removeLayer(`tracts-${panelId}`);
        map.removeLayer(`tracts-outline-${panelId}`);
        map.removeSource(sourceId);

        panel.currentDecade = newDecade;

        map.addSource(sourceId, {
          type: 'vector',
          url: `pmtiles://data/pmtiles/${panel.fips}_${newDecade}.pmtiles`
        });

        map.addLayer({
          id: `tracts-${panelId}`,
          type: 'fill',
          source: sourceId,
          'source-layer': 'tracts',
          paint: { 'fill-color': colorExpr, 'fill-opacity': 0.85 }
        });

        map.addLayer({
          id: `tracts-outline-${panelId}`,
          type: 'line',
          source: sourceId,
          'source-layer': 'tracts',
          paint: { 'line-color': '#222', 'line-width': 0.3, 'line-opacity': 0.4 }
        });
      } catch (err) {
        console.error(`Error swapping decade for ${panelId}:`, err);
      }
    } else {
      panel.map.setPaintProperty(`tracts-${panelId}`, 'fill-color', colorExpr);
    }
  }
}

// ── Tooltip ──

function addHoverTooltip(map, panelId) {
  const tooltip = document.getElementById('tract-tooltip');

  map.on('mousemove', (e) => {
    const layerId = `tracts-${panelId}`;
    if (!map.getLayer(layerId)) return;

    const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
    if (features.length > 0) {
      const props = features[0].properties;
      const geoid = props.GEOID;

      let lower = DATA_YEARS[0], upper = DATA_YEARS[DATA_YEARS.length - 1];
      for (const ky of DATA_YEARS) {
        if (ky <= currentYear) lower = ky;
        if (ky >= currentYear) { upper = ky; break; }
      }
      let density;
      if (lower === upper) {
        density = props[`d${lower}`] || 0;
      } else {
        const t = (currentYear - lower) / (upper - lower);
        density = (props[`d${lower}`] || 0) + ((props[`d${upper}`] || 0) - (props[`d${lower}`] || 0)) * t;
      }

      tooltip.style.display = 'block';
      tooltip.style.left = (e.originalEvent.pageX + 10) + 'px';
      tooltip.style.top = (e.originalEvent.pageY + 10) + 'px';
      tooltip.innerHTML = `<strong>Tract ${geoid}</strong><br>${
        density >= 1000 ? Math.round(density).toLocaleString() : density.toFixed(1)
      } people/sq mi`;
      map.getCanvas().style.cursor = 'pointer';
    } else {
      tooltip.style.display = 'none';
      map.getCanvas().style.cursor = '';
    }
  });

  map.on('mouseleave', () => { tooltip.style.display = 'none'; });
}

// ── Zoom sync ──

function syncZoomToAll(sourceMap) {
  syncInProgress = true;
  const center = sourceMap.getCenter();
  const zoom = sourceMap.getZoom();
  for (const panel of activePanels.values()) {
    if (panel.map !== sourceMap) panel.map.jumpTo({ center, zoom });
  }
  setTimeout(() => { syncInProgress = false; }, 50);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}
