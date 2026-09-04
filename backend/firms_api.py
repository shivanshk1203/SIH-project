"""
firms_api.py

Gets thermal hotspot data (fires / thermal anomalies detected by satellite sensors)
specifically and strictly for INDIA ONLY.
Real data source: NASA FIRMS (Fire Information for Resource Management System)
https://firms.modaps.eosdis.nasa.gov/api/

Supports normalized geographic caching (5-min TTL),
strict India bounding box validation/clamping, polygon-based country filtering,
request deduplication, stable unique IDs, and secure error surfacing.
"""

import os
import csv
import io
import json
import math
import time
import requests
from dotenv import load_dotenv

import india_boundary

# Load .env from backend/ or parent directory reliably
_base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_base_dir, ".env"))
load_dotenv(os.path.join(os.path.dirname(_base_dir), ".env"))

# India approximate geographic bounding box: 68.0, 6.0, 97.5, 37.5
INDIA_WEST = 68.0
INDIA_SOUTH = 6.0
INDIA_EAST = 97.5
INDIA_NORTH = 37.5

DEFAULT_AREA = f"{INDIA_WEST},{INDIA_SOUTH},{INDIA_EAST},{INDIA_NORTH}"

SAMPLE_DATA_PATH = os.path.join(_base_dir, "sample_hotspots.json")

# Geographic request-aware cache: normalized_key -> {"data": [...], "timestamp": float}
_firms_cache: dict[str, dict] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _normalize_bounds(west: float, south: float, east: float, north: float, step: float = 0.25) -> tuple[float, float, float, float]:
    """
    Snap coordinates outward to coarse grid steps (0.25 deg ~ 25 km) within India.
    This ensures minor pans and zooms reuse the same cached bounding region.
    """
    n_w = max(INDIA_WEST, round(math.floor(west / step) * step, 2))
    n_s = max(INDIA_SOUTH, round(math.floor(south / step) * step, 2))
    n_e = min(INDIA_EAST, round(math.ceil(east / step) * step, 2))
    n_n = min(INDIA_NORTH, round(math.ceil(north / step) * step, 2))
    return n_w, n_s, n_e, n_n


