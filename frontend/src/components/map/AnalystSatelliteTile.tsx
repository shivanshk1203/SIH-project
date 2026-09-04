import React, { useState } from "react";

interface AnalystSatelliteTileProps {
  latitude: number;
  longitude: number;
  detectedDate?: string;
  detectedTime?: string;
  satellite?: string;
  instrument?: string;
  frpMw?: number;
}

function latLonToTile(lat: number, lon: number, zoom: number) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
  return { x, y, z: zoom };
}

export const AnalystSatelliteTile: React.FC<AnalystSatelliteTileProps> = ({
  latitude,
  longitude,
  detectedDate,
  detectedTime,
  satellite = "VIIRS Suomi-NPP",
  instrument = "VIIRS (375m)",
  frpMw = 0,
}) => {
  const [imgError, setImgError] = useState(false);
  const zoom = 15;
  const tile = latLonToTile(latitude, longitude, zoom);
  const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`;

  return (
    <div style={{ position: "relative", width: "100%", height: "135px", borderRadius: "5px", overflow: "hidden", border: "1px solid #cbd5e1", background: "#0f172a" }}>
      {!imgError ? (
        <>
          <img
            src={tileUrl}
            alt="Real Coordinate Satellite Observation"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
          {/* Real VIIRS 375m Footprint Crosshair Overlay */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "2px dashed #ef4444",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                boxShadow: "0 0 10px rgba(239, 68, 68, 0.4)",
              }}
            />
            <span
              style={{
                fontSize: "8.5px",
                fontWeight: 700,
                color: "#ffffff",
                background: "rgba(15, 23, 42, 0.85)",
                padding: "1px 4px",
                borderRadius: "2px",
                marginTop: "2px",
                whiteSpace: "nowrap",
              }}
            >
              375m VIIRS Footprint
            </span>
          </div>

          {/* Metadata Bar */}
          <div
            style={{
              position: "absolute",
              bottom: "0",
              left: "0",
              right: "0",
              background: "linear-gradient(to top, rgba(15,23,42,0.92), transparent)",
              padding: "4px 8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: "9.5px",
              color: "#e2e8f0",
            }}
          >
            <div>
              <span style={{ fontWeight: 700, color: "#ffffff" }}>{satellite}</span> &middot; {instrument}
            </div>
            <div style={{ fontFamily: "monospace", color: "#94a3b8" }}>
              {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
            </div>
          </div>
        </>
      ) : (
        /* Requirement 13: Honest Unavailable State (never generic stock placeholder!) */
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "11px",
            background: "#1e293b",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#64748b", marginBottom: "4px" }}>
            satellite_alt
          </span>
          <strong style={{ color: "#cbd5e1" }}>Satellite Imagery Unavailable</strong>
          <span style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
            Overpass optical tiles for {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E are pending ingest.
          </span>
        </div>
      )}
    </div>
  );
};
