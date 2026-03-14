#!/usr/bin/env python3
"""
Orchestrate the full data pipeline: fetch_census -> fetch_shapefiles -> build_tiles
for one or all states.
"""

# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "geopandas", "shapely", "pandas"]
# ///

import argparse
import json
import subprocess
import sys
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests

STATE_FIPS_CODES = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "12": "FL", "13": "GA", "15": "HI", "16": "ID",
    "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA",
    "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ",
    "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK",
    "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN",
    "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
    "55": "WI", "56": "WY", "11": "DC"
}

BASE_CENSUS_URL = "https://api.census.gov/data"
CENSUS_API_KEY = ""
SHAPEFILE_URLS = {
    2010: "https://www2.census.gov/geo/tiger/TIGER2019/TRACT/tl_2019_{state_fips}_tract.zip",
    2020: "https://www2.census.gov/geo/tiger/TIGER2020/TRACT/tl_2020_{state_fips}_tract.zip",
}
SQ_METERS_TO_SQ_MILES = 2589988.11


# ============================================================================
# STEP 1: Fetch Census Data
# ============================================================================

def fetch_census_year(state_fips: str, year: int) -> dict:
    """Fetch census data for a specific year."""
    if year == 2000:
        url = f"{BASE_CENSUS_URL}/2000/dec/sf1"
        pop_col = "P001001"
    elif year == 2010:
        url = f"{BASE_CENSUS_URL}/2010/dec/sf1"
        pop_col = "P001001"
    elif year == 2020:
        url = f"{BASE_CENSUS_URL}/2020/dec/dhc"
        pop_col = "P1_001N"
    else:
        url = f"{BASE_CENSUS_URL}/{year}/acs/acs5"
        pop_col = "B01003_001E"

    query = f"?get={pop_col}&for=tract:*&in=state:{state_fips}&in=county:*"
    if CENSUS_API_KEY:
        query += f"&key={CENSUS_API_KEY}"

    try:
        response = requests.get(url + query, timeout=30)
        response.raise_for_status()
        data = response.json()

        if not data or len(data) < 2:
            return {}

        headers = data[0]
        state_idx = len(headers) - 3
        county_idx = len(headers) - 2
        tract_idx = len(headers) - 1

        result = {}
        for row in data[1:]:
            try:
                pop = int(row[0]) if row[0] is not None else 0
                state_fips_val = row[state_idx]
                county_fips = row[county_idx].zfill(3)
                tract = row[tract_idx].zfill(6)
                geoid = f"{state_fips_val}{county_fips}{tract}"
                result[geoid] = pop
            except (ValueError, IndexError):
                continue

        return result
    except requests.RequestException as e:
        print(f"    Error fetching {year}: {e}", file=sys.stderr)
        return {}


def fetch_census_data(state_fips: str) -> dict:
    """Fetch all census data for a state."""
    print(f"  Fetching census data...")
    all_data = {}

    for year in [2000, 2010, 2020] + list(range(2009, 2024)):
        year_data = fetch_census_year(state_fips, year)
        for geoid, pop in year_data.items():
            if geoid not in all_data:
                all_data[geoid] = {}
            all_data[geoid][str(year)] = pop

    return all_data


# ============================================================================
# STEP 2: Fetch Shapefiles
# ============================================================================

def fetch_shapefiles(state_fips: str) -> None:
    """Download shapefiles for all vintages."""
    print(f"  Downloading shapefiles...")

    output_dir = Path("data/shapefiles") / state_fips
    output_dir.mkdir(parents=True, exist_ok=True)

    for vintage in [2010, 2020]:
        url = SHAPEFILE_URLS[vintage].format(state_fips=state_fips)
        try:
            response = requests.get(url, timeout=60, stream=True)
            response.raise_for_status()

            vintage_dir = output_dir / str(vintage)
            vintage_dir.mkdir(parents=True, exist_ok=True)

            zip_path = vintage_dir / f"tract_{vintage}_{state_fips}.zip"
            with open(zip_path, "wb") as f:
                f.write(response.content)

            with zipfile.ZipFile(zip_path, "r") as z:
                z.extractall(vintage_dir)

            zip_path.unlink()
        except requests.RequestException as e:
            print(f"    Error downloading {vintage}: {e}", file=sys.stderr)


# ============================================================================
# STEP 3: Build Tiles
# ============================================================================

def get_geoid_from_shapefile(row, vintage: int) -> str:
    """Extract GEOID from shapefile row. TIGER 2019/2020 files use a plain GEOID column."""
    if "GEOID" in row and row["GEOID"]:
        return str(row["GEOID"])
    if "GEOID20" in row and row["GEOID20"]:
        return str(row["GEOID20"])
    if "GEOID10" in row and row["GEOID10"]:
        return str(row["GEOID10"])
    state = row.get("STATEFP", row.get("STATEFP20", "")).zfill(2)
    county = row.get("COUNTYFP", row.get("COUNTYFP20", "")).zfill(3)
    tract = row.get("TRACTCE", row.get("TRACTCE20", "")).zfill(6)
    return f"{state}{county}{tract}"


