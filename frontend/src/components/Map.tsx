import TriageCard from "./TriageCard";
import ErrorBoundary from "./ErrorBoundary";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  Circle,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import Supercluster from "supercluster";
import { Facility, Hotspot } from "../App";

// India approximate geographic bounding box and default center
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [4.0, 65.0], // South-West
  [39.0, 100.0], // North-East
];

const DEFAULT_CENTER: [number, number] = [22.5, 79.0]; // Geographic center of India
const DEFAULT_ZOOM = 5;

type MapProps = {
  hotspots: Hotspot[];
  facilities: Facility[];
  selectedHotspot: Hotspot | null;
  investigatingHotspot?: Hotspot | null;
  targetCityCenter?: [number, number] | null;
  onSelectHotspot: (hotspot: Hotspot) => void;
  onStartInvestigation?: (hotspot: Hotspot) => void;
  onExitInvestigation?: () => void;
  onViewportChange?: (bounds: { west: number; south: number; east: number; north: number }) => void;
  onViewDetailedReport?: (hotspot: Hotspot) => void;
  onRenderStatsChange?: (stats: { total: number; valid: number; filtered: number; rendered: number }) => void;
};

// Substring resilient color mapping
export function colorForClassification(classification: string | undefined | null): string {
  if (!classification) return "#ff5a3c"; // Active heat fallback
  if (classification.includes("Wildfire")) return "#E63946";
  if (classification.includes("Agricultural")) return "#E76F51";
  if (classification.includes("Industrial")) return "#7209B7";
  if (classification.includes("Mining") || classification.includes("Waste") || classification.includes("Landfill")) return "#B07D62";
  if (classification.includes("Controlled")) return "#F4A261";
  if (classification.includes("False Positive") || classification.includes("Sensor") || classification.includes("Normal Thermal")) return "#2A9D8F";
  return "#ff5a3c";
}

// Land-use / facility type -> emoji glyph + color
const FACILITY_STYLES: Record<string, { glyph: string; color: string; label: string }> = {
  industrial: { glyph: "🏭", color: "#7C9CFF", label: "Industrial" },
  power_plant: { glyph: "⚡", color: "#FFD166", label: "Power plant" },
  oil_gas: { glyph: "🛢️", color: "#FB8500", label: "Oil / Gas" },
  mine: { glyph: "⛏️", color: "#C084FC", label: "Mine / Quarry" },
  landfill: { glyph: "🗑️", color: "#A8A29E", label: "Landfill" },
  farm: { glyph: "🌾", color: "#86EFAC", label: "Farm" },
  forest: { glyph: "🌲", color: "#4ADE80", label: "Forest" },
  residential: { glyph: "🏘️", color: "#F472B6", label: "Residential" },
  brick_kiln: { glyph: "🧱", color: "#F97316", label: "Brick Kiln" },
  road: { glyph: "🛣️", color: "#94A3B8", label: "Road" },
};

