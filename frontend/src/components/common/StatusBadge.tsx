import React from "react";
import { EventClassification, EventSeverity, EventStatus } from "../../types/thermal";

interface SeverityBadgeProps {
  severity: EventSeverity;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const getBadgeClass = () => {
    switch (severity) {
      case "CRITICAL":
        return "mc-badge--critical";
      case "HIGH":
        return "mc-badge--high";
      case "WARNING":
      case "MODERATE":
        return "mc-badge--warning";
      case "LOW":
      case "NORMAL":
        return "mc-badge--normal";
      default:
        return "mc-badge--info";
    }
  };

  return (
    <span className={`mc-badge ${getBadgeClass()}`}>
      <span className="material-symbols-outlined" style={{ fontSize: "12px", lineHeight: 1 }}>
        {severity === "CRITICAL" ? "report" : severity === "HIGH" ? "warning" : "info"}
      </span>
      {severity}
    </span>
  );
};

interface ClassificationTagProps {
  classification: EventClassification;
}

export const ClassificationTag: React.FC<ClassificationTagProps> = ({ classification }) => {
  const getTagClass = () => {
    switch (classification) {
      case "Industrial Heat":
      case "Industrial Fire":
        return "mc-class-tag--industrial-fire";
      case "Wildfire":
        return "mc-class-tag--wildfire";
      case "Agricultural Burning":
        return "mc-class-tag--agricultural";
      case "Mining / Waste Heat":
        return "mc-class-tag--mining";
      case "Controlled Burning":
        return "mc-class-tag--gas-flare";
      case "Gas Flare":
        return "mc-class-tag--gas-flare";
      case "Other Thermal Source":
        return "mc-class-tag--sensor";
      case "Needs Verification":
      default:
        return "mc-class-tag--unknown";
    }
  };

  const getIcon = () => {
    switch (classification) {
      case "Industrial Heat":
      case "Industrial Fire":
        return "factory";
      case "Wildfire":
        return "forest";
      case "Agricultural Burning":
        return "agriculture";
      case "Mining / Waste Heat":
        return "construction";
      case "Controlled Burning":
        return "fireplace";
      case "Gas Flare":
        return "flare";
      case "Other Thermal Source":
        return "sensors";
      case "Needs Verification":
      default:
        return "help_outline";
    }
  };

  return (
    <span className={`mc-class-tag ${getTagClass()}`}>
      <span className="material-symbols-outlined" style={{ fontSize: "14px", lineHeight: 1 }}>
        {getIcon()}
      </span>
      {classification}
    </span>
  );
};

interface StatusPillProps {
  status: EventStatus;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  let badgeStyle = "mc-badge--info";
  if (status === "Active") badgeStyle = "mc-badge--critical";
  if (status === "Investigating") badgeStyle = "mc-badge--warning";
  if (status === "Resolved") badgeStyle = "mc-badge--normal";
  if (status === "Under Observation") badgeStyle = "mc-badge--info";

  return <span className={`mc-badge ${badgeStyle}`}>{status}</span>;
};
