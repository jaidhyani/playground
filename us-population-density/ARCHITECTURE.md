# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Frontend                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ index.html + style.css                                    │  │
│  │ • Control panel (state search, year slider, legend)       │  │
│  │ • Dynamic map grid (responsive CSS)                       │  │
│  │ • Hover tooltips, remove buttons                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ app.js (14 KB, no dependencies)                           │  │
│  │ • State management (activePanels, currentYear)            │  │
│  │ • Density color expressions (log2 + interpolation)        │  │
│  │ • Fuzzy state search                                      │  │
│  │ • Zoom sync, hover tooltips                              │  │
│  │ • Decade-aware tile switching                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ MapLibre GL JS 4.7.1 + PMTiles 3.2.0                      │  │
│  │ • Vector tile rendering with property-based coloring     │  │
│  │ • Dark background style (no basemap)                     │  │
│  │ • Pan/zoom sync across multiple maps                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS Range Requests
┌─────────────────────────────────────────────────────────────────┐
│                      serve.py (Port 8080)                        │
│  • HTTP/1.1 dual-stack (IPv4 + IPv6)                           │
│  • Range request support (required by PMTiles)                 │
│  • Static file serving                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      data/pmtiles/                               │
│  • {fips}_{2010 or 2020}.pmtiles                               │
│  • One per state per decade                                     │
│  • Vector tiles with property layers                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Pipeline Architecture

### High-Level Flow

```
┌──────────────────────────┐
│   US Census Bureau API   │
│  (Population by tract)   │
│  2000, 2010, 2020,       │
│  2009–2023 (ACS)         │
└──────────────┬───────────┘
               ↓
┌──────────────────────────────────────┐
│  fetch_census.py                     │
│  (Scripts/fetch_census.py)           │
│  • Query API by state + year         │
│  • Parse GEOID + population          │
│  • Save to data/population/{}.json   │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────────────────┐
│  data/population/{fips}.json                     │
│  {                                               │
│    "06001000100": { "2000": 4234, ... },         │
│    "06001000200": { "2000": 2156, ... },         │
│    ...                                           │
│  }                                               │
└──────────────┬───────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────┐
│  TIGER/Line FTP (US Census Bureau)               │
│  TIGER 2019 (2010 vintage) + TIGER 2020          │
│  (Census tract boundaries)                       │
└──────────────┬───────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────┐
│  fetch_shapefiles.py                             │
│  (scripts/fetch_shapefiles.py)                   │
│  • Download ZIP files                            │
│  • Extract to data/shapefiles/{fips}/{vintage}/  │
└──────────────┬───────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────┐
│  data/shapefiles/{fips}/{2010,2020}/             │
│  • tl_2019_{fips}_tract.shp (+ .dbf, .shx, etc) │
│  • Contains GEOID, geometry, ALAND               │
└──────────────┬───────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────────┐
│  build_tiles.py (scripts/build_tiles.py)                │
│  1. Load shapefile + population data                    │
│  2. For each tract:                                      │
│     • Extract GEOID from shapefile                       │
│     • Get ALAND (land area in sq meters)                 │
│     • Look up population by year                         │
│     • Compute density = pop / (aland / 2589988.11)       │
│  3. Create GeoJSON with properties:                      │
│     {GEOID, d2000, d2009, d2010, ..., d2023, geometry} │
│  4. Run tippecanoe → PMTiles                            │
└──────────────┬───────────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────────┐
│  data/geojson/{fips}_{2010,2020}.geojson                │
│  (Intermediate; can be deleted after tiling)            │
│  • FeatureCollection with density properties baked in    │
└──────────────┬───────────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────────┐
│  tippecanoe -o data/pmtiles/{fips}_{2010,2020}.pmtiles  │
│  • -z 12 -Z 2: zoom levels 2–12                         │
│  • --no-feature-limit --no-tile-size-limit              │
│  • -l tracts: source layer name                         │
└──────────────┬───────────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────────┐
│  data/pmtiles/{fips}_{2010,2020}.pmtiles                │
│  • ~50–200 MB per state (depends on tract count)         │
│  • Vector tiles ready for frontend                       │
│  • Properties: GEOID, d2000, d2009, ..., d2023          │
└──────────────────────────────────────────────────────────┘
```

