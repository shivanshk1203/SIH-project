import React from "react";
import { Hotspot } from "../types";

export type NavPage = "map" | "grouping" | "reports" | "facilities";

export interface TopNavProps {
  activePage: NavPage;
  onPageChange: (page: NavPage) => void;
  hotspots: Hotspot[];
  criticalCount: number;
  isAnalyzing: boolean;
  onTriggerAnalyzeAll: () => void;
  onOpenDevDebug: () => void;
  targetCityIndex: number;
  onCityChange: (index: number) => void;
  cities: { name: string; center: [number, number] }[];
}

export const TopNav: React.FC<TopNavProps> = ({
  activePage,
  onPageChange,
  hotspots,
  criticalCount,
  isAnalyzing,
  onTriggerAnalyzeAll,
  onOpenDevDebug,
  targetCityIndex,
  onCityChange,
  cities,
}) => {
  return (
    <header className="stitch-top-nav">
      <div className="stitch-top-nav__brand-group">
        <div className="stitch-top-nav__logo">
          <span className="material-symbols-outlined stitch-logo-icon">radar</span>
          <span className="stitch-brand-title">THERMAL_CORE</span>
        </div>
        <div className="stitch-telemetry-pill">
          <span className="stitch-live-dot" />
          <span className="stitch-telemetry-text">VIIRS NRT · INDIA</span>
        </div>

        <nav className="stitch-nav-links">
          <button
            type="button"
            className={`stitch-nav-link ${activePage === "map" ? "is-active" : ""}`}
            onClick={() => onPageChange("map")}
          >
            <span className="material-symbols-outlined">map</span>
            <span>Live GIS Map</span>
            <span className="stitch-badge stitch-badge--neutral">
              {hotspots.length}
            </span>
          </button>

          <button
            type="button"
            className={`stitch-nav-link ${activePage === "grouping" ? "is-active" : ""}`}
            onClick={() => onPageChange("grouping")}
          >
            <span className="material-symbols-outlined">grid_view</span>
            <span>Hotspot Grouping</span>
            <span className="stitch-badge stitch-badge--accent">
              Clusters
            </span>
          </button>

          <button
            type="button"
            className={`stitch-nav-link ${activePage === "reports" ? "is-active" : ""}`}
            onClick={() => onPageChange("reports")}
          >
            <span className="material-symbols-outlined">description</span>
            <span>Incident Reports</span>
            {criticalCount > 0 ? (
              <span className="stitch-badge stitch-badge--danger">
                {criticalCount} Critical
              </span>
            ) : (
              <span className="stitch-badge stitch-badge--neutral">Ready</span>
            )}
          </button>

          <button
            type="button"
            className={`stitch-nav-link ${activePage === "facilities" ? "is-active" : ""}`}
            onClick={() => onPageChange("facilities")}
          >
            <span className="material-symbols-outlined">factory</span>
            <span>Facility Status</span>
          </button>
        </nav>
      </div>

      <div className="stitch-top-nav__actions">
        {/* Quick Region Switcher */}
        <div className="stitch-region-select-wrap">
          <span className="material-symbols-outlined stitch-region-icon">my_location</span>
          <select
            className="stitch-region-select"
            value={targetCityIndex}
            onChange={(e) => onCityChange(parseInt(e.target.value, 10))}
            title="Focus Geographic Region"
          >
            {cities.map((city, idx) => (
              <option key={city.name} value={idx}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        {/* 15-Phase Batch Analysis Trigger */}
        <button
          type="button"
          className="stitch-btn stitch-btn--primary"
          onClick={onTriggerAnalyzeAll}
          disabled={isAnalyzing || hotspots.length === 0}
          title="Run 15-phase ML verification & risk engine on all hotspots"
        >
          <span className="material-symbols-outlined">
            {isAnalyzing ? "sync" : "bolt"}
          </span>
          <span>{isAnalyzing ? "Analyzing..." : "Analyze All"}</span>
        </button>

        {/* Diagnostics Modal Toggle */}
        <button
          type="button"
          className="stitch-btn stitch-btn--ghost"
          onClick={onOpenDevDebug}
          title="Open Telemetry Diagnostics HUD"
        >
          <span className="material-symbols-outlined">terminal</span>
          <span className="hide-mobile">Telemetry HUD</span>
        </button>
      </div>
    </header>
  );
};

export default TopNav;
