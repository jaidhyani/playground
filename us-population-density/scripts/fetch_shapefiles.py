#!/usr/bin/env python3
"""
Download TIGER/Line tract shapefiles from US Census FTP.
Shapefiles for 2000, 2010, and 2020 census vintages.
"""

# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///

import argparse
import sys
import zipfile
from pathlib import Path

import requests

# TIGER/Line shapefile URLs by vintage
# 2000: per-county files from TIGER2010 — need to download all counties for a state
# 2010: use TIGER2019 state-level files (still 2010-vintage boundaries)
# 2020: TIGER2020 state-level files
SHAPEFILE_URLS = {
    2010: "https://www2.census.gov/geo/tiger/TIGER2019/TRACT/tl_2019_{state_fips}_tract.zip",
    2020: "https://www2.census.gov/geo/tiger/TIGER2020/TRACT/tl_2020_{state_fips}_tract.zip",
}

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


def download_shapefile(state_fips: str, vintage: int, output_dir: Path) -> bool:
    """
    Download shapefile zip for a state and vintage, extract to output_dir.
    Returns True if successful.
    """
    url_template = SHAPEFILE_URLS[vintage]
    url = url_template.format(state_fips=state_fips)

    try:
        print(f"  {vintage}...", end=" ", flush=True)
        response = requests.get(url, timeout=60, stream=True)
        response.raise_for_status()

        # Create subdirectory for this vintage
        vintage_dir = output_dir / str(vintage)
        vintage_dir.mkdir(parents=True, exist_ok=True)

        # Download and extract zip
        zip_path = vintage_dir / f"tract_{vintage}_{state_fips}.zip"
        with open(zip_path, "wb") as f:
            f.write(response.content)

        # Extract
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(vintage_dir)

        zip_path.unlink()  # Remove zip after extraction
        print("✓")
        return True

    except requests.RequestException as e:
        print(f"✗ (Error: {e})")
        return False
    except Exception as e:
        print(f"✗ (Extraction error: {e})")
        return False


def fetch_state_shapefiles(state_fips: str) -> None:
    """Download all vintages of shapefiles for a state."""
    state_abbr = STATE_FIPS_CODES.get(state_fips, "??")
    print(f"Downloading shapefiles for {state_abbr} (FIPS {state_fips})...")

    output_dir = Path("data/shapefiles") / state_fips
    output_dir.mkdir(parents=True, exist_ok=True)

    for vintage in [2010, 2020]:
        download_shapefile(state_fips, vintage, output_dir)

    print(f"Shapefiles saved to {output_dir}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Download US Census TIGER/Line tract shapefiles"
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
        fetch_state_shapefiles(state_fips)


if __name__ == "__main__":
    main()