### Pipeline Scripts

**`pipeline.py`** (Main orchestrator)
- Takes `--state {fips}` or `--all-states`
- Calls `fetch_census_data()` → saves `data/population/{fips}.json`
- Calls `fetch_shapefiles()` → downloads to `data/shapefiles/{fips}/{vintage}/`
- Calls `build_tiles()` → generates `data/pmtiles/{fips}_{vintage}.pmtiles` + `data/population/{fips}_density.json`
- Merges density across vintages into single JSON file

**`pipeline_parallel.py`**
- Spawns ThreadPoolExecutor with N workers (default 6)
- Skips states where `data/pmtiles/{fips}_2020.pmtiles` already exists
- Reports progress: `[done/total] STATE: OK/FAIL (duration_s)`
- Useful for building all 51 states: `uv run scripts/pipeline_parallel.py 8`

**`fetch_census.py`** (Standalone or called by pipeline)
- Queries Census API for 2000, 2010, 2020 (decennial) and 2009–2023 (ACS)
- No authentication required (but can use CENSUS_API_KEY env var if rate-limited)
- Constructs GEOID from state + county + tract fields in API response
- Outputs: `data/population/{fips}.json`

**`fetch_shapefiles.py`** (Standalone or called by pipeline)
- Downloads TIGER 2019 (2010 vintage) and TIGER 2020 shapefiles
- One ZIP per state per vintage
- Extracts to `data/shapefiles/{fips}/{vintage}/`
- Shapefiles include GEOID and ALAND (land area in sq meters)

**`build_tiles.py`** (Standalone or called by pipeline)
- Loads population JSON + shapefile for a state
- Computes density for each tract and year: `density = pop / (aland_sq_miles)`
- Creates GeoJSON with columns `GEOID`, `d2000`, `d2009`, ..., `d2023`, `geometry`
- Runs tippecanoe to convert GeoJSON → PMTiles
- Outputs: `data/pmtiles/{fips}_{2010,2020}.pmtiles`, `data/population/{fips}_density.json`

---

## Frontend Architecture

### State Management

```javascript
activePanels = Map {
  "p0" → { map, container, fips: "06", currentDecade: 2020 },
  "p1" → { map, container, fips: "36", currentDecade: 2020 },
  ...
}
currentYear = 2020.5  // Global slider position
zoomSyncEnabled = true  // Toggle sync pan/zoom
syncInProgress = false  // Prevent sync feedback loops
```

### Rendering Pipeline

1. **User moves year slider** → `updateYear(year)`
2. **For each panel:**
   - Compute color expression: `buildDensityExpr(year)`
     - Find lower and upper known years around slider position
     - Interpolate between `d{lower}` and `d{upper}` properties
     - Apply log2 scale to density
     - Map to 6-color gradient
   - **If decade changed** (e.g., 2009→2010):
     - Remove old layers and source
     - Add new source: `pmtiles://data/pmtiles/{fips}_{newDecade}.pmtiles`
     - Add layers with new color expression
   - **Else** (same decade):
     - Update paint property `fill-color` on existing layer with new color expression
3. **All maps update in parallel** (no network requests, pure local computation)

### Color Expression (MapLibre GL)

```javascript
buildDensityExpr(year) returns:
[
  'interpolate', ['linear'],
  ['log2', ['max', densityExpr, 1]],  // densityExpr = interpolated pop/sq_mi
  0, '#ffffcc',      // log2(1) = 0
  3.3, '#fed976',    // log2(10) ≈ 3.3
  6.6, '#fd8d3c',    // log2(100) ≈ 6.6
  10, '#e31a1c',     // log2(1000) ≈ 10
  13.3, '#bd0026',   // log2(10000) ≈ 13.3
  16, '#4a0014'      // log2(50000) ≈ 15.6
]
```

**densityExpr** (linear interpolation between years):
- If `lower === upper` (exact match): `['to-number', ['get', `d${lower}`], 0]`
- Else: `['to-number', ['get', `d${lower}`]] + t * (d_upper - d_lower)`

