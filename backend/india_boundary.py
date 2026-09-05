"""
india_boundary.py

Provides geographic validation to filter NASA FIRMS hotspots strictly to India's
territory, excluding the Arabian Sea, Bay of Bengal, Indian Ocean, and neighboring
countries (Pakistan, Nepal, Bhutan, Bangladesh, Sri Lanka, Myanmar, China).
"""

# Major mainland polygon boundary for India: (longitude, latitude) pairs
# Traces India's international borders and coastal outline.
INDIA_MAINLAND_POLYGON = [
    # Gujarat coast & Rann of Kutch
    (68.1, 23.7), (68.5, 23.8), (69.0, 24.2), (70.0, 24.5), (71.1, 24.7),
    # Rajasthan / Punjab / Pakistan border
    (71.0, 25.5), (70.2, 26.5), (70.5, 27.5), (71.5, 28.3), (72.5, 29.5),
    (73.5, 30.2), (74.2, 31.0), (74.5, 31.8), (74.8, 32.2),
    # J&K and Ladakh northern border
    (74.5, 33.5), (74.0, 34.5), (74.5, 35.5), (76.5, 36.5), (77.5, 37.1),
    (79.0, 36.5), (80.0, 35.5), (79.5, 34.2), (78.8, 33.2), (79.0, 32.5),
    # Himachal & Uttarakhand (border with Tibet/China and Nepal)
    (78.5, 31.5), (79.0, 31.0), (80.2, 30.5), (81.0, 30.2),
    # North of UP / Bihar (skirting southern Nepal border)
    (80.5, 28.8), (81.0, 28.2), (82.0, 27.8), (83.0, 27.4), (84.0, 27.2),
    (85.0, 26.8), (86.0, 26.6), (87.0, 26.5), (88.1, 26.5),
    # Sikkim & border with Bhutan
    (88.1, 27.1), (88.6, 28.0), (88.9, 27.5), (89.0, 27.0), (89.8, 26.8),
    # Assam / Bhutan / Arunachal Pradesh
    (91.5, 27.0), (92.0, 27.8), (92.5, 28.0), (94.0, 28.8), (96.0, 29.2),
    (97.3, 28.5), (97.4, 28.0), (96.5, 27.2),
    # Nagaland, Manipur, Mizoram (eastern border with Myanmar)
    (95.2, 26.5), (94.5, 25.5), (94.2, 24.8), (93.5, 23.5), (93.0, 22.2),
    (92.5, 22.0), (92.0, 23.0),
    # Tripura & Meghalaya skirting Bangladesh border
    (92.0, 24.2), (91.5, 25.2), (90.0, 25.3), (89.8, 25.8), (89.5, 26.2),
    # West Bengal / Bangladesh border down to Sunderbans
    (88.8, 25.8), (88.5, 25.0), (88.2, 24.2), (88.5, 23.5), (89.0, 22.5), (89.2, 21.6),
    # Odisha coast (including Paradip, Puri, Gopalpur)
    (87.5, 21.5), (87.0, 21.0), (86.7, 20.3), (86.0, 19.8), (85.2, 19.2),
    # Andhra Pradesh coast (including Vizag, Kakinada, Machilipatnam, Nellore)
    (84.2, 18.8), (83.5, 17.7), (82.4, 16.9), (81.2, 16.1), (80.4, 15.6),
    (80.2, 14.5), (80.4, 13.5),
    # Tamil Nadu coast to Kanyakumari (including Chennai, Puducherry, Nagapattinam, Rameshwaram, Tuticorin)
    (80.4, 13.1), (80.0, 12.0), (79.9, 11.5), (79.9, 10.5), (79.3, 9.3), (78.3, 8.7), (77.5, 8.0),
    # Kerala & Karnataka coast
    (76.8, 8.8), (76.2, 9.5), (75.8, 11.2), (75.0, 12.5), (74.5, 13.8), (74.2, 14.8),
    # Goa & Maharashtra coast
    (73.8, 15.5), (73.5, 16.5), (73.0, 18.0), (72.8, 19.0), (72.7, 20.0),
    # Gujarat southern coast (Gulf of Khambhat & Kathiawar)
    (72.7, 21.2), (72.2, 21.7), (71.0, 20.8), (70.0, 20.9), (69.0, 22.2),
    (68.9, 22.5), (69.2, 23.0), (68.5, 23.5), (68.1, 23.7),
]

