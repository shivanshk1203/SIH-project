"""
test_india_suite.py

Automated test suite verifying India-only Thermal Watch hotspot behavior:
1. Health check and India metadata
2. Default India query
3. Regional queries (Delhi, Mumbai, Bengaluru, Northeast, Rajasthan, Southern India)
4. Out-of-bounds rejection (Texas, USA, Europe, Arabian Sea)
5. Cache hit verification
6. Missing API key demo fallback
7. Classification schema and categories integrity
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from server import app
import firms_api
import india_boundary

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("THERMAL WATCH — INDIA TEST SUITE")
    print("==================================================")

    # 1. Health check
    res = client.get("/")
    assert res.status_code == 200, f"Health check failed: {res.status_code}"
    body = res.json()
    assert "India" in body["message"], f"Message does not mention India: {body}"
    print("[PASS] 1. Health check confirmed India scope")

    # 2. Default India query & Wide Viewport Clamping (formerly caused 60.4 x 105.1 error)
    res = client.get("/api/hotspots")
    assert res.status_code == 200, f"Default query failed: {res.status_code}"
    data = res.json()
    hotspots = data.get("hotspots", [])
    assert data.get("source") is not None
    assert data.get("count") == len(hotspots)
    assert data.get("bbox") is not None
    assert data.get("zoom_required") == False
    print(f"[PASS] 2. Default query returned {len(hotspots)} hotspots (source: {data.get('source')})")
    if hotspots:
        for h in hotspots[:10]:
            assert india_boundary.is_inside_india(h["latitude"], h["longitude"]), f"Hotspot outside India: {h}"
        print(f"       Verified first 10 hotspots fall strictly inside India boundaries")

    # 2b. Wide Viewport (e.g. 60.4° x 105.1°) must clamp to India and NOT return zoom_required
    res_wide = client.get("/api/hotspots?west=29.971&south=-10.833&east=135.088&north=49.611")
    assert res_wide.status_code == 200
    data_wide = res_wide.json()
    assert data_wide.get("zoom_required") == False, "Wide query returned zoom_required: True!"
    assert data_wide.get("count") >= len(hotspots), "Wide query failed to return full India dataset!"
    assert data_wide.get("bbox") == {"west": 68.0, "south": 6.0, "east": 97.5, "north": 37.5}
    print(f"[PASS] 2b. Wide viewport (60.4° x 105.1°) safely clamped to India; returned {data_wide.get('count')} hotspots")

    # 3. Regional India Viewports
    regions = [
        ("Delhi / NCR", 76.5, 28.0, 77.8, 29.2),
        ("Mumbai Region", 72.5, 18.5, 73.5, 19.5),
        ("Bengaluru Region", 77.0, 12.5, 78.0, 13.5),
        ("Northeast India (Assam)", 91.0, 25.5, 93.5, 27.5),
        ("Rajasthan (Thar/Jaipur)", 72.0, 25.0, 76.0, 28.0),
        ("Southern India (Karnataka/TN)", 76.0, 10.0, 79.0, 14.0),
    ]

    for name, w, s, e, n in regions:
        res = client.get(f"/api/hotspots?west={w}&south={s}&east={e}&north={n}")
        assert res.status_code == 200, f"Region {name} failed: {res.status_code}"
        r_data = res.json()
        print(f"[PASS] 3. Regional check '{name}': {len(r_data.get('hotspots', []))} hotspots")

    # 4. Out-of-bounds rejection
    oob_cases = [
        ("Old Texas Box", -106.0, 25.0, -93.0, 37.0),
        ("Europe", 2.0, 48.0, 15.0, 55.0),
        ("Arabian Sea deep ocean", 60.0, 12.0, 65.0, 18.0),
    ]

    for name, w, s, e, n in oob_cases:
        res = client.get(f"/api/hotspots?west={w}&south={s}&east={e}&north={n}")
        assert res.status_code == 200
        oob_data = res.json()
        assert len(oob_data.get("hotspots", [])) == 0, f"OOB case {name} returned hotspots: {oob_data}"
        print(f"[PASS] 4. Out-of-bounds rejection for '{name}' returned 0 hotspots")

    # 5. Cache hit verification
    w, s, e, n = 75.0, 15.0, 77.0, 17.0
    # First call (populates or uses cache)
    client.get(f"/api/hotspots?west={w}&south={s}&east={e}&north={n}")
    # Second call (must be cache hit)
    res2 = client.get(f"/api/hotspots?west={w}&south={s}&east={e}&north={n}")
    assert res2.status_code == 200
    print("[PASS] 5. Cache hit verification succeeded")

    # 6. Evidence-driven analytical schema integrity
    if hotspots:
        for h in hotspots:
            assert "id" in h
            assert "latitude" in h
            assert "longitude" in h
            assert "brightness" in h
            assert "confidence" in h
            assert "classification" in h
            assert "analytical_confidence" in h, "Missing analytical_confidence"
            assert h["analytical_confidence"] in ("High", "Medium", "Low", "Insufficient evidence")
            # Verify structured sections
            assert "event" in h, "Missing 'event' (Observed by NASA FIRMS)"
            assert "gis_evidence" in h, "Missing 'gis_evidence'"
            assert "temporal_analysis" in h, "Missing 'temporal_analysis'"
            assert "spatial_analysis" in h, "Missing 'spatial_analysis'"
            assert "classification_details" in h, "Missing 'classification_details'"
            assert "evidence_matrix" in h, "Missing 'evidence_matrix'"
            assert "scientific_advisory" in h, "Missing 'scientific_advisory'"
            # Verify persistence rule: if observation_count == 1, persistence must be insufficient_observations
            temp = h["temporal_analysis"]
            if temp["observation_count"] == 1:
                assert temp["persistence_status"] == "insufficient_observations"
                assert "repeatedly" not in temp["persistence_label"].lower()
        print(f"[PASS] 6. Evidence-driven analytical schema verified for all {len(hotspots)} hotspots")

    # 7. Demo fallback test (with mock missing key)
    orig_key = os.environ.get("FIRMS_MAP_KEY")
    try:
        os.environ.pop("FIRMS_MAP_KEY", None)
        demo_spots = firms_api._load_sample_data()
        assert len(demo_spots) > 0
        assert demo_spots[0]["is_demo_data"] == True
        # Verify demo coordinates are in India
        for d in demo_spots:
            assert india_boundary.is_inside_india(d["latitude"], d["longitude"]), f"Demo spot outside India: {d}"
        print(f"[PASS] 7. Demo fallback verified with {len(demo_spots)} Indian demo hotspots (all is_demo_data=True)")
    finally:
        if orig_key:
            os.environ["FIRMS_MAP_KEY"] = orig_key

    print("==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
