import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Supercluster from "supercluster";
import { ThermalEvent } from "../../types/thermal";

export type MapStyleKey = "dark" | "light" | "satellite";

export type CanonicalClassification =
  | "Wildfire"
  | "Agricultural"
  | "Industrial Heat"
  | "Mining / Waste Heat"
  | "Controlled Burning"
  | "Sensor Anomaly"
  | "Needs Verification";

// Unified color system matching Dashboard, filters, legend, and popups (Requirement 5)
export const CLASSIFICATION_META: Record<
  CanonicalClassification,
  { label: string; shortLabel: string; color: string; badgeClass: string }
> = {
  "Wildfire": { label: "Wildfire", shortLabel: "Wildfire", color: "#ea580c", badgeClass: "mc-class-tag--wildfire" },
  "Agricultural": { label: "Agricultural Burning", shortLabel: "Agricultural", color: "#16a34a", badgeClass: "mc-class-tag--agricultural" },
  "Industrial Heat": { label: "Industrial Heat", shortLabel: "Industrial Heat", color: "#7c3aed", badgeClass: "mc-class-tag--industrial-fire" },
  "Mining / Waste Heat": { label: "Mining / Waste Heat", shortLabel: "Mining/Waste", color: "#92400e", badgeClass: "mc-class-tag--mining" },
  "Controlled Burning": { label: "Controlled Burning", shortLabel: "Controlled", color: "#f59e0b", badgeClass: "mc-class-tag--gas-flare" },
  "Sensor Anomaly": { label: "Sensor Anomaly", shortLabel: "Sensor Anomaly", color: "#0891b2", badgeClass: "mc-class-tag--sensor" },
  "Needs Verification": { label: "Needs Verification", shortLabel: "Verification", color: "#64748b", badgeClass: "mc-class-tag--unknown" },
};

export function getCanonicalCategory(classification?: string): CanonicalClassification {
  if (!classification) return "Needs Verification";
  const c = classification.toLowerCase();
  if (c.includes("wildfire") || c.includes("forest")) return "Wildfire";
  if (c.includes("agri") || c.includes("crop") || c.includes("stubble")) return "Agricultural";
  if (c.includes("industrial") || c.includes("flare") || c.includes("refinery") || c.includes("power")) return "Industrial Heat";
  if (c.includes("mining") || c.includes("waste") || c.includes("landfill")) return "Mining / Waste Heat";
  if (c.includes("controlled") || c.includes("prescribed")) return "Controlled Burning";
  if (c.includes("sensor") || c.includes("false positive") || c.includes("anomaly") || c.includes("glint") || c.includes("other")) return "Sensor Anomaly";
  return "Needs Verification";
}

function formatCompactId(id: string): string {
  if (!id) return "FIRMS-N/A";
  const match = id.match(/^(?:firms-)?([0-9]+\.[0-9]{3,4})/i);
  if (match) return `FIRMS-${match[1]}`;
  if (id.startsWith("TH-") || id.startsWith("FIRMS-")) return id.length > 14 ? id.slice(0, 14) : id;
  return id.length > 14 ? `${id.slice(0, 13)}…` : id;
}

