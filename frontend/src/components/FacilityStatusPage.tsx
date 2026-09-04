import React, { useMemo, useState } from "react";
import { Hotspot, Facility } from "../types";

export interface FacilityStatusPageProps {
  hotspots: Hotspot[];
  facilities: Facility[];
  onFocusCoordinates: (coords: [number, number]) => void;
}

interface MonitoredIndustrialHub {
  id: string;
  name: string;
  category: "Refinery & Petrochemical" | "Thermal Power Station" | "Steel & Smelter" | "Chemical Complex";
  state: string;
  coords: [number, number];
  nominalBaselineFrpMw: number;
  criticalThresholdMw: number;
  contactChannel: string;
}

const MAJOR_INDIAN_HUBS: MonitoredIndustrialHub[] = [
  {
    id: "hub-jamnagar",
    name: "Reliance Jamnagar Refinery & Petrochemicals",
    category: "Refinery & Petrochemical",
    state: "Gujarat",
    coords: [22.37, 69.85],
    nominalBaselineFrpMw: 35.0,
    criticalThresholdMw: 90.0,
    contactChannel: "EMERGENCY_DESK_ZONE_A",
  },
  {
    id: "hub-mundra",
    name: "Mundra Thermal Power Plant & SEZ",
    category: "Thermal Power Station",
    state: "Gujarat",
    coords: [22.82, 69.61],
    nominalBaselineFrpMw: 25.0,
    criticalThresholdMw: 75.0,
    contactChannel: "APSEZ_CONTROL_ROOM",
  },
  {
    id: "hub-singrauli",
    name: "NTPC Singrauli Super Thermal Power Station",
    category: "Thermal Power Station",
    state: "Uttar Pradesh / MP",
    coords: [24.10, 82.68],
    nominalBaselineFrpMw: 40.0,
    criticalThresholdMw: 110.0,
    contactChannel: "NTPC_SAFETY_GRID_1",
  },
  {
    id: "hub-korba",
    name: "Korba Super Thermal Power & Smelter Complex",
    category: "Steel & Smelter",
    state: "Chhattisgarh",
    coords: [22.38, 82.72],
    nominalBaselineFrpMw: 32.0,
    criticalThresholdMw: 85.0,
    contactChannel: "BALCO_KORBA_DISPATCH",
  },
  {
    id: "hub-angul",
    name: "Jindal Angul Steel & Industrial Complex",
    category: "Steel & Smelter",
    state: "Odisha",
    coords: [20.84, 85.14],
    nominalBaselineFrpMw: 28.0,
    criticalThresholdMw: 80.0,
    contactChannel: "JSPL_FIRE_STATION",
  },
  {
    id: "hub-panipat",
    name: "IOCL Panipat Refinery & Naphtha Cracker",
    category: "Refinery & Petrochemical",
    state: "Haryana",
    coords: [29.40, 76.92],
    nominalBaselineFrpMw: 18.0,
    criticalThresholdMw: 60.0,
    contactChannel: "IOCL_SAFETY_GATE_4",
  },
  {
    id: "hub-vizag",
    name: "RINL Visakhapatnam Steel Plant & Port Zone",
    category: "Steel & Smelter",
    state: "Andhra Pradesh",
    coords: [17.63, 83.18],
    nominalBaselineFrpMw: 30.0,
    criticalThresholdMw: 85.0,
    contactChannel: "VIZAG_PORT_HAZMAT",
  },
  {
    id: "hub-manali",
    name: "CPCL Manali Industrial & Petrochem Corridor",
    category: "Refinery & Petrochemical",
    state: "Tamil Nadu",
    coords: [13.17, 80.26],
    nominalBaselineFrpMw: 15.0,
    criticalThresholdMw: 50.0,
    contactChannel: "CPCL_CONTROL_CENTRE",
  },
];

