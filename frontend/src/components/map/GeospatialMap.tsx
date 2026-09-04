import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Supercluster from "supercluster";
import { ThermalEvent } from "../../types/thermal";

interface GeospatialMapProps {
  events: ThermalEvent[];
  selectedEventId?: string;
  onSelectEvent?: (event: ThermalEvent) => void;
  onViewIncident?: (event: ThermalEvent) => void;
  onAnalyzeEvent?: (event: ThermalEvent) => void;
  onRenderStatsChange?: (stats: { total: number; visible: number; clusters: number }) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  defaultBaseLayer?: "satellite" | "light";
}

// Color palette strictly matching legend
export function getColorForClassification(cls?: string): string {
  if (!cls) return "#7c3aed";
  if (cls.includes("Industrial")) return "#dc2626";
  if (cls.includes("Wildfire")) return "#ea580c";
  if (cls.includes("Agricultural") || cls.includes("Crop")) return "#ca8a04";
  if (cls.includes("Flare")) return "#d97706";
  if (cls.includes("Mining") || cls.includes("Thermal Source")) return "#0891b2";
  return "#7c3aed"; // Unknown
}

export const GeospatialMap: React.FC<GeospatialMapProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  onViewIncident,
  onAnalyzeEvent,
  onRenderStatsChange,
  center = [22.5, 79.5], // Geographic center of India
  zoom = 5,
  height = "100%",
  defaultBaseLayer = "satellite",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const referenceTileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeBaseLayer, setActiveBaseLayer] = useState<"satellite" | "light">(defaultBaseLayer);
  const [mapZoom, setMapZoom] = useState<number>(zoom);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  // Validate coordinates: filter only valid lat/lon so corrupt records never break rendering
  const validEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e &&
        typeof e.coordinates?.[0] === "number" &&
        !isNaN(e.coordinates[0]) &&
        e.coordinates[0] >= -90 &&
        e.coordinates[0] <= 90 &&
        typeof e.coordinates?.[1] === "number" &&
        !isNaN(e.coordinates[1]) &&
        e.coordinates[1] >= -180 &&
        e.coordinates[1] <= 180
    );
  }, [events]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
      minZoom: 4,
      maxZoom: 18,
      maxBounds: [
        [4.0, 65.0], // South-West
        [39.0, 100.0], // North-East
      ],
      maxBoundsViscosity: 0.8,
    });

    // Satellite Base Layer + Labels
    const satLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18 }
    );
    const refLayer = L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, opacity: 0.8 }
    );

    satLayer.addTo(map);
    refLayer.addTo(map);

    baseTileLayerRef.current = satLayer;
    referenceTileLayerRef.current = refLayer;

    // Controls
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomright", metric: true, imperial: false }).addTo(map);

    const markerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markerGroup;
    mapInstanceRef.current = map;

    // Update bounds & zoom state on map moves
    const updateViewport = () => {
      setMapZoom(map.getZoom());
      setMapBounds(map.getBounds());
    };

    map.on("zoomend", updateViewport);
    map.on("moveend", updateViewport);

    // Initial bounds
    setMapBounds(map.getBounds());

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Basemap Switcher
  const switchBaseLayer = (type: "satellite" | "light") => {
    if (!mapInstanceRef.current) return;
    setActiveBaseLayer(type);

    if (baseTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(baseTileLayerRef.current);
    }
    if (referenceTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(referenceTileLayerRef.current);
    }

    if (type === "satellite") {
      const satLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18 }
      ).addTo(mapInstanceRef.current);

      const refLayer = L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18, opacity: 0.8 }
      ).addTo(mapInstanceRef.current);

      baseTileLayerRef.current = satLayer;
      referenceTileLayerRef.current = refLayer;
    } else {
      const lightLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18, attribution: "&copy; Esri &mdash; Esri, DeLorme, NAVTEQ" }
      ).addTo(mapInstanceRef.current);

      baseTileLayerRef.current = lightLayer;
      referenceTileLayerRef.current = null;
    }
  };

  // Build Supercluster Index
  const superclusterIndex = useMemo(() => {
    const cluster = new Supercluster<ThermalEvent, { cluster: boolean }>({
      radius: 50,
      maxZoom: 14,
    });

    const geoJsonPoints: GeoJSON.Feature<GeoJSON.Point, ThermalEvent>[] = validEvents.map((ev) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [ev.coordinates[1], ev.coordinates[0]], // [lon, lat]
      },
      properties: ev,
    }));

    cluster.load(geoJsonPoints);
    return cluster;
  }, [validEvents]);

  // Compute Clusters & Points in Viewport
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    if (!validEvents.length) {
      if (onRenderStatsChange) {
        onRenderStatsChange({ total: 0, visible: 0, clusters: 0 });
      }
      return;
    }

    const bounds = mapBounds || mapInstanceRef.current.getBounds();
    const currentZoom = Math.floor(mapZoom || mapInstanceRef.current.getZoom());

    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];

    let items: any[] = [];
    try {
      items = superclusterIndex.getClusters(bbox, currentZoom);
    } catch (err) {
      console.warn("Supercluster query error, falling back to direct items:", err);
      items = validEvents.map((ev) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [ev.coordinates[1], ev.coordinates[0]] },
        properties: ev,
      }));
    }

    let clusterCount = 0;
    let totalRenderedPoints = 0;

    items.forEach((item) => {
      const [lon, lat] = item.geometry.coordinates;

      // 1. Cluster Marker
      if (item.properties && item.properties.cluster) {
        clusterCount += 1;
        const count = item.properties.point_count;
        totalRenderedPoints += count;
        const clusterId = item.properties.cluster_id;

        let size = 32;
        let badgeBg = "rgba(220, 38, 38, 0.92)";
        if (count >= 50) {
          size = 46;
          badgeBg = "rgba(185, 28, 28, 0.95)";
        } else if (count >= 15) {
          size = 38;
          badgeBg = "rgba(234, 88, 12, 0.92)";
        }

        const clusterHtml = `
          <div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${badgeBg};
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-family: 'JetBrains Mono', monospace;
            font-size: ${count >= 100 ? "11px" : "12px"};
            font-weight: 800;
            cursor: pointer;
            transition: transform 0.15s ease;
          ">
            <span style="font-size: 10px; margin-right: 2px;">🔥</span>${count}
          </div>
        `;

        const clusterIcon = L.divIcon({
          html: clusterHtml,
          className: "mc-supercluster-icon",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const clusterMarker = L.marker([lat, lon], { icon: clusterIcon });

        // Tooltip
        clusterMarker.bindTooltip(
          `<strong>${count} Hotspots</strong> in cluster<br /><span style="font-size: 10px; color: #64748b;">Click to expand cluster</span>`,
          { direction: "top", offset: [0, -size / 2] }
        );

        // Click to expand cluster smoothly
        clusterMarker.on("click", () => {
          if (!mapInstanceRef.current) return;
          try {
            const expansionZoom = superclusterIndex.getClusterExpansionZoom(clusterId);
            mapInstanceRef.current.setView([lat, lon], Math.min(expansionZoom, 16), {
              animate: true,
            });
          } catch {
            mapInstanceRef.current.setView([lat, lon], currentZoom + 2, { animate: true });
          }
        });

        markersLayerRef.current?.addLayer(clusterMarker);
      } else {
        // 2. Individual Hotspot Marker
        totalRenderedPoints += 1;
        const ev = item.properties as ThermalEvent;
        const isSelected = ev.id === selectedEventId;
        const markerColor = getColorForClassification(ev.classification);

        // Marker radius proportional to Fire Radiative Power (FRP)
        let radius = 5;
        if (ev.frpMw >= 60) radius = 9;
        else if (ev.frpMw >= 25) radius = 7.5;
        else if (ev.frpMw >= 10) radius = 6;

        const circle = L.circleMarker([lat, lon], {
          radius: isSelected ? radius + 3 : radius,
          fillColor: markerColor,
          color: isSelected ? "#0f172a" : "#ffffff",
          weight: isSelected ? 2.5 : 1.5,
          fillOpacity: 0.92,
        });

        // Hover tooltip
        circle.bindTooltip(
          `<div style="font-size: 11px;">
            <strong style="color: ${markerColor}">${ev.classification}</strong><br />
            <span>FRP: ${ev.frpMw} MW · Conf: ${ev.confidence}%</span>
          </div>`,
          { direction: "top", offset: [0, -radius] }
        );

        // Click Popup showing real NASA FIRMS fields
        const popupDiv = document.createElement("div");
        popupDiv.className = "mc-map-popup";
        popupDiv.innerHTML = `
          <div class="mc-map-popup__title-row">
            <span class="mc-map-popup__event-id" style="font-size: 11px; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ev.id}">
              ${ev.id}
            </span>
            <span class="mc-badge ${
              ev.severity === "CRITICAL" || ev.severity === "HIGH" ? "mc-badge--critical" : "mc-badge--warning"
            }">
              ${ev.severity}
            </span>
          </div>

          <div class="mc-map-popup__grid">
            <div>
              <div class="mc-popup-label">Classification</div>
              <div class="mc-popup-val" style="color: ${markerColor}">${ev.classification}</div>
            </div>
            <div>
              <div class="mc-popup-label">AI / FIRMS Conf</div>
              <div class="mc-popup-val" style="color: #2563eb">${ev.confidence}%</div>
            </div>
            <div>
              <div class="mc-popup-label">Coordinates</div>
              <div class="mc-popup-val mc-mono" style="font-size: 10px;">${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E</div>
            </div>
            <div>
              <div class="mc-popup-label">Detected Time</div>
              <div class="mc-popup-val mc-mono">${ev.detectedDate}, ${ev.detectedTime}</div>
            </div>
            <div>
              <div class="mc-popup-label">FRP (MW)</div>
              <div class="mc-popup-val mc-mono" style="color: #dc2626; font-weight: 800;">${ev.frpMw} MW</div>
            </div>
            <div>
              <div class="mc-popup-label">Brightness Temp</div>
              <div class="mc-popup-val mc-mono">${ev.brightnessK} K</div>
            </div>
            <div>
              <div class="mc-popup-label">Satellite / Sensor</div>
              <div class="mc-popup-val">${ev.satellite || "VIIRS (Suomi-NPP)"}</div>
            </div>
            <div>
              <div class="mc-popup-label">Day / Night</div>
              <div class="mc-popup-val">${ev.daynight === "N" ? "Night Pass" : "Day Pass"}</div>
            </div>
            <div style="grid-column: span 2">
              <div class="mc-popup-label">Nearest Facility Context</div>
              <div class="mc-popup-val" style="font-size: 10.5px;">${ev.nearestFacility.name} (${ev.nearestFacility.distanceKm} km)</div>
            </div>
          </div>

          <div class="mc-map-popup__actions">
            <button id="btn-view-incident-${ev.id}" class="mc-btn mc-btn--primary" style="flex: 1; padding: 5px 8px; font-size: 11px;">
              <span class="material-symbols-outlined" style="font-size: 13px">visibility</span>
              View Incident
            </button>
            <button id="btn-analyze-${ev.id}" class="mc-btn mc-btn--secondary" style="flex: 1; padding: 5px 8px; font-size: 11px;">
              <span class="material-symbols-outlined" style="font-size: 13px">psychology</span>
              Analyze
            </button>
          </div>
        `;

        circle.bindPopup(popupDiv, {
          maxWidth: 320,
          className: "mc-leaflet-popup",
        });

        circle.on("click", () => {
          if (onSelectEvent) onSelectEvent(ev);
        });

        circle.on("popupopen", () => {
          const btnView = document.getElementById(`btn-view-incident-${ev.id}`);
          const btnAnalyze = document.getElementById(`btn-analyze-${ev.id}`);

          if (btnView && onViewIncident) {
            btnView.onclick = () => onViewIncident(ev);
          }
          if (btnAnalyze && onAnalyzeEvent) {
            btnAnalyze.onclick = () => onAnalyzeEvent(ev);
          }
        });

        markersLayerRef.current?.addLayer(circle);

        if (isSelected) {
          setTimeout(() => {
            circle.openPopup();
          }, 100);
        }
      }
    });

    if (onRenderStatsChange) {
      onRenderStatsChange({
        total: validEvents.length,
        visible: totalRenderedPoints,
        clusters: clusterCount,
      });
    }
  }, [
    validEvents,
    superclusterIndex,
    mapBounds,
    mapZoom,
    selectedEventId,
    onSelectEvent,
    onViewIncident,
    onAnalyzeEvent,
    onRenderStatsChange,
  ]);

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div ref={mapContainerRef} style={{ width: "100%", height }} />

      {/* Top-Right Basemap Switcher */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 500,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(4px)",
          border: "1px solid #cbd5e1",
          borderRadius: "5px",
          padding: "2px",
          display: "flex",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <button
          onClick={() => switchBaseLayer("satellite")}
          style={{
            background: activeBaseLayer === "satellite" ? "#2563eb" : "transparent",
            color: activeBaseLayer === "satellite" ? "#ffffff" : "#475569",
            border: "none",
            borderRadius: "3px",
            padding: "4px 8px",
            fontSize: "10.5px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>satellite_alt</span>
          Satellite
        </button>
        <button
          onClick={() => switchBaseLayer("light")}
          style={{
            background: activeBaseLayer === "light" ? "#2563eb" : "transparent",
            color: activeBaseLayer === "light" ? "#ffffff" : "#475569",
            border: "none",
            borderRadius: "3px",
            padding: "4px 8px",
            fontSize: "10.5px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>map</span>
          Light Map
        </button>
      </div>

      {/* Clean Bottom-Left Legend matching exact marker colors */}
      <div className="mc-gis-legend">
        <div className="mc-legend-item">
          <span className="mc-legend-dot" style={{ background: "#dc2626" }} />
          <span>Industrial Fire</span>
        </div>
        <div className="mc-legend-item">
          <span className="mc-legend-dot" style={{ background: "#ea580c" }} />
          <span>Wildfire</span>
        </div>
        <div className="mc-legend-item">
          <span className="mc-legend-dot" style={{ background: "#ca8a04" }} />
          <span>Agricultural</span>
        </div>
        <div className="mc-legend-item">
          <span className="mc-legend-dot" style={{ background: "#d97706" }} />
          <span>Gas Flare</span>
        </div>
        <div className="mc-legend-item">
          <span className="mc-legend-dot" style={{ background: "#0891b2" }} />
          <span>Mining/Thermal</span>
        </div>
        <div className="mc-legend-item">
          <span className="mc-legend-dot" style={{ background: "#7c3aed" }} />
          <span>Unknown</span>
        </div>
      </div>
    </div>
  );
};
