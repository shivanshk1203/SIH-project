import React, { useState, useEffect } from "react";

interface AppHeaderProps {
  onSearchChange?: (query: string) => void;
  onQuickSelectEvent?: (eventId: string) => void;
  activeAlertCount?: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onSearchChange,
  onQuickSelectEvent,
  activeAlertCount = 3,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showNotificationMenu, setShowNotificationMenu] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const istHours = now.toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      setCurrentTime(`${dateStr} · ${istHours} IST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (onSearchChange) onSearchChange(e.target.value);
  };

  return (
    <header className="mc-header">
      {/* Left: Application Branding */}
      <div className="mc-header__left">
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <h1 className="mc-header__title" style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "0.02em" }}>
            AGNI NETRA
          </h1>
          <span style={{ fontSize: "10.5px", color: "#64748b", fontWeight: 500 }}>
            Thermal Intelligence &amp; Detection Platform
          </span>
        </div>
      </div>

      {/* Right: Date/Time, Search, Alerts, Profile */}
      <div className="mc-header__right">
        {/* Live Clock */}
        <div className="mc-header__time-chip">
          <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#2563eb" }}>
            schedule
          </span>
          <span>{currentTime || "03 Sep 2026 · 18:42 IST"}</span>
        </div>

        {/* Search */}
        <div className="mc-header__search">
          <span className="material-symbols-outlined mc-header__search-icon">search</span>
          <input
            type="text"
            className="mc-header__search-input"
            placeholder="Search Event ID, location, facility…"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>

        {/* Notifications Button */}
        <div style={{ position: "relative" }}>
          <button
            className="mc-icon-btn"
            title="Active Thermal Alerts"
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>notifications</span>
            {activeAlertCount > 0 && <span className="mc-icon-btn__badge" />}
          </button>

          {/* Quick Notifications Dropdown */}
          {showNotificationMenu && (
            <div
              style={{
                position: "absolute",
                top: "38px",
                right: 0,
                width: "310px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                zIndex: 1000,
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>ACTIVE ALERTS ({activeAlertCount})</span>
                <span style={{ fontSize: "11px", color: "#2563eb", cursor: "pointer", fontWeight: 600 }} onClick={() => setShowNotificationMenu(false)}>Close</span>
              </div>
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "4px",
                  padding: "8px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (onQuickSelectEvent) onQuickSelectEvent("TH-2381");
                  setShowNotificationMenu(false);
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, color: "#dc2626" }}>
                  <span>TH-2381 · Jamnagar, Gujarat</span>
                  <span>CRITICAL</span>
                </div>
                <div style={{ fontSize: "11px", color: "#7f1d1d", marginTop: "2px" }}>
                  Refinery Thermal Anomaly (5.5× baseline)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Pill */}
        <div className="mc-user-pill">
          <div className="mc-user-avatar">AD</div>
          <span className="mc-user-name">Duty Analyst</span>
        </div>
      </div>
    </header>
  );
};
