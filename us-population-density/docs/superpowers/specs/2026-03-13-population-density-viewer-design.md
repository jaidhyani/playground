# US Population Density Viewer — Design Spec

## Purpose

Interactive tool for comparing census-tract-level population density across US states over time (2000–2024). Side-by-side MapLibre GL maps with a shared time slider. Local tool for personal use.

## Stack

- **Frontend**: Vanilla JS, MapLibre GL JS, PMTiles protocol adapter
- **Data pipeline**: Python (geopandas, requests), Tippecanoe, pmtiles
- **Serving**: Simple static file server (Python http.server or similar)

## Data Pipeline

### Sources

- **Geometry**: US Census Bureau TIGER/Line shapefiles — tract boundaries per decade vintage (2000, 2010, 2020)
- **Population**: Census API — Decennial Census (2000, 2010, 2020) + ACS 5-year estimates (2009–2023) at tract level
- **Field**: B01003_001E (total population). Density = population / land area (ALAND field in shapefiles, converted to sq mi)

### Processing

1. Download TIGER/Line tract shapefiles per state per decade vintage
2. Download population data from Census API per state per year
3. Join population to geometry by GEOID, compute density
4. Convert to GeoJSON → Tippecanoe → PMTiles (one .pmtiles per state per decade)
5. Export population data as JSON: `{GEOID: {year: density, ...}}`
6. Interpolate between known data points for smooth time scrubbing

### Decade Boundary Handling

Tract boundaries change at decade boundaries (2000→2010→2020). Each decade has its own PMTiles file. When the time slider crosses a decade boundary, the frontend swaps which PMTiles source is active. No cross-decade interpolation of geometry — that requires areal interpolation and is out of scope for v1.

### Data Availability

| Period | Source | Granularity |
|--------|--------|-------------|
| 2000 | Decennial Census SF1 | Tract |
| 2005–2009 | ACS 5-year | Tract (labeled by end year) |
| 2010 | Decennial Census SF1 | Tract |
| 2010–2019 | ACS 5-year (annual) | Tract |
| 2020 | Decennial Census | Tract |
| 2020–2023 | ACS 5-year (annual) | Tract |

For 2000–2008 (gap between decennial and first ACS): linear interpolation between 2000 decennial and 2009 ACS.

## Frontend

### Layout

```
┌─────────────────────────────────────────────────┐
│  [State Selector ▼] [+ Add State]    [Legend]   │
│  ═══════════════════●═══════════════════════     │
│  2000              2012                  2024    │
├────────────────────┬────────────────────────────┤
│                    │                            │
│   California       │   Texas                   │
│   (MapLibre GL)    │   (MapLibre GL)           │
│                    │                            │
│                    │                            │
├────────────────────┼────────────────────────────┤
│                    │                            │
│   New York         │   Florida                 │
│   (MapLibre GL)    │   (MapLibre GL)           │
│                    │                            │
│                    │                            │
└────────────────────┴────────────────────────────┘
```

- 1–4 state panels in a responsive grid (1 col on narrow, 2×2 on wide)
- Each panel: MapLibre GL map auto-fitted to state bounds
- Shared time slider across all panels
- Searchable state dropdown to add/remove states

### Interactions

- **Time slider**: Scrubbing recolors all map panels instantly (data-driven paint property update, no network requests)
- **Hover**: Tooltip showing tract GEOID, population, density, and % change from previous known data point
- **Zoom sync** (toggle): Lock/unlock zoom across panels for equal-scale comparison
- **Color scale**: Sequential ramp (light yellow → dark red), shared across all panels. Log scale for density to handle the wide range (rural ~1/sq mi to urban ~50,000/sq mi)

### Interpolation (Frontend)

Population JSON holds known data points per GEOID per year. For any slider position `t` between known years `t0` and `t1`:

```
density(t) = density(t0) + (density(t1) - density(t0)) × (t - t0) / (t1 - t0)
```

Computed in JS, fed into MapLibre's `match` + `interpolate` expressions or via `setFeatureState`.

## Project Structure

```
us-population-density/
  index.html              # Main app
  app.js                  # Frontend logic
  style.css               # Styles
  scripts/
    fetch_census.py       # Download population data from Census API
    fetch_shapefiles.py   # Download TIGER/Line shapefiles
    build_tiles.py        # GeoJSON → Tippecanoe → PMTiles
    pipeline.py           # Orchestrates full build
  data/                   # Generated (gitignored)
    shapefiles/           # Raw TIGER/Line downloads
    geojson/              # Intermediate GeoJSON
    pmtiles/              # Final PMTiles per state per decade
    population/           # Population JSON per state
  CLAUDE.md               # Project-specific instructions
```

## Build Strategy

Start with California as proof-of-concept (single state, full pipeline end-to-end), then extend to all 50 states. The pipeline is embarrassingly parallel per state.
