"""
detection.py

This is the backward-compatible interface of the detection engine.
Routes all calls to the 15-phase structured investigation pipeline in thermal_analysis.py.
"""

import math
import thermal_analysis


def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the distance in meters between two lat/lon points,
    using the Haversine formula (accounts for the Earth's curvature).
    """
    return thermal_analysis.calculate_distance_m(lat1, lon1, lat2, lon2)


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
    Classifies a hotspot using the 15-phase structured investigation engine.
    Maintains full backward compatibility for any existing callers.
    """
    is_queried = nearest_facility is not None or distance_to_facility is not None
    analysis = thermal_analysis.analyze_hotspot(
        hotspot=hotspot,
        all_hotspots=[hotspot],
        nearest_facility=nearest_facility,
        distance_to_facility_m=distance_to_facility,
        is_gis_queried=is_queried,
    )
    cls_info = analysis["classification"]
    gis_info = analysis["gis_evidence"]
    settlement = analysis.get("settlement", {})
    loc_prof = analysis.get("location_profile", {})

    return {
        "classification": cls_info["label"],
        "classification_key": cls_info["category_key"],
        "analytical_confidence": cls_info["analytical_confidence"],
        "likely_source": cls_info.get("likely_source"),
        "short_reason": cls_info.get("short_reason"),
        "recommended_action": cls_info.get("recommended_action"),
        "recommended_action_short": cls_info.get("recommended_action_short"),
        "alternative_source": cls_info.get("alternative_source"),
        "hotspot_size_estimate": cls_info.get("hotspot_size_estimate"),
        "nearest_settlement": settlement.get("formatted_location"),
        "location_profile": loc_prof,
        "source_scores": cls_info.get("source_scores"),
        "concurring_signals": cls_info.get("concurring_signals"),
        "confidence": hotspot.get("confidence", 50),
        "reasons": cls_info["evidence"],
        "evidence": cls_info["evidence"],
        "location_type": gis_info["facility_type"],
        "location_type_label": gis_info["facility_type_label"],
        "event": analysis["event"],
        "gis_evidence": gis_info,
        "spatial_analysis": analysis["spatial_analysis"],
        "temporal_analysis": analysis["temporal_analysis"],
        "evidence_matrix": analysis["evidence_matrix"],
        "availability": analysis.get("availability", {}),
        "scientific_advisory": analysis["scientific_advisory"],
    }
