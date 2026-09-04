import React, { useState } from "react";

export interface LayerState {
  thermalAnomalies: boolean;
  industrialFacilities: boolean;
  oilRefineries: boolean;
  petrochemicalPlants: boolean;
  thermalPowerPlants: boolean;
  steelPlants: boolean;
  miningAreas: boolean;
  lngTerminals: boolean;
  forest: boolean;
  agriculture: boolean;
  adminBoundaries: boolean;
  roads: boolean;
}

interface FloatingLayerControlProps {
  layers: LayerState;
  onLayerToggle: (key: keyof LayerState) => void;
}

export const FloatingLayerControl: React.FC<FloatingLayerControlProps> = ({
  layers,
  onLayerToggle,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mc-floating-layers">
      <div className="mc-floating-layers__header">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#38bdf8" }}>
            layers
          </span>
          <span>GIS Layers</span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
            {collapsed ? "expand_more" : "expand_less"}
          </span>
        </button>
      </div>

      {!collapsed && (
        <div className="mc-floating-layers__content">
          {/* Thermal Layer */}
          <div>
            <div className="mc-layer-section-title">Satellite Heat</div>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.thermalAnomalies}
                onChange={() => onLayerToggle("thermalAnomalies")}
              />
              <span style={{ color: "#f87171" }}>Thermal Anomalies</span>
            </label>
          </div>

          {/* Industrial Sectors */}
          <div>
            <div className="mc-layer-section-title">Industrial Facilities</div>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.industrialFacilities}
                onChange={() => onLayerToggle("industrialFacilities")}
              />
              <span>All Industrial Sites</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.oilRefineries}
                onChange={() => onLayerToggle("oilRefineries")}
              />
              <span>Oil Refineries</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.petrochemicalPlants}
                onChange={() => onLayerToggle("petrochemicalPlants")}
              />
              <span>Petrochemical Plants</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.thermalPowerPlants}
                onChange={() => onLayerToggle("thermalPowerPlants")}
              />
              <span>Thermal Power Plants</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.steelPlants}
                onChange={() => onLayerToggle("steelPlants")}
              />
              <span>Steel Plants</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.miningAreas}
                onChange={() => onLayerToggle("miningAreas")}
              />
              <span>Mining Areas</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.lngTerminals}
                onChange={() => onLayerToggle("lngTerminals")}
              />
              <span>LNG Terminals</span>
            </label>
          </div>

          {/* Environmental & Boundaries */}
          <div>
            <div className="mc-layer-section-title">Environment & Infra</div>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.forest}
                onChange={() => onLayerToggle("forest")}
              />
              <span>Forest Canopy</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.agriculture}
                onChange={() => onLayerToggle("agriculture")}
              />
              <span>Agricultural Land</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.adminBoundaries}
                onChange={() => onLayerToggle("adminBoundaries")}
              />
              <span>State / District Borders</span>
            </label>
            <label className="mc-layer-item">
              <input
                type="checkbox"
                checked={layers.roads}
                onChange={() => onLayerToggle("roads")}
              />
              <span>Major Highways / Roads</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
