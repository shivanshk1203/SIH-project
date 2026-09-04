import React from "react";
import { Hotspot } from "../App";
import { getStatusIcon, getConfidenceBadgeClass } from "./TriageCard";

type InvestigationPanelProps = {
  hotspot: Hotspot;
  onClose: () => void;
  onViewDetailedReport: (hotspot: Hotspot) => void;
};

export default function InvestigationPanel({
  hotspot,
  onClose,
  onViewDetailedReport,
}: InvestigationPanelProps) {
  const scores = hotspot.source_scores || {};
  const statusIcon = getStatusIcon(hotspot.classification);
  const locProfile = hotspot.location_profile;

  const hypothesesList = [
    { id: "H1", name: "Wildfire", score: scores.wildfire || 0, color: "#ef4444", icon: "🔥" },
    { id: "H2", name: "Agricultural", score: scores.agricultural || 0, color: "#f97316", icon: "🌾" },
    { id: "H3", name: "Industrial", score: scores.industrial || 0, color: "#a855f7", icon: "🏭" },
    { id: "H4", name: "Mining / Waste", score: scores.mining_waste || 0, color: "#b07d62", icon: "⛏️" },
    { id: "H5", name: "Controlled", score: scores.controlled || 0, color: "#f59e0b", icon: "🟠" },
    { id: "H6", name: "Infrastructure", score: scores.human_infrastructure || 0, color: "#eab308", icon: "🛣️" },
    { id: "H7", name: "Sensor Anomaly", score: scores.sensor_anomaly || 0, color: "#06b6d4", icon: "🔵" },
    { id: "H8", name: "Unknown", score: scores.unknown || 0, color: "#94a3b8", icon: "⚠️" },
  ];

  const distInd = locProfile?.nearest_industrial?.distance_m;
  const indName = locProfile?.nearest_industrial?.name;
  const distFarm = locProfile?.nearest_cropland?.distance_m;
  const distTownKm = locProfile?.nearest_settlement_dist_km;
  const townName = locProfile?.nearest_settlement_str;

  return (
    <div className="investigation-hud">
      {/* HUD Header */}
      <div className="investigation-hud__header">
        <div className="investigation-hud__header-title">
          <span className="investigation-hud__icon">{statusIcon}</span>
          <div>
            <div className="investigation-hud__badge-line">
              <span className="investigation-badge">PHASE 14 — MULTI-DISTANCE SPATIAL INVESTIGATION</span>
              <span className={getConfidenceBadgeClass(hotspot.analytical_confidence)}>
                {hotspot.analytical_confidence || "MEDIUM"} CONFIDENCE
              </span>
            </div>
            <h3 className="investigation-hud__name">{hotspot.classification}</h3>
          </div>
        </div>
        <button
          type="button"
          className="investigation-hud__close-btn"
          onClick={onClose}
          title="Exit Investigation Mode"
        >
          ✕ Exit
        </button>
      </div>

      {/* Spatial Evidence & Multi-Distance Rings (Requirement 3 & 12) */}
      <div className="investigation-hud__spatial-card">
        <div className="investigation-hud__section-title">
          <span>SPATIAL SOURCE CONFIRMATION &amp; DISTANCE RINGS</span>
          <span className="investigation-hud__match-badge">
            {locProfile?.spatial_source_match || "Spatial Analysis Complete"} ({locProfile?.spatial_source_evidence || "CONFIRMED"})
          </span>
        </div>

        <p className="investigation-hud__explanation">
          {hotspot.short_reason}
        </p>

        <div className="investigation-hud__distance-rings">
          <div className="distance-ring-pill">
            <span className="distance-ring-metric">0 m</span>
            <span className="distance-ring-desc">
              {locProfile?.spatial_relationship === "inside"
                ? `Inside complex boundary (${indName || locProfile?.land_cover_dominant})`
                : locProfile?.land_cover_dominant}
            </span>
          </div>

          {distInd !== null && distInd !== undefined && (
            <div className="distance-ring-pill distance-ring-pill--highlight">
              <span className="distance-ring-metric">~{Math.round(distInd)} m</span>
              <span className="distance-ring-desc">
                Nearest industrial structure: {indName || "Industrial complex"}
              </span>
            </div>
          )}

          {distFarm !== null && distFarm !== undefined && (
            <div className="distance-ring-pill">
              <span className="distance-ring-metric">~{Math.round(distFarm)} m</span>
              <span className="distance-ring-desc">Nearest agricultural parcel</span>
            </div>
          )}

          {distTownKm !== null && distTownKm !== undefined && (
            <div className="distance-ring-pill">
              <span className="distance-ring-metric">~{Math.round(distTownKm)} km</span>
              <span className="distance-ring-desc">Settlement: {townName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Competing Hypotheses Grid */}
      <div className="investigation-hud__hypotheses">
        <div className="investigation-hud__section-title">
          <span>COMPETING HYPOTHESES EVALUATION (PHASE 2 &amp; 11)</span>
          {hotspot.alternative_source && (
            <span className="investigation-hud__alt-pill">
              Alt: {hotspot.alternative_source}
            </span>
          )}
        </div>

        <div className="investigation-hud__hypo-grid">
          {hypothesesList.map((h) => (
            <div key={h.id} className="investigation-hud__hypo-row">
              <div className="investigation-hud__hypo-label">
                <span>{h.icon} {h.id}: {h.name}</span>
                <strong style={{ color: h.color }}>{h.score}%</strong>
              </div>
              <div className="investigation-hud__hypo-track">
                <div
                  className="investigation-hud__hypo-fill"
                  style={{
                    width: `${Math.max(3, h.score)}%`,
                    backgroundColor: h.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="investigation-hud__footer">
        <div className="investigation-hud__action-box">
          <span className="investigation-hud__action-label">OPERATIONAL DIRECTIVE:</span>
          <strong className="investigation-hud__action-val">
            {hotspot.recommended_action_short || hotspot.recommended_action}
          </strong>
        </div>
        <div className="investigation-hud__btn-group">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onViewDetailedReport(hotspot)}
          >
            Full Technical Report →
          </button>
        </div>
      </div>
    </div>
  );
}
