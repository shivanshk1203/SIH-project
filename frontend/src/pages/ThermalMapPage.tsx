import React, { useState, useMemo, useEffect } from "react";
import { ThermalEvent } from "../types/thermal";
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

// Helper to safely parse dates for filtering
function parseDateToIso(dateStr?: string): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().split("T")[0];
  }
  return null;
}

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
  // Classification filter checkboxes (Requirements 6 & 7)
  const [selectedClassifications, setSelectedClassifications] = useState<CanonicalClassification[]>(ALL_CATEGORIES);

  // High Severity Only filter: CRITICAL / HIGH (Requirements 6 & 7)
  const [highSeverityOnly, setHighSeverityOnly] = useState<boolean>(false);

  // Free-text search filter (Requirement 6)
  const [searchText, setSearchText] = useState<string>("");

  // Target coordinates to center map when user clicks a search result (Requirement 6)
  const [focusCoords, setFocusCoords] = useState<[number, number] | null>(null);

  // Date range filter (Requirement 6)
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Selected hotspot state: null by default. Only set on explicit user click (Requirements 1, 4, 5, 10)
  const [selectedHotspot, setSelectedHotspot] = useState<ThermalEvent | null>(null);

  // Sync if an explicit selectedEventId is passed from parent (e.g. quick select by ID)
  useEffect(() => {
    if (selectedEventId && Array.isArray(events) && events.length > 0) {
      const match = events.find((e) => e && e.id === selectedEventId);
      setSelectedHotspot(match || null);
    } else {
      setSelectedHotspot(null);
    }
  }, [selectedEventId, events]);

  // Dynamic filter pipeline: search + dates + classifications + high severity (Requirements 3, 7, 13)
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // 1. Classification checkbox filter
      const category = getCanonicalCategory(ev.classification);
      if (!selectedClassifications.includes(category)) return false;

      // 2. High Severity Only filter: show only Critical + High detections (Requirement 7)
      if (highSeverityOnly && !(ev.severity === "CRITICAL" || ev.severity === "HIGH")) {
        return false;
      }

      // 3. Free-text search filter (location, state, facility, classification, detection ID)
      if (searchText.trim()) {
        const query = searchText.trim().toLowerCase();
        const loc = (ev.locationName || "").toLowerCase();
        const state = (ev.state || "").toLowerCase();
        const fac = (ev.nearestFacility?.name || "").toLowerCase();
        const cls = (ev.classification || "").toLowerCase();
        const id = (ev.id || "").toLowerCase();
        const compactId = formatCompactId(ev.id).toLowerCase();

        const matchFound =
          loc.includes(query) ||
          state.includes(query) ||
          fac.includes(query) ||
          cls.includes(query) ||
          id.includes(query) ||
          compactId.includes(query);

        if (!matchFound) return false;
      }

      // 4. Date range filter (safely parsed)
      const evDateIso = parseDateToIso(ev.detectedDate);
      if (evDateIso) {
        if (dateFrom && evDateIso < dateFrom) return false;
        if (dateTo && evDateIso > dateTo) return false;
      }

      return true;
    });
  }, [events, selectedClassifications, highSeverityOnly, searchText, dateFrom, dateTo]);

  // Dynamically calculate category counts based on current search, date, and severity context (Requirements 6 & 7)
  const categoryCounts = useMemo(() => {
    const counts: Record<CanonicalClassification, number> = {
      "Wildfire": 0,
      "Agricultural": 0,
      "Industrial Heat": 0,
      "Mining / Waste Heat": 0,
      "Controlled Burning": 0,
      "Sensor Anomaly": 0,
      "Needs Verification": 0,
    };

    events.forEach((ev) => {
      // Respect high severity filter
      if (highSeverityOnly && !(ev.severity === "CRITICAL" || ev.severity === "HIGH")) {
        return;
      }

      // Respect search filter
      if (searchText.trim()) {
        const query = searchText.trim().toLowerCase();
        const loc = (ev.locationName || "").toLowerCase();
        const state = (ev.state || "").toLowerCase();
        const fac = (ev.nearestFacility?.name || "").toLowerCase();
        const cls = (ev.classification || "").toLowerCase();
        const id = (ev.id || "").toLowerCase();
        const compactId = formatCompactId(ev.id).toLowerCase();

        if (
          !loc.includes(query) &&
          !state.includes(query) &&
          !fac.includes(query) &&
          !cls.includes(query) &&
          !id.includes(query) &&
          !compactId.includes(query)
        ) {
          return;
        }
      }

      // Respect date filter
      const evDateIso = parseDateToIso(ev.detectedDate);
      if (evDateIso) {
        if (dateFrom && evDateIso < dateFrom) return;
        if (dateTo && evDateIso > dateTo) return;
      }

      const cat = getCanonicalCategory(ev.classification);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return counts;
  }, [events, highSeverityOnly, searchText, dateFrom, dateTo]);

  // Toggle single classification
  const toggleClassification = (cat: CanonicalClassification) => {
    if (selectedClassifications.includes(cat)) {
      setSelectedClassifications(selectedClassifications.filter((c) => c !== cat));
    } else {
      setSelectedClassifications([...selectedClassifications, cat]);
    }
  };

  // Select all / Deselect all
  const toggleAllClassifications = () => {
    if (selectedClassifications.length === ALL_CATEGORIES.length) {
      setSelectedClassifications([]);
    } else {
      setSelectedClassifications(ALL_CATEGORIES);
    }
  };

  const hasActiveFilters =
    selectedClassifications.length !== ALL_CATEGORIES.length ||
    highSeverityOnly ||
    Boolean(searchText.trim()) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const resetFilters = () => {
    setSelectedClassifications(ALL_CATEGORIES);
    setHighSeverityOnly(false);
    setSearchText("");
    setDateFrom("");
    setDateTo("");
  };

  // Requirement 5: Keep selectedHotspot only if it is still valid and visible in filteredEvents
  const currentSelectedEvent = useMemo(() => {
    if (!selectedHotspot) return null;
    const isVisible = filteredEvents.some((ev) => ev.id === selectedHotspot.id);
    return isVisible ? selectedHotspot : null;
  }, [filteredEvents, selectedHotspot]);

  // If the currently selected hotspot is removed by the filter, clear it immediately (Requirement 5)
  useEffect(() => {
    if (selectedHotspot && !filteredEvents.some((ev) => ev.id === selectedHotspot.id)) {
      setSelectedHotspot(null);
      onSelectEvent(null as any);
    }
  }, [filteredEvents, selectedHotspot, onSelectEvent]);

  const handleSelectEventInternal = (ev: ThermalEvent | null) => {
    setSelectedHotspot(ev);
    if (onSelectEvent) {
      onSelectEvent(ev as any);
    }
  };

  const handleCloseInspector = () => {
    setSelectedHotspot(null);
    if (onSelectEvent) {
      onSelectEvent(null as any);
    }
  };

  // Real evidence list from data only (Requirement 8)
  const selectedRealEvidence = currentSelectedEvent
    ? currentSelectedEvent.evidenceList && currentSelectedEvent.evidenceList.length > 0
      ? currentSelectedEvent.evidenceList
      : currentSelectedEvent.supportingEvidence && currentSelectedEvent.supportingEvidence.length > 0
      ? currentSelectedEvent.supportingEvidence
      : []
    : [];

  // Split active categories from zero-count categories (Requirement 5)
  const activeCategories = useMemo(() => {
    return ALL_CATEGORIES.filter((cat) => (categoryCounts[cat] || 0) > 0);
  }, [categoryCounts]);

  const zeroCategories = useMemo(() => {
    return ALL_CATEGORIES.filter((cat) => (categoryCounts[cat] || 0) === 0);
  }, [categoryCounts]);

  const [showOtherCategories, setShowOtherCategories] = useState<boolean>(false);

  return (
    <div className="mc-thermal-map-page">
      {/* 1. Left-Side Organized Sidebar (Requirements 4, 5, 6, 7, 8) */}
      <aside className="mc-map-sidebar">
        {/* Scrollable Container for Filters and Content */}
        <div className="mc-map-sidebar__filters-scroll">
          {/* Brand Header */}
          <div style={{ padding: "10px 12px 6px 12px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#2563eb" }}>
                map
              </span>
              <h2 style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Agni Netra Thermal Map
              </h2>
            </div>
            <p style={{ fontSize: "10.5px", color: "#64748b", margin: "2px 0 0 0" }}>
              Live thermal anomaly detection and geospatial context
            </p>
          </div>

          {/* SECTION 1: OVERVIEW (Requirement 4) */}
          <div className="mc-sidebar-section">
            <div className="mc-sidebar-section__title">
              <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#2563eb" }}>
                analytics
              </span>
              OVERVIEW
            </div>

            {/* Dynamic Stats Grid: Total Active & Visible on Map (Requirements 4 & 6) */}
            <div className="mc-map-sidebar__stats-grid">
              <div className="mc-map-stat-box">
                <span className="mc-map-stat-box__val">{events.length}</span>
                <span className="mc-map-stat-box__lbl">Total Active</span>
              </div>

              <div
                className="mc-map-stat-box"
                style={{
                  background: filteredEvents.length === events.length ? "#eff6ff" : "#fef3c7",
                  borderColor: filteredEvents.length === events.length ? "#bfdbfe" : "#fde68a",
                }}
              >
                <span
                  className="mc-map-stat-box__val"
                  style={{ color: filteredEvents.length === events.length ? "#2563eb" : "#d97706" }}
                >
                  {filteredEvents.length}
                </span>
                <span
                  className="mc-map-stat-box__lbl"
                  style={{ color: filteredEvents.length === events.length ? "#1d4ed8" : "#b45309" }}
                >
                  Visible on Map
                </span>
              </div>
            </div>

            {/* Coverage & Status */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10.5px", color: "#64748b", marginTop: "2px" }}>
              <span>Coverage: <strong>All India Sectors</strong></span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#16a34a", fontWeight: 700 }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                Feed Active
              </span>
            </div>
          </div>

          {/* SECTION 2: FILTERS (Requirement 4) */}
          <div className="mc-sidebar-section" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div className="mc-sidebar-section__title">
                <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#2563eb" }}>
                  tune
                </span>
                FILTERS
              </div>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc2626",
                    fontSize: "10.5px",
                    cursor: "pointer",
                    fontWeight: 700,
                    padding: "0",
                  }}
                >
                  Reset ✕
                </button>
              )}
            </div>

            {/* Search Field (Requirement 4 & 6) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "8px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Search
              </span>
              <div className="mc-search-field-wrap">
                <span className="material-symbols-outlined mc-search-field-icon">search</span>
                <input
                  type="text"
                  className="mc-search-field-input"
                  placeholder="Search city, facility, type, or ID…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                {searchText && (
                  <button
                    onClick={() => setSearchText("")}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                      fontSize: "12px",
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Requirement 6: Search Matches Panel (Clicking selects and centers on hotspot without moving while typing) */}
              {searchText.trim() && (
                <div
                  style={{
                    marginTop: "3px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    padding: "5px 7px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "9.5px", color: "#64748b" }}>
                    <span style={{ fontWeight: 700, color: "#334155" }}>
                      {filteredEvents.length} {filteredEvents.length === 1 ? "match found" : "matches found"}
                    </span>
                    <span>Click to inspect & center</span>
                  </div>

                  {filteredEvents.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "115px", overflowY: "auto" }}>
                      {filteredEvents.slice(0, 5).map((ev) => {
                        const cat = getCanonicalCategory(ev.classification);
                        const meta = CLASSIFICATION_META[cat];
                        const isSelected = currentSelectedEvent?.id === ev.id;
                        return (
                          <div
                            key={ev.id}
                            onClick={() => {
                              handleSelectEventInternal(ev);
                              if (ev.coordinates && ev.coordinates.length === 2) {
                                setFocusCoords([ev.coordinates[0], ev.coordinates[1]]);
                              }
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "3px 6px",
                              borderRadius: "3px",
                              background: isSelected ? "#eff6ff" : "#ffffff",
                              border: isSelected ? "1px solid #93c5fd" : "1px solid #f1f5f9",
                              cursor: "pointer",
                              fontSize: "10.5px",
                              transition: "all 0.1s ease",
                            }}
                            title={`Select ${formatCompactId(ev.id)} and center on map`}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb", flexShrink: 0 }}>
                                {formatCompactId(ev.id)}
                              </span>
                              <span style={{ color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "10px" }}>
                                {ev.locationName}
                              </span>
                            </div>
                            <span style={{ fontSize: "9.5px", color: "#dc2626", fontWeight: 700, flexShrink: 0, marginLeft: "4px" }}>
                              {typeof ev.frpMw === "number" ? ev.frpMw.toFixed(1) : "0"} MW
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: "10px", color: "#94a3b8", padding: "3px 0", textAlign: "center" }}>
                      No hotspots match "{searchText}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date Range Filters (Requirement 4 & 6) */}
            <div className="mc-date-filter-group" style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Date Range
                </span>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    style={{ background: "none", border: "none", color: "#dc2626", fontSize: "10px", cursor: "pointer", fontWeight: 600 }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mc-date-inputs">
                <label className="mc-date-input-label">
                  From
                  <input
                    type="date"
                    className="mc-date-input"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="mc-date-input-label">
                  To
                  <input
                    type="date"
                    className="mc-date-input"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
              </div>
            </div>

            {/* Classification Filters (Requirements 2, 3, 5, 12) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "8px" }}>
              <div className="mc-class-list-header">
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Classification Filters
                </span>
                <button
                  type="button"
                  className="mc-btn mc-btn--secondary"
                  style={{ padding: "2px 6px", fontSize: "10px" }}
                  onClick={toggleAllClassifications}
                >
                  {selectedClassifications.length === ALL_CATEGORIES.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              {/* Active Classifications Prominently Displayed (Requirement 5) */}
              <div className="mc-class-checkboxes">
                {activeCategories.map((cat) => {
                  const meta = CLASSIFICATION_META[cat];
                  const isChecked = selectedClassifications.includes(cat);
                  const count = categoryCounts[cat] || 0;

                  return (
                    <label key={cat} className="mc-class-checkbox-row">
                      <div className="mc-class-checkbox-row__left">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleClassification(cat)}
                          style={{ accentColor: meta.color, cursor: "pointer" }}
                        />
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: meta.color,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: "#1e293b", fontSize: "11.5px" }}>{meta.label}</span>
                      </div>
                      <span className="mc-class-checkbox-row__count" style={{ color: "#0f172a", fontWeight: 700 }}>
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Zero-Count Classifications grouped under "Other Categories — 0 detections" (Requirement 3) */}
              {zeroCategories.length > 0 && (
                <div style={{ marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setShowOtherCategories(!showOtherCategories)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 6px",
                      background: "#f8fafc",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "4px",
                      fontSize: "10.5px",
                      color: "#64748b",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    <span>Other Categories &mdash; 0 detections ({zeroCategories.length} available)</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px", transform: showOtherCategories ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                      expand_more
                    </span>
                  </button>

                  {showOtherCategories && (
                    <div className="mc-class-checkboxes" style={{ marginTop: "4px", paddingLeft: "4px" }}>
                      {zeroCategories.map((cat) => {
                        const meta = CLASSIFICATION_META[cat];
                        const isChecked = selectedClassifications.includes(cat);

                        return (
                          <label
                            key={cat}
                            className="mc-class-checkbox-row"
                            style={{ opacity: 0.65, background: "#ffffff" }}
                          >
                            <div className="mc-class-checkbox-row__left">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleClassification(cat)}
                                style={{ accentColor: meta.color, cursor: "pointer" }}
                              />
                              <span
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  background: meta.color,
                                  display: "inline-block",
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ color: "#64748b", fontSize: "11px" }}>{meta.label}</span>
                            </div>
                            <span className="mc-class-checkbox-row__count" style={{ color: "#94a3b8", fontWeight: 500 }}>
                              0
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* High Severity Only Filter: Critical + High (Requirement 4 & 7) */}
            <div
              style={{
                padding: "7px 9px",
                background: highSeverityOnly ? "#fef2f2" : "#f8fafc",
                border: highSeverityOnly ? "1px solid #fca5a5" : "1px solid #e2e8f0",
                borderRadius: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: highSeverityOnly ? "#b91c1c" : "#334155",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <input
                    type="checkbox"
                    checked={highSeverityOnly}
                    onChange={(e) => setHighSeverityOnly(e.target.checked)}
                    style={{ accentColor: "#dc2626", cursor: "pointer" }}
                  />
                  <span>High Severity Only</span>
                </div>
                <span
                  style={{
                    fontSize: "9.5px",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    background: highSeverityOnly ? "#dc2626" : "#e2e8f0",
                    color: highSeverityOnly ? "#ffffff" : "#475569",
                    fontWeight: 700,
                  }}
                >
                  Critical + High
                </span>
              </label>
            </div>
          </div>

          {/* SECTION 3: SELECTED DETECTION (Requirements 4, 8, 9, 10, 13) */}
          <div className="mc-sidebar-section" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px" }}>
            <div className="mc-sidebar-section__title" style={{ marginBottom: "6px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#2563eb" }}>
                crisis_alert
              </span>
              SELECTED DETECTION
            </div>

            {currentSelectedEvent ? (
              <div className="mc-map-sidebar__inspector" style={{ maxHeight: "none", boxShadow: "none" }}>
                {/* Title & Severity */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mc-mono" style={{ fontSize: "12px", fontWeight: 800, color: "#2563eb" }} title={currentSelectedEvent.id}>
                    {formatCompactId(currentSelectedEvent.id)}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <SeverityBadge severity={currentSelectedEvent.severity} />
                    <button
                      onClick={handleCloseInspector}
                      style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", padding: "0 2px" }}
                      title="Close selection"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Location */}
                <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#0f172a" }}>
                  {currentSelectedEvent.locationName}
                </div>

                {/* Classification & Confidence (Requirement 8, 10 & 13) */}
                <div style={{ background: "#f8fafc", padding: "6px 8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <ClassificationTag classification={currentSelectedEvent.classification} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10.5px" }}>
                    <span style={{ color: "#64748b" }}>AI Classification Confidence:</span>
                    <span className="mc-mono" style={{ fontWeight: 800, color: "#1e40af" }}>
                      {currentSelectedEvent.classificationConfidence || 75}%{" "}
                      <span style={{ fontSize: "9.5px", fontWeight: 500, color: "#64748b" }}>
                        ({(currentSelectedEvent.classificationConfidence || 75) >= 80 ? "High confidence" : "Moderate"})
                      </span>
                    </span>
                  </div>
                </div>

                {/* NASA FIRMS Observation Telemetry (Requirement 8, 9 & 13) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px",
                    background: "#f8fafc",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    fontSize: "10.5px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b" }}>FRP:</span>
                    <div style={{ fontWeight: 700, color: "#dc2626" }}>
                      {typeof currentSelectedEvent.frpMw === "number" ? currentSelectedEvent.frpMw.toFixed(1) : "0.0"} MW
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>NASA FIRMS Conf:</span>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>
                      {currentSelectedEvent.firmsConfidence || currentSelectedEvent.confidence || 0}%
                    </div>
                  </div>
                </div>

                {/* Classification Evidence Checklist (Requirement 9: real calculated data only) */}
                {selectedRealEvidence.length > 0 && (
                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "4px" }}>
                    <div style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "3px" }}>
                      Classification Evidence:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "75px", overflowY: "auto" }}>
                      {selectedRealEvidence.slice(0, 3).map((evText, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "4px", fontSize: "10px", color: "#334155", lineHeight: 1.25 }}>
                          <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "10px", lineHeight: 1 }}>✓</span>
                          <span>{evText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* View Full Incident Record CTA */}
                <button
                  className="mc-btn mc-btn--primary"
                  style={{ width: "100%", padding: "5px 8px", fontSize: "11px", marginTop: "2px", fontWeight: 600 }}
                  onClick={() => onViewIncident(currentSelectedEvent)}
                >
                  View Full Incident Record &rarr;
                </button>
              </div>
            ) : (
              /* Requirement 4: Compact Empty State */
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "5px",
                  padding: "7px 9px",
                  fontSize: "10.5px",
                  color: "#64748b",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <div style={{ fontWeight: 700, color: "#334155", fontSize: "11px" }}>
                  No detection selected
                </div>
                <div style={{ fontSize: "10px", color: "#64748b" }}>
                  Click an individual hotspot to inspect:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 6px", marginTop: "3px", fontSize: "9.5px", color: "#475569" }}>
                  <div>&bull; Location</div>
                  <div>&bull; Classification</div>
                  <div>&bull; Confidence</div>
                  <div>&bull; FRP</div>
                  <div>&bull; Evidence</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Main Map Area (Requirements 1, 2, 4, 13, 14, 15) */}
      <main className="mc-map-main-area">
        <ThermalHotspotMap
          events={filteredEvents}
          selectedEventId={currentSelectedEvent?.id}
          focusCoordinates={focusCoords}
          onSelectEvent={handleSelectEventInternal}
          onViewIncident={onViewIncident}
          onAnalyzeEvent={onAnalyzeEvent}
          defaultStyle="light"
        />
      </main>
    </div>
  );
};
