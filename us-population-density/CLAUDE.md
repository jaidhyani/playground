# US Population Density Explorer

Interactive side-by-side census tract population density maps for US states, 2000–2024, with smooth year scrubbing and real-time density interpolation.

## Quick Start

```bash
# Install tippecanoe (macOS: brew install tippecanoe, Debian: sudo apt install tippecanoe)
sudo apt install tippecanoe

# Build data for California
uv run scripts/pipeline.py --state 06

# Serve the app
python3 serve.py 8080

# Open http://localhost:8080
```

## Stack

- **Frontend**: Vanilla JS + MapLibre GL JS + PMTiles
- **Data pipeline**: Python 3.10+ (geopandas, requests) + Tippecanoe
- **Server**: Python dual-stack HTTP with Range request support
- **No build step, no framework**

## Key Files

- `index.html`: Single-page structure (map grid, controls, legend, year slider)
- `app.js`: Core app logic (state management, density interpolation, zoom sync, fuzzy state search, hover tooltips)
- `style.css`: Dark theme styling (dark gray #1a1a2e, responsive grid, custom slider)
- `serve.py`: HTTP server with Range request support for PMTiles
- `scripts/pipeline.py`: Orchestrate full pipeline (census → shapefiles → tiles) for one or all states
- `scripts/fetch_census.py`: Download population from Census API (2000–2024)
- `scripts/fetch_shapefiles.py`: Download TIGER/Line shapefiles (2010, 2020 vintage)
- `scripts/build_tiles.py`: Merge shapefiles with density data → GeoJSON → PMTiles via tippecanoe
- `scripts/pipeline_parallel.py`: Build all states in parallel with ThreadPoolExecutor

## Data Model

**Census API → Population JSON**
- Decennial (2000, 2010, 2020) and ACS 5-year estimates (2009–2023)
- Output: `data/population/{fips}.json` = `{GEOID: {year: population}}`

**Shapefiles + Population → Density GeoJSON**
- Land area from ALAND (sq meters) → convert to sq miles: `density = pop / (aland / 2589988.11)`
- Bake density into properties: `d2000`, `d2009`, `d2010`, ..., `d2023` (float, rounded to 2 decimals)
- Output: `data/geojson/{fips}_{decade}.geojson`

**GeoJSON → PMTiles**
- tippecanoe: `-z 12 -Z 2 --no-feature-limit --no-tile-size-limit`
- One PMTiles file per state per decade: `data/pmtiles/{fips}_{decade}.pmtiles`
- Source layer name: `tracts`
- Feature properties: `GEOID`, `d2000`, `d2009`, `d2010`, ..., `d2023`

## Frontend Architecture

**Property-based coloring** (not feature-state)
- Density properties baked into tiles at build time
- Color expression: `buildDensityExpr(year)` interpolates `d{lower}` and `d{upper}` properties
- Decade switching: when year crosses boundary (e.g., 2009→2010), reload PMTiles source

**Log2 color ramp**
- `interpolate ['log2', ['max', density, 1]]` with 6 color stops
- Maps density log-space to visual spectrum: pale yellow (1 people/sq mi) → dark purple (50k+)

**Fuzzy state search**
- `fuzzyMatch(query, text)`: substring match or character-sequence match
- SORTED_STATES: all 51 entries alphabetically
- Two instances: top bar (add new state) and panel headers (change state)

**Zoom sync**
- When enabled: one map's pan/zoom syncs to all others (debounced 50ms to prevent loops)
- Uses `map.jumpTo({center, zoom})`

**Hover tooltip**
- Query rendered features at mouse position
- Interpolate density at current year: `(d_lower + (d_upper - d_lower) * t)`
- Show GEOID and density (formatted as integer or 1 decimal)

**Dynamic panel grid**
- CSS: `grid-template-columns: repeat(auto-fit, minmax(400px, 1fr))`
- Each panel: state search label + map + remove button
- Panels stored in `activePanels` Map keyed by `p0`, `p1`, ...

**Year slider**
- Range: 2000–2024, step 0.1 (smooth scrubbing)
- `updateYear(year)`: recompute color expressions for all panels, swap decades when needed
- Display shows full year or 1 decimal (e.g., 2020 or 2009.5)

## Data Pipeline

**`pipeline.py`** (main orchestrator)
1. `fetch_census_data(state_fips)`: query Census API for all years, save to `data/population/{fips}.json`
2. `fetch_shapefiles(state_fips)`: download TIGER2019 (2010 vintage) and TIGER2020 (2020 vintage)
3. `build_tiles(state_fips, pop_data)`: load shapefile, join population, compute density, run tippecanoe
4. Merge density across vintages into single `data/population/{fips}_density.json`

**`pipeline_parallel.py`**
- ThreadPoolExecutor with default 6 workers
- Skip states that already have PMTiles (check `data/pmtiles/{fips}_2020.pmtiles`)
- Usage: `uv run scripts/pipeline_parallel.py [workers]`

**Key design choices**
- Separate PMTiles per decade (tract boundaries change at decade boundaries; TIGER 2010 vs 2020)
- TIGER2019 files for 2010 vintage (state-level, easier to download than per-county)
- Census API has no auth requirement (but can use CENSUS_API_KEY env var if rate-limited)
- Density computed at build time and baked into properties (avoids compute in browser)
- Linear interpolation between known years (realistic for slow-moving density changes)

## Adding a New State

1. Verify state FIPS code in `STATE_FIPS_CODES` (both frontend and scripts)
2. Run pipeline: `uv run scripts/pipeline.py --state 06` (e.g., California = 06)
3. Wait for census API queries and tippecanoe tile generation
4. Visit app and use state search to select the state (loads from `data/pmtiles/{fips}_2010.pmtiles` or 2020 depending on year slider)

## Important Implementation Details

**Why property-based coloring?**
- Tried feature-state with setFeatureState, but PMTiles uses string IDs that don't reliably match feature IDs in the layer
- Baking density into properties is simpler and works with vector tiles

**Why decade-based tile switching?**
- Census tract boundaries are fixed within decades but change between them
- TIGER 2010 vs 2020 files have different tract definitions
- Switching sources at decade boundary ensures we're using correct boundaries

**Why dark background (no basemap)?**
- Simplifies state isolation: each panel renders only the tract layer + dark background
- Avoids visual confusion when comparing side-by-side (consistent styling across states)
- Reduces tile data (no basemap requests needed)

**Why log2 color scale?**
- Density ranges from <1 to >50,000 people/sq mi (highly skewed distribution)
- Linear scale would squash rural areas into a single color
- Log2 scale spreads the range evenly in visual space

**Year slider as continuous range**
- Allows smooth scrubbing between integer years
- Linear interpolation between known Census data years feels responsive
- Display shows fractional years (e.g., 2015.7) for transparency

**Density interpolation**
- When year is between two known data years, linearly interpolate: `t = (year - lower) / (upper - lower)`, `density = d_lower + t * (d_upper - d_lower)`
- Applied both to color expression (in map) and tooltip (on hover)
- Graceful for ACS data (estimates, not exact counts, but still meaningful)

## Data Availability

Census Bureau sources:
- 2000 Decennial: Census 2000 SF1
- 2010 Decennial: Census 2010 SF1
- 2020 Decennial: Census 2020 DHC
- 2009–2023: ACS 5-year estimates

All data available without authentication via API, but unauthenticated requests may be rate-limited. Set CENSUS_API_KEY env var if needed.

## Files to Know

- `data/population/{fips}.json`: Raw census data (GEOID → {year: pop})
- `data/population/{fips}_density.json`: Computed density (GEOID → {year: density})
- `data/shapefiles/{fips}/{2010 or 2020}/tl_2019_{fips}_tract.shp` (etc.)
- `data/geojson/{fips}_{2010 or 2020}.geojson`: Intermediate GeoJSON with baked density properties
- `data/pmtiles/{fips}_{2010 or 2020}.pmtiles`: Final vector tiles for frontend