def get_hotspots(
    west: float | None = None,
    south: float | None = None,
    east: float | None = None,
    north: float | None = None,
    day_range: int = 3,
) -> list[dict]:
    """
    Returns a list of hotspot dictionaries strictly within India's territory.
    [
      {
        "id": str,
        "latitude": float,
        "longitude": float,
        "brightness": float,
        "confidence": int,
        "detected_at": str,
        "is_demo_data": bool
      },
      ...
    ]
    """
    global _firms_cache

    # Clamp day_range between 1 and 5 (VIIRS NRT Area API limit)
    day_range = max(1, min(5, day_range))

    # 1. Determine and clamp bounding box coordinates to India
    if west is not None and south is not None and east is not None and north is not None:
        # Check for overlap with India bounding box
        clamped_w = max(west, INDIA_WEST)
        clamped_s = max(south, INDIA_SOUTH)
        clamped_e = min(east, INDIA_EAST)
        clamped_n = min(north, INDIA_NORTH)

        if clamped_w >= clamped_e or clamped_s >= clamped_n:
            print(f"[hotspots] viewport bbox: west={west}, south={south}, east={east}, north={north}")
            print(f"[hotspots] Viewport outside India. Returning 0 hotspots.")
            return []

        n_w, n_s, n_e, n_n = _normalize_bounds(clamped_w, clamped_s, clamped_e, clamped_n)
        area_str = f"{n_w},{n_s},{n_e},{n_n}"
        cache_key = f"india_{n_w:.2f}_{n_s:.2f}_{n_e:.2f}_{n_n:.2f}_{day_range}d"
    else:
        area_str = DEFAULT_AREA
        cache_key = f"india_default_{day_range}d"
        n_w, n_s, n_e, n_n = INDIA_WEST, INDIA_SOUTH, INDIA_EAST, INDIA_NORTH

    api_key = os.getenv("FIRMS_MAP_KEY")

    # 2. Check geographic cache
    now = time.time()
    if cache_key in _firms_cache:
        entry = _firms_cache[cache_key]
        if now - entry["timestamp"] < CACHE_TTL_SECONDS:
            cached_data = entry["data"]
            print(f"[firms_api] Cache hit: {cache_key} ({len(cached_data)} hotspots)")
            print(f"[hotspots] viewport bbox: west={west}, south={south}, east={east}, north={north}")
            print(f"[hotspots] FIRMS bbox: {area_str}")
            print(f"[hotspots] source: NASA FIRMS (VIIRS_SNPP_NRT, {day_range} days) [CACHED]")
            print(f"[hotspots] records returned: {len(cached_data)}")
            print(f"[hotspots] records after India filter: {len(cached_data)}")
            print(f"[hotspots] records rendered: {len(cached_data)}")
            print(f"[hotspots] demo data: False")
            return cached_data
        else:
            del _firms_cache[cache_key]

    print(f"[firms_api] Cache miss: {cache_key}")

    # 3. Handle missing API key (explicit demo fallback for India)
    if not api_key:
        print("[firms_api] No FIRMS_MAP_KEY set, using sample data.")
        demo_data = _load_sample_data(n_w, n_s, n_e, n_n)
        _firms_cache[cache_key] = {"data": demo_data, "timestamp": now}
        print(f"[hotspots] source: sample_hotspots.json (demo data)")
        print(f"[hotspots] records returned: {len(demo_data)}")
        print(f"[hotspots] records after India filter: {len(demo_data)}")
        print(f"[hotspots] demo data: True")
        return demo_data

    # 4. Fetch real FIRMS data for this India geographic region
    print(f"[hotspots] viewport bbox: west={west}, south={south}, east={east}, north={north}")
    print(f"[hotspots] FIRMS bbox: {area_str}")
    print(f"[hotspots] source: NASA FIRMS (VIIRS_SNPP_NRT, {day_range} days)")

    try:
        raw_data = _fetch_real_firms_data(api_key, area_str, day_range)
        print(f"[hotspots] records returned: {len(raw_data)}")

        # Second geographic validation: filter strictly to India mainland and island boundaries,
        # removing points falling into neighboring countries or open ocean.
        filtered_data = [
            h for h in raw_data
            if india_boundary.is_inside_india(h["latitude"], h["longitude"])
        ]
        print(f"[hotspots] records after India filter: {len(filtered_data)}")
        print(f"[hotspots] records rendered: {len(filtered_data)}")
        print(f"[hotspots] demo data: False")

        _firms_cache[cache_key] = {"data": filtered_data, "timestamp": now}
        print(f"[firms_api] Returning {len(filtered_data)} hotspots to frontend")
        return filtered_data
    except Exception as error:
        sanitized_error = str(error)
        if api_key:
            sanitized_error = sanitized_error.replace(api_key, "***")
        print(f"[firms_api] NASA FIRMS request failed: {sanitized_error}")
        raise RuntimeError(f"NASA FIRMS API request failed: {sanitized_error}") from None


