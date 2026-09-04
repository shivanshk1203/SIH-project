"""
test_thermal_analysis.py
"""

import sys
import os

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import thermal_analysis
import india_places


def run_tests():
    print("==================================================")
    print("EVIDENCE-DRIVEN THERMAL ANOMALY AUDIT TEST SUITE")
    print("==================================================")

    # TEST 1: Single Observation Temporal Persistence
    single_hotspot = {
        "id": "single-test-01",
        "latitude": 21.1500,
        "longitude": 79.1000,
        "brightness": 335.0,
        "confidence": 75,
        "detected_at": "2026-09-02T05:00:00Z",
    }
    temporal_single = thermal_analysis.analyze_temporal_persistence(single_hotspot, [single_hotspot])
    print("\n[TEST 1] Single Observation Temporal Persistence:")
    print("  observation_count: ", temporal_single["observation_count"])
    print("  persistence_status:", temporal_single["persistence_status"])

    assert temporal_single["observation_count"] == 1
    assert temporal_single["persistence_status"] == "insufficient_observations"
    assert "repeatedly" not in temporal_single["persistence_label"].lower()
    print("  [PASS] Single observation correctly identified as insufficient_observations")

    # TEST 2: Un-queried GIS
    gis_unqueried = thermal_analysis.analyze_gis_evidence(
        nearest_facility=None,
        distance_to_facility_m=None,
        is_queried=False,
    )
    print("\n[TEST 2] Un-queried GIS Context:")
    assert gis_unqueried["query_status"] == "not_evaluated"
    assert "not evaluated" in gis_unqueried["summary"].lower()
    print("  [PASS] Un-queried GIS cell reports Not evaluated")

    # TEST 3: Single Point Spatial Cluster
    spatial_single = thermal_analysis.analyze_spatial_clustering(single_hotspot, [single_hotspot])
    print("\n[TEST 3] Single Point Spatial Clustering:")
    assert spatial_single["cluster_size"] == 1
    assert spatial_single["cluster_status"] == "not_established"
    print("  [PASS] Single detection reports Spatial cluster: Not established")

    # TEST 4: Inconclusive Isolated Point
    weak_hotspot = {
        "id": "weak-test-01",
        "latitude": 21.1500,
        "longitude": 79.1000,
        "brightness": 312.0,
        "confidence": 45,
        "frp": 0.3,
        "detected_at": "2026-09-02T05:00:00Z",
        "daynight": "N",
    }
    inconclusive_res = thermal_analysis.analyze_hotspot(
        hotspot=weak_hotspot,
        all_hotspots=[weak_hotspot],
        nearest_facility=None,
        distance_to_facility_m=None,
        is_gis_queried=False,
    )
    cls_inc = inconclusive_res["classification"]
    print("\n[TEST 4] Inconclusive Isolated Hotspot Classification:")
    print("  label:             ", cls_inc["label"])
    print("  likely_source:     ", cls_inc["likely_source"])
    print("  recommended_action:", cls_inc["recommended_action"])

    assert "Verification" in cls_inc["label"] or "Unknown" in cls_inc["label"]
    assert "source_scores" in cls_inc
    assert sum(cls_inc["source_scores"].values()) == 100
    print("  [PASS] Inconclusive hotspot assigned verification guidance with sum(scores)==100")

    # TEST 5: Industrial Facility Proximity + Multi-Pass Persistence
    ind_point_1 = {
        "id": "ind-01",
        "latitude": 21.6850,
        "longitude": 72.6850,
        "brightness": 358.0,
        "confidence": 95,
        "detected_at": "2026-08-30T18:30:00Z",
        "daynight": "N",
    }
    ind_point_2 = {
        "id": "ind-02",
        "latitude": 21.6852,
        "longitude": 72.6851,
        "brightness": 355.0,
        "confidence": 92,
        "detected_at": "2026-08-31T18:25:00Z",
        "daynight": "N",
    }
    ind_point_3 = {
        "id": "ind-03",
        "latitude": 21.6849,
        "longitude": 72.6849,
        "brightness": 360.0,
        "confidence": 98,
        "detected_at": "2026-09-01T18:20:00Z",
        "daynight": "N",
    }
    facility_ind = {
        "name": "Hazira Petrochemical Complex & Gas Processing",
        "type": "industrial",
        "type_label": "Petrochemical Refinery / Chemical Plant",
        "latitude": 21.6848,
        "longitude": 72.6847,
    }

    ind_res = thermal_analysis.analyze_hotspot(
        hotspot=ind_point_1,
        all_hotspots=[ind_point_1, ind_point_2, ind_point_3],
        nearest_facility=facility_ind,
        distance_to_facility_m=42.0,
        is_gis_queried=True,
    )
    cls_ind = ind_res["classification"]
    temp_ind = ind_res["temporal_analysis"]
    print("\n[TEST 5] Industrial Facility + Multi-Pass Persistence:")
    print("  label:          ", cls_ind["label"])
    print("  likely_source:  ", cls_ind["likely_source"])
    print("  confidence:     ", cls_ind["analytical_confidence"])

    assert "Industrial" in cls_ind["label"]
    assert cls_ind["analytical_confidence"] == "High"
    assert temp_ind["persistence_status"] == "persistent_stationary"
    assert temp_ind["observation_count"] == 3
    print("  [PASS] Industrial facility confirms High confidence")

    # TEST 6: Forest Canopy + Active Cluster -> Likely Wildfire
    wf_point_1 = {
        "id": "wf-01",
        "latitude": 22.4500,
        "longitude": 77.8500,
        "brightness": 365.0,
        "frp": 28.0,
        "confidence": 90,
        "detected_at": "2026-09-02T05:00:00Z",
    }
    wf_point_2 = {
        "id": "wf-02",
        "latitude": 22.4530,
        "longitude": 77.8540,
        "brightness": 358.0,
        "frp": 22.0,
        "confidence": 88,
        "detected_at": "2026-09-02T05:00:00Z",
    }
    facility_wf = {
        "name": "Satpura National Park / Reserve Forest",
        "type": "forest",
        "type_label": "Forest / Protected Reserve",
        "latitude": 22.4490,
        "longitude": 77.8490,
    }

    wf_res = thermal_analysis.analyze_hotspot(
        hotspot=wf_point_1,
        all_hotspots=[wf_point_1, wf_point_2],
        nearest_facility=facility_wf,
        distance_to_facility_m=120.0,
        is_gis_queried=True,
    )
    cls_wf = wf_res["classification"]
    print("\n[TEST 6] Forest Canopy + Spatial Cluster:")
    print("  label:     ", cls_wf["label"])
    print("  confidence:", cls_wf["analytical_confidence"])

    assert cls_wf["label"] == "Likely Wildfire"
    assert cls_wf["analytical_confidence"] == "High"
    print("  [PASS] Forest cluster confirmed as Likely Wildfire with High confidence")

    # TEST 7: Water Body Surface -> False Positive / Anomaly
    water_point = {
        "id": "water-01",
        "latitude": 19.5000,
        "longitude": 85.3000,
        "brightness": 302.0,
        "frp": 0.4,
        "confidence": 35,
        "detected_at": "2026-09-02T06:00:00Z",
    }
    facility_water = {
        "name": "Chilika Lake (Water Body)",
        "type": "water",
        "type_label": "Water body / Lake",
        "latitude": 19.5002,
        "longitude": 85.3001,
    }
    water_res = thermal_analysis.analyze_hotspot(
        hotspot=water_point,
        all_hotspots=[water_point],
        nearest_facility=facility_water,
        distance_to_facility_m=25.0,
        is_gis_queried=True,
    )
    cls_water = water_res["classification"]
    print("\n[TEST 7] Water Body Surface:")
    print("  label:     ", cls_water["label"])

    assert "False Positive" in cls_water["label"] or "Anomaly" in cls_water["label"]
    print("  [PASS] Water surface glint confirmed as False Positive / Sensor Anomaly")

    # TEST 8: Rural Cropland -> Agricultural Burning
    agri_point = {
        "id": "agri-01",
        "latitude": 30.3000,
        "longitude": 75.8000,
        "brightness": 332.0,
        "frp": 3.2,
        "confidence": 80,
        "detected_at": "2026-09-02T10:30:00Z",
        "daynight": "D",
    }
    facility_farm = {
        "name": "Ludhiana Agricultural Belt",
        "type": "farm",
        "type_label": "Farmland / Cropland",
        "latitude": 30.2990,
        "longitude": 75.7990,
    }
    agri_res = thermal_analysis.analyze_hotspot(
        hotspot=agri_point,
        all_hotspots=[agri_point],
        nearest_facility=facility_farm,
        distance_to_facility_m=80.0,
        is_gis_queried=True,
    )
    cls_agri = agri_res["classification"]
    print("\n[TEST 8] Rural Cropland Detection:")
    print("  label:        ", cls_agri["label"])
    print("  likely_source:", cls_agri["likely_source"])
    assert "Agricultural" in cls_agri["label"]
    print("  [PASS] Rural cropland correctly classified as Agricultural Burning")

    # TEST 9: India Settlement Geodesic Lookup
    place = india_places.find_nearest_settlement(27.2, 73.7)
    print("\n[TEST 9] India Settlement Index Lookup:")
    print("  settlement: ", place["name"], place["state"])
    assert place["name"] == "Nagaur"
    assert place["state"] == "Rajasthan"
    print("  [PASS] Geodesic settlement index correctly matched Nagaur, Rajasthan")

    # TEST 10: Evidence Matrix & Scientific Advisory
    matrix = ind_res["evidence_matrix"]
    print("\n[TEST 10] Evidence Matrix & Scientific Advisory:")
    assert len(matrix) >= 4
    advisory = ind_res["scientific_advisory"]
    assert "decision-support" in advisory.lower()
    print("  [PASS] Evidence matrix and scientific advisory verified")

    print("\n==================================================")
    print("ALL 10 EVIDENCE-DRIVEN AUDIT TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
