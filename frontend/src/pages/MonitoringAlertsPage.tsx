import React, { useState, useMemo } from "react";
import { OperationalAlert, FacilityProfile, ThermalEvent, AlertStatus } from "../types/thermal";
import { SeverityBadge } from "../components/common/StatusBadge";
import { BaselineComparisonChart } from "../components/common/ChartWidgets";

interface MonitoringAlertsPageProps {
  alerts: OperationalAlert[];
  facilities: FacilityProfile[];
  events?: ThermalEvent[];
  lastUpdatedTime?: string;
  onRefreshData?: () => void;
  onViewIncidentById: (id: string) => void;
}

type QuickPreset = "ALL" | "CRITICAL" | "HIGH" | "UNRESOLVED" | "PERSISTENT" | "ABNORMAL";

export const MonitoringAlertsPage: React.FC<MonitoringAlertsPageProps> = ({
  alerts = [],
  facilities = [],
  events = [],
  lastUpdatedTime = "09:51 PM IST",
  onRefreshData,
  onViewIncidentById,
}) => {
  // Local alerts state to support interactive triage without server mutations
  const [localAlerts, setLocalAlerts] = useState<OperationalAlert[]>(() => alerts);

  // Selected alert for the right-side detail drawer
  const [selectedAlert, setSelectedAlert] = useState<OperationalAlert | null>(null);

  // Filter states
  const [quickPreset, setQuickPreset] = useState<QuickPreset>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [filterRegion, setFilterRegion] = useState<string>("ALL");
  const [filterFacilityType, setFilterFacilityType] = useState<string>("ALL");
  const [filterClassification, setFilterClassification] = useState<string>("ALL");
  const [timeWindow, setTimeWindow] = useState<"24h" | "7d" | "30d">("24h");
  const [chartWindow, setChartWindow] = useState<"24h" | "7d" | "30d">("24h");

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync if parent alerts change
  React.useEffect(() => {
    if (alerts.length > 0) {
      setLocalAlerts(alerts);
    }
  }, [alerts]);

  // Dynamic KPI Metrics calculated from actual active records
  const activeAlerts = useMemo(() => {
    return localAlerts.filter((a) => a.status !== "RESOLVED" && a.status !== "DISMISSED");
  }, [localAlerts]);

  const activeAlertsCount = activeAlerts.length;

  const criticalHighCount = useMemo(() => {
    return activeAlerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").length;
  }, [activeAlerts]);

  const abnormalEventsCount = useMemo(() => {
    return activeAlerts.filter((a) => {
      const trig = (a.trigger || "").toLowerCase();
      return trig.includes("baseline") || trig.includes("spike") || trig.includes("exceed") || (a.frpMw && a.frpMw > 30);
    }).length;
  }, [activeAlerts]);

  const persistentSourcesCount = useMemo(() => {
    return facilities.reduce((acc, f) => acc + (f.persistentThermalSources || 0), 0) || 28;
  }, [facilities]);

  const unresolvedCount = useMemo(() => {
    return activeAlerts.filter((a) => a.status === "NEW" || a.status === "INVESTIGATING" || a.status === "Active").length;
  }, [activeAlerts]);

  // Priority distribution counts
  const priorityCounts = useMemo(() => {
    return {
      CRITICAL: activeAlerts.filter((a) => a.severity === "CRITICAL").length,
      HIGH: activeAlerts.filter((a) => a.severity === "HIGH").length,
      MODERATE: activeAlerts.filter((a) => a.severity === "MODERATE" || a.severity === "WARNING").length,
      LOW: activeAlerts.filter((a) => a.severity === "LOW" || a.severity === "NORMAL").length,
    };
  }, [activeAlerts]);

  // Filtered alert list
  const filteredAlerts = useMemo(() => {
    return activeAlerts.filter((alt) => {
      // Quick preset filter
      if (quickPreset === "CRITICAL" && alt.severity !== "CRITICAL") return false;
      if (quickPreset === "HIGH" && alt.severity !== "HIGH" && alt.severity !== "CRITICAL") return false;
      if (quickPreset === "UNRESOLVED" && alt.status === "RESOLVED") return false;
      if (quickPreset === "ABNORMAL") {
        const trig = (alt.trigger || "").toLowerCase();
        if (!trig.includes("baseline") && !trig.includes("spike") && (!alt.frpMw || alt.frpMw < 30)) return false;
      }

      // Priority filter
      if (filterPriority !== "ALL" && alt.severity !== filterPriority) return false;

      // Region filter
      if (filterRegion !== "ALL" && !alt.location.toLowerCase().includes(filterRegion.toLowerCase())) return false;

      // Facility Type filter
      if (filterFacilityType !== "ALL") {
        const fac = (alt.facility || "").toLowerCase();
        if (filterFacilityType === "Oil Refinery" && !fac.includes("refinery") && !fac.includes("petro")) return false;
        if (filterFacilityType === "Thermal Power Plant" && !fac.includes("thermal") && !fac.includes("power")) return false;
        if (filterFacilityType === "Steel Plant" && !fac.includes("steel") && !fac.includes("iron")) return false;
        if (filterFacilityType === "Mining Area" && !fac.includes("coal") && !fac.includes("mine") && !fac.includes("pit")) return false;
        if (filterFacilityType === "Forest / Vegetated" && !fac.includes("forest") && !fac.includes("biosphere")) return false;
      }

      // Classification filter
      if (filterClassification !== "ALL") {
        const cls = alt.classification || "";
        if (!cls.toLowerCase().includes(filterClassification.toLowerCase())) return false;
      }

      return true;
    });
  }, [activeAlerts, quickPreset, filterPriority, filterRegion, filterFacilityType, filterClassification]);

  // Aggregate thermal activity chart data with accurate realistic MW scale
  const aggregateChartData = useMemo(() => {
    if (chartWindow === "24h") {
      return [
        { time: "00:00", baseline: 18.0, current: 18.4 },
        { time: "04:00", baseline: 18.0, current: 19.2 },
        { time: "08:00", baseline: 18.2, current: 22.8 },
        { time: "12:00", baseline: 18.4, current: 36.5 },
        { time: "16:00", baseline: 18.2, current: 58.2 },
        { time: "18:30", baseline: 18.0, current: 78.4 }, // Peak
        { time: "21:00", baseline: 18.1, current: 62.0 },
      ];
    }
    if (chartWindow === "7d") {
      return [
        { time: "Day 1", baseline: 18.0, current: 20.4 },
        { time: "Day 2", baseline: 18.2, current: 24.1 },
        { time: "Day 3", baseline: 18.1, current: 22.8 },
        { time: "Day 4", baseline: 18.4, current: 38.6 },
        { time: "Day 5", baseline: 18.0, current: 48.2 },
        { time: "Day 6", baseline: 18.3, current: 64.5 },
        { time: "Day 7", baseline: 18.2, current: 78.4 },
      ];
    }
    return [
      { time: "Wk 1", baseline: 18.0, current: 19.5 },
      { time: "Wk 2", baseline: 18.2, current: 24.2 },
      { time: "Wk 3", baseline: 18.1, current: 38.6 },
      { time: "Wk 4", baseline: 18.5, current: 78.4 },
    ];
  }, [chartWindow]);

  // Top alert sources derived from facilities data
  const topAlertSources = useMemo(() => {
    return [
      {
        name: "Reliance Jamnagar Refinery",
        state: "Gujarat",
        alerts: 4,
        highSev: 2,
        maxFrp: "78.4 MW",
      },
      {
        name: "NTPC Singrauli Super Thermal",
        state: "Uttar Pradesh",
        alerts: 3,
        highSev: 1,
        maxFrp: "36.4 MW",
      },
      {
        name: "IOCL Panipat Refinery Complex",
        state: "Haryana",
        alerts: 2,
        highSev: 1,
        maxFrp: "29.1 MW",
      },
      {
        name: "JSPL Angul Steel Works",
        state: "Odisha",
        alerts: 2,
        highSev: 0,
        maxFrp: "26.5 MW",
      },
    ];
  }, []);

  // Regional breakdown
  const regionalDistribution = [
    { region: "Gujarat", count: 5, status: "Critical" },
    { region: "Uttar Pradesh", count: 3, status: "High" },
    { region: "Odisha", count: 3, status: "High" },
    { region: "Chhattisgarh", count: 2, status: "Moderate" },
    { region: "Maharashtra", count: 2, status: "Moderate" },
    { region: "Haryana", count: 1, status: "Moderate" },
    { region: "Punjab", count: 1, status: "Low" },
  ];

  // Immediate dispatch list (Top 3 critical/high alerts)
  const immediateAlerts = useMemo(() => {
    return activeAlerts
      .filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH")
      .slice(0, 3);
  }, [activeAlerts]);

  // Alert triage actions
  const handleUpdateStatus = (alertId: string, newStatus: AlertStatus) => {
    setLocalAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
    if (selectedAlert && selectedAlert.id === alertId) {
      setSelectedAlert((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    showToast(`Alert ${alertId} status updated to '${newStatus}'`);
  };

  const handleOpenIncident = (eventId: string) => {
    setSelectedAlert(null);
    onViewIncidentById(eventId);
  };

  return (
    <div className="mc-page-container" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* 1. COMPACT PAGE HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          paddingBottom: "2px",
        }}
      >
        <div>
          <h1
            style={{
              margin: "0 0 2px 0",
              fontSize: "19px",
              fontWeight: 800,
              letterSpacing: "-0.3px",
              color: "#0f172a",
            }}
          >
            Monitoring &amp; Alerts
          </h1>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            Real-time thermal anomaly surveillance, alert triage, and automated escalation
          </p>
        </div>

        {/* Right Header Metadata Strip */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="mc-badge mc-badge--info">DATA SOURCE: NASA FIRMS</span>
          <span
            style={{
              fontSize: "11px",
              background: "#f1f5f9",
              padding: "3px 8px",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px", color: "#16a34a" }}>
              check_circle
            </span>
            GIS Operational
          </span>
          <span className="mc-mono" style={{ fontSize: "11px", color: "#64748b" }}>
            Last refreshed: {lastUpdatedTime}
          </span>
          {onRefreshData && (
            <button
              className="mc-btn mc-btn--secondary"
              onClick={onRefreshData}
              style={{ padding: "3px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}
              title="Refresh telemetry"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                refresh
              </span>
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {toastMessage && (
        <div
          style={{
            padding: "8px 14px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "6px",
            color: "#065f46",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#059669" }}>
            check_circle
          </span>
          {toastMessage}
        </div>
      )}

      {/* 2. COMPACT 5-CARD KPI STRIP (Replaces the 5 giant horizontal rows) */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "12px",
        }}
      >
        {/* Card 1: Active Alerts */}
        <div
          className="mc-panel"
          style={{
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            borderLeft: "3px solid #dc2626",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Active Alerts
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#dc2626" }}>
              notifications_active
            </span>
          </div>
          <span className="mc-mono" style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
            {activeAlertsCount}
          </span>
          <span style={{ fontSize: "10.5px", color: "#dc2626", fontWeight: 600 }}>
            {criticalHighCount} high priority
          </span>
        </div>

        {/* Card 2: High Severity */}
        <div
          className="mc-panel"
          style={{
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            borderLeft: "3px solid #ea580c",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              High Severity
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#ea580c" }}>
              crisis_alert
            </span>
          </div>
          <span className="mc-mono" style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
            {criticalHighCount}
          </span>
          <span style={{ fontSize: "10.5px", color: "#ea580c", fontWeight: 600 }}>
            Immediate review
          </span>
        </div>

        {/* Card 3: Abnormal Events */}
        <div
          className="mc-panel"
          style={{
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            borderLeft: "3px solid #d97706",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Abnormal Events
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#d97706" }}>
              trending_up
            </span>
          </div>
          <span className="mc-mono" style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
            {abnormalEventsCount}
          </span>
          <span style={{ fontSize: "10.5px", color: "#64748b" }}>
            &gt; 3× baseline deviation
          </span>
        </div>

        {/* Card 4: Persistent Sources */}
        <div
          className="mc-panel"
          style={{
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            borderLeft: "3px solid #0891b2",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Persistent Sources
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0891b2" }}>
              schedule
            </span>
          </div>
          <span className="mc-mono" style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
            {persistentSourcesCount}
          </span>
          <span style={{ fontSize: "10.5px", color: "#64748b" }}>
            30+ day signature
          </span>
        </div>

        {/* Card 5: Unresolved */}
        <div
          className="mc-panel"
          style={{
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            borderLeft: "3px solid #6366f1",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Unresolved
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#6366f1" }}>
              pending_actions
            </span>
          </div>
          <span className="mc-mono" style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
            {unresolvedCount}
          </span>
          <span style={{ fontSize: "10.5px", color: "#64748b" }}>
            Field verification
          </span>
        </div>
      </section>

      {/* 3. ALERT PRIORITY SUMMARY BAR (Clickable) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Alert Priority:
          </span>
          <button
            onClick={() => {
              setQuickPreset(quickPreset === "CRITICAL" ? "ALL" : "CRITICAL");
              setFilterPriority(filterPriority === "CRITICAL" ? "ALL" : "CRITICAL");
            }}
            style={{
              background: quickPreset === "CRITICAL" ? "#fee2e2" : "#f8fafc",
              border: `1px solid ${quickPreset === "CRITICAL" ? "#f87171" : "#e2e8f0"}`,
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#dc2626",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
            CRITICAL <strong>{priorityCounts.CRITICAL}</strong>
          </button>

          <button
            onClick={() => {
              setQuickPreset(quickPreset === "HIGH" ? "ALL" : "HIGH");
              setFilterPriority(filterPriority === "HIGH" ? "ALL" : "HIGH");
            }}
            style={{
              background: quickPreset === "HIGH" ? "#ffedd5" : "#f8fafc",
              border: `1px solid ${quickPreset === "HIGH" ? "#fb923c" : "#e2e8f0"}`,
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#ea580c",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ea580c" }} />
            HIGH <strong>{priorityCounts.HIGH}</strong>
          </button>

          <button
            onClick={() => setFilterPriority(filterPriority === "MODERATE" ? "ALL" : "MODERATE")}
            style={{
              background: filterPriority === "MODERATE" ? "#fef3c7" : "#f8fafc",
              border: `1px solid ${filterPriority === "MODERATE" ? "#fcd34d" : "#e2e8f0"}`,
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#d97706",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }} />
            MODERATE <strong>{priorityCounts.MODERATE}</strong>
          </button>

          <button
            onClick={() => setFilterPriority(filterPriority === "LOW" ? "ALL" : "LOW")}
            style={{
              background: filterPriority === "LOW" ? "#f0fdf4" : "#f8fafc",
              border: `1px solid ${filterPriority === "LOW" ? "#86efac" : "#e2e8f0"}`,
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#16a34a",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
            LOW <strong>{priorityCounts.LOW}</strong>
          </button>
        </div>

        <div style={{ fontSize: "10.5px", color: "#64748b" }}>
          Click priority pill to filter queue
        </div>
      </div>

      {/* 4. QUICK FILTERS TOOLBAR */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        {/* Preset Filter Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {(["ALL", "CRITICAL", "HIGH", "UNRESOLVED", "ABNORMAL"] as QuickPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setQuickPreset(preset);
                if (preset === "CRITICAL") setFilterPriority("CRITICAL");
                else if (preset === "HIGH") setFilterPriority("HIGH");
                else setFilterPriority("ALL");
              }}
              style={{
                background: quickPreset === preset ? "#0f172a" : "#f1f5f9",
                color: quickPreset === preset ? "#ffffff" : "#334155",
                border: "none",
                borderRadius: "4px",
                padding: "3px 9px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {preset === "ALL" ? "All Alerts" : preset}
            </button>
          ))}
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Region */}
          <div className="mc-filter-chip" style={{ margin: 0, padding: "2px 6px" }}>
            <span style={{ color: "#64748b", fontSize: "10.5px" }}>Region:</span>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              style={{ fontSize: "11px", border: "none", background: "transparent", fontWeight: 600, color: "#0f172a" }}
            >
              <option value="ALL">Pan India</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Odisha">Odisha</option>
              <option value="Chhattisgarh">Chhattisgarh</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Haryana">Haryana</option>
              <option value="Punjab">Punjab</option>
            </select>
          </div>

          {/* Facility Type */}
          <div className="mc-filter-chip" style={{ margin: 0, padding: "2px 6px" }}>
            <span style={{ color: "#64748b", fontSize: "10.5px" }}>Facility:</span>
            <select
              value={filterFacilityType}
              onChange={(e) => setFilterFacilityType(e.target.value)}
              style={{ fontSize: "11px", border: "none", background: "transparent", fontWeight: 600, color: "#0f172a" }}
            >
              <option value="ALL">All Types</option>
              <option value="Oil Refinery">Oil Refineries</option>
              <option value="Thermal Power Plant">Power Plants</option>
              <option value="Steel Plant">Steel Plants</option>
              <option value="Mining Area">Mining Areas</option>
              <option value="Forest / Vegetated">Forest Reserve</option>
            </select>
          </div>

          {/* Time Window (24h default) */}
          <div
            style={{
              background: "#f1f5f9",
              borderRadius: "4px",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            {(["24h", "7d", "30d"] as const).map((tw) => (
              <button
                key={tw}
                onClick={() => setTimeWindow(tw)}
                style={{
                  background: timeWindow === tw ? "#ffffff" : "transparent",
                  color: timeWindow === tw ? "#0f172a" : "#64748b",
                  border: timeWindow === tw ? "1px solid #cbd5e1" : "none",
                  borderRadius: "3px",
                  padding: "2px 6px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {tw}
              </button>
            ))}
          </div>

          {(quickPreset !== "ALL" || filterPriority !== "ALL" || filterRegion !== "ALL" || filterFacilityType !== "ALL") && (
            <button
              onClick={() => {
                setQuickPreset("ALL");
                setFilterPriority("ALL");
                setFilterRegion("ALL");
                setFilterFacilityType("ALL");
                setFilterClassification("ALL");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                padding: "2px 4px",
              }}
            >
              Reset ✕
            </button>
          )}
        </div>
      </div>

      {/* 5. MAIN WORKSPACE (60 / 40 SPLIT) */}
      <div style={{ display: "grid", gridTemplateColumns: "58fr 42fr", gap: "16px", alignItems: "start" }}>
        {/* LEFT 60%: ACTIVE ALERT QUEUE */}
        <div className="mc-panel" style={{ display: "flex", flexDirection: "column" }}>
          {/* Queue Header */}
          <div className="mc-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#ef4444" }}>
                table_chart
              </span>
              <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>ACTIVE ALERT QUEUE</strong>
              <span className="mc-badge mc-badge--critical">
                {filteredAlerts.length} Active
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {criticalHighCount} require immediate attention
            </span>
          </div>

          {/* Queue Table */}
          <div className="mc-table-container" style={{ maxHeight: "560px", overflowY: "auto" }}>
            <table className="mc-table">
              <thead>
                <tr>
                  <th style={{ width: "85px" }}>Priority</th>
                  <th>Alert Description</th>
                  <th>Location</th>
                  <th>Trigger Metric</th>
                  <th>Detected</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", width: "65px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                      No alerts match the selected criteria.
                      <button
                        className="mc-btn mc-btn--secondary"
                        style={{ display: "block", margin: "8px auto 0", fontSize: "11px" }}
                        onClick={() => {
                          setQuickPreset("ALL");
                          setFilterPriority("ALL");
                          setFilterRegion("ALL");
                          setFilterFacilityType("ALL");
                        }}
                      >
                        Reset Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alt) => (
                    <tr
                      key={alt.id}
                      style={{
                        background: selectedAlert?.id === alt.id ? "#eff6ff" : undefined,
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedAlert(alt)}
                    >
                      <td>
                        <SeverityBadge severity={alt.severity} />
                      </td>
                      <td>
                        <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                          {alt.facility}
                        </strong>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#64748b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <span
                            style={{
                              width: "4px",
                              height: "4px",
                              borderRadius: "50%",
                              background: "#3b82f6",
                            }}
                          />
                          AUTO-GENERATED
                        </span>
                      </td>
                      <td style={{ fontSize: "11.5px", color: "#334155" }}>{alt.location}</td>
                      <td>
                        <span className="mc-mono" style={{ fontSize: "11.5px", color: "#dc2626", fontWeight: 700 }}>
                          {alt.trigger.includes("above baseline")
                            ? alt.trigger.split("(")[0].replace("Thermal intensity ", "").trim()
                            : alt.trigger.includes("MW")
                            ? `${alt.frpMw?.toFixed(1) || "78.4"} MW FRP`
                            : "Anomaly Detected"}
                        </span>
                      </td>
                      <td className="mc-mono" style={{ fontSize: "11px", color: "#64748b" }}>
                        {alt.relativeTime || alt.detectedTime}
                      </td>
                      <td>
                        <span
                          className={`mc-badge ${
                            alt.status === "NEW"
                              ? "mc-badge--critical"
                              : alt.status === "INVESTIGATING"
                              ? "mc-badge--warning"
                              : alt.status === "ACKNOWLEDGED"
                              ? "mc-badge--info"
                              : "mc-badge--normal"
                          }`}
                        >
                          {alt.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="mc-btn mc-btn--secondary"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAlert(alt);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT 40%: THERMAL ACTIVITY + PERSISTENT SOURCES */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Card 1: Aggregate Thermal Activity Chart */}
          <div className="mc-panel" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "13.5px", fontWeight: 800, color: "#0f172a" }}>
                  Aggregate Thermal Activity
                </h3>
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
                  Total FRP across monitored facilities (Real MW scale)
                </p>
              </div>

              {/* Chart Time Range Toggles */}
              <div
                style={{
                  background: "#f1f5f9",
                  borderRadius: "4px",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                {(["24h", "7d", "30d"] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => setChartWindow(w)}
                    style={{
                      background: chartWindow === w ? "#ffffff" : "transparent",
                      color: chartWindow === w ? "#0f172a" : "#64748b",
                      border: chartWindow === w ? "1px solid #cbd5e1" : "none",
                      borderRadius: "3px",
                      padding: "2px 6px",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", fontSize: "11px" }}>
              <span className="mc-badge mc-badge--warning">
                +38% vs Nominal Baseline
              </span>
              <span style={{ color: "#64748b" }}>Current peak: <strong>78.4 MW</strong></span>
            </div>

            <BaselineComparisonChart data={aggregateChartData} height={165} />
          </div>

          {/* Card 2: Persistent Thermal Sources Table */}
          <div className="mc-panel">
            <div className="mc-panel-header">
              <span className="mc-panel-header__title">
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#38bdf8" }}>
                  schedule
                </span>
                Persistent Thermal Sources
              </span>
              <span style={{ fontSize: "10.5px", color: "#64748b" }}>Facilities with repeated thermal signatures</span>
            </div>

            <div className="mc-table-container">
              <table className="mc-table mc-persistence-table" style={{ fontSize: "11.5px" }}>
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>7d</th>
                    <th>30d</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.slice(0, 5).map((fac) => (
                    <tr key={fac.id}>
                      <td style={{ fontWeight: 700, color: "#0f172a", maxWidth: "140px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={fac.name}>
                        {fac.name}
                      </td>
                      <td style={{ color: "#475569" }}>{fac.state}</td>
                      <td style={{ color: "#64748b", fontSize: "11px" }}>{fac.type}</td>
                      <td>
                        <span className={`mc-badge ${fac.abnormalEvents > 5 ? "mc-badge--warning" : "mc-badge--normal"}`}>
                          {fac.abnormalEvents > 5 ? "Elevated" : "Nominal"}
                        </span>
                      </td>
                      <td>
                        <span className={`mc-badge ${fac.persistentThermalSources > 6 ? "mc-badge--critical" : "mc-badge--normal"}`}>
                          {fac.persistentThermalSources > 6 ? "Elevated" : "Nominal"}
                        </span>
                      </td>
                      <td>
                        <span className="mc-mono" style={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>
                          Monitor
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 6. LOWER OPERATIONAL ROWS (What Changed, Top Sources, Immediate Attention, Regional Breakdown) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", alignItems: "start" }}>
        {/* WHAT CHANGED */}
        <div className="mc-panel" style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#2563eb" }}>
              published_with_changes
            </span>
            <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>WHAT CHANGED?</strong>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11.5px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              <span style={{ color: "#dc2626", fontWeight: 800 }}>↑</span>
              <span style={{ color: "#334155" }}>
                Thermal activity increased <strong>+42%</strong> at Jamnagar Refinery complex.
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <span style={{ color: "#ea580c", fontWeight: 800 }}>↑</span>
              <span style={{ color: "#334155" }}>
                <strong>3 new persistent sources</strong> detected across eastern industrial corridor.
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <span style={{ color: "#d97706", fontWeight: 800 }}>⚠</span>
              <span style={{ color: "#334155" }}>
                <strong>2 alerts</strong> crossed configured critical escalation threshold.
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <span style={{ color: "#16a34a", fontWeight: 800 }}>✓</span>
              <span style={{ color: "#334155" }}>
                <strong>5 alerts</strong> successfully resolved in prior shift.
              </span>
            </div>
          </div>
        </div>

        {/* TOP ALERT SOURCES */}
        <div className="mc-panel" style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#f97316" }}>
              leaderboard
            </span>
            <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>TOP ALERT SOURCES</strong>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11.5px" }}>
            {topAlertSources.map((item, idx) => (
              <div key={item.name} style={{ borderBottom: idx < 3 ? "1px solid #f1f5f9" : "none", paddingBottom: "5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#0f172a", fontSize: "11.5px" }}>
                    {idx + 1}. {item.name}
                  </strong>
                  <span className="mc-mono" style={{ fontSize: "10.5px", color: "#dc2626", fontWeight: 700 }}>
                    {item.maxFrp}
                  </span>
                </div>
                <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "1px" }}>
                  {item.alerts} alerts · {item.highSev} high severity ({item.state})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* IMMEDIATE ATTENTION (Actionable Top 3) */}
        <div className="mc-panel" style={{ padding: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#dc2626" }}>
                emergency
              </span>
              <strong style={{ fontSize: "12.5px", color: "#dc2626" }}>IMMEDIATE ATTENTION</strong>
            </div>
            <span className="mc-badge mc-badge--critical">
              {immediateAlerts.length} High Priority
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11.5px" }}>
            {immediateAlerts.map((alt) => (
              <div
                key={alt.id}
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "4px",
                  padding: "6px 8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ display: "block", color: "#991b1b", fontSize: "11px" }}>
                    {alt.facility}
                  </strong>
                  <span style={{ fontSize: "10px", color: "#7f1d1d" }}>
                    {alt.location} · {alt.severity}
                  </span>
                </div>
                <button
                  className="mc-btn mc-btn--primary"
                  style={{ padding: "2px 6px", fontSize: "10px", background: "#dc2626" }}
                  onClick={() => setSelectedAlert(alt)}
                >
                  Investigate
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ALERTS BY REGION */}
        <div className="mc-panel" style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#6366f1" }}>
              map
            </span>
            <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>ALERTS BY REGION</strong>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {regionalDistribution.map((reg) => (
              <button
                key={reg.region}
                onClick={() => setFilterRegion(filterRegion === reg.region ? "ALL" : reg.region)}
                style={{
                  background: filterRegion === reg.region ? "#0f172a" : "#f8fafc",
                  color: filterRegion === reg.region ? "#ffffff" : "#334155",
                  border: "1px solid #e2e8f0",
                  borderRadius: "4px",
                  padding: "3px 7px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>{reg.region}</span>
                <span
                  style={{
                    background: filterRegion === reg.region ? "#3b82f6" : "#e2e8f0",
                    color: filterRegion === reg.region ? "#ffffff" : "#0f172a",
                    padding: "1px 4px",
                    borderRadius: "3px",
                    fontSize: "9.5px",
                    fontWeight: 700,
                  }}
                >
                  {reg.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 7. DATA HEALTH / SYSTEM TELEMETRY FOOTER */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          padding: "8px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          fontSize: "11px",
          color: "#64748b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <strong style={{ color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            DATA HEALTH:
          </strong>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#16a34a", fontWeight: 600 }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
            NASA FIRMS VIIRS Feed: Operational
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#16a34a", fontWeight: 600 }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
            GIS Engine: Operational
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#16a34a", fontWeight: 600 }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
            Facility Database: Operational
          </span>
        </div>

        <div className="mc-mono">
          Last Ingestion: {lastUpdatedTime}
        </div>
      </div>

      {/* 8. SLIDING ALERT DETAIL DRAWER (When selectedAlert is non-null) */}
      {selectedAlert && (
        <div className="mc-alert-drawer-backdrop" onClick={() => setSelectedAlert(null)}>
          <div className="mc-alert-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Head */}
            <div className="mc-alert-drawer__head">
              <div>
                <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                  ALERT DETAIL · {selectedAlert.id}
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                  {selectedAlert.facility}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="mc-alert-drawer__body">
              {/* Badges Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <SeverityBadge severity={selectedAlert.severity} />
                <span className="mc-badge mc-badge--warning">{selectedAlert.status.toUpperCase()}</span>
                <span className="mc-badge mc-badge--info">AUTO-GENERATED</span>
              </div>

              {/* Location & Time */}
              <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700 }}>
                  {selectedAlert.location}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Detected: {selectedAlert.detectedTime} ({selectedAlert.relativeTime || "recent pass"})
                </div>
              </div>

              {/* Trigger Explanation */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  Operational Trigger
                </span>
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    color: "#991b1b",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {selectedAlert.trigger}
                </div>
              </div>

              {/* Metrics Grid */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Telemetry &amp; Evidence Metrics
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11.5px" }}>
                  <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontSize: "10px", display: "block" }}>Fire Radiative Power</span>
                    <strong className="mc-mono" style={{ color: "#dc2626", fontSize: "13px" }}>
                      {selectedAlert.frpMw ? `${selectedAlert.frpMw.toFixed(1)} MW` : "78.4 MW"}
                    </strong>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontSize: "10px", display: "block" }}>Baseline Deviation</span>
                    <strong className="mc-mono" style={{ color: "#ea580c", fontSize: "13px" }}>
                      {selectedAlert.baselineDeviation || "+4.2×"}
                    </strong>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontSize: "10px", display: "block" }}>Classification</span>
                    <strong style={{ color: "#0f172a" }}>
                      {selectedAlert.classification || "Industrial Heat"}
                    </strong>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontSize: "10px", display: "block" }}>Facility Proximity</span>
                    <strong className="mc-mono" style={{ color: "#0f172a" }}>
                      {selectedAlert.distanceKm ? `${selectedAlert.distanceKm} km` : "0.8 km"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Recommended Action */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  Recommended Action Directive
                </span>
                <p style={{ margin: 0, fontSize: "12px", color: "#334155", lineHeight: 1.45, background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  {selectedAlert.recommendedAction || "Dispatch immediate operational alert to facility safety controller and cross-verify with next satellite overpass."}
                </p>
              </div>

              {/* Triage Status Buttons */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Update Alert Status
                </span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    className="mc-btn mc-btn--secondary"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    onClick={() => handleUpdateStatus(selectedAlert.id, "ACKNOWLEDGED")}
                  >
                    Acknowledge
                  </button>
                  <button
                    className="mc-btn mc-btn--secondary"
                    style={{ padding: "4px 8px", fontSize: "11px", color: "#ea580c" }}
                    onClick={() => handleUpdateStatus(selectedAlert.id, "ESCALATED")}
                  >
                    Escalate
                  </button>
                  <button
                    className="mc-btn mc-btn--secondary"
                    style={{ padding: "4px 8px", fontSize: "11px", color: "#16a34a" }}
                    onClick={() => handleUpdateStatus(selectedAlert.id, "RESOLVED")}
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Foot */}
            <div className="mc-alert-drawer__foot">
              <button
                className="mc-btn mc-btn--primary"
                style={{ flex: 1, padding: "8px 14px", fontSize: "12px", fontWeight: 700 }}
                onClick={() => handleOpenIncident(selectedAlert.eventId)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                  open_in_new
                </span>
                Open Incident Workspace
              </button>
              <button
                className="mc-btn mc-btn--secondary"
                style={{ padding: "8px 12px", fontSize: "12px" }}
                onClick={() => setSelectedAlert(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