def _fetch_real_firms_data(api_key: str, area_str: str, day_range: int = 3) -> list[dict]:
    """Calls NASA FIRMS API for the specified India area string (west,south,east,north)."""
    # VIIRS 375m sensor (NRT), day range (1-5)
    url = (
        f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
        f"{api_key}/VIIRS_SNPP_NRT/{area_str}/{day_range}"
    )

    response = requests.get(url, timeout=25)
    response.raise_for_status()

    # If response is HTML, the API key is invalid or rate limited
    if response.text.strip().startswith("<"):
        raise ValueError("NASA FIRMS returned HTML instead of CSV - API key may be invalid, rate-limited, or expired.")

    hotspots = []
    csv_reader = csv.DictReader(io.StringIO(response.text))

    for row_index, row in enumerate(csv_reader):
        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            date_raw = row.get("acq_date", "").replace("-", "")
            time_raw = row.get("acq_time", "0000").zfill(4)
            # Globally unique, stable identifier
            unique_id = f"firms-{lat:.4f}_{lon:.4f}_{date_raw}_{time_raw}_{row_index}"

            date_str = row.get("acq_date", "")
            time_str = row.get("acq_time", "0000").zfill(4)
            frp_val = None
            if row.get("frp"):
                try:
                    frp_val = round(float(row["frp"]), 2)
                except (ValueError, TypeError):
                    frp_val = None

            scan_val = None
            if row.get("scan"):
                try:
                    scan_val = round(float(row["scan"]), 2)
                except (ValueError, TypeError):
                    scan_val = None

            track_val = None
            if row.get("track"):
                try:
                    track_val = round(float(row["track"]), 2)
                except (ValueError, TypeError):
                    track_val = None

            bright_ti4 = float(row.get("bright_ti4", 300))
            bright_ti5 = None
            if row.get("bright_ti5"):
                try:
                    bright_ti5 = round(float(row["bright_ti5"]), 2)
                except (ValueError, TypeError):
                    bright_ti5 = None

            hotspots.append({
                "id": unique_id,
                "latitude": lat,
                "longitude": lon,
                "brightness": bright_ti4,
                "bright_ti4": bright_ti4,
                "bright_ti5": bright_ti5,
                "frp": frp_val,
                "confidence": _parse_confidence(row.get("confidence", "50")),
                "confidence_raw": str(row.get("confidence", "nominal")),
                "detected_at": f"{date_str}T{time_str}",
                "acq_date": date_str,
                "acq_time": time_str,
                "satellite": row.get("satellite", "SNPP"),
                "instrument": row.get("instrument", "VIIRS"),
                "daynight": row.get("daynight", "D"),
                "scan": scan_val,
                "track": track_val,
                "is_demo_data": False,
            })
        except (KeyError, ValueError):
            continue

    return hotspots


def _parse_confidence(value):
    """FIRMS returns confidence as 'low'/'nominal'/'high' or a numeric string."""
    text_to_number = {"low": 30, "nominal": 60, "high": 90}
    if isinstance(value, str) and value.lower() in text_to_number:
        return text_to_number[value.lower()]
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return 50


def _load_sample_data(west=None, south=None, east=None, north=None) -> list[dict]:
    """Loads demo sample hotspots for India and filters to bounds if applicable."""
    if not os.path.exists(SAMPLE_DATA_PATH):
        return []

    with open(SAMPLE_DATA_PATH, "r", encoding="utf-8") as f:
        hotspots = json.load(f)

    results = []
    for h in hotspots:
        h_copy = dict(h)
        h_copy["is_demo_data"] = True
        h_copy.setdefault("bright_ti4", h_copy.get("brightness", 330.0))
        h_copy.setdefault("bright_ti5", round(h_copy.get("brightness", 330.0) - 25.0, 1))
        h_copy.setdefault("frp", 12.5)
        h_copy.setdefault("satellite", "SNPP")
        h_copy.setdefault("instrument", "VIIRS")
        h_copy.setdefault("daynight", "D")
        h_copy.setdefault("scan", 0.42)
        h_copy.setdefault("track", 0.38)
        h_copy.setdefault("confidence_raw", "nominal" if h_copy.get("confidence", 50) < 80 else "high")
        det = h_copy.get("detected_at", "")
        if "T" in det:
            parts = det.split("T")
            h_copy.setdefault("acq_date", parts[0])
            h_copy.setdefault("acq_time", parts[1].replace(":", "")[:4])
        else:
            h_copy.setdefault("acq_date", det)
            h_copy.setdefault("acq_time", "0600")

        if west is not None and south is not None and east is not None and north is not None:
            if south <= h_copy["latitude"] <= north and west <= h_copy["longitude"] <= east:
                if india_boundary.is_inside_india(h_copy["latitude"], h_copy["longitude"]):
                    results.append(h_copy)
        else:
            if india_boundary.is_inside_india(h_copy["latitude"], h_copy["longitude"]):
                results.append(h_copy)

    return results if results else [dict(h, is_demo_data=True) for h in hotspots]
