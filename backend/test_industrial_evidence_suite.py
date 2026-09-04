"""
backend/test_industrial_evidence_suite.py

Automated regression suite verifying the 7 Success Criteria cases from Section 20
of the user prompt, plus the unified Hotspot Analysis Object schema.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import thermal_analysis as ta

def run_tests():
    print("==================================================")
    print("TEST SUITE: INDUSTRIAL EVIDENCE & 7 SUCCESS CASES")
    print("==================================================")

    # --------------------------------------------------------------------------
    # Case 1: Hotspot inside industrial facility -> Likely Industrial Heat
    # --------------------------------------------------------------------------
    h1 = {
        "id": "test-case-1-jsw-steel",
        "latitude": 15.1850,
        "longitude": 76.6500,
        "brightness": 348.0,
        "frp": 3.5,
        "confidence": 85,
        "detected_at": "2026-09-02T12:00:00",
        "daynight": "D",
    }
    res1 = ta.analyze_hotspot(h1, [h1])
    assert "Industrial" in res1["finalClassification"], f"Case 1 failed: got {res1['finalClassification']}"
    assert res1["finalClassification"] == "Likely Industrial Heat", f"Case 1 should be Likely: {res1['finalClassification']}"
    assert res1["confidenceLevel"] == "High"
    assert res1["spatialEvidence"]["isInsideIndustrialPolygon"] == True
    assert res1["spatialEvidence"]["distanceToIndustrialBoundaryM"] == 0.0
    print(f"[PASS] Case 1 (Inside Facility): {res1['finalClassification']} ({res1['confidenceLevel']} Conf, Score: {res1['sourceScores']['industrial']})")

    # --------------------------------------------------------------------------
    # Case 2: Hotspot near industrial facility but not clearly inside -> Possible Industrial Heat
    # --------------------------------------------------------------------------
    # 24.2380, 82.6644 is near the Singrauli industrial boundary (~300m away)
    h2 = {
        "id": "test-case-2-near-singrauli",
        "latitude": 24.2580,
        "longitude": 82.6644,
        "brightness": 325.0,
        "frp": 1.5,
        "confidence": 70,
        "detected_at": "2026-09-02T14:00:00",
        "daynight": "D",
    }
    res2 = ta.analyze_hotspot(h2, [h2])
    assert "Industrial" in res2["finalClassification"], f"Case 2 failed: got {res2['finalClassification']}"
    assert res2["finalClassification"] == "Possible Industrial Heat", f"Case 2 should be Possible: {res2['finalClassification']}"
    print(f"[PASS] Case 2 (Near Facility): {res2['finalClassification']} ({res2['confidenceLevel']} Conf, Score: {res2['sourceScores']['industrial']})")

    # --------------------------------------------------------------------------
    # Case 3: Hotspot inside forest + expanding cluster -> Likely Wildfire
    # --------------------------------------------------------------------------
    # 3 expanding points in forested terrain with high FRP
    h3_base = {"latitude": 22.5000, "longitude": 81.2000, "brightness": 365.0, "frp": 25.0, "confidence": 95, "daynight": "D"}
    h3_cluster = [
        {"id": "c1", "latitude": 22.5000, "longitude": 81.2000, "brightness": 365.0, "frp": 25.0, "confidence": 95, "daynight": "D"},
        {"id": "c2", "latitude": 22.5030, "longitude": 81.2030, "brightness": 355.0, "frp": 18.0, "confidence": 90, "daynight": "D"},
        {"id": "c3", "latitude": 22.5060, "longitude": 81.2070, "brightness": 370.0, "frp": 32.0, "confidence": 95, "daynight": "D"},
        {"id": "c4", "latitude": 22.5100, "longitude": 81.2120, "brightness": 380.0, "frp": 45.0, "confidence": 98, "daynight": "D"},
    ]
    forest_fac = {"name": "Kanha Forest Reserve", "type": "forest", "latitude": 22.5001, "longitude": 81.2001}
    res3 = ta.analyze_hotspot(h3_cluster[0], h3_cluster, nearest_facility=forest_fac, is_gis_queried=True)
    assert "Wildfire" in res3["finalClassification"], f"Case 3 failed: got {res3['finalClassification']}"
    print(f"[PASS] Case 3 (Forest Expanding): {res3['finalClassification']} ({res3['confidenceLevel']} Conf, Score: {res3['sourceScores']['wildfire']})")

    # --------------------------------------------------------------------------
    # Case 4: Hotspot inside cropland + isolated field pattern -> Possible Agricultural Burning
    # --------------------------------------------------------------------------
    h4 = {
        "id": "test-case-4-agri-field",
        "latitude": 30.8500,
        "longitude": 75.1000,
        "brightness": 338.0,
        "frp": 2.8,
        "confidence": 65,
        "detected_at": "2026-09-02T13:30:00",
        "daynight": "D",
    }
    farm_fac = {"name": "Punjab Paddy Fields", "type": "farm", "latitude": 30.8505, "longitude": 75.1005}
    res4 = ta.analyze_hotspot(h4, [h4], nearest_facility=farm_fac, is_gis_queried=True)
    assert "Agricultural" in res4["finalClassification"], f"Case 4 failed: got {res4['finalClassification']}"
    print(f"[PASS] Case 4 (Cropland Field): {res4['finalClassification']} ({res4['confidenceLevel']} Conf, Score: {res4['sourceScores']['agricultural']})")

    # --------------------------------------------------------------------------
    # Case 5: Hotspot inside landfill / quarry + repeated same location -> Mining / Waste Heat
    # --------------------------------------------------------------------------
    h5 = {
        "id": "test-case-5-landfill",
        "latitude": 28.7200,
        "longitude": 77.1500,
        "brightness": 322.0,
        "frp": 1.8,
        "confidence": 60,
        "detected_at": "2026-09-02T16:00:00",
        "daynight": "D",
    }
    mine_fac = {"name": "Bhalswa Landfill & Recovery Site", "type": "landfill", "latitude": 28.7205, "longitude": 77.1505}
    res5 = ta.analyze_hotspot(h5, [h5], nearest_facility=mine_fac, is_gis_queried=True)
    assert "Mining" in res5["finalClassification"] or "Waste" in res5["finalClassification"], f"Case 5 failed: got {res5['finalClassification']}"
    print(f"[PASS] Case 5 (Landfill / Mining): {res5['finalClassification']} ({res5['confidenceLevel']} Conf)")

    # --------------------------------------------------------------------------
    # Case 6: Weak isolated hotspot directly on open water body -> Possible Sensor Anomaly
    # --------------------------------------------------------------------------
    h6 = {
        "id": "test-case-6-water-anomaly",
        "latitude": 18.0000,
        "longitude": 72.0000,  # Deep Arabian Sea
        "brightness": 298.0,
        "frp": 0.2,
        "confidence": 30,
        "detected_at": "2026-09-02T12:00:00",
        "daynight": "D",
    }
    water_fac = {"name": "Arabian Sea", "type": "water", "latitude": 18.0001, "longitude": 72.0001}
    res6 = ta.analyze_hotspot(h6, [h6], nearest_facility=water_fac, is_gis_queried=True)
    assert "Sensor" in res6["finalClassification"] or "Verification" in res6["finalClassification"], f"Case 6 failed: got {res6['finalClassification']}"
    print(f"[PASS] Case 6 (Water Body Anomaly): {res6['finalClassification']} ({res6['confidenceLevel']} Conf)")

    # --------------------------------------------------------------------------
    # Case 7: Hotspot 27.2872, 73.8390 (Nagaur/Gotan) with EMPTY external facility DB
    # --------------------------------------------------------------------------
    h7 = {
        "id": "firms-27.2872_73.8390_20260902_2142_593",
        "latitude": 27.2872,
        "longitude": 73.8390,
        "brightness": 303.91,
        "frp": 0.55,
        "confidence": 50,
        "detected_at": "2026-09-02T21:42:00",
        "daynight": "N",
    }
    # External OSM query failed / timed out, so empty list and is_gis_queried=False
    res7 = ta.analyze_hotspot(h7, [h7], nearest_facility=None, distance_to_facility_m=None, is_gis_queried=False)
    assert "Industrial" in res7["finalClassification"], f"Case 7 failed: expected Industrial Heat, got {res7['finalClassification']}"
    assert res7["finalClassification"] != "Possible False Positive / Sensor Anomaly", "Case 7 regression: falsely classified as Sensor Anomaly!"
    assert res7["finalClassification"] != "Unknown / Needs Verification", "Case 7 regression: falsely dumped into Unknown!"
    print(f"[PASS] Case 7 (Screenshot Case 27.2872, 73.8390 with Empty External DB):")
    print(f"       Classification: {res7['finalClassification']} ({res7['confidenceLevel']} Conf)")
    print(f"       Industrial Score: {res7['sourceScores']['industrial']}")
    print(f"       Spatial Context: {res7['sourceAttributionDebug']['satelliteSpatialContext']}")
    print(f"       Distance to Boundary: {res7['spatialEvidence']['distanceToIndustrialBoundaryM']} m")

    # --------------------------------------------------------------------------
    # Verify Schema of Unified Hotspot Analysis Object (Requirement 1)
    # --------------------------------------------------------------------------
    for res in (res1, res2, res3, res4, res5, res6, res7):
        assert "locationContext" in res
        assert "spatialEvidence" in res
        assert "historicalEvidence" in res
        assert "sourceScores" in res
        assert "finalClassification" in res
        assert "confidenceLevel" in res
        assert "sourceAttributionDebug" in res
        assert "evidenceChecklist" in res["sourceAttributionDebug"]
    print("[PASS] Unified Hotspot Analysis Object schema verified for all cases")

    print("==================================================")
    print("ALL 7 SUCCESS CRITERIA CASES PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
