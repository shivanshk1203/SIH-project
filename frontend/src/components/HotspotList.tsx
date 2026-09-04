import { Hotspot } from "../App";

type HotspotListProps = {
  hotspots: Hotspot[];
  selectedHotspot: Hotspot | null;
  onSelectHotspot: (hotspot: Hotspot) => void;
};

// Resilient helper that safely maps classification string to marker color dot
function classificationDotClass(classification?: string | null): string {
  if (!classification) return "dot dot--unknown";
  if (classification.includes("Wildfire")) return "dot dot--wildfire";
  if (classification.includes("Agricultural")) return "dot dot--farm";
  if (classification.includes("Industrial")) return "dot dot--industrial";
  if (classification.includes("Mining") || classification.includes("Waste")) return "dot dot--mine";
  if (classification.includes("Controlled")) return "dot dot--controlled";
  if (classification.includes("False Positive") || classification.includes("Sensor")) return "dot dot--glint";
  return "dot dot--unknown";
}

function HotspotList({ hotspots, selectedHotspot, onSelectHotspot }: HotspotListProps) {
  const safeHotspots = Array.isArray(hotspots) ? hotspots : [];

  return (
    <div className="hotspot-list">
      <h2 className="hotspot-list__title">Analyzed Anomalies ({safeHotspots.length})</h2>

      {safeHotspots.length === 0 && (
        <p className="hotspot-list__empty">No thermal anomalies in current view.</p>
      )}

      <ul>
        {safeHotspots.map((hotspot) => {
          if (!hotspot || !hotspot.id) return null;

          const cls = hotspot.classification || "Unknown / Needs Verification";
          const confLabel = hotspot.confidenceLevel || hotspot.analytical_confidence || (hotspot.confidence ? `${hotspot.confidence}%` : "Low");
          const riskLevel = hotspot.risk_level || hotspot.risk?.level || "LOW";
          const riskScore = hotspot.risk_score ?? hotspot.risk?.score ?? 25;
          const natureState = hotspot.thermal_nature || hotspot.thermalNature?.state || "STATIONARY";

          return (
            <li
              key={hotspot.id}
              className={
                "hotspot-item" + (selectedHotspot?.id === hotspot.id ? " hotspot-item--active" : "")
              }
              onClick={() => onSelectHotspot(hotspot)}
            >
              <span className={classificationDotClass(cls)} />
              <div className="hotspot-item__text">
                <div className="hotspot-item__header-line">
                  <span className="hotspot-item__title">{cls}</span>
                  <span className={`risk-mini-badge risk-mini-badge--${riskLevel.toLowerCase()}`}>
                    RISK {riskScore} · {riskLevel}
                  </span>
                </div>

                <div className="hotspot-item__intelligence-sub">
                  <span className="nature-mini-tag">{natureState}</span>
                  <span className="conf-mini-tag">CONF: {confLabel.toUpperCase()}</span>
                  {hotspot.investigation_priority !== undefined && (
                    <span className="priority-mini-tag">PRIORITY {hotspot.investigation_priority}</span>
                  )}
                </div>

                <span className="hotspot-item__subtitle">
                  {hotspot.nearest_settlement
                    ? hotspot.nearest_settlement
                    : `${(hotspot.latitude ?? 0).toFixed(3)}°N, ${(hotspot.longitude ?? 0).toFixed(3)}°E`}
                  {hotspot.trend_description ? ` · ${hotspot.trend_description}` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default HotspotList;
