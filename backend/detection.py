"""
detection.py

This is the "brain" of the prototype. It does two things:

1. calculate_distance()  -> how far apart two points on Earth are (in meters)
2. classify_hotspot()    -> a simple, explainable rule-based classifier that
                             decides if a hotspot is likely an industrial fire,
                             a wildfire, a normal industrial heat source, or
                             unknown.

This is NOT a trained machine learning model. It's a transparent rule-based
system so the reasoning is easy to see and explain, which is what a
prototype needs.
"""

import math

# --- Thresholds used by the classifier (tweak these to change behavior) ---
CLOSE_TO_FACILITY_METERS = 500       # "very close" to an industrial facility
NEAR_FACILITY_METERS = 2000          # "somewhat near" an industrial facility
HIGH_BRIGHTNESS = 340                # brightness value considered "strong" heat
MODERATE_BRIGHTNESS = 310            # brightness value considered "moderate" heat


def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the distance in meters between two lat/lon points,
    using the Haversine formula (accounts for the Earth's curvature).
    """
    earth_radius_meters = 6371000

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return earth_radius_meters * c


def find_nearest_facility(hotspot, facilities):
    """
    Given one hotspot and a list of nearby facilities, find the closest one.
    Returns (facility, distance_in_meters) or (None, None) if there are no
    facilities to compare against.
    """
    if not facilities:
        return None, None

    nearest_facility = None
    nearest_distance = None

    for facility in facilities:
        distance = calculate_distance(
            hotspot["latitude"], hotspot["longitude"],
            facility["latitude"], facility["longitude"],
        )
        if nearest_distance is None or distance < nearest_distance:
            nearest_distance = distance
            nearest_facility = facility

    return nearest_facility, nearest_distance


def classify_hotspot(hotspot, nearest_facility, distance_to_facility):
    """
    Simple explainable rule-based classification.

    `nearest_facility`, when present, now carries a "type" (e.g. "industrial",
    "farm", "mine", "power_plant", "landfill", "oil_gas", "forest",
    "residential") from osm_api.py, which lets the classifier distinguish an
    industrial fire from agricultural burning or a mining-related heat
    source, instead of only saying "industrial" for everything.

    Returns a dictionary:
    {
      "classification": "Possible Industrial Fire" | "Possible Agricultural Burning" |
                         "Possible Mining-Related Fire" | "Possible Wildfire" |
                         "Normal Thermal Source" | "Unknown / Needs Investigation",
      "confidence": int (0-100, a rough estimate for the prototype),
      "reasons": [str, str, ...],
      "location_type": str | None,       # e.g. "industrial", "farm", "mine"...
      "location_type_label": str | None, # human-friendly label
    }
    """
    brightness = hotspot.get("brightness", 0)
    detection_confidence = hotspot.get("confidence", 0)
    reasons = []

    has_nearby_facility = nearest_facility is not None
    facility_type = nearest_facility.get("type") if has_nearby_facility else None
    is_very_close_to_facility = has_nearby_facility and distance_to_facility <= CLOSE_TO_FACILITY_METERS
    is_near_facility = has_nearby_facility and distance_to_facility <= NEAR_FACILITY_METERS
    is_strong_heat = brightness >= HIGH_BRIGHTNESS
    is_moderate_heat = brightness >= MODERATE_BRIGHTNESS

    # The land-use type at/near the hotspot, regardless of fire classification.
    # Only trust this when the facility is genuinely close by.
    location_type = facility_type if is_near_facility else None
    location_type_label = nearest_facility.get("type_label") if is_near_facility else None

    # --- Rule 1: Very close to a facility + strong heat = a real fire there ---
    if is_very_close_to_facility and is_strong_heat:
        reasons.append(f"Hotspot is only {int(distance_to_facility)} m from '{nearest_facility['name']}' ({nearest_facility['type_label']})")
        reasons.append(f"High thermal intensity detected (brightness {brightness:.1f})")
        if detection_confidence >= 80:
            reasons.append(f"Satellite detection confidence is high ({detection_confidence}%)")

        if facility_type == "farm":
            classification = "Possible Agricultural Burning"
            reasons.append("Location sits on farmland, consistent with crop residue or field burning")
        elif facility_type in ("mine", "landfill"):
            classification = "Possible Mining/Landfill Fire"
            reasons.append(f"Location is a {nearest_facility['type_label'].lower()}, where fires can smoulder underground or in waste piles")
        else:
            classification = "Possible Industrial Fire"

        return {
            "classification": classification,
            "confidence": min(95, 60 + detection_confidence // 5),
            "reasons": reasons,
            "location_type": facility_type,
            "location_type_label": nearest_facility["type_label"],
        }

    # --- Rule 2: Near a facility, moderate heat = likely a normal heat source for that land use ---
    if is_near_facility and is_moderate_heat and not is_strong_heat:
        reasons.append(f"Hotspot is {int(distance_to_facility)} m from '{nearest_facility['name']}' ({nearest_facility['type_label']})")
        if facility_type == "farm":
            reasons.append("Thermal intensity is moderate, consistent with routine agricultural burning or machinery heat")
        elif facility_type in ("mine", "landfill"):
            reasons.append("Thermal intensity is moderate, consistent with routine mining/waste processing heat")
        else:
            reasons.append("Thermal intensity is moderate, consistent with routine industrial heat (e.g. flare stacks, furnaces)")
        reasons.append("No sign of a rapidly intensifying fire")
        return {
            "classification": "Normal Thermal Source",
            "confidence": 65,
            "reasons": reasons,
            "location_type": location_type,
            "location_type_label": location_type_label,
        }

    # --- Rule 3: Far from any facility = likely wildfire ---
    if not has_nearby_facility or distance_to_facility > NEAR_FACILITY_METERS:
        reasons.append("No industrial, agricultural, or mining site found nearby" if not has_nearby_facility
                        else f"Nearest known site ('{nearest_facility['type_label']}') is {int(distance_to_facility)} m away, which is far")
        if is_strong_heat:
            reasons.append(f"High thermal intensity detected (brightness {brightness:.1f})")
        reasons.append("Pattern is consistent with a natural/vegetation fire rather than a known human land use")
        return {
            "classification": "Possible Wildfire",
            "confidence": 55 + (10 if is_strong_heat else 0),
            "reasons": reasons,
            "location_type": facility_type if has_nearby_facility else "forest",
            "location_type_label": nearest_facility["type_label"] if has_nearby_facility else "Forest / open land",
        }

    # --- Rule 4: Not enough clear signal = unknown ---
    reasons.append("Available signals do not clearly match a known pattern")
    if has_nearby_facility:
        reasons.append(f"Nearest site '{nearest_facility['name']}' ({nearest_facility['type_label']}) is {int(distance_to_facility)} m away")
    reasons.append(f"Thermal intensity: {brightness:.1f} (inconclusive)")
    return {
        "classification": "Unknown / Needs Investigation",
        "confidence": 40,
        "reasons": reasons,
        "location_type": location_type,
        "location_type_label": location_type_label,
    }
