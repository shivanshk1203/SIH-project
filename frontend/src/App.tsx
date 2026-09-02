import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import Map from "./components/Map";
import AlertCard from "./components/AlertCard";
import { Filters, ALL_CLASSIFICATIONS } from "./components/Filters";

// This is the shape of one classified hotspot, as returned by the backend.
// Keeping this in one place (instead of a separate types file) keeps things simple.
export type Hotspot = {
  id: string;
  latitude: number;
  longitude: number;
  brightness: number;
  detection_confidence: number;
  detected_at: string;
  is_demo_data: boolean;
  nearest_facility: string | null;
  distance_to_facility_m: number | null;
  // What kind of place OSM says this hotspot is sitting in/near -
  // "industrial" | "farm" | "mine" | "power_plant" | "landfill" | "oil_gas" |
  // "forest" | "residential" | null (nothing recognizable close enough).
  location_type: string | null;
  location_type_label: string | null;
  classification: string;
  confidence: number;
  reasons: string[];
};

// A real-world land-use feature from OpenStreetMap (industrial site, farm,
// mine, power plant, etc.), shown on the map alongside the hotspots so you
// can see *where* a hotspot actually is, not just its classification.
export type Facility = {
  name: string;
  type: string;
  type_label: string;
  latitude: number;
  longitude: number;
};

const API_URL = "http://localhost:8000/api/hotspots";

function App() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    classifications: ALL_CLASSIFICATIONS,
    searchText: "",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    fetch(API_URL)
      .then((response) => response.json())
      .then((data) => {
        setHotspots(data.hotspots);
        setFacilities(data.facilities ?? []);
        setIsLoading(false);
      })
      .catch(() => {
        setErrorMessage("Could not reach the backend. Is server.py running on port 8000?");
        setIsLoading(false);
      });
  }, []);

  const usingDemoData = hotspots.length > 0 && hotspots[0].is_demo_data;

  // Apply the current filters to the full hotspot list.
  // Recalculated only when the hotspots or filters actually change.
  const filteredHotspots = useMemo(() => {
    return hotspots.filter((hotspot) => {
      if (!filters.classifications.includes(hotspot.classification)) {
        return false;
      }

      if (filters.searchText.trim() !== "") {
        const searchLower = filters.searchText.toLowerCase();
        const matchesFacility = hotspot.nearest_facility?.toLowerCase().includes(searchLower);
        const matchesClassification = hotspot.classification.toLowerCase().includes(searchLower);
        if (!matchesFacility && !matchesClassification) {
          return false;
        }
      }

      const detectedDate = hotspot.detected_at.slice(0, 10); // "YYYY-MM-DD"
      if (filters.dateFrom && detectedDate < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && detectedDate > filters.dateTo) {
        return false;
      }

      return true;
    });
  }, [hotspots, filters]);

  return (
    <div className="app-layout">
      <Sidebar
        hotspots={filteredHotspots}
        totalCount={hotspots.length}
        selectedHotspot={selectedHotspot}
        onSelectHotspot={setSelectedHotspot}
        usingDemoData={usingDemoData}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <main className="map-area">
        {isLoading && <div className="status-banner">Scanning for thermal anomalies…</div>}
        {errorMessage && <div className="status-banner status-banner--error">{errorMessage}</div>}

        <Map
          hotspots={filteredHotspots}
          facilities={facilities}
          selectedHotspot={selectedHotspot}
          onSelectHotspot={setSelectedHotspot}
        />

        {selectedHotspot && (
          <AlertCard hotspot={selectedHotspot} onClose={() => setSelectedHotspot(null)} />
        )}
      </main>
    </div>
  );
}

export default App;
