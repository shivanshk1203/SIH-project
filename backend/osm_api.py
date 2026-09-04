"""
osm_api.py

Gets real-world land-use context around a hotspot using OpenStreetMap's
Overpass API (free, no API key needed).

Performance enhancements:
  - Results are cached in-memory keyed by a rounded grid cell (~2 km squares),
    so nearby hotspots that share the same cell reuse the same data instantly.
  - Tighter connection/read timeouts prevent any single call from hanging the
    pipeline for more than 5 seconds.
  - The Overpass query timeout is set to 8s so the server-side doesn't accumulate
    waiting slots either.
"""

import requests
import math
import time

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Mirrors, tried in order if the primary Overpass instance is down/busy.
OVERPASS_FALLBACK_URLS = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

USER_AGENT = "IndustrialFireDetectionPrototype/1.0 (https://github.com/shivanshk1203/SIH-project)"

# Circuit breaker: if Overpass servers are unreachable/timing out, pause calls for 60s
# so the backend remains responsive (< 500ms) without stalling.
_circuit_open_until = 0.0



# How far around a hotspot we search for land-use features (in meters).
SEARCH_RADIUS_METERS = 2000


# Grid resolution for caching: round coords to nearest GRID_DEG degrees (~2 km)
GRID_DEG = 0.02

# In-memory spatial cache: grid_key -> list of facilities
_osm_cache: dict[tuple, list] = {}

# --- Land-use categories we can recognize, and the OSM tags that map to them ---
CATEGORY_TAGS = {
    "industrial": [
        ("landuse", "industrial"),
        ("man_made", "works"),
        ("building", "industrial"),
        ("building", "warehouse"),
    ],
    "power_plant": [
        ("power", "plant"),
        ("power", "generator"),
    ],
    "oil_gas": [
        ("man_made", "petroleum_well"),
        ("man_made", "pumping_station"),
        ("pipeline", "substation"),
    ],
    "mine": [
        ("landuse", "quarry"),
        ("man_made", "mineshaft"),
        ("man_made", "adit"),
        ("man_made", "spoil_heap"),
    ],
    "landfill": [
        ("landuse", "landfill"),
    ],
    "farm": [
        ("landuse", "farmland"),
        ("landuse", "farmyard"),
        ("landuse", "orchard"),
        ("building", "farm"),
        ("building", "farm_auxiliary"),
        ("building", "barn"),
    ],
    "forest": [
        ("landuse", "forest"),
        ("natural", "wood"),
    ],
    "residential": [
        ("landuse", "residential"),
    ],
    "brick_kiln": [
        ("man_made", "kiln"),
        ("industrial", "brickyard"),
        ("landuse", "brickfield"),
    ],
    "road": [
        ("highway", "primary"),
        ("highway", "secondary"),
        ("highway", "trunk"),
        ("highway", "motorway"),
    ],
    "railway": [
        ("railway", "rail"),
    ],
}

# Human-friendly labels for each category, used in the UI / reasons text.
CATEGORY_LABELS = {
    "industrial": "Industrial facility",
    "power_plant": "Power plant",
    "oil_gas": "Oil/gas infrastructure",
    "mine": "Mine or quarry",
    "landfill": "Landfill",
    "farm": "Farm / agricultural land",
    "forest": "Forest / vegetation",
    "residential": "Residential area",
    "brick_kiln": "Brick kiln",
    "road": "Highway / Major road",
    "railway": "Railway line",
}

_ALL_TAG_PAIRS = [
    (category, key, value)
    for category, pairs in CATEGORY_TAGS.items()
    for key, value in pairs
]


def _grid_key(latitude: float, longitude: float) -> tuple:
    """Round coords to a coarse grid cell for cache lookup."""
    return (
        round(math.floor(latitude / GRID_DEG) * GRID_DEG, 6),
        round(math.floor(longitude / GRID_DEG) * GRID_DEG, 6),
    )


def _build_query(latitude, longitude, radius):
    return f"""[out:json][timeout:5];
(
  nwr["landuse"~"industrial|farmland|farmyard|orchard|quarry|landfill|forest|residential"](around:{radius},{latitude},{longitude});
  nwr["power"~"plant|generator"](around:{radius},{latitude},{longitude});
  nwr["man_made"~"works|mineshaft|adit|spoil_heap|petroleum_well|pumping_station"](around:{radius},{latitude},{longitude});
  nwr["building"~"industrial|warehouse|farm|farm_auxiliary|barn"](around:{radius},{latitude},{longitude});
  nwr["natural"="wood"](around:{radius},{latitude},{longitude});
  nwr["pipeline"="substation"](around:{radius},{latitude},{longitude});
);
out center 25;"""



def _tags_to_category(tags):
    """Given an OSM element's tags, figure out which of our categories it matches."""
    for category, pairs in CATEGORY_TAGS.items():
        for key, value in pairs:
            if tags.get(key) == value:
                return category
    return None


def get_nearby_facilities(latitude, longitude, radius=SEARCH_RADIUS_METERS, fetch_if_missing=True):
    """
    Returns a list of nearby land-use features, each categorized.
    Results are spatially cached by ~2km grid cell so repeated calls for
    hotspots in the same area return instantly from memory.
    """
    key = _grid_key(latitude, longitude)

    if key in _osm_cache:
        return _osm_cache[key]

    if not fetch_if_missing:
        return []

    query = _build_query(latitude, longitude, radius)
    data = _query_overpass(query)

    if data is None:
        _osm_cache[key] = []
        return []

    facilities = []
    for element in data.get("elements", []):
        lat = element.get("lat") or element.get("center", {}).get("lat")
        lon = element.get("lon") or element.get("center", {}).get("lon")

        if lat is None or lon is None:
            continue

        tags = element.get("tags", {})
        category = _tags_to_category(tags)
        if category is None:
            continue

        name = tags.get("name") or f"Unnamed {CATEGORY_LABELS[category].lower()}"

        facilities.append({
            "name": name,
            "type": category,
            "type_label": CATEGORY_LABELS[category],
            "latitude": lat,
            "longitude": lon,
        })

    _osm_cache[key] = facilities
    return facilities


def _query_overpass(query):
    """Tries the primary Overpass endpoint, then falls back to mirrors."""
    global _circuit_open_until
    if time.time() < _circuit_open_until:
        return None

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    for url in [OVERPASS_URL, *OVERPASS_FALLBACK_URLS]:
        try:
            response = requests.post(
                url,
                data={"data": query},
                headers=headers,
                timeout=(1.5, 3.0),
            )
            response.raise_for_status()
            _circuit_open_until = 0.0
            return response.json()
        except Exception:
            continue

    print("[osm_api] Overpass endpoints busy or timed out; pausing external calls for 60s.")
    _circuit_open_until = time.time() + 60.0
    return None


def is_cell_queried(latitude: float, longitude: float) -> bool:
    """Returns True if this coordinate's grid cell has been queried and cached."""
    return _grid_key(latitude, longitude) in _osm_cache

