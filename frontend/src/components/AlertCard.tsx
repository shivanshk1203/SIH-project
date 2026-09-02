import { Hotspot } from "../App";

type AlertCardProps = {
  hotspot: Hotspot;
  onClose: () => void;
};

// Same color mapping as Map.tsx, used here for the classification badge.
function classClassName(classification: string) {
  if (classification === "Possible Industrial Fire") return "badge badge--fire";
  if (classification === "Possible Agricultural Burning") return "badge badge--farm";
  if (classification === "Possible Mining/Landfill Fire") return "badge badge--mine";
  if (classification === "Possible Wildfire") return "badge badge--wildfire";
  if (classification === "Normal Thermal Source") return "badge badge--normal";
  return "badge badge--unknown";
}

// Small emoji so the location type is recognizable at a glance,
// matching the glyphs used for the map's land-use layer.
function glyphForLocationType(type: string | null) {
  switch (type) {
    case "industrial": return "🏭";
    case "power_plant": return "⚡";
    case "oil_gas": return "🛢️";
    case "mine": return "⛏️";
    case "landfill": return "🗑️";
    case "farm": return "🌾";
    case "forest": return "🌲";
    case "residential": return "🏘️";
    default: return "❓";
  }
}

function AlertCard({ hotspot, onClose }: AlertCardProps) {
  return (
    <div className="alert-card">
      <button className="alert-card__close" onClick={onClose} aria-label="Close details">
        ×
      </button>

      <span className={classClassName(hotspot.classification)}>{hotspot.classification}</span>
      <p className="alert-card__confidence">Confidence: {hotspot.confidence}% (estimate)</p>

      <dl className="alert-card__details">
        <dt>Coordinates</dt>
        <dd>{hotspot.latitude.toFixed(4)}, {hotspot.longitude.toFixed(4)}</dd>

        <dt>Location Type</dt>
        <dd>
          {glyphForLocationType(hotspot.location_type)}{" "}
          {hotspot.location_type_label ?? "No known land use nearby"}
        </dd>

        <dt>Thermal Intensity</dt>
        <dd>{hotspot.brightness.toFixed(1)}</dd>

        <dt>Detection Time</dt>
        <dd>{hotspot.detected_at}</dd>

        <dt>Nearest Facility</dt>
        <dd>{hotspot.nearest_facility ?? "None found nearby"}</dd>

        <dt>Distance</dt>
        <dd>
          {hotspot.distance_to_facility_m !== null
            ? `${hotspot.distance_to_facility_m} m`
            : "—"}
        </dd>
      </dl>

      <div className="alert-card__reasons">
        <h3>Why?</h3>
        <ul>
          {hotspot.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </div>

      {hotspot.is_demo_data && <p className="alert-card__demo-note">Based on demo data</p>}
    </div>
  );
}

export default AlertCard;
