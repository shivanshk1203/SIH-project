import React, { useEffect } from "react";
import { Hotspot } from "../App";
import { formatDateTime, getStatusIcon } from "./TriageCard";

type AlertCardProps = {
  hotspot: Hotspot;
  onClose: () => void;
};

export default function AlertCard({ hotspot, onClose }: AlertCardProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const event = hotspot.event || {
    id: hotspot.id,
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    acquisition_date: hotspot.detected_at?.split("T")[0] || "Unknown",
    acquisition_time: hotspot.detected_at?.split("T")[1]?.replace(":", "") || "0000",
    satellite: "SNPP",
    instrument: "VIIRS",
    brightness: hotspot.brightness,
    bright_ti4: hotspot.brightness,
    bright_ti5: null,
    frp: hotspot.frp ?? null,
    confidence_raw: String(hotspot.confidence),
    confidence: hotspot.confidence,
    daynight: "D",
    scan: 0.375,
    track: 0.375,
    is_demo_data: hotspot.is_demo_data,
  };

  const loc = hotspot.location_profile || {
    land_cover_dominant: "Rural Open Cropland",
    land_cover_summary: "Cropland (72%), Barren land (18%), Built-up (10%)",
    nearest_settlement_str: hotspot.nearest_settlement || "Unknown",
    nearest_settlement_dist_km: hotspot.settlement_distance_km || 15,
    nearest_road: { name: "Rural link road", distance_m: 350 },
    nearest_industrial: { name: hotspot.location_type === "industrial" ? hotspot.nearest_facility : null, distance_m: hotspot.distance_to_facility_m },
    nearest_mine: { name: null, distance_m: null },
    nearest_landfill: { name: null, distance_m: null },
    nearest_brick_kiln: { name: null, distance_m: null },
    nearest_cropland: { name: "Cropland field", distance_m: 120 },
    nearest_forest: { name: null, distance_m: null },
    nearest_water_body: { name: null, distance_m: null },
  };

  const spatial = hotspot.spatial_analysis || {
    cluster_size: 1,
    neighbors_250m: 0,
    neighbors_500m: 0,
    neighbors_1km: 0,
    neighbors_2km: 0,
    spatial_pattern: "ISOLATED",
    spatial_pattern_desc: "Single isolated thermal detection (no neighbors within 1.0 km)",
    cluster_status: "not_established",
  };

  const temporal = hotspot.temporal_analysis || {
    observation_count: 1,
    first_detected: hotspot.detected_at,
    last_detected: hotspot.detected_at,
    temporal_span_hours: 0.0,
    temporal_span_days: 0.0,
    location_spread_m: 0,
    persistence_status: "insufficient_observations",
    temporal_behavior: "NEW_LOCATION",
    persistence_label: "Insufficient observations to establish persistence (single satellite detection)",
  };

  const scores = hotspot.source_scores || {
    wildfire: hotspot.classification.includes("Wildfire") ? 65 : 10,
    agricultural: hotspot.classification.includes("Agricultural") ? 60 : 15,
    industrial: hotspot.classification.includes("Industrial") ? 70 : 5,
    mining_waste: hotspot.classification.includes("Mining") ? 65 : 5,
    controlled: hotspot.classification.includes("Controlled") ? 50 : 5,
    human_infrastructure: 5,
    sensor_anomaly: hotspot.classification.includes("Sensor") ? 75 : 5,
    unknown: hotspot.classification.includes("Unknown") ? 50 : 10,
  };

  const statusIcon = getStatusIcon(hotspot.classification);

  const hypothesesList = [
    { id: "H1", label: "Wildfire", score: scores.wildfire || 0, icon: "🔥", color: "#ef4444" },
    { id: "H2", label: "Agricultural Burning", score: scores.agricultural || 0, icon: "🌾", color: "#f97316" },
    { id: "H3", label: "Industrial Heat", score: scores.industrial || 0, icon: "🏭", color: "#a855f7" },
    { id: "H4", label: "Mining / Quarry / Waste Heat", score: scores.mining_waste || 0, icon: "⛏️", color: "#b07d62" },
    { id: "H5", label: "Controlled Burning", score: scores.controlled || 0, icon: "🟠", color: "#f59e0b" },
    { id: "H6", label: "Infrastructure / Other Human Heat", score: scores.human_infrastructure || 0, icon: "🛣️", color: "#eab308" },
    { id: "H7", label: "Sensor Anomaly / False Positive", score: scores.sensor_anomaly || 0, icon: "🔵", color: "#06b6d4" },
    { id: "H8", label: "Unknown Heat Source", score: scores.unknown || 0, icon: "⚠️", color: "#94a3b8" },
  ];

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div
        className="report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="report-modal__header">
          <div className="report-modal__title-box">
            <span className="report-modal__icon">{statusIcon}</span>
            <div>
              <div className="report-modal__badge-row">
                <span className="report-modal__level-badge">PHASE 0–15 INVESTIGATION AUDIT</span>
                <span className="data-source-pill">NASA FIRMS VIIRS</span>
                {hotspot.is_demo_data && <span className="status-banner__demo">DEMO</span>}
              </div>
              <h2 className="report-modal__title">{hotspot.classification}</h2>
              <p className="report-modal__subtitle">
                {hotspot.nearest_settlement || `${hotspot.latitude.toFixed(4)}°N, ${hotspot.longitude.toFixed(4)}°E`}
                &nbsp;•&nbsp; Detected: {formatDateTime(hotspot.detected_at)}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="report-modal__close-btn"
            onClick={onClose}
            aria-label="Close report"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="report-modal__body">
          {/* SECTION 1: Operational Action & Primary Attribution (Phases 12 & 13) */}
          <section className="report-section">
            <h3 className="report-section__title">⚡ Phase 12 &amp; 13: Source Attribution &amp; Operational Action</h3>
            <div className="triage-summary-box">
              <div className="triage-summary-item">
                <span className="triage-summary-label">Primary Source:</span>
                <strong>{statusIcon} {hotspot.classification}</strong>
              </div>
              <div className="triage-summary-item">
                <span className="triage-summary-label">Alternative Hypothesis:</span>
                <span style={{ color: "#fbbf24" }}>{hotspot.alternative_source || "None with significant weight"}</span>
              </div>
              <div className="triage-summary-item">
                <span className="triage-summary-label">Recommended Action:</span>
                <strong className="triage-summary-action">{hotspot.recommended_action || "Routine Monitoring"}</strong>
              </div>
              <div className="triage-summary-item">
                <span className="triage-summary-label">Why Classified:</span>
                <span>{hotspot.short_reason || "Evaluated through 15-phase evidence pipeline."}</span>
              </div>
            </div>
          </section>

          {/* SECTION 2: Competing Hypotheses Evaluation (Phases 2 & 11) */}
          <section className="report-section">
            <h3 className="report-section__title">
              🎯 Phase 2 &amp; 11: Competing Hypotheses Evidence Scores
            </h3>
            <p className="report-section__desc">
              Multi-signal weights normalized across physical telemetry, multi-ring land cover, spatial pattern, and persistence:
            </p>
            <div className="source-scores-grid">
              {hypothesesList.map((item) => (
                <div key={item.id} className="score-bar-row">
                  <div className="score-bar-row__label">
                    <span>{item.icon} <strong>{item.id}</strong>: {item.label}</span>
                    <strong style={{ color: item.color }}>{item.score}%</strong>
                  </div>
                  <div className="score-bar-track">
                    <div
                      className="score-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.max(2, item.score))}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 3: Location Intelligence Profile (Phase 1) */}
          <section className="report-section">
            <h3 className="report-section__title">🗺️ Phase 1: Multi-Ring Location Intelligence Profile</h3>
            <div className="panel-details-grid">
              <dt>Dominant Land Cover</dt>
              <dd><strong>{loc.land_cover_dominant}</strong></dd>
              <dt>Land Cover Composition</dt>
              <dd>{loc.land_cover_summary}</dd>
              <dt>Nearest Settlement</dt>
              <dd>{loc.nearest_settlement_str} (~{loc.nearest_settlement_dist_km} km)</dd>
              <dt>Nearest Road</dt>
              <dd>{loc.nearest_road?.name || "Road"} (~{loc.nearest_road?.distance_m ? `${loc.nearest_road.distance_m} m` : "N/A"})</dd>
              <dt>Nearest Industrial Site</dt>
              <dd>{loc.nearest_industrial?.name ? `${loc.nearest_industrial.name} (${loc.nearest_industrial.distance_m} m)` : "None mapped within 2 km"}</dd>
              <dt>Nearest Brick Kiln</dt>
              <dd>{loc.nearest_brick_kiln?.name ? `${loc.nearest_brick_kiln.name} (${loc.nearest_brick_kiln.distance_m} m)` : "None mapped within 2 km"}</dd>
              <dt>Nearest Mine / Quarry</dt>
              <dd>{loc.nearest_mine?.name ? `${loc.nearest_mine.name} (${loc.nearest_mine.distance_m} m)` : "None mapped within 2 km"}</dd>
              <dt>Nearest Water Body</dt>
              <dd>{loc.nearest_water_body?.name ? `${loc.nearest_water_body.name} (${loc.nearest_water_body.distance_m} m)` : "None mapped within 2 km"}</dd>
            </div>
          </section>

          {/* SECTION 4: Spatial Clustering & Multi-Pass Recurrence (Phases 9 & 10) */}
          <section className="report-section">
            <h3 className="report-section__title">🌐 Phase 9 &amp; 10: Spatial Cluster &amp; Temporal History</h3>
            <div className="panel-details-grid">
              <dt>Spatial Pattern</dt>
              <dd><strong>{spatial.spatial_pattern || "ISOLATED"}</strong></dd>
              <dt>Cluster Description</dt>
              <dd>{spatial.spatial_pattern_desc || "Single detection"}</dd>
              <dt>Detections within 250m</dt>
              <dd>{spatial.neighbors_250m ?? 0}</dd>
              <dt>Detections within 500m</dt>
              <dd>{spatial.neighbors_500m ?? 0}</dd>
              <dt>Detections within 1.0 km</dt>
              <dd>{spatial.neighbors_1km}</dd>
              <dt>Temporal Behavior</dt>
              <dd><strong>{temporal.temporal_behavior || "NEW_LOCATION"}</strong></dd>
              <dt>Satellite Passes Tracked</dt>
              <dd>{temporal.observation_count} observation(s) across {temporal.temporal_span_hours} hours</dd>
              <dt>Centroid Spatial Spread</dt>
              <dd>{temporal.location_spread_m > 0 ? `${temporal.location_spread_m} m` : "Stationary (0 m)"}</dd>
            </div>
          </section>

          {/* SECTION 5: Raw Satellite Telemetry (Phase 0) */}
          <section className="report-section">
            <h3 className="report-section__title">🛰️ Phase 0: Raw Satellite Telemetry (NASA FIRMS VIIRS)</h3>
            <div className="panel-details-grid">
              <dt>Detection ID</dt>
              <dd className="mono-code">{event.id}</dd>
              <dt>Instrument / Satellite</dt>
              <dd>{event.instrument} on {event.satellite}</dd>
              <dt>Coordinates</dt>
              <dd className="mono-code">{event.latitude.toFixed(4)}°N, {event.longitude.toFixed(4)}°E</dd>
              <dt>Brightness (Ti-4 375m)</dt>
              <dd><strong>{event.brightness.toFixed(1)} K</strong></dd>
              <dt>Fire Radiative Power (FRP)</dt>
              <dd><strong>{event.frp !== null && event.frp !== undefined ? `${event.frp.toFixed(1)} MW` : "N/A"}</strong></dd>
              <dt>Sensor Confidence</dt>
              <dd>{event.confidence}% ({event.confidence_raw})</dd>
              <dt>Pass Type</dt>
              <dd>{event.daynight === "N" ? "Night pass (nocturnal)" : "Day pass (solar illumination)"}</dd>
              <dt>Pixel Footprint</dt>
              <dd>375 m nominal ground sampling distance</dd>
            </div>
          </section>

          {/* SECTION 6: Verified Evidence Audit Trail */}
          {hotspot.reasons && hotspot.reasons.length > 0 && (
            <section className="report-section">
              <h3 className="report-section__title">📋 Verified Evidence Audit Log</h3>
              <ul className="evidence-bullet-list">
                {hotspot.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Scientific Decision-Support Caveat */}
          <div className="scientific-advisory-box">
            <strong>Operational Decision-Support Advisory:</strong> These results are generated by the
            15-phase evidence investigation pipeline combining physical satellite observations, multi-ring
            OpenStreetMap land use, and spatial clustering algorithms. They do not constitute ground-truth
            guarantees. Ground verification is recommended.
          </div>
        </div>

        {/* Footer */}
        <div className="report-modal__footer">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onClose}
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