### Why Property-Based Coloring?

**Problem**: Feature-state + vector tiles don't work reliably
- PMTiles library uses string IDs internally
- MapLibre GL's `setFeatureState()` doesn't reliably match string IDs to feature properties
- Tried approach failed: features wouldn't update color when feature-state changed

**Solution**: Bake density into tile properties at build time
- Properties `d2000`, `d2009`, ..., `d2023` are static
- Color expression reads properties directly (not feature-state)
- Density changes computed entirely in expression, no setFeatureState needed
- Instant color updates when slider moves (no GeoJSON reprocessing)

### Why Decade-Based Tile Switching?

**Problem**: Census tract boundaries change at decade boundaries
- TIGER 2010 (used for 2000–2019 data) has different tract IDs than TIGER 2020
- Census tract GEOID format doesn't encode vintage
- Trying to use 2010 boundaries for 2020 data creates misalignment

**Solution**: Separate PMTiles per decade, switch sources at boundary
- Year 2000–2009: use `data/pmtiles/{fips}_2010.pmtiles` (2010 vintage boundaries)
- Year 2010–2024: use `data/pmtiles/{fips}_2020.pmtiles` (2020 vintage boundaries)
- Boundary at 2010 (when 2020 vintage boundaries officially took effect)

```javascript
getDecadeForYear(year) {
  return year < 2020 ? 2010 : 2020;
}
// When year crosses boundary, rebuild tile source and layers
```

### Why Dark Background Style (No Basemap)?

**Problem**: Multiple maps side-by-side with basemaps → visual clutter, inconsistent rendering
- Road networks, labels overlap differently across zoom levels
- Different states have different visual densities (urban vs rural)
- Basemap style can distract from density patterns

**Solution**: Plain dark background (`#0a0a1a`)
```javascript
const DARK_STYLE = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0a0a1a' } }
  ]
};
```

**Benefits**:
- Each panel visually isolated (only density visible)
- Consistent baseline for comparison
- Reduces server load (no basemap tile requests)
- Cleaner visual hierarchy (color gradient stands out)

### Fuzzy State Search Component

```javascript
fuzzyMatch(query, text): Boolean
  // Exact substring match OR
  // Character-by-character match (e.g., "ca" → "California")

createStateSearch({
  onSelect(fips),        // Callback when state chosen
  placeholder,           // "Select state..." or "Add a state..."
  initialFips,           // Pre-populate if opening existing state
  container              // DOM element to append to
})
```

**Used in two contexts:**
1. **Top bar** (add state): Fuzzily search all 51 states, add new panel
2. **Panel headers** (change state): Swap state in existing panel while keeping map, zoom level

### Hover Tooltip

- Listens to `mousemove` events on each map
- Queries rendered features: `map.queryRenderedFeatures(point, {layers: [layerId]})`
- Interpolates density at current year (same logic as color expression)
- Shows: `Tract {GEOID}\n{density} people/sq mi` (rounded to integer or 1 decimal)

### Zoom Sync

```javascript
function syncZoomToAll(sourceMap) {
  const center = sourceMap.getCenter();
  const zoom = sourceMap.getZoom();
  for (const panel of activePanels.values()) {
    if (panel.map !== sourceMap) {
      panel.map.jumpTo({ center, zoom });
    }
  }
}
```

- Triggered on `moveend` event if `zoomSyncEnabled === true`
- Debounced (50ms timeout) to prevent feedback loops
- Uses `jumpTo()` (instant) instead of `easeTo()` (smooth, but looks weird with many maps)

---

## Data Model

### Census API → Population JSON

```
data/population/{fips}.json
{
  "06001000100": {
    "2000": 4234,
    "2009": 4156,
    "2010": 4089,
    "2011": 4001,
    ...,
    "2023": 3892
  },
  ...
}
```

- GEOID = state (2) + county (3) + tract (6) = 11 digits
- Values = population count (integer) for that year
- Years available: 2000, 2009–2023 (2010, 2020 from decennial; others from ACS)

### Density Computation

