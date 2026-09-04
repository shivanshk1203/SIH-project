import React, { useState } from "react";
import { Hotspot } from "../App";

type TriageCardProps = {
  hotspot: Hotspot;
  onViewDetailedReport: (hotspot: Hotspot) => void;
  onStartInvestigation?: (hotspot: Hotspot) => void;
  onClose?: () => void;
};

export function getStatusIcon(cls?: string | null): string {
  if (!cls) return "⚠️";
  if (cls.includes("Wildfire")) return "🔥";
  if (cls.includes("Agricultural")) return "🌾";
  if (cls.includes("Industrial")) return "🏭";
  if (cls.includes("Mining") || cls.includes("Waste")) return "⛏️";
  if (cls.includes("Controlled")) return "🟠";
  if (cls.includes("False Positive") || cls.includes("Sensor")) return "🔵";
  return "⚠️";
}

export function getConfidenceBadgeClass(conf?: string | null): string {
  const c = conf?.toLowerCase() || "";
  if (c.includes("high")) return "triage-conf triage-conf--high";
  if (c.includes("med")) return "triage-conf triage-conf--medium";
  return "triage-conf triage-conf--low";
}

export function formatDateTime(dtStr?: string | null): string {
  if (!dtStr) return "Unknown";
  try {
    const d = new Date(dtStr.includes("T") ? dtStr : dtStr.replace(" ", "T"));
    if (isNaN(d.getTime())) {
      const parts = dtStr.split("T");
      if (parts.length === 2) {
        const datePart = parts[0];
        const timePart = parts[1].slice(0, 4);
        return `${datePart} • ${timePart.slice(0, 2)}:${timePart.slice(2, 4)}`;
      }
      return dtStr;
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year} • ${hours}:${mins}`;
  } catch {
    return dtStr || "Unknown";
  }
}

function TriageCard({
  hotspot,
  onViewDetailedReport,
  onStartInvestigation,
  onClose,
}: TriageCardProps) {
  const [showSourceAttributionDebug, setShowSourceAttributionDebug] = useState(false);

  if (!hotspot) return null;

  const cls = hotspot.classification || "Unknown / Needs Verification";
  const statusIcon = getStatusIcon(cls);
  const confidenceLabel = hotspot.confidenceLevel || hotspot.analytical_confidence || (hotspot.confidence ? `${hotspot.confidence}%` : "Low");
  const formattedTime = formatDateTime(hotspot.detected_at || hotspot.timestamp || "");

  const locationText =
    hotspot.nearest_settlement ||
    `${(hotspot.latitude ?? 0).toFixed(4)}°N, ${(hotspot.longitude ?? 0).toFixed(4)}°E`;

  const likelySourceText =
    hotspot.likely_source ||
    hotspot.location_type_label ||
    "Source uncertain — verification recommended";

  const reasonText =
    hotspot.short_reason ||
    (hotspot.reasons && hotspot.reasons.length > 0 ? hotspot.reasons[0] : "") ||
    "Detection exhibits atypical thermal signature requiring multi-factor spatial assessment.";

  const actionText =
    hotspot.recommended_action_short ||
    hotspot.recommended_action ||
    (cls.includes("Industrial")
      ? "Likely Industrial Heat — Log to Facility Baseline"
      : cls.includes("Wildfire")
      ? "High Priority — Dispatch Ground Verification"
      : "Verify satellite signal against local ground context");

  const footprintText =
    hotspot.hotspot_size_estimate ||
    (hotspot.spatial_analysis?.cluster_size && hotspot.spatial_analysis.cluster_size > 1
      ? `Cluster (${hotspot.spatial_analysis.cluster_size} detections)`
      : "~375m × 375m (1 VIIRS Pixel)");

  const verifStatus =
    hotspot.verification_status ||
    (cls.includes("Verification") ? "Required" : "Recommended");

  const verifClass =
    verifStatus === "Not required"
      ? "triage-verif-badge--not-required"
      : verifStatus === "Required"
      ? "triage-verif-badge--required"
      : "triage-verif-badge--recommended";

  const riskLevel = hotspot.risk_level || hotspot.risk?.level || "LOW";
  const riskScore = hotspot.risk_score ?? hotspot.risk?.score ?? 25;
  const natureState = hotspot.thermal_nature || hotspot.thermalNature?.state || "STATIONARY";
  const priorityScore = hotspot.investigation_priority ?? hotspot.priority?.score ?? 40;

  return (
    <div className="triage-card">
      {/* Header */}
      <div className="triage-card__header">
        <div className="triage-card__title-group">
          <span className="triage-card__icon">{statusIcon}</span>
          <div>
            <h3 className="triage-card__title">{cls.toUpperCase()}</h3>
            
            {/* Primary Intelligence Badges */}
            <div className="triage-card__intelligence-bar">
              <div className={`risk-badge risk-badge--${riskLevel.toLowerCase()}`}>
                <span className="risk-badge__score">{riskScore}</span>
                <span className="risk-badge__denom">/100</span>
                <span className="risk-badge__level">{riskLevel} RISK</span>
              </div>
              <div className="nature-badge">
                <span className="nature-badge__lbl">NATURE:</span>
                <span className="nature-badge__val">{natureState}</span>
              </div>
              <div className="conf-decoupled-badge" title="Source Classification Certainty">
                <span className="conf-decoupled-badge__lbl">CONFIDENCE:</span>
                <span className="conf-decoupled-badge__val">{confidenceLabel.toUpperCase()}</span>
              </div>
              <div className="priority-badge" title="Field Investigation Urgency Score">
                <span className="priority-badge__lbl">PRIORITY:</span>
                <span className="priority-badge__val">{priorityScore}/100</span>
              </div>
            </div>

            <div className="triage-card__badges-row" style={{ marginTop: "6px" }}>
              <span className="trend-pill">
                📊 {hotspot.trend_description || hotspot.thermalNature?.trendDescription || "Baseline: Consistent with historical passes"}
              </span>
            </div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="triage-card__close"
            onClick={onClose}
            aria-label="Close card"
          >
            ✕
          </button>
        )}
      </div>

      {/* Location & Time */}
      <div className="triage-card__meta">
        <div className="triage-card__meta-item">
          <span className="triage-card__meta-label">Location:</span>
          <span className="triage-card__meta-val triage-card__meta-val--location">
            {locationText}
          </span>
        </div>
        <div className="triage-card__meta-item">
          <span className="triage-card__meta-label">Detected:</span>
          <span className="triage-card__meta-val">{formattedTime}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="triage-card__metrics">
        <div className="triage-card__metric">
          <span className="triage-card__metric-label">Thermal Signal</span>
          <span className="triage-card__metric-val">{(hotspot.brightness ?? 300).toFixed(1)} K</span>
        </div>
        <div className="triage-card__metric">
          <span className="triage-card__metric-label">Radiative Power</span>
          <span className="triage-card__metric-val">
            {hotspot.frp !== null && hotspot.frp !== undefined ? `${hotspot.frp.toFixed(1)} MW` : "N/A"}
          </span>
        </div>
        <div className="triage-card__metric">
          <span className="triage-card__metric-label">Est. Footprint</span>
          <span className="triage-card__metric-val">{footprintText}</span>
        </div>
      </div>

      {/* Risk Breakdown */}
      <div className="triage-card__risk-breakdown-card">
        <div className="risk-breakdown-title">
          <span>🛡️ 0–100 RISK SCORE BREAKDOWN</span>
          <span className="risk-breakdown-total">{riskScore}/100</span>
        </div>

        <div className="risk-meter-bar">
          <div
            className={`risk-meter-fill risk-meter-fill--${riskLevel.toLowerCase()}`}
            style={{ width: `${Math.min(100, Math.max(5, riskScore))}%` }}
          />
        </div>

        <div className="risk-components-grid">
          <div className="risk-comp"><span className="comp-lbl">Thermal</span><span className="comp-val">{hotspot.risk_breakdown?.thermalIntensity ?? hotspot.risk?.breakdown?.thermalIntensity ?? 8}/20</span></div>
          <div className="risk-comp"><span className="comp-lbl">Abnormality</span><span className="comp-val">{hotspot.risk_breakdown?.abnormality ?? hotspot.risk?.breakdown?.abnormality ?? 4}/20</span></div>
          <div className="risk-comp"><span className="comp-lbl">Escalation</span><span className="comp-val">{hotspot.risk_breakdown?.escalation ?? hotspot.risk?.breakdown?.escalation ?? 3}/15</span></div>
          <div className="risk-comp"><span className="comp-lbl">Expansion</span><span className="comp-val">{hotspot.risk_breakdown?.spatialExpansion ?? hotspot.risk?.breakdown?.spatialExpansion ?? 2}/15</span></div>
          <div className="risk-comp"><span className="comp-lbl">Exposure</span><span className="comp-val">{hotspot.risk_breakdown?.exposure ?? hotspot.risk?.breakdown?.exposure ?? 4}/15</span></div>
          <div className="risk-comp"><span className="comp-lbl">Hazard</span><span className="comp-val">{hotspot.risk_breakdown?.sourceHazard ?? hotspot.risk?.breakdown?.sourceHazard ?? 3}/10</span></div>
        </div>

        {((hotspot.risk_drivers && hotspot.risk_drivers.length > 0) || (hotspot.risk?.drivers && hotspot.risk.drivers.length > 0)) && (
          <div className="risk-drivers-box">
            <span className="risk-sub-heading">PRIMARY RISK DRIVERS</span>
            {(hotspot.risk_drivers || hotspot.risk?.drivers || []).slice(0, 3).map((driver: string, idx: number) => (
              <div key={idx} className="risk-driver-item">{driver}</div>
            ))}
          </div>
        )}

        {((hotspot.risk_reducers && hotspot.risk_reducers.length > 0) || (hotspot.risk?.reducers && hotspot.risk.reducers.length > 0)) && (
          <div className="risk-reducers-box">
            <span className="risk-sub-heading">RISK REDUCERS</span>
            {(hotspot.risk_reducers || hotspot.risk?.reducers || []).slice(0, 2).map((reducer: string, idx: number) => (
              <div key={idx} className="risk-reducer-item">{reducer}</div>
            ))}
          </div>
        )}
      </div>

      {/* Source Assessment */}
      <div className="triage-card__source-box">
        <span className="triage-card__source-label">LIKELY SOURCE</span>
        <span className="triage-card__source-val">{likelySourceText}</span>
      </div>

      {/* Rationale */}
      <div className="triage-card__rationale">
        <span className="triage-card__rationale-label">WHY THIS CLASSIFICATION:</span>
        <p className="triage-card__rationale-text">{reasonText}</p>
      </div>

      {/* Action */}
      <div className="triage-card__action">
        <span className="triage-card__action-label">RECOMMENDED ACTION:</span>
        <span className="triage-card__action-val">{actionText}</span>
      </div>

      {/* Source Attribution Debug Panel Toggle */}
      <div style={{ marginTop: "10px", marginBottom: "6px" }}>
        <button
          type="button"
          className="triage-btn triage-btn--debug"
          onClick={() => setShowSourceAttributionDebug((prev) => !prev)}
        >
          {showSourceAttributionDebug ? "▲ Hide Attribution Debug" : "⚙️ Attribution Debug"}
        </button>
      </div>

      {/* Expandable Source Attribution Debug Panel */}
      {showSourceAttributionDebug && (
        <div className="source-attribution-debug-panel">
          <div className="debug-panel-title">SOURCE ATTRIBUTION DEBUG (LOCAL SPATIAL ENGINE)</div>
          <div className="debug-grid">
            <div className="debug-item">
              <span className="debug-lbl">Coordinates:</span>
              <span className="debug-val">{(hotspot.latitude ?? 0).toFixed(4)}°N, {(hotspot.longitude ?? 0).toFixed(4)}°E</span>
            </div>
            <div className="debug-item">
              <span className="debug-lbl">Industrial Land-Use:</span>
              <span className={`debug-val ${hotspot.sourceAttributionDebug?.industrialLandUse ? "debug-val--pos" : "debug-val--neg"}`}>
                {hotspot.sourceAttributionDebug?.industrialLandUse ? "YES (POSITIVE)" : "NO"}
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-lbl">Facility Match:</span>
              <span className="debug-val">
                {hotspot.sourceAttributionDebug?.facilityMatch || "NONE (Overpass/GIS Unavailable)"}
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-lbl">Spatial Context:</span>
              <span className="debug-val debug-val--highlight">
                {hotspot.sourceAttributionDebug?.satelliteSpatialContext || "LOCAL CONTEXT ACTIVE"}
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-lbl">Distance to Structure:</span>
              <span className="debug-val">
                {hotspot.sourceAttributionDebug?.distanceToStructureM !== undefined
                  ? `${hotspot.sourceAttributionDebug.distanceToStructureM.toFixed(0)} m`
                  : "N/A"}
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-lbl">Distance to Boundary:</span>
              <span className="debug-val">
                {hotspot.sourceAttributionDebug?.distanceToBoundaryM !== undefined
                  ? `${hotspot.sourceAttributionDebug.distanceToBoundaryM.toFixed(0)} m`
                  : "N/A"}
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-lbl">Historical Detections:</span>
              <span className="debug-val">
                {hotspot.sourceAttributionDebug?.historicalDetectionsCount ?? 1}
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-lbl">Stationary Heat Source:</span>
              <span className="debug-val">
                {hotspot.sourceAttributionDebug?.isStationary ? "YES (STATIONARY)" : "NO (SPREADING)"}
              </span>
            </div>
          </div>

          <div className="debug-scores-row">
            <span className="debug-score-chip">🏭 Ind: {hotspot.sourceScores?.industrial ?? 0}/100</span>
            <span className="debug-score-chip">🌲 Wild: {hotspot.sourceScores?.wildfire ?? 0}/100</span>
            <span className="debug-score-chip">🌾 Agri: {hotspot.sourceScores?.agricultural ?? 0}/100</span>
            <span className="debug-score-chip">🔵 Glint: {hotspot.sourceScores?.sensor_anomaly ?? 0}/100</span>
          </div>

          {hotspot.sourceAttributionDebug?.evidenceChecklist && hotspot.sourceAttributionDebug.evidenceChecklist.length > 0 && (
            <div className="debug-checklist">
              <div className="debug-checklist-title">WHY THIS CLASSIFICATION?</div>
              {hotspot.sourceAttributionDebug.evidenceChecklist.map((item: string, idx: number) => (
                <div
                  key={idx}
                  className={`checklist-item ${item.startsWith("✓") ? "checklist-item--pos" : "checklist-item--neg"}`}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="triage-card__actions">
        {onStartInvestigation && (
          <button
            type="button"
            className="triage-btn triage-btn--investigate"
            onClick={() => onStartInvestigation(hotspot)}
          >
            🔍 Investigate Source
          </button>
        )}
        <button
          type="button"
          className="triage-btn triage-btn--report"
          onClick={() => onViewDetailedReport(hotspot)}
        >
          View Detailed Report →
        </button>
      </div>
    </div>
  );
}

export default TriageCard;
