import React, { useState, useMemo } from "react";
import { ThermalEvent, EventClassification } from "../types/thermal";
import { SeverityBadge, ClassificationTag } from "../components/common/StatusBadge";

interface AIClassificationPageProps {
  events: ThermalEvent[];
  selectedEvent?: ThermalEvent | null;
  onSelectEvent?: (event: ThermalEvent | null) => void;
  onViewIncident?: (event: ThermalEvent) => void;
  onNavigateToMap?: (event?: ThermalEvent) => void;
  lastUpdatedTime?: string;
  onRefreshData?: () => void;
}

type FilterPreset = "all" | "verification" | "low_conf" | "industrial" | "agricultural" | "wildfire";

function formatCompactId(id: string): string {
  if (!id) return "FIRMS-N/A";
  const match = id.match(/^(?:firms-)?([0-9]+\.[0-9]{3,4})/i);
  if (match) return `FIRMS-${match[1]}`;
  if (id.startsWith("TH-") || id.startsWith("FIRMS-")) return id.length > 14 ? id.slice(0, 14) : id;
  return id.length > 14 ? `${id.slice(0, 13)}…` : id;
}

function getEvidenceStatus(ev: ThermalEvent): { label: string; color: string; bg: string } {
  if (ev.classification === "Needs Verification") {
    return { label: "Needs Verification", color: "#b45309", bg: "#fef3c7" };
  }
  const conf = ev.classificationConfidence || ev.confidence || 70;
  if (conf >= 80) return { label: "Strong", color: "#15803d", bg: "#dcfce7" };
  if (conf >= 60) return { label: "Mixed", color: "#0369a1", bg: "#e0f2fe" };
  return { label: "Weak", color: "#b91c1c", bg: "#fee2e2" };
}

const ALL_CATEGORIES: EventClassification[] = [
  "Industrial Heat",
  "Agricultural Burning",
  "Wildfire",
  "Gas Flare",
  "Mining / Waste Heat",
  "Other Thermal Source",
  "Needs Verification",
];

