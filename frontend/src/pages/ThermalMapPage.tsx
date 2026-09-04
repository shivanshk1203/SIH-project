import React, { useState, useMemo, useEffect } from "react";
import { ThermalEvent, EventClassification } from "../types/thermal";
import { ClassificationTag, SeverityBadge } from "../components/common/StatusBadge";
import {
  ThermalHotspotMap,
  CanonicalClassification,
  CLASSIFICATION_META,
  getCanonicalCategory,
} from "../components/map/ThermalHotspotMap";

interface ThermalMapPageProps {
  events: ThermalEvent[];
  selectedEventId?: string;
  onSelectEvent: (event: ThermalEvent) => void;
  onViewIncident: (event: ThermalEvent) => void;
  onAnalyzeEvent: (event: ThermalEvent) => void;
}

const ALL_CATEGORIES: CanonicalClassification[] = [
  "Wildfire",
  "Agricultural",
  "Industrial Heat",
  "Mining / Waste Heat",
  "Controlled Burning",
  "Sensor Anomaly",
  "Needs Verification",
];

function formatCompactId(id: string): string {
  if (!id) return "FIRMS-N/A";
  const match = id.match(/^(?:firms-)?([0-9]+\.[0-9]{3,4})/i);
  if (match) return `FIRMS-${match[1]}`;
  if (id.startsWith("TH-") || id.startsWith("FIRMS-")) return id.length > 14 ? id.slice(0, 14) : id;
  return id.length > 14 ? `${id.slice(0, 13)}…` : id;
}

