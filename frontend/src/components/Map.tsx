import { useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Facility, Hotspot } from "../App";

type MapProps = {
  hotspots: Hotspot[];
  facilities: Facility[];
  selectedHotspot: Hotspot | null;
  onSelectHotspot: (hotspot: Hotspot) => void;
};

// Marker color per classification. Kept in one place so it's easy to change.
function colorForClassification(classification: string) {
  if (classification === "Possible Industrial Fire") return "#FF5A3C";
  if (classification === "Possible Agricultural Burning") return "#E8C25A";
  if (classification === "Possible Mining/Landfill Fire") return "#C77DFF";
  if (classification === "Possible Wildfire") return "#FFB238";
  if (classification === "Normal Thermal Source") return "#3DD9C2";
  return "#8B93A7"; // Unknown / Needs Investigation
}

// Land-use / facility type -> emoji glyph + color, shown as its own map layer
// so you can see *where* a hotspot is (industry / farm / mine / etc.), not
// just how it was classified. Sourced from OpenStreetMap via the backend's
// /api/hotspots (facilities[]) and /api/facilities endpoints.
const FACILITY_STYLES: Record<string, { glyph: string; color: string; label: string }> = {
  industrial: { glyph: "🏭", color: "#7C9CFF", label: "Industrial" },
  power_plant: { glyph: "⚡", color: "#FFD166", label: "Power plant" },
  oil_gas: { glyph: "🛢️", color: "#B08968", label: "Oil / gas" },
  mine: { glyph: "⛏️", color: "#C77DFF", label: "Mine / quarry" },
  landfill: { glyph: "🗑️", color: "#9C8A6E", label: "Landfill" },
  farm: { glyph: "🌾", color: "#E8C25A", label: "Farm" },
  forest: { glyph: "🌲", color: "#4C9A5D", label: "Forest" },
  residential: { glyph: "🏘️", color: "#6DAEDB", label: "Residential" },
};

function facilityIcon(type: string) {
  const style = FACILITY_STYLES[type] ?? { glyph: "📍", color: "#8B93A7", label: type };
  return L.divIcon({
    className: "facility-marker",
    html: `<div class="facility-marker__bubble" style="border-color:${style.color}">${style.glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// The different base map styles the user can switch between.
// Each one is just a tile URL + attribution text - no extra libraries needed.
const BASE_LAYERS = {
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  light: {
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
} as const;

type BaseLayerKey = keyof typeof BASE_LAYERS;

const LEGEND_ITEMS: { label: string; color: string }[] = [
  { label: "Industrial Fire", color: colorForClassification("Possible Industrial Fire") },
  { label: "Agricultural Burning", color: colorForClassification("Possible Agricultural Burning") },
  { label: "Mining/Landfill Fire", color: colorForClassification("Possible Mining/Landfill Fire") },
  { label: "Wildfire", color: colorForClassification("Possible Wildfire") },
  { label: "Normal Source", color: colorForClassification("Normal Thermal Source") },
  { label: "Unknown", color: colorForClassification("Unknown / Needs Investigation") },
];

function Map({ hotspots, facilities, selectedHotspot, onSelectHotspot }: MapProps) {
  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>("dark");
  const [showFacilities, setShowFacilities] = useState(true);

  // Default map center: roughly the middle of our demo area (Texas, USA).
  const defaultCenter: [number, number] = [30.0, -96.0];
  const activeLayer = BASE_LAYERS[baseLayer];

  // Which facility types are actually present, so the legend only shows
  // relevant entries instead of every possible OSM category.
  const presentFacilityTypes = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.type))),
    [facilities]
  );

  return (
    <div className="map-wrapper">
      <MapContainer center={defaultCenter} zoom={7} className="leaflet-container">
        <TileLayer url={activeLayer.url} attribution={activeLayer.attribution} />

        {/* Land-use layer from OpenStreetMap: industry, farms, mines, power plants, etc. */}
        {showFacilities &&
          facilities.map((facility, index) => (
            <Marker
              key={`${facility.name}-${index}`}
              position={[facility.latitude, facility.longitude]}
              icon={facilityIcon(facility.type)}
            >
              <Popup>
                <strong>{facility.name}</strong>
                <br />
                {FACILITY_STYLES[facility.type]?.label ?? facility.type_label}
              </Popup>
            </Marker>
          ))}

        {/* Thermal hotspots from NASA FIRMS, classified by detection.py */}
        {hotspots.map((hotspot) => {
          const isSelected = selectedHotspot?.id === hotspot.id;
          return (
            <CircleMarker
              key={hotspot.id}
              center={[hotspot.latitude, hotspot.longitude]}
              radius={isSelected ? 12 : 8}
              pathOptions={{
                color: colorForClassification(hotspot.classification),
                fillColor: colorForClassification(hotspot.classification),
                fillOpacity: 0.75,
                weight: isSelected ? 3 : 1,
              }}
              eventHandlers={{
                click: () => onSelectHotspot(hotspot),
              }}
            >
              <Popup>
                <strong>{hotspot.classification}</strong>
                <br />
                Confidence: {hotspot.confidence}%
                <br />
                Location: {hotspot.location_type_label ?? "No known facility nearby"}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Base layer switcher */}
      <div className="layer-switcher">
        {(Object.keys(BASE_LAYERS) as BaseLayerKey[]).map((key) => (
          <button
            key={key}
            className={"layer-switcher__button" + (baseLayer === key ? " layer-switcher__button--active" : "")}
            onClick={() => setBaseLayer(key)}
          >
            {BASE_LAYERS[key].label}
          </button>
        ))}
        <button
          className={"layer-switcher__button" + (showFacilities ? " layer-switcher__button--active" : "")}
          onClick={() => setShowFacilities((value) => !value)}
          title="Toggle OSM land-use layer (industry, farms, mines, ...)"
        >
          🗺️ Land use
        </button>
      </div>

      {/* Legend */}
      <div className="map-legend">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="map-legend__row">
            <span className="map-legend__dot" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}

        {showFacilities && presentFacilityTypes.length > 0 && (
          <>
            <div className="map-legend__divider" />
            {presentFacilityTypes.map((type) => {
              const style = FACILITY_STYLES[type];
              if (!style) return null;
              return (
                <div key={type} className="map-legend__row">
                  <span className="map-legend__glyph">{style.glyph}</span>
                  {style.label}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export default Map;