// High-contrast, clean basemaps without API key errors
// Light: Standard OpenStreetMap (no API key required)
// Dark: Esri World Dark Gray Canvas (no API key required)
// Satellite: Esri World Imagery (no API key required)
const MAP_STYLES = {
  light: {
    label: "Light",
    icon: "light_mode",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    refUrl: "",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
  dark: {
    label: "Dark",
    icon: "dark_mode",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    subdomains: "abc",
    refUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxNativeZoom: 16,
  },
  satellite: {
    label: "Satellite",
    icon: "satellite_alt",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: "abc",
    refUrl: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxNativeZoom: 18,
  },
} as const;

// Requirement 1 & 7: Calibrated India Territorial Bounding Box ensuring India dominates the viewport
const INDIA_BOUNDS = L.latLngBounds([8.0, 68.0], [35.5, 96.5]);
const INDIA_CENTER: [number, number] = [21.8, 80.5];
const INDIA_DEFAULT_ZOOM = 5;

interface ClusterAccumulator {
  cluster: boolean;
  wildfireCount: number;
  agriCount: number;
  indCount: number;
  miningCount: number;
  ctrlCount: number;
  anomalyCount: number;
  verifyCount: number;
}

interface ThermalHotspotMapProps {
  events: ThermalEvent[];
  selectedEventId?: string;
  focusCoordinates?: [number, number] | null;
  onSelectEvent?: (event: ThermalEvent) => void;
  onViewIncident?: (event: ThermalEvent) => void;
  onAnalyzeEvent?: (event: ThermalEvent) => void;
  onRenderStatsChange?: (stats: { total: number; visible: number; clusters: number }) => void;
  defaultStyle?: MapStyleKey;
}

export const ThermalHotspotMap: React.FC<ThermalHotspotMapProps> = ({
  events = [],
  selectedEventId,
  focusCoordinates,
  onSelectEvent,
  onViewIncident,
  onAnalyzeEvent,
  onRenderStatsChange,
  defaultStyle = "light",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const refTileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeStyle, setActiveStyle] = useState<MapStyleKey>(defaultStyle);
  const [mapZoom, setMapZoom] = useState<number>(5);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [basemapUnavailable, setBasemapUnavailable] = useState<boolean>(false);

  // Validate coordinates: keep 100% of valid FIRMS detections (Requirement 3)
  const validEvents = useMemo(() => {
    return events.filter(
      (ev) =>
        ev &&
        Array.isArray(ev.coordinates) &&
        ev.coordinates.length === 2 &&
        !isNaN(ev.coordinates[0]) &&
        !isNaN(ev.coordinates[1]) &&
        ev.coordinates[0] !== 0
    );
  }, [events]);

  // Dynamic counts for compact bottom legend (Requirement 10)
  const legendCounts = useMemo(() => {
    const counts: Record<CanonicalClassification, number> = {
      "Wildfire": 0,
      "Agricultural": 0,
      "Industrial Heat": 0,
      "Mining / Waste Heat": 0,
      "Controlled Burning": 0,
      "Sensor Anomaly": 0,
      "Needs Verification": 0,
    };
    validEvents.forEach((ev) => {
      const cat = getCanonicalCategory(ev.classification);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [validEvents]);

  const onSelectEventRef = useRef(onSelectEvent);
  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
  }, [onSelectEvent]);

  // Requirement 1 & 7: Initialize Map with India as the dominant viewport
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Defensively destroy any existing Leaflet map on this container
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn("Previous map remove error:", e);
      }
      mapInstanceRef.current = null;
    }

    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: INDIA_DEFAULT_ZOOM,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      minZoom: 4,
      maxZoom: 18,
    });

    // Create dedicated Leaflet panes with explicit z-index hierarchy
    // TileLayer lives in default tilePane (z-index 200)
    if (!map.getPane("hotspotClusterPane")) {
      const clusterPane = map.createPane("hotspotClusterPane");
      clusterPane.style.zIndex = "550";
    }
    if (!map.getPane("hotspotMarkerPane")) {
      const markerPane = map.createPane("hotspotMarkerPane");
      markerPane.style.zIndex = "600";
    }

    // Fit directly to India territorial bounds with safe fallback
    try {
      map.fitBounds(INDIA_BOUNDS, { padding: [15, 15] });
    } catch {
      map.setView(INDIA_CENTER, INDIA_DEFAULT_ZOOM);
    }

    mapInstanceRef.current = map;

    // Ensure map tiles and container sizing stabilize smoothly
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {}
      }
    }, 150);

    // Base Tile Layer
    const config = MAP_STYLES[defaultStyle];
    const base = L.tileLayer(config.url, {
      attribution: config.attribution,
      subdomains: (config as any).subdomains || "abc",
      maxNativeZoom: config.maxNativeZoom,
      maxZoom: 19,
      className: defaultStyle === "light" ? "mc-map-tiles-light" : "",
    });
    base.on("tileerror", () => {
      setBasemapUnavailable(true);
    });
    base.addTo(map);
    baseTileLayerRef.current = base;

    // Reference boundary / place labels overlay
    if (config.refUrl) {
      const ref = L.tileLayer(config.refUrl, {
        maxNativeZoom: config.maxNativeZoom,
        maxZoom: 19,
        opacity: 0.85,
      }).addTo(map);
      refTileLayerRef.current = ref;
    }

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    const onZoom = () => {
      setMapZoom(map.getZoom());
    };

    map.on("zoomend", onZoom);

    // Requirement 8: Clicking map background deselects any active hotspot
    const onMapClick = () => {
      if (onSelectEventRef.current) {
        onSelectEventRef.current(null as any);
      }
    };
    map.on("click", onMapClick);

    setMapZoom(map.getZoom());
    setMapReady(true);

    return () => {
      clearTimeout(timer);
      setMapReady(false);

      if (markersLayerRef.current) {
        try {
          markersLayerRef.current.clearLayers();
        } catch {}
        markersLayerRef.current = null;
      }
      baseTileLayerRef.current = null;
      refTileLayerRef.current = null;

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn("Map cleanup error:", e);
        }
        mapInstanceRef.current = null;
      }

      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // Center map on explicitly focused coordinates (e.g. from search selection)
  useEffect(() => {
    if (focusCoordinates && mapInstanceRef.current) {
      mapInstanceRef.current.setView(focusCoordinates, Math.max(mapInstanceRef.current.getZoom(), 11), { animate: true });
    }
  }, [focusCoordinates]);

  // Requirement 11: Switch Style in-place without losing or duplicating markers
  const switchStyle = (style: MapStyleKey) => {
    if (!mapInstanceRef.current) return;
    setActiveStyle(style);
    setBasemapUnavailable(false);

    if (baseTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (refTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(refTileLayerRef.current);
      refTileLayerRef.current = null;
    }

    const config = MAP_STYLES[style];
    const base = L.tileLayer(config.url, {
      attribution: config.attribution,
      subdomains: (config as any).subdomains || "abc",
      maxNativeZoom: config.maxNativeZoom,
      maxZoom: 19,
      className: style === "light" ? "mc-map-tiles-light" : "",
    });
    base.on("tileerror", () => {
      setBasemapUnavailable(true);
    });
    base.addTo(mapInstanceRef.current);
    baseTileLayerRef.current = base;

    if (config.refUrl) {
      const ref = L.tileLayer(config.refUrl, {
        maxNativeZoom: config.maxNativeZoom,
        maxZoom: 19,
        opacity: 0.85,
      }).addTo(mapInstanceRef.current);
      refTileLayerRef.current = ref;
    }
  };

  // Zoom controls and Reset India View (Requirements 1 & 11)
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };
  const handleResetIndiaView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(INDIA_BOUNDS, { padding: [15, 15], animate: true });
    }
  };

  // Supercluster configuration with exact category accumulation (Requirements 1, 3 & 4)
  const clusterIndex = useMemo(() => {
    const sc = new Supercluster<ThermalEvent, ClusterAccumulator>({
      radius: 36, // Calibrated so clusters are compact, proportional and do not visually dominate
      maxZoom: 13, // Detections cleanly separate into individual hotspots at zoom 13+
      map: (props) => {
        const cat = getCanonicalCategory(props.classification);
        return {
          cluster: false,
          wildfireCount: cat === "Wildfire" ? 1 : 0,
          agriCount: cat === "Agricultural" ? 1 : 0,
          indCount: cat === "Industrial Heat" ? 1 : 0,
          miningCount: cat === "Mining / Waste Heat" ? 1 : 0,
          ctrlCount: cat === "Controlled Burning" ? 1 : 0,
          anomalyCount: cat === "Sensor Anomaly" ? 1 : 0,
          verifyCount: cat === "Needs Verification" ? 1 : 0,
        };
      },
      reduce: (acc, props) => {
        acc.wildfireCount += props.wildfireCount;
        acc.agriCount += props.agriCount;
        acc.indCount += props.indCount;
        acc.miningCount += props.miningCount;
        acc.ctrlCount += props.ctrlCount;
        acc.anomalyCount += props.anomalyCount;
        acc.verifyCount += props.verifyCount;
      },
    });

    const points: GeoJSON.Feature<GeoJSON.Point, ThermalEvent>[] = validEvents.map((ev) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [ev.coordinates[1], ev.coordinates[0]],
      },
      properties: ev,
    }));

    sc.load(points);
    return sc;
  }, [validEvents]);  // Requirement 2 & 4: Render clusters and individual markers without losing any detections
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersLayerRef.current) return;

    try {
      markersLayerRef.current.clearLayers();

      if (!validEvents.length) {
        if (onRenderStatsChange) onRenderStatsChange({ total: 0, visible: 0, clusters: 0 });
        return;
      }

      const currentZoom = Math.floor(mapZoom || mapInstanceRef.current.getZoom());

      // Query across global coordinates so no detections are accidentally clipped while panning
      let items: any[] = [];
      try {
        items = clusterIndex.getClusters([-180, -85, 180, 85], currentZoom);
      } catch {
        items = validEvents.map((ev) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [ev.coordinates[1], ev.coordinates[0]] },
          properties: ev,
        }));
      }

      let clustersCount = 0;
      let visiblePoints = 0;

      items.forEach((item) => {
        const [lon, lat] = item.geometry.coordinates;

        if (item.properties && item.properties.cluster) {
          clustersCount += 1;
          const count = item.properties.point_count;
          visiblePoints += count;
          const clusterId = item.properties.cluster_id;

          // Categories present in this cluster (Requirement 2 & 3)
          const categories = [
            { name: "Agricultural Burning", shortLabel: "Agricultural", count: item.properties.agriCount || 0, color: "#16a34a" },
            { name: "Industrial Heat", shortLabel: "Industrial Heat", count: item.properties.indCount || 0, color: "#7c3aed" },
            { name: "Wildfire", shortLabel: "Wildfire", count: item.properties.wildfireCount || 0, color: "#ea580c" },
            { name: "Mining / Waste Heat", shortLabel: "Mining/Waste", count: item.properties.miningCount || 0, color: "#92400e" },
            { name: "Controlled Burning", shortLabel: "Controlled", count: item.properties.ctrlCount || 0, color: "#f59e0b" },
            { name: "Sensor Anomaly", shortLabel: "Sensor Anomaly", count: item.properties.anomalyCount || 0, color: "#0891b2" },
            { name: "Needs Verification", shortLabel: "Verification", count: item.properties.verifyCount || 0, color: "#64748b" },
          ].filter((c) => c.count > 0);

          const isSingle = categories.length === 1;

          // Proportional cluster bubble sizing (Requirement 1)
          let size = 24;
          if (count >= 50) size = 32;
          else if (count >= 15) size = 28;

          let clusterHtml = "";

          if (isSingle) {
            // Requirement 1 & 2: Single classification cluster uses canonical color & proportional size
            const singleCat = categories[0];
            clusterHtml = `
              <div style="
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background: ${singleCat.color};
                border: 2px solid #ffffff;
                box-shadow: 0 0 0 2px ${singleCat.color}66, 0 3px 8px rgba(0,0,0,0.28);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                user-select: none;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
              ">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: ${count >= 100 ? '9.5px' : '11px'}; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                  ${count}
                </span>
              </div>
            `;
          } else {
            // Requirement 1 & 2: Proportional segmented ring composition for mixed clusters
            let angleAcc = 0;
            const gradientSegments = categories.map((c) => {
              const start = angleAcc;
              const slice = (c.count / count) * 360;
              angleAcc += slice;
              return `${c.color} ${start.toFixed(1)}deg ${angleAcc.toFixed(1)}deg`;
            }).join(", ");

            clusterHtml = `
              <div style="
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background: conic-gradient(${gradientSegments});
                padding: 2.5px;
                box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.4), 0 3px 10px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                user-select: none;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
              ">
                <div style="
                  width: 100%;
                  height: 100%;
                  border-radius: 50%;
                  background: #0f172a;
                  border: 1px solid rgba(255,255,255,0.4);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  line-height: 1;
                ">
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: ${count >= 100 ? '9px' : '10.5px'}; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                    ${count}
                  </span>
                  <div style="display: flex; gap: 1.5px; align-items: center; margin-top: 1px;">
                    ${categories.slice(0, 3).map(c => `<span style="width: 3px; height: 3px; border-radius: 50%; background: ${c.color}; display: inline-block;"></span>`).join('')}
                  </div>
                </div>
              </div>
            `;
          }

          const clusterIcon = L.divIcon({
            html: clusterHtml,
            className: "mc-supercluster-icon",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });

          const clusterMarker = L.marker([lat, lon], {
            icon: clusterIcon,
            pane: "hotspotClusterPane",
          });

          // Tooltip showing clear breakdown and click-to-zoom hint (Requirement 1 & 2)
          const breakdownSummary = categories.map(c => `${c.shortLabel || c.name}: ${c.count}`).join(" &middot; ");
          clusterMarker.bindTooltip(
            `<div style="font-size: 11px; line-height: 1.4; padding: 2px 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">
                ${count} Detections <span style="font-weight: 500; color: #64748b; font-size: 10px;">(${isSingle ? categories[0].name : `${categories.length} Types`})</span>
              </div>
              <div style="font-size: 10px; color: #475569; max-width: 250px; margin-bottom: 3px;">
                ${breakdownSummary}
              </div>
              <div style="font-size: 9.5px; font-weight: 700; color: #2563eb;">
                Click to zoom into cluster &rarr;
              </div>
            </div>`,
            { direction: "top", offset: [0, -size / 2 - 2] }
          );

          // Requirement 1: Clicking cluster zooms into it and reveals individual detections (DOES NOT select a hotspot!)
          clusterMarker.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            if (!mapInstanceRef.current) return;
            try {
              const expZoom = clusterIndex.getClusterExpansionZoom(clusterId);
              const targetZoom = Math.max(currentZoom + 1, Math.min(expZoom, 15));
              mapInstanceRef.current.setView([lat, lon], targetZoom, { animate: true });
            } catch {
              mapInstanceRef.current.setView([lat, lon], currentZoom + 2, { animate: true });
            }
          });

          markersLayerRef.current?.addLayer(clusterMarker);
        } else {
          // Individual Hotspot Marker (Requirements 1, 2, 5, 14)
          visiblePoints += 1;
          const ev = item.properties as ThermalEvent;
          const category = getCanonicalCategory(ev?.classification);
          const meta = CLASSIFICATION_META[category] || CLASSIFICATION_META["Needs Verification"];
          const isSelected = ev?.id === selectedEventId;

          // Scaled cleanly by Fire Radiative Power (FRP)
          const frp = typeof ev?.frpMw === "number" ? ev.frpMw : 0;
          let radius = 6;
          if (frp >= 50) radius = 8.5;
          else if (frp >= 15) radius = 7.5;
          else if (frp >= 8) radius = 6.5;

          const circle = L.circleMarker([lat, lon], {
            radius: isSelected ? radius + 3.5 : radius,
            fillColor: meta.color,
            color: isSelected ? "#2563eb" : "#ffffff",
            weight: isSelected ? 3.5 : 1.5,
            fillOpacity: 0.95,
            pane: "hotspotMarkerPane",
          });

          // Requirement 14: Hover tooltip with Detection ID, Location, Classification, FRP, and Classification Confidence
          const loc = ev?.locationName || (ev?.state ? `${ev.state}, India` : "India");
          const classConf = ev?.classificationConfidence || 75;
          const firmsConf = ev?.firmsConfidence || ev?.confidence || 0;

          circle.bindTooltip(
            `<div style="font-size: 11px; line-height: 1.4; padding: 3px 5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 175px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px;">
                <span style="color: #2563eb; font-family: monospace; font-weight: 800; font-size: 11.5px;">${formatCompactId(ev?.id)}</span>
                <span style="font-size: 9.5px; font-weight: 800; color: ${meta.color}; background: ${meta.color}15; padding: 1px 5px; border-radius: 3px; border: 1px solid ${meta.color}35;">${meta.label}</span>
              </div>
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${loc}</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 3px; margin-bottom: 2px;">
                <div>FRP: <strong style="color: #dc2626;">${frp.toFixed(1)} MW</strong></div>
                <div>AI Conf: <strong style="color: #1e40af;">${classConf}%</strong></div>
              </div>
              <div style="font-size: 9.5px; color: #64748b;">
                FIRMS Confidence: <strong style="color: #0f172a;">${firmsConf}%</strong>
              </div>
            </div>`,
            { direction: "top", offset: [0, -radius - 2] }
          );

          // Requirement 9: Real Classification Evidence only if present in data
          const realEvidence = (ev.evidenceList && ev.evidenceList.length > 0)
            ? ev.evidenceList
            : (ev.supportingEvidence && ev.supportingEvidence.length > 0)
            ? ev.supportingEvidence
            : [];

          const evidenceSectionHtml = realEvidence.length > 0
            ? `
              <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.03em;">
                  Classification Evidence
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  ${realEvidence.slice(0, 3).map((itemText: string) => `
                    <div style="display: flex; align-items: flex-start; gap: 5px; font-size: 10px; color: #334155; line-height: 1.3;">
                      <span style="color: #16a34a; font-weight: 700; font-size: 11px; line-height: 1;">✓</span>
                      <span>${itemText}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `
            : "";

          const classConfVal = ev.classificationConfidence || 75;
          const classConfTier = classConfVal >= 80 ? "High confidence" : classConfVal >= 60 ? "Moderate confidence" : "Low confidence";

          const popupDiv = document.createElement("div");
          popupDiv.className = "mc-map-popup";
          popupDiv.innerHTML = `
            <div class="mc-map-popup__title-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span class="mc-map-popup__event-id" style="font-size: 12.5px; font-weight: 800; color: #2563eb;" title="${ev.id}">
                ${formatCompactId(ev.id)}
              </span>
              <span class="mc-badge ${
                ev.severity === "CRITICAL" || ev.severity === "HIGH" ? "mc-badge--critical" : "mc-badge--warning"
              }">
                ${ev.severity}
              </span>
            </div>

            <div style="font-size: 11.5px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
              ${ev.locationName}
            </div>

            <!-- Classification & Confidence (Our System) -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Classification</span>
                <span style="font-size: 11px; font-weight: 800; color: ${meta.color};">${meta.label}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10.5px;">
                <span style="color: #64748b;">Classification Confidence:</span>
                <span style="font-weight: 700; color: #1e40af;">${classConfVal}% <span style="font-weight: 500; color: #64748b; font-size: 10px;">(${classConfTier})</span></span>
              </div>
            </div>

            <!-- NASA FIRMS Observation Section -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; font-size: 10.5px; display: flex; flex-direction: column; gap: 3px;">
              <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 1px;">
                NASA FIRMS Telemetry
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <div>
                  <span style="color: #64748b;">FRP:</span>
                  <span style="font-weight: 700; color: #dc2626; margin-left: 4px;">${frp.toFixed(1)} MW</span>
                </div>
                <div>
                  <span style="color: #64748b;">FIRMS Conf:</span>
                  <span style="font-weight: 700; color: #0f172a; margin-left: 4px;">${ev?.firmsConfidence || ev?.confidence || 0}%</span>
                </div>
              </div>
              <div style="color: #475569; font-size: 10px; margin-top: 1px;">
                Observation: <strong>${ev?.detectedTime || "NRT"}</strong> &middot; ${ev?.daynight === "N" ? "Night Pass" : "Day Pass"}
              </div>
              ${ev.nearestFacility ? `
              <div style="color: #475569; font-size: 10px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${ev.nearestFacility.name}">
                Nearby Facility: <strong>${ev.nearestFacility.name}</strong> (${ev.nearestFacility.distanceKm} km)
              </div>
              ` : ""}
            </div>

            ${evidenceSectionHtml}

            <div class="mc-map-popup__actions" style="margin-top: 8px;">
              <button id="btn-view-incident-${ev.id}" class="mc-btn mc-btn--primary" style="width: 100%; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer; border-radius: 4px;">
                View Full Incident Record &rarr;
              </button>
            </div>
          `;

          circle.bindPopup(popupDiv, { maxWidth: 300, className: "mc-leaflet-popup", autoPan: false });

          circle.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            if (onSelectEvent) onSelectEvent(ev);
          });

          circle.on("popupopen", () => {
            const btnView = document.getElementById(`btn-view-incident-${ev.id}`);
            if (btnView && onViewIncident) {
              btnView.onclick = () => onViewIncident(ev);
            }
          });

          markersLayerRef.current?.addLayer(circle);
        }
      });

      if (onRenderStatsChange) {
        onRenderStatsChange({
          total: validEvents.length,
          visible: visiblePoints,
          clusters: clustersCount,
        });
      }
    } catch (err) {
      console.error("[ThermalHotspotMap] Error rendering hotspot markers:", err);
    }
  }, [mapReady, validEvents, clusterIndex, mapZoom, selectedEventId, onSelectEvent, onViewIncident, onAnalyzeEvent, onRenderStatsChange]);

  // Sorted categories for compact bottom legend: active first (Requirement 12)
  const sortedLegendEntries = useMemo(() => {
    const entries = Object.entries(CLASSIFICATION_META) as [CanonicalClassification, typeof CLASSIFICATION_META[CanonicalClassification]][];
    return entries.sort((a, b) => {
      const countA = legendCounts[a[0]] || 0;
      const countB = legendCounts[b[0]] || 0;
      if (countA > 0 && countB === 0) return -1;
      if (countA === 0 && countB > 0) return 1;
      return countB - countA;
    });
  }, [legendCounts]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Requirement 15: Map Status Indicator (clean, unobtrusive) */}
      <div
        style={{
          position: "absolute",
          top: "14px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 500,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(6px)",
          border: "1px solid #cbd5e1",
          borderRadius: "20px",
          padding: "4px 12px",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          boxShadow: "var(--mc-shadow-sm)",
          fontSize: "11px",
          fontWeight: 600,
          color: "#1e293b",
          pointerEvents: "none",
        }}
      >
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
        <span>
          <strong>{validEvents.length}</strong> detections visible &middot; Data: NASA FIRMS
        </span>
      </div>

      {/* Map Style Switcher (Dark / Light / Satellite) */}
      <div className="mc-style-switcher">
        <button
          className={`mc-style-btn ${activeStyle === "light" ? "is-active" : ""}`}
          onClick={() => switchStyle("light")}
          title="OpenStreetMap Standard"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>light_mode</span>
          Light
        </button>

        <button
          className={`mc-style-btn ${activeStyle === "dark" ? "is-active" : ""}`}
          onClick={() => switchStyle("dark")}
          title="Esri World Dark Gray Canvas"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>dark_mode</span>
          Dark
        </button>

        <button
          className={`mc-style-btn ${activeStyle === "satellite" ? "is-active" : ""}`}
          onClick={() => switchStyle("satellite")}
          title="Esri World Satellite Imagery"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>satellite_alt</span>
          Satellite
        </button>
      </div>

      {/* Safe Non-Blocking Basemap Unavailable Indicator */}
      {basemapUnavailable && (
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            left: "14px",
            zIndex: 500,
            background: "rgba(15, 23, 42, 0.90)",
            backdropFilter: "blur(6px)",
            border: "1px solid #475569",
            borderRadius: "6px",
            padding: "4px 10px",
            color: "#f8fafc",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#f59e0b" }}>
            cloud_off
          </span>
          <span>Basemap unavailable (Hotspots active)</span>
          <button
            onClick={() => setBasemapUnavailable(false)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "0 2px",
              fontSize: "11px",
              marginLeft: "4px",
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Compact Unified Map Controls: Zoom In / Out & India View */}
      <div
        style={{
          position: "absolute",
          top: "14px",
          left: "14px",
          zIndex: 500,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(8px)",
          border: "1px solid #cbd5e1",
          borderRadius: "6px",
          padding: "2px",
          display: "flex",
          alignItems: "center",
          gap: "1px",
          boxShadow: "var(--mc-shadow-md)",
        }}
      >
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          style={{
            width: "26px",
            height: "26px",
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#334155",
            fontWeight: 700,
            fontSize: "15px",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          style={{
            width: "26px",
            height: "26px",
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#334155",
            fontWeight: 700,
            fontSize: "15px",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          &minus;
        </button>
        <div style={{ width: "1px", height: "16px", background: "#e2e8f0", margin: "0 2px" }} />
        <button
          onClick={handleResetIndiaView}
          title="Reset to India View"
          style={{
            height: "26px",
            padding: "0 8px",
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "#1e293b",
            fontSize: "11px",
            fontWeight: 600,
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#2563eb" }}>
            public
          </span>
          India View
        </button>
      </div>

      {/* Requirement 12: Compact Bottom Legend with Dynamic Counts (Prioritizes Active Detections) */}
      <div className="mc-map-legend-7">
        {sortedLegendEntries.map(([key, meta]) => {
          const count = legendCounts[key] || 0;
          const isZero = count === 0;
          return (
            <div
              key={key}
              className="mc-legend-7-item"
              style={{
                opacity: isZero ? 0.45 : 1,
                fontWeight: isZero ? 500 : 700,
              }}
            >
              <span className="mc-legend-7-dot" style={{ background: meta.color }} />
              <span style={{ color: isZero ? "#64748b" : "#1e293b" }}>{meta.shortLabel}</span>
              <strong style={{ fontFamily: "var(--mc-font-mono)", fontSize: "10.5px", color: isZero ? "#94a3b8" : "#0f172a" }}>
                {count}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
};
