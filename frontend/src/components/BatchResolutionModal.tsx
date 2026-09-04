import React from "react";

type BatchResolutionModalProps = {
  isOpen: boolean;
  current: number;
  total: number;
  resolved: number;
  needsVerification: number;
  currentLocationName?: string;
  isComplete: boolean;
  onClose: () => void;
};

export default function BatchResolutionModal({
  isOpen,
  current,
  total,
  resolved,
  needsVerification,
  currentLocationName,
  isComplete,
  onClose,
}: BatchResolutionModalProps) {
  if (!isOpen) return null;

  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="batch-modal-backdrop">
      <div className="batch-modal">
        <div className="batch-modal__header">
          <span className="batch-modal__pulse" />
          <div>
            <h3>{isComplete ? "Batch Analysis Complete" : "Analyzing Pending Hotspots..."}</h3>
            <p className="batch-modal__sub">
              {isComplete
                ? "Full 15-phase multi-signal investigation finished across all detections."
                : "Running location intelligence, spatial scoring, and hypothesis attribution..."}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="batch-progress-wrapper">
          <div className="batch-progress-track">
            <div
              className={`batch-progress-bar ${isComplete ? "batch-progress-bar--done" : ""}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="batch-progress-labels">
            <span>{current} / {total} Hotspots Processed</span>
            <span>{pct}%</span>
          </div>
        </div>

        {/* Real-time Tally Grid */}
        <div className="batch-stats-grid">
          <div className="batch-stat-card batch-stat-card--resolved">
            <span className="batch-stat-val">{resolved}</span>
            <span className="batch-stat-lbl">Resolved to Primary Source</span>
          </div>
          <div className="batch-stat-card batch-stat-card--verif">
            <span className="batch-stat-val">{needsVerification}</span>
            <span className="batch-stat-lbl">Genuinely Ambiguous (Verification)</span>
          </div>
        </div>

        {!isComplete && currentLocationName && (
          <div className="batch-current-step">
            <span className="batch-spin">⚙️</span>
            <span>Currently evaluating: <strong>{currentLocationName}</strong></span>
          </div>
        )}

        {isComplete && (
          <div className="batch-complete-box">
            <p>✓ All detections have been enriched with quantitative spatial scores, temporal recurrence, and best-available explanations.</p>
            <button type="button" className="btn-batch-finish" onClick={onClose}>
              View Dashboard &amp; Map →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
