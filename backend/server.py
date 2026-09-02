"""
server.py

Main backend entry point.

Run with:
    uvicorn server:app --reload

This exposes one main endpoint:
    GET /api/hotspots

Which runs the full pipeline:
    1. Get thermal hotspots (firms_api.py)
    2. For each hotspot, get nearby land-use context via OpenStreetMap's
       Overpass API - industrial site, farm, mine, power plant, landfill,
       oil/gas, forest, etc. (osm_api.py)
    3. Calculate distance + classify the hotspot (detection.py)
    4. Return everything as JSON for the frontend to display, including a
       deduplicated "facilities" layer so the map can plot hotspots
       together with the real-world sites around them.

It also exposes a standalone GET /api/facilities?lat=&lon=&radius= endpoint
so the frontend (or anyone else) can query "what's around this point"
directly, independent of the hotspot pipeline.
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import firms_api
import osm_api
import detection

load_dotenv()  # reads variables from a local .env file, if present

app = FastAPI(title="Industrial Fire Detection Prototype")

# Allow the frontend (running on a different port during development) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hotspots")
def get_classified_hotspots():
    """
    Runs the full detection pipeline and returns:
      - "hotspots": each with its nearest facility/land-use, distance,
        classification, reasons, and a "location_type" telling you what
        kind of place the hotspot is actually sitting in or near
        (industrial / farm / mine / power_plant / landfill / oil_gas /
        forest / residential / None).
      - "facilities": a deduplicated list of every OSM land-use feature
        found near any hotspot, for the map to draw as its own layer
        (so you can see hotspots *and* the surrounding facilities/farms/
        mines together on one map).
    """
    hotspots = firms_api.get_hotspots()
    results = []
    facilities_by_key = {}  # dedupe facilities across overlapping searches

    for hotspot in hotspots:
        facilities = osm_api.get_nearby_facilities(hotspot["latitude"], hotspot["longitude"])
        nearest_facility, distance = detection.find_nearest_facility(hotspot, facilities)
        classification_result = detection.classify_hotspot(hotspot, nearest_facility, distance)

        for facility in facilities:
            key = (facility["name"], round(facility["latitude"], 5), round(facility["longitude"], 5))
            facilities_by_key[key] = facility

        results.append({
            "id": hotspot["id"],
            "latitude": hotspot["latitude"],
            "longitude": hotspot["longitude"],
            "brightness": hotspot["brightness"],
            "detection_confidence": hotspot["confidence"],
            "detected_at": hotspot["detected_at"],
            "is_demo_data": hotspot.get("is_demo_data", False),
            "nearest_facility": nearest_facility["name"] if nearest_facility else None,
            "distance_to_facility_m": round(distance) if distance is not None else None,
            "location_type": classification_result.get("location_type"),
            "location_type_label": classification_result.get("location_type_label"),
            "classification": classification_result["classification"],
            "confidence": classification_result["confidence"],
            "reasons": classification_result["reasons"],
        })

    return {"hotspots": results, "facilities": list(facilities_by_key.values())}


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
    return {"status": "ok", "message": "Industrial Fire Detection backend is running"}
