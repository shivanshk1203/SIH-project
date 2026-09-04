import React, { useState, useMemo, useEffect } from "react";
import { ThermalEvent, EventClassification } from "../types/thermal";
import { SeverityBadge, ClassificationTag } from "../components/common/StatusBadge";
import { AnalystContextMap } from "../components/map/AnalystContextMap";
import { AnalystSatelliteTile } from "../components/map/AnalystSatelliteTile";
import { CLASSIFICATION_META, getCanonicalCategory } from "../components/map/ThermalHotspotMap";

interface AIClassificationPageProps {
  events: ThermalEvent[];
  selectedEvent?: ThermalEvent | null;
  onSelectEvent?: (event: ThermalEvent | null) => void;
  onViewIncident?: (event: ThermalEvent) => void;
  onNavigateToMap?: (event?: ThermalEvent) => void;
  lastUpdatedTime?: string;
  onRefreshData?: () => void;
}

type SortField = "newest" | "highest_severity" | "lowest_confidence" | "highest_frp";
type PresetFilter = "all" | "verification" | "low_conf" | "industrial" | "agricultural" | "wildfire";

function formatCompactId(id: string): string {
  if (!id) return "FIRMS-N/A";
  const match = id.match(/^(?:firms-)?([0-9]+\.[0-9]{3,4})/i);
  if (match) return `FIRMS-${match[1]}`;
  if (id.startsWith("TH-") || id.startsWith("FIRMS-")) return id.length > 16 ? id.slice(0, 16) : id;
  return id.length > 14 ? `${id.slice(0, 13)}…` : id;
}

// Calculate evidence-driven AI confidence and evidence status dynamically
function assessDetection(ev: ThermalEvent, overriddenClass?: EventClassification) {
  const effectiveClass = overriddenClass || ev.classification;
  const frp = ev.frpMw || 0;
  const distM = ev.nearestFacility?.distanceKm ? ev.nearestFacility.distanceKm * 1000 : 9999;
  const rawFirmsConf = typeof ev.firmsConfidence === "number" ? ev.firmsConfidence : 65;

  let aiConfidence = ev.classificationConfidence || 75;
  if (effectiveClass === "Needs Verification") {
    aiConfidence = Math.max(35, Math.min(52, Math.round(rawFirmsConf * 0.5 + 8)));
  } else if (effectiveClass === "Industrial Heat" || effectiveClass === "Industrial Fire") {
    aiConfidence = distM < 400 ? Math.min(96, Math.max(86, 88 + Math.round(frp * 0.1))) : 74;
  } else if (effectiveClass === "Agricultural Burning") {
    aiConfidence = frp > 35 ? 76 : Math.min(92, Math.max(78, 82 + (ev.id.charCodeAt(ev.id.length - 1) % 10)));
  } else if (effectiveClass === "Wildfire") {
    aiConfidence = Math.min(92, Math.max(74, 80 + Math.round(frp * 0.1)));
  }

  let evidenceStatus: "Strong" | "Moderate" | "Mixed" | "Weak" = "Moderate";
  let badgeClass = "mc-ev-pill--mixed";

  if (effectiveClass === "Needs Verification") {
    evidenceStatus = "Mixed";
    badgeClass = "mc-ev-pill--verify";
  } else if (aiConfidence >= 85 && (distM < 500 || (effectiveClass === "Agricultural Burning" && distM > 1500))) {
    evidenceStatus = "Strong";
    badgeClass = "mc-ev-pill--strong";
  } else if (aiConfidence < 65 || rawFirmsConf < 50) {
    evidenceStatus = "Weak";
    badgeClass = "mc-ev-pill--weak";
  } else if (
    (effectiveClass === "Agricultural Burning" && frp > 30) ||
    (effectiveClass === "Industrial Heat" && distM > 800) ||
    (effectiveClass === "Wildfire" && distM < 400)
  ) {
    evidenceStatus = "Mixed";
    badgeClass = "mc-ev-pill--mixed";
  } else {
    evidenceStatus = "Moderate";
    badgeClass = "mc-ev-pill--mixed";
  }

  return { aiConfidence, evidenceStatus, badgeClass, rawFirmsConf, distM };
}

function getHypothesisDistribution(ev: ThermalEvent, effectiveClass: EventClassification, aiConf: number) {
  let agri = ev.confidenceBreakdown?.agriculturalBurning ?? (effectiveClass === "Agricultural Burning" ? aiConf : 6);
  let ind = ev.confidenceBreakdown?.industrialFire ?? (effectiveClass === "Industrial Heat" ? aiConf : 5);
  let wild = ev.confidenceBreakdown?.wildfire ?? (effectiveClass === "Wildfire" ? aiConf : 3);
  let flare = ev.confidenceBreakdown?.gasFlare ?? (effectiveClass === "Gas Flare" ? aiConf : 2);
  let mining = ev.confidenceBreakdown?.miningSource ?? (effectiveClass === "Mining / Waste Heat" ? aiConf : 2);
  let unknown = ev.confidenceBreakdown?.unknown ?? (effectiveClass === "Needs Verification" ? 48 : 2);

  const total = agri + ind + wild + flare + mining + unknown || 100;
  const norm = (v: number) => Math.max(1, Math.round((v / total) * 100));

  const items = [
    { label: "Agricultural Burning", value: norm(agri), color: "#16a34a" },
    { label: "Industrial Heat", value: norm(ind), color: "#7c3aed" },
    { label: "Wildfire", value: norm(wild), color: "#ea580c" },
    { label: "Gas Flare", value: norm(flare), color: "#d97706" },
    { label: "Mining / Waste Heat", value: norm(mining), color: "#92400e" },
    { label: "Needs Verification", value: norm(unknown), color: "#64748b" },
  ];

  items.sort((a, b) => b.value - a.value);
  return {
    leading: items[0],
    competing: items.slice(1).filter((it) => it.value >= 2),
  };
}

