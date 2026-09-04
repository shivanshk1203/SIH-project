import React, { useState } from "react";

export const SettingsPage: React.FC = () => {
  const [minFrpThreshold, setMinFrpThreshold] = useState<number>(5.0);
  const [minConfidence, setMinConfidence] = useState<number>(75);
  const [viirsNppActive, setViirsNppActive] = useState<boolean>(true);
  const [noaa20Active, setNoaa20Active] = useState<boolean>(true);
  const [modisTerraActive, setModisTerraActive] = useState<boolean>(false);
  const [alertWebhookUrl, setAlertWebhookUrl] = useState<string>("https://emergency.gov.in/api/v1/thermal-alerts");
  const [savedMessage, setSavedMessage] = useState<boolean>(false);

  const handleSave = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  return (
    <div className="mc-page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
            Agni Netra &middot; System Configuration &amp; Sensor Parameters
          </h2>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Real-time thermal ingestion parameters, AI classification thresholds, and dispatch routing
          </span>
        </div>

        <button
          className="mc-btn mc-btn--primary"
          style={{ padding: "8px 16px" }}
          onClick={handleSave}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
            save
          </span>
          Save System Parameters
        </button>
      </div>

      {savedMessage && (
        <div
          style={{
            padding: "8px 14px",
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: "4px",
            color: "#86efac",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          ✓ Sensor thresholds and telemetry hooks successfully synchronized.
        </div>
      )}

      {/* Grid of Setting Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Sensor & Satellite Ingestion */}
        <div className="mc-panel" style={{ padding: "18px" }}>
          <div className="mc-panel-header" style={{ margin: "-18px -18px 16px", padding: "0 18px" }}>
            <span className="mc-panel-header__title">
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#38bdf8" }}>
                satellite_alt
              </span>
              Satellite Constellation Ingestion
            </span>
            <span className="mc-badge mc-badge--normal">Active</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={viirsNppActive}
                onChange={() => setViirsNppActive(!viirsNppActive)}
              />
              <div>
                <strong style={{ color: "#0f172a", display: "block" }}>Suomi-NPP VIIRS (375m NRT)</strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Primary high-resolution thermal detector for India landmass</span>
              </div>
            </label>

            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={noaa20Active}
                onChange={() => setNoaa20Active(!noaa20Active)}
              />
              <div>
                <strong style={{ color: "#0f172a", display: "block" }}>NOAA-20 VIIRS (375m NRT)</strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Secondary complementary orbital pass (approx +50 mins delay)</span>
              </div>
            </label>

            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={modisTerraActive}
                onChange={() => setModisTerraActive(!modisTerraActive)}
              />
              <div>
                <strong style={{ color: "#0f172a", display: "block" }}>MODIS Terra / Aqua (1km)</strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Legacy wide-area infrared baseline verification</span>
              </div>
            </label>

            <div style={{ borderTop: "1px solid #222a3d", paddingTop: "12px", marginTop: "6px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                Minimum Fire Radiative Power (MW FRP) Threshold:
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={minFrpThreshold}
                  onChange={(e) => setMinFrpThreshold(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#38bdf8" }}
                />
                <span className="mc-mono" style={{ fontSize: "14px", fontWeight: 800, color: "#38bdf8", width: "60px" }}>
                  {minFrpThreshold} MW
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Classification & Sensitivity */}
        <div className="mc-panel" style={{ padding: "18px" }}>
          <div className="mc-panel-header" style={{ margin: "-18px -18px 16px", padding: "0 18px" }}>
            <span className="mc-panel-header__title">
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#10b981" }}>
                psychology
              </span>
              AI Classification Engine Parameters
            </span>
            <span className="mc-badge mc-badge--info">v4.2 PROD</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                Classification Confidence Threshold (%):
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#10b981" }}
                />
                <span className="mc-mono" style={{ fontSize: "14px", fontWeight: 800, color: "#10b981", width: "60px" }}>
                  {minConfidence}%
                </span>
              </div>
              <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                Detections below {minConfidence}% will be tagged as 'Unknown / Unverified' for manual inspection.
              </span>
            </div>

            <div style={{ borderTop: "1px solid #222a3d", paddingTop: "12px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                Geospatial Proximity Buffer:
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>Industrial Polygon Buffer:</span>
                  <span className="mc-mono" style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    500 meters
                  </span>
                </div>
                <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>Clustering Proximity:</span>
                  <span className="mc-mono" style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    25 kilometers
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Alert Dispatch Hooks */}
        <div className="mc-panel" style={{ padding: "18px", gridColumn: "span 2" }}>
          <div className="mc-panel-header" style={{ margin: "-18px -18px 16px", padding: "0 18px" }}>
            <span className="mc-panel-header__title">
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#f97316" }}>
                hub
              </span>
              Emergency Dispatch &amp; Webhook Integration
            </span>
            <span className="mc-badge mc-badge--normal">Connected</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                National Emergency Response Webhook URL:
              </label>
              <input
                type="text"
                className="mc-header__search-input"
                style={{ width: "100%", paddingLeft: "10px" }}
                value={alertWebhookUrl}
                onChange={(e) => setAlertWebhookUrl(e.target.value)}
              />
              <span style={{ fontSize: "10px", color: "#64748b", marginTop: "4px", display: "block" }}>
                JSON payload containing coordinates, FRP, and AI confidence dispatched within 5 seconds of detection.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label className="mc-layer-item">
                <input type="checkbox" defaultChecked />
                <span>Auto-generate PDF briefing for High/Critical breaches</span>
              </label>
              <label className="mc-layer-item">
                <input type="checkbox" defaultChecked />
                <span>Notify State Pollution Control Boards for Industrial Spikes</span>
              </label>
              <label className="mc-layer-item">
                <input type="checkbox" defaultChecked />
                <span>Send SMS alert to designated Industrial Safety Officers</span>
              </label>
            </div>
          </div>
        </div>

        {/* About Agni Netra */}
        <div className="mc-panel" style={{ padding: "18px", gridColumn: "span 2" }}>
          <div className="mc-panel-header" style={{ margin: "-18px -18px 16px", padding: "0 18px" }}>
            <span className="mc-panel-header__title">
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#f97316" }}>
                info
              </span>
              About Agni Netra
            </span>
            <span className="mc-badge mc-badge--info">PLATFORM BRIEF</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <strong style={{ fontSize: "13px", color: "#0f172a", display: "block", marginBottom: "4px" }}>
                Agni Netra — Thermal Intelligence &amp; Detection Platform
              </strong>
              <p style={{ fontSize: "12px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                Agni Netra is a thermal intelligence platform for detecting, contextualizing, classifying, and monitoring thermal anomalies.
              </p>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Integrated Telemetry &amp; Geospatial Data Sources
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: "12px", color: "#0f172a", display: "block" }}>NASA FIRMS</strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>VIIRS (S-NPP, NOAA-20, NOAA-21) 375m &amp; MODIS satellite sensor telemetry</span>
                </div>
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: "12px", color: "#0f172a", display: "block" }}>OpenStreetMap &amp; Land Cover</strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>India national industrial polygon boundaries, clusters, and agricultural land cover</span>
                </div>
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: "12px", color: "#0f172a", display: "block" }}>Contextual AI Engine</strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Multi-hypothesis Bayesian classification and automated severity scoring</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
