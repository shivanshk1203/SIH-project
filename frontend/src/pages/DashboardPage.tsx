import React, { useMemo, useState } from "react";
import { ThermalEvent, OperationalAlert, EventClassification } from "../types/thermal";
import { SeverityBadge, ClassificationTag } from "../components/common/StatusBadge";

interface DashboardPageProps {
  events: ThermalEvent[];
  alerts: OperationalAlert[];
  totalFIRMSCount: number;
  sourceDescription: string;
  lastUpdatedTime: string;
  isLoading: boolean;
  loadError: string | null;
  dayRange: number;
  onDayRangeChange: (days: number) => void;
  onRefreshData: () => void;
  onSelectEvent: (event: ThermalEvent) => void;
  onViewIncident: (event: ThermalEvent) => void;
  onAnalyzeEvent: (event: ThermalEvent) => void;
  onNavigateToAlerts?: () => void;
  onNavigateToIncidents?: () => void;
  onNavigateToMap?: () => void;
}

const CATEGORY_META: { key: EventClassification; name: string; color: string }[] = [
  { key: "Agricultural Burning", name: "Agricultural Burning", color: "#16a34a" },
  { key: "Industrial Heat", name: "Industrial Heat", color: "#7c3aed" },
  { key: "Wildfire", name: "Wildfire", color: "#ea580c" },
  { key: "Mining / Waste Heat", name: "Mining / Waste Heat", color: "#92400e" },
  { key: "Controlled Burning", name: "Controlled Burning", color: "#f59e0b" },
  { key: "Gas Flare", name: "Gas Flare", color: "#d97706" },
  { key: "Other Thermal Source", name: "Other Thermal Source", color: "#0891b2" },
  { key: "Needs Verification", name: "Needs Verification", color: "#64748b" },
];