function facilityIcon(type: string) {
  const style = FACILITY_STYLES[type] ?? { glyph: "📍", color: "#aaa", label: type };
  return L.divIcon({
    className: "facility-marker-icon",
    html: `<span style="font-size:16px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));" title="${style.label}">${style.glyph}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function createClusterIcon(count: number) {
  let size = 36;
  let modifier = "cluster-marker--small";
  if (count >= 50) {
    size = 50;
    modifier = "cluster-marker--large";
  } else if (count >= 10) {
    size = 42;
    modifier = "cluster-marker--medium";
  }

  return L.divIcon({
    className: `cluster-marker ${modifier}`,
    html: `<div class="cluster-marker__inner"><span>${count}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const BASE_LAYERS = {
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    fallbackUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  light: {
    label: "Light",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    fallbackUrl: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    fallbackUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye",
  },
} as const;

type BaseLayerKey = keyof typeof BASE_LAYERS;

const LEGEND_ITEMS: { label: string; color: string }[] = [
  { label: "Wildfire", color: "#E63946" },
  { label: "Agricultural", color: "#E76F51" },
  { label: "Industrial Heat", color: "#7209B7" },
  { label: "Mining / Waste", color: "#B07D62" },
  { label: "Controlled", color: "#F4A261" },
  { label: "Sensor Anomaly", color: "#2A9D8F" },
  { label: "Needs Verification", color: "#ff5a3c" },
];

function MapLifecycleManager({
  hotspots,
  onMapReady,
  onViewportChange,
}: {
  hotspots: Hotspot[];
  onMapReady: (map: L.Map) => void;
  onViewportChange?: (bounds: { west: number; south: number; east: number; north: number }) => void;
}) {
  const map = useMap();
  const fittedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onMapReady(map);
    map.invalidateSize();

    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", onResize);
    };
  }, [map, onMapReady]);

  // Automatically fit map to detection bounds when detections load (Requirement 5)
  useEffect(() => {
    if (hotspots.length > 0 && !fittedRef.current) {
      const validPoints = hotspots.filter(
        (h) => typeof h.latitude === "number" && !isNaN(h.latitude) &&
               typeof h.longitude === "number" && !isNaN(h.longitude)
      );
      if (validPoints.length >= 2) {
        const lats = validPoints.map((h) => h.latitude);
        const lons = validPoints.map((h) => h.longitude);
        const south = Math.max(6.0, Math.min(...lats));
        const north = Math.min(37.5, Math.max(...lats));
        const west = Math.max(68.0, Math.min(...lons));
        const east = Math.min(97.5, Math.max(...lons));

        const b = L.latLngBounds([[south, west], [north, east]]);
        map.fitBounds(b, { padding: [40, 40], maxZoom: 8 });
        fittedRef.current = true;
      }
    }
  }, [hotspots, map]);

  const emitBounds = useCallback(() => {
    if (!onViewportChange) return;
    const b = map.getBounds();
    onViewportChange({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
  }, [map, onViewportChange]);

  useMapEvents({
    moveend: () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(emitBounds, 300);
    },
    zoomend: () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(emitBounds, 300);
    },
  });

  return null;
}

function InvestigationFlyTo({ hotspot }: { hotspot: Hotspot | null }) {
  const map = useMap();
  useEffect(() => {
    if (hotspot) {
      map.setView([hotspot.latitude, hotspot.longitude], 14, { animate: true });
    }
  }, [hotspot, map]);
  return null;
}

function CityNavigator({ center }: { center?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 12, { animate: true });
    }
  }, [center, map]);
  return null;
}

