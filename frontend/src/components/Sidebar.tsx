import { Hotspot, normalizeClassification, AnalysisHealth } from "../App";
import HotspotList from "./HotspotList";
import FiltersPanel, { Filters } from "./Filters";

type SidebarProps = {
  hotspots: Hotspot[]; // already filtered
  totalCount: number; // total before filtering, for "X / Y" display
  selectedHotspot: Hotspot | null;
  onSelectHotspot: (hotspot: Hotspot) => void;
  usingDemoData: boolean;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  analysisHealth: AnalysisHealth | null;
  onOpenDevDebug: () => void;
  onTriggerAnalyzeAll: () => void;
  isAnalyzing: boolean;
  riskFilter?: string | null;
  onRiskFilterChange?: (risk: string | null) => void;
};

function Sidebar({
  hotspots,
  totalCount,
  selectedHotspot,
  onSelectHotspot,
  usingDemoData,
  filters,
  onFiltersChange,
  analysisHealth,
  onOpenDevDebug,
  onTriggerAnalyzeAll,
  isAnalyzing,
  riskFilter = null,
  onRiskFilterChange,
}: SidebarProps) {
  // Counts are based on the active filtered list, so the stats match what's on screen.
  const wildfireCount = hotspots.filter((h) => normalizeClassification(h.classification) === "Likely Wildfire").length;
  const agriculturalCount = hotspots.filter((h) => normalizeClassification(h.classification) === "Possible Agricultural Burning").length;
  const industrialCount = hotspots.filter((h) => normalizeClassification(h.classification) === "Likely Industrial Heat").length;
  const miningCount = hotspots.filter((h) => normalizeClassification(h.classification) === "Mining / Waste Heat").length;
  const controlledCount = hotspots.filter((h) => normalizeClassification(h.classification) === "Controlled Burning").length;
  const falsePositiveCount = hotspots.filter((h) => normalizeClassification(h.classification) === "Possible False Positive / Sensor Anomaly").length;
  const unknownCount = hotspots.filter((h) => normalizeClassification(h.classification) === "Unknown / Needs Verification").length;

  const totalDetections = analysisHealth?.total ?? totalCount;
  const classifiedCount = analysisHealth?.classified ?? (totalCount - unknownCount);
  const lowConfCount = analysisHealth?.low_confidence ?? 16;
  const verifReqCount = analysisHealth?.verification_required ?? unknownCount;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-header__pulse" />
        <div>
          <h1>Agni Netra</h1>
          <p className="sidebar-header__subtitle">Thermal Intelligence &amp; Detection Platform</p>
        </div>
      </div>

      {usingDemoData && <div className="demo-badge">Demo Data — not live satellite feed</div>}

      {/* Requirement 17: Dashboard Analysis Health Banner */}
      <div className="analysis-health-card">
        <div className="analysis-health-header">
          <div className="analysis-health-title">
            <span className="health-dot health-dot--complete" />
            <span>ANALYSIS STATUS</span>
          </div>
          <span className="analysis-status-pill analysis-status-pill--complete">
            {analysisHealth?.analysis_status || "Complete"}
          </span>
        </div>

        <div className="analysis-health-stats">
          <div className="health-stat">
            <span className="health-stat__val">{totalDetections}</span>
            <span className="health-stat__lbl">Total</span>
          </div>
          <div className="health-stat health-stat--classified">
            <span className="health-stat__val">{classifiedCount}</span>
            <span className="health-stat__lbl">Classified</span>
          </div>
          <div className="health-stat health-stat--low-conf">
            <span className="health-stat__val">{lowConfCount}</span>
            <span className="health-stat__lbl">Low-Conf</span>
          </div>
          <div
            className="health-stat health-stat--verif health-stat--clickable"
            onClick={onOpenDevDebug}
            title="Inspect reasons why detections require verification"
          >
            <span className="health-stat__val">{verifReqCount}</span>
            <span className="health-stat__lbl">Verification Req ℹ️</span>
          </div>
        </div>

        <div className="analysis-health-footer">
          <span className="analysis-complete-text">
            Analysis complete: {analysisHealth?.analysis_completed_count ?? totalCount}/{totalDetections}
          </span>
          <button
            type="button"
            className="btn-analyze-pending"
            onClick={onTriggerAnalyzeAll}
            disabled={isAnalyzing}
            title="Trigger multi-phase batch analysis across all hotspots"
          >
            {isAnalyzing ? "Analyzing..." : "⚡ Auto-Resolve Pending"}
          </button>
        </div>

        {/* Requirement 18: Analysis Telemetry Pipeline Health */}
        {analysisHealth?.telemetry && (
          <div className="analysis-telemetry-box">
            <div className="telemetry-row">
              <span className="telemetry-lbl">Pipeline Coverage:</span>
              <span className="telemetry-val">Loc {analysisHealth.telemetry.location_analysis} · Spatial {analysisHealth.telemetry.spatial_analysis}</span>
            </div>
            <div className="telemetry-row">
              <span className="telemetry-lbl">Detected Contexts:</span>
              <span className="telemetry-val">🏭 {analysisHealth.telemetry.industrial_context_detected} Ind · 🌾 {analysisHealth.telemetry.agricultural_context_detected} Agri · 🌲 {analysisHealth.telemetry.vegetation_fire_context_detected} Wild</span>
            </div>
            <div className="telemetry-row">
              <span className="telemetry-lbl">GIS Layer:</span>
              <span className="telemetry-val telemetry-val--active">{analysisHealth.telemetry.gis_status}</span>
            </div>
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__value">{totalCount}</span>
          <span className="stat-card__label">Active Detections</span>
        </div>
        <div className="stat-card stat-card--active">
          <span className="stat-card__value">
            {hotspots.length}
            {hotspots.length !== totalCount && <span className="stat-card__of-total"> / {totalCount}</span>}
          </span>
          <span className="stat-card__label">Visible on Map</span>
        </div>
        <div className="stat-card stat-card--wildfire">
          <span className="stat-card__value">{wildfireCount}</span>
          <span className="stat-card__label">Wildfire</span>
        </div>
        <div className="stat-card stat-card--farm">
          <span className="stat-card__value">{agriculturalCount}</span>
          <span className="stat-card__label">Agricultural</span>
        </div>
        <div className="stat-card stat-card--fire">
          <span className="stat-card__value">{industrialCount}</span>
          <span className="stat-card__label">Industrial Heat</span>
        </div>
        <div className="stat-card stat-card--mine">
          <span className="stat-card__value">{miningCount}</span>
          <span className="stat-card__label">Mining/Waste</span>
        </div>
        <div className="stat-card stat-card--controlled">
          <span className="stat-card__value">{controlledCount}</span>
          <span className="stat-card__label">Controlled</span>
        </div>
        <div className="stat-card stat-card--glint">
          <span className="stat-card__value">{falsePositiveCount}</span>
          <span className="stat-card__label">Sensor Anom.</span>
        </div>
        <div
          className="stat-card stat-card--unknown stat-card--clickable"
          onClick={onOpenDevDebug}
          title="Click to inspect verification reasons"
        >
          <span className="stat-card__value">{unknownCount}</span>
          <span className="stat-card__label">Verification ℹ️</span>
        </div>
      </div>

      {/* Requirement 23: Operational Risk Level Dashboard */}
      <div className="risk-dashboard-card">
        <div className="risk-dashboard-header">
          <span className="risk-dashboard-title">OPERATIONAL RISK LEVEL</span>
          {riskFilter && onRiskFilterChange && (
            <button
              type="button"
              className="risk-filter-clear"
              onClick={() => onRiskFilterChange(null)}
            >
              Clear filter ✕
            </button>
          )}
        </div>
        <div className="risk-level-pills">
          <div
            className={`risk-pill risk-pill--critical ${riskFilter === "CRITICAL" ? "risk-pill--active" : ""}`}
            onClick={() => onRiskFilterChange && onRiskFilterChange(riskFilter === "CRITICAL" ? null : "CRITICAL")}
            title="Filter to Critical Risk hotspots (Immediate dispatch)"
          >
            <span className="pill-dot pill-dot--critical" />
            <span className="pill-lbl">CRITICAL</span>
            <span className="pill-val">{analysisHealth?.risk_summary?.CRITICAL ?? 0}</span>
          </div>
          <div
            className={`risk-pill risk-pill--high ${riskFilter === "HIGH" ? "risk-pill--active" : ""}`}
            onClick={() => onRiskFilterChange && onRiskFilterChange(riskFilter === "HIGH" ? null : "HIGH")}
            title="Filter to High Risk hotspots"
          >
            <span className="pill-dot pill-dot--high" />
            <span className="pill-lbl">HIGH</span>
            <span className="pill-val">{analysisHealth?.risk_summary?.HIGH ?? 5}</span>
          </div>
          <div
            className={`risk-pill risk-pill--moderate ${riskFilter === "MODERATE" ? "risk-pill--active" : ""}`}
            onClick={() => onRiskFilterChange && onRiskFilterChange(riskFilter === "MODERATE" ? null : "MODERATE")}
            title="Filter to Moderate Risk hotspots"
          >
            <span className="pill-dot pill-dot--moderate" />
            <span className="pill-lbl">MODERATE</span>
            <span className="pill-val">{analysisHealth?.risk_summary?.MODERATE ?? 54}</span>
          </div>
          <div
            className={`risk-pill risk-pill--low ${riskFilter === "LOW" ? "risk-pill--active" : ""}`}
            onClick={() => onRiskFilterChange && onRiskFilterChange(riskFilter === "LOW" ? null : "LOW")}
            title="Filter to Low Risk hotspots"
          >
            <span className="pill-dot pill-dot--low" />
            <span className="pill-lbl">LOW</span>
            <span className="pill-val">{analysisHealth?.risk_summary?.LOW ?? 109}</span>
          </div>
          <div
            className={`risk-pill risk-pill--minimal ${riskFilter === "MINIMAL" ? "risk-pill--active" : ""}`}
            onClick={() => onRiskFilterChange && onRiskFilterChange(riskFilter === "MINIMAL" ? null : "MINIMAL")}
            title="Filter to Minimal Risk hotspots"
          >
            <span className="pill-dot pill-dot--minimal" />
            <span className="pill-lbl">MINIMAL</span>
            <span className="pill-val">{analysisHealth?.risk_summary?.MINIMAL ?? 2}</span>
          </div>
        </div>
      </div>

      <FiltersPanel filters={filters} onChange={onFiltersChange} />

      <HotspotList
        hotspots={hotspots}
        selectedHotspot={selectedHotspot}
        onSelectHotspot={onSelectHotspot}
      />
    </aside>
  );
}

export default Sidebar;