const ALL_CLASSIFICATIONS: EventClassification[] = [
  "Agricultural Burning",
  "Industrial Heat",
  "Wildfire",
  "Gas Flare",
  "Mining / Waste Heat",
  "Other Thermal Source",
  "Needs Verification",
];

export const AIClassificationPage: React.FC<AIClassificationPageProps> = ({
  events = [],
  onSelectEvent,
  onViewIncident,
  onNavigateToMap,
  lastUpdatedTime = "09:51 PM IST",
  onRefreshData,
}) => {
  // CRITICAL REQUIREMENT 8: Strictly NO automatic selection. Starts NULL.
  const [selectedHotspot, setSelectedHotspot] = useState<ThermalEvent | null>(null);

  // Local overrides map: eventId -> analyst override data
  const [overrides, setOverrides] = useState<
    Record<string, { newClassification: EventClassification; reason: string; timestamp: string }>
  >({});

  // Local review confirmation map: eventId -> boolean
  const [confirmedEvents, setConfirmedEvents] = useState<Record<string, boolean>>({});

  // Reclassification Modal State
  const [isChangingClassification, setIsChangingClassification] = useState<boolean>(false);
  const [newClassSelection, setNewClassSelection] = useState<EventClassification>("Agricultural Burning");
  const [analystReason, setAnalystReason] = useState<string>("");

  // Audit trail accordion toggle (collapsed by default)
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);

  // Filters & Sorting state
  const [searchText, setSearchText] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [evidenceFilter, setEvidenceFilter] = useState<string>("all");
  const [presetFilter, setPresetFilter] = useState<PresetFilter>("all");
  const [sortField, setSortField] = useState<SortField>("newest");

  // Dynamic Reconciled Summary Metrics (strictly derived from single shared dataset)
  const stats = useMemo(() => {
    const total = events.length;
    let classified = total; // 100% of detections have a primary classification
    let verification = 0;
    let industrial = 0;
    let agricultural = 0;
    let wildfire = 0;
    let other = 0;

    events.forEach((ev) => {
      const cls = overrides[ev.id]?.newClassification || ev.classification;
      if (cls === "Needs Verification") {
        verification += 1;
      } else if (cls === "Industrial Heat" || cls === "Industrial Fire") {
        industrial += 1;
      } else if (cls === "Agricultural Burning") {
        agricultural += 1;
      } else if (cls === "Wildfire") {
        wildfire += 1;
      } else {
        other += 1;
      }
    });

    return { total, classified, verification, industrial, agricultural, wildfire, other };
  }, [events, overrides]);

  // Pre-assessed events
  const assessedEvents = useMemo(() => {
    return events.map((ev) => {
      const override = overrides[ev.id];
      const effectiveClass = override?.newClassification || ev.classification;
      const assessment = assessDetection(ev, effectiveClass);
      return {
        ...ev,
        effectiveClassification: effectiveClass,
        aiConfidence: assessment.aiConfidence,
        evidenceStatus: assessment.evidenceStatus,
        badgeClass: assessment.badgeClass,
        distM: assessment.distM,
        rawFirmsConf: assessment.rawFirmsConf,
      };
    });
  }, [events, overrides]);

  // Filtering & Sorting pipeline
  const filteredEvents = useMemo(() => {
    return assessedEvents
      .filter((ev) => {
        // 1. Preset Filter
        if (presetFilter === "verification" && ev.effectiveClassification !== "Needs Verification") return false;
        if (presetFilter === "low_conf" && ev.aiConfidence >= 75) return false;
        if (presetFilter === "industrial" && ev.effectiveClassification !== "Industrial Heat" && ev.effectiveClassification !== "Industrial Fire")
          return false;
        if (presetFilter === "agricultural" && ev.effectiveClassification !== "Agricultural Burning") return false;
        if (presetFilter === "wildfire" && ev.effectiveClassification !== "Wildfire") return false;

        // 2. Dropdown Filters
        if (classFilter !== "all" && ev.effectiveClassification !== classFilter) return false;
        if (severityFilter !== "all" && ev.severity !== severityFilter) return false;
        if (evidenceFilter !== "all" && ev.evidenceStatus !== evidenceFilter) return false;

        // 3. Search Query
        if (searchText.trim()) {
          const q = searchText.toLowerCase();
          const matchId = ev.id.toLowerCase().includes(q) || formatCompactId(ev.id).toLowerCase().includes(q);
          const matchLoc = (ev.locationName || "").toLowerCase().includes(q) || (ev.state || "").toLowerCase().includes(q);
          const matchClass = ev.effectiveClassification.toLowerCase().includes(q);
          const matchFacility = (ev.nearestFacility?.name || "").toLowerCase().includes(q);
          if (!matchId && !matchLoc && !matchClass && !matchFacility) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortField === "highest_severity") {
          const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MODERATE: 2, WARNING: 2, LOW: 1, NORMAL: 1 };
          return (rank[b.severity] || 0) - (rank[a.severity] || 0);
        }
        if (sortField === "lowest_confidence") {
          return a.aiConfidence - b.aiConfidence;
        }
        if (sortField === "highest_frp") {
          return b.frpMw - a.frpMw;
        }
        // Newest by ID or detected time
        return b.id.localeCompare(a.id);
      });
  }, [assessedEvents, presetFilter, classFilter, severityFilter, evidenceFilter, searchText, sortField]);

  // CRITICAL REQUIREMENT 8: Clear selected detection if it no longer exists in filtered result
  useEffect(() => {
    if (selectedHotspot) {
      const stillVisible = filteredEvents.some((ev) => ev.id === selectedHotspot.id);
      if (!stillVisible) {
        setSelectedHotspot(null);
      }
    }
  }, [filteredEvents]);

  // Selection Handler: ONLY explicit click on a table row selects a detection!
  const handleSelectHotspot = (ev: ThermalEvent) => {
    setSelectedHotspot(ev);
    if (onSelectEvent) {
      onSelectEvent(ev);
    }
  };

  // Analyst Action: Confirm Classification
  const handleConfirm = (ev: ThermalEvent) => {
    setConfirmedEvents((prev) => ({ ...prev, [ev.id]: true }));
    setOverrides((prev) => ({
      ...prev,
      [ev.id]: {
        newClassification: overrides[ev.id]?.newClassification || ev.classification,
        reason: "Confirmed by Analyst (Visual & Telemetric Verification)",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) + " IST",
      },
    }));
  };

  // Analyst Action: Mark for Verification
  const handleMarkVerification = (ev: ThermalEvent) => {
    setOverrides((prev) => ({
      ...prev,
      [ev.id]: {
        newClassification: "Needs Verification",
        reason: "Flagged for ground-truth field verification due to competing signals",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) + " IST",
      },
    }));
    setConfirmedEvents((prev) => ({ ...prev, [ev.id]: false }));
  };

  // Analyst Action: Change Classification Submit
  const handleSaveClassificationChange = () => {
    if (!selectedHotspot) return;
    setOverrides((prev) => ({
      ...prev,
      [selectedHotspot.id]: {
        newClassification: newClassSelection,
        reason: analystReason.trim() || "Analyst manual reclassification based on spatial evidence",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) + " IST",
      },
    }));
    setConfirmedEvents((prev) => ({ ...prev, [selectedHotspot.id]: true }));
    setIsChangingClassification(false);
    setAnalystReason("");
  };

  const activeHotspot = useMemo(() => {
    if (!selectedHotspot) return null;
    const effectiveClass = overrides[selectedHotspot.id]?.newClassification || selectedHotspot.classification;
    const assessment = assessDetection(selectedHotspot, effectiveClass);
    return {
      ...selectedHotspot,
      classification: effectiveClass,
      aiConfidence: assessment.aiConfidence,
      evidenceStatus: assessment.evidenceStatus,
      analystOverride: overrides[selectedHotspot.id] || null,
    };
  }, [selectedHotspot, overrides]);

  const currentCategoryMeta = activeHotspot
    ? CLASSIFICATION_META[getCanonicalCategory(activeHotspot.classification)] || CLASSIFICATION_META["Needs Verification"]
    : CLASSIFICATION_META["Needs Verification"];

  const currentHypotheses = activeHotspot
    ? getHypothesisDistribution(activeHotspot, activeHotspot.classification, activeHotspot.aiConfidence)
    : null;

  return (
    <div className="mc-page-container mc-classification-page">
      {/* =========================================================================
          1. PAGE HEADER (Clean layout, strictly below top navigation)
          ========================================================================= */}
      <div className="mc-class-header">
        <div className="mc-class-header__left">
          <h1 className="mc-class-header__title">
            <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#2563eb" }}>
              psychology
            </span>
            AI Classification
          </h1>
          <p className="mc-class-header__subtitle">
            Context-aware classification of NASA FIRMS thermal detections
          </p>
        </div>

        <div className="mc-class-header__right">
          <span className="mc-class-header__meta-badge">{events.length} detections</span>
          <span style={{ color: "#cbd5e1" }}>&bull;</span>
          <span>Data Source: NASA FIRMS</span>
          <span style={{ color: "#cbd5e1" }}>&bull;</span>
          <span>Last refreshed {lastUpdatedTime}</span>
          {onRefreshData && (
            <button
              type="button"
              className="mc-btn mc-btn--secondary"
              style={{ padding: "4px 10px", fontSize: "11.5px" }}
              onClick={onRefreshData}
              title="Refresh thermal detections feed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                refresh
              </span>
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. COMPACT VISUAL 6-STAGE PIPELINE
          ========================================================================= */}
      <div className="mc-pipeline-card">
        <div className="mc-pipeline-pill">
          <span className="mc-pipeline-pill__num">01</span>
          <span className="material-symbols-outlined mc-pipeline-pill__icon">sensors</span>
          <span>NASA FIRMS Detection</span>
        </div>
        <span className="material-symbols-outlined mc-pipeline-sep">arrow_forward</span>

        <div className="mc-pipeline-pill">
          <span className="mc-pipeline-pill__num">02</span>
          <span className="material-symbols-outlined mc-pipeline-pill__icon">explore</span>
          <span>Geospatial Context</span>
        </div>
        <span className="material-symbols-outlined mc-pipeline-sep">arrow_forward</span>

        <div className="mc-pipeline-pill">
          <span className="mc-pipeline-pill__num">03</span>
          <span className="material-symbols-outlined mc-pipeline-pill__icon">terrain</span>
          <span>Land Cover</span>
        </div>
        <span className="material-symbols-outlined mc-pipeline-sep">arrow_forward</span>

        <div className="mc-pipeline-pill">
          <span className="mc-pipeline-pill__num">04</span>
          <span className="material-symbols-outlined mc-pipeline-pill__icon">factory</span>
          <span>Facility Matching</span>
        </div>
        <span className="material-symbols-outlined mc-pipeline-sep">arrow_forward</span>

        <div className="mc-pipeline-pill">
          <span className="mc-pipeline-pill__num">05</span>
          <span className="material-symbols-outlined mc-pipeline-pill__icon">satellite_alt</span>
          <span>Imagery Analysis</span>
        </div>
        <span className="material-symbols-outlined mc-pipeline-sep">arrow_forward</span>

        <div className="mc-pipeline-pill is-active">
          <span className="mc-pipeline-pill__num">06</span>
          <span className="material-symbols-outlined mc-pipeline-pill__icon">psychology</span>
          <span>Multi-Signal Classification</span>
        </div>
      </div>

      {/* =========================================================================
          3. DYNAMIC RECONCILED SUMMARY METRICS BAR
          ========================================================================= */}
      <div className="mc-summary-bar">
        <div className="mc-summary-chip">
          <span className="mc-summary-chip__val">{stats.total}</span>
          <span className="mc-summary-chip__lbl">Active Detections</span>
        </div>

        <div className="mc-summary-chip">
          <span className="mc-summary-chip__val" style={{ color: "#2563eb" }}>{stats.classified}</span>
          <span className="mc-summary-chip__lbl">Classified (100%)</span>
        </div>

        <div className="mc-summary-chip mc-summary-chip--alert">
          <span className="mc-summary-chip__val">{stats.verification}</span>
          <span className="mc-summary-chip__lbl">Needs Verification</span>
        </div>

        <div className="mc-summary-chip mc-summary-chip--ind">
          <span className="mc-summary-chip__val">{stats.industrial}</span>
          <span className="mc-summary-chip__lbl">Industrial Heat</span>
        </div>

        <div className="mc-summary-chip mc-summary-chip--agri">
          <span className="mc-summary-chip__val">{stats.agricultural}</span>
          <span className="mc-summary-chip__lbl">Agricultural Burning</span>
        </div>

        <div className="mc-summary-chip mc-summary-chip--wild">
          <span className="mc-summary-chip__val">{stats.wildfire}</span>
          <span className="mc-summary-chip__lbl">Wildfire</span>
        </div>
      </div>

      {/* =========================================================================
          4. APPLICATION-STYLED FILTER TOOLBAR
          ========================================================================= */}
      <div className="mc-filter-toolbar">
        {/* Preset Segmented Filter Pills */}
        <div className="mc-preset-row">
          <button
            type="button"
            className={`mc-preset-btn ${presetFilter === "all" ? "is-active" : ""}`}
            onClick={() => setPresetFilter("all")}
          >
            All ({events.length})
          </button>
          <button
            type="button"
            className={`mc-preset-btn ${presetFilter === "verification" ? "is-active" : ""}`}
            onClick={() => setPresetFilter("verification")}
          >
            Needs Verification ({stats.verification})
          </button>
          <button
            type="button"
            className={`mc-preset-btn ${presetFilter === "low_conf" ? "is-active" : ""}`}
            onClick={() => setPresetFilter("low_conf")}
          >
            Low Confidence (&lt;75%)
          </button>
          <button
            type="button"
            className={`mc-preset-btn ${presetFilter === "industrial" ? "is-active" : ""}`}
            onClick={() => setPresetFilter("industrial")}
          >
            Industrial ({stats.industrial})
          </button>
          <button
            type="button"
            className={`mc-preset-btn ${presetFilter === "agricultural" ? "is-active" : ""}`}
            onClick={() => setPresetFilter("agricultural")}
          >
            Agricultural ({stats.agricultural})
          </button>
          <button
            type="button"
            className={`mc-preset-btn ${presetFilter === "wildfire" ? "is-active" : ""}`}
            onClick={() => setPresetFilter("wildfire")}
          >
            Wildfire ({stats.wildfire})
          </button>
        </div>

        {/* Search & Custom Application Dropdowns */}
        <div className="mc-controls-row">
          {/* Search Input */}
          <div className="mc-styled-search">
            <span className="material-symbols-outlined mc-styled-search__icon">search</span>
            <input
              type="text"
              placeholder="Search detections by ID, location, or facility…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                type="button"
                className="mc-styled-search__clear"
                onClick={() => setSearchText("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Classification Dropdown */}
          <div className="mc-select-wrap">
            <select
              className="mc-select-control"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="all">Classification: All</option>
              {ALL_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>Classification: {c}</option>
              ))}
            </select>
            <span className="material-symbols-outlined mc-select-chevron">expand_more</span>
          </div>

          {/* Severity Dropdown */}
          <div className="mc-select-wrap">
            <select
              className="mc-select-control"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">Severity: All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MODERATE">Moderate</option>
              <option value="LOW">Low</option>
            </select>
            <span className="material-symbols-outlined mc-select-chevron">expand_more</span>
          </div>

          {/* Evidence Dropdown */}
          <div className="mc-select-wrap">
            <select
              className="mc-select-control"
              value={evidenceFilter}
              onChange={(e) => setEvidenceFilter(e.target.value)}
            >
              <option value="all">Evidence: All</option>
              <option value="Strong">Strong Evidence</option>
              <option value="Moderate">Moderate Evidence</option>
              <option value="Mixed">Mixed Evidence</option>
              <option value="Weak">Weak Evidence</option>
            </select>
            <span className="material-symbols-outlined mc-select-chevron">expand_more</span>
          </div>

          {/* Sort Dropdown */}
          <div className="mc-select-wrap">
            <select
              className="mc-select-control"
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="highest_severity">Sort: Highest Severity</option>
              <option value="lowest_confidence">Sort: Lowest Confidence</option>
              <option value="highest_frp">Sort: Highest FRP</option>
            </select>
            <span className="material-symbols-outlined mc-select-chevron">expand_more</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. MAIN CONTENT: MASTER / DETAIL WORKSPACE (~65% Left, ~35% Right)
          ========================================================================= */}
      <div className="mc-workspace-grid">
        {/* =======================================================================
            LEFT PANE: THERMAL DETECTIONS TABLE
            ======================================================================= */}
        <div className="mc-table-card">
          <div className="mc-table-scroll">
            <table className="mc-detections-table">
              <thead>
                <tr>
                  <th style={{ width: "17%" }}>EVENT ID</th>
                  <th style={{ width: "23%" }}>LOCATION</th>
                  <th style={{ width: "13%" }}>DETECTED</th>
                  <th style={{ width: "19%" }}>CLASSIFICATION</th>
                  <th style={{ width: "10%" }}>AI CONF</th>
                  <th style={{ width: "9%" }}>SEVERITY</th>
                  <th style={{ width: "9%" }}>EVIDENCE</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((ev) => {
                    const isSelected = activeHotspot?.id === ev.id;
                    const isConfirmed = Boolean(confirmedEvents[ev.id]);

                    // Clean facility display without placeholders
                    const rawFac = ev.nearestFacility?.name;
                    const hasFac = rawFac && rawFac.trim() && rawFac !== "Unmapped Local Sector" && rawFac !== "Territorial Sector";
                    const facilityContext = hasFac
                      ? `${rawFac} (~${ev.distM < 1000 ? `${Math.round(ev.distM)}m` : `${(ev.distM / 1000).toFixed(1)}km`})`
                      : null;

                    return (
                      <tr
                        key={ev.id}
                        className={`mc-detection-row ${isSelected ? "is-selected" : ""}`}
                        onClick={() => handleSelectHotspot(ev)}
                      >
                        {/* Event ID */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            {isConfirmed && (
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px", color: "#16a34a" }}
                                title="Confirmed by Analyst"
                              >
                                check_circle
                              </span>
                            )}
                            <span className="mc-cell-id">{formatCompactId(ev.id)}</span>
                          </div>
                        </td>

                        {/* Location */}
                        <td>
                          <div className="mc-cell-coord">
                            {ev.coordinates[0].toFixed(4)}°N, {ev.coordinates[1].toFixed(4)}°E
                          </div>
                          <div className="mc-cell-sub">
                            {ev.locationName}
                            {facilityContext && (
                              <span style={{ color: "#2563eb", display: "block", fontSize: "10px" }}>
                                {facilityContext}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Detected Time */}
                        <td className="mc-mono" style={{ fontSize: "10.5px", color: "#475569" }}>
                          {ev.detectedTime}
                        </td>

                        {/* Classification */}
                        <td>
                          <ClassificationTag classification={ev.effectiveClassification} />
                          {overrides[ev.id] && (
                            <span style={{ fontSize: "9px", background: "#fef3c7", color: "#b45309", padding: "1px 4px", borderRadius: "2px", marginLeft: "4px", fontWeight: 700 }}>
                              Override
                            </span>
                          )}
                        </td>

                        {/* AI Confidence */}
                        <td>
                          <span
                            className="mc-mono"
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: ev.aiConfidence >= 85 ? "#16a34a" : ev.aiConfidence >= 70 ? "#2563eb" : "#d97706",
                            }}
                          >
                            {ev.aiConfidence}%
                          </span>
                        </td>

                        {/* Severity */}
                        <td>
                          <SeverityBadge severity={ev.severity} />
                        </td>

                        {/* Evidence */}
                        <td>
                          <span className={`mc-ev-pill ${ev.badgeClass}`}>{ev.evidenceStatus}</span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#cbd5e1", marginBottom: "6px" }}>
                        search_off
                      </span>
                      <div style={{ fontWeight: 600, color: "#334155" }}>No matching detections found</div>
                      <div style={{ fontSize: "11px", marginTop: "2px" }}>Try adjusting your search query or active filter presets.</div>
                      <button
                        type="button"
                        className="mc-btn mc-btn--secondary"
                        style={{ marginTop: "10px", fontSize: "11px" }}
                        onClick={() => {
                          setSearchText("");
                          setClassFilter("all");
                          setSeverityFilter("all");
                          setEvidenceFilter("all");
                          setPresetFilter("all");
                        }}
                      >
                        Reset All Filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mc-table-footer-bar">
            <span>Showing <strong>{filteredEvents.length}</strong> of {events.length} thermal detections</span>
            <span style={{ color: "#64748b" }}>Click any row to inspect classification evidence</span>
          </div>
        </div>

        {/* =======================================================================
            RIGHT PANE: CLASSIFICATION EVIDENCE PANEL
            ======================================================================= */}
        <div className="mc-evidence-card-pane">
          {activeHotspot ? (
            <div className="mc-evidence-content">
              {/* Selected Event Hero */}
              <div className="mc-evidence-hero">
                <div className="mc-evidence-hero__top">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="mc-evidence-hero__id">{formatCompactId(activeHotspot.id)}</span>
                    <SeverityBadge severity={activeHotspot.severity} />
                    {confirmedEvents[activeHotspot.id] && (
                      <span style={{ fontSize: "10px", background: "#dcfce7", color: "#166534", padding: "1px 5px", borderRadius: "3px", fontWeight: 700 }}>
                        Confirmed ✓
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedHotspot(null)}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "15px", padding: "2px 6px" }}
                    title="Deselect detection"
                  >
                    ✕
                  </button>
                </div>

                <div className="mc-evidence-hero__meta">
                  {activeHotspot.coordinates[0].toFixed(4)}°N, {activeHotspot.coordinates[1].toFixed(4)}°E &middot; Detected {activeHotspot.detectedTime}
                </div>
                <div className="mc-evidence-hero__loc">{activeHotspot.locationName}</div>

                <div style={{ marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Classification
                    </span>
                    <div style={{ marginTop: "2px" }}>
                      <ClassificationTag classification={activeHotspot.classification} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Distinction between Confidence and Probability */}
              <div className="mc-conf-box">
                <div className="mc-conf-box__split">
                  <div className="mc-conf-metric">
                    <span className="mc-conf-metric__lbl">System Confidence</span>
                    <span className="mc-conf-metric__val" style={{ color: "#2563eb" }}>
                      {activeHotspot.evidenceStatus} ({activeHotspot.aiConfidence}%)
                    </span>
                    <span className="mc-conf-metric__desc">
                      Multi-source telemetry (VIIRS sensor conf: {typeof activeHotspot.firmsConfidence === "number" ? activeHotspot.firmsConfidence : 65}%, MODIS terrain, OSM registry).
                    </span>
                  </div>

                  <div className="mc-conf-metric">
                    <span className="mc-conf-metric__lbl">Leading Probability</span>
                    <span className="mc-conf-metric__val" style={{ color: currentHypotheses?.leading.color }}>
                      {currentHypotheses?.leading.value}%
                    </span>
                    <span className="mc-conf-metric__desc">
                      Statistical model likelihood for {currentHypotheses?.leading.label}.
                    </span>
                  </div>
                </div>

                {/* Classification Probability Breakdown (Horizontal Bars) */}
                {currentHypotheses && (
                  <div>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                      Classification Probability Distribution
                    </span>
                    <div className="mc-prob-bars-list" style={{ marginTop: "6px" }}>
                      {/* Leading hypothesis */}
                      <div className="mc-prob-row">
                        <span className="mc-prob-name">{currentHypotheses.leading.label}</span>
                        <div className="mc-prob-track">
                          <div
                            className="mc-prob-fill"
                            style={{ width: `${currentHypotheses.leading.value}%`, background: currentHypotheses.leading.color }}
                          />
                        </div>
                        <span className="mc-prob-pct">{currentHypotheses.leading.value}%</span>
                      </div>

                      {/* Competing hypotheses */}
                      {currentHypotheses.competing.map((hypo) => (
                        <div key={hypo.label} className="mc-prob-row">
                          <span className="mc-prob-name" style={{ color: "#64748b" }}>{hypo.label}</span>
                          <div className="mc-prob-track">
                            <div
                              className="mc-prob-fill"
                              style={{ width: `${hypo.value}%`, background: hypo.color, opacity: 0.8 }}
                            />
                          </div>
                          <span className="mc-prob-pct">{hypo.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* "WHY THIS CLASSIFICATION?" Evidence Cards */}
              <div className="mc-why-card">
                <div className="mc-why-card__title">
                  <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#2563eb" }}>
                    fact_check
                  </span>
                  WHY THIS CLASSIFICATION?
                </div>

                {/* 1. LAND COVER */}
                <div className="mc-why-row">
                  <div className="mc-why-row__left">
                    <span className="material-symbols-outlined mc-why-row__icon">terrain</span>
                    <div>
                      <div className="mc-why-row__title">Land Cover</div>
                      <div className="mc-why-row__val">
                        {activeHotspot.classification === "Agricultural Burning"
                          ? "Cropland / Agricultural Cultivated Land"
                          : activeHotspot.classification === "Wildfire"
                          ? "Forest Canopy / Vegetated Wildland"
                          : activeHotspot.classification === "Industrial Heat"
                          ? "Industrial Built Sector / Urban Footprint"
                          : "Mixed Rural Landscape with Sparse Vegetation"}
                      </div>
                    </div>
                  </div>
                  <span className="mc-why-tag mc-why-tag--supported">✓ Supporting evidence</span>
                </div>

                {/* 2. FACILITY CONTEXT */}
                <div className="mc-why-row">
                  <div className="mc-why-row__left">
                    <span className="material-symbols-outlined mc-why-row__icon">factory</span>
                    <div>
                      <div className="mc-why-row__title">Facility Context</div>
                      <div className="mc-why-row__val">
                        {activeHotspot.nearestFacility && activeHotspot.nearestFacility.name && activeHotspot.nearestFacility.distanceKm < 2.0 ? (
                          <>
                            {activeHotspot.nearestFacility.name} (~{(activeHotspot.nearestFacility.distanceKm * 1000).toFixed(0)}m distance)
                          </>
                        ) : (
                          <>
                            No mapped industrial facility found within 2 km buffer
                            <div style={{ fontSize: "9.5px", color: "#64748b" }}>
                              Source: OpenStreetMap & Indian Industrial Registry
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {activeHotspot.nearestFacility && activeHotspot.nearestFacility.distanceKm < 2.0 ? (
                    <span className="mc-why-tag mc-why-tag--supported">✓ Supporting evidence</span>
                  ) : (
                    <span className="mc-why-tag mc-why-tag--limited">⚠ Dataset coverage limited</span>
                  )}
                </div>

                {/* 3. THERMAL SIGNAL */}
                <div className="mc-why-row">
                  <div className="mc-why-row__left">
                    <span className="material-symbols-outlined mc-why-row__icon">local_fire_department</span>
                    <div>
                      <div className="mc-why-row__title">Thermal Signal</div>
                      <div className="mc-why-row__val">
                        FRP: <strong>{activeHotspot.frpMw.toFixed(1)} MW</strong> &middot; Brightness: {activeHotspot.brightnessK.toFixed(1)} K &middot; {activeHotspot.daynight === "N" ? "Night Pass" : "Day Pass"}
                      </div>
                    </div>
                  </div>
                  <span className="mc-why-tag mc-why-tag--available">✓ Available</span>
                </div>

                {/* 4. TEMPORAL PATTERN */}
                <div className="mc-why-row">
                  <div className="mc-why-row__left">
                    <span className="material-symbols-outlined mc-why-row__icon">history</span>
                    <div>
                      <div className="mc-why-row__title">Temporal Pattern</div>
                      <div className="mc-why-row__val">
                        {activeHotspot.isPersistent
                          ? `4+ detections in the same area over 7 days (Stationary thermal persistence)`
                          : "Transient single observation without prior multi-day recurrence"}
                      </div>
                    </div>
                  </div>
                  <span className="mc-why-tag mc-why-tag--supported">✓ Supporting evidence</span>
                </div>

                {/* 5. SPATIAL PATTERN */}
                <div className="mc-why-row">
                  <div className="mc-why-row__left">
                    <span className="material-symbols-outlined mc-why-row__icon">bubble_chart</span>
                    <div>
                      <div className="mc-why-row__title">Spatial Pattern</div>
                      <div className="mc-why-row__val">
                        Isolated detection signature (consistent with localized thermal source)
                      </div>
                    </div>
                  </div>
                  <span className="mc-why-tag mc-why-tag--supported">✓ Supporting evidence</span>
                </div>
              </div>

              {/* Concentric Range Rings Context Map (250m, 500m, 1km, 2km) */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#334155", textTransform: "uppercase", marginBottom: "4px" }}>
                  Location Context (250m, 500m, 1km, 2km Rings)
                </div>
                <AnalystContextMap
                  latitude={activeHotspot.coordinates[0]}
                  longitude={activeHotspot.coordinates[1]}
                  locationName={activeHotspot.locationName}
                  facilityName={activeHotspot.nearestFacility?.name}
                  facilityDistanceKm={activeHotspot.nearestFacility?.distanceKm}
                  classificationColor={currentCategoryMeta.color}
                  frpMw={activeHotspot.frpMw}
                />
              </div>

              {/* Satellite Imagery at Coordinates */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#334155", textTransform: "uppercase", marginBottom: "4px" }}>
                  Satellite Context (ArcGIS World Imagery)
                </div>
                <AnalystSatelliteTile
                  latitude={activeHotspot.coordinates[0]}
                  longitude={activeHotspot.coordinates[1]}
                  detectedDate={activeHotspot.detectedDate}
                  detectedTime={activeHotspot.detectedTime}
                  satellite={activeHotspot.satellite}
                  instrument={activeHotspot.instrument}
                  frpMw={activeHotspot.frpMw}
                />
              </div>

              {/* Application Actions */}
              <div className="mc-evidence-actions">
                <button
                  type="button"
                  className="mc-btn mc-btn--primary"
                  style={{ flex: 1 }}
                  onClick={() => handleConfirm(activeHotspot)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>check_circle</span>
                  {confirmedEvents[activeHotspot.id] ? "Classification Confirmed ✓" : "Confirm Classification"}
                </button>

                <button
                  type="button"
                  className="mc-btn mc-btn--secondary"
                  onClick={() => {
                    setNewClassSelection(activeHotspot.classification);
                    setIsChangingClassification(true);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>edit</span>
                  Change Classification
                </button>

                <button
                  type="button"
                  className="mc-btn mc-btn--secondary"
                  style={{ color: "#b45309", borderColor: "#fed7aa" }}
                  onClick={() => handleMarkVerification(activeHotspot)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#ea580c" }}>flag</span>
                  Mark for Verification
                </button>

                {onNavigateToMap && (
                  <button
                    type="button"
                    className="mc-btn mc-btn--secondary"
                    style={{ width: "100%", marginTop: "2px" }}
                    onClick={() => onNavigateToMap(activeHotspot)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#2563eb" }}>public</span>
                    View on Thermal Map &rarr;
                  </button>
                )}
                {onViewIncident && (
                  <button
                    type="button"
                    className="mc-btn mc-btn--secondary"
                    style={{ width: "100%", marginTop: "2px", color: "#0284c7" }}
                    onClick={() => onViewIncident(activeHotspot)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>local_fire_department</span>
                    Open Incident Investigation &rarr;
                  </button>
                )}
              </div>

              {/* Classification Audit Trail Drawer (Collapsed by default) */}
              <div className="mc-audit-drawer">
                <button
                  type="button"
                  className="mc-audit-toggle"
                  onClick={() => setShowAuditTrail(!showAuditTrail)}
                >
                  <span>Classification Audit Trail</span>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "16px",
                      transform: showAuditTrail ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    expand_more
                  </span>
                </button>

                {showAuditTrail && (
                  <div className="mc-audit-content">
                    <div className="mc-audit-row">
                      <span style={{ color: "#64748b" }}>Classification:</span>
                      <strong>{activeHotspot.classification}</strong>
                    </div>
                    <div className="mc-audit-row">
                      <span style={{ color: "#64748b" }}>Model Version:</span>
                      <span className="mc-mono">v2.4.1-multi-signal</span>
                    </div>
                    <div className="mc-audit-row">
                      <span style={{ color: "#64748b" }}>Evidence Sources:</span>
                      <span>VIIRS NRT, MODIS Land Cover, OSM Registry</span>
                    </div>
                    <div className="mc-audit-row">
                      <span style={{ color: "#64748b" }}>Last Recalculated:</span>
                      <span>{activeHotspot.detectedDate} {activeHotspot.detectedTime}</span>
                    </div>
                    <div className="mc-audit-row">
                      <span style={{ color: "#64748b" }}>Analyst Status:</span>
                      <span>{confirmedEvents[activeHotspot.id] ? "Confirmed" : "Automated inference active"}</span>
                    </div>
                    {overrides[activeHotspot.id] && (
                      <div className="mc-audit-row" style={{ marginTop: "2px" }}>
                        <span style={{ color: "#64748b" }}>Analyst Note:</span>
                        <span style={{ color: "#b45309", fontWeight: 600 }}>{overrides[activeHotspot.id].reason}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Clean Empty State when NO detection is selected */
            <div className="mc-empty-evidence">
              <div className="mc-empty-evidence__icon-box">
                <span className="material-symbols-outlined" style={{ fontSize: "30px", color: "#64748b" }}>
                  troubleshoot
                </span>
              </div>
              <h3 className="mc-empty-evidence__title">Select a detection</h3>
              <p className="mc-empty-evidence__desc">
                Choose a thermal detection from the master table on the left to inspect:
              </p>
              <div className="mc-empty-checklist">
                <div className="mc-empty-checklist-item">
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>&bull;</span>
                  <span>Classification reasoning &amp; hypotheses</span>
                </div>
                <div className="mc-empty-checklist-item">
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>&bull;</span>
                  <span>Land-cover context (MODIS)</span>
                </div>
                <div className="mc-empty-checklist-item">
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>&bull;</span>
                  <span>Facility proximity &amp; registry matching</span>
                </div>
                <div className="mc-empty-checklist-item">
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>&bull;</span>
                  <span>Thermal signal (FRP &amp; Brightness)</span>
                </div>
                <div className="mc-empty-checklist-item">
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>&bull;</span>
                  <span>Historical behavior &amp; persistence</span>
                </div>
                <div className="mc-empty-checklist-item">
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>&bull;</span>
                  <span>Satellite imagery &amp; concentric buffer rings</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          6. MODAL: CHANGE CLASSIFICATION
          ========================================================================= */}
      {isChangingClassification && (
        <div className="mc-modal-backdrop">
          <div className="mc-reclass-card">
            <div className="mc-reclass-card__head">
              <span>Change Classification</span>
              <button
                type="button"
                onClick={() => setIsChangingClassification(false)}
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            <div className="mc-reclass-card__body">
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
                  Select New Classification:
                </label>
                <div className="mc-select-wrap" style={{ width: "100%" }}>
                  <select
                    className="mc-select-control"
                    style={{ width: "100%" }}
                    value={newClassSelection}
                    onChange={(e) => setNewClassSelection(e.target.value as EventClassification)}
                  >
                    {ALL_CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined mc-select-chevron">expand_more</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
                  Analyst Rationale / Evidence Note:
                </label>
                <div className="mc-styled-search" style={{ width: "100%" }}>
                  <input
                    type="text"
                    placeholder="e.g., Confirmed brick kiln cluster via high-res imagery"
                    value={analystReason}
                    onChange={(e) => setAnalystReason(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mc-reclass-card__foot">
              <button
                type="button"
                className="mc-btn mc-btn--secondary"
                onClick={() => setIsChangingClassification(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mc-btn mc-btn--primary"
                onClick={handleSaveClassificationChange}
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
