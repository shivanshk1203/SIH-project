import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ThermalEvent } from "../../types/thermal";

interface IncidentMapViewProps {
  incident: ThermalEvent;
  height?: string;
}

type RadiusOption = 250 | 500 | 1000 | 2000 | 0;

export const IncidentMapView: React.FC<IncidentMapViewProps> = ({
  incident,
  height = "100%",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer references
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const refTileLayerRef = useRef<L.TileLayer | null>(null);
  const radiusLayerRef = useRef<L.Circle | null>(null);
  const footprintLayerRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const facilityLayerRef = useRef<L.LayerGroup | null>(null);

  // Track previous incident ID to prevent map jumping during radius/tile/classification updates
  const prevIncidentIdRef = useRef<string | null>(null);

  const [activeBaseLayer, setActiveBaseLayer] = useState<"satellite" | "light">("satellite");
  const [selectedRadius, setSelectedRadius] = useState<RadiusOption>(1000);
  const [layerError, setLayerError] = useState<string | null>(null);

  const lat = incident.coordinates?.[0] ?? 22.5;
  const lon = incident.coordinates?.[1] ?? 79.5;

  // Derive classification theme color
  const classificationColor = useMemo(() => {
    const cls = incident.classification || "";
    if (cls.includes("Industrial")) return "#dc2626";
    if (cls.includes("Wildfire")) return "#ea580c";
    if (cls.includes("Agricultural") || cls.includes("Crop")) return "#ca8a04";
    if (cls.includes("Flare")) return "#d97706";
    if (cls.includes("Mining") || cls.includes("Thermal")) return "#0891b2";
    return "#3b82f6";
  }, [incident.classification]);

  // Check whether a real named industrial facility exists
  const hasRealFacility = useMemo(() => {
    const f = incident.nearestFacility;
    if (!f || !f.name) return false;
    const n = f.name.toLowerCase();
    const t = (f.type || "").toLowerCase();
    if (n.includes("unmapped") || n.includes("rural") || n.includes("unknown") || n.includes("none")) return false;
    if (t.includes("rural") || t.includes("unmapped") || t.includes("cropland") || t.includes("unknown")) return false;
    return f.distanceKm < 10;
  }, [incident.nearestFacility]);

  // 1. Initialize Leaflet Map with Custom Panes for Deterministic Z-Ordering
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lon],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        minZoom: 4,
        maxZoom: 18,
      });

      // Create distinct Leaflet Panes with explicit z-index:
      // Base tiles render in default tilePane (z-index: 200)
      if (!map.getPane("incidentBufferPane")) {
        const bufferPane = map.createPane("incidentBufferPane");
        bufferPane.style.zIndex = "410";
        bufferPane.style.pointerEvents = "none";
      }

      if (!map.getPane("incidentFootprintPane")) {
        const footprintPane = map.createPane("incidentFootprintPane");
        footprintPane.style.zIndex = "420";
        footprintPane.style.pointerEvents = "none";
      }

      if (!map.getPane("incidentFacilityPane")) {
        const facilityPane = map.createPane("incidentFacilityPane");
        facilityPane.style.zIndex = "430";
      }

      if (!map.getPane("incidentMarkerPane")) {
        const markerPane = map.createPane("incidentMarkerPane");
        markerPane.style.zIndex = "620";
      }

      // Initial satellite base layer
      const satLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18 }
      );
      const refLayer = L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18, opacity: 0.85 }
      );

      satLayer.addTo(map);
      refLayer.addTo(map);

      baseTileLayerRef.current = satLayer;
      refTileLayerRef.current = refLayer;

      // Facility layer group
      facilityLayerRef.current = L.layerGroup([], { pane: "incidentFacilityPane" }).addTo(map);

      mapInstanceRef.current = map;
      prevIncidentIdRef.current = incident.id;
    } catch (err) {
      console.error("[IncidentMapView] Map initialization error:", err);
      setLayerError("Unable to initialize map view");
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      baseTileLayerRef.current = null;
      refTileLayerRef.current = null;
      radiusLayerRef.current = null;
      footprintLayerRef.current = null;
      markerRef.current = null;
      facilityLayerRef.current = null;
    };
  }, []);

  // 2. Switch Base Tiles (Satellite vs Light) safely using default tilePane
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      if (baseTileLayerRef.current) {
        map.removeLayer(baseTileLayerRef.current);
        baseTileLayerRef.current = null;
      }
      if (refTileLayerRef.current) {
        map.removeLayer(refTileLayerRef.current);
        refTileLayerRef.current = null;
      }

      if (activeBaseLayer === "satellite") {
        const sat = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18 }
        );
        const ref = L.tileLayer(
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18, opacity: 0.85 }
        );
        sat.addTo(map);
        ref.addTo(map);
        baseTileLayerRef.current = sat;
        refTileLayerRef.current = ref;
      } else {
        const light = L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          { maxZoom: 18, subdomains: "abcd" }
        );
        light.addTo(map);
        baseTileLayerRef.current = light;
      }
      // Note: No bringToFront() needed because all vectors/markers are assigned to custom panes with z-index >= 410!
    } catch (err) {
      console.error("[IncidentMapView] Error toggling base layer:", err);
    }
  }, [activeBaseLayer]);

  // 3. Update Incident Hotspot, Footprint, and Facilities
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      // If incident changed, center map to new coordinates
      if (prevIncidentIdRef.current !== incident.id) {
        map.setView([lat, lon], 15);
        prevIncidentIdRef.current = incident.id;
      }

      // --- Footprint Layer (VIIRS 375m ground pixel) ---
      if (footprintLayerRef.current) {
        map.removeLayer(footprintLayerRef.current);
        footprintLayerRef.current = null;
      }
      const footprint = L.circle([lat, lon], {
        pane: "incidentFootprintPane",
        radius: 187.5,
        color: classificationColor,
        weight: 1.5,
        fillColor: classificationColor,
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(map);
      footprintLayerRef.current = footprint;

      // --- Pulsing Hotspot Marker ---
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }

      const hotspotIcon = L.divIcon({
        className: "mc-incident-pin-wrap",
        html: `
          <div class="mc-incident-reticle" style="border-color: ${classificationColor};">
            <div class="mc-incident-reticle__pulse" style="background: ${classificationColor};"></div>
            <div class="mc-incident-reticle__core" style="background: ${classificationColor};"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lon], {
        icon: hotspotIcon,
        pane: "incidentMarkerPane",
      });

      const popupHtml = `
        <div class="mc-incident-popup">
          <div class="mc-incident-popup__header">
            <span class="mc-incident-popup__dot" style="background: ${classificationColor};"></span>
            <strong>${incident.classification}</strong>
          </div>
          <div class="mc-incident-popup__grid">
            <div><span class="mc-text-muted">Radiative Power:</span> <strong>${incident.frpMw.toFixed(1)} MW</strong></div>
            <div><span class="mc-text-muted">Observed:</span> <span>${incident.detectedTime}</span></div>
            <div><span class="mc-text-muted">Coordinates:</span> <span class="mc-mono">${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E</span></div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: false,
        offset: [0, -14],
        className: "mc-clean-leaflet-popup",
      });

      marker.addTo(map);
      markerRef.current = marker;

      // Automatically open compact callout
      marker.openPopup();

      // --- Facility Context Marker & Line (if verified mapped facility exists) ---
      if (facilityLayerRef.current) {
        facilityLayerRef.current.clearLayers();

        if (hasRealFacility && incident.nearestFacility) {
          const distDeg = incident.nearestFacility.distanceKm / 111;
          const facLat = lat + distDeg * 0.707;
          const facLon = lon + distDeg * 0.707;

          const line = L.polyline(
            [
              [lat, lon],
              [facLat, facLon],
            ],
            {
              pane: "incidentFacilityPane",
              color: "#64748b",
              weight: 1.5,
              dashArray: "3, 4",
            }
          );
          facilityLayerRef.current.addLayer(line);

          const facIcon = L.divIcon({
            className: "mc-facility-pin-wrap",
            html: `
              <div class="mc-facility-pin" title="${incident.nearestFacility.name} (${incident.nearestFacility.distanceKm} km)">
                <span class="material-symbols-outlined" style="font-size: 14px; color: #0f172a;">factory</span>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const facMarker = L.marker([facLat, facLon], {
            icon: facIcon,
            pane: "incidentFacilityPane",
          });

          facMarker.bindPopup(`
            <div style="font-size: 11px; padding: 4px;">
              <strong style="color: #0f172a; display: block;">${incident.nearestFacility.name}</strong>
              <span style="color: #64748b;">${incident.nearestFacility.type} · ${incident.nearestFacility.distanceKm} km away</span>
            </div>
          `, { closeButton: false, offset: [0, -10] });

          facilityLayerRef.current.addLayer(facMarker);
        }
      }
    } catch (err) {
      console.error("[IncidentMapView] Error updating hotspot layers:", err);
      setLayerError("Unable to update map overlays");
    }
  }, [lat, lon, incident.id, incident.classification, incident.frpMw, incident.detectedTime, classificationColor, hasRealFacility, incident.nearestFacility]);

  // 4. Update Radius Buffer Ring (does NOT re-center or disrupt user view)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      if (radiusLayerRef.current) {
        map.removeLayer(radiusLayerRef.current);
        radiusLayerRef.current = null;
      }

      if (selectedRadius > 0) {
        const radiusCircle = L.circle([lat, lon], {
          pane: "incidentBufferPane",
          radius: selectedRadius,
          color: "#2563eb",
          weight: 1.5,
          dashArray: "4, 5",
          fillColor: "#3b82f6",
          fillOpacity: 0.06,
          interactive: false,
        }).addTo(map);

        radiusLayerRef.current = radiusCircle;
      }
    } catch (err) {
      console.error("[IncidentMapView] Error updating radius ring:", err);
    }
  }, [lat, lon, selectedRadius]);

  const handleCenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lon], 15, { animate: true });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height, background: "#0b1120", overflow: "hidden" }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Layer Error Notification (Non-Intrusive) */}
      {layerError && (
        <div
          style={{
            position: "absolute",
            top: "50px",
            left: "12px",
            background: "rgba(254, 242, 242, 0.95)",
            border: "1px solid #fecaca",
            color: "#dc2626",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>{layerError}</span>
          <button
            onClick={() => setLayerError(null)}
            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Floating Controls Bar */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "12px",
          right: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        {/* Radius Buffer Controls */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(6px)",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "3px 6px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            pointerEvents: "auto",
          }}
        >
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#475569", paddingLeft: "4px" }}>
            Buffer:
          </span>
          {([250, 500, 1000, 2000, 0] as RadiusOption[]).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRadius(r)}
              style={{
                background: selectedRadius === r ? "#2563eb" : "transparent",
                color: selectedRadius === r ? "#ffffff" : "#334155",
                border: "none",
                borderRadius: "4px",
                padding: "2px 7px",
                fontSize: "10.5px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {r === 0 ? "Off" : r >= 1000 ? `${r / 1000}km` : `${r}m`}
            </button>
          ))}
        </div>

        {/* Base Layer Switcher & Re-center */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(6px)",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "3px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={() => setActiveBaseLayer("satellite")}
            style={{
              background: activeBaseLayer === "satellite" ? "#0f172a" : "transparent",
              color: activeBaseLayer === "satellite" ? "#ffffff" : "#475569",
              border: "none",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "10.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Satellite
          </button>
          <button
            onClick={() => setActiveBaseLayer("light")}
            style={{
              background: activeBaseLayer === "light" ? "#0f172a" : "transparent",
              color: activeBaseLayer === "light" ? "#ffffff" : "#475569",
              border: "none",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "10.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Streets
          </button>
          <button
            onClick={handleCenter}
            title="Center on hotspot"
            style={{
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              padding: "3px 5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#2563eb",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
              my_location
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Floating Zoom Controls */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          zIndex: 1000,
        }}
      >
        <button
          onClick={handleZoomIn}
          style={{
            width: "28px",
            height: "28px",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            fontWeight: 800,
            fontSize: "15px",
            color: "#0f172a",
          }}
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            width: "28px",
            height: "28px",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            fontWeight: 800,
            fontSize: "15px",
            color: "#0f172a",
          }}
        >
          −
        </button>
      </div>

      {/* Pixel Footprint Indicator Badge */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          background: "rgba(15, 23, 42, 0.82)",
          color: "#ffffff",
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "10.5px",
          fontFamily: "var(--mc-font-mono)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          zIndex: 1000,
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: classificationColor,
            display: "inline-block",
          }}
        />
        <span>VIIRS 375m Footprint</span>
      </div>
    </div>
  );
};