```
density[year] = population[year] / (ALAND / 2589988.11)

where:
  ALAND = land area from shapefile, in square meters
  2589988.11 = sq meters per sq mile
  result = people per square mile (float, rounded to 2 decimals)
```

### Density JSON (After Pipeline)

```
data/population/{fips}_density.json
{
  "06001000100": {
    "2000": 1634.25,
    "2009": 1589.14,
    "2010": 1565.48,
    ...,
    "2023": 1489.33
  },
  ...
}
```

### GeoJSON (Before PMTiles)

```
data/geojson/{fips}_{2010 or 2020}.geojson
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "GEOID": "06001000100",
        "d2000": 1634.25,
        "d2009": 1589.14,
        "d2010": 1565.48,
        ...,
        "d2023": 1489.33
      },
      "geometry": { "type": "Polygon", "coordinates": [...] }
    },
    ...
  ]
}
```

- Density properties: `d{year}` = density in people/sq mi (float)
- One property per year with available data
- Geometry = census tract boundary (MultiPolygon)

### PMTiles (Final Output)

```
data/pmtiles/{fips}_{2010 or 2020}.pmtiles
```

- Vector tiles (binary format)
- One source layer: `tracts`
- Feature properties: `GEOID`, `d2000`, `d2009`, ..., `d2023`
- Zoom levels: 2–12 (tippecanoe generates full pyramids)
- Tile size: ~5–20 MB per state depending on tract count

---

## Key Design Decisions

### 1. Separate PMTiles Per Decade

**Why?** Census tract boundaries change at decade boundaries.

TIGER 2010 (boundaries as of 2010 Census):
- Used for 2000–2019 data
- Tract definitions stable within this period

TIGER 2020 (boundaries as of 2020 Census):
- Used for 2020–2024 data
- New tracts created, some old ones merged/split

**Implementation**: Load different source based on year.
```javascript
const decade = year < 2020 ? 2010 : 2020;
const url = `pmtiles://data/pmtiles/${fips}_${decade}.pmtiles`;
```

### 2. TIGER2019 Files for 2010 Vintage

**Why?** Easier to download and process.

TIGER2019 contains state-level files (1 ZIP per state per vintage) rather than TIGER2010's per-county files (50+ ZIPs per state). Reduces complexity and download time.

### 3. Property-Based Coloring (Not Feature-State)

**Why?** Feature-state doesn't work reliably with PMTiles/string IDs.

Alternative (abandoned):
```javascript
// This approach doesn't work reliably:
map.setFeatureState({source: 'src', id: geoid}, {density: 1234});
map.setPaintProperty('tracts', 'fill-color', ['get', 'density']);
```

Better approach (current):
```javascript
// Properties baked at build time:
map.setPaintProperty('tracts', 'fill-color',
  ['interpolate', ['linear'], ['log2', ['get', 'd2020']], ...]
);
```

### 4. Log2 Color Scale

**Why?** Density ranges from <1 to >50,000 people/sq mi (highly skewed).

Linear scale: rural areas (<100 people/sq mi) compress into 2% of the color range.
Log2 scale: spreads distribution evenly in visual space.

```
density   |  log2(density)  |  visual range
----------|-----------------|---------------
1         |  0              |  pale yellow
10        |  3.3            |  light orange
100       |  6.6            |  orange
1000      |  10             |  red
10000     |  13.3           |  dark red
50000     |  15.6           |  dark purple
```

### 5. Continuous Year Slider (0.1 Increments)

**Why?** Smooth scrubbing feels better than discrete years.

- Slider range: 2000–2024, step 0.1
- Between-year interpolation: linear (reasonable for slow density changes)
- Display: show full year or 1 decimal (e.g., "2015.7")

### 6. Linear Interpolation Between Years

**Why?** Census data is sparse (only 2000, 2010, 2020 for decennial; 2009–2023 for ACS).

```javascript
// Find bracketing years
let lower = 2000, upper = 2024;
for (const y of [2000, 2009, 2010, ..., 2023]) {
  if (y <= sliderYear) lower = y;
  if (y >= sliderYear) { upper = y; break; }
}

