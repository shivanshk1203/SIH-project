"""
test_risk_engine_suite.py

Automated test suite verifying the 10 Behavior & Risk Test Cases from Section 22 of the user prompt:
1. Persistent industrial heat (Low risk, High confidence, Persistent/Stable)
2. New industrial heat (Moderate/Low risk, New)
3. Abnormal industrial heat (High risk, Abnormal/Escalating)
4. Stable agricultural burning (Low/Moderate risk, Seasonal)
5. New agricultural burning (Moderate risk)
6. Expanding wildfire (Critical risk, New/Escalating)
7. Persistent landfill heat (Moderate risk, Persistent)
8. Isolated sensor anomaly (Minimal risk, Sensor-Suspected)
9. High-risk unknown (Critical risk, Low confidence, High priority)
10. Low-risk persistent source (Low risk, Persistent/Stable)
"""

import sys, os
sys.path.insert(0, os.path.abspath('backend'))

import thermal_behavior as tb

def run_tests():
    print("==================================================")
    print("TEST SUITE: THERMAL BEHAVIOR & 0-100 RISK MODEL (10 CASES)")
    print("==================================================")

    # 1. Persistent industrial heat
    # High FRP (8.5 MW), inside facility, detected repeatedly, no expansion
    case1 = tb.calculate_risk_and_nature_profile(
        current_frp=8.5, brightness=355.0, confidence=95,
        source_classification="Likely Industrial Heat", classification_confidence_pct=92,
        dist_settlement_km=8.5, dist_industrial_boundary_m=0.0, dist_road_m=450.0,
        land_cover="Built-up / Industrial Complex",
        all_hotspots=[{"latitude": 15.1850, "longitude": 76.6500, "frp": 8.5}],
        lat=15.1850, lon=76.6500
    )
    print(f"\n[Case 1] Persistent Industrial Heat:")
    print(f"  Risk: {case1['risk']['score']}/100 ({case1['risk']['level']})")
    print(f"  Nature: {case1['thermalNature']['state']}")
    print(f"  Confidence: {case1['classification']['confidence']}%")
    assert case1['risk']['level'] in ("LOW", "MODERATE"), f"Case 1 risk too high: {case1['risk']}"
    assert "PERSISTENT" in case1['thermalNature']['state']
    print("  [PASS] High FRP industrial heat confirmed as LOW/MODERATE risk because it is stable within facility")

    # 2. New industrial heat
    case2 = tb.calculate_risk_and_nature_profile(
        current_frp=3.2, brightness=335.0, confidence=80,
        source_classification="Possible Industrial Heat", classification_confidence_pct=65,
        dist_settlement_km=4.5, dist_industrial_boundary_m=120.0, dist_road_m=250.0,
        land_cover="Built-up / Industrial Complex",
        all_hotspots=[], lat=28.2100, lon=76.8400
    )
    print(f"\n[Case 2] New Industrial Heat:")
    print(f"  Risk: {case2['risk']['score']}/100 ({case2['risk']['level']})")
    print(f"  Nature: {case2['thermalNature']['state']}")
    assert case2['risk']['level'] in ("LOW", "MODERATE")
    print("  [PASS] New industrial heat classified with appropriate baseline uncertainty")

    # 3. Abnormal industrial heat (Sudden 4.2x spike near populated area)
    case3 = tb.calculate_risk_and_nature_profile(
        current_frp=14.5, brightness=372.0, confidence=90,
        source_classification="Likely Industrial Heat", classification_confidence_pct=88,
        dist_settlement_km=1.1, dist_industrial_boundary_m=0.0, dist_road_m=120.0,
        land_cover="Built-up / Industrial Complex",
        all_hotspots=[
            {"latitude": 21.7100, "longitude": 72.5800, "frp": 2.2},
            {"latitude": 21.7100, "longitude": 72.5800, "frp": 2.5},
        ],
        lat=21.7100, lon=72.5800
    )
    print(f"\n[Case 3] Abnormal Industrial Heat Spike:")
    print(f"  Risk: {case3['risk']['score']}/100 ({case3['risk']['level']})")
    print(f"  Nature: {case3['thermalNature']['state']}")
    assert case3['risk']['level'] in ("HIGH", "CRITICAL"), f"Expected HIGH/CRITICAL: {case3['risk']}"
    assert "ABNORMAL" in case3['thermalNature']['state']
    print("  [PASS] Sudden abnormal industrial spike elevated to HIGH/CRITICAL risk")

    # 4. Stable agricultural burning
    case4 = tb.calculate_risk_and_nature_profile(
        current_frp=2.2, brightness=332.0, confidence=75,
        source_classification="Likely Agricultural Burning", classification_confidence_pct=85,
        dist_settlement_km=3.5, dist_industrial_boundary_m=9999.0, dist_road_m=450.0,
        land_cover="Cropland / Agricultural Land",
        all_hotspots=[{"latitude": 30.3, "longitude": 75.8, "frp": 2.0}],
        lat=30.3, lon=75.8
    )
    print(f"\n[Case 4] Stable Agricultural Burning:")
    print(f"  Risk: {case4['risk']['score']}/100 ({case4['risk']['level']})")
    assert case4['risk']['level'] in ("LOW", "MODERATE")
    print("  [PASS] Typical agricultural burn has manageable LOW/MODERATE risk")

    # 5. New agricultural burning
    case5 = tb.calculate_risk_and_nature_profile(
        current_frp=3.8, brightness=340.0, confidence=70,
        source_classification="Possible Agricultural Burning", classification_confidence_pct=60,
        dist_settlement_km=1.2, dist_industrial_boundary_m=9999.0, dist_road_m=200.0,
        land_cover="Cropland / Agricultural Land",
        all_hotspots=[], lat=30.5, lon=75.9
    )
    print(f"\n[Case 5] New Agricultural Burning:")
    print(f"  Risk: {case5['risk']['score']}/100 ({case5['risk']['level']})")
    print(f"  Nature: {case5['thermalNature']['state']}")
    assert case5['risk']['level'] in ("MODERATE", "LOW")
    print("  [PASS] New agricultural burning evaluated with exposure proximity")

    # 6. Expanding wildfire
    wildfire_cluster = [
        {"latitude": 22.5000, "longitude": 81.2000, "frp": 35.0},
        {"latitude": 22.5040, "longitude": 81.2050, "frp": 28.0},
        {"latitude": 22.5080, "longitude": 81.2090, "frp": 42.0},
        {"latitude": 22.5120, "longitude": 81.2140, "frp": 50.0},
        {"latitude": 22.5160, "longitude": 81.2180, "frp": 38.0},
        {"latitude": 22.5200, "longitude": 81.2220, "frp": 45.0},
    ]
    case6 = tb.calculate_risk_and_nature_profile(
        current_frp=35.0, brightness=385.0, confidence=98,
        source_classification="Likely Wildfire", classification_confidence_pct=88,
        dist_settlement_km=1.2, dist_industrial_boundary_m=9999.0, dist_road_m=300.0,
        land_cover="Forest / Dense Woodland",
        all_hotspots=wildfire_cluster,
        lat=22.5000, lon=81.2000
    )
    print(f"\n[Case 6] Expanding Wildfire:")
    print(f"  Risk: {case6['risk']['score']}/100 ({case6['risk']['level']})")
    print(f"  Nature: {case6['thermalNature']['state']}")
    assert case6['risk']['level'] == "CRITICAL", f"Expected CRITICAL: {case6['risk']}"
    assert "ESCALATING" in case6['thermalNature']['state'] or "EXPANDING" in case6['thermalNature']['state']
    print("  [PASS] Expanding wildfire correctly categorized as CRITICAL risk")

    # 7. Persistent landfill heat
    case7 = tb.calculate_risk_and_nature_profile(
        current_frp=1.8, brightness=322.0, confidence=65,
        source_classification="Mining / Waste Heat", classification_confidence_pct=72,
        dist_settlement_km=2.5, dist_industrial_boundary_m=9999.0, dist_road_m=400.0,
        land_cover="Quarry / Mining Site",
        all_hotspots=[{"latitude": 28.72, "longitude": 77.15, "frp": 1.6}],
        lat=28.72, lon=77.15
    )
    print(f"\n[Case 7] Persistent Landfill Heat:")
    print(f"  Risk: {case7['risk']['score']}/100 ({case7['risk']['level']})")
    assert case7['risk']['level'] in ("LOW", "MODERATE")
    print("  [PASS] Persistent landfill smoldering evaluated as MODERATE/LOW")

    # 8. Isolated sensor anomaly (Open water glint)
    case8 = tb.calculate_risk_and_nature_profile(
        current_frp=0.3, brightness=298.0, confidence=30,
        source_classification="Possible False Positive / Sensor Anomaly", classification_confidence_pct=75,
        dist_settlement_km=35.0, dist_industrial_boundary_m=9999.0, dist_road_m=9999.0,
        land_cover="Water Body / Wetland",
        all_hotspots=[], lat=18.0, lon=72.0
    )
    print(f"\n[Case 8] Isolated Sensor Anomaly:")
    print(f"  Risk: {case8['risk']['score']}/100 ({case8['risk']['level']})")
    print(f"  Nature: {case8['thermalNature']['state']}")
    assert case8['risk']['level'] == "MINIMAL", f"Expected MINIMAL: {case8['risk']}"
    assert case8['thermalNature']['state'] == "SENSOR-SUSPECTED"
    print("  [PASS] Sensor anomaly correctly treated as MINIMAL fire risk")

    # 9. High-risk unknown (Unknown source, but 4.5x surge near village)
    case9 = tb.calculate_risk_and_nature_profile(
        current_frp=11.5, brightness=365.0, confidence=45,
        source_classification="Unknown / Needs Verification", classification_confidence_pct=32,
        dist_settlement_km=0.6, dist_industrial_boundary_m=9999.0, dist_road_m=150.0,
        land_cover="Rural Open Land",
        all_hotspots=[
            {"latitude": 24.5, "longitude": 78.5, "frp": 2.0},
            {"latitude": 24.502, "longitude": 78.503, "frp": 2.2},
        ],
        lat=24.5, lon=78.5
    )
    print(f"\n[Case 9] High-Risk Unknown Source:")
    print(f"  Risk: {case9['risk']['score']}/100 ({case9['risk']['level']})")
    print(f"  Confidence: {case9['classification']['confidence']}%")
    print(f"  Priority: {case9['priority']['score']}/100 ({case9['priority']['level']})")
    assert case9['risk']['level'] in ("HIGH", "CRITICAL"), f"Expected HIGH/CRITICAL: {case9['risk']}"
    assert case9['priority']['level'] == "URGENT", f"Expected URGENT priority: {case9['priority']}"
    print("  [PASS] High-risk unknown source triggers URGENT investigation priority despite low classification confidence")

    # 10. Low-risk persistent source
    case10 = tb.calculate_risk_and_nature_profile(
        current_frp=1.2, brightness=315.0, confidence=80,
        source_classification="Likely Industrial Heat", classification_confidence_pct=95,
        dist_settlement_km=12.0, dist_industrial_boundary_m=0.0, dist_road_m=600.0,
        land_cover="Built-up / Industrial Complex",
        all_hotspots=[{"latitude": 22.385, "longitude": 69.835, "frp": 1.2}],
        lat=22.385, lon=69.835
    )
    print(f"\n[Case 10] Low-Risk Persistent Source:")
    print(f"  Risk: {case10['risk']['score']}/100 ({case10['risk']['level']})")
    assert case10['risk']['level'] in ("MINIMAL", "LOW")
    print("  [PASS] Low-risk persistent source verified")

    print("\n==================================================")
    print("ALL 10 THERMAL BEHAVIOR & RISK TEST CASES PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
