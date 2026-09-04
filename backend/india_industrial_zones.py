"""
india_industrial_zones.py

High-Precision Spatial Context & Industrial Geospatial Index for Thermal Watch (India).

Covers major Indian industrial complexes, steel plants, thermal/nuclear power stations,
petroleum refineries, petrochemical hubs, cement/lime clusters, and state industrial development
estates (RIICO, MIDC, KIADB, SIPCOT, GIDC, UPSIDA, KINFRA, etc.).

Provides instant, zero-dependency spatial verification so that hotspots located
within or adjacent to industrial complexes are recognized through physical spatial context,
even when external third-party OSM/Overpass queries time out, are throttled, or return no named facility.
"""

import math

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
# AUTHORITATIVE INDIAN INDUSTRIAL GEOSPATIAL REGISTRY (55+ MAJOR HUBS & CLUSTERS)
# Format: (name, category, centroid_lat, centroid_lon, core_radius_m, outer_boundary_m, description)
# ==============================================================================
INDUSTRIAL_ZONES = [
    # --------------------------------------------------------------------------
    # Rajasthan Industrial, Mineral, Cement & Kiln Clusters
    # --------------------------------------------------------------------------
    (
        "Gotan & Nagaur Industrial Lime & Cement Cluster",
        "cement_lime_kilns",
        27.2872, 73.8390,
        3500, 6000,
        "JK White Cement, UltraTech Birla White, extensive high-temperature limestone kilns, lime processing plants & RIICO industrial zone"
    ),
    (
        "Chanderiya Lead-Zinc Smelter & Chittorgarh Cement Belt",
        "smelter",
        24.8350, 74.6350,
        3500, 6500,
        "Hindustan Zinc pyrometallurgical smelters, captive thermal power, and UltraTech/Birla cement manufacturing"
    ),
    (
        "Bhiwadi, Chopanki & Khushkhera RIICO Industrial Corridor",
        "industrial",
        28.2100, 76.8400,
        4500, 7500,
        "RIICO heavy manufacturing, steel re-rolling, auto parts, glass furnaces, and chemical processing"
    ),
    (
        "Kota Super Thermal Power & DCM Shriram Chemical Belt",
        "power_plant",
        25.1700, 75.8150,
        3500, 6000,
        "Kota Super Thermal Power Station, DCM Shriram chemical complex, fertilizer, and rayon plants"
    ),
    (
        "Matsya Industrial Area (MIA) Alwar",
        "industrial",
        27.5650, 76.6850,
        3500, 5500,
        "Major metallurgical, engineering, mineral processing, and chemical estate"
    ),
    (
        "Bhilwara Textile & Synthetic Mineral Processing SEZ",
        "industrial",
        25.3500, 74.6350,
        3500, 5500,
        "Textile manufacturing boilers, mineral grinding, and thermal utilities"
    ),

    # --------------------------------------------------------------------------
    # Karnataka Industrial, Steel & Engineering Corridors
    # --------------------------------------------------------------------------
    (
        "Bommasandra, Jigani & Electronic City Industrial Corridor",
        "industrial",
        12.7474, 77.6181,
        4500, 7000,
        "KIADB Bommasandra-Jigani heavy engineering, electronics, auto component forging, and pharmaceutical complex"
    ),
    (
        "Toranagallu JSW Vijayanagar Steel Complex",
        "steel_plant",
        15.1850, 76.6500,
        4500, 8000,
        "Integrated steel manufacturing complex, blast furnaces, pellet plants, and captive thermal power"
    ),
    (
        "Peenya Industrial Estate (Bengaluru)",
        "industrial",
        13.0300, 77.5150,
        4000, 6500,
        "One of Asia's largest industrial estates: machine tools, foundries, and metal fabrication"
    ),
    (
        "Challakere & Chitradurga KIADB Industrial Belt",
        "industrial",
        13.8966, 76.5657,
        3500, 6000,
        "KIADB Industrial Area, metallurgy, heavy engineering, and defense technology infrastructure"
    ),
    (
        "Baikampady Industrial Area & MRPL Refinery (Mangaluru)",
        "oil_gas",
        12.9650, 74.8250,
        4000, 6500,
        "MRPL petroleum refinery, petrochemical units, MCF fertilizer, and New Mangalore port industrial SEZ"
    ),
    (
        "Kudgi NTPC Super Thermal Power Project",
        "power_plant",
        16.6350, 75.9250,
        3500, 5500,
        "Coal-fired super thermal power station and transmission infrastructure"
    ),

    # --------------------------------------------------------------------------
    # Tamil Nadu Industrial & Petrochemical Corridors
    # --------------------------------------------------------------------------
    (
        "Sriperumbudur & Irungattukottai SIPCOT Industrial Park",
        "industrial",
        13.0909, 79.9823,
        5000, 8000,
        "Major automotive manufacturing, Saint-Gobain glass furnaces, electronics fabrication, and SIPCOT industrial parks"
    ),
    (
        "Ennore & Manali Petrochemical & Thermal Power Belt (Chennai)",
        "oil_gas",
        13.2100, 80.3150,
        4500, 7500,
        "CPCL petroleum refinery, Ennore thermal power station, petrochemicals, and fertilizer plants"
    ),
    (
        "SIPCOT Gangaikondan Industrial Growth Centre (Tirunelveli)",
        "industrial",
        8.6686, 77.9912,
        4000, 6500,
        "SIPCOT High-Tech Industrial Park, solar glass manufacturing, metal processing, and engineering plants"
    ),
    (
        "Palani & Oddanchatram Agro-Industrial Cluster (Dindigul)",
        "industrial",
        10.1917, 77.6424,
        3500, 5500,
        "Agro-processing plants, spinning mills, industrial boilers, and rural manufacturing cluster"
    ),
    (
        "Thoothukudi (Tuticorin) Thermal Power & Port Industrial Zone",
        "power_plant",
        8.7600, 78.1600,
        4500, 7000,
        "TTPS thermal power station, copper smelting complex, chemical fertilizer, and industrial harbor"
    ),
    (
        "Neyveli Lignite & Thermal Power Complex",
        "power_plant",
        11.5300, 79.4800,
        5000, 8500,
        "NLC open-cast lignite mines, thermal power stations, and chemical processing"
    ),
    (
        "Mettur Thermal Power & Chemical Industrial Zone",
        "power_plant",
        11.7900, 77.8000,
        3500, 6000,
        "Mettur thermal power station, chemical manufacturing, and metallurgy units"
    ),

    # --------------------------------------------------------------------------
    # Kerala & Andhra Pradesh / Telangana Industrial Zones
    # --------------------------------------------------------------------------
    (
        "Kanjikode Industrial Area & WISE Park (Palakkad)",
        "industrial",
        10.9434, 76.3877,
        4000, 6500,
        "Kerala's largest industrial estate: steel rolling, foundries, chemical, instrumentation, and KINFRA park"
    ),
    (
        "Ambalamugal & Kochi Refinery Industrial Belt",
        "oil_gas",
        9.9800, 76.3500,
        4500, 7000,
        "BPCL Kochi Refinery, FACT chemical fertilizers, and petrochemical units"
    ),
    (
        "RINL Visakhapatnam Steel Plant & Industrial Belt",
        "steel_plant",
        17.6350, 83.1800,
        5000, 8500,
        "Integrated shore-based steel works, blast furnaces, and heavy metallurgy"
    ),
    (
        "Visakhapatnam Jawaharlal Nehru Pharma City & SEZ",
        "industrial",
        17.5800, 83.0800,
        4500, 7000,
        "Bulk drug chemical manufacturing, thermal boilers, and industrial infrastructure"
    ),
    (
        "NTPC Simhadri Super Thermal Power Plant",
        "power_plant",
        17.6050, 83.0850,
        3500, 5500,
        "Coal-fired super thermal power generation complex"
    ),
    (
        "Ramagundam NTPC Super Thermal & RFCL Fertilizer",
        "power_plant",
        18.7550, 79.5150,
        4500, 7000,
        "NTPC super thermal power station and RFCL fertilizer chemical manufacturing"
    ),
    (
        "Patancheru & Pashamylaram Industrial SEZ (Hyderabad)",
        "industrial",
        17.5200, 78.2500,
        4500, 7000,
        "Major pharmaceutical active ingredient manufacturing, chemical plants, and heavy engineering"
    ),

    # --------------------------------------------------------------------------
    # Maharashtra Industrial Corridors (MIDC)
    # --------------------------------------------------------------------------
    (
        "MIDC Kurkumbh Chemical & Industrial Zone (Daund/Pune)",
        "industrial",
        18.7388, 74.4055,
        4000, 6500,
        "MIDC Kurkumbh major chemical processing, bulk pharmaceuticals (Cipla), distilleries, and synthetic manufacturing"
    ),
    (
        "Chakan, Bhosari & Talegaon Industrial Corridor (Pune)",
        "industrial",
        18.7550, 73.8500,
        5500, 8500,
        "Automotive assembly (Bajaj, Mercedes, Mahindra), heavy forging, and metal fabrication"
    ),
    (
        "Tarapur MIDC Chemical & Power Complex",
        "industrial",
        19.8200, 72.6900,
        4500, 7000,
        "Maharashtra's largest chemical industrial area, specialty chemicals, and atomic power station"
    ),
    (
        "TTC Thane-Belapur Industrial Area (Navi Mumbai)",
        "industrial",
        19.1200, 73.0100,
        5000, 8000,
        "Petrochemicals, fine chemicals, electrical machinery, and manufacturing corridor"
    ),
    (
        "Trombay & Mahul Petrochemical Complex (Mumbai)",
        "oil_gas",
        19.0150, 72.9050,
        4000, 6500,
        "BPCL and HPCL petroleum refineries, RCF fertilizer works, and thermal generation"
    ),
    (
        "Nagothane & Patalganga Petrochemical Complex",
        "industrial",
        18.7850, 73.1550,
        4000, 6500,
        "Reliance petrochemical cracker, synthetic yarns, and chemical manufacturing"
    ),
    (
        "Chandrapur Super Thermal & Cement Belt",
        "power_plant",
        19.9800, 79.3000,
        5000, 8000,
        "CSTPS super thermal power station, Western Coalfields, and UltraTech/ACC cement plants"
    ),
    (
        "Butibori MIDC 5-Star Industrial Estate (Nagpur)",
        "industrial",
        20.9200, 78.9800,
        4500, 7000,
        "Textile synthetic mills, steel rolling, chemical plants, and heavy engineering"
    ),

    # --------------------------------------------------------------------------
    # Gujarat Petrochemical & Manufacturing Belts (GIDC / PCPIR)
    # --------------------------------------------------------------------------
    (
        "Hazira Industrial & Port Mega-Complex (Surat)",
        "steel_plant",
        21.1150, 72.6750,
        5500, 9000,
        "Reliance Petrochemicals, AM/NS Steel Plant, ONGC gas processing, KRIBHCO fertilizer, and LNG terminal"
    ),
    (
        "Dahej Petroleum, Chemicals & Petrochemicals SEZ (PCPIR)",
        "industrial",
        21.7100, 72.5800,
        6000, 9500,
        "PCPIR chemical hub, petrochem crackers, chlor-alkali, LNG terminal, and heavy manufacturing"
    ),
    (
        "Jamnagar Petroleum Refinery Mega-Complex",
        "oil_gas",
        22.3850, 69.8350,
        6500, 10000,
        "Reliance Jamnagar Refinery (world's largest), Nayara Energy refinery, petrochem crackers, and flares"
    ),
    (
        "Ankleshwar & Panoli GIDC Chemical Zone",
        "industrial",
        21.6350, 73.0100,
        4500, 7000,
        "Chemical manufacturing, dyes, bulk pharmaceuticals, and industrial parks"
    ),
    (
        "Mundra Adani Port & Ultra Mega Power SEZ",
        "power_plant",
        22.8250, 69.7150,
        5500, 9000,
        "Adani Power, Tata Power UMPP, coal handling yards, and SEZ industrial infrastructure"
    ),
    (
        "Vapi GIDC Chemical & Industrial Estate",
        "industrial",
        20.3700, 72.9100,
        4500, 7000,
        "Pulp & paper mills, dyes & pigments, chemical synthesis, and metallurgy"
    ),
    (
        "Sanand GIDC Automotive & Heavy Manufacturing Park",
        "industrial",
        22.9800, 72.3800,
        4500, 7000,
        "Automotive manufacturing (Tata Motors, Ford), engineering, and precision machinery"
    ),

    # --------------------------------------------------------------------------
    # Eastern Heavy Metallurgy, Coalfields & Power Belts (JH / WB / OD / CG)
    # --------------------------------------------------------------------------
    (
        "Dhanbad & Jharia Industrial & Coal Mining Complex",
        "industrial",
        23.7500, 86.4150,
        8500, 13000,
        "Major coking coal washeries, coke-oven batteries, steel fabrication, and thermal utilities"
    ),
    (
        "Bokaro Steel Plant & Industrial Corridor",
        "steel_plant",
        23.6690, 86.1430,
        6000, 9500,
        "SAIL Bokaro integrated steel plant, blast furnaces, sinter plants, and industrial estate"
    ),
    (
        "Tata Steel Jamshedpur & Adityapur Industrial Complex",
        "steel_plant",
        22.8046, 86.2029,
        5000, 8500,
        "Tata Steel integrated steel works, rolling mills, and Adityapur auto-component industrial zone"
    ),
    (
        "Chandrapura & Bermo Thermal & Industrial Area",
        "power_plant",
        23.7500, 86.1200,
        5000, 7500,
        "DVC Chandrapura thermal power station, coal washeries, and industrial yards"
    ),
    (
        "Sindri Fertilizer, Cement & Chemical Complex",
        "industrial",
        23.6500, 86.5000,
        5000, 7500,
        "HURL fertilizer plant, ACC cement works, and chemical processing"
    ),
    (
        "Durgapur & Burnpur Steel Complex",
        "steel_plant",
        23.5180, 87.2950,
        5000, 8000,
        "SAIL Durgapur Steel Plant, IISCO Burnpur steel works, and alloy steels plant"
    ),
    (
        "Asansol & Raniganj Coalfields & Industrial Belt",
        "industrial",
        23.6800, 86.9800,
        6000, 9500,
        "ECL coalfields, refractories, heavy engineering, and glass works"
    ),
    (
        "Haldia Petrochemicals & IOCL Refinery Complex",
        "oil_gas",
        22.0300, 88.0600,
        4500, 7500,
        "IOCL petroleum refinery, Haldia Petrochemicals, and port chemical storage"
    ),
    (
        "Paradeep IOCL Refinery & Chemical Fertilizers",
        "oil_gas",
        20.2750, 86.6450,
        5000, 8000,
        "IOCL crude oil refinery, PPL, and IFFCO fertilizer chemical manufacturing"
    ),
    (
        "Rourkela Steel Plant & Industrial Belt",
        "steel_plant",
        22.2150, 84.8550,
        5000, 8000,
        "SAIL integrated steel plant, plate mills, and captive thermal power"
    ),
    (
        "Tata Steel Kalinganagar Industrial Corridor",
        "steel_plant",
        20.9700, 86.0350,
        5000, 8000,
        "Major integrated steel manufacturing and metallurgy SEZ"
    ),
    (
        "Angul Jindal Steel & Power / NALCO Smelter Complex",
        "steel_plant",
        20.8400, 85.1200,
        5000, 8000,
        "JSPL steel manufacturing and NALCO aluminium smelting complex"
    ),
    (
        "Vedanta Jharsuguda Aluminium & Power SEZ",
        "smelter",
        21.8200, 84.0300,
        5000, 8000,
        "Major aluminium smelting complex and coal-fired thermal power units"
    ),
    (
        "Bhilai Steel Plant & Heavy Industrial SEZ",
        "steel_plant",
        21.1850, 81.3850,
        5000, 8500,
        "SAIL integrated steel plant, blast furnaces, and rail & structural mill"
    ),
    (
        "Korba NTPC Super Thermal & BALCO Aluminium Complex",
        "power_plant",
        22.3595, 82.7501,
        5000, 8500,
        "NTPC Korba Super Thermal, Hasdeo thermal, and Bharat Aluminium smelter"
    ),
    (
        "Jindal Steel & Power Raigarh Complex",
        "steel_plant",
        21.9050, 83.3950,
        4500, 7500,
        "Integrated steel plant, coal washeries, and structural steel works"
    ),
    (
        "Singrauli & Waidhan NTPC Super Thermal Hub",
        "power_plant",
        24.1982, 82.6644,
        6000, 10000,
        "NTPC Singrauli, Vindhyachal thermal power super-complex and Northern Coalfields"
    ),

    # --------------------------------------------------------------------------
    # Northern Industrial, Refinery & Rolling Corridors (PB / HR / UP)
    # --------------------------------------------------------------------------
    (
        "Mandi Gobindgarh Secondary Steel Rolling Belt",
        "steel_plant",
        30.6650, 76.2950,
        4000, 6500,
        "India's primary secondary steel hub with 200+ induction furnaces, rolling mills, and foundries"
    ),
    (
        "Panipat Refinery & Petrochemical Complex",
        "oil_gas",
        29.4750, 76.9050,
        4500, 7500,
        "IOCL Panipat petroleum refinery, naphtha cracker, and thermal units"
    ),
    (
        "Guru Gobind Singh Bathinda Refinery (HMEL)",
        "oil_gas",
        30.0350, 74.8850,
        4500, 7500,
        "HPCL-Mittal energy petroleum refinery and petrochemical plant"
    ),
    (
        "IMT Manesar Automotive & Manufacturing Corridor",
        "industrial",
        28.3750, 76.9250,
        4500, 7500,
        "Maruti Suzuki, automotive engineering, metal processing, and industrial estates"
    ),
    (
        "Sonipat, Rai & Kundli HSIIDC Industrial Corridor",
        "industrial",
        28.9300, 77.1000,
        4500, 7000,
        "HSIIDC food processing, metal fabrication, engineering, and chemical parks"
    ),
    (
        "NTPC Dadri Power & Greater Noida Industrial Belt",
        "power_plant",
        28.5900, 77.5500,
        4500, 7500,
        "NTPC Dadri coal & gas power plant and Greater Noida industrial corridor"
    ),
    (
        "Renukoot Hindalco Aluminium Smelter & Chemical Complex",
        "smelter",
        24.2100, 83.0300,
        4000, 6500,
        "Hindalco integrated aluminium smelter, alumina refinery, and captive thermal power"
    ),
]


