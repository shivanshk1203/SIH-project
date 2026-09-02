"""
osm_api.py

Gets real-world land-use context around a hotspot using OpenStreetMap's
Overpass API (free, no API key needed).

Previously this only looked for generic "industrial" tags. It now
recognizes several categories of land use, so a hotspot can be labeled
as sitting near/within an industrial site, a farm, a mine/quarry, a
power plant, a landfill, an oil/gas well, or forest/vegetation - which
is what actually drives whether a thermal detection looks like an
industrial fire, agricultural burning, a mining incident, or a wildfire.

If the Overpass API is unreachable, we return an empty list so the rest
of the app keeps working (the hotspot will just be classified with "no
nearby facility found").
"""

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Mirrors, tried in order if the primary Overpass instance is down/rate-limited.
OVERPASS_FALLBACK_URLS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# How far around a hotspot we search for land-use features (in meters).
SEARCH_RADIUS_METERS = 3000

# --- Land-use categories we can recognize, and the OSM tags that map to them ---
# Order matters a little: it's used as a tie-breaker if an element somehow
# matches more than one category (rare, but OSM tagging is messy).
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
}

# Which "key" for each (key, value) pair, so we can build one Overpass query.
_ALL_TAG_PAIRS = [
    (category, key, value)
    for category, pairs in CATEGORY_TAGS.items()
    for key, value in pairs
]


def _build_query(latitude, longitude, radius):
    clauses = []
    for _category, key, value in _ALL_TAG_PAIRS:
        clauses.append(f'node["{key}"="{value}"](around:{radius},{latitude},{longitude});')
        clauses.append(f'way["{key}"="{value}"](around:{radius},{latitude},{longitude});')

    return f"""
    [out:json][timeout:20];
    (
      {"".join(clauses)}
    );
    out center 60;
    """


def _tags_to_category(tags):
    """Given an OSM element's tags, figure out which of our categories it matches."""
    for category, pairs in CATEGORY_TAGS.items():
        for key, value in pairs:
            if tags.get(key) == value:
                return category
    return None


_FACILITY_CACHE = {}


def get_nearby_facilities(latitude, longitude, radius=SEARCH_RADIUS_METERS):
    """
    Returns a list of nearby land-use features, each categorized:
    [
      {
        "name": str,
        "type": str,           # e.g. "industrial", "farm", "mine", "power_plant"...
        "type_label": str,     # human-friendly label for the type
        "latitude": float,
        "longitude": float,
      },
      ...
    ]

    Sorted isn't done here (detection.py decides "nearest" using real
    distance), this just returns everything found within `radius`.
    """
    cache_key = (round(latitude, 2), round(longitude, 2), radius)
    if cache_key in _FACILITY_CACHE:
        return _FACILITY_CACHE[cache_key]

    query = _build_query(latitude, longitude, radius)
    data = _query_overpass(query)

    if data is None:
        _FACILITY_CACHE[cache_key] = []
        return []

    facilities = []
    for element in data.get("elements", []):
        # Nodes have lat/lon directly. Ways return a "center" point instead.
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

    _FACILITY_CACHE[cache_key] = facilities
    return facilities


def _query_overpass(query):
    """Tries the primary Overpass endpoint, then falls back to mirrors."""
    for url in [OVERPASS_URL, *OVERPASS_FALLBACK_URLS]:
        try:
            response = requests.post(url, data={"data": query}, timeout=15)
            response.raise_for_status()
            return response.json()
        except Exception as error:
            print(f"[osm_api] Overpass endpoint {url} failed: {error}")
            continue

    print("[osm_api] All Overpass endpoints failed, assuming no nearby land-use data.")
    return None