export const ThermalMapPage: React.FC<ThermalMapPageProps> = ({
  events = [],
  selectedEventId,
  onSelectEvent,
  onViewIncident,
  onAnalyzeEvent,
}) => {
  // Top Controls State
  const [searchText, setSearchText] = useState<string>("");
  const [dateRange, setDateRange] = useState<"24h" | "3d" | "7d">("3d");
  const [selectedClassification, setSelectedClassification] = useState<string>("ALL");
  const [highSeverityOnly, setHighSeverityOnly] = useState<boolean>(false);

  // Selected hotspot state (compact detail panel)
  const [selectedHotspot, setSelectedHotspot] = useState<ThermalEvent | null>(null);

  // Sync if selectedEventId changes from external navigation
  useEffect(() => {
    if (selectedEventId && events.length > 0) {
      const match = events.find((e) => e.id === selectedEventId);
      setSelectedHotspot(match || null);
    }
  }, [selectedEventId, events]);

  // Dynamic Filtering
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // 1. Classification
      if (selectedClassification !== "ALL") {
        const cat = getCanonicalCategory(ev.classification);
        if (cat !== selectedClassification) return false;
      }

      // 2. High Severity Only
      if (highSeverityOnly && !(ev.severity === "CRITICAL" || ev.severity === "HIGH")) {
        return false;
      }

      // 3. Search query (Location / Facility / ID)
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const loc = (ev.locationName || "").toLowerCase();
        const fac = (ev.nearestFacility?.name || "").toLowerCase();
        const id = (ev.id || "").toLowerCase();
        if (!loc.includes(q) && !fac.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }, [events, selectedClassification, highSeverityOnly, searchText]);

  const handleSelectHotspot = (ev: ThermalEvent | null) => {
    setSelectedHotspot(ev);
    if (onSelectEvent && ev) onSelectEvent(ev);
  };

  const hasActiveFilters =
    selectedClassification !== "ALL" || highSeverityOnly || Boolean(searchText.trim()) || dateRange !== "3d";

  const resetFilters = () => {
    setSelectedClassification("ALL");
    setHighSeverityOnly(false);
    setSearchText("");
    setDateRange("3d");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#ffffff",
      }}
    >
      {/* ========================================================================
          TOP CONTROLS (Compact, Clean, Operational)
          ======================================================================== */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          zIndex: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#2563eb" }}>
            map
          </span>
          <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>Thermal Map</strong>
        </div>

        {/* Search */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            width: "220px",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              position: "absolute",
              left: "8px",
              fontSize: "16px",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Search location or facility…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: "100%",
              padding: "5px 8px 5px 28px",
              fontSize: "11.5px",
              border: "1px solid #cbd5e1",
              borderRadius: "5px",
              background: "#f8fafc",
              color: "#0f172a",
              outline: "none",
            }}
          />
        </div>

        {/* Date Presets */}
        <div
          style={{
            display: "flex",
            background: "#f1f5f9",
            borderRadius: "4px",
            padding: "2px",
            gap: "2px",
          }}
        >
          {(["24h", "3d", "7d"] as const).map((r) => (
            <button
              key={r}
              style={{
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                background: dateRange === r ? "#ffffff" : "transparent",
                color: dateRange === r ? "#0f172a" : "#64748b",
                boxShadow: dateRange === r ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
              onClick={() => setDateRange(r)}
            >
              {r === "24h" ? "24h" : r === "3d" ? "3 Days" : "7 Days"}
            </button>
          ))}
        </div>

        {/* Classification Filter */}
        <div className="mc-filter-chip" style={{ background: "#f8fafc" }}>
          <span style={{ color: "#64748b", fontSize: "11px" }}>Classification:</span>
          <select
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
            style={{ fontSize: "11.5px", fontWeight: 600, border: "none", background: "transparent", color: "#0f172a" }}
          >
            <option value="ALL">All Categories</option>
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* High Severity Only Toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11.5px",
            fontWeight: 600,
            cursor: "pointer",
            color: highSeverityOnly ? "#b91c1c" : "#475569",
            background: highSeverityOnly ? "#fef2f2" : "transparent",
            padding: "4px 8px",
            borderRadius: "4px",
            border: highSeverityOnly ? "1px solid #fecaca" : "1px solid transparent",
          }}
        >
          <input
            type="checkbox"
            checked={highSeverityOnly}
            onChange={(e) => setHighSeverityOnly(e.target.checked)}
            style={{ accentColor: "#dc2626", cursor: "pointer" }}
          />
          <span>High Severity Only</span>
        </label>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            className="mc-btn mc-btn--secondary"
            style={{ padding: "3px 8px", fontSize: "10.5px" }}
            onClick={resetFilters}
          >
            Reset ✕
          </button>
        )}

        {/* Live Count */}
        <div style={{ marginLeft: "auto", fontSize: "11px", color: "#64748b" }}>
          Visible: <strong style={{ color: "#2563eb" }}>{filteredEvents.length}</strong> / {events.length} detections
        </div>
      </div>

      {/* ========================================================================
          PRIMARY AREA: THE MAP (Dominates 80%+ of Page)
          ======================================================================== */}
      <main style={{ flex: 1, width: "100%", height: "calc(100% - 48px)", position: "relative" }}>
        <ThermalHotspotMap
          events={filteredEvents}
          selectedEventId={selectedHotspot?.id}
          onSelectEvent={handleSelectHotspot}
          onViewIncident={onViewIncident}
          onAnalyzeEvent={onAnalyzeEvent}
          defaultStyle="light"
        />

        {/* ======================================================================
            COMPACT DETAIL PANEL (Shows ONLY when a detection is clicked)
            ====================================================================== */}
        {selectedHotspot && (
          <div
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              width: "310px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
              zIndex: 1000,
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="mc-mono" style={{ fontSize: "12px", fontWeight: 800, color: "#2563eb" }}>
                {formatCompactId(selectedHotspot.id)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <SeverityBadge severity={selectedHotspot.severity} />
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: "14px",
                    padding: 0,
                  }}
                  onClick={() => setSelectedHotspot(null)}
                  title="Close details"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Location */}
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                {selectedHotspot.locationName}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                {selectedHotspot.nearestFacility?.name || "Territorial Sector"} &middot; {selectedHotspot.state}
              </div>
            </div>

            {/* Classification & Confidence */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "5px",
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <ClassificationTag classification={selectedHotspot.classification} />
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Confidence</span>
                <span className="mc-mono" style={{ fontSize: "12px", fontWeight: 700, color: "#1e40af" }}>
                  {selectedHotspot.classificationConfidence || selectedHotspot.confidence}%
                </span>
              </div>
            </div>

            {/* Telemetry Grid (FRP & Detected Time) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "6px 8px" }}>
                <span style={{ fontSize: "9.5px", color: "#64748b", display: "block" }}>FRP EMISSION</span>
                <strong className="mc-mono" style={{ fontSize: "13px", color: "#ef4444" }}>
                  {selectedHotspot.frpMw.toFixed(1)} MW
                </strong>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "6px 8px" }}>
                <span style={{ fontSize: "9.5px", color: "#64748b", display: "block" }}>DETECTED</span>
                <strong style={{ fontSize: "11.5px", color: "#0f172a" }}>
                  {selectedHotspot.detectedTime}
                </strong>
              </div>
            </div>

            {/* Primary Action */}
            <button
              className="mc-btn mc-btn--primary"
              style={{ width: "100%", padding: "7px 12px", fontSize: "11.5px", marginTop: "2px" }}
              onClick={() => onViewIncident(selectedHotspot)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                open_in_new
              </span>
              Open Incident Investigation →
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