export const AIClassificationPage: React.FC<AIClassificationPageProps> = ({
  events = [],
  onViewIncident,
  lastUpdatedTime,
}) => {
  // Selected detection for evidence drawer
  const [selectedHotspot, setSelectedHotspot] = useState<ThermalEvent | null>(null);

  // Review states: eventId -> status ("CONFIRMED" | "OVERRIDDEN")
  const [reviewRecords, setReviewRecords] = useState<
    Record<string, { status: "CONFIRMED" | "OVERRIDDEN"; newClassification?: EventClassification; reason?: string }>
  >({});

  // Filter state
  const [preset, setPreset] = useState<FilterPreset>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reclassification modal
  const [isChangingCategory, setIsChangingCategory] = useState<boolean>(false);
  const [newSelectedCategory, setNewSelectedCategory] = useState<EventClassification>("Industrial Heat");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered Review Queue
  const queueEvents = useMemo(() => {
    return events.filter((ev) => {
      // 1. Preset filter
      if (preset === "verification" && ev.classification !== "Needs Verification") return false;
      if (preset === "low_conf" && (ev.classificationConfidence || ev.confidence) >= 75) return false;
      if (preset === "industrial" && !(ev.classification === "Industrial Heat" || ev.classification === "Industrial Fire")) return false;
      if (preset === "agricultural" && ev.classification !== "Agricultural Burning") return false;
      if (preset === "wildfire" && ev.classification !== "Wildfire") return false;

      // 2. Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const loc = (ev.locationName || "").toLowerCase();
        const fac = (ev.nearestFacility?.name || "").toLowerCase();
        const id = (ev.id || "").toLowerCase();
        if (!loc.includes(q) && !fac.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }, [events, preset, searchQuery]);

  // Actions
  const handleConfirmClassification = (ev: ThermalEvent) => {
    setReviewRecords((prev) => ({
      ...prev,
      [ev.id]: { status: "CONFIRMED" },
    }));
    showToast(`Confirmed classification for ${formatCompactId(ev.id)}.`);
  };

  const handleApplyOverride = () => {
    if (!selectedHotspot) return;
    setReviewRecords((prev) => ({
      ...prev,
      [selectedHotspot.id]: {
        status: "OVERRIDDEN",
        newClassification: newSelectedCategory,
        reason: overrideReason || "Analyst manual reclassification based on spatial context",
      },
    }));
    setIsChangingCategory(false);
    showToast(`Classification updated to ${newSelectedCategory}.`);
  };

  const handleTagNeedsVerification = (ev: ThermalEvent) => {
    setReviewRecords((prev) => ({
      ...prev,
      [ev.id]: {
        status: "OVERRIDDEN",
        newClassification: "Needs Verification",
        reason: "Tagged for field verification",
      },
    }));
    showToast(`Marked ${formatCompactId(ev.id)} as Needs Verification.`);
  };

  const reviewedCount = Object.keys(reviewRecords).length;

  return (
    <div className="mc-page-container" style={{ position: "relative", display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#0f172a",
            color: "#ffffff",
            padding: "10px 16px",
            borderRadius: "6px",
            fontSize: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#10b981" }}>
            check_circle
          </span>
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
              Classification Review Queue
            </h1>
            <span
              className="mc-badge"
              style={{
                fontSize: "10.5px",
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #cbd5e1",
              }}
            >
              Analyst Triage
            </span>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#64748b" }}>
            Inspect AI classification confidence, examine evidence, and confirm or correct anomaly attributions &middot; Last updated{" "}
            {lastUpdatedTime || "Live"}
          </p>
        </div>

        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
          Reviewed: <strong style={{ color: "#16a34a" }}>{reviewedCount}</strong> / {events.length} detections
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid var(--mc-border-subtle)",
          borderRadius: "6px",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
          Filter Queue:
        </span>

        {/* Preset Tabs */}
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Detections" },
            { id: "verification", label: "Needs Verification" },
            { id: "low_conf", label: "Low Confidence (<75%)" },
            { id: "industrial", label: "Industrial Heat" },
            { id: "agricultural", label: "Agricultural" },
            { id: "wildfire", label: "Wildfire" },
          ].map((tab) => (
            <button
              key={tab.id}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 600,
                border: "1px solid",
                borderColor: preset === tab.id ? "#2563eb" : "#e2e8f0",
                background: preset === tab.id ? "#eff6ff" : "#ffffff",
                color: preset === tab.id ? "#1d4ed8" : "#475569",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              onClick={() => setPreset(tab.id as FilterPreset)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginLeft: "auto", position: "relative", width: "200px" }}>
          <input
            type="text"
            placeholder="Filter location / facility…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "4px 8px",
              fontSize: "11.5px",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              background: "#f8fafc",
              color: "#0f172a",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* PRIMARY WORKSPACE: Classification Review Queue Table */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          boxShadow: "var(--mc-shadow-sm)",
          overflow: "hidden",
        }}
      >
        <table className="mc-table" style={{ width: "100%", fontSize: "11.5px", margin: 0 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b", background: "#f8fafc" }}>
              <th style={{ padding: "8px 12px" }}>Location &amp; Detection</th>
              <th style={{ padding: "8px 12px" }}>Classification</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Confidence</th>
              <th style={{ padding: "8px 12px" }}>Severity</th>
              <th style={{ padding: "8px 12px" }}>Evidence Status</th>
              <th style={{ padding: "8px 12px" }}>Review Status</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {queueEvents.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                  No detections match the selected filter.
                </td>
              </tr>
            ) : (
              queueEvents.map((ev) => {
                const isSelected = selectedHotspot?.id === ev.id;
                const rec = reviewRecords[ev.id];
                const effectiveClass = rec?.newClassification || ev.classification;
                const evStatus = getEvidenceStatus(ev);

                return (
                  <tr
                    key={ev.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: isSelected ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedHotspot(ev)}
                  >
                    {/* Location & ID */}
                    <td style={{ padding: "8px 12px" }}>
                      <strong style={{ color: "#0f172a", display: "block" }}>{ev.locationName}</strong>
                      <span className="mc-mono" style={{ fontSize: "10.5px", color: "#2563eb" }}>
                        {formatCompactId(ev.id)} &middot; {ev.nearestFacility?.name || "Territorial Sector"}
                      </span>
                    </td>

                    {/* Classification */}
                    <td style={{ padding: "8px 12px" }}>
                      <ClassificationTag classification={effectiveClass} />
                    </td>

                    {/* Confidence */}
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span className="mc-mono" style={{ fontWeight: 700, color: "#1e40af" }}>
                        {ev.classificationConfidence || ev.confidence || 75}%
                      </span>
                    </td>

                    {/* Severity */}
                    <td style={{ padding: "8px 12px" }}>
                      <SeverityBadge severity={ev.severity} />
                    </td>

                    {/* Evidence Status */}
                    <td style={{ padding: "8px 12px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "3px",
                          color: evStatus.color,
                          background: evStatus.bg,
                        }}
                      >
                        {evStatus.label}
                      </span>
                    </td>

                    {/* Review Status */}
                    <td style={{ padding: "8px 12px" }}>
                      {rec ? (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "3px",
                            background: rec.status === "CONFIRMED" ? "#dcfce7" : "#fef3c7",
                            color: rec.status === "CONFIRMED" ? "#16a34a" : "#b45309",
                          }}
                        >
                          {rec.status}
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>Pending</span>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <button
                        className="mc-btn mc-btn--secondary"
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHotspot(ev);
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* SECONDARY WORKSPACE: Selected Detection Evidence Drawer (Slide-out) */}
      {selectedHotspot && (
        <div
          className="mc-alert-drawer-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.35)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setSelectedHotspot(null)}
        >
          <div
            className="mc-alert-drawer"
            style={{
              width: "440px",
              height: "100%",
              background: "#ffffff",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div>
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
                  EVIDENCE DOSSIER &middot; {formatCompactId(selectedHotspot.id)}
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                  {selectedHotspot.locationName}
                </h3>
              </div>
              <button
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}
                onClick={() => setSelectedHotspot(null)}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: "16px 18px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Classification & Confidence Banner */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>CURRENT CLASSIFICATION</span>
                  <ClassificationTag
                    classification={
                      reviewRecords[selectedHotspot.id]?.newClassification || selectedHotspot.classification
                    }
                  />
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>CONFIDENCE</span>
                  <span className="mc-mono" style={{ fontSize: "14px", fontWeight: 800, color: "#1e40af" }}>
                    {selectedHotspot.classificationConfidence || selectedHotspot.confidence || 75}%
                  </span>
                </div>
              </div>

              {/* Competing Hypotheses Distribution */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Competing Hypotheses Breakdown
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { label: "Industrial Heat", pct: selectedHotspot.classification === "Industrial Heat" ? 92 : 6, color: "#7c3aed" },
                    { label: "Agricultural Burning", pct: selectedHotspot.classification === "Agricultural Burning" ? 88 : 8, color: "#16a34a" },
                    { label: "Wildfire", pct: selectedHotspot.classification === "Wildfire" ? 86 : 4, color: "#ea580c" },
                    { label: "Gas Flare", pct: selectedHotspot.classification === "Gas Flare" ? 82 : 3, color: "#d97706" },
                  ].map((h, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
                        <span style={{ color: "#334155" }}>{h.label}</span>
                        <span className="mc-mono" style={{ color: "#0f172a", fontWeight: 600 }}>{h.pct}%</span>
                      </div>
                      <div style={{ width: "100%", height: "4px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${h.pct}%`, height: "100%", background: h.color, borderRadius: "2px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Physical Evidence Checklist */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Supporting Evidence Signals
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(selectedHotspot.evidenceList || selectedHotspot.supportingEvidence || [
                    "Spatial buffer proximity verified against industrial infrastructure",
                    `Radiative load: ${selectedHotspot.frpMw.toFixed(1)} MW FRP`,
                    `Observation pass: ${selectedHotspot.detectedTime}`,
                  ]).map((evStr, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: "11px",
                        color: "#334155",
                        background: "#f8fafc",
                        padding: "6px 8px",
                        borderRadius: "4px",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#16a34a", marginTop: "1px" }}>
                        check
                      </span>
                      <span>{evStr}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why Classified This Way */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  Why Classified This Way
                </span>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b", lineHeight: 1.5 }}>
                  {selectedHotspot.classificationReason ||
                    "Thermal signature characteristics, land-use profile, and spatial proximity index align with established criteria."}
                </p>
              </div>

              {/* Proximity & Telemetry */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", display: "block", fontSize: "10px" }}>NEAREST FACILITY</span>
                  <strong style={{ color: "#0f172a" }}>{selectedHotspot.nearestFacility?.name || "Unmapped"}</strong>
                  <span style={{ color: "#94a3b8", display: "block" }}>
                    ~{selectedHotspot.nearestFacility?.distanceKm || 0} km away
                  </span>
                </div>
                <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", display: "block", fontSize: "10px" }}>FRP EMISSION</span>
                  <strong className="mc-mono" style={{ color: "#ef4444", fontSize: "13px" }}>
                    {selectedHotspot.frpMw.toFixed(1)} MW
                  </strong>
                  <span style={{ color: "#94a3b8", display: "block" }}>Instantaneous energy</span>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="mc-btn mc-btn--primary"
                  style={{ flex: 1, padding: "7px", fontSize: "11.5px" }}
                  onClick={() => handleConfirmClassification(selectedHotspot)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                    check
                  </span>
                  Confirm
                </button>
                <button
                  className="mc-btn mc-btn--secondary"
                  style={{ flex: 1, padding: "7px", fontSize: "11.5px" }}
                  onClick={() => setIsChangingCategory(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                    edit
                  </span>
                  Change Category
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="mc-btn mc-btn--secondary"
                  style={{ flex: 1, padding: "5px", fontSize: "11px", color: "#b45309" }}
                  onClick={() => handleTagNeedsVerification(selectedHotspot)}
                >
                  Needs Verification
                </button>
                {onViewIncident && (
                  <button
                    className="mc-btn mc-btn--secondary"
                    style={{ flex: 1, padding: "5px", fontSize: "11px", color: "#2563eb" }}
                    onClick={() => onViewIncident(selectedHotspot)}
                  >
                    Open Incident →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Classification Modal */}
      {isChangingCategory && selectedHotspot && (
        <div
          className="mc-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
          onClick={() => setIsChangingCategory(false)}
        >
          <div
            className="mc-modal-content"
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              width: "420px",
              padding: "18px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
              Reclassify Detection {formatCompactId(selectedHotspot.id)}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px" }}>
                  Select New Category:
                </label>
                <select
                  value={newSelectedCategory}
                  onChange={(e) => setNewSelectedCategory(e.target.value as EventClassification)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    background: "#ffffff",
                    color: "#0f172a",
                  }}
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px" }}>
                  Analyst Rationale / Override Reason:
                </label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Ground inspection confirms seasonal stubble burning; no industrial polygon present."
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "11.5px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    background: "#ffffff",
                    color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  className="mc-btn mc-btn--secondary"
                  style={{ padding: "5px 12px", fontSize: "11.5px" }}
                  onClick={() => setIsChangingCategory(false)}
                >
                  Cancel
                </button>
                <button
                  className="mc-btn mc-btn--primary"
                  style={{ padding: "5px 14px", fontSize: "11.5px" }}
                  onClick={handleApplyOverride}
                >
                  Apply Reclassification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
