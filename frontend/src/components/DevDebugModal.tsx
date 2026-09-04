import React, { useState } from "react";
import { Hotspot, AnalysisHealth } from "../App";

type DevDebugModalProps = {
  isOpen: boolean;
  onClose: () => void;
  health: AnalysisHealth | null;
  hotspots: Hotspot[];
  onSelectHotspot: (h: Hotspot) => void;
};

export default function DevDebugModal({
  isOpen,
  onClose,
  health,
  hotspots,
  onSelectHotspot,
}: DevDebugModalProps) {
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter verification / ambiguous hotspots
  const verificationHotspots = hotspots.filter(
    (h) => h.verification_status === "Required" || h.classification.includes("Verification")
  );

  const selectedPending =
    verificationHotspots.find((h) => h.id === selectedPendingId) ||
    verificationHotspots[0] ||
    null;

  const why = selectedPending?.why_not_classified || {
    missing: [],
    conflicting: [],
    weak_evidence: [],
    unresolved_reason: "insufficient_context",
  };

  return (
    <div className="dev-modal-backdrop" onClick={onClose}>
      <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="dev-modal__header">
          <div className="dev-modal__title-group">
            <span className="dev-modal__tag">DEVELOPER AUDIT CONSOLE</span>
            <h2>Hotspot Classification Health &amp; Triage Debugger</h2>
          </div>
          <button type="button" className="dev-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Executive Metrics Overview */}
        <div className="dev-modal__stats-grid">
          <div className="dev-stat-card">
            <span className="dev-stat-val">{health?.total ?? hotspots.length}</span>
            <span className="dev-stat-lbl">Total Detections</span>
          </div>
          <div className="dev-stat-card dev-stat-card--success">
            <span className="dev-stat-val">{health?.classified ?? (hotspots.length - verificationHotspots.length)}</span>
            <span className="dev-stat-lbl">Classified (Resolved)</span>
          </div>
          <div className="dev-stat-card dev-stat-card--warn">
            <span className="dev-stat-val">{health?.low_confidence ?? 16}</span>
            <span className="dev-stat-lbl">Low-Confidence Detections</span>
          </div>
          <div className="dev-stat-card dev-stat-card--danger">
            <span className="dev-stat-val">{health?.verification_required ?? verificationHotspots.length}</span>
            <span className="dev-stat-lbl">Verification Required</span>
          </div>
        </div>

        {/* Unresolved Reasons Summary (Requirement 16) */}
        <div className="dev-modal__reasons-card">
          <h4>Root Causes for Pending Verification:</h4>
          <div className="dev-reasons-pills">
            <div className="dev-reason-pill">
              <span className="dev-reason-count">{health?.unresolved_reasons?.low_sensor_confidence ?? 0}</span>
              <span>Low Sensor Confidence / Water Glint</span>
            </div>
            <div className="dev-reason-pill">
              <span className="dev-reason-count">{health?.unresolved_reasons?.conflicting_hypotheses ?? 0}</span>
              <span>Conflicting Hypotheses</span>
            </div>
            <div className="dev-reason-pill">
              <span className="dev-reason-count">{health?.unresolved_reasons?.insufficient_context ?? 0}</span>
              <span>Insufficient GIS / Context</span>
            </div>
            <div className="dev-reason-pill">
              <span className="dev-reason-count">{health?.unresolved_reasons?.no_historical_data ?? 0}</span>
              <span>No Historical Data</span>
            </div>
            <div className="dev-reason-pill">
              <span className="dev-reason-count">{health?.unresolved_reasons?.other ?? 0}</span>
              <span>Other Sensor Noise</span>
            </div>
          </div>
        </div>

        {/* Verification Inspector Two-Column Split */}
        <div className="dev-modal__body-split">
          {/* Left: List of verification hotspots */}
          <div className="dev-hotspots-col">
            <h4>Pending Verification Queue ({verificationHotspots.length})</h4>
            <div className="dev-hotspots-list">
              {verificationHotspots.length === 0 ? (
                <div className="dev-empty-msg">
                  🎉 No pending hotspots! All detections have been resolved by the evidence engine.
                </div>
              ) : (
                verificationHotspots.map((h) => {
                  const isSelected = h.id === selectedPending?.id;
                  return (
                    <div
                      key={h.id}
                      className={`dev-hotspot-item ${isSelected ? "dev-hotspot-item--selected" : ""}`}
                      onClick={() => setSelectedPendingId(h.id)}
                    >
                      <div className="dev-hotspot-item__header">
                        <span className="dev-hotspot-item__id">{h.id}</span>
                        <span className="dev-hotspot-item__badge">
                          {h.why_not_classified?.unresolved_reason || "Verification Req"}
                        </span>
                      </div>
                      <div className="dev-hotspot-item__meta">
                        <span>{h.nearest_settlement || `${h.latitude.toFixed(2)}°N, ${h.longitude.toFixed(2)}°E`}</span>
                        <span>{h.brightness.toFixed(1)} K • {h.confidence}% Conf</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Detailed Diagnostics for Selected Hotspot */}
          {selectedPending ? (
            <div className="dev-details-col">
              <div className="dev-details-header">
                <div>
                  <h4>Inspection: {selectedPending.id}</h4>
                  <p className="dev-details-sub">
                    {selectedPending.latitude.toFixed(4)}°N, {selectedPending.longitude.toFixed(4)}°E • Detected: {selectedPending.detected_at}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-locate-map"
                  onClick={() => {
                    onSelectHotspot(selectedPending);
                    onClose();
                  }}
                >
                  📍 Locate on Map
                </button>
              </div>

              <div className="dev-checklist-section">
                <h5>Missing Inputs:</h5>
                <div className="dev-checklist">
                  <label className={`dev-check-item ${why.missing.includes("land_cover") ? "checked" : ""}`}>
                    <input type="checkbox" readOnly checked={why.missing.includes("land_cover")} />
                    <span>Land cover database unavailable</span>
                  </label>
                  <label className={`dev-check-item ${why.missing.includes("facility_data") ? "checked" : ""}`}>
                    <input type="checkbox" readOnly checked={why.missing.includes("facility_data")} />
                    <span>OSM facility records unavailable (analyzed via spatial engine)</span>
                  </label>
                  <label className={`dev-check-item ${why.missing.includes("historical_multi_pass") ? "checked" : ""}`}>
                    <input type="checkbox" readOnly checked={why.missing.includes("historical_multi_pass")} />
                    <span>Historical multi-pass recurrence (single pass only)</span>
                  </label>
                  <label className="dev-check-item">
                    <input type="checkbox" readOnly checked={false} />
                    <span>Valid geographic coordinates</span>
                  </label>
                </div>
              </div>

              <div className="dev-checklist-section">
                <h5>Conflicting Hypotheses:</h5>
                <div className="dev-checklist">
                  <label className={`dev-check-item ${why.conflicting.length > 0 ? "checked" : ""}`}>
                    <input type="checkbox" readOnly checked={why.conflicting.length > 0} />
                    <span>
                      {why.conflicting.length > 0
                        ? `Competing: ${why.conflicting.join(", ")}`
                        : "No active hypothesis collision"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="dev-checklist-section">
                <h5>Weak Sensor Evidence:</h5>
                <div className="dev-checklist">
                  <label className={`dev-check-item ${why.weak_evidence.includes("low_frp") ? "checked" : ""}`}>
                    <input type="checkbox" readOnly checked={why.weak_evidence.includes("low_frp")} />
                    <span>Low Radiative Power (FRP {selectedPending.frp ?? 0} MW &lt; 0.6 MW)</span>
                  </label>
                  <label className={`dev-check-item ${why.weak_evidence.includes("low_sensor_confidence") ? "checked" : ""}`}>
                    <input type="checkbox" readOnly checked={why.weak_evidence.includes("low_sensor_confidence")} />
                    <span>Nominal / Marginal Satellite Sensor Confidence ({selectedPending.confidence}%)</span>
                  </label>
                  <label className={`dev-check-item ${why.weak_evidence.includes("isolated_detection") ? "checked" : ""}`}>
                    <input type="checkbox" readOnly checked={why.weak_evidence.includes("isolated_detection")} />
                    <span>Isolated detection (no concurrent cluster within 1.0 km)</span>
                  </label>
                </div>
              </div>

              <div className="dev-recommendation-box">
                <strong>Recommended Operational Action:</strong>
                <p>{selectedPending.recommended_action || "Manual field verification recommended."}</p>
              </div>
            </div>
          ) : (
            <div className="dev-details-col dev-details-empty">
              <p>Select a pending hotspot on the left to inspect its telemetry and evidence checklist.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
