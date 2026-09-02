import { Hotspot } from "../App";
import HotspotList from "./HotspotList";
import FiltersPanel, { Filters } from "./Filters";

type SidebarProps = {
  hotspots: Hotspot[]; // already filtered
  totalCount: number; // total before filtering, for "X / Y" display
  selectedHotspot: Hotspot | null;
  onSelectHotspot: (hotspot: Hotspot) => void;
  usingDemoData: boolean;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
};

function Sidebar({
  hotspots,
  totalCount,
  selectedHotspot,
  onSelectHotspot,
  usingDemoData,
  filters,
  onFiltersChange,
}: SidebarProps) {
  // Counts are based on the filtered list, so the stats match what's on screen.
  const industrialCount = hotspots.filter((h) => h.classification === "Possible Industrial Fire").length;
  const agriculturalCount = hotspots.filter((h) => h.classification === "Possible Agricultural Burning").length;
  const miningCount = hotspots.filter((h) => h.classification === "Possible Mining/Landfill Fire").length;
  const wildfireCount = hotspots.filter((h) => h.classification === "Possible Wildfire").length;
  const unknownCount = hotspots.filter((h) => h.classification === "Unknown / Needs Investigation").length;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-header__pulse" />
        <div>
          <h1>Thermal Watch</h1>
          <p className="sidebar-header__subtitle">Industrial fire &amp; anomaly detection</p>
        </div>
      </div>

      {usingDemoData && <div className="demo-badge">Demo Data — not live satellite feed</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__value">
            {hotspots.length}
            {hotspots.length !== totalCount && <span className="stat-card__of-total"> / {totalCount}</span>}
          </span>
          <span className="stat-card__label">Total Hotspots</span>
        </div>
        <div className="stat-card stat-card--fire">
          <span className="stat-card__value">{industrialCount}</span>
          <span className="stat-card__label">Industrial</span>
        </div>
        <div className="stat-card stat-card--farm">
          <span className="stat-card__value">{agriculturalCount}</span>
          <span className="stat-card__label">Agricultural</span>
        </div>
        <div className="stat-card stat-card--mine">
          <span className="stat-card__value">{miningCount}</span>
          <span className="stat-card__label">Mining/Landfill</span>
        </div>
        <div className="stat-card stat-card--wildfire">
          <span className="stat-card__value">{wildfireCount}</span>
          <span className="stat-card__label">Wildfires</span>
        </div>
        <div className="stat-card stat-card--unknown">
          <span className="stat-card__value">{unknownCount}</span>
          <span className="stat-card__label">Unknown</span>
        </div>
      </div>

      <FiltersPanel filters={filters} onChange={onFiltersChange} />

      <HotspotList
        hotspots={hotspots}
        selectedHotspot={selectedHotspot}
        onSelectHotspot={onSelectHotspot}
      />
    </aside>
  );
}

export default Sidebar;
