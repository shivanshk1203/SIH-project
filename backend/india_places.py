"""
india_places.py

Zero-dependency spatial settlement index for India.
Contains coordinates for major cities, district headquarters, and towns
across all Indian states and union territories.
Used to give every hotspot detection a human-readable location
(e.g., "Near Nagaur, Rajasthan (~12 km)").
"""

import math

# Representative settlements covering all states & major districts of India
INDIA_SETTLEMENTS = [
    # Rajasthan
    ("Nagaur", "Rajasthan", 27.2021, 73.7423),
    ("Jodhpur", "Rajasthan", 26.2389, 73.0243),
    ("Jaipur", "Rajasthan", 26.9124, 75.7873),
    ("Bikaner", "Rajasthan", 28.0229, 73.3119),
    ("Udaipur", "Rajasthan", 24.5854, 73.7125),
    ("Kota", "Rajasthan", 25.2138, 75.8648),
    ("Ajmer", "Rajasthan", 26.4499, 74.6399),
    ("Alwar", "Rajasthan", 27.5530, 76.6346),
    ("Barmer", "Rajasthan", 25.7521, 71.3967),
    ("Jaisalmer", "Rajasthan", 26.9157, 70.9083),
    ("Sikar", "Rajasthan", 27.6094, 75.1398),
    ("Chittorgarh", "Rajasthan", 24.8887, 74.6269),
    ("Pali", "Rajasthan", 25.7711, 73.3234),
    ("Bhilwara", "Rajasthan", 25.3407, 74.6313),
    ("Hanumangarh", "Rajasthan", 29.5819, 74.3294),
    ("Sri Ganganagar", "Rajasthan", 29.9038, 73.8772),

    # Punjab & Haryana & Delhi
    ("Ludhiana", "Punjab", 30.9010, 75.8573),
    ("Amritsar", "Punjab", 31.6340, 74.8723),
    ("Jalandhar", "Punjab", 31.3260, 75.5762),
    ("Patiala", "Punjab", 30.3398, 76.3869),
    ("Bathinda", "Punjab", 30.2110, 74.9455),
    ("Sangrur", "Punjab", 30.2458, 75.8421),
    ("Firozpur", "Punjab", 30.9237, 74.6114),
    ("Hoshiarpur", "Punjab", 31.5273, 75.9149),
    ("Hisar", "Haryana", 29.1492, 75.7217),
    ("Karnal", "Haryana", 29.6857, 76.9905),
    ("Rohtak", "Haryana", 28.8955, 76.6066),
    ("Panipat", "Haryana", 29.3909, 76.9635),
    ("Ambala", "Haryana", 30.3782, 76.7767),
    ("Gurugram", "Haryana", 28.4595, 77.0266),
    ("Faridabad", "Haryana", 28.4089, 77.3178),
    ("Sirsa", "Haryana", 29.5349, 75.0296),
    ("New Delhi", "Delhi", 28.6139, 77.2090),

    # Uttar Pradesh
    ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
    ("Kanpur", "Uttar Pradesh", 26.4499, 80.3319),
    ("Varanasi", "Uttar Pradesh", 25.3176, 82.9739),
    ("Agra", "Uttar Pradesh", 27.1767, 78.0081),
    ("Prayagraj", "Uttar Pradesh", 25.4358, 81.8463),
    ("Bareilly", "Uttar Pradesh", 28.3670, 79.4304),
    ("Aligarh", "Uttar Pradesh", 27.8974, 78.0880),
    ("Moradabad", "Uttar Pradesh", 28.8386, 78.7733),
    ("Gorakhpur", "Uttar Pradesh", 26.7606, 83.3732),
    ("Jhansi", "Uttar Pradesh", 25.4484, 78.5685),
    ("Meerut", "Uttar Pradesh", 28.9845, 77.7064),
    ("Mathura", "Uttar Pradesh", 27.4924, 77.6737),
    ("Ayodhya", "Uttar Pradesh", 26.7922, 82.1998),
    ("Banda", "Uttar Pradesh", 25.4755, 80.3367),
    ("Mirzapur", "Uttar Pradesh", 25.1337, 82.5644),
    ("Sonbhadra", "Uttar Pradesh", 24.6852, 83.0645),

    # Madhya Pradesh
    ("Bhopal", "Madhya Pradesh", 23.2599, 77.4126),
    ("Indore", "Madhya Pradesh", 22.7196, 75.8577),
    ("Jabalpur", "Madhya Pradesh", 23.1815, 79.9864),
    ("Gwalior", "Madhya Pradesh", 26.2183, 78.1828),
    ("Ujjain", "Madhya Pradesh", 23.1765, 75.7885),
    ("Sagar", "Madhya Pradesh", 23.8388, 78.7378),
    ("Rewa", "Madhya Pradesh", 24.5362, 81.3037),
    ("Satna", "Madhya Pradesh", 24.6005, 80.8322),
    ("Singrauli", "Madhya Pradesh", 24.1997, 82.6645),
    ("Chhindwara", "Madhya Pradesh", 22.0574, 78.9382),
    ("Ratlam", "Madhya Pradesh", 23.3341, 75.0376),
    ("Shivpuri", "Madhya Pradesh", 25.4244, 77.6582),
    ("Betul", "Madhya Pradesh", 21.9014, 77.9015),
    ("Hoshangabad", "Madhya Pradesh", 22.7519, 77.7289),

    # Maharashtra & Goa
    ("Mumbai", "Maharashtra", 19.0760, 72.8777),
    ("Pune", "Maharashtra", 18.5204, 73.8567),
    ("Nagpur", "Maharashtra", 21.1458, 79.0882),
    ("Nashik", "Maharashtra", 19.9975, 73.7898),
    ("Chhatrapati Sambhaji Nagar", "Maharashtra", 19.8762, 75.3433),
    ("Solapur", "Maharashtra", 17.6599, 75.9064),
    ("Amravati", "Maharashtra", 20.9374, 77.7796),
    ("Kolhapur", "Maharashtra", 16.7050, 74.2433),
    ("Chandrapur", "Maharashtra", 19.9615, 79.2961),
    ("Nanded", "Maharashtra", 19.1383, 77.3210),
    ("Jalgaon", "Maharashtra", 21.0077, 75.5626),
    ("Akola", "Maharashtra", 20.7002, 77.0082),
    ("Latur", "Maharashtra", 18.4088, 76.5604),
    ("Dhule", "Maharashtra", 20.9042, 74.7749),
    ("Ahmednagar", "Maharashtra", 19.0952, 74.7496),
    ("Panaji", "Goa", 15.4909, 73.8278),
    ("Margao", "Goa", 15.2832, 73.9862),

    # Gujarat
    ("Ahmedabad", "Gujarat", 23.0225, 72.5714),
    ("Surat", "Gujarat", 21.1702, 72.8311),
    ("Vadodara", "Gujarat", 22.3072, 73.1812),
    ("Rajkot", "Gujarat", 22.3039, 70.8022),
    ("Bhavnagar", "Gujarat", 21.7645, 72.1519),
    ("Jamnagar", "Gujarat", 22.4707, 70.0577),
    ("Gandhinagar", "Gujarat", 23.2156, 72.6369),
    ("Junagadh", "Gujarat", 21.5222, 70.4579),
    ("Bhuj", "Gujarat", 23.2420, 69.6669),
    ("Bharuch", "Gujarat", 21.7051, 72.9959),
    ("Anand", "Gujarat", 22.5645, 72.9289),
    ("Morbi", "Gujarat", 22.8173, 70.8370),
    ("Mehsana", "Gujarat", 23.5880, 72.3693),
    ("Patan", "Gujarat", 23.8493, 72.1266),
    ("Surendranagar", "Gujarat", 22.7279, 71.6370),

    # Chhattisgarh & Jharkhand
    ("Raipur", "Chhattisgarh", 21.2514, 81.6296),
    ("Bhilai", "Chhattisgarh", 21.1938, 81.3509),
    ("Bilaspur", "Chhattisgarh", 22.0797, 82.1409),
    ("Korba", "Chhattisgarh", 22.3595, 82.7501),
    ("Raigarh", "Chhattisgarh", 21.8974, 83.3950),
    ("Jagdalpur", "Chhattisgarh", 19.0740, 82.0080),
    ("Ambikapur", "Chhattisgarh", 23.1189, 83.1979),
    ("Ranchi", "Jharkhand", 23.3441, 85.3096),
    ("Jamshedpur", "Jharkhand", 22.8046, 86.2029),
    ("Dhanbad", "Jharkhand", 23.7957, 86.4304),
    ("Bokaro", "Jharkhand", 23.6693, 86.1511),
    ("Hazaribagh", "Jharkhand", 23.9961, 85.3644),
    ("Deoghar", "Jharkhand", 24.4826, 86.6980),
    ("Giridih", "Jharkhand", 24.1866, 86.3096),

    # Odisha & West Bengal & Bihar
    ("Bhubaneswar", "Odisha", 20.2961, 85.8245),
    ("Cuttack", "Odisha", 20.4625, 85.8828),
    ("Rourkela", "Odisha", 22.2604, 84.8536),
    ("Sambalpur", "Odisha", 21.4669, 83.9812),
    ("Berhampur", "Odisha", 19.3150, 84.7941),
    ("Balasore", "Odisha", 21.4934, 86.9135),
    ("Jharsuguda", "Odisha", 21.8554, 84.0062),
    ("Angul", "Odisha", 20.8444, 85.1511),
    ("Kolkata", "West Bengal", 22.5726, 88.3639),
    ("Howrah", "West Bengal", 22.5958, 88.2636),
    ("Asansol", "West Bengal", 23.6739, 86.9524),
    ("Siliguri", "West Bengal", 26.7271, 88.3953),
    ("Durgapur", "West Bengal", 23.5204, 87.3119),
    ("Kharagpur", "West Bengal", 22.3460, 87.2320),
    ("Malda", "West Bengal", 25.0108, 88.1411),
    ("Bardhaman", "West Bengal", 23.2324, 87.8615),
    ("Patna", "Bihar", 25.5941, 85.1376),
    ("Gaya", "Bihar", 24.7914, 85.0002),
    ("Bhagalpur", "Bihar", 25.2425, 86.9842),
    ("Muzaffarpur", "Bihar", 26.1209, 85.3647),
    ("Purnia", "Bihar", 25.7771, 87.4753),
    ("Darbhanga", "Bihar", 26.1542, 85.8918),
    ("Begusarai", "Bihar", 25.4182, 86.1272),
    ("Munger", "Bihar", 25.3757, 86.4744),

    # Karnataka
    ("Bengaluru", "Karnataka", 12.9716, 77.5946),
    ("Mysuru", "Karnataka", 12.2958, 76.6394),
    ("Hubballi", "Karnataka", 15.3647, 75.1240),
    ("Belagavi", "Karnataka", 15.8497, 74.4977),
    ("Mangaluru", "Karnataka", 12.9141, 74.8560),
    ("Kalaburagi", "Karnataka", 17.3297, 76.8343),
    ("Ballari", "Karnataka", 15.1394, 76.9214),
    ("Davanagere", "Karnataka", 14.4644, 75.9218),
    ("Shivamogga", "Karnataka", 13.9299, 75.5681),
    ("Tumakuru", "Karnataka", 13.3409, 77.1006),
    ("Raichur", "Karnataka", 16.2120, 77.3439),
    ("Bidar", "Karnataka", 17.9104, 77.5199),
    ("Hosapete", "Karnataka", 15.2716, 76.3887),
    ("Vijayapura", "Karnataka", 16.8302, 75.7100),
    ("Koppal", "Karnataka", 15.3467, 76.1544),

    # Andhra Pradesh & Telangana
    ("Visakhapatnam", "Andhra Pradesh", 17.6868, 83.2185),
    ("Vijayawada", "Andhra Pradesh", 16.5062, 80.6480),
    ("Guntur", "Andhra Pradesh", 16.3067, 80.4365),
    ("Nellore", "Andhra Pradesh", 14.4426, 79.9865),
    ("Kurnool", "Andhra Pradesh", 15.8281, 78.0373),
    ("Kakinada", "Andhra Pradesh", 16.9891, 82.2475),
    ("Rajahmundry", "Andhra Pradesh", 17.0005, 81.8040),
    ("Tirupati", "Andhra Pradesh", 13.6288, 79.4192),
    ("Kadapa", "Andhra Pradesh", 14.4673, 78.8242),
    ("Anantapur", "Andhra Pradesh", 14.6819, 77.6006),
    ("Ongole", "Andhra Pradesh", 15.5057, 80.0499),
    ("Eluru", "Andhra Pradesh", 16.7107, 81.0952),
    ("Srikakulam", "Andhra Pradesh", 18.2949, 83.8938),
    ("Hyderabad", "Telangana", 17.3850, 78.4867),
    ("Warangal", "Telangana", 17.9689, 79.5941),
    ("Nizamabad", "Telangana", 18.6725, 78.0941),
    ("Karimnagar", "Telangana", 18.4386, 79.1288),
    ("Ramagundam", "Telangana", 18.7551, 79.5140),
    ("Khammam", "Telangana", 17.2473, 80.1514),
    ("Mahabubnagar", "Telangana", 16.7488, 77.9866),
    ("Nalgonda", "Telangana", 17.0575, 79.2684),
    ("Adilabad", "Telangana", 19.6641, 78.5320),

    # Tamil Nadu & Kerala
    ("Chennai", "Tamil Nadu", 13.0827, 80.2707),
    ("Coimbatore", "Tamil Nadu", 11.0168, 76.9558),
    ("Madurai", "Tamil Nadu", 9.9252, 78.1198),
    ("Tiruchirappalli", "Tamil Nadu", 10.7905, 78.7047),
    ("Salem", "Tamil Nadu", 11.6643, 78.1460),
    ("Tirunelveli", "Tamil Nadu", 8.7139, 77.7567),
    ("Tiruppur", "Tamil Nadu", 11.1085, 77.3411),
    ("Erode", "Tamil Nadu", 11.3410, 77.7172),
    ("Vellore", "Tamil Nadu", 12.9165, 79.1325),
    ("Thanjavur", "Tamil Nadu", 10.7870, 79.1378),
    ("Dindigul", "Tamil Nadu", 10.3673, 77.9803),
    ("Thiruvananthapuram", "Kerala", 8.5241, 76.9366),
    ("Kochi", "Kerala", 9.9312, 76.2673),
    ("Kozhikode", "Kerala", 11.2588, 75.7804),
    ("Thrissur", "Kerala", 10.5276, 76.2144),
    ("Kollam", "Kerala", 8.8932, 76.6141),
    ("Palakkad", "Kerala", 10.7867, 76.6548),
    ("Kannur", "Kerala", 11.8745, 75.3704),

    # Northern & North-Eastern States
    ("Srinagar", "Jammu and Kashmir", 34.0837, 74.7973),
    ("Jammu", "Jammu and Kashmir", 32.7266, 74.8570),
    ("Shimla", "Himachal Pradesh", 31.1048, 77.1734),
    ("Dharamshala", "Himachal Pradesh", 32.2190, 76.3234),
    ("Mandi", "Himachal Pradesh", 31.7087, 76.9320),
    ("Dehradun", "Uttarakhand", 30.3165, 78.0322),
    ("Haridwar", "Uttarakhand", 29.9457, 78.1642),
    ("Haldwani", "Uttarakhand", 29.2183, 79.5130),
    ("Guwahati", "Assam", 26.1445, 91.7362),
    ("Silchar", "Assam", 24.8333, 92.7789),
    ("Dibrugarh", "Assam", 27.4728, 94.9120),
    ("Jorhat", "Assam", 26.7509, 94.2037),
    ("Nagaon", "Assam", 26.3467, 92.6840),
    ("Tezpur", "Assam", 26.6528, 92.7926),
    ("Shillong", "Meghalaya", 25.5788, 91.8933),
    ("Agartala", "Tripura", 23.8315, 91.2868),
    ("Imphal", "Manipur", 24.8170, 93.9368),
    ("Aizawl", "Mizoram", 23.7271, 92.7176),
    ("Kohima", "Nagaland", 25.6751, 94.1086),
    ("Dimapur", "Nagaland", 25.9096, 93.7266),
    ("Itanagar", "Arunachal Pradesh", 27.0844, 93.6053),
    ("Gangtok", "Sikkim", 27.3389, 88.6065),
    ("Port Blair", "Andaman and Nicobar", 11.6234, 92.7265),
    ("Kavaratti", "Lakshadweep", 10.5669, 72.6420),
]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def find_nearest_settlement(lat: float, lon: float) -> dict:
    """
    Finds the nearest settlement (town/city/district) in India to the given coordinates.
    Returns:
      {
        "name": "Nagaur",
        "state": "Rajasthan",
        "distance_km": 14.2,
        "formatted_location": "Near Nagaur, Rajasthan (~14 km)"
      }
    """
    best_dist = float("inf")
    best_item = None

    for name, state, s_lat, s_lon in INDIA_SETTLEMENTS:
        dist = _haversine_km(lat, lon, s_lat, s_lon)
        if dist < best_dist:
            best_dist = dist
            best_item = (name, state)

    if best_item:
        name, state = best_item
        dist_int = round(best_dist)
        if dist_int <= 5:
            formatted = f"{name}, {state}"
        else:
            formatted = f"Near {name}, {state} (~{dist_int} km)"

        return {
            "name": name,
            "state": state,
            "distance_km": round(best_dist, 1),
            "formatted_location": formatted,
        }

    return {
        "name": "India Territory",
        "state": "India",
        "distance_km": 0.0,
        "formatted_location": f"{lat:.2f}°N, {lon:.2f}°E, India",
    }