export const FacilityStatusPage: React.FC<FacilityStatusPageProps> = ({
  hotspots,
  onFocusCoordinates,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Calculate real-time metrics for each hub based on current active hotspots
  const hubStatuses = useMemo(() => {
    return MAJOR_INDIAN_HUBS.map((hub) => {
      // Find hotspots within ~25 km (approx 0.25 deg)
      const nearby = hotspots.filter((h) => {
        const dLat = Math.abs(h.latitude - hub.coords[0]);
        const dLon = Math.abs(h.longitude - hub.coords[1]);
        const distDeg = Math.sqrt(dLat * dLat + dLon * dLon);
        return distDeg <= 0.25;
      });

      const currentFrp = Math.round(nearby.reduce((sum, h) => sum + (h.frp || 0), 0) * 10) / 10;
      const maxRisk = nearby.reduce((max, h) => Math.max(max, h.risk_score ?? (h.risk?.score ?? 0)), 0);

      let status: "NOMINAL" | "ELEVATED" | "ALERT" = "NOMINAL";
      if (currentFrp > hub.criticalThresholdMw || maxRisk >= 75) {
        status = "ALERT";
      } else if (currentFrp > hub.nominalBaselineFrpMw * 1.3 || maxRisk >= 50) {
        status = "ELEVATED";
      }

      return {
        ...hub,
        activeHotspotCount: nearby.length,
        currentFrp,
        maxRisk,
        status,
        nearbyHotspots: nearby,
      };
    });
  }, [hotspots]);

  const filteredHubs = useMemo(() => {
    return hubStatuses.filter((hub) => {
      if (selectedCategory !== "all" && hub.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = hub.name.toLowerCase().includes(q);
        const inState = hub.state.toLowerCase().includes(q);
        const inCategory = hub.category.toLowerCase().includes(q);
        if (!inName && !inState && !inCategory) return false;
      }
      return true;
    });
  }, [hubStatuses, selectedCategory, searchQuery]);

  return (
    <div className="stitch-facility-page">
      {/* Top Banner */}
      <div className="stitch-sub-header">
        <div className="stitch-sub-header__title-area">
          <div className="stitch-tag">INDUSTRIAL ASSET SURVEILLANCE</div>
          <h1 className="stitch-title">Facility &amp; Sensor Status Overview</h1>
          <p className="stitch-subtitle">
            Continuous perimeter monitoring across major Indian petrochemical complexes, super thermal power stations, and metallurgical clusters with automated baseline deviation tracking.
          </p>
        </div>

        <div className="stitch-telemetry-badge-group">
          <div className="stitch-sensor-chip">
            <span className="stitch-live-dot" />
            <span className="data-mono">SUOMI-NPP VIIRS: PASS ACTIVE</span>
          </div>
          <div className="stitch-sensor-chip">
            <span className="stitch-live-dot" />
            <span className="data-mono">NOAA-20 VIIRS: PASS ACTIVE</span>
          </div>
          <div className="stitch-sensor-chip">
            <span className="material-symbols-outlined text-[16px] text-primary">database</span>
            <span className="data-mono">OSM OVERPASS: SPATIAL CACHED</span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="stitch-filter-bar">
        <div className="stitch-search-box">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search facility name, state, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="stitch-pill-tabs">
          <button
            type="button"
            className={`stitch-pill-tab ${selectedCategory === "all" ? "is-active" : ""}`}
            onClick={() => setSelectedCategory("all")}
          >
            All Complexes
          </button>
          <button
            type="button"
            className={`stitch-pill-tab ${selectedCategory === "Refinery & Petrochemical" ? "is-active" : ""}`}
            onClick={() => setSelectedCategory("Refinery & Petrochemical")}
          >
            Refineries
          </button>
          <button
            type="button"
            className={`stitch-pill-tab ${selectedCategory === "Thermal Power Station" ? "is-active" : ""}`}
            onClick={() => setSelectedCategory("Thermal Power Station")}
          >
            Thermal Power
          </button>
          <button
            type="button"
            className={`stitch-pill-tab ${selectedCategory === "Steel & Smelter" ? "is-active" : ""}`}
            onClick={() => setSelectedCategory("Steel & Smelter")}
          >
            Steel &amp; Smelter
          </button>
        </div>
      </div>

      {/* Facilities Grid */}
      <div className="stitch-facility-grid">
        {filteredHubs.map((hub) => {
          const statusPillClass =
            hub.status === "ALERT"
              ? "stitch-risk--critical"
              : hub.status === "ELEVATED"
              ? "stitch-risk--high"
              : "stitch-mini-pill--success";

          return (
            <div key={hub.id} className="stitch-facility-card">
              <div className="stitch-facility-card__header">
                <div>
                  <div className="stitch-facility-card__badges">
                    <span className="stitch-mini-pill stitch-mini-pill--accent">
                      {hub.category}
                    </span>
                    <span className="stitch-mini-pill stitch-mini-pill--tag">
                      {hub.state}
                    </span>
                    <span className={`stitch-mini-pill ${statusPillClass}`}>
                      {hub.status === "ALERT"
                        ? "THERMAL BREACH ALERT"
                        : hub.status === "ELEVATED"
                        ? "ELEVATED LOAD"
                        : "NOMINAL BASELINE"}
                    </span>
                  </div>
                  <h3 className="stitch-facility-card__name">{hub.name}</h3>
                </div>

                <button
                  type="button"
                  className="stitch-btn stitch-btn--ghost"
                  onClick={() => onFocusCoordinates(hub.coords)}
                  title="Center and inspect this facility on the live satellite map"
                >
                  <span className="material-symbols-outlined">center_focus_strong</span>
                  <span>View on Map</span>
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="stitch-facility-metrics">
                <div className="stitch-metric-box">
                  <span className="stitch-metric-box__label">PERIMETER HOTSPOTS</span>
                  <span className="stitch-metric-box__val data-mono">
                    {hub.activeHotspotCount} Detections
                  </span>
                </div>

                <div className="stitch-metric-box">
                  <span className="stitch-metric-box__label">MEASURED FRP</span>
                  <span
                    className={`stitch-metric-box__val data-mono ${
                      hub.currentFrp > hub.nominalBaselineFrpMw ? "text-warning" : ""
                    }`}
                  >
                    {hub.currentFrp} MW
                  </span>
                </div>

                <div className="stitch-metric-box">
                  <span className="stitch-metric-box__label">HISTORICAL BASELINE</span>
                  <span className="stitch-metric-box__val data-mono text-dim">
                    {hub.nominalBaselineFrpMw} MW
                  </span>
                </div>

                <div className="stitch-metric-box">
                  <span className="stitch-metric-box__label">PEAK PERIMETER RISK</span>
                  <span className="stitch-metric-box__val data-mono">
                    {hub.maxRisk}/100
                  </span>
                </div>

                <div className="stitch-metric-box">
                  <span className="stitch-metric-box__label">COORDINATES</span>
                  <span className="stitch-metric-box__val data-mono">
                    {hub.coords[0].toFixed(2)}°N, {hub.coords[1].toFixed(2)}°E
                  </span>
                </div>

                <div className="stitch-metric-box">
                  <span className="stitch-metric-box__label">HAZMAT DISPATCH</span>
                  <span className="stitch-metric-box__val data-mono text-xs text-truncate">
                    {hub.contactChannel}
                  </span>
                </div>
              </div>

              {/* Load Meter */}
              <div className="stitch-facility-load-meter">
                <div className="stitch-load-meter-header">
                  <span>THERMAL LOAD VS RATED CAPACITY</span>
                  <span className="data-mono">
                    {hub.currentFrp} MW / {hub.criticalThresholdMw} MW CRITICAL CAP
                  </span>
                </div>
                <div className="stitch-risk-track">
                  <div
                    className={`stitch-risk-fill ${
                      hub.status === "ALERT"
                        ? "stitch-risk--critical"
                        : hub.status === "ELEVATED"
                        ? "stitch-risk--high"
                        : "stitch-mini-pill--success"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (hub.currentFrp / (hub.criticalThresholdMw || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FacilityStatusPage;