def build_tiles(state_fips: str, pop_data: dict) -> None:
    """Build tiles from shapefiles."""
    print(f"  Building tiles...")

    for vintage in [2010, 2020]:
        shape_dir = Path("data/shapefiles") / state_fips / str(vintage)
        shapefiles = list(shape_dir.glob("*.shp"))

        if not shapefiles:
            continue

        shapefile = shapefiles[0]
        gdf = gpd.read_file(shapefile)

        geoids = []
        density_data = {}

        for idx, row in gdf.iterrows():
            geoid = get_geoid_from_shapefile(row, vintage)
            geoids.append(geoid)

            aland = row.get("ALAND", 0) or 0
            aland_sq_miles = aland / SQ_METERS_TO_SQ_MILES if aland > 0 else 1

            tract_pop = pop_data.get(geoid, {})
            tract_density = {}
            for year_str, pop in tract_pop.items():
                if pop and aland > 0:
                    density = pop / aland_sq_miles
                    tract_density[year_str] = round(density, 2)

            if tract_density:
                density_data[geoid] = tract_density

        gdf["GEOID"] = geoids

        # Bake density values into properties (d2000, d2009, d2010, ...)
        all_years = set()
        for tract_years in density_data.values():
            all_years.update(tract_years.keys())

        for year_str in sorted(all_years):
            col = f"d{year_str}"
            gdf[col] = gdf["GEOID"].map(
                lambda g, y=year_str: density_data.get(g, {}).get(y, 0)
            )

        keep_cols = ["GEOID", "geometry"] + [f"d{y}" for y in sorted(all_years)]
        gdf = gdf[[c for c in keep_cols if c in gdf.columns]]

        # Create GeoJSON
        geojson_dir = Path("data/geojson")
        geojson_dir.mkdir(parents=True, exist_ok=True)
        geojson_file = geojson_dir / f"{state_fips}_{vintage}.geojson"
        gdf.to_file(geojson_file, driver="GeoJSON")

        # Create PMTiles
        pmtiles_dir = Path("data/pmtiles")
        pmtiles_dir.mkdir(parents=True, exist_ok=True)
        pmtiles_file = pmtiles_dir / f"{state_fips}_{vintage}.pmtiles"

        try:
            cmd = [
                "tippecanoe", "-o", str(pmtiles_file),
                "--force",
                "-z", "12", "-Z", "2",
                "--no-feature-limit", "--no-tile-size-limit",
                "--coalesce-densest-as-needed", "--extend-zooms-if-still-dropping",
                "-l", "tracts",
                str(geojson_file)
            ]
            subprocess.run(cmd, check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"    Warning: tippecanoe failed for {vintage}", file=sys.stderr)

        # Save density JSON
        density_file = Path("data/population") / f"{state_fips}_density.json"
        with open(density_file, "w") as f:
            json.dump(density_data, f, indent=2)


# ============================================================================
# Main Pipeline
# ============================================================================

def process_state(state_fips: str) -> None:
    """Run full pipeline for a state."""
    state_abbr = STATE_FIPS_CODES.get(state_fips, "??")
    print(f"\nPipeline: {state_abbr} (FIPS {state_fips})")

    # Create output directory
    Path("data/population").mkdir(parents=True, exist_ok=True)

    # Step 1: Fetch census
    pop_data = fetch_census_data(state_fips)
    if pop_data:
        pop_file = Path("data/population") / f"{state_fips}.json"
        with open(pop_file, "w") as f:
            json.dump(pop_data, f, indent=2)
    else:
        print(f"  No population data retrieved")
        return

    # Step 2: Fetch shapefiles
    fetch_shapefiles(state_fips)

    # Step 3: Build tiles (accumulates density across decades)
    build_tiles(state_fips, pop_data)

    # Merge density data across all vintages into one combined file
    all_density = {}
    density_file = Path("data/population") / f"{state_fips}_density.json"
    for vintage in [2010, 2020]:
        # Each vintage call in build_tiles wrote the file; read and merge
        if density_file.exists():
            with open(density_file) as f:
                vintage_density = json.load(f)
            for geoid, years in vintage_density.items():
                if geoid not in all_density:
                    all_density[geoid] = {}
                all_density[geoid].update(years)
    if all_density:
        with open(density_file, "w") as f:
            json.dump(all_density, f)
        print(f"  Combined density: {len(all_density)} tracts")


def main():
    parser = argparse.ArgumentParser(description="Run full population density pipeline")
    parser.add_argument("--state", help="State FIPS code (e.g., 06 for California)", type=str)
    parser.add_argument("--all-states", action="store_true", help="Process all 50 states + DC")

    args = parser.parse_args()

    if not args.state and not args.all_states:
        parser.error("Specify either --state or --all-states")

    states = sorted(STATE_FIPS_CODES.keys()) if args.all_states else [args.state.zfill(2)]

    for state_fips in states:
        process_state(state_fips)


if __name__ == "__main__":
    main()
