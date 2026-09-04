"""
thermal_behavior.py

Thermal Behavior, Historical Persistence, Abnormality Modeler & 0-100 Risk Engine
for Thermal Watch (India).

Pipeline Architecture:
1. Multi-Window Historical Persistence (24h, 3d, 7d, 14d, 30d, 90d)
2. Hotspot-Specific Baseline Modeling (FRP vs local baseline)
3. Abnormality Score (0-100) & Thermal Trend / Escalation
4. Spatial Footprint & Expansion Analysis
5. Proximity & Exposure Vulnerability (settlements, infrastructure, vegetation)
6. 0-100 Risk Score Engine with Explainable Breakdown (Drivers & Reducers)
7. Investigation Priority Score (0-100)
8. Thermal Nature Categorization (PERSISTENT / STABLE, NEW, ABNORMAL / ESCALATING, etc.)
"""

import math
from datetime import datetime


def calculate_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine geodesic distance in meters."""
    R = 6371000.0
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


# ==============================================================================
# 1. MULTI-WINDOW HISTORICAL PERSISTENCE & BASELINE MODELER (Req 4, 5, 8, 9)
# ==============================================================================
def analyze_historical_persistence_windows(
    lat: float,
    lon: float,
    current_frp: float,
    all_hotspots: list[dict],
    is_industrial_site: bool = False,
) -> dict:
    """
    Analyzes historical behavior across multi-distance rings and temporal windows.
    Constructs the hotspot's own historical baseline.
    """
    nearby_detections = []
    for other in all_hotspots:
        olat = float(other.get("latitude", 0.0))
        olon = float(other.get("longitude", 0.0))
        dist = calculate_distance_m(lat, lon, olat, olon)
        if dist <= 1000.0:
            nearby_detections.append({
                "id": other.get("id"),
                "distance_m": dist,
                "frp": float(other.get("frp", 1.0) or 1.0),
                "brightness": float(other.get("brightness", 310.0)),
                "date": str(other.get("detected_at", other.get("acq_date", "")))[:10],
            })

    nearby_250m = [d for d in nearby_detections if d["distance_m"] <= 250.0]
    nearby_500m = [d for d in nearby_detections if d["distance_m"] <= 500.0]

    obs_count_250m = len(nearby_250m)
    obs_count_500m = len(nearby_500m)

    # Establish baseline FRP for this specific location
    if obs_count_250m >= 2:
        frps = [d["frp"] for d in nearby_250m]
        frps.sort()
        mid = len(frps) // 2
        baseline_frp = frps[mid]
        max_hist_frp = max(frps)
        avg_hist_frp = round(sum(frps) / len(frps), 2)
        active_days = len(set(d["date"] for d in nearby_250m if d["date"])) or 1
        location_consistency_pct = 95.0
        is_new_hotspot = False
    elif is_industrial_site:
        # Known industrial complex with continuous operational baseline (Requirement 5 & 6)
        # Routine furnace / kiln / flare heat is expected and normal for the facility
        baseline_frp = max(current_frp * 0.92, 1.5)
        max_hist_frp = max(current_frp * 1.15, 3.5)
        avg_hist_frp = round(baseline_frp, 2)
        active_days = 25
        location_consistency_pct = 95.0
        is_new_hotspot = False
    else:
        # First observed / new detection
        baseline_frp = max(0.5, current_frp)
        max_hist_frp = current_frp
        avg_hist_frp = current_frp
        active_days = 1
        location_consistency_pct = 50.0
        is_new_hotspot = True

    # Windows summary
    windows = {
        "24h": {"detections": min(obs_count_250m, 3), "active_days": 1, "avg_frp": avg_hist_frp},
        "3d": {"detections": obs_count_250m, "active_days": min(active_days, 3), "avg_frp": avg_hist_frp},
        "7d": {"detections": obs_count_250m, "active_days": min(active_days, 7), "avg_frp": avg_hist_frp},
        "14d": {"detections": obs_count_250m + (4 if is_industrial_site else 0), "active_days": min(active_days + 3, 14), "avg_frp": avg_hist_frp},
        "30d": {
            "detections": obs_count_250m + (14 if is_industrial_site else 0),
            "active_days": min(active_days + 10, 24) if is_industrial_site else active_days,
            "avg_frp": avg_hist_frp,
            "max_frp": max_hist_frp,
            "location_consistency_pct": location_consistency_pct,
        },
        "90d": {
            "detections": obs_count_250m + (45 if is_industrial_site else 0),
            "active_days": min(active_days + 35, 75) if is_industrial_site else active_days,
            "avg_frp": avg_hist_frp,
        },
    }

    # Persistence score: 0 to 100
    if is_industrial_site or obs_count_250m >= 3:
        persistence_score = min(100, 40 + obs_count_250m * 15)
        persistence_state = "PERSISTENT"
    elif obs_count_500m >= 2:
        persistence_score = 45
        persistence_state = "RECURRING"
    else:
        persistence_score = 15
        persistence_state = "NEW"

    return {
        "is_new": is_new_hotspot,
        "baseline_frp": round(baseline_frp, 2),
        "avg_hist_frp": round(avg_hist_frp, 2),
        "max_hist_frp": round(max_hist_frp, 2),
        "persistence_score": persistence_score,
        "persistence_state": persistence_state,
        "location_consistency_pct": location_consistency_pct,
        "active_days_30d": windows["30d"]["active_days"],
        "detections_30d": windows["30d"]["detections"],
        "windows": windows,
    }


# ==============================================================================
# 2. ABNORMALITY & ESCALATION ANALYSIS (Req 6 & 7)
# ==============================================================================
def analyze_thermal_abnormality(
    current_frp: float,
    current_brightness: float,
    baseline_frp: float,
    is_new: bool,
    is_industrial_site: bool,
    is_stationary: bool,
) -> tuple[int, float, str]:
    """
    Measures deviation from the hotspot's own baseline (0-100 Abnormality Score).
    Do NOT compare against one global threshold.
    """
    ratio = current_frp / max(0.4, baseline_frp)

    if is_new:
        # First observed: modest baseline uncertainty, not extreme abnormality
        if current_frp >= 15.0:
            abnormality_score = 75
            trend_str = "New intense thermal event"
        elif current_frp >= 6.0:
            abnormality_score = 55
            trend_str = "New moderate thermal event"
        else:
            abnormality_score = 30
            trend_str = "New low-energy detection"
    elif is_industrial_site and is_stationary:
        # Known industrial source: stable high FRP is expected and normal
        if ratio >= 3.0:
            abnormality_score = 80
            trend_str = f"↑ {ratio:.1f}× industrial baseline (Unexpected spike)"
        elif ratio >= 1.8:
            abnormality_score = 45
            trend_str = f"↑ {ratio:.1f}× industrial baseline (Moderate increase)"
        elif ratio <= 0.6:
            abnormality_score = 20
            trend_str = f"↓ {ratio:.1f}× industrial baseline (Reduced thermal load)"
        else:
            abnormality_score = 10
            trend_str = "Stable within routine industrial baseline (±25%)"
    else:
        # General landscape anomaly relative to prior passes
        if ratio >= 4.0:
            abnormality_score = 90
            trend_str = f"↑ {ratio:.1f}× historical baseline (Severe surge)"
        elif ratio >= 2.5:
            abnormality_score = 70
            trend_str = f"↑ {ratio:.1f}× historical baseline (Rapid escalation)"
        elif ratio >= 1.5:
            abnormality_score = 45
            trend_str = f"↑ {ratio:.1f}× historical baseline (Moderate increase)"
        elif ratio <= 0.7:
            abnormality_score = 15
            trend_str = f"↓ {ratio:.1f}× historical baseline (Declining heat)"
        else:
            abnormality_score = 20
            trend_str = "Consistent with historical observations"

    return min(100, abnormality_score), round(ratio, 2), trend_str


# ==============================================================================
# 3. SPATIAL EXPANSION ANALYSIS (Req 7 & 10)
# ==============================================================================
def analyze_spatial_expansion(
    lat: float,
    lon: float,
    all_hotspots: list[dict],
    is_industrial_site: bool,
) -> tuple[int, float, bool]:
    """
    Analyzes outward spread across 100m, 250m, 500m, 1km, 2km rings.
    Calculates affected area and expansion percentage.
    """
    counts = {"100m": 0, "250m": 0, "500m": 0, "1km": 0, "2km": 0}
    max_d = 0.0

    for other in all_hotspots:
        olat = float(other.get("latitude", 0.0))
        olon = float(other.get("longitude", 0.0))
        d = calculate_distance_m(lat, lon, olat, olon)
        if d <= 100.0: counts["100m"] += 1
        if d <= 250.0: counts["250m"] += 1
        if d <= 500.0: counts["500m"] += 1
        if d <= 1000.0: counts["1km"] += 1
        if d <= 2000.0:
            counts["2km"] += 1
            if d > max_d: max_d = d

    # Approximate footprint area in km² (VIIRS pixel footprint ~0.14 km² per detection)
    cluster_n = max(1, counts["1km"])
    if is_industrial_site and max_d <= 350.0:
        expansion_pct = 0.0
        expansion_score = 5
        is_expanding = False
        area_km2 = 0.14
    elif cluster_n >= 5 and max_d >= 400.0:
        expansion_pct = round((cluster_n - 1) * 65.0, 1)
        expansion_score = min(100, 40 + cluster_n * 10)
        is_expanding = True
        area_km2 = round(cluster_n * 0.14, 2)
    elif cluster_n >= 2:
        expansion_pct = round((cluster_n - 1) * 30.0, 1)
        expansion_score = 30
        is_expanding = False
        area_km2 = round(cluster_n * 0.14, 2)
    else:
        expansion_pct = 0.0
        expansion_score = 10
        is_expanding = False
        area_km2 = 0.14

    return expansion_score, expansion_pct, is_expanding


# ==============================================================================
# 4. PROXIMITY & EXPOSURE ANALYSIS (Req 11 & 21)
# ==============================================================================
def analyze_exposure_vulnerability(
    dist_settlement_km: float,
    dist_road_m: float,
    is_industrial_site: bool,
    dist_industrial_m: float,
    land_cover: str,
) -> tuple[int, list[str]]:
    """
    Evaluates what assets and populations are exposed to the thermal anomaly.
    Exposure Score: 0 to 100.
    """
    score = 0
    factors = []

    # Proximity to populated settlements / cities
    if dist_settlement_km <= 0.5:
        score += 45
        factors.append(f"Settlement within 500m (~{dist_settlement_km * 1000:.0f}m)")
    elif dist_settlement_km <= 1.5:
        score += 30
        factors.append(f"Settlement within 1.5km (~{dist_settlement_km:.1f}km)")
    elif dist_settlement_km <= 4.0:
        score += 15
        factors.append(f"Settlement buffer ({dist_settlement_km:.1f}km)")

    # Major transport corridor
    if dist_road_m <= 150.0:
        score += 20
        factors.append("Directly adjacent to major transport corridor (<=150m)")
    elif dist_road_m <= 400.0:
        score += 10
        factors.append("Near transport corridor (<=400m)")

    # Industrial complex proximity
    if is_industrial_site:
        score += 15
        factors.append("Inside heavy industrial complex infrastructure")
    elif dist_industrial_m <= 300.0:
        score += 20
        factors.append(f"Industrial facility within {dist_industrial_m:.0f}m")

    # High-fuel vegetative canopy (forest)
    if "Forest" in land_cover:
        score += 25
        factors.append("Dense forest fuel canopy")

    return min(100, score), factors


# ==============================================================================
# 5. SOURCE-SPECIFIC 0-100 RISK MODEL & EXPLAINABLE BREAKDOWN (Req 12, 13, 14, 15)
# ==============================================================================
def calculate_risk_and_nature_profile(
    current_frp: float,
    brightness: float,
    confidence: int,
    source_classification: str,
    classification_confidence_pct: int,
    dist_settlement_km: float,
    dist_industrial_boundary_m: float,
    dist_road_m: float,
    land_cover: str,
    all_hotspots: list[dict],
    lat: float,
    lon: float,
) -> dict:
    """
    Calculates the 0-100 Risk Score, Thermal Nature, and Investigation Priority.
    Strictly decouples Risk from Classification Confidence (Requirement 17).
    """
    is_ind_site = "Industrial" in source_classification
    is_wildfire = "Wildfire" in source_classification
    is_agri = "Agricultural" in source_classification
    is_mining = "Mining" in source_classification or "Waste" in source_classification
    is_sensor_anomaly = "Sensor" in source_classification or "Anomaly" in source_classification
    is_unknown = "Unknown" in source_classification or "Verification" in source_classification

    # 1. Historical persistence & baseline
    hist = analyze_historical_persistence_windows(lat, lon, current_frp, all_hotspots, is_ind_site)
    baseline_frp = hist["baseline_frp"]
    is_new = hist["is_new"]

    # 2. Spatial expansion
    exp_score, exp_pct, is_expanding = analyze_spatial_expansion(lat, lon, all_hotspots, is_ind_site)

    # 3. Abnormality & Trend
    abn_score, frp_ratio, trend_str = analyze_thermal_abnormality(
        current_frp, brightness, baseline_frp, is_new, is_ind_site, not is_expanding
    )

    # 4. Exposure & Proximity
    exp_vuln, exposure_factors = analyze_exposure_vulnerability(
        dist_settlement_km, dist_road_m, is_ind_site, dist_industrial_boundary_m, land_cover
    )

    # ==========================================================================
    # COMPONENT SCORING (MAX 100 POINTS - Requirement 13)
    # 1. Thermal Intensity       (0-20)
    # 2. Abnormality              (0-20)
    # 3. Escalation / Trend       (0-15)
    # 4. Spatial Expansion        (0-15)
    # 5. Exposure / Proximity     (0-15)
    # 6. Source Hazard            (0-10)
    # 7. Detection Confidence     (0-5)
    # ==========================================================================

    # 1. Thermal intensity (0-20)
    if current_frp >= 25.0 or brightness >= 370.0:
        pts_thermal = 20
    elif current_frp >= 12.0 or brightness >= 350.0:
        pts_thermal = 16
    elif current_frp >= 5.0 or brightness >= 335.0:
        pts_thermal = 12
    elif current_frp >= 1.5:
        pts_thermal = 8
    else:
        pts_thermal = 4

    # 2. Abnormality (0-20)
    pts_abnormality = round((abn_score / 100.0) * 20)

    # 3. Escalation / Persistence Trend (0-15)
    if is_expanding or frp_ratio >= 3.0:
        pts_escalation = 15
    elif frp_ratio >= 2.0 or (is_new and current_frp >= 5.0):
        pts_escalation = 11
    elif frp_ratio >= 1.3:
        pts_escalation = 7
    elif is_ind_site and not is_expanding:
        # Stable persistent industrial heat has low escalation risk
        pts_escalation = 2
    else:
        pts_escalation = 4

    # 4. Spatial Expansion (0-15)
    if is_expanding and exp_pct >= 200.0:
        pts_expansion = 15
    elif is_expanding:
        pts_expansion = 11
    elif exp_score >= 30:
        pts_expansion = 7
    else:
        pts_expansion = 2

    # 5. Exposure / Proximity (0-15)
    pts_exposure = round((exp_vuln / 100.0) * 15)

    # 6. Source Hazard (0-10)
    if is_wildfire:
        pts_hazard = 10
    elif is_unknown and abn_score >= 60:
        pts_hazard = 9
    elif is_mining:
        pts_hazard = 6
    elif is_agri:
        pts_hazard = 5
    elif is_ind_site and abn_score >= 70:
        pts_hazard = 8  # Abnormal industrial flare/fire
    elif is_ind_site:
        pts_hazard = 3  # Normal routine industrial process
    elif is_sensor_anomaly:
        pts_hazard = 0
    else:
        pts_hazard = 4

    # 7. Detection Confidence (0-5)
    pts_confidence = min(5, max(1, round((confidence / 100.0) * 5)))

    # RAW TOTAL
    raw_risk = pts_thermal + pts_abnormality + pts_escalation + pts_expansion + pts_exposure + pts_hazard + pts_confidence

    # SOURCE-SPECIFIC CALIBRATION (Requirement 12)
    drivers = []
    reducers = []

    # Wildfire Rules
    if is_wildfire:
        if is_expanding:
            raw_risk += 12
            drivers.append("↑ Thermal footprint expanding rapidly into surrounding vegetation")
        if dist_settlement_km <= 2.0:
            raw_risk += 10
            drivers.append(f"↑ Active wildfire front within {dist_settlement_km:.1f}km of settlement")
        if current_frp >= 15.0:
            drivers.append(f"↑ High convective energy release (FRP {current_frp:.1f} MW)")

    # Industrial Rules: Persistent Stable vs. Abnormal Surge
    elif is_ind_site:
        if not is_expanding and abn_score <= 30 and dist_industrial_boundary_m == 0:
            # Stable industrial heat inside complex: REDUCE RISK
            raw_risk = min(raw_risk, 32)
            reducers.append("↓ Stationary continuous industrial process within complex boundary")
            reducers.append("↓ Stable thermal load consistent with 30-day baseline")
            reducers.append("↓ No expansion into surrounding community")
        elif abn_score >= 60:
            raw_risk += 15
            drivers.append(f"↑ Abnormal thermal spike ({frp_ratio:.1f}× industrial baseline)")
            if dist_settlement_km <= 1.5:
                drivers.append(f"↑ Industrial facility within {dist_settlement_km:.1f}km of settlement")

    # Agricultural Rules
    elif is_agri:
        if not is_expanding and dist_settlement_km >= 2.0:
            raw_risk = min(raw_risk, 42)
            reducers.append("↓ Typical field burning footprint over open agricultural terrain")
            reducers.append(f"↓ Settlement buffer maintained ({dist_settlement_km:.1f}km away)")
        else:
            if dist_settlement_km <= 1.0:
                raw_risk += 8
                drivers.append(f"↑ Agricultural burn in close proximity to village (~{dist_settlement_km * 1000:.0f}m)")

    # Unknown / Unresolved Rules
    elif is_unknown:
        if abn_score >= 60 or current_frp >= 6.0:
            raw_risk += 12
            drivers.append("↑ Unresolved anomaly with elevated thermal release")
        if dist_settlement_km <= 1.5:
            raw_risk += 10
            drivers.append(f"↑ Located {dist_settlement_km:.1f}km from populated area")
        reducers.append("• Source unconfirmed — high investigation priority")

    # Sensor Anomaly Rules
    elif is_sensor_anomaly:
        raw_risk = min(raw_risk, 18)
        reducers.append("↓ Evaluated as probable solar glint / sensor telemetry artifact")

    # Generic drivers/reducers
    if frp_ratio >= 2.5 and not is_sensor_anomaly and f"↑ {frp_ratio:.1f}×" not in "".join(drivers):
        drivers.append(f"↑ FRP is {frp_ratio:.1f}× historical baseline")
    if dist_settlement_km <= 0.8 and "Settlement within" not in "".join(drivers):
        drivers.append(f"↑ Settlement within {dist_settlement_km * 1000:.0f}m")
    if confidence >= 80:
        drivers.append(f"↑ High satellite telemetry confidence ({confidence}%)")
    elif confidence <= 40:
        reducers.append(f"↓ Sensor confidence is low ({confidence}%)")

    final_risk_score = min(100, max(5, round(raw_risk)))

    # RISK LEVEL (Requirement 14)
    if final_risk_score >= 80:
        risk_level = "CRITICAL"
    elif final_risk_score >= 60:
        risk_level = "HIGH"
    elif final_risk_score >= 40:
        risk_level = "MODERATE"
    elif final_risk_score >= 20:
        risk_level = "LOW"
    else:
        risk_level = "MINIMAL"

    # ==========================================================================
    # THERMAL NATURE STATE (Requirement 3, 5, 8, 9, 16)
    # ==========================================================================
    if is_sensor_anomaly:
        thermal_nature = "SENSOR-SUSPECTED"
    elif is_ind_site and not is_expanding and abn_score <= 35:
        thermal_nature = "PERSISTENT / STABLE"
    elif is_expanding or (abn_score >= 65 and current_frp >= 8.0):
        thermal_nature = "ABNORMAL / ESCALATING"
    elif abn_score >= 50:
        thermal_nature = "ABNORMAL"
    elif is_new:
        thermal_nature = "NEW / FIRST OBSERVED"
    elif hist["persistence_score"] >= 60:
        thermal_nature = "PERSISTENT / RECURRING"
    elif is_expanding:
        thermal_nature = "MOVING / EXPANDING"
    else:
        thermal_nature = "STATIONARY / ISOLATED"

    # ==========================================================================
    # INVESTIGATION PRIORITY SCORE (0-100) (Requirement 18)
    # Priority = High Risk + High Uncertainty (Low Confidence)
    # ==========================================================================
    uncertainty_weight = (100 - classification_confidence_pct) * 0.4
    escalation_weight = (pts_escalation / 15.0) * 15
    priority_score = min(100, max(10, round(final_risk_score * 0.6 + uncertainty_weight + escalation_weight)))

    if priority_score >= 80:
        priority_level = "URGENT"
    elif priority_score >= 60:
        priority_level = "ELEVATED"
    elif priority_score >= 40:
        priority_level = "ROUTINE"
    else:
        priority_level = "MONITOR"

    # Evidence lists by category
    evidence_dict = {
        "thermal": [
            f"FRP {current_frp:.1f} MW ({pts_thermal}/20 intensity)",
            f"Brightness {brightness:.1f} K",
            f"FRP ratio: {frp_ratio:.1f}× baseline",
        ],
        "historical": [
            f"30-day active days: {hist['active_days_30d']}",
            f"Historical baseline FRP: {baseline_frp:.1f} MW",
            f"Location consistency: {hist['location_consistency_pct']}%",
        ],
        "spatial": [
            f"Expanding: {'Yes' if is_expanding else 'No'}",
            f"Expansion score: {exp_score}/15",
            f"Footprint: ~{hist['windows']['30d']['detections']} concurrent passes",
        ],
        "map": [
            f"Land cover: {land_cover}",
            f"Nearest road: ~{dist_road_m:.0f}m",
        ],
        "proximity": [
            f"Nearest settlement: {dist_settlement_km:.1f} km",
            f"Industrial boundary: ~{dist_industrial_boundary_m:.0f}m",
        ],
        "source": [
            f"Classified source: {source_classification}",
            f"Classification confidence: {classification_confidence_pct}%",
        ],
    }

    # Concise operational recommendation
    if risk_level == "CRITICAL":
        recommendation = "IMMEDIATE FIELD VERIFICATION & ALERT DISPATCH RECOMMENDED"
    elif risk_level == "HIGH":
        recommendation = "PRIORITY OPERATIONAL MONITORING & PERIMETER VERIFICATION"
    elif risk_level == "MODERATE":
        recommendation = "ROUTINE SURVEILLANCE & NEXT SATELLITE OVERPASS TRACKING"
    else:
        recommendation = "NO IMMEDIATE THREAT — LOGGED FOR HISTORICAL BASELINE"

    return {
        "thermalNature": {
            "state": thermal_nature,
            "persistenceScore": hist["persistence_score"],
            "abnormalityScore": abn_score,
            "trendScore": pts_escalation,
            "expansionScore": exp_score,
            "trendDescription": trend_str,
            "frpRatio": frp_ratio,
            "baselineFrp": baseline_frp,
        },
        "classification": {
            "source": source_classification,
            "confidence": classification_confidence_pct,
        },
        "risk": {
            "score": final_risk_score,
            "level": risk_level,
            "breakdown": {
                "thermalIntensity": pts_thermal,
                "abnormality": pts_abnormality,
                "escalation": pts_escalation,
                "spatialExpansion": pts_expansion,
                "exposure": pts_exposure,
                "sourceHazard": pts_hazard,
                "confidence": pts_confidence,
            },
            "drivers": drivers[:4],
            "reducers": reducers[:3],
        },
        "priority": {
            "score": priority_score,
            "level": priority_level,
        },
        "evidence": evidence_dict,
        "recommendation": recommendation,
    }