function Map({
  hotspots,
  facilities,
  selectedHotspot,
  investigatingHotspot,
  targetCityCenter,
  onSelectHotspot,
  onStartInvestigation,
  onExitInvestigation,
  onViewportChange,
  onViewDetailedReport,
  onRenderStatsChange,
}: MapProps) {
  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>("dark");
  const [showFacilities, setShowFacilities] = useState(true);
  const [showRings, setShowRings] = useState(true);
  const [showNetwork, setShowNetwork] = useState(true);
  const [tileError, setTileError] = useState(false);

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [bounds, setBounds] = useState<L.LatLngBounds>(() =>
    L.latLngBounds([4.0, 65.0], [39.0, 100.0])
  );
  const mapInstanceRef = useRef<L.Map | null>(null);

  const handleMapReady = useCallback((map: L.Map) => {
    mapInstanceRef.current = map;
    setZoom(map.getZoom());
    const b = map.getBounds();
    if (b.isValid()) {
      setBounds(b);
    }

    map.on("zoomend", () => {
      setZoom(map.getZoom());
      const curBounds = map.getBounds();
      if (curBounds.isValid()) setBounds(curBounds);
    });
    map.on("moveend", () => {
      const curBounds = map.getBounds();
      if (curBounds.isValid()) setBounds(curBounds);
    });
  }, []);

  // Filter valid coordinates so invalid coordinates never break rendering (Requirement 6)
  const validHotspots = useMemo(() => {
    return hotspots.filter(
      (h) =>
        h &&
        typeof h.latitude === "number" &&
        !isNaN(h.latitude) &&
        h.latitude >= -90 &&
        h.latitude <= 90 &&
        typeof h.longitude === "number" &&
        !isNaN(h.longitude) &&
        h.longitude >= -180 &&
        h.longitude <= 180
    );
  }, [hotspots]);

  // Supercluster indexing
  const supercluster = useMemo(() => {
    const cluster = new Supercluster({
      radius: 60,
      maxZoom: 14,
    });

    const points: GeoJSON.Feature<GeoJSON.Point, Hotspot>[] = validHotspots.map((h) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [h.longitude, h.latitude],
      },
      properties: h,
    }));

    cluster.load(points);
    return cluster;
  }, [validHotspots]);

  // Viewport clusters with foolproof fallback: NEVER return empty array if hotspots exist!
  const clusters = useMemo(() => {
    if (!validHotspots.length) return [];

    try {
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      const res = supercluster.getClusters(bbox, Math.floor(zoom));
      if (res && res.length > 0) {
        return res;
      }
    } catch (err) {
      console.warn("Supercluster indexing error, falling back to direct rendering:", err);
    }

    // Fallback: render valid hotspots directly as individual features
    return validHotspots.map((h) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [h.longitude, h.latitude],
      },
      properties: h,
      id: h.id,
    }));
  }, [supercluster, bounds, zoom, validHotspots]);

  // Track accurately rendered markers and report up to App (Requirement 7)
  useEffect(() => {
    if (onRenderStatsChange) {
      let renderedPoints = 0;
      for (const c of clusters) {
        if (c.properties && "cluster" in c.properties && c.properties.cluster) {
          renderedPoints += (c.properties as any).point_count || 1;
        } else {
          renderedPoints += 1;
        }
      }
      onRenderStatsChange({
        total: hotspots.length,
        valid: validHotspots.length,
        filtered: hotspots.length,
        rendered: renderedPoints,
      });
    }
  }, [clusters, hotspots.length, validHotspots.length, onRenderStatsChange]);

  const presentFacilityTypes = useMemo(() => {
    const types = new Set<string>();
    for (const f of facilities) {
      types.add(f.type);
    }
    return Array.from(types);
  }, [facilities]);

  return (
    <div
      id="map"
      className={"map-container" + (investigatingHotspot ? " map-container--investigating" : "")}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "500px",
        flex: 1,
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={3}
        maxZoom={18}
        className="leaflet-map"
        style={{
          height: "100%",
          width: "100%",
          minHeight: "500px",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#0b1220",
        }}
      >
        <TileLayer
          key={baseLayer + (tileError ? "-fallback" : "")}
          url={tileError ? BASE_LAYERS[baseLayer].fallbackUrl : BASE_LAYERS[baseLayer].url}
          attribution={BASE_LAYERS[baseLayer].attribution}
          eventHandlers={{
            tileerror: () => {
              console.warn("Tile error encountered on primary URL, switching to fallback");
              setTileError(true);
            },
          }}
        />

        <MapLifecycleManager
          hotspots={validHotspots}
          onMapReady={handleMapReady}
          onViewportChange={onViewportChange}
        />

        <CityNavigator center={targetCityCenter} />
        <InvestigationFlyTo hotspot={investigatingHotspot || null} />

        {/* ================================================================ */}
        {/* PHASE 14: MAP-DRIVEN INVESTIGATION CONCENTRIC DISTANCE RINGS     */}
        {/* ================================================================ */}
        {investigatingHotspot && showRings && (
          <>
            {/* 250m Immediate Source Area */}
            <Circle
              center={[investigatingHotspot.latitude, investigatingHotspot.longitude]}
              radius={250}
              pathOptions={{
                color: "#ef4444",
                weight: 2,
                dashArray: "4, 4",
                fillColor: "#ef4444",
                fillOpacity: 0.1,
              }}
            >
              <Tooltip permanent direction="top" className="ring-tooltip ring-tooltip--250">
                250 m (Immediate)
              </Tooltip>
            </Circle>

            {/* 500m Local Surroundings */}
            <Circle
              center={[investigatingHotspot.latitude, investigatingHotspot.longitude]}
              radius={500}
              pathOptions={{
                color: "#f97316",
                weight: 1.8,
                dashArray: "4, 4",
                fillColor: "#f97316",
                fillOpacity: 0.06,
              }}
            >
              <Tooltip permanent direction="right" className="ring-tooltip ring-tooltip--500">
                500 m (Surroundings)
              </Tooltip>
            </Circle>

            {/* 1.0 km Nearby Context */}
            <Circle
              center={[investigatingHotspot.latitude, investigatingHotspot.longitude]}
              radius={1000}
              pathOptions={{
                color: "#38bdf8",
                weight: 1.5,
                dashArray: "6, 6",
                fillColor: "#38bdf8",
                fillOpacity: 0.04,
              }}
            >
              <Tooltip permanent direction="bottom" className="ring-tooltip ring-tooltip--1km">
                1.0 km (Nearby Context)
              </Tooltip>
            </Circle>

            {/* 2.0 km Extended Regional Context */}
            <Circle
              center={[investigatingHotspot.latitude, investigatingHotspot.longitude]}
              radius={2000}
              pathOptions={{
                color: "#94a3b8",
                weight: 1.2,
                dashArray: "8, 8",
                fillColor: "#94a3b8",
                fillOpacity: 0.02,
              }}
            >
              <Tooltip permanent direction="left" className="ring-tooltip ring-tooltip--2km">
                2.0 km (Extended Context)
              </Tooltip>
            </Circle>
          </>
        )}

        {/* ================================================================ */}
        {/* PHASE 14: CLUSTER NETWORK CONNECTOR LINES (1.0 km)               */}
        {/* ================================================================ */}
        {investigatingHotspot && showNetwork && investigatingHotspot.spatial_analysis?.concurring_points_1km && (
          investigatingHotspot.spatial_analysis.concurring_points_1km.map((pt, idx) => (
            <Polyline
              key={idx}
              positions={[
                [investigatingHotspot.latitude, investigatingHotspot.longitude],
                [pt.latitude, pt.longitude],
              ]}
              pathOptions={{
                color: "#fbbf24",
                weight: 2,
                dashArray: "3, 5",
                opacity: 0.85,
              }}
            />
          ))
        )}

        {/* Facilities layer */}
        {showFacilities &&
          facilities.map((facility, idx) => (
            <Marker
              key={`${facility.type}-${facility.latitude}-${facility.longitude}-${idx}`}
              position={[facility.latitude, facility.longitude]}
              icon={facilityIcon(facility.type)}
            >
              <Popup>
                <div style={{ fontSize: "12px", minWidth: "160px" }}>
                  <strong>{facility.name}</strong>
                  <br />
                  <span style={{ color: "#888" }}>{facility.type_label}</span>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Render Clusters & Hotspots */}
        {clusters.map((cluster) => {
          const [lon, lat] = cluster.geometry.coordinates;
          const isCluster = cluster.properties && "cluster" in cluster.properties && cluster.properties.cluster;

          if (isCluster) {
            const count = (cluster.properties as any).point_count as number;
            const clusterId = cluster.id;

            return (
              <Marker
                key={`cluster-${clusterId}`}
                position={[lat, lon]}
                icon={createClusterIcon(count)}
                eventHandlers={{
                  click: () => {
                    const map = mapInstanceRef.current;
                    if (map && typeof clusterId === "number") {
                      const expansionZoom = Math.min(
                        supercluster.getClusterExpansionZoom(clusterId),
                        16
                      );
                      map.setView([lat, lon], expansionZoom, { animate: true });
                    }
                  },
                }}
              />
            );
          }

          // Individual hotspot
          const hotspot = cluster.properties as Hotspot;
          const isSelected = selectedHotspot?.id === hotspot.id;
          const isInvestigating = investigatingHotspot?.id === hotspot.id;

          return (
            <CircleMarker
              key={hotspot.id}
              center={[hotspot.latitude, hotspot.longitude]}
              radius={isInvestigating ? 14 : isSelected ? 12 : 7}
              pathOptions={{
                color: isInvestigating ? "#38bdf8" : colorForClassification(hotspot.classification),
                fillColor: colorForClassification(hotspot.classification),
                fillOpacity: isInvestigating || isSelected ? 1 : 0.8,
                weight: isInvestigating ? 4 : isSelected ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => onSelectHotspot(hotspot),
              }}
            >
              <Popup className="triage-leaflet-popup" maxWidth={360} minWidth={310}>
                <ErrorBoundary fallbackTitle="Triage Card Unavailable">
                  <TriageCard
                  hotspot={hotspot}
                  onStartInvestigation={(h) => {
                    if (onStartInvestigation) {
                      onStartInvestigation(h);
                    }
                  }}
                  onViewDetailedReport={(h) => {
                    if (onViewDetailedReport) {
                      onViewDetailedReport(h);
                    }
                  }}
                />
                </ErrorBoundary>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Tile warning banner if primary tile layer failed */}
      {tileError && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1001,
            background: "rgba(234, 179, 8, 0.9)",
            color: "#000",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          ⚠️ Primary map tiles slow; using fallback
        </div>
      )}

      {/* Investigation Mode Floating Controls HUD */}
      {investigatingHotspot && (
        <div className="investigation-map-controls">
          <span className="investigation-controls-label">🔍 Investigation Layers:</span>
          <button
            type="button"
            className={"inv-layer-btn" + (showRings ? " inv-layer-btn--active" : "")}
            onClick={() => setShowRings(!showRings)}
          >
            ⭕ Rings (250m-2km)
          </button>
          <button
            type="button"
            className={"inv-layer-btn" + (showNetwork ? " inv-layer-btn--active" : "")}
            onClick={() => setShowNetwork(!showNetwork)}
          >
            🔗 Cluster Lines
          </button>
          <button
            type="button"
            className={"inv-layer-btn" + (showFacilities ? " inv-layer-btn--active" : "")}
            onClick={() => setShowFacilities(!showFacilities)}
          >
            🏭 Facilities
          </button>
          <button
            type="button"
            className={"inv-layer-btn" + (baseLayer === "satellite" ? " inv-layer-btn--active" : "")}
            onClick={() => setBaseLayer(baseLayer === "satellite" ? "dark" : "satellite")}
          >
            🛰️ Satellite Basemap
          </button>
          {onExitInvestigation && (
            <button
              type="button"
              className="inv-layer-btn inv-layer-btn--exit"
              onClick={onExitInvestigation}
            >
              ✕ Exit
            </button>
          )}
        </div>
      )}

      {/* Base layer switcher */}
      <div className="layer-switcher">
        {(Object.keys(BASE_LAYERS) as BaseLayerKey[]).map((key) => (
          <button
            key={key}
            className={"layer-switcher__button" + (baseLayer === key ? " layer-switcher__button--active" : "")}
            onClick={() => {
              setTileError(false);
              setBaseLayer(key);
            }}
          >
            {BASE_LAYERS[key].label}
          </button>
        ))}
        <button
          className={"layer-switcher__button" + (showFacilities ? " layer-switcher__button--active" : "")}
          onClick={() => setShowFacilities((value) => !value)}
          title="Toggle OSM land-use layer"
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
      </div>
    </div>
  );
}

export default Map;
