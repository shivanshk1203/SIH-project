import React, { useState } from "react";

type SettingsSection = "datasources" | "alertrules" | "classification" | "notifications" | "map" | "access";

export const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>("datasources");
  const [savedToast, setSavedToast] = useState<boolean>(false);

  // 1. Data Sources Settings
  const [viirsNppActive, setViirsNppActive] = useState<boolean>(true);
  const [noaa20Active, setNoaa20Active] = useState<boolean>(true);
  const [noaa21Active, setNoaa21Active] = useState<boolean>(true);
  const [modisTerraActive, setModisTerraActive] = useState<boolean>(false);
  const [pollingIntervalMin, setPollingIntervalMin] = useState<number>(10);
  const [firmsApiKey, setFirmsApiKey] = useState<string>("••••••••••••••••••••••••382a");

  // 2. Alert Rules Settings
  const [minFrpThreshold, setMinFrpThreshold] = useState<number>(5.0);
  const [baselineDeviationMult, setBaselineDeviationMult] = useState<number>(3.0);
  const [persistenceThresholdDays, setPersistenceThresholdDays] = useState<number>(30);
  const [autoEscalateCritical, setAutoEscalateCritical] = useState<boolean>(true);

  // 3. Classification Settings
  const [minConfidence, setMinConfidence] = useState<number>(75);
  const [facilityBufferMeters, setFacilityBufferMeters] = useState<number>(500);
  const [clusterRadiusKm, setClusterRadiusKm] = useState<number>(25);

  // 4. Notifications Settings
  const [alertWebhookUrl, setAlertWebhookUrl] = useState<string>("https://emergency.gov.in/api/v1/thermal-alerts");
  const [notifyPollutionBoards, setNotifyPollutionBoards] = useState<boolean>(true);
  const [notifySafetyOfficers, setNotifySafetyOfficers] = useState<boolean>(true);

  // 5. Map Settings
  const [defaultBaseMap, setDefaultBaseMap] = useState<"light" | "dark" | "satellite">("light");
  const [defaultClusterRadius, setDefaultClusterRadius] = useState<number>(45);
  const [autoCenterIndia, setAutoCenterIndia] = useState<boolean>(true);

  // 6. Users / Access Settings
  const [currentAnalystName, setCurrentAnalystName] = useState<string>("Senior Duty Analyst (Shift A)");
  const [shiftHours, setShiftHours] = useState<string>("08:00 - 20:00 IST");
  const [auditLogRetentionDays, setAuditLogRetentionDays] = useState<number>(90);

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const sections: { id: SettingsSection; label: string; icon: string }[] = [
    { id: "datasources", label: "Data Sources", icon: "satellite_alt" },
    { id: "alertrules", label: "Alert Rules", icon: "crisis_alert" },
    { id: "classification", label: "Classification", icon: "psychology" },
    { id: "notifications", label: "Notifications", icon: "hub" },
    { id: "map", label: "Map Configuration", icon: "map" },
    { id: "access", label: "Users & Access", icon: "manage_accounts" },
  ];

  return (
    <div className="mc-page-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
              System Configuration
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
              Agni Netra Platform Settings
            </span>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#64748b" }}>
            Telemetry ingestion parameters, alert escalation thresholds, classification models, and dispatch routing
          </p>
        </div>

        <button
          className="mc-btn mc-btn--primary"
          style={{ padding: "7px 16px", fontSize: "12px", gap: "6px" }}
          onClick={handleSave}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
            save
          </span>
          Save Parameters
        </button>
      </div>

      {/* Save Toast Notification */}
      {savedToast && (
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
            gap: "8px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#059669" }}>
            check_circle
          </span>
          Settings and ingestion parameters successfully updated and synchronized.
        </div>
      )}

      {/* Settings Layout: Left Navigation + Right Configuration Form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: "16px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          boxShadow: "var(--mc-shadow-sm)",
          overflow: "hidden",
        }}
      >
        {/* Left Section Selector */}
        <aside
          style={{
            background: "#f8fafc",
            borderRight: "1px solid #e2e8f0",
            padding: "12px 8px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "4px 8px" }}>
            Configuration Groups
          </span>
          {sections.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "5px",
                  border: "none",
                  background: isActive ? "#ffffff" : "transparent",
                  color: isActive ? "#2563eb" : "#475569",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                }}
                onClick={() => setActiveSection(s.id)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: isActive ? "#2563eb" : "#64748b" }}>
                  {s.icon}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Configuration Workspace */}
        <div style={{ padding: "20px" }}>
          {/* SECTION 1: DATA SOURCES */}
          {activeSection === "datasources" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                  Data Sources &amp; Constellation Ingestion
                </h3>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b" }}>
                  Configure satellite sensor feeds, API tokens, and polling cycles for India mainland surveillance.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label className="mc-layer-item">
                  <input
                    type="checkbox"
                    checked={viirsNppActive}
                    onChange={() => setViirsNppActive(!viirsNppActive)}
                  />
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                      Suomi-NPP VIIRS (375m NRT)
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Primary high-resolution active thermal anomaly detector
                    </span>
                  </div>
                </label>

                <label className="mc-layer-item">
                  <input
                    type="checkbox"
                    checked={noaa20Active}
                    onChange={() => setNoaa20Active(!noaa20Active)}
                  />
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                      NOAA-20 VIIRS (375m NRT)
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Secondary complementary orbital pass (+50 min offset)
                    </span>
                  </div>
                </label>

                <label className="mc-layer-item">
                  <input
                    type="checkbox"
                    checked={noaa21Active}
                    onChange={() => setNoaa21Active(!noaa21Active)}
                  />
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                      NOAA-21 VIIRS (375m NRT)
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Tertiary orbital pass for continuous diurnal refresh
                    </span>
                  </div>
                </label>

                <label className="mc-layer-item">
                  <input
                    type="checkbox"
                    checked={modisTerraActive}
                    onChange={() => setModisTerraActive(!modisTerraActive)}
                  />
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                      MODIS Terra / Aqua (1km)
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Legacy wide-area infrared sensor verification
                    </span>
                  </div>
                </label>
              </div>

              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    NASA FIRMS API Key:
                  </label>
                  <input
                    type="text"
                    value={firmsApiKey}
                    onChange={(e) => setFirmsApiKey(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: "12px",
                      fontFamily: "JetBrains Mono",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Polling Interval (Minutes):
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={pollingIntervalMin}
                    onChange={(e) => setPollingIntervalMin(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: ALERT RULES */}
          {activeSection === "alertrules" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                  Alert Rules &amp; Escalation Thresholds
                </h3>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b" }}>
                  Define quantitative triggers for automated incident generation and analyst notification.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Minimum Fire Radiative Power (MW FRP) Threshold:
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={minFrpThreshold}
                      onChange={(e) => setMinFrpThreshold(Number(e.target.value))}
                      style={{ flex: 1, accentColor: "#2563eb" }}
                    />
                    <span className="mc-mono" style={{ fontSize: "13px", fontWeight: 800, color: "#2563eb", width: "60px" }}>
                      {minFrpThreshold} MW
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Historical Baseline Deviation Multiplier:
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="range"
                      min="1.5"
                      max="6.0"
                      step="0.5"
                      value={baselineDeviationMult}
                      onChange={(e) => setBaselineDeviationMult(Number(e.target.value))}
                      style={{ flex: 1, accentColor: "#ef4444" }}
                    />
                    <span className="mc-mono" style={{ fontSize: "13px", fontWeight: 800, color: "#ef4444", width: "60px" }}>
                      {baselineDeviationMult}×
                    </span>
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                    Anomalies exceeding {baselineDeviationMult}× historical baseline trigger high-severity alert status.
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Persistence Signature Duration (Days):
                  </label>
                  <input
                    type="number"
                    min="7"
                    max="90"
                    value={persistenceThresholdDays}
                    onChange={(e) => setPersistenceThresholdDays(Number(e.target.value))}
                    style={{
                      width: "160px",
                      padding: "6px 8px",
                      fontSize: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                    }}
                  />
                </div>

                <label className="mc-layer-item" style={{ marginTop: "4px" }}>
                  <input
                    type="checkbox"
                    checked={autoEscalateCritical}
                    onChange={() => setAutoEscalateCritical(!autoEscalateCritical)}
                  />
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                      Auto-Escalate Critical Severity Anomaly Detections
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Immediately route FRP &gt; 25 MW detections to duty analyst high-priority queue
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* SECTION 3: CLASSIFICATION */}
          {activeSection === "classification" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                  Contextual AI Classification Parameters
                </h3>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b" }}>
                  Tweak confidence thresholds, land-cover attribution rules, and spatial polygon search radiuses.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Minimum Classification Confidence (%):
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      value={minConfidence}
                      onChange={(e) => setMinConfidence(Number(e.target.value))}
                      style={{ flex: 1, accentColor: "#16a34a" }}
                    />
                    <span className="mc-mono" style={{ fontSize: "13px", fontWeight: 800, color: "#16a34a", width: "60px" }}>
                      {minConfidence}%
                    </span>
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                    Detections with confidence below {minConfidence}% are flagged as 'Needs Verification' for analyst triage.
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                      Industrial Structure Buffer:
                    </label>
                    <input
                      type="number"
                      step="50"
                      value={facilityBufferMeters}
                      onChange={(e) => setFacilityBufferMeters(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        fontSize: "12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                      }}
                    />
                    <span style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", display: "block" }}>
                      Search radius around industrial OSM footprints (meters)
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                      Cluster Proximity Threshold:
                    </label>
                    <input
                      type="number"
                      value={clusterRadiusKm}
                      onChange={(e) => setClusterRadiusKm(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        fontSize: "12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                      }}
                    />
                    <span style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", display: "block" }}>
                      Radius for grouping regional multi-pixel events (km)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: NOTIFICATIONS */}
          {activeSection === "notifications" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                  Emergency Dispatch &amp; Webhooks
                </h3>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b" }}>
                  Configure automated dispatch channels to State Pollution Control Boards and National Emergency desks.
                </p>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Emergency Webhook Endpoint URL:
                </label>
                <input
                  type="text"
                  value={alertWebhookUrl}
                  onChange={(e) => setAlertWebhookUrl(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "12px",
                    fontFamily: "JetBrains Mono",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    background: "#f8fafc",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label className="mc-layer-item">
                  <input
                    type="checkbox"
                    checked={notifyPollutionBoards}
                    onChange={() => setNotifyPollutionBoards(!notifyPollutionBoards)}
                  />
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                      Notify State Pollution Control Boards (SPCB)
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Dispatches telemetry dossier for industrial spikes exceeding configured thresholds
                    </span>
                  </div>
                </label>

                <label className="mc-layer-item">
                  <input
                    type="checkbox"
                    checked={notifySafetyOfficers}
                    onChange={() => setNotifySafetyOfficers(!notifySafetyOfficers)}
                  />
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                      Alert Facility Safety Officers via SMS/Email
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Sends instant alert for stationary thermal sources within 500m of licensed plants
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* SECTION 5: MAP */}
          {activeSection === "map" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                  Geospatial &amp; Map Layer Preferences
                </h3>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b" }}>
                  Configure base map provider, cluster styles, and viewport boundaries.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Default Base Layer:
                  </label>
                  <select
                    value={defaultBaseMap}
                    onChange={(e) => setDefaultBaseMap(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                    }}
                  >
                    <option value="light">CartoDB Light (High Contrast)</option>
                    <option value="dark">CartoDB Dark Matter</option>
                    <option value="satellite">ESRI World Imagery (Satellite)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Cluster Bubble Radius (Pixels):
                  </label>
                  <input
                    type="number"
                    value={defaultClusterRadius}
                    onChange={(e) => setDefaultClusterRadius(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>

              <label className="mc-layer-item">
                <input
                  type="checkbox"
                  checked={autoCenterIndia}
                  onChange={() => setAutoCenterIndia(!autoCenterIndia)}
                />
                <div>
                  <strong style={{ color: "#0f172a", display: "block", fontSize: "12px" }}>
                    Strict India Territorial Viewport Lock
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Auto-clamps map coordinates strictly to India mainland bounds (68°E to 97.5°E, 6°N to 37.5°N)
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* SECTION 6: USERS / ACCESS */}
          {activeSection === "access" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                  Users, Duty Shifts &amp; Access Controls
                </h3>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b" }}>
                  Manage active operational desk sessions, audit logging, and analyst credentials.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Active Analyst Profile:
                  </label>
                  <input
                    type="text"
                    value={currentAnalystName}
                    onChange={(e) => setCurrentAnalystName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Current Duty Shift:
                  </label>
                  <input
                    type="text"
                    value={shiftHours}
                    onChange={(e) => setShiftHours(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Incident Audit Log Retention (Days):
                </label>
                <input
                  type="number"
                  value={auditLogRetentionDays}
                  onChange={(e) => setAuditLogRetentionDays(Number(e.target.value))}
                  style={{
                    width: "160px",
                    padding: "6px 8px",
                    fontSize: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                  }}
                />
                <span style={{ fontSize: "10.5px", color: "#64748b", marginTop: "2px", display: "block" }}>
                  Stores tamper-evident forensic audit trails of analyst confirmations and overrides.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
