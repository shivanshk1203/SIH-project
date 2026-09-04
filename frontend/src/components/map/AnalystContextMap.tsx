import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface AnalystContextMapProps {
  latitude: number;
  longitude: number;
  locationName?: string;
  facilityName?: string;
  facilityDistanceKm?: number;
  classificationColor?: string;
  frpMw?: number;
}

export const AnalystContextMap: React.FC<AnalystContextMapProps> = ({
  latitude,
  longitude,
  locationName,
  facilityName,
  facilityDistanceKm,
  classificationColor = "#ea580c",
  frpMw = 0,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: "center",
      doubleClickZoom: true,
    });

    mapInstanceRef.current = map;

    // High-contrast clean satellite / aerial basemap (Esri World Imagery)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxNativeZoom: 18,
        maxZoom: 19,
      }
    ).addTo(map);

    // Reference labels & roads overlay
    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxNativeZoom: 18,
        maxZoom: 19,
        opacity: 0.8,
      }
    ).addTo(map);

    // 1. Concentric Distance Radius Rings (Requirement 14)
    // 2000m (2 km) Outer Buffer Ring
    L.circle([latitude, longitude], {
      radius: 2000,
      color: "#94a3b8",
      weight: 1,
      dashArray: "3, 6",
      fillColor: "#000000",
      fillOpacity: 0.02,
      interactive: false,
    }).addTo(map);

    // 1000m (1 km) Infrastructure Proximity Ring
    L.circle([latitude, longitude], {
      radius: 1000,
      color: "#64748b",
      weight: 1.2,
      dashArray: "4, 4",
      fillColor: "#38bdf8",
      fillOpacity: 0.03,
      interactive: false,
    }).addTo(map);

    // 500m Local Facility Buffer Ring
    L.circle([latitude, longitude], {
      radius: 500,
      color: "#f59e0b",
      weight: 1.5,
      dashArray: "4, 4",
      fillColor: "#f59e0b",
      fillOpacity: 0.05,
      interactive: false,
    }).addTo(map);

    // 250m Immediate VIIRS 375m Impact Zone
    L.circle([latitude, longitude], {
      radius: 250,
      color: "#ef4444",
      weight: 1.8,
      dashArray: "2, 3",
      fillColor: "#ef4444",
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(map);

    // 2. Central Detection Marker with Pulsing Ripple
    const centerIcon = L.divIcon({
      className: "mc-context-map-pin",
      html: `
        <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: ${classificationColor}; opacity: 0.35; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <span style="width: 12px; height: 12px; border-radius: 50%; background: ${classificationColor}; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.5); z-index: 2;"></span>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const marker = L.marker([latitude, longitude], { icon: centerIcon }).addTo(map);
    marker.bindTooltip(
      `<div style="font-size: 10.5px; font-weight: 700; line-height: 1.3;">
        <div>${locationName || "Thermal Hotspot"}</div>
        <div style="font-size: 9.5px; color: #dc2626; font-weight: 600;">FRP: ${frpMw.toFixed(1)} MW</div>
      </div>`,
      { direction: "top", offset: [0, -12] }
    );

    // Zoom controls at top right of mini map
    const zoomCtrl = L.control.zoom({ position: "topright" });
    zoomCtrl.addTo(map);

    // Fit smoothly to ~1500m bounding box
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [latitude, longitude, classificationColor, frpMw, locationName, facilityName, facilityDistanceKm]);

  return (
    <div style={{ position: "relative", width: "100%", height: "190px", borderRadius: "6px", overflow: "hidden", border: "1px solid #cbd5e1" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Range Rings Legend Overlay */}
      <div
        style={{
          position: "absolute",
          bottom: "6px",
          left: "6px",
          zIndex: 400,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(4px)",
          color: "#ffffff",
          padding: "3px 7px",
          borderRadius: "4px",
          fontSize: "9.5px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          pointerEvents: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", border: "1.5px dashed #ef4444" }} />
          250m
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", border: "1.5px dashed #f59e0b" }} />
          500m
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", border: "1.5px dashed #64748b" }} />
          1 km
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", border: "1.5px dashed #94a3b8" }} />
          2 km
        </span>
      </div>

      {/* Recenter button */}
      <button
        type="button"
        onClick={() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 14, { animate: true });
          }
        }}
        style={{
          position: "absolute",
          top: "6px",
          left: "6px",
          zIndex: 400,
          background: "rgba(255, 255, 255, 0.9)",
          border: "1px solid #cbd5e1",
          borderRadius: "4px",
          padding: "2px 6px",
          fontSize: "10px",
          cursor: "pointer",
          fontWeight: 600,
          color: "#1e293b",
          display: "flex",
          alignItems: "center",
          gap: "3px",
        }}
        title="Recenter on detection"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "#2563eb" }}>my_location</span>
        Center
      </button>
    </div>
  );
};
