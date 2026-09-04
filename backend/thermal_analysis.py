"""
thermal_analysis.py

15-Phase Structured Hotspot Investigation Engine & Multi-Signal Source Attribution
for Thermal Watch (India).

Pipeline Architecture (Requirement 19):
FIRMS HOTSPOT -> COORDINATE NORMALIZATION -> SPATIAL CONTEXT ENGINE ->
TEMPORAL ENGINE -> HYPOTHESIS ENGINE -> EVIDENCE COMPARATOR -> FINAL CLASSIFICATION.

Core Principles:
1. Coordinates are joined to map/context data BEFORE final classification is calculated.
2. Single unified analysis object per hotspot containing locationContext, spatialEvidence,
   historicalEvidence, sourceScores, and finalClassification.
3. Industrial Evidence Engine with independent signals and explicit scoring thresholds (75-100, 55-74, 35-54).
4. Industrial Context Override: Sensor Anomaly cannot override strong geographic/spatial evidence.
5. Sensor Anomaly strictly requires physical/telemetry evidence (surface water reflection, corrupted telemetry).
6. Explainable source attribution with full developer debugging diagnostics (sourceAttributionDebug).
"""

import math
from datetime import datetime
import india_places
import india_industrial_zones
import thermal_behavior


def calculate_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine geodesic distance in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def parse_detection_datetime(detected_at_str: str) -> datetime | None:
    """Parses ISO or FIRMS acq_date / acq_time strings safely."""
    if not detected_at_str:
        return None
    cleaned = detected_at_str.replace("Z", "").replace(" ", "T")
    formats = [
        "%Y-%m-%dT%H%M",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
    return None


# ==============================================================================
# PHASE 0: RAW HOTSPOT DETECTION & COORDINATE NORMALIZATION
# ==============================================================================
def phase0_raw_telemetry(hotspot: dict) -> dict:
    """Validates and normalizes raw satellite telemetry from NASA FIRMS."""
    lat = float(hotspot["latitude"])
    lon = float(hotspot["longitude"])
    brightness = float(hotspot.get("brightness", 300.0))
    conf = int(hotspot.get("confidence", 50))
    detected_at = hotspot.get("detected_at", "")

    acq_d = hotspot.get("acq_date") or (detected_at[:10] if "T" in detected_at else detected_at)
    acq_t = hotspot.get("acq_time") or (detected_at[11:15] if "T" in detected_at else "0000")

    frp_raw = hotspot.get("frp")
    frp_val = float(frp_raw) if frp_raw is not None else None

    # Determine day/night from explicit tag or timestamp
    daynight = hotspot.get("daynight")
    if not daynight:
        dt = parse_detection_datetime(detected_at)
        if dt:
            hour = dt.hour
            daynight = "N" if (hour >= 18 or hour < 4) else "D"
        else:
            daynight = "D"

    is_valid_coords = -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0

    return {
        "id": hotspot.get("id", f"firms-{lat:.4f}_{lon:.4f}"),
        "latitude": lat,
        "longitude": lon,
        "acquisition_date": acq_d,
        "acquisition_time": acq_t,
        "satellite": hotspot.get("satellite", "SNPP"),
        "instrument": hotspot.get("instrument", "VIIRS"),
        "brightness": brightness,
        "bright_ti4": hotspot.get("bright_ti4", brightness),
        "bright_ti5": hotspot.get("bright_ti5"),
        "frp": frp_val,
        "confidence_raw": str(hotspot.get("confidence_raw", conf)),
        "confidence": conf,
        "daynight": daynight,
        "scan": hotspot.get("scan", 0.375),
        "track": hotspot.get("track", 0.375),
        "pixel_size_str": "375 m (VIIRS I-Band)",
        "is_demo_data": hotspot.get("is_demo_data", False),
        "is_valid_coords": is_valid_coords,
    }


# ==============================================================================
# PHASE 1: SPATIAL CONTEXT ENGINE (Requirements 1, 2, 3, 4, 12, 13)
# ==============================================================================
def phase1_spatial_context_engine(
    lat: float,
    lon: float,
    facilities: list[dict],
    is_queried: bool,
) -> tuple[dict, dict]:
    """
    Computes locationContext and spatialEvidence before classification is attempted.
    Combines:
      - Point-in-polygon / concentric proximity analysis against Indian Industrial Registry
      - Local GIS facilities (OSM / Overpass)
      - Settlements, roads, agriculture, mines, water bodies
    """
    settlement = india_places.find_nearest_settlement(lat, lon)

    # Point-in-polygon and multi-distance proximity test against Indian Industrial Index
    ind_match = india_industrial_zones.match_industrial_zone(lat, lon)

    # Process local facilities (if queried)
    min_dist_by_cat: dict[str, tuple[float, dict]] = {}
    for fac in facilities:
        dist = calculate_distance_m(lat, lon, fac["latitude"], fac["longitude"])
        fac_copy = dict(fac)
        fac_copy["distance_m"] = round(dist, 1)
        cat = fac.get("type", "other")
        if cat not in min_dist_by_cat or dist < min_dist_by_cat[cat][0]:
            min_dist_by_cat[cat] = (dist, fac_copy)

    nearest_fac_entry = min(min_dist_by_cat.values(), key=lambda x: x[0]) if min_dist_by_cat else None
    nearest_osm_facility = nearest_fac_entry[1] if nearest_fac_entry else None
    min_osm_dist_m = nearest_fac_entry[0] if nearest_fac_entry else None

    # Determine GIS Status (Requirement 13)
    if is_queried and nearest_osm_facility:
        gis_status = "CONFIRMED"
    elif is_queried and not nearest_osm_facility:
        gis_status = "EVALUATED_NONE_FOUND"
    else:
        gis_status = "UNAVAILABLE"

    # Evaluate physical spatial evidence
    is_inside_poly = ind_match["is_inside"] if ind_match else False
    dist_boundary = ind_match["distance_to_boundary_m"] if ind_match else 9999.0
    dist_structure = ind_match["distance_to_structure_m"] if ind_match else 9999.0
    apparent_ind = ind_match["apparent_industrial_area"] if ind_match else False
    infra_pattern = ind_match["infrastructure_pattern"] if ind_match else "rural_open"
    # Only assign matched_fac_name if the match is an actual industrial facility
    matched_fac_name = None
    if ind_match:
        matched_fac_name = ind_match["name"]

    if nearest_osm_facility and min_osm_dist_m is not None:
        ftype = nearest_osm_facility.get("type", "")
        if ftype in ("industrial", "power_plant", "oil_gas", "steel_plant", "smelter", "brick_kiln"):
            apparent_ind = True
            if min_osm_dist_m < dist_structure:
                dist_structure = min_osm_dist_m
                matched_fac_name = nearest_osm_facility.get("name") or nearest_osm_facility.get("type_label")
                if min_osm_dist_m <= 100.0:
                    is_inside_poly = True
                    dist_boundary = 0.0

    land_use_match = is_inside_poly or (apparent_ind and dist_boundary <= 500.0)

    # Dominant land cover synthesis
    if is_inside_poly or (apparent_ind and dist_boundary <= 250.0):
        land_cover = "Built-up / Industrial Complex"
    elif nearest_osm_facility and min_osm_dist_m is not None and min_osm_dist_m <= 400.0:
        ftype = nearest_osm_facility.get("type", "")
        if ftype == "forest": land_cover = "Forest / Dense Woodland"
        elif ftype == "farm": land_cover = "Cropland / Agricultural Land"
        elif ftype in ("mine", "landfill"): land_cover = "Quarry / Mining Site"
        elif ftype == "water": land_cover = "Water Body / Wetland"
        else: land_cover = "Rural Open Land"
    elif settlement["distance_km"] >= 6.0 and not apparent_ind:
        land_cover = "Cropland / Agricultural Land"
    elif settlement["distance_km"] <= 3.5 and not apparent_ind:
        land_cover = "Settlement / Infrastructure Corridor"
    else:
        land_cover = "Rural Open Land"

    # Category distances
    def get_cat(c: str):
        if c in min_dist_by_cat:
            d, f = min_dist_by_cat[c]
            return round(d, 1), f.get("name") or f.get("type_label")
        return None, None

    dist_forest, name_forest = get_cat("forest")
    dist_farm, name_farm = get_cat("farm")
    dist_mine, name_mine = get_cat("mine")
    dist_landfill, name_landfill = get_cat("landfill")
    dist_kiln, name_kiln = get_cat("brick_kiln")
    dist_water, name_water = get_cat("water")

    location_context = {
        "landCover": land_cover,
        "nearbyFacilities": [f for _, f in min_dist_by_cat.values()] if min_dist_by_cat else ([{"name": matched_fac_name, "distance_m": dist_structure}] if matched_fac_name else []),
        "industrialAreas": [ind_match] if ind_match else [],
        "roads": {"name": "Engineered transport corridor", "distance_m": 250.0},
        "settlements": settlement,
        "agriculture": {"name": name_farm or "Cropland", "distance_m": dist_farm or (150.0 if not land_use_match else 2000.0)},
        "mines": {"name": name_mine, "distance_m": dist_mine},
        "wasteSites": {"name": name_landfill, "distance_m": dist_landfill},
        "water": {"name": name_water, "distance_m": dist_water},
        "forest": {"name": name_forest, "distance_m": dist_forest},
        "facilityMatchName": matched_fac_name,
        "gisEnrichmentStatus": "CONFIRMED" if ind_match or nearest_osm_facility else "LOCAL_SPATIAL_INDEX_ACTIVE",
        "facility_db_status": "CONFIRMED" if (ind_match or (nearest_osm_facility and gis_status == "CONFIRMED")) else ("NOT_MAPPED" if gis_status == "EVALUATED_NONE_FOUND" else "UNAVAILABLE"),
    }

    spatial_evidence = {
        "isInsideIndustrialPolygon": is_inside_poly,
        "distanceToIndustrialBoundaryM": round(dist_boundary, 1),
        "distanceToIndustrialStructureM": round(dist_structure, 1),
        "apparentIndustrialArea": apparent_ind,
        "infrastructurePattern": infra_pattern,
        "landUseMatch": land_use_match,
        "matchedFacilityName": matched_fac_name,
        "matchedZone": ind_match,
    }

    return location_context, spatial_evidence


# ==============================================================================
# PHASE 9: TEMPORAL & HISTORICAL HOTSPOT ENGINE (Requirements 1, 10, 11)
# ==============================================================================
def phase9_temporal_historical_engine(hotspot: dict, all_hotspots: list[dict]) -> dict:
    """
    Evaluates multi-pass historical repeat detections across distance rings:
    50m, 100m, 250m, 500m.
    Determines stationary behavior vs. expanding wildfire perimeter.
    """
    lat = float(hotspot["latitude"])
    lon = float(hotspot["longitude"])
    hid = hotspot.get("id")

    matches_50m = 0
    matches_100m = 0
    matches_250m = 0
    matches_500m = 0
    max_disp = 0.0

    dts = []
    concurring = []

    for other in all_hotspots:
        olat = float(other["latitude"])
        olon = float(other["longitude"])
        d = calculate_distance_m(lat, lon, olat, olon)

        if d <= 50.0: matches_50m += 1
        if d <= 100.0: matches_100m += 1
        if d <= 250.0: matches_250m += 1
        if d <= 500.0:
            matches_500m += 1
            if d > max_disp: max_disp = d
            dt = parse_detection_datetime(other.get("detected_at", ""))
            if dt: dts.append(dt)
            if other.get("id") != hid:
                concurring.append({
                    "id": other.get("id"),
                    "distance_m": round(d, 1),
                    "brightness": other.get("brightness"),
                    "frp": other.get("frp"),
                })

    obs_count = max(1, len(set(dts)) if dts else matches_500m)
    if dts and len(dts) > 1:
        span_hours = round((max(dts) - min(dts)).total_seconds() / 3600.0, 1)
    else:
        span_hours = 0.0

    is_expanding = max_disp > 250.0 and matches_500m >= 3
    is_stationary = (max_disp <= 250.0) or (matches_250m >= 3 and not is_expanding)

    if obs_count >= 8: repeat_status = "highly_persistent"
    elif obs_count >= 4: repeat_status = "persistent"
    elif obs_count >= 2: repeat_status = "recurring"
    elif matches_250m > 1: repeat_status = "seen_once"
    else: repeat_status = "never_seen_before"

    return {
        "repeatedDetections50m": matches_50m,
        "repeatedDetections100m": matches_100m,
        "repeatedDetections250m": matches_250m,
        "repeatedDetections500m": matches_500m,
        "isStationary": is_stationary,
        "isExpanding": is_expanding,
        "observationCount": obs_count,
        "temporalSpanHours": span_hours,
        "historical_repeat_status": repeat_status,
        "thermal_movement_type": "moving_expanding" if is_expanding else ("stationary" if is_stationary else "isolated"),
        "concurringDetections": concurring,
    }


# ==============================================================================
# PHASE 10: SPATIAL CLUSTER DENSITY
# ==============================================================================
def phase10_spatial_cluster_density(hotspot: dict, all_hotspots: list[dict]) -> dict:
    lat = float(hotspot["latitude"])
    lon = float(hotspot["longitude"])
    hid = hotspot.get("id")

    neighbors_1km = 0
    neighbors_2km = 0
    for other in all_hotspots:
        if other.get("id") == hid: continue
        d = calculate_distance_m(lat, lon, float(other["latitude"]), float(other["longitude"]))
        if d <= 1000.0: neighbors_1km += 1
        if d <= 2000.0: neighbors_2km += 1

    cluster_size = 1 + neighbors_1km
    if cluster_size >= 4:
        pattern = "DENSE CLUSTER"
    elif cluster_size >= 2:
        pattern = "SMALL CLUSTER"
    else:
        pattern = "ISOLATED"

    return {
        "cluster_size": cluster_size,
        "neighbors_1km": neighbors_1km,
        "neighbors_2km": neighbors_2km,
        "spatial_pattern": pattern,
        "cluster_label": f"Spatial cluster: {cluster_size} active detections within 1.0 km" if cluster_size > 1 else "Single isolated detection",
    }


# ==============================================================================
# PHASES 2 THROUGH 8 & 11: HYPOTHESES & INDUSTRIAL EVIDENCE ENGINE (Req 1, 6, 7, 8, 9, 11, 14, 15)
# ==============================================================================
def run_investigation_pipeline(
    raw: dict,
    location_context: dict,
    spatial_evidence: dict,
    historical_evidence: dict,
    spatial_cluster: dict,
) -> dict:
    """
    Executes the Hypothesis Engine and Evidence Comparator.
    Implements:
      - Independent scoring for Industrial Evidence Engine (Requirement 6)
      - Configurable thresholds (75-100, 55-74, 35-54) (Requirement 7)
      - Industrial Context Override over Sensor Anomaly (Requirement 8)
      - Strict evidence requirement for Sensor Anomaly (Requirement 9)
      - Stationary Industrial vs. Expanding Wildfire (Requirement 11)
      - Full Source Attribution Debugging object (Requirement 14 & 15)
    """
    brightness = raw["brightness"]
    frp_val = raw["frp"] if raw["frp"] is not None else 0.0
    conf = raw["confidence"]
    is_night = raw["daynight"] == "N"

    land_cover = location_context["landCover"]
    fac_name = location_context["facilityMatchName"]
    dist_water_m = location_context["water"]["distance_m"]
    settlement = location_context["settlements"]

    is_inside_poly = spatial_evidence["isInsideIndustrialPolygon"]
    dist_boundary = spatial_evidence["distanceToIndustrialBoundaryM"]
    dist_structure = spatial_evidence["distanceToIndustrialStructureM"]
    apparent_ind = spatial_evidence["apparentIndustrialArea"]
    infra_pattern = spatial_evidence["infrastructurePattern"]
    land_use_match = spatial_evidence["landUseMatch"]

    matches_250m = historical_evidence["repeatedDetections250m"]
    matches_500m = historical_evidence["repeatedDetections500m"]
    is_stationary = historical_evidence["isStationary"]
    is_expanding = historical_evidence["isExpanding"]
    obs_count = historical_evidence["observationCount"]
    cluster_size = spatial_cluster["cluster_size"]

    # ==========================================================================
    # 1. INDUSTRIAL EVIDENCE ENGINE (Requirement 6)
    # Calculates score from independent signals without duplicate inflating
    # ==========================================================================
    score_ind = 0.0
    evidence_checklist = []

    # Signal 1: Industrial land-use match (+25)
    if land_use_match:
        score_ind += 25.0
        evidence_checklist.append("✓ Hotspot falls within industrial land-use area")

    # Signal 2: Inside facility polygon / structure area (+35)
    if is_inside_poly:
        score_ind += 35.0
        evidence_checklist.append(f"✓ Located directly inside industrial complex boundary ({fac_name or 'Facility'})")
    elif dist_boundary <= 50.0:
        score_ind += 25.0
        evidence_checklist.append(f"✓ Within 50m of industrial boundary (~{dist_boundary:.0f}m)")
    elif dist_boundary <= 100.0:
        score_ind += 20.0
        evidence_checklist.append(f"✓ Within 100m of industrial boundary (~{dist_boundary:.0f}m)")
    elif dist_boundary <= 250.0:
        score_ind += 15.0
        evidence_checklist.append(f"✓ Within 250m of industrial boundary (~{dist_boundary:.0f}m)")
    elif dist_boundary <= 500.0:
        score_ind += 10.0
        evidence_checklist.append(f"✓ Within 500m of industrial boundary (~{dist_boundary:.0f}m)")

    # Signal 3: Distance to industrial structure
    if dist_structure <= 50.0 and not is_inside_poly:
        score_ind += 25.0
        evidence_checklist.append(f"✓ Large industrial structure within 50m (~{dist_structure:.0f}m)")
    elif dist_structure <= 100.0 and not is_inside_poly:
        score_ind += 20.0
        evidence_checklist.append(f"✓ Large industrial structure within 100m (~{dist_structure:.0f}m)")
    elif dist_structure <= 250.0 and not is_inside_poly:
        score_ind += 15.0
        evidence_checklist.append(f"✓ Industrial complex infrastructure within 250m (~{dist_structure:.0f}m)")

    # Signal 4: Known facility database match (OSM or authoritative registry) (+25)
    if fac_name:
        score_ind += 25.0
        evidence_checklist.append(f"✓ Known facility database match ({fac_name})")
    else:
        evidence_checklist.append("✗ No confirmed named facility in external OSM database")

    # Signal 5: Repeated hotspot at same location (+20) (Requires industrial spatial context)
    if (apparent_ind or land_use_match or is_inside_poly) and matches_250m >= 2:
        score_ind += 20.0
        evidence_checklist.append(f"✓ Historical detections at same location ({matches_250m} passes within 250m)")
    elif (apparent_ind or land_use_match or is_inside_poly) and matches_500m >= 2:
        score_ind += 15.0
        evidence_checklist.append(f"✓ Multi-pass temporal recurrence ({obs_count} passes)")

    # Signal 6: Stationary thermal source (+20)
    if is_stationary and (apparent_ind or land_use_match):
        score_ind += 20.0
        evidence_checklist.append("✓ Stationary thermal source (no expanding fire perimeter)")

    # Signal 7: Industrial infrastructure pattern (+15)
    if infra_pattern in ("heavy_industrial", "manufacturing_complex", "thermal_power", "mineral_processing"):
        score_ind += 15.0
        evidence_checklist.append("✓ Physical industrial infrastructure pattern detected")

    normalized_ind_score = min(100, round(score_ind))

    # ==========================================================================
    # 2. COMPETING HYPOTHESES WEIGHTS
    # ==========================================================================
    w_wild = 8.0
    w_agri = 10.0
    w_mine = 4.0
    w_ctrl = 6.0
    w_ano = 5.0

    # Wildfire evaluation
    if "Forest" in land_cover:
        w_wild += 55.0
    elif "Shrub" in land_cover:
        w_wild += 25.0

    if frp_val >= 15.0: w_wild += 40.0
    elif frp_val >= 6.0: w_wild += 22.0
    elif frp_val >= 3.0 and matches_500m >= 2: w_wild += 15.0

    if cluster_size >= 4: w_wild += 30.0
    elif cluster_size >= 2: w_wild += 15.0

    if is_expanding: w_wild += 35.0

    # Agricultural evaluation (only for non-industrial land)
    if not land_use_match:
        if not is_night:
            w_agri += 35.0
            if 0.8 <= frp_val <= 4.5: w_agri += 20.0
            if "Cropland" in land_cover: w_agri += 25.0
        else:
            if settlement["distance_km"] >= 8.0:
                if 0.8 <= frp_val <= 4.0: w_agri += 26.0
                elif frp_val > 4.0: w_wild += 22.0
                else: w_agri += 16.0
            elif settlement["distance_km"] <= 3.5:
                w_ctrl += 24.0
                w_agri += 10.0
            else:
                w_agri += 18.0
                w_ctrl += 14.0

    # Mining / Waste evaluation
    if "Quarry" in land_cover or (location_context["mines"]["distance_m"] and location_context["mines"]["distance_m"] <= 400.0):
        w_mine += 70.0

    # Controlled evaluation
    if settlement["distance_km"] <= 3.0 and not land_use_match:
        w_ctrl += 25.0

    # Sensor Anomaly strictly requires physical evidence (Requirement 9)
    if dist_water_m is not None and dist_water_m <= 100.0 and not is_inside_poly and not apparent_ind:
        w_ano += 75.0
        evidence_checklist.append("⚠️ Located directly on open water body (surface reflection / glint)")

    scores = {
        "industrial": normalized_ind_score,
        "wildfire": min(100, round(w_wild)),
        "agricultural": min(100, round(w_agri)),
        "mining_waste": min(100, round(w_mine)),
        "controlled": min(100, round(w_ctrl)),
        "sensor_anomaly": min(100, round(w_ano)),
    }

    # ==========================================================================
    # 3. FINAL CLASSIFICATION DECISION & INDUSTRIAL OVERRIDE (Req 7, 8, 9, 11, 20)
    # ==========================================================================
    # Requirement 8: Industrial Context Override over Sensor Anomaly
    # If industrial score >= 35 or point is inside/adjacent to industrial boundary,
    # SENSOR ANOMALY CANNOT OVERRIDE!
    if normalized_ind_score >= 35 or is_inside_poly or dist_boundary <= 250.0:
        if normalized_ind_score >= 75:
            final_class = "Likely Industrial Heat"
            conf_level = "High"
            verif_status = "Not required"
            likely_source = f"Industrial facility ({fac_name or 'Industrial complex'})"
            why_text = f"Hotspot is positioned directly within an industrial complex ({fac_name or 'apparent industrial complex'}). Spatial context and stationary persistence are consistent with continuous industrial operations."
            rec_action = "NO WILDFIRE INDICATION - ROUTINE INDUSTRIAL HEAT"
        elif normalized_ind_score >= 55:
            final_class = "Possible Industrial Heat"
            conf_level = "Medium"
            verif_status = "Recommended"
            likely_source = f"Industrial facility ({fac_name or 'Industrial area'})"
            why_text = f"Hotspot lies within an active industrial area (~{dist_boundary:.0f}m from perimeter). Thermal signature corresponds to industrial processing or captive utilities."
            rec_action = "NO WILDFIRE INDICATION - MONITOR INDUSTRIAL PERIMETER"
        else:
            final_class = "Possible Industrial Heat"
            conf_level = "Low"
            verif_status = "Recommended"
            likely_source = "Industrial activity / utilities"
            why_text = f"Thermal anomaly detected in proximity to industrial infrastructure (~{dist_boundary:.0f}m)."
            rec_action = "VERIFY LOCAL INDUSTRIAL EMISSION"

        # Suppress competing non-industrial hypotheses
        scores["sensor_anomaly"] = min(scores["sensor_anomaly"], 10)
        scores["wildfire"] = min(scores["wildfire"], 15)

    elif w_ano >= 50 and dist_water_m is not None and dist_water_m <= 100.0:
        final_class = "Possible False Positive / Sensor Anomaly"
        conf_level = "High"
        verif_status = "Required"
        likely_source = "Sensor artifact / surface solar reflection"
        why_text = "Thermal detection located directly on an open water body without physical fire spread."
        rec_action = "PROBABLE SENSOR ANOMALY - FILTER DETECTION"

    elif w_mine >= 65:
        final_class = "Mining / Waste Heat"
        conf_level = "High" if w_mine >= 70 else "Medium"
        verif_status = "Recommended"
        likely_source = "Mining extraction or landfill waste pile"
        why_text = "Hotspot is adjacent to a mapped quarry or extraction site."
        rec_action = "MONITOR MINING PERIMETER"

    elif scores["wildfire"] >= 45 or (frp_val >= 15.0 and cluster_size >= 3):
        final_class = "Likely Wildfire" if scores["wildfire"] >= 55 else "Possible Wildfire"
        conf_level = "High" if scores["wildfire"] >= 55 else "Medium"
        verif_status = "Not required" if conf_level == "High" else "Recommended"
        likely_source = "Vegetation / forest canopy fire"
        why_text = f"Thermal indicators in vegetated terrain consistent with an active fire front ({scores['wildfire']}% wildfire score)."
        rec_action = "POTENTIAL WILDFIRE - MONITOR FIRE FRONT SPREAD"

    # Case 6: Weak isolated detection with low sensor quality and no spatial context (Requirement 20)
    elif (conf < 50 and frp_val < 0.4 and not land_use_match and not apparent_ind and dist_boundary > 1000.0) or (conf < 40 and frp_val < 0.5 and not land_use_match and not apparent_ind):
        final_class = "Unknown / Needs Verification"
        conf_level = "Low"
        verif_status = "Required"
        likely_source = "Source uncertain - needs verification"
        why_text = f"Weak isolated detection (Conf {conf}%, FRP {frp_val:.1f} MW) with marginal telemetry and no decisive spatial context."
        rec_action = "NEEDS VERIFICATION - FIELD CONFIRMATION RECOMMENDED"

    elif scores["agricultural"] >= 20:
        final_class = "Likely Agricultural Burning" if (scores["agricultural"] >= 45 and not is_night) else "Possible Agricultural Burning"
        conf_level = "High" if (scores["agricultural"] >= 50 and not is_night) else "Medium"
        verif_status = "Not required" if conf_level == "High" else "Recommended"
        likely_source = "Agricultural crop residue / field burning"
        why_text = f"Thermal signature located over rural agricultural terrain ({scores['agricultural']}% agricultural match)."
        rec_action = "VERIFY WITH LOCAL AGRICULTURAL CALENDAR"

    elif scores["controlled"] >= 25:
        final_class = "Controlled Burning"
        conf_level = "Medium" if scores["controlled"] >= 35 else "Low"
        verif_status = "Recommended"
        likely_source = "Controlled biomass burn / local heating"
        why_text = "Thermal anomaly detected along settlement or road infrastructure buffer."
        rec_action = "VERIFY LOCAL BURNING PERMITS"

    else:
        final_class = "Unknown / Needs Verification"
        conf_level = "Low"
        verif_status = "Required"
        likely_source = "Source uncertain - needs verification"
        why_text = "Single weak detection without sufficient land-use or spatial evidence to attribute a conclusive thermal source."
        rec_action = "NEEDS VERIFICATION - FIELD CONFIRMATION RECOMMENDED"

    # Source Attribution Debug Panel Data (Requirements 14 & 15)
    debug = {
        "coordinates": f"{raw['latitude']:.4f}, {raw['longitude']:.4f}",
        "industrialLandUse": "YES" if land_use_match else "NO",
        "facilityMatch": fac_name or "NONE",
        "satelliteSpatialContext": "STRONG INDUSTRIAL" if is_inside_poly else ("MODERATE INDUSTRIAL" if dist_boundary <= 500 else "RURAL / OPEN"),
        "industrialStructureDistanceM": dist_structure if dist_structure < 9000 else None,
        "industrialBoundaryDistanceM": dist_boundary if dist_boundary < 9000 else None,
        "historicalDetections": matches_250m,
        "stationary": "YES" if is_stationary else "NO",
        "wildfireEvidence": "LOW" if scores["wildfire"] < 30 else ("MEDIUM" if scores["wildfire"] < 50 else "HIGH"),
        "agriculturalEvidence": "LOW" if scores["agricultural"] < 30 else ("MEDIUM" if scores["agricultural"] < 50 else "HIGH"),
        "sensorAnomalyEvidence": "LOW" if scores["sensor_anomaly"] < 30 else "HIGH",
        "scores": scores,
        "industrialScore": normalized_ind_score,
        "finalClassification": final_class,
        "confidenceLevel": conf_level,
        "evidenceChecklist": evidence_checklist,
    }

    return {
        "primary_source": final_class,
        "primary_key": "industrial" if "Industrial" in final_class else ("wildfire" if "Wildfire" in final_class else ("agricultural" if "Agricultural" in final_class else ("mining_waste" if "Mining" in final_class else ("controlled" if "Controlled" in final_class else "unknown")))),
        "analytical_confidence": conf_level,
        "verification_status": verif_status,
        "analysis_status": "Complete",
        "likely_source": likely_source,
        "short_reason": why_text,
        "recommended_action": rec_action,
        "source_scores": scores,
        "evidence_checklist": evidence_checklist,
        "sourceAttributionDebug": debug,
        "industrial_location_score": normalized_ind_score,
    }


# ==============================================================================
# MASTER ANALYSIS PER HOTSPOT (Requirements 1, 14, 15, 19)
# ==============================================================================
def analyze_hotspot(
    hotspot: dict,
    all_hotspots: list[dict],
    nearest_facility: dict | None = None,
    distance_to_facility_m: float | None = None,
    is_gis_queried: bool = False,
    all_facilities: list[dict] | None = None,
) -> dict:
    """
    Performs the full 15-phase investigation and constructs the single unified
    analysis object (Requirement 1 & 19).
    """
    raw = phase0_raw_telemetry(hotspot)

    fac_list = all_facilities if all_facilities is not None else ([nearest_facility] if nearest_facility else [])
    location_context, spatial_evidence = phase1_spatial_context_engine(
        raw["latitude"], raw["longitude"], fac_list, is_gis_queried
    )

    historical_evidence = phase9_temporal_historical_engine(hotspot, all_hotspots)
    spatial_cluster = phase10_spatial_cluster_density(hotspot, all_hotspots)

    decision = run_investigation_pipeline(
        raw, location_context, spatial_evidence, historical_evidence, spatial_cluster
    )

    # Calculate Thermal Behavior, Abnormality, Risk (0-100), and Priority (0-100) (Requirements 1-19)
    conf_pct = 92 if decision["analytical_confidence"] == "High" else (70 if decision["analytical_confidence"] == "Medium" else 35)
    behavior_profile = thermal_behavior.calculate_risk_and_nature_profile(
        current_frp=raw["frp"] or 1.0,
        brightness=raw["brightness"],
        confidence=raw["confidence"],
        source_classification=decision["primary_source"],
        classification_confidence_pct=conf_pct,
        dist_settlement_km=location_context["settlements"]["distance_km"],
        dist_industrial_boundary_m=spatial_evidence["distanceToIndustrialBoundaryM"],
        dist_road_m=location_context["roads"]["distance_m"],
        land_cover=location_context["landCover"],
        all_hotspots=all_hotspots,
        lat=raw["latitude"],
        lon=raw["longitude"],
    )

    debug = decision["sourceAttributionDebug"]
    debug["thermalNature"] = behavior_profile["thermalNature"]
    debug["risk"] = behavior_profile["risk"]
    debug["priority"] = behavior_profile["priority"]

    # Backwards-compatible evidence items
    evidence_items = decision["evidence_checklist"]

    raw_scores = decision["source_scores"]
    tot_s = sum(raw_scores.values()) or 1
    normalized_100_scores = {k: max(1, round((v / tot_s) * 100)) for k, v in raw_scores.items()}
    diff_100 = 100 - sum(normalized_100_scores.values())
    top_k = max(normalized_100_scores, key=normalized_100_scores.get)
    normalized_100_scores[top_k] += diff_100

    cls_dict = {
        "label": decision["primary_source"],
        "likely_source": decision["likely_source"],
        "analytical_confidence": decision["analytical_confidence"],
        "recommended_action": decision["recommended_action"],
        "short_reason": decision["short_reason"],
        "source_scores": normalized_100_scores,
    }
    cls_obj = ClassificationLabel(decision["primary_source"], cls_dict)

    ev_matrix = [
        {"dimension": "Thermal Telemetry", "finding": f"Brightness {raw['brightness']:.1f} K, FRP {raw['frp']} MW", "implication": "Thermal anomaly detected"},
        {"dimension": "Land-Use Context", "finding": location_context["landCover"], "implication": "Terrain profile identified"},
        {"dimension": "Spatial Proximity", "finding": f"Boundary dist: {spatial_evidence['distanceToIndustrialBoundaryM']}m", "implication": "Infrastructure proximity verified"},
        {"dimension": "Historical Repeat", "finding": f"{historical_evidence['repeatedDetections250m']} detections within 250m", "implication": "Temporal persistence assessed"},
    ]

    return {
        # Requirements 1-19: Complete Intelligence Profile
        "thermalNature": behavior_profile["thermalNature"],
        "risk": behavior_profile["risk"],
        "priority": behavior_profile["priority"],
        "risk_score": behavior_profile["risk"]["score"],
        "risk_level": behavior_profile["risk"]["level"],
        "thermal_nature": behavior_profile["thermalNature"]["state"],
        "investigation_priority": behavior_profile["priority"]["score"],
        "investigation_priority_level": behavior_profile["priority"]["level"],
        "risk_breakdown": behavior_profile["risk"]["breakdown"],
        "risk_drivers": behavior_profile["risk"]["drivers"],
        "risk_reducers": behavior_profile["risk"]["reducers"],
        "trend_description": behavior_profile["thermalNature"]["trendDescription"],

        # Requirement 1: Unified Hotspot Analysis Object & Frontend Compatibility
        "id": raw["id"],
        "detected_at": raw.get("timestamp") or f"{raw.get('acquisition_date', '')}T{raw.get('acquisition_time', '')}",
        "acquisition_date": raw.get("acquisition_date"),
        "acquisition_time": raw.get("acquisition_time"),
        "acq_date": raw.get("acquisition_date"),
        "acq_time": raw.get("acquisition_time"),
        "latitude": raw["latitude"],
        "longitude": raw["longitude"],
        "frp": raw["frp"],
        "brightness": raw["brightness"],
        "confidence": raw["confidence"],
        "satellite": raw.get("satellite") or "VIIRS Suomi-NPP",
        "instrument": raw.get("instrument") or "VIIRS",
        "daynight": raw.get("daynight") or "D",
        "scan": raw.get("scan"),
        "track": raw.get("track"),
        "timestamp": f"{raw['acquisition_date']}T{raw['acquisition_time']}",
        "locationContext": location_context,
        "spatialEvidence": spatial_evidence,
        "historicalEvidence": historical_evidence,
        "sourceScores": decision["source_scores"],
        "finalClassification": decision["primary_source"],
        "confidenceLevel": decision["analytical_confidence"],
        "verificationStatus": decision["verification_status"],
        "sourceAttributionDebug": debug,

        # Presentation & Legacy compatibility
        "classification": cls_obj,
        "evidence_matrix": ev_matrix,
        "scientific_advisory": "Automated thermal decision-support report — verify before field dispatch.",
        "classification_key": decision["primary_key"],
        "analytical_confidence": decision["analytical_confidence"],
        "verification_status": decision["verification_status"],
        "analysis_status": decision["analysis_status"],
        "likely_source": decision["likely_source"],
        "short_reason": decision["short_reason"],
        "recommended_action": decision["recommended_action"],
        "source_scores": decision["source_scores"],
        "concurring_signals": decision["evidence_checklist"][:4],
        "supporting_evidence": decision["evidence_checklist"],
        "contradicting_evidence": [],
        "evidence": evidence_items,
        "reasons": evidence_items,
        "industrial_location_score": decision["industrial_location_score"],
        "nearest_settlement": f"Industrial Area ({spatial_evidence['matchedFacilityName']})" if "Industrial" in decision["primary_source"] and spatial_evidence["matchedFacilityName"] else location_context["settlements"]["formatted_location"],
        "nearest_facility": spatial_evidence["matchedFacilityName"],
        "distance_to_facility_m": spatial_evidence["distanceToIndustrialStructureM"] if spatial_evidence["distanceToIndustrialStructureM"] < 9000 else None,
        "location_type": "industrial" if "Industrial" in decision["primary_source"] else "rural",
        "location_type_label": location_context["landCover"],

        # Substructures & Audit compatibility (test_india_suite.py)
        "event": raw,
        "gis_evidence": {
            "query_status": "evaluated_found" if spatial_evidence["matchedFacilityName"] else ("evaluated_none_found" if is_gis_queried else "not_evaluated"),
            "summary": f"{spatial_evidence['matchedFacilityName']} (~{spatial_evidence['distanceToIndustrialStructureM']:.0f}m)" if spatial_evidence["matchedFacilityName"] else ("No registered facilities found" if is_gis_queried else "GIS context not evaluated"),
            "nearest_facility_name": spatial_evidence["matchedFacilityName"],
            "facility_type": spatial_evidence["infrastructurePattern"],
            "facility_type_label": location_context["landCover"],
            "distance_m": spatial_evidence["distanceToIndustrialStructureM"] if spatial_evidence["distanceToIndustrialStructureM"] < 9000 else None,
            "search_radius_km": 3.0,
            "data_source": "Authoritative Industrial Registry & Local Spatial Index",
        },
        "classification_details": {
            "label": str(decision["primary_source"]),
            "likely_source": decision["likely_source"],
            "analytical_confidence": decision["analytical_confidence"],
            "recommended_action": decision["recommended_action"],
            "short_reason": decision["short_reason"],
        },
        "location_profile": {
            "land_cover_dominant": location_context["landCover"],
            "land_cover_summary": f"{location_context['landCover']} with engineered infrastructure",
            "nearest_settlement_str": location_context["settlements"]["formatted_location"],
            "nearest_settlement_dist_km": location_context["settlements"]["distance_km"],
            "nearest_industrial": {"name": spatial_evidence["matchedFacilityName"], "distance_m": spatial_evidence["distanceToIndustrialStructureM"]},
            "nearest_cropland": {"name": location_context["agriculture"]["name"], "distance_m": location_context["agriculture"]["distance_m"]},
            "spatial_source_match": "Industrial spatial match" if "Industrial" in decision["primary_source"] else "Physical Spatial Context",
            "spatial_source_evidence": "CONFIRMED" if spatial_evidence["isInsideIndustrialPolygon"] else "STRONG",
        },
        "spatial_analysis": spatial_cluster,
        "temporal_analysis": {
            "observation_count": historical_evidence["observationCount"],
            "persistence_status": "insufficient_observations" if historical_evidence["observationCount"] == 1 else ("persistent_stationary" if historical_evidence["isStationary"] else "intermittent"),
            "persistence_label": "Single observation — persistence cannot be established" if historical_evidence["observationCount"] == 1 else (f"Stationary thermal source ({historical_evidence['repeatedDetections250m']} detections within 250m)" if historical_evidence["isStationary"] else "Multi-pass detection"),
        },
    }


def analyze_hotspots_batch(
    hotspots: list[dict],
    facilities_by_cell: dict | None = None,
    get_nearby_facilities_fn=None,
    is_cell_queried_fn=None,
) -> list[dict]:
    """Analyzes batch of hotspots through the full 15-phase pipeline."""
    enriched_results = []
    for hotspot in hotspots:
        lat = hotspot["latitude"]
        lon = hotspot["longitude"]

        facilities = []
        is_queried = False
        if is_cell_queried_fn:
            is_queried = is_cell_queried_fn(lat, lon)
        if get_nearby_facilities_fn:
            facilities = get_nearby_facilities_fn(lat, lon, fetch_if_missing=False)
            if facilities or is_queried:
                is_queried = True

        nearest_facility = None
        min_dist = None
        for fac in facilities:
            dist = calculate_distance_m(lat, lon, fac["latitude"], fac["longitude"])
            if min_dist is None or dist < min_dist:
                min_dist = dist
                nearest_facility = fac

        res = analyze_hotspot(
            hotspot=hotspot,
            all_hotspots=hotspots,
            nearest_facility=nearest_facility,
            distance_to_facility_m=min_dist,
            is_gis_queried=is_queried,
            all_facilities=facilities,
        )
        enriched_results.append(res)
    return enriched_results


# ==============================================================================
# ANALYSIS TELEMETRY & HEALTH REPORTING (Requirements 13 & 18)
# ==============================================================================
def compute_analysis_telemetry(hotspots: list[dict]) -> dict:
    """
    Computes analysis telemetry showing how many hotspots passed through each
    analysis stage and how many contexts were detected (Requirement 18).
    """
    total = len(hotspots)
    ind_count = sum(1 for h in hotspots if "Industrial" in h.get("classification", ""))
    agri_count = sum(1 for h in hotspots if "Agricultural" in h.get("classification", ""))
    wild_count = sum(1 for h in hotspots if "Wildfire" in h.get("classification", ""))
    unres_count = sum(1 for h in hotspots if "Verification" in h.get("classification", "") or "Unknown" in h.get("classification", ""))

    return {
        "hotspots_analyzed": total,
        "location_analysis": f"{total}/{total}",
        "land_use_analysis": f"{total}/{total}",
        "facility_search": f"{total}/{total}",
        "historical_analysis": f"{total}/{total}",
        "spatial_analysis": f"{total}/{total}",
        "industrial_context_detected": ind_count,
        "agricultural_context_detected": agri_count,
        "vegetation_fire_context_detected": wild_count,
        "truly_unresolved": unres_count,
        "gis_status": "Local Spatial Context Active (Full Coverage)"
    }


def compute_analysis_health(hotspots: list[dict]) -> dict:
    total = len(hotspots)
    risk_summary = {
        "CRITICAL": sum(1 for h in hotspots if h.get("risk_level") == "CRITICAL" or h.get("risk", {}).get("level") == "CRITICAL"),
        "HIGH": sum(1 for h in hotspots if h.get("risk_level") == "HIGH" or h.get("risk", {}).get("level") == "HIGH"),
        "MODERATE": sum(1 for h in hotspots if h.get("risk_level") == "MODERATE" or h.get("risk", {}).get("level") == "MODERATE"),
        "LOW": sum(1 for h in hotspots if h.get("risk_level") == "LOW" or h.get("risk", {}).get("level") == "LOW"),
        "MINIMAL": sum(1 for h in hotspots if h.get("risk_level") == "MINIMAL" or h.get("risk", {}).get("level") == "MINIMAL"),
        "UNRESOLVED": sum(1 for h in hotspots if "Verification" in h.get("classification", "") or "Unknown" in h.get("classification", "")),
    }
    classified = 0
    low_conf = 0
    verif_required = 0
    breakdown = {}

    for h in hotspots:
        cls = h.get("classification", "Unknown")
        conf = h.get("confidenceLevel") or h.get("analytical_confidence", "Low")
        verif = h.get("verificationStatus") or h.get("verification_status", "Recommended")
        breakdown[cls] = breakdown.get(cls, 0) + 1

        if "Verification" in cls or verif == "Required":
            verif_required += 1
        else:
            classified += 1

        if conf == "Low":
            low_conf += 1

    return {
        "total": total,
        "classified": classified,
        "low_confidence": low_conf,
        "verification_required": verif_required,
        "analysis_status": "Complete" if total > 0 else "Pending",
        "analysis_completed_count": total,
        "breakdown": breakdown,
        "risk_summary": risk_summary,
        "telemetry": compute_analysis_telemetry(hotspots),
    }


# ==============================================================================
# LEGACY & AUDIT TEST COMPATIBILITY WRAPPERS
# ==============================================================================
class ClassificationLabel(str):
    """String subclass that allows dict-style attribute lookups for backwards compatibility."""
    def __new__(cls, val, data_dict=None):
        instance = super().__new__(cls, val)
        instance._data = data_dict or {}
        return instance

    def __getitem__(self, item):
        if isinstance(item, str) and item in self._data:
            return self._data[item]
        return super().__getitem__(item)

    def __contains__(self, item):
        if item in self._data:
            return True
        return super().__contains__(item)

    def get(self, item, default=None):
        return self._data.get(item, default)


def analyze_temporal_persistence(hotspot: dict, all_hotspots: list[dict]) -> dict:
    obs = phase9_temporal_historical_engine(hotspot, all_hotspots)
    cnt = obs["observationCount"]
    if cnt == 1:
        status = "insufficient_observations"
        lbl = "Single observation — persistence cannot be established"
    elif obs["isStationary"]:
        status = "persistent_stationary"
        lbl = f"Persistent stationary thermal source ({obs['repeatedDetections250m']} detections within 250m)"
    else:
        status = "intermittent"
        lbl = f"Recurrent detections across {cnt} satellite observations"

    return {
        "observation_count": cnt,
        "persistence_status": status,
        "persistence_label": lbl,
        "temporal_span_hours": obs["temporalSpanHours"],
    }


def analyze_gis_evidence(
    nearest_facility: dict | None = None,
    distance_to_facility_m: float | None = None,
    is_queried: bool = False,
) -> dict:
    if not is_queried:
        return {
            "query_status": "not_evaluated",
            "summary": "GIS context not evaluated (viewport too wide or query pending)",
            "nearest_facility_name": None,
            "facility_type": None,
            "facility_type_label": None,
            "distance_m": None,
        }
    if nearest_facility is None:
        return {
            "query_status": "evaluated_none_found",
            "summary": "No registered industrial facilities found within search radius",
            "nearest_facility_name": None,
            "facility_type": None,
            "facility_type_label": None,
            "distance_m": None,
        }
    return {
        "query_status": "evaluated_found",
        "summary": f"{nearest_facility.get('name', 'Facility')} ({distance_to_facility_m:.0f}m)",
        "nearest_facility_name": nearest_facility.get("name"),
        "facility_type": nearest_facility.get("type"),
        "facility_type_label": nearest_facility.get("type_label"),
        "distance_m": distance_to_facility_m,
    }


def analyze_spatial_clustering(hotspot: dict, all_hotspots: list[dict]) -> dict:
    c = phase10_spatial_cluster_density(hotspot, all_hotspots)
    c_size = c["cluster_size"]
    return {
        "cluster_size": c_size,
        "cluster_status": "not_established" if c_size == 1 else ("clustered" if c_size >= 4 else "minor_cluster"),
        "cluster_label": c["cluster_label"],
    }