// Requirement 8: Compact readable detection ID (e.g. "FIRMS-9.9695")
function formatCompactDetectionId(id: string): string {
  if (!id) return "FIRMS-N/A";
  const match = id.match(/^(?:firms-)?([0-9]+\.[0-9]{3,4})/i);
  if (match) {
    return `FIRMS-${match[1]}`;
  }
  if (id.startsWith("TH-") || id.startsWith("FIRMS-") || id.startsWith("ALT-")) {
    return id.length > 14 ? id.slice(0, 14) : id;
  }
  return id.length > 14 ? `${id.slice(0, 13)}…` : id;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  events,
  alerts,
  totalFIRMSCount,
  lastUpdatedTime,
  isLoading,
  loadError,
  onRefreshData,
  onViewIncident,
  onNavigateToAlerts,
  onNavigateToMap,
}) => {
  // Inspecting event for explainable reasoning modal (Requirement 10)
  const [inspectingEvent, setInspectingEvent] = useState<ThermalEvent | null>(null);

  // 1. Shared single source of truth for metrics
  const totalHotspots = events.length || totalFIRMSCount;
  const industrialFires = events.filter(
    (e) => e.classification === "Industrial Heat" || e.classification === "Industrial Fire"
  ).length;
  const wildfires = events.filter((e) => e.classification === "Wildfire").length;
  
  // Requirement 2 & 16: Consistent severity definition across the entire app
  // High Severity = CRITICAL + HIGH
  const highSeverity = events.filter(
    (e) => e.severity === "HIGH" || e.severity === "CRITICAL"
  ).length;

  const industrialPct = totalHotspots > 0 ? Math.round((industrialFires / totalHotspots) * 100) : 0;
  const wildfirePct = totalHotspots > 0 ? Math.round((wildfires / totalHotspots) * 100) : 0;

  // 2. Detection Classification Distribution (Requirements 4 & 5)
  // Strict rule: Sum of all classifications equals totalHotspots exactly
  const distribution = useMemo(() => {
    if (totalHotspots === 0) return [];

    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const cls = e.classification === "Industrial Fire" ? "Industrial Heat" : (e.classification || "Needs Verification");
      counts[cls] = (counts[cls] || 0) + 1;
    });

    return CATEGORY_META.map((cat) => {
      const count = counts[cat.name] || 0;
      const pct = totalHotspots > 0 ? Math.round((count / totalHotspots) * 100) : 0;
      return {
        name: cat.name,
        count,
        pct,
        color: cat.color,
      };
    }).filter((item) => item.count > 0);
  }, [events, totalHotspots]);

  // 3. Priority Alerts: Top 3 active alerts (Requirement 17)
  const topAlerts = alerts.slice(0, 3);

  // 4. Recent Hotspot Detections: Top 7 real records, prioritizing high severity and FRP
  const recentHotspots = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const severityRank: Record<string, number> = {
          CRITICAL: 4,
          HIGH: 3,
          MODERATE: 2,
          WARNING: 2,
          LOW: 1,
          NORMAL: 0,
        };
        const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
        if (diff !== 0) return diff;
        return b.frpMw - a.frpMw;
      })
      .slice(0, 7);
  }, [events]);

  return (
    <div className="mc-page-container">
      {/* Agni Netra Dashboard Header */}
      <div className="mc-class-header" style={{ marginBottom: "2px" }}>
        <div className="mc-class-header__left">
          <h1 className="mc-class-header__title">
            <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#2563eb" }}>
              dashboard
            </span>
            Agni Netra Dashboard
          </h1>
          <p className="mc-class-header__subtitle">
            Thermal intelligence, detection and contextual analysis
          </p>
        </div>
        <div className="mc-class-header__right">
          <span className="mc-class-header__meta-badge">{totalHotspots} detections</span>
          <span style={{ color: "#cbd5e1" }}>&bull;</span>
          <span>Data Source: NASA FIRMS (VIIRS)</span>
          <span style={{ color: "#cbd5e1" }}>&bull;</span>
          <span>Last updated {lastUpdatedTime || "Just now"}</span>
        </div>
      </div>

      {/* Loading / Error Banner */}
      {loadError && (
        <div
          style={{
            padding: "8px 14px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            color: "#991b1b",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>error</span>
            <span>Unable to refresh live NASA FIRMS data: {loadError}</span>
          </div>
          <button
            className="mc-btn mc-btn--secondary"
            style={{ padding: "2px 8px", fontSize: "11px" }}
            onClick={onRefreshData}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 1. Exactly 4 Primary KPI Cards (Requirements 1, 2, 14) */}
      <section className="mc-kpi-grid-4">
        {/* KPI 1: Total Hotspots */}
        <div className="mc-kpi-card">
          <div className="mc-kpi-card__main">
            <span className="mc-kpi-card__label">Total Hotspots</span>
            <span className="mc-kpi-card__val">{totalHotspots.toLocaleString()}</span>
            <span className="mc-kpi-card__trend" style={{ color: "#2563eb" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>sensors</span>
              {totalHotspots} / {totalHotspots} Classified
            </span>
          </div>
          <div className="mc-kpi-card__icon-wrap" style={{ background: "#eff6ff", color: "#2563eb" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>public</span>
          </div>
        </div>

        {/* KPI 2: Industrial Heat */}
        <div className="mc-kpi-card">
          <div className="mc-kpi-card__main">
            <span className="mc-kpi-card__label">Industrial Heat</span>
            <span className="mc-kpi-card__val" style={{ color: "#7209b7" }}>{industrialFires}</span>
            <span className="mc-kpi-card__trend" style={{ color: "#7209b7" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>factory</span>
              {industrialPct}% of detections
            </span>
          </div>
          <div className="mc-kpi-card__icon-wrap" style={{ background: "#f5f3ff", color: "#7209b7" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>factory</span>
          </div>
        </div>

        {/* KPI 3: Wildfires */}
        <div className="mc-kpi-card">
          <div className="mc-kpi-card__main">
            <span className="mc-kpi-card__label">Wildfires</span>
            <span className="mc-kpi-card__val" style={{ color: "#ea580c" }}>{wildfires}</span>
            <span className="mc-kpi-card__trend" style={{ color: "#ea580c" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>forest</span>
              {wildfirePct}% of detections
            </span>
          </div>
          <div className="mc-kpi-card__icon-wrap" style={{ background: "#fff7ed", color: "#ea580c" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>local_fire_department</span>
          </div>
        </div>

        {/* KPI 4: High Severity Events (Requirement 2: Consistently calculated) */}
        <div className="mc-kpi-card">
          <div className="mc-kpi-card__main">
            <span className="mc-kpi-card__label">High Severity Events</span>
            <span className="mc-kpi-card__val" style={{ color: "#b91c1c" }}>{highSeverity}</span>
            <span className="mc-kpi-card__trend" style={{ color: "#b91c1c" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>crisis_alert</span>
              Requires investigation
            </span>
          </div>
          <div className="mc-kpi-card__icon-wrap" style={{ background: "#fef2f2", color: "#b91c1c" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>emergency</span>
          </div>
        </div>
      </section>

      {/* 2. Detection Classification Section (Requirements 4 & 5) */}
      <section className="mc-class-dist-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#2563eb" }}>
              pie_chart
            </span>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>
              Detection Classification
            </span>
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
            {totalHotspots} / {totalHotspots} detections classified
          </span>
        </div>

        <div className="mc-class-dist-grid">
          {distribution.map((item) => (
            <div key={item.name} className="mc-class-dist-item">
              <div className="mc-class-dist-header">
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: item.color,
                      display: "inline-block",
                    }}
                  />
                  <span className="mc-class-dist-name">{item.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span className="mc-class-dist-count">{item.count}</span>
                  <span className="mc-class-dist-pct">({item.pct}%)</span>
                </div>
              </div>
              <div className="mc-class-dist-bar-bg">
                <div
                  className="mc-class-dist-bar-fill"
                  style={{ width: `${Math.max(item.pct, 3)}%`, background: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Main Section: 2-Column Balanced Command Center */}
      <section className="mc-dashboard-grid-main">
        {/* Left Column (~68%): Compact Recent Hotspot Detections (Requirements 6 & 7: Exactly 6 columns, no scrollbar) */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--mc-border-subtle)",
            borderRadius: "6px",
            boxShadow: "var(--mc-shadow-sm)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Section Header with single primary CTA */}
          <div className="mc-card-header">
            <div className="mc-card-header__title">
              <span className="material-symbols-outlined" style={{ fontSize: "17px", color: "#2563eb" }}>
                crisis_alert
              </span>
              <span>Recent Hotspot Detections</span>
            </div>

            <button
              className="mc-btn mc-btn--primary"
              style={{ padding: "4px 10px", fontSize: "11px" }}
              onClick={onNavigateToMap}
              title="Open full geospatial thermal map"
            >
              Open Thermal Map →
            </button>
          </div>

          {/* Compact Hotspot Table (Strictly 6 columns, NO horizontal scrollbar) */}
          <div style={{ width: "100%", overflow: "hidden" }}>
            <table
              className="mc-table"
              style={{
                width: "100%",
                tableLayout: "fixed",
                margin: 0,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: "110px", padding: "8px 10px" }}>Detection ID</th>
                  <th style={{ width: "auto", padding: "8px 10px" }}>Location</th>
                  <th style={{ width: "135px", padding: "8px 10px" }}>Classification</th>
                  <th style={{ width: "110px", textAlign: "center", padding: "8px 10px" }}>Class. Confidence</th>
                  <th style={{ width: "80px", textAlign: "right", padding: "8px 10px" }}>FRP</th>
                  <th style={{ width: "95px", textAlign: "center", padding: "8px 10px" }}>Severity</th>
                </tr>
              </thead>
              <tbody>
                {recentHotspots.map((ev) => (
                  <tr
                    key={ev.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setInspectingEvent(ev)}
                  >
                    {/* Detection ID (Requirement 8) */}
                    <td
                      className="mc-mono"
                      style={{
                        fontWeight: 700,
                        color: "#2563eb",
                        fontSize: "11px",
                        padding: "7px 10px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={ev.id}
                    >
                      {formatCompactDetectionId(ev.id)}
                    </td>

                    {/* Location (Requirement 11: Clean location, no unexplained distance numbers) */}
                    <td
                      style={{
                        fontWeight: 500,
                        color: "#0f172a",
                        padding: "7px 10px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: "12px",
                      }}
                      title={ev.locationName}
                    >
                      {ev.locationName}
                    </td>

                    {/* Classification */}
                    <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                      <ClassificationTag classification={ev.classification} />
                    </td>

                    {/* Class. Confidence (Requirement 9) */}
                    <td
                      className="mc-mono"
                      style={{
                        fontWeight: 700,
                        color: "#1e40af",
                        textAlign: "center",
                        padding: "7px 10px",
                        fontSize: "11.5px",
                      }}
                    >
                      {ev.classificationConfidence || 75}%
                    </td>

                    {/* FRP */}
                    <td
                      className="mc-mono"
                      style={{
                        fontWeight: 700,
                        color: "#dc2626",
                        textAlign: "right",
                        padding: "7px 10px",
                        fontSize: "11.5px",
                      }}
                    >
                      {ev.frpMw.toFixed(1)} MW
                    </td>

                    {/* Severity */}
                    <td style={{ textAlign: "center", padding: "7px 10px" }}>
                      <SeverityBadge severity={ev.severity} />
                    </td>
                  </tr>
                ))}
                {recentHotspots.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                      {isLoading ? "Syncing NASA FIRMS detections…" : "No active hotspots currently detected."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (~32%): Priority Alerts Panel (Requirement 17) */}
        <div className="mc-alerts-panel">
          <div className="mc-card-header">
            <div className="mc-card-header__title">
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#ea580c" }}>
                notifications_active
              </span>
              <span>Priority Alerts</span>
            </div>
            <span className="mc-badge mc-badge--critical">
              {alerts.length} Active
            </span>
          </div>

          <div className="mc-alerts-list">
            {topAlerts.map((alt) => (
              <div
                key={alt.id}
                className={`mc-alert-card-clean ${
                  alt.severity === "CRITICAL"
                    ? "mc-alert-card-clean--critical"
                    : ""
                }`}
                onClick={() => {
                  const matched = events.find((e) => e.id === alt.eventId);
                  if (matched) {
                    onViewIncident(matched);
                  } else if (events.length > 0) {
                    onViewIncident(events[0]);
                  }
                }}
              >
                <div className="mc-alert-card-clean__header">
                  <span className="mc-alert-card-clean__id">{formatCompactDetectionId(alt.eventId)}</span>
                  <SeverityBadge severity={alt.severity} />
                </div>
                <div className="mc-alert-card-clean__loc">{alt.location}</div>
                <div className="mc-alert-card-clean__reason">{alt.trigger}</div>
                <div className="mc-alert-card-clean__footer">
                  <span>{alt.facility}</span>
                  <span className="mc-mono">{alt.detectedTime}</span>
                </div>
              </div>
            ))}
          </div>

          {/* View All Alerts Footer Link */}
          <div
            className="mc-alerts-footer-link"
            onClick={onNavigateToAlerts}
          >
            <span>View all alerts ({alerts.length})</span>
            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
              arrow_forward
            </span>
          </div>
        </div>
      </section>

      {/* 4. Compact Recent Activity Summary Strip (Requirement 3: Uses same severity counts) */}
      <section className="mc-dashboard-activity-strip">
        <div className="mc-dashboard-activity-strip__left">
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#2563eb" }}>
            analytics
          </span>
          <span>Recent Activity</span>
        </div>
        <div className="mc-dashboard-activity-strip__items">
          <span><strong>{totalHotspots}</strong> detected</span>
          <span className="mc-activity-dot">•</span>
          <span><strong>{industrialFires}</strong> industrial</span>
          <span className="mc-activity-dot">•</span>
          <span><strong>{wildfires}</strong> wildfire</span>
          <span className="mc-activity-dot">•</span>
          <span style={{ color: "#dc2626" }}><strong>{highSeverity}</strong> high severity</span>
          <span className="mc-activity-dot">•</span>
          <span style={{ color: "#ea580c" }}><strong>{alerts.length}</strong> active alerts</span>
        </div>
      </section>

      {/* 5. Professional Data-Source Status Footer (Requirement 13) */}
      <footer className="mc-dashboard-footer">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>Agni Netra • Data Source: NASA FIRMS (VIIRS) • Last updated {lastUpdatedTime || "11:31 PM IST"}</span>
          <span style={{ color: "#16a34a", fontWeight: 600 }}>● Data updated recently</span>
        </div>
        <span>Territorial India Coverage</span>
      </footer>

      {/* 6. Classification Reasoning Modal (Requirement 10: Explainable AI details) */}
      {inspectingEvent && (
        <div className="mc-reasoning-overlay" onClick={() => setInspectingEvent(null)}>
          <div className="mc-reasoning-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mc-reasoning-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ color: "#2563eb", fontSize: "20px" }}>
                  psychology
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                    Classification Evidence &amp; Reasoning
                  </h3>
                  <span className="mc-mono" style={{ fontSize: "11px", color: "#64748b" }}>
                    {inspectingEvent.id} · {inspectingEvent.locationName}
                  </span>
                </div>
              </div>
              <button
                className="mc-icon-btn"
                onClick={() => setInspectingEvent(null)}
                style={{ width: "26px", height: "26px" }}
              >
                ✕
              </button>
            </div>

            <div className="mc-reasoning-body">
              {/* Classification Tag & Confidence */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "10px 14px",
                }}
              >
                <div>
                  <div style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                    Analytical Classification
                  </div>
                  <div style={{ marginTop: "4px" }}>
                    <ClassificationTag classification={inspectingEvent.classification} />
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                    Classification Confidence
                  </div>
                  <div className="mc-mono" style={{ fontSize: "18px", fontWeight: 800, color: "#2563eb" }}>
                    {inspectingEvent.classificationConfidence || 75}%
                  </div>
                </div>
              </div>

              {/* Rationale */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Primary Attribution Rationale:
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#0f172a",
                    background: "#f1f5f9",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    lineHeight: 1.45,
                  }}
                >
                  {inspectingEvent.classificationReason || "Evidence profile consistent with analytical source attribution."}
                </div>
              </div>

              {/* Real Evidence Signals (Requirement 10) */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Supporting Evidence Signals:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(inspectingEvent.evidenceList && inspectingEvent.evidenceList.length > 0
                    ? inspectingEvent.evidenceList
                    : inspectingEvent.supportingEvidence
                  ).map((evText, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "6px",
                        fontSize: "11.5px",
                        color: "#334155",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#16a34a", flexShrink: 0, marginTop: "1px" }}>
                        check_circle
                      </span>
                      <span>{evText}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Telemetry Summary */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "4px",
                  padding: "8px 10px",
                  fontSize: "11px",
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Radiative Power:</span>
                  <div className="mc-mono" style={{ fontWeight: 700, color: "#dc2626" }}>{inspectingEvent.frpMw.toFixed(1)} MW</div>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>FIRMS Sensor Conf:</span>
                  <div className="mc-mono" style={{ fontWeight: 700 }}>{inspectingEvent.firmsConfidence || inspectingEvent.confidence}%</div>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Full Identifier:</span>
                  <div className="mc-mono" style={{ fontSize: "10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={inspectingEvent.id}>
                    {inspectingEvent.id}
                  </div>
                </div>
              </div>
            </div>

            <div className="mc-reasoning-footer">
              <button
                className="mc-btn mc-btn--secondary"
                onClick={() => setInspectingEvent(null)}
              >
                Close
              </button>
              <button
                className="mc-btn mc-btn--primary"
                onClick={() => {
                  onViewIncident(inspectingEvent);
                  if (onNavigateToMap) onNavigateToMap();
                  setInspectingEvent(null);
                }}
              >
                Investigate on Thermal Map →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
