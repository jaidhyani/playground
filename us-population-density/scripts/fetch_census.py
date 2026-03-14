#!/usr/bin/env python3
"""
Download population data from US Census Bureau API for given state(s).
Uses Census API (https://api.census.gov/data/) - no API key required for basic access.
"""

# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///

import argparse
import json
import os
import sys
from pathlib import Path

import requests

BASE_URL = "https://api.census.gov/data"
CENSUS_API_KEY = os.environ.get("CENSUS_API_KEY", "")

# All 50 states + DC (FIPS codes)
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


def fetch_census_year(state_fips: str, year: int, dataset: str, table: str) -> dict:
    """
    Fetch census data for a specific year.

    Returns dict of GEOID -> population value
    """
    if year == 2000:
        url = f"{BASE_URL}/2000/dec/sf1"
        pop_col = "P001001"
    elif year == 2010:
        url = f"{BASE_URL}/2010/dec/sf1"
        pop_col = "P001001"
    elif year == 2020:
        url = f"{BASE_URL}/2020/dec/dhc"
        pop_col = "P1_001N"
    else:
        url = f"{BASE_URL}/{year}/acs/acs5"
        pop_col = "B01003_001E"

    # Census API needs multiple "in" params — use a query string directly
    # since Python dicts can't have duplicate keys
    query = f"?get={pop_col}&for=tract:*&in=state:{state_fips}&in=county:*"
    if CENSUS_API_KEY:
        query += f"&key={CENSUS_API_KEY}"

    try:
        response = requests.get(url + query, timeout=30)
        response.raise_for_status()
        data = response.json()

        if not data or len(data) < 2:
            return {}

        # First row is header, rest are data
        headers = data[0]
        pop_idx = 0
        state_idx = len(headers) - 3  # state is second-to-last
        county_idx = len(headers) - 2  # county is in middle
        tract_idx = len(headers) - 1   # tract is last

        result = {}
        for row in data[1:]:
            try:
                pop = int(row[pop_idx]) if row[pop_idx] is not None else 0
                state_fips_val = row[state_idx]
                county_fips = row[county_idx].zfill(3)
                tract = row[tract_idx].zfill(6)

                # Construct GEOID: state (2) + county (3) + tract (6)
                geoid = f"{state_fips_val}{county_fips}{tract}"
                result[geoid] = pop
            except (ValueError, IndexError):
                continue

        return result
    except requests.RequestException as e:
        print(f"Error fetching {year} data: {e}", file=sys.stderr)
        return {}


def fetch_state_data(state_fips: str) -> dict:
    """
    Fetch all census data for a state across multiple years.
    Returns dict of GEOID -> {year: population}
    """
    print(f"Fetching census data for state {state_fips}...")

    all_data = {}

    # Fetch 2000, 2010, 2020 decennial census
    for year in [2000, 2010, 2020]:
        print(f"  {year}...", end=" ", flush=True)
        year_data = fetch_census_year(state_fips, year, "", "")

        for geoid, pop in year_data.items():
            if geoid not in all_data:
                all_data[geoid] = {}
            all_data[geoid][str(year)] = pop

        print(f"({len(year_data)} tracts)")

    # Fetch ACS 5-year estimates (2009-2023)
    # Each ACS year represents the 5-year period ending that year
    for year in range(2009, 2024):
        print(f"  ACS {year}...", end=" ", flush=True)
        year_data = fetch_census_year(state_fips, year, "", "")

        for geoid, pop in year_data.items():
            if geoid not in all_data:
                all_data[geoid] = {}
            all_data[geoid][str(year)] = pop

        print(f"({len(year_data)} tracts)")

    return all_data


def main():
    parser = argparse.ArgumentParser(
        description="Download US Census population data by tract"
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

    output_dir = Path("data/population")
    output_dir.mkdir(parents=True, exist_ok=True)

    for state_fips in states_to_process:
        data = fetch_state_data(state_fips)

        if data:
            output_file = output_dir / f"{state_fips}.json"
            with open(output_file, "w") as f:
                json.dump(data, f, indent=2)
            print(f"Saved {len(data)} tracts to {output_file}\n")
        else:
            print(f"No data retrieved for state {state_fips}\n")


if __name__ == "__main__":
    main()
