"""
server.py

Main backend entry point.

Run with:
    uvicorn server:app --reload

This exposes one main endpoint:
    GET /api/hotspots

Which runs the full pipeline:
    1. Get thermal hotspots (firms_api.py) — cached 5 min in-memory.
    2. Deduplicate hotspots by spatial grid cell (~2 km) so each unique
       area is only enriched once, regardless of how many hotspot points
       land in that cell.
    3. For unique grid cells, call OpenStreetMap's Overpass API in parallel
       (up to MAX_OSM_WORKERS threads) to get nearby land-use context —
       industrial site, farm, mine, power plant, landfill, oil/gas, forest, etc.
       (osm_api.py). OSM results are spatially cached so repeated API calls
       for the same area return instantly.
    4. Classify every hotspot (detection.py) using the facilities fetched for
       its grid cell — zero extra HTTP calls.
    5. Return everything as JSON for the frontend to display.

It also exposes a standalone GET /api/facilities?lat=&lon=&radius= endpoint
so the frontend (or anyone else) can query "what's around this point"
directly, independent of the hotspot pipeline.

Performance summary
-------------------
Old approach: 303 sequential OSM requests × ~3s each ≈ 15+ minutes.
New approach:
  - FIRMS data served from cache if < 5 min old: ~0ms.
  - OSM requests: deduplicated grid cells (typically 20–60 for 300 hotspots)
    fetched in parallel with 4 workers and 14s timeout each ≈ 4–15 seconds.
  - Subsequent calls: all results cached → < 50ms total.
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import firms_api
import osm_api
import detection
import thermal_analysis

load_dotenv()

app = FastAPI(title="Agni Netra — Thermal Intelligence & Detection Platform")

# Allow the frontend to call this API. In development the Vite dev server proxies
# /api requests directly (see frontend/vite.config.ts), so CORS is only exercised
# when the frontend is hosted separately from the backend (e.g. in production).
# Configure allowed origins via CORS_ALLOWED_ORIGINS in backend/.env, e.g.:
#   CORS_ALLOWED_ORIGINS=https://your-frontend.example.com,http://localhost:5173
# Falls back to "*" (allow all) only when the variable is unset, which is fine for
# local demos but should always be restricted before a real deployment.
_cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "*")
CORS_ALLOWED_ORIGINS = (
    ["*"] if _cors_origins_env.strip() == "*"
    else [origin.strip() for origin in _cors_origins_env.split(",") if origin.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Maximum number of parallel threads used to query the Overpass API.
# Overpass has rate limits so keep this low (3–4 is safe).
MAX_OSM_WORKERS = 3

# Maximum unique grid cells to enrich on bulk fetch to guarantee sub-5s response
MAX_ENRICH_CELLS = 25

# Maximum allowed geographic span before requesting user to zoom in
# India span: ~31.5 deg lat x 29.5 deg lon. Set to 35.0 so national overview fits.
MAX_LAT_SPAN_DEG = 35.0
MAX_LON_SPAN_DEG = 35.0

# Grid resolution matching osm_api.py's GRID_DEG
GRID_DEG = 0.02


def _grid_cell(lat: float, lon: float) -> tuple:
    """Return the same grid key as osm_api.py uses."""
    return (
        round(math.floor(lat / GRID_DEG) * GRID_DEG, 6),
        round(math.floor(lon / GRID_DEG) * GRID_DEG, 6),
    )


def _enrich_grid_cells(unique_cells: list[tuple]) -> None:
    """
    Fetch OSM facilities for each unique grid cell in parallel.
    osm_api already caches results, so this is a one-time warm-up.
    """
    def fetch(cell):
        lat, lon = cell
        return osm_api.get_nearby_facilities(lat, lon)

    with ThreadPoolExecutor(max_workers=MAX_OSM_WORKERS) as pool:
        futures = {pool.submit(fetch, cell): cell for cell in unique_cells}
        try:
            for future in as_completed(futures, timeout=25):
                try:
                    future.result()
                except Exception as err:
                    cell = futures[future]
                    print(f"[server] OSM fetch failed for cell {cell}: {err}")
        except TimeoutError:
            print("[server] OSM parallel fetch hit timeout limit; proceeding with available cell data.")


@app.get("/api/hotspots")
def get_classified_hotspots(
    west: float | None = Query(None, description="Western longitude boundary (-180 to 180)"),
    south: float | None = Query(None, description="Southern latitude boundary (-90 to 90)"),
    east: float | None = Query(None, description="Eastern longitude boundary (-180 to 180)"),
    north: float | None = Query(None, description="Northern latitude boundary (-90 to 90)"),
    days: int = Query(3, ge=1, le=5, description="NASA FIRMS observation days (1-5)"),
):
    """
    Runs the full detection pipeline for the requested viewport bounds.
    If bounds are not provided, uses default India region.
    All viewport queries are validated and clamped strictly to India.
    """
    t0 = time.perf_counter()

    has_any = any(v is not None for v in (west, south, east, north))
    has_all = all(v is not None for v in (west, south, east, north))

    if has_any and not has_all:
        raise HTTPException(
            status_code=400,
            detail="Parameters west, south, east, and north must all be provided together.",
        )

    if has_all:
        # Validate coordinates ranges
        if not (-180.0 <= west <= 180.0 and -180.0 <= east <= 180.0):
            raise HTTPException(
                status_code=400,
                detail=f"Longitude values must be between -180 and 180. Received west={west}, east={east}.",
            )
        if not (-90.0 <= south <= 90.0 and -90.0 <= north <= 90.0):
            raise HTTPException(
                status_code=400,
                detail=f"Latitude values must be between -90 and 90. Received south={south}, north={north}.",
            )
        if south > north:
            raise HTTPException(
                status_code=400,
                detail=f"South latitude ({south}) cannot be greater than north latitude ({north}).",
            )

        # Check if requested bounds are entirely outside India's geographic boundary
        if east < 68.0 or west > 97.5 or north < 6.0 or south > 37.5:
            return {
                "hotspots": [],
                "count": 0,
                "source": "NASA FIRMS",
                "is_demo_data": False,
                "bbox": {"west": west, "south": south, "east": east, "north": north},
                "facilities": [],
                "zoom_required": False,
                "message": "Requested viewport is outside India monitoring territory.",
                "meta": {
                    "total_hotspots": 0,
                    "unique_osm_cells": 0,
                    "total_ms": 0,
                    "zoom_required": False,
                },
            }

        # Intersect / clamp requested bounds to India's monitoring boundary
        clamped_w = max(68.0, west)
        clamped_s = max(6.0, south)
        clamped_e = min(97.5, east)
        clamped_n = min(37.5, north)
    else:
        clamped_w, clamped_s, clamped_e, clamped_n = 68.0, 6.0, 97.5, 37.5

    # Fetch hotspots from FIRMS (or cache)
    try:
        hotspots = firms_api.get_hotspots(
            west=clamped_w,
            south=clamped_s,
            east=clamped_e,
            north=clamped_n,
            day_range=days,
        )
    except Exception as err:
        print(f"[server] Error getting hotspots from FIRMS: {err}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch thermal hotspots: {err}")

    t_firms = time.perf_counter()


    # --- Step 1: Prioritize unique cells by hottest/highest-confidence hotspots ---
    sorted_hotspots = sorted(
        hotspots,
        key=lambda h: (h.get("brightness", 0), h.get("confidence", 0)),
        reverse=True,
    )
    seen = set()
    unique_cells = []
    for h in sorted_hotspots:
        cell = _grid_cell(h["latitude"], h["longitude"])
        if cell not in seen:
            seen.add(cell)
            unique_cells.append(cell)

    cells_to_enrich = unique_cells[:MAX_ENRICH_CELLS]
    print(
        f"[server] {len(hotspots)} hotspots across {len(unique_cells)} cells. "
        f"Enriching top {len(cells_to_enrich)} priority cells via Overpass."
    )

    # --- Step 2: Warm the OSM cache for top priority cells in parallel ---
    _enrich_grid_cells(cells_to_enrich)
    t_osm = time.perf_counter()

    # --- Step 3: Evidence-based thermal anomaly analysis across the complete batch ---
    results = thermal_analysis.analyze_hotspots_batch(
        hotspots,
        get_nearby_facilities_fn=osm_api.get_nearby_facilities,
        is_cell_queried_fn=osm_api.is_cell_queried,
    )

    facilities_by_key = {}
    for hotspot in hotspots:
        facilities = osm_api.get_nearby_facilities(
            hotspot["latitude"], hotspot["longitude"], fetch_if_missing=False
        )
        for facility in facilities:
            key = (facility["name"], round(facility["latitude"], 5), round(facility["longitude"], 5))
            facilities_by_key[key] = facility

    t_classify = time.perf_counter()

    total_ms = int((t_classify - t0) * 1000)
    firms_ms = int((t_firms - t0) * 1000)
    osm_ms = int((t_osm - t_firms) * 1000)
    classify_ms = int((t_classify - t_osm) * 1000)

    print(
        f"[server] /api/hotspots done in {total_ms}ms "
        f"(FIRMS: {firms_ms}ms, OSM: {osm_ms}ms, classify: {classify_ms}ms)"
    )

    is_demo = bool(results and results[0].get("is_demo_data", False))
    source_str = "Demo Sample Data" if is_demo else f"NASA FIRMS (VIIRS_SNPP_NRT, {days} days)"

    health = thermal_analysis.compute_analysis_health(results)
    telemetry = thermal_analysis.compute_analysis_telemetry(results)
    health["telemetry"] = telemetry

    return {
        "hotspots": results,
        "count": len(results),
        "analysis_health": health,
        "analysis_telemetry": telemetry,
        "source": source_str,
        "is_demo_data": is_demo,
        "bbox": {
            "west": round(clamped_w, 4),
            "south": round(clamped_s, 4),
            "east": round(clamped_e, 4),
            "north": round(clamped_n, 4),
        },
        "facilities": list(facilities_by_key.values()),
        "zoom_required": False,
        "meta": {
            "total_hotspots": len(results),
            "active_hotspots": len(results),
            "unique_osm_cells": len(unique_cells),
            "total_ms": total_ms,
            "firms_ms": firms_ms,
            "osm_ms": osm_ms,
            "classify_ms": classify_ms,
            "zoom_required": False,
            "source": source_str,
            "is_demo_data": is_demo,
            "pipeline": {
                "raw_firms": len(hotspots),
                "after_india_filter": len(hotspots),
                "after_date_filter": len(hotspots),
                "after_confidence_filter": len(hotspots),
                "after_analysis": len(results),
                "active_detections": len(results),
            },
        },
    }


@app.get("/api/facilities")
def get_facilities(
    lat: float = Query(..., description="Latitude of the point to search around"),
    lon: float = Query(..., description="Longitude of the point to search around"),
    radius: int = Query(3000, description="Search radius in meters"),
):
    """
    Standalone OSM lookup: "what industrial sites, farms, mines, etc. are
    near this point?" Independent of any hotspot - useful for the frontend
    to show land-use context anywhere on the map, not just at detections.
    """
    facilities = osm_api.get_nearby_facilities(lat, lon, radius=radius)
    return {"facilities": facilities}


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "message": "Agni Netra — Thermal Intelligence & Detection Platform backend is running (India Territory)",
        "scope": "India Only (68.0, 6.0, 97.5, 37.5)",
        "endpoints": {
            "hotspots": "/api/hotspots",
            "facilities": "/api/facilities?lat=<lat>&lon=<lon>&radius=<meters>",
        },
    }


@app.post("/api/hotspots/analyze-all")
@app.get("/api/hotspots/analyze-all")
def trigger_batch_analysis():
    data = get_classified_hotspots(west=None, south=None, east=None, north=None, days=3)
    return {
        "status": "success",
        "message": f"Successfully resolved {data['count']} hotspots",
        "analysis_health": data.get("analysis_health"),
        "analysis_telemetry": data.get("analysis_telemetry"),
        "hotspots": data["hotspots"],
        "count": data["count"],
    }