// Interpolate
t = (sliderYear - lower) / (upper - lower);
density = d_lower + t * (d_upper - d_lower);
```

Linear interpolation is reasonable because:
- Population density changes slowly (not year-to-year volatility)
- ACS estimates cover 5-year windows (already smoothed)
- Visual feedback loop (scrubbing) is more important than precision

---

## Data Availability Matrix

| Year  | Source | Available | Interpolated |
|-------|--------|-----------|--------------|
| 2000  | Decennial Census | ✓ | — |
| 2001–2008 | — | — | Linear (2000→2009) |
| 2009  | ACS 5-yr | ✓ | — |
| 2010  | Decennial Census | ✓ | — |
| 2011  | ACS 5-yr | ✓ | — |
| 2012  | ACS 5-yr | ✓ | — |
| 2013  | ACS 5-yr | ✓ | — |
| 2014  | ACS 5-yr | ✓ | — |
| 2015  | ACS 5-yr | ✓ | — |
| 2016  | ACS 5-yr | ✓ | — |
| 2017  | ACS 5-yr | ✓ | — |
| 2018  | ACS 5-yr | ✓ | — |
| 2019  | ACS 5-yr | ✓ | — |
| 2020  | Decennial Census | ✓ | — |
| 2021  | ACS 5-yr | ✓ | — |
| 2022  | ACS 5-yr | ✓ | — |
| 2023  | ACS 5-yr | ✓ | — |
| 2024  | — | — | Linear (2023→2023) |

**Note**: 2024 data not yet available; slider shows 2023 clamped.

---

## Performance Characteristics

### Build Time

| Step | Time | Notes |
|------|------|-------|
| fetch_census.py (1 state) | 30–60s | Census API queries × 19 years |
| fetch_shapefiles.py (1 state) | 20–40s | Download TIGER 2019 + 2020 ZIPs (~200 MB total) |
| build_tiles.py (1 state) | 30–120s | Depends on tract count (50–5000 tracts). tippecanoe is I/O bound |
| **Total (1 state)** | **2–5 min** | — |
| **All 51 states (parallel, 8 workers)** | **4–6 hours** | Network + I/O parallelism |

### Tile Sizes

| State | Tract Count | PMTiles 2010 | PMTiles 2020 |
|-------|-------------|--------------|--------------|
| California | ~2500 | 80 MB | 85 MB |
| Wyoming | ~50 | 2 MB | 2 MB |
| Texas | ~5500 | 180 MB | 185 MB |
| **Average** | **~500** | **15–20 MB** | **15–20 MB** |

### Frontend Performance

| Operation | Latency |
|-----------|---------|
| Load page + first state | ~2 sec (PMTiles download + render) |
| Year slider (same decade) | Instant (expression recalculation) |
| Decade boundary crossing | <1 sec (reload source + render) |
| Pan/zoom | 60 FPS (MapLibre GL optimized) |
| Add state (fuzzy search) | Instant (DOM + state update) |
| Zoom sync (8 maps) | <100 ms (jumpTo parallelism) |

---

## Extending the Project

### Adding New Years

If Census Bureau releases new data:
1. Update `DATA_YEARS` list in `app.js`
2. Re-run `fetch_census.py --all-states` (or just new states)
3. Re-run `build_tiles.py --all-states` to regenerate GeoJSON + PMTiles
4. Properties `d{newYear}` will be baked into tiles; color expression auto-adapts

### Adding New States

New territories / dependencies (e.g., US Virgin Islands):
1. Add FIPS code to `STATE_FIPS_CODES` (both frontend and scripts)
2. Verify shapefile availability in TIGER
3. Run `pipeline.py --state {fips}`

### Custom Color Scales

Modify `buildDensityExpr()` in app.js:
```javascript
// Change color stops or log scale to linear:
['interpolate', ['linear'], densityExpr, ...]
```

### Higher Zoom Levels

Adjust tippecanoe `-z` parameter in `build_tiles.py`:
```python
cmd = [..., "-z", "14", "-Z", "2", ...]  # Now 14 instead of 12
```

This increases tile detail but also file sizes (20–50% larger).
