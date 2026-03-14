# US Population Density Explorer

An interactive web application for exploring US census tract population density across 25 years of data (2000–2024). View multiple states side-by-side, scrub through decades with smooth interpolation, and compare population patterns across regions in real time.

## Features

- **Multi-state comparison**: Add and view up to 10+ states side-by-side in a responsive grid
- **Smooth year scrubbing**: 0.1-year increments with linear interpolation between Census years
- **Linked zoom**: Optional sync zoom/pan across all visible maps
- **Hover tooltips**: View exact population density for any census tract at the current year
- **Fuzzy state search**: Quick state lookup by partial name or character sequence
- **Decade-aware tile switching**: Automatically selects correct TIGER/Line vintage (2010 vs 2020) based on year
- **Log2 color scale**: 6-color gradient from pale yellow (sparse) to dark purple (dense)
- **No build required**: Served as plain HTTP, works offline once data is built

## Prerequisites

- Python 3.10+
- `uv` (Python package runner, install from https://docs.astral.sh/uv/)
- `tippecanoe` (map tile generator)
  - macOS: `brew install tippecanoe`
  - Debian/Ubuntu: `sudo apt install tippecanoe`

## Quick Start

### 1. Build Data

Start with a single state (California, ~5 minutes):

```bash
uv run scripts/pipeline.py --state 06
```

Or build all 50 states + DC in parallel (~4-6 hours, adjust workers):

```bash
uv run scripts/pipeline_parallel.py 8
```

### 2. Serve the App

```bash
python3 serve.py 8080
```

Then open http://localhost:8080 in your browser.

### 3. Explore

- Click "Select state..." to add your first state to the grid
- Use the year slider to travel through time
- Hover over tracts to see exact density
- Click the × button to remove a state

## How the Data Pipeline Works

### Step 1: Download Census Data

`scripts/fetch_census.py` queries the US Census Bureau API for:
- **Decennial counts** (2000, 2010, 2020): exact population counts per tract
- **Annual estimates** (2009–2023): ACS 5-year estimates, mid-period snapshots

Output: `data/population/{fips}.json` with structure:
```json
{
  "06001000100": { "2000": 4234, "2009": 4156, "2010": 4089, ... },
  ...
}
```

### Step 2: Download Shapefiles

`scripts/fetch_shapefiles.py` retrieves census tract boundaries from the Census Bureau:
- TIGER 2019 files for 2010-vintage boundaries (used for all years 2000–2019)
- TIGER 2020 files for 2020-vintage boundaries (used for 2020–2024)

Shapefiles include land area (`ALAND` in sq meters) needed for density calculation.

### Step 3: Merge & Compute Density

`scripts/build_tiles.py`:
1. Loads shapefile + population data for each state and decade
2. Calculates: `density = population / (land_area_sq_miles)`
3. Bakes density values into GeoJSON properties as `d2000`, `d2009`, ..., `d2023`
4. Converts GeoJSON to vector tiles using `tippecanoe`

Output: `data/pmtiles/{fips}_{2010 or 2020}.pmtiles` (vector tiles optimized for web)

### Step 4: Serve & Visualize

The app loads PMTiles and renders a map for each state:
- Styling is computed dynamically based on year slider position
- Density interpolation ensures smooth transitions between known years
- Decade switching reloads tiles when crossing 2009/2010 boundary

## How the Frontend Works

### Architecture

**Single-page app** (HTML + CSS + vanilla JS, no build step):
- `index.html`: DOM structure (map grid, slider, state search, legend)
- `app.js`: Application state and interactivity
- `style.css`: Dark theme styling

### Key Components

**State Management**
- `activePanels`: Map of `panelId -> {map, container, fips, currentDecade}`
- `currentYear`: Global year (0–2024)
- `zoomSyncEnabled`: Boolean for linked pan/zoom

**Density Rendering**
- `buildDensityExpr(year)`: Creates a MapLibre color expression that:
  1. Interpolates density between known years using properties `d{lower}` and `d{upper}`
  2. Applies log2 scaling: `interpolate ['log2', ['max', density, 1]]`
  3. Maps to 6-stop color gradient (pale yellow → dark purple)

**Dynamic Year Updates**
- When slider moves, all visible maps recalculate colors in real-time
- When year crosses decade boundary (2009↔2010), maps reload tiles from different PMTiles file
- Smooth because density values are pre-computed properties (not network requests)

**Fuzzy State Search**
- Fuzzy matching: substring match or character-sequence match
- SORTED_STATES: 51 entries (50 states + DC) sorted alphabetically
- Used in two places: top bar (add state) and panel headers (swap state)

**Zoom Sync**
- When enabled, any pan/zoom on one map syncs to all others via `map.jumpTo()`
- Debounced (50ms) to prevent feedback loops

### Color Scale

Log2 interpolation maps density to a 6-color gradient:
- **< 10 people/sq mi**: pale yellow (#ffffcc)
- **10–100**: light orange (#fed976, #fd8d3c)
- **100–1000**: orange-red (#fc4e2a, #e31a1c)
- **1000–10,000**: deep red (#bd0026)
- **10,000+**: dark purple (#4a0014)

## Data Sources & Attribution

- **Population data**: US Census Bureau (https://api.census.gov/)
  - 2000, 2010, 2020 Decennial Census
  - American Community Survey (ACS) 5-year estimates 2009–2023
- **Tract boundaries**: TIGER/Line (https://www.census.gov/cgi-bin/geo/shapefiles/)
  - TIGER 2019 (2010 vintage)
  - TIGER 2020 (2020 vintage)

## Project Structure

```
us-population-density/
├── index.html                    # Single-page app HTML
├── app.js                        # Frontend logic (14KB, no dependencies)
├── style.css                     # Dark theme styles
├── serve.py                      # HTTP server with Range support
├── scripts/
│   ├── pipeline.py              # Main orchestrator (fetch + build)
│   ├── pipeline_parallel.py      # Parallel build for all states
│   ├── fetch_census.py          # Download Census API data
│   ├── fetch_shapefiles.py      # Download TIGER/Line shapefiles
│   └── build_tiles.py           # Convert to GeoJSON + PMTiles
├── data/
│   ├── population/              # Census data (JSON)
│   ├── shapefiles/              # TIGER/Line shapefiles
│   ├── geojson/                 # Intermediate GeoJSON files
│   └── pmtiles/                 # Final vector tiles
└── README.md
```

## Technology Stack

- **Frontend**: MapLibre GL JS (web maps), PMTiles (vector tiles), vanilla JavaScript
- **Backend**: Python 3.10+, geopandas (geospatial), tippecanoe (tile generation)
- **Data**: US Census Bureau API (no key required)
- **Server**: Python http.server with Range request support (required by PMTiles)

## Performance

- **Initial load**: ~1–2 MB (one state's PMTiles + HTML/CSS/JS)
- **Year scrubbing**: Instant (no network, pre-computed colors)
- **Decade switching**: < 1 second (reload and render new tiles)
- **Pan/zoom**: 60 FPS (MapLibre GL optimized)
- **Parallel build**: All 51 states in ~4–6 hours on 8-core machine

## License & Attribution

Data sourced from the US Census Bureau (public domain). No license restrictions on data or visualizations.

---

_Built with vanilla JS + MapLibre GL + PMTiles. No build step, no framework overhead._
