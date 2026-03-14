#!/usr/bin/env python3
"""Run the pipeline for all states in parallel."""

# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "geopandas", "shapely", "pandas"]
# ///

import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

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

def run_state(fips):
    """Run pipeline for a single state, return (fips, success, duration)."""
    start = time.time()
    abbr = STATE_FIPS_CODES[fips]
    try:
        result = subprocess.run(
            ["uv", "run", "scripts/pipeline.py", "--state", fips],
            capture_output=True, text=True, timeout=600
        )
        duration = time.time() - start
        ok = result.returncode == 0
        if not ok:
            print(f"  FAIL {abbr}: {result.stderr[:200]}", file=sys.stderr)
        return fips, ok, duration
    except Exception as e:
        return fips, False, time.time() - start

def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 6

    # Skip states that already have PMTiles
    remaining = []
    for fips in sorted(STATE_FIPS_CODES.keys()):
        pmtiles_2020 = Path(f"data/pmtiles/{fips}_2020.pmtiles")
        if pmtiles_2020.exists():
            print(f"  Skip {STATE_FIPS_CODES[fips]} (already built)")
        else:
            remaining.append(fips)

    print(f"\nBuilding {len(remaining)} states with {workers} workers...\n")
    start = time.time()
    done = 0
    failed = []

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(run_state, fips): fips for fips in remaining}
        for future in as_completed(futures):
            fips, ok, dur = future.result()
            done += 1
            abbr = STATE_FIPS_CODES[fips]
            status = "OK" if ok else "FAIL"
            print(f"  [{done}/{len(remaining)}] {abbr}: {status} ({dur:.0f}s)")
            if not ok:
                failed.append(fips)

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.0f}s. {len(remaining) - len(failed)}/{len(remaining)} succeeded.")
    if failed:
        print(f"Failed: {', '.join(STATE_FIPS_CODES[f] for f in failed)}")

if __name__ == "__main__":
    main()
