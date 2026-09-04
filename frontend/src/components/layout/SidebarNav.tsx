import React from "react";

export type NavTab = "dashboard" | "map" | "classification" | "incident" | "alerts" | "reports" | "settings";

interface SidebarNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  criticalAlertCount?: number;
  unresolvedCount?: number;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onTabChange,
  criticalAlertCount = 3,
}) => {
  const navItems: { id: NavTab; label: string; icon: string; badge?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "map", label: "Thermal Map", icon: "map" },
    { id: "classification", label: "AI Classification", icon: "psychology" },
    { id: "incident", label: "Incidents", icon: "local_fire_department" },
    { id: "alerts", label: "Monitoring & Alerts", icon: "notifications_active", badge: criticalAlertCount > 0 ? `${criticalAlertCount}` : undefined },
    { id: "reports", label: "Reports & Analytics", icon: "assessment" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  return (
    <aside className="mc-sidebar">
      {/* Brand Header */}
      <div className="mc-sidebar__header">
        <div className="mc-sidebar__logo-icon">
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            satellite_alt
          </span>
        </div>
        <div className="mc-sidebar__title-wrap">
          <span className="mc-sidebar__app-name">AGNI NETRA</span>
          <span className="mc-sidebar__tagline">Thermal Intelligence</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="mc-sidebar__nav">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              className={`mc-nav-item ${isActive ? "is-active" : ""}`}
              onClick={() => onTabChange(item.id)}
            >
              <div className="mc-nav-item__left">
                <span className="material-symbols-outlined mc-nav-item__icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`mc-nav-badge ${
                    item.id === "alerts" ? "mc-nav-badge--danger" : "mc-nav-badge--neutral"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="mc-sidebar__footer">
        <div className="mc-status-indicator">
          <span className="mc-status-indicator__dot mc-status-indicator__dot--live" />
          <span className="mc-status-indicator__text">System Live</span>
        </div>
        <span className="mc-version-label">v2.4 · India Territory</span>
      </div>
    </aside>
  );
};