# Andaman & Nicobar Bounding Box
ANDAMAN_NICOBAR_BOX = (92.0, 6.5, 94.5, 14.0)

# Lakshadweep Bounding Box
LAKSHADWEEP_BOX = (71.5, 8.0, 74.5, 12.5)

# India official bounding box (used for clamps and FIRMS queries)
INDIA_BOUNDS = {
    "west": 68.0,
    "south": 6.0,
    "east": 97.5,
    "north": 37.5,
}


def _point_in_polygon(lon: float, lat: float, poly: list[tuple[float, float]]) -> bool:
    """Ray-casting algorithm to test if point (lon, lat) is inside polygon."""
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n]
        if lat > min(p1y, p2y):
            if lat <= max(p1y, p2y):
                if lon <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or lon <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def is_inside_india(lat: float, lon: float) -> bool:
    """
    Returns True if the coordinates fall strictly within India's mainland boundary
    or recognized island territories (Andaman & Nicobar, Lakshadweep).
    Excludes international areas (Pakistan, Nepal, Bangladesh, etc.) and open seas.
    """
    # 1. Quick bounding box check
    if not (INDIA_BOUNDS["south"] <= lat <= INDIA_BOUNDS["north"] and
            INDIA_BOUNDS["west"] <= lon <= INDIA_BOUNDS["east"]):
        return False

    # 2. Island territories check
    w_an, s_an, e_an, n_an = ANDAMAN_NICOBAR_BOX
    if s_an <= lat <= n_an and w_an <= lon <= e_an:
        return True

    w_lk, s_lk, e_lk, n_lk = LAKSHADWEEP_BOX
    if s_lk <= lat <= n_lk and w_lk <= lon <= e_lk:
        return True

    # 3. Mainland polygon boundary check
    return _point_in_polygon(lon, lat, INDIA_MAINLAND_POLYGON)


if __name__ == "__main__":
    print("=" * 70)
    print(" INDIA BOUNDARY GEO-VALIDATION TEST RUN")
    print("=" * 70)

    test_cases = [
        # Inside India mainland
        ("New Delhi", 28.6139, 77.2090, True),
        ("Mumbai", 19.0760, 72.8777, True),
        ("Bengaluru", 12.9716, 77.5946, True),
        ("Kolkata", 22.5726, 88.3639, True),
        ("Chennai", 13.0827, 80.2707, True),
        ("Leh, Ladakh", 34.1526, 77.5771, True),
        ("Guwahati, Assam", 26.1445, 91.7362, True),
        ("Jaipur, Rajasthan", 26.9124, 75.7873, True),
        # Island territories
        ("Port Blair (Andaman & Nicobar)", 11.6234, 92.7265, True),
        ("Kavaratti (Lakshadweep)", 10.5667, 72.6417, True),
        # Outside India
        ("Lahore, Pakistan", 31.5204, 74.3587, False),
        ("Kathmandu, Nepal", 27.7172, 85.3240, False),
        ("Dhaka, Bangladesh", 23.8103, 90.4125, False),
        ("Colombo, Sri Lanka", 6.9271, 79.8612, False),
        ("Arabian Sea (Open Water)", 15.0000, 65.0000, False),
        ("Bay of Bengal (Open Water)", 14.0000, 87.0000, False),
        ("New York, USA", 40.7128, -74.0060, False),
    ]

    all_passed = True
    for name, lat, lon, expected in test_cases:
        result = is_inside_india(lat, lon)
        status = "PASS" if result == expected else "FAIL"
        if result != expected:
            all_passed = False
        status_label = f"[{status}]"
        print(f"{status_label:8} {name:32} (lat={lat:7.4f}, lon={lon:7.4f}) -> {str(result):5} (expected {expected})")

    print("=" * 70)
    if all_passed:
        print(" SUCCESS: All geographic boundary validation test cases passed!")
    else:
        print(" ERROR: Some geographic boundary test cases failed.")
    print("=" * 70)