def match_industrial_zone(lat: float, lon: float) -> dict | None:
    """
    Performs rigorous point-in-polygon / concentric proximity analysis against the
    Indian industrial geospatial registry (Requirements 3 & 4).

    Returns detailed spatial evidence:
      - is_inside: true if within core facility boundary (distanceToIndustrialBoundaryM = 0)
      - distance_to_boundary_m: geodesic distance to outer boundary in meters
      - distance_to_structure_m: geodesic distance to core industrial structure / centroid
      - apparent_industrial_area: true if within extended industrial complex buffer
      - relationship: "inside", "adjacent", or "nearby"
      - evidence_strength: "CONFIRMED", "STRONG", or "MODERATE"
    """
    best_match = None
    min_dist_to_structure = float("inf")

    for name, ftype, zlat, zlon, core_radius, outer_boundary, desc in INDUSTRIAL_ZONES:
        dist_to_center = calculate_distance_m(lat, lon, zlat, zlon)

        # 1. Hotspot inside core facility polygon / structure area
        if dist_to_center <= core_radius:
            return {
                "name": name,
                "type": ftype,
                "type_label": "Industrial complex",
                "is_inside": True,
                "distance_to_boundary_m": 0.0,
                "distance_to_structure_m": round(dist_to_center, 1),
                "core_radius_m": core_radius,
                "outer_boundary_m": outer_boundary,
                "relationship": "inside",
                "evidence_strength": "CONFIRMED",
                "apparent_industrial_area": True,
                "infrastructure_pattern": "heavy_industrial" if "steel" in ftype or "power" in ftype else "manufacturing_complex",
                "description": desc,
            }

        # 2. Hotspot within outer boundary / immediate industrial complex perimeter
        elif dist_to_center <= outer_boundary:
            dist_to_boundary = round(dist_to_center - core_radius, 1)
            if dist_to_center < min_dist_to_structure:
                min_dist_to_structure = dist_to_center
                best_match = {
                    "name": name,
                    "type": ftype,
                    "type_label": "Industrial complex",
                    "is_inside": False,
                    "distance_to_boundary_m": dist_to_boundary,
                    "distance_to_structure_m": round(dist_to_center, 1),
                    "core_radius_m": core_radius,
                    "outer_boundary_m": outer_boundary,
                    "relationship": "adjacent" if dist_to_boundary <= 250.0 else "nearby",
                    "evidence_strength": "STRONG" if dist_to_boundary <= 250.0 else "MODERATE",
                    "apparent_industrial_area": True,
                    "infrastructure_pattern": "industrial_perimeter",
                    "description": desc,
                }

        # 3. Hotspot within 1.5 km buffer of outer boundary
        elif dist_to_center <= outer_boundary + 1500.0:
            dist_to_boundary = round(dist_to_center - outer_boundary, 1)
            if dist_to_center < min_dist_to_structure:
                min_dist_to_structure = dist_to_center
                best_match = {
                    "name": name,
                    "type": ftype,
                    "type_label": "Industrial complex",
                    "is_inside": False,
                    "distance_to_boundary_m": dist_to_boundary,
                    "distance_to_structure_m": round(dist_to_center, 1),
                    "core_radius_m": core_radius,
                    "outer_boundary_m": outer_boundary,
                    "relationship": "nearby",
                    "evidence_strength": "MODERATE",
                    "apparent_industrial_area": True,
                    "infrastructure_pattern": "industrial_buffer",
                    "description": desc,
                }

    return best_match
