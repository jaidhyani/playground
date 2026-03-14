#!/usr/bin/env python3
"""
Convert shapefiles to GeoJSON with density data, then to PMTiles via tippecanoe.
Density = population / (ALAND / 2589988.11) where ALAND is sq meters, convert to sq miles.
"""

# /// script
# requires-python = ">=3.10"
# dependencies = ["geopandas", "shapely", "pandas"]
# ///

import argparse
import json
import subprocess
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

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

SQ_METERS_TO_SQ_MILES = 2589988.11


def load_population_data(state_fips: str) -> dict:
    """Load population JSON for a state. Returns dict of GEOID -> {year: pop}"""
    pop_file = Path("data/population") / f"{state_fips}.json"
    if not pop_file.exists():
        print(f"Population data not found: {pop_file}", file=sys.stderr)
        return {}

    with open(pop_file) as f:
        return json.load(f)


def get_geoid_from_shapefile(row, vintage: int) -> str:
    """Extract GEOID from shapefile row. TIGER 2019/2020 files use a plain GEOID column."""
    if "GEOID" in row and row["GEOID"]:
        return str(row["GEOID"])
    if "GEOID20" in row and row["GEOID20"]:
        return str(row["GEOID20"])
    if "GEOID10" in row and row["GEOID10"]:
        return str(row["GEOID10"])

    # Fallback: construct from components
    suffixes = {"10": "10", "20": "20"} if vintage >= 2010 else {}
    sfx = suffixes.get(str(vintage)[-2:], "")
    state = row.get(f"STATEFP{sfx}", "").zfill(2)
    county = row.get(f"COUNTYFP{sfx}", "").zfill(3)
    tract = row.get(f"TRACTCE{sfx}", "").zfill(6)
    return f"{state}{county}{tract}"


def process_vintage(state_fips: str, vintage: int, pop_data: dict) -> Path:
    """
    Process shapefiles for a vintage, join with population data,
    create GeoJSON and PMTiles.
    Returns path to created PMTiles file.
    """
    print(f"  Processing {vintage}...", flush=True)

    # Find shapefile
    shape_dir = Path("data/shapefiles") / state_fips / str(vintage)
    shapefiles = list(shape_dir.glob("*.shp"))

    if not shapefiles:
        print(f"    No shapefiles found in {shape_dir}")
        return None

    shapefile = shapefiles[0]

    # Load shapefile
    gdf = gpd.read_file(shapefile)

    # Extract GEOIDs and join with population data
    geoids = []
    density_data = {}

    for idx, row in gdf.iterrows():
        geoid = get_geoid_from_shapefile(row, vintage)
        geoids.append(geoid)

        # Get land area in sq miles
        aland = row.get("ALAND", 0)
        if aland is None:
            aland = 0

        aland_sq_miles = aland / SQ_METERS_TO_SQ_MILES if aland > 0 else 1

        # Get population data for all years
        tract_pop = pop_data.get(geoid, {})

        # Calculate density for each year
        tract_density = {}
        for year_str, pop in tract_pop.items():
            if pop and aland > 0:
                density = pop / aland_sq_miles
                tract_density[year_str] = round(density, 2)

        if tract_density:
            density_data[geoid] = tract_density

    gdf["GEOID"] = geoids

    # Bake density values into GeoJSON properties (d2000, d2009, d2010, ...)
    # so we can use property-based expressions instead of setFeatureState
    all_years = set()
    for tract_years in density_data.values():
        all_years.update(tract_years.keys())

    for year_str in sorted(all_years):
        col = f"d{year_str}"
        gdf[col] = gdf["GEOID"].map(
            lambda g, y=year_str: density_data.get(g, {}).get(y, 0)
        )

    # Strip unnecessary columns to keep tiles small
    keep_cols = ["GEOID", "geometry"] + [f"d{y}" for y in sorted(all_years)]
    gdf = gdf[[c for c in keep_cols if c in gdf.columns]]

    # Create GeoJSON
    geojson_dir = Path("data/geojson")
    geojson_dir.mkdir(parents=True, exist_ok=True)

    geojson_file = geojson_dir / f"{state_fips}_{vintage}.geojson"
    gdf.to_file(geojson_file, driver="GeoJSON")
    print(f"    Created {geojson_file}")

    # Create PMTiles via tippecanoe
    pmtiles_dir = Path("data/pmtiles")
    pmtiles_dir.mkdir(parents=True, exist_ok=True)

    pmtiles_file = pmtiles_dir / f"{state_fips}_{vintage}.pmtiles"

    cmd = [
        "tippecanoe",
        "-o", str(pmtiles_file),
        "--force",
        "-z", "12",
        "-Z", "2",
        "--no-feature-limit",
        "--no-tile-size-limit",
        "--coalesce-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "-l", "tracts",
        str(geojson_file)
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"    Created {pmtiles_file}")
    except subprocess.CalledProcessError as e:
        print(f"    tippecanoe failed: {e.stderr.decode()}", file=sys.stderr)
        return None
    except FileNotFoundError:
        print(f"    tippecanoe not found - install with: brew install tippecanoe", file=sys.stderr)
        return None

    # Save density JSON
    density_file = Path("data/population") / f"{state_fips}_density.json"
    with open(density_file, "w") as f:
        json.dump(density_data, f, indent=2)
    print(f"    Created {density_file}")

    return pmtiles_file


def build_state(state_fips: str) -> None:
    """Build tiles for all vintages of a state."""
    state_abbr = STATE_FIPS_CODES.get(state_fips, "??")
    print(f"Building tiles for {state_abbr} (FIPS {state_fips})...")

    pop_data = load_population_data(state_fips)
    if not pop_data:
        print(f"No population data found for {state_fips}")
        return

    # Accumulate density across all vintages into one file
    all_density = {}
    for vintage in [2010, 2020]:
        process_vintage(state_fips, vintage, pop_data)

        # Merge this vintage's density into the combined file
        density_file = Path("data/population") / f"{state_fips}_density.json"
        if density_file.exists():
            with open(density_file) as f:
                vintage_density = json.load(f)
            for geoid, years in vintage_density.items():
                if geoid not in all_density:
                    all_density[geoid] = {}
                all_density[geoid].update(years)

    # Write combined density file
    density_file = Path("data/population") / f"{state_fips}_density.json"
    with open(density_file, "w") as f:
        json.dump(all_density, f)
    print(f"  Combined density: {len(all_density)} tracts")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Build tiles from shapefiles"
    )
    parser.add_argument(
        "--state",
        help="State FIPS code (e.g., 06 for California)",
        type=str
    )
    parser.add_argument(
        "--all-states",
        action="store_true",
        help="Process all 50 states + DC"
    )

    args = parser.parse_args()

    if not args.state and not args.all_states:
        parser.error("Specify either --state or --all-states")

    states_to_process = []
    if args.all_states:
        states_to_process = sorted(STATE_FIPS_CODES.keys())
    else:
        states_to_process = [args.state.zfill(2)]

    for state_fips in states_to_process:
        build_state(state_fips)


if __name__ == "__main__":
    main()
