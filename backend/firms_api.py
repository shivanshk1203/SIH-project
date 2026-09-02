"""
firms_api.py

Gets thermal hotspot data (fires / hot spots detected from satellites).

Real data source: NASA FIRMS (Fire Information for Resource Management System)
https://firms.modaps.eosdis.nasa.gov/api/

If no API key is set, or the request fails, we fall back to a small local
sample file (sample_hotspots.json) so the app still works for demos.
"""

import os
import csv
import io
import json
import requests

# Area we are watching (demo area: part of Texas, USA).
# In a real system this could be user-selected on the map.
DEMO_AREA = "-98,28,-94,32"  # west, south, east, north (longitude/latitude box)

SAMPLE_DATA_PATH = os.path.join(os.path.dirname(__file__), "sample_hotspots.json")


def get_hotspots():
    """
    Returns a list of hotspot dictionaries:
    [
      {
        "id": str,
        "latitude": float,
        "longitude": float,
        "brightness": float,   # thermal intensity (Kelvin-ish scale from FIRMS)
        "confidence": int,     # 0-100, how confident FIRMS is this is a real detection
        "detected_at": str,    # ISO timestamp
        "is_demo_data": bool
      },
      ...
    ]
    """
    api_key = os.getenv("FIRMS_MAP_KEY")

    # No key configured -> use sample data
    if not api_key:
        return _load_sample_data()

    try:
        return _fetch_real_firms_data(api_key)
    except Exception as error:
        # If the real API call fails for any reason (network, bad key, etc.)
        # we don't want the whole app to crash. Fall back to sample data.
        print(f"[firms_api] Could not fetch real FIRMS data, using sample data. Reason: {error}")
        return _load_sample_data()


def _fetch_real_firms_data(api_key):
    """Calls the real NASA FIRMS API and converts the CSV response into our format."""

    # FIRMS provides data as CSV. We use the VIIRS 375m sensor, last 1 day.
    url = (
        f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
        f"{api_key}/VIIRS_SNPP_NRT/{DEMO_AREA}/1"
    )

    response = requests.get(url, timeout=15)
    response.raise_for_status()

    hotspots = []
    csv_reader = csv.DictReader(io.StringIO(response.text))

    for row_index, row in enumerate(csv_reader):
        hotspots.append({
            "id": f"firms-{row_index}",
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "brightness": float(row.get("bright_ti4", 300)),
            "confidence": _parse_confidence(row.get("confidence", "50")),
            "detected_at": f"{row.get('acq_date', '')}T{row.get('acq_time', '0000')}",
            "is_demo_data": False,
        })

    return hotspots


def _parse_confidence(value):
    """FIRMS sometimes returns confidence as 'low'/'nominal'/'high' or a number."""
    text_to_number = {"low": 30, "nominal": 60, "high": 90}
    if value.lower() in text_to_number:
        return text_to_number[value.lower()]
    try:
        return int(float(value))
    except ValueError:
        return 50


def _load_sample_data():
    with open(SAMPLE_DATA_PATH, "r") as f:
        hotspots = json.load(f)

    for hotspot in hotspots:
        hotspot["is_demo_data"] = True

    return hotspots
