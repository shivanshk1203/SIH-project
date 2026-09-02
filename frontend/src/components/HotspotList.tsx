import { Hotspot } from "../App";

type HotspotListProps = {
  hotspots: Hotspot[];
  selectedHotspot: Hotspot | null;
  onSelectHotspot: (hotspot: Hotspot) => void;
};

// Maps a classification to a small CSS class so the colored dot matches the map marker.
function classificationDotClass(classification: string) {
  if (classification === "Possible Industrial Fire") return "dot dot--fire";
  if (classification === "Possible Agricultural Burning") return "dot dot--farm";
  if (classification === "Possible Mining/Landfill Fire") return "dot dot--mine";
  if (classification === "Possible Wildfire") return "dot dot--wildfire";
  if (classification === "Normal Thermal Source") return "dot dot--normal";
  return "dot dot--unknown";
}

function HotspotList({ hotspots, selectedHotspot, onSelectHotspot }: HotspotListProps) {
  return (
    <div className="hotspot-list">
      <h2 className="hotspot-list__title">Detected Hotspots</h2>

      {hotspots.length === 0 && <p className="hotspot-list__empty">No hotspots loaded yet.</p>}

      <ul>
        {hotspots.map((hotspot) => (
          <li
            key={hotspot.id}
            className={
              "hotspot-item" + (selectedHotspot?.id === hotspot.id ? " hotspot-item--active" : "")
            }
            onClick={() => onSelectHotspot(hotspot)}
          >
            <span className={classificationDotClass(hotspot.classification)} />
            <div className="hotspot-item__text">
              <span className="hotspot-item__title">{hotspot.classification}</span>
              <span className="hotspot-item__subtitle">
                {hotspot.latitude.toFixed(3)}, {hotspot.longitude.toFixed(3)} · {hotspot.confidence}% conf.
                {hotspot.location_type_label ? ` · ${hotspot.location_type_label}` : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HotspotList;
