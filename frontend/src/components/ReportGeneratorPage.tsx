import React, { useMemo, useState } from "react";
import { Hotspot } from "../types";

export interface ReportGeneratorPageProps {
  hotspots: Hotspot[];
  onSelectHotspot: (hotspot: Hotspot) => void;
  onNavigateToMap: () => void;
}

type ReportType = "executive" | "handover" | "compliance" | "critical_breach";

export const ReportGeneratorPage: React.FC<ReportGeneratorPageProps> = ({
  hotspots,
  onSelectHotspot,
  onNavigateToMap,
}) => {
  const [reportType, setReportType] = useState<ReportType>("executive");
  const [timeWindow, setTimeWindow] = useState<string>("24h");
  const [minRiskThreshold, setMinRiskThreshold] = useState<number>(40);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [inspectorName, setInspectorName] = useState<string>("Duty Officer - GIS Operations");
  const [customNotes, setCustomNotes] = useState<string>(
    "Automated thermal satellite surveillance pass verified against OpenStreetMap industrial layers. High-risk detections flagged for ground thermal verification and facility dispatch."
  );

  // Generate unique report ID
  const reportId = useMemo(() => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `THERMAL-REP-${dateStr}-IND-0903`;
  }, []);

  const generatedTimeStr = useMemo(() => {
    return new Date().toUTCString();
  }, []);

  // Filtered hotspots for this report
  const reportHotspots = useMemo(() => {
    return hotspots.filter((h) => {
      const risk = h.risk_score ?? (h.risk?.score ?? 30);
      if (risk < minRiskThreshold) return false;

      if (sourceFilter !== "all") {
        const cls = (h.classification || "").toLowerCase();
        if (sourceFilter === "industrial" && !cls.includes("industrial") && !cls.includes("flare") && !cls.includes("furnace")) {
          return false;
        }
        if (sourceFilter === "wildfire" && !cls.includes("wildfire") && !cls.includes("forest")) {
          return false;
        }
        if (sourceFilter === "agricultural" && !cls.includes("agri") && !cls.includes("stubble") && !cls.includes("crop")) {
          return false;
        }
      }

      return true;
    });
  }, [hotspots, minRiskThreshold, sourceFilter]);

  // Aggregate Metrics for Executive Summary
  const totalAnalyzed = hotspots.length;
  const filteredCount = reportHotspots.length;
  const criticalCount = reportHotspots.filter(
    (h) => (h.risk_score ?? (h.risk?.score ?? 0)) >= 80
  ).length;
  const highCount = reportHotspots.filter((h) => {
    const r = h.risk_score ?? (h.risk?.score ?? 0);
    return r >= 60 && r < 80;
  }).length;

  const totalFrp = Math.round(
    reportHotspots.reduce((sum, h) => sum + (h.frp || 0), 0) * 10
  ) / 10;
  const maxFrp = Math.round(
    reportHotspots.reduce((max, h) => Math.max(max, h.frp || 0), 0) * 10
  ) / 10;

  // Top Critical Detections
  const topIncidents = useMemo(() => {
    return [...reportHotspots]
      .sort((a, b) => (b.risk_score ?? (b.risk?.score ?? 0)) - (a.risk_score ?? (a.risk?.score ?? 0)))
      .slice(0, 5);
  }, [reportHotspots]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      "Hotspot_ID",
      "Classification",
      "Latitude",
      "Longitude",
      "FRP_MW",
      "Brightness_K",
      "Confidence_Pct",
      "Risk_Score",
      "Risk_Level",
      "Nearest_Facility",
      "Nearest_Settlement",
      "Detected_At",
    ];

    const rows = reportHotspots.map((h) => [
      `"${h.id}"`,
      `"${h.classification}"`,
      h.latitude,
      h.longitude,
      h.frp ?? 0,
      h.brightness,
      h.confidence,
      h.risk_score ?? (h.risk?.score ?? 0),
      `"${h.risk_level ?? h.risk?.level ?? "LOW"}"`,
      `"${h.nearest_facility || ""}"`,
      `"${h.nearest_settlement || ""}"`,
      `"${h.detected_at || h.timestamp || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportGeoJson = () => {
    const geojson = {
      type: "FeatureCollection",
      report_id: reportId,
      generated_at: generatedTimeStr,
      report_type: reportType,
      features: reportHotspots.map((h) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [h.longitude, h.latitude],
        },
        properties: {
          id: h.id,
          classification: h.classification,
          frp: h.frp,
          brightness: h.brightness,
          confidence: h.confidence,
          risk_score: h.risk_score,
          risk_level: h.risk_level,
          nearest_facility: h.nearest_facility,
          nearest_settlement: h.nearest_settlement,
          detected_at: h.detected_at,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportId}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stitch-report-page">
      {/* Top Banner */}
      <div className="stitch-sub-header">
        <div className="stitch-sub-header__title-area">
          <div className="stitch-tag">MISSION-CRITICAL BRIEFING</div>
          <h1 className="stitch-title">Incident &amp; Operational Reports</h1>
          <p className="stitch-subtitle">
            Configure, generate, and export official thermal monitoring dossiers, executive summaries, and compliance logs ready for command briefing or field dispatch.
          </p>
        </div>

        <div className="stitch-report-header-actions no-print">
          <button
            type="button"
            className="stitch-btn stitch-btn--primary"
            onClick={handlePrint}
          >
            <span className="material-symbols-outlined">print</span>
            <span>Print / Save PDF</span>
          </button>
          <button
            type="button"
            className="stitch-btn stitch-btn--secondary"
            onClick={handleExportCsv}
          >
            <span className="material-symbols-outlined">table_view</span>
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="stitch-btn stitch-btn--secondary"
            onClick={handleExportGeoJson}
          >
            <span className="material-symbols-outlined">download</span>
            <span>Export GeoJSON</span>
          </button>
        </div>
      </div>

      <div className="stitch-report-layout">
        {/* Left Side: Report Configuration Drawer (Hidden when printing) */}
        <aside className="stitch-report-config no-print">
          <div className="stitch-config-panel">
            <h3 className="stitch-config-panel__title">
              <span className="material-symbols-outlined">tune</span>
              <span>Report Parameters</span>
            </h3>

            {/* Report Type */}
            <div className="stitch-field">
              <label className="stitch-field__label">Report Dossier Type</label>
              <select
                className="stitch-field__select"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
              >
                <option value="executive">Executive Thermal Threat Briefing</option>
                <option value="handover">Operations Shift Handover Log</option>
                <option value="compliance">Environmental Compliance Dossier</option>
                <option value="critical_breach">Critical Thermal Breach Incident File</option>
              </select>
            </div>

            {/* Minimum Risk Threshold */}
            <div className="stitch-field">
              <label className="stitch-field__label">
                Minimum Risk Tier: <strong>≥ {minRiskThreshold}/100</strong>
              </label>
              <div className="stitch-risk-tier-select">
                <button
                  type="button"
                  className={`stitch-tier-btn ${minRiskThreshold === 0 ? "is-active" : ""}`}
                  onClick={() => setMinRiskThreshold(0)}
                >
                  All (0+)
                </button>
                <button
                  type="button"
                  className={`stitch-tier-btn ${minRiskThreshold === 40 ? "is-active" : ""}`}
                  onClick={() => setMinRiskThreshold(40)}
                >
                  Mod (40+)
                </button>
                <button
                  type="button"
                  className={`stitch-tier-btn ${minRiskThreshold === 60 ? "is-active" : ""}`}
                  onClick={() => setMinRiskThreshold(60)}
                >
                  High (60+)
                </button>
                <button
                  type="button"
                  className={`stitch-tier-btn ${minRiskThreshold === 80 ? "is-active" : ""}`}
                  onClick={() => setMinRiskThreshold(80)}
                >
                  Crit (80+)
                </button>
              </div>
            </div>

            {/* Source Classification Filter */}
            <div className="stitch-field">
              <label className="stitch-field__label">Thermal Source Filter</label>
              <select
                className="stitch-field__select"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">All Classification Sources</option>
                <option value="industrial">Industrial Flares &amp; Facilities Only</option>
                <option value="wildfire">Vegetation &amp; Forest Wildfires Only</option>
                <option value="agricultural">Agricultural Stubble Fires Only</option>
              </select>
            </div>

            {/* Time Window */}
            <div className="stitch-field">
              <label className="stitch-field__label">Surveillance Window</label>
              <select
                className="stitch-field__select"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
              >
                <option value="24h">Last 24 Hours (Real-Time NRT)</option>
                <option value="3d">Last 3 Days (Multi-Pass)</option>
                <option value="7d">Last 7 Days (Persistent Trend)</option>
                <option value="all">All Available Historical Passes</option>
              </select>
            </div>

            {/* Officer Name */}
            <div className="stitch-field">
              <label className="stitch-field__label">Authorizing Officer</label>
              <input
                type="text"
                className="stitch-field__input"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
              />
            </div>

            {/* Custom Notes */}
            <div className="stitch-field">
              <label className="stitch-field__label">Operational Notes</label>
              <textarea
                className="stitch-field__textarea"
                rows={4}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
              />
            </div>
          </div>
        </aside>

        {/* Right Side: Rendered Printable Report Document */}
        <div className="stitch-report-document-wrap">
          <div className="stitch-report-document" id="printable-report">
            {/* Formal Report Header */}
            <header className="stitch-doc-header">
              <div className="stitch-doc-header__top">
                <div className="stitch-doc-logo">
                  <span className="material-symbols-outlined stitch-doc-icon">local_fire_department</span>
                  <div>
                    <h2 className="stitch-doc-title">AGNI NETRA</h2>
                    <span className="stitch-doc-subtitle">THERMAL INTELLIGENCE &amp; DETECTION PLATFORM</span>
                  </div>
                </div>

                <div className="stitch-doc-meta">
                  <div className="data-mono font-bold text-primary">{reportId}</div>
                  <div className="stitch-doc-badge">OFFICIAL // COMMAND USE ONLY</div>
                  <div className="data-mono text-dim text-sm">ISSUED: {generatedTimeStr}</div>
                </div>
              </div>

              <div className="stitch-doc-title-banner">
                <h1>
                  {reportType === "executive"
                    ? "EXECUTIVE THERMAL THREAT BRIEFING"
                    : reportType === "handover"
                    ? "OPERATIONS SHIFT HANDOVER DOSSIER"
                    : reportType === "compliance"
                    ? "ENVIRONMENTAL COMPLIANCE & FLARING DOSSIER"
                    : "CRITICAL THERMAL BREACH INVESTIGATION FILE"}
                </h1>
                <div className="stitch-doc-scope">
                  <span>REGION: STRICTLY INDIA GEOGRAPHIC VIEWPORT</span>
                  <span>·</span>
                  <span>SENSOR: NASA VIIRS NRT (SUOMI-NPP &amp; NOAA-20)</span>
                  <span>·</span>
                  <span>WINDOW: {timeWindow.toUpperCase()}</span>
                </div>
              </div>
            </header>

            {/* Executive Threat Summary */}
            <section className="stitch-doc-section">
              <h3 className="stitch-doc-section__title">
                <span className="material-symbols-outlined">shield</span>
                <span>1. Executive Threat Summary</span>
              </h3>

              <div className="stitch-doc-metrics-grid">
                <div className="stitch-doc-metric">
                  <span className="stitch-doc-metric__label">TOTAL HOTSPOTS</span>
                  <span className="stitch-doc-metric__val data-mono">{totalAnalyzed}</span>
                  <span className="stitch-doc-metric__sub">Satellite passes evaluated</span>
                </div>

                <div className="stitch-doc-metric">
                  <span className="stitch-doc-metric__label">QUALIFIED IN REPORT</span>
                  <span className="stitch-doc-metric__val data-mono text-primary">
                    {filteredCount}
                  </span>
                  <span className="stitch-doc-metric__sub">Risk ≥ {minRiskThreshold}/100</span>
                </div>

                <div className="stitch-doc-metric">
                  <span className="stitch-doc-metric__label">CRITICAL BREACHES</span>
                  <span className="stitch-doc-metric__val data-mono text-danger">
                    {criticalCount}
                  </span>
                  <span className="stitch-doc-metric__sub">Score ≥ 80 (Dispatch required)</span>
                </div>

                <div className="stitch-doc-metric">
                  <span className="stitch-doc-metric__label">HIGH PRIORITY THREATS</span>
                  <span className="stitch-doc-metric__val data-mono text-warning">
                    {highCount}
                  </span>
                  <span className="stitch-doc-metric__sub">Score 60–79 (Urgent monitor)</span>
                </div>

                <div className="stitch-doc-metric">
                  <span className="stitch-doc-metric__label">TOTAL RADIATIVE POWER</span>
                  <span className="stitch-doc-metric__val data-mono">
                    {totalFrp.toLocaleString()} MW
                  </span>
                  <span className="stitch-doc-metric__sub">Cumulative heat output</span>
                </div>

                <div className="stitch-doc-metric">
                  <span className="stitch-doc-metric__label">PEAK SINGLE FRP</span>
                  <span className="stitch-doc-metric__val data-mono text-danger">
                    {maxFrp} MW
                  </span>
                  <span className="stitch-doc-metric__sub">Highest intensity anomaly</span>
                </div>
              </div>

              <div className="stitch-doc-narrative">
                <p>
                  During the current surveillance window, automated telemetry engines ingested{" "}
                  <strong>{totalAnalyzed}</strong> thermal anomalies across the India geographic region. Spatial GIS polygon enrichment with OpenStreetMap and historical baseline modeling isolated{" "}
                  <strong>{filteredCount}</strong> hotspots meeting or exceeding the operational threat threshold.
                </p>
                <p>
                  Of these, <strong>{criticalCount}</strong> events have been classified as <strong>CRITICAL</strong> risk, driven by high radiative intensity deviations ($&gt;2.5\times$ historical baseline), rapid spatial expansion, or immediate proximity to inhabited settlements or critical industrial infrastructure.
                </p>
              </div>
            </section>

            {/* Top Priority Incident Dossiers */}
            <section className="stitch-doc-section">
              <h3 className="stitch-doc-section__title">
                <span className="material-symbols-outlined">warning</span>
                <span>2. High-Priority Threat Register</span>
              </h3>

              {topIncidents.length === 0 ? (
                <div className="stitch-doc-empty">
                  No hotspots currently exceed the selected risk threshold ({minRiskThreshold}/100).
                </div>
              ) : (
                <div className="stitch-doc-incident-cards">
                  {topIncidents.map((h, idx) => {
                    const risk = h.risk_score ?? (h.risk?.score ?? 35);
                    const riskLevel = h.risk_level ?? (h.risk?.level ?? "LOW");
                    const isCrit = risk >= 80;

                    return (
                      <div
                        key={h.id}
                        className={`stitch-doc-incident-card ${isCrit ? "is-critical" : ""}`}
                      >
                        <div className="stitch-doc-incident-card__header">
                          <div className="flex items-center gap-2">
                            <span className="stitch-incident-num">#{idx + 1}</span>
                            <span className="data-mono font-bold text-primary">
                              {h.id.slice(0, 14)}
                            </span>
                            <span className="stitch-doc-pill">{h.classification}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`stitch-mini-pill ${
                                isCrit
                                  ? "stitch-risk--critical"
                                  : "stitch-risk--high"
                              }`}
                            >
                              {risk}/100 {riskLevel}
                            </span>
                            <button
                              type="button"
                              className="stitch-mini-action-btn no-print"
                              onClick={() => {
                                onSelectHotspot(h);
                                onNavigateToMap();
                              }}
                            >
                              <span className="material-symbols-outlined">map</span>
                              <span>View Map</span>
                            </button>
                          </div>
                        </div>

                        <div className="stitch-doc-incident-card__body">
                          <div className="stitch-doc-grid-cols">
                            <div>
                              <div className="stitch-doc-label">COORDINATES</div>
                              <div className="data-mono">
                                {h.latitude.toFixed(4)}°N, {h.longitude.toFixed(4)}°E
                              </div>
                            </div>
                            <div>
                              <div className="stitch-doc-label">FRP RADIATIVE POWER</div>
                              <div className="data-mono text-warning font-bold">
                                {h.frp ? `${h.frp.toFixed(1)} MW` : "N/A"}
                              </div>
                            </div>
                            <div>
                              <div className="stitch-doc-label">BRIGHTNESS TEMP</div>
                              <div className="data-mono">{h.brightness.toFixed(1)} K</div>
                            </div>
                            <div>
                              <div className="stitch-doc-label">SENSOR CONFIDENCE</div>
                              <div className="data-mono">{h.confidence}%</div>
                            </div>
                            <div>
                              <div className="stitch-doc-label">NEAREST INFRASTRUCTURE</div>
                              <div className="text-truncate">
                                {h.nearest_facility || "Unmarked Industrial Cell"}
                              </div>
                            </div>
                            <div>
                              <div className="stitch-doc-label">SETTLEMENT PROXIMITY</div>
                              <div className="text-truncate">
                                {h.nearest_settlement || "Rural Outskirts"}
                              </div>
                            </div>
                          </div>

                          {h.risk?.drivers && h.risk.drivers.length > 0 && (
                            <div className="stitch-doc-drivers">
                              <span className="stitch-doc-label">PRIMARY RISK DRIVERS:</span>
                              <ul>
                                {h.risk.drivers.slice(0, 3).map((driver, dIdx) => (
                                  <li key={dIdx}>{driver}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Tabular Register of Qualified Detections */}
            <section className="stitch-doc-section">
              <h3 className="stitch-doc-section__title">
                <span className="material-symbols-outlined">list_alt</span>
                <span>3. Qualified Incident Register ({reportHotspots.length} Events)</span>
              </h3>

              <div className="stitch-doc-table-wrap">
                <table className="stitch-data-table stitch-data-table--compact">
                  <thead>
                    <tr>
                      <th>HOTSPOT ID</th>
                      <th>LOCATION</th>
                      <th>CLASSIFICATION</th>
                      <th>FRP</th>
                      <th>TEMP</th>
                      <th>CONF</th>
                      <th>RISK</th>
                      <th>FACILITY / SETTLEMENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportHotspots.slice(0, 25).map((h) => {
                      const r = h.risk_score ?? (h.risk?.score ?? 30);
                      return (
                        <tr key={h.id}>
                          <td className="data-mono font-bold text-primary">
                            {h.id.slice(0, 10)}
                          </td>
                          <td className="data-mono">
                            {h.latitude.toFixed(2)}°, {h.longitude.toFixed(2)}°
                          </td>
                          <td>{h.classification}</td>
                          <td className="data-mono text-warning">
                            {h.frp ? `${h.frp.toFixed(1)} MW` : "—"}
                          </td>
                          <td className="data-mono">{h.brightness.toFixed(0)} K</td>
                          <td className="data-mono">{h.confidence}%</td>
                          <td>
                            <span
                              className={`stitch-mini-pill ${
                                r >= 80
                                  ? "stitch-risk--critical"
                                  : r >= 60
                                  ? "stitch-risk--high"
                                  : r >= 40
                                  ? "stitch-risk--moderate"
                                  : "stitch-risk--low"
                              }`}
                            >
                              {r}
                            </span>
                          </td>
                          <td className="text-truncate">
                            {h.nearest_facility || h.nearest_settlement || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {reportHotspots.length > 25 && (
                  <div className="stitch-doc-table-footer">
                    Showing top 25 of {reportHotspots.length} detections in print preview. Use "Export CSV" for the complete dataset.
                  </div>
                )}
              </div>
            </section>

            {/* Officer Sign-off & Notes */}
            <section className="stitch-doc-section stitch-doc-section--signoff">
              <h3 className="stitch-doc-section__title">
                <span className="material-symbols-outlined">approval</span>
                <span>4. Operational Sign-Off &amp; Action Directives</span>
              </h3>

              <div className="stitch-doc-notes-display">
                <strong>OPERATOR DIRECTIVES:</strong>
                <p>{customNotes}</p>
              </div>

              <div className="stitch-doc-signatures">
                <div className="stitch-signature-box">
                  <div className="stitch-sig-line">
                    <span className="data-mono">{inspectorName}</span>
                  </div>
                  <div className="stitch-sig-label">INVESTIGATING OFFICER / OPERATOR</div>
                </div>

                <div className="stitch-signature-box">
                  <div className="stitch-sig-line">
                    <span className="data-mono">COMMAND_VERIFIED_{reportId.slice(-8)}</span>
                  </div>
                  <div className="stitch-sig-label">MISSION DISPATCH AUTHORITY</div>
                </div>

                <div className="stitch-signature-box">
                  <div className="stitch-sig-line">
                    <span className="data-mono">{generatedTimeStr.slice(0, 16)}</span>
                  </div>
                  <div className="stitch-sig-label">TIMESTAMP // SYSTEM LOGGED</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGeneratorPage;
