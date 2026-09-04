// Simple filter controls for the sidebar: classification, search text, and date range.
// All filter state lives in App.tsx; this component just displays controls and
// calls the callbacks it's given. No local state, no complex logic.

export type Filters = {
  classifications: string[]; // which classifications are currently shown
  searchText: string; // free-text search (matches facility name or classification)
  dateFrom: string; // "" means no lower bound, otherwise "YYYY-MM-DD"
  dateTo: string; // "" means no upper bound, otherwise "YYYY-MM-DD"
};

export const ALL_CLASSIFICATIONS = [
  "Likely Wildfire",
  "Possible Agricultural Burning",
  "Likely Industrial Heat",
  "Mining / Waste Heat",
  "Controlled Burning",
  "Possible False Positive / Sensor Anomaly",
  "Unknown / Needs Verification",
];

type FiltersProps = {
  filters: Filters;
  onChange: (filters: Filters) => void;
};

export function classDotClass(classification: string) {
  if (classification.includes("Wildfire")) return "dot dot--wildfire";
  if (classification.includes("Agricultural")) return "dot dot--farm";
  if (classification.includes("Industrial")) return "dot dot--industrial";
  if (classification.includes("Mining") || classification.includes("Waste")) return "dot dot--mine";
  if (classification.includes("Controlled")) return "dot dot--controlled";
  if (classification.includes("False Positive") || classification.includes("Sensor")) return "dot dot--glint";
  return "dot dot--unknown";
}

function FiltersPanel({ filters, onChange }: FiltersProps) {
  function toggleClassification(classification: string) {
    const isCurrentlyOn = filters.classifications.includes(classification);
    const updated = isCurrentlyOn
      ? filters.classifications.filter((c) => c !== classification)
      : [...filters.classifications, classification];
    onChange({ ...filters, classifications: updated });
  }

  return (
    <div className="filters">
      <h2 className="filters__title">Filters</h2>

      <input
        type="text"
        className="filters__search"
        placeholder="Search city, facility, or type…"
        value={filters.searchText}
        onChange={(e) => onChange({ ...filters, searchText: e.target.value })}
      />

      <div className="filters__dates">
        <label>
          From
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          />
        </label>
      </div>

      <div className="filters__header-row">
        <span className="filters__section-label">Classification Filters:</span>
        <button
          type="button"
          className="filters__quick-btn"
          onClick={() => {
            if (filters.classifications.length === ALL_CLASSIFICATIONS.length) {
              onChange({ ...filters, classifications: [] });
            } else {
              onChange({ ...filters, classifications: ALL_CLASSIFICATIONS });
            }
          }}
        >
          {filters.classifications.length === ALL_CLASSIFICATIONS.length ? "Deselect All" : "Show All Active"}
        </button>
      </div>

      <div className="filters__checkboxes">
        {ALL_CLASSIFICATIONS.map((classification) => (
          <label key={classification} className="filters__checkbox-row">
            <input
              type="checkbox"
              checked={filters.classifications.includes(classification)}
              onChange={() => toggleClassification(classification)}
            />
            <span className={classDotClass(classification)} />
            {classification}
          </label>
        ))}
      </div>

      {(filters.searchText || filters.dateFrom || filters.dateTo ||
        filters.classifications.length !== ALL_CLASSIFICATIONS.length) && (
        <button
          className="filters__reset"
          onClick={() =>
            onChange({ classifications: ALL_CLASSIFICATIONS, searchText: "", dateFrom: "", dateTo: "" })
          }
        >
          Reset filters
        </button>
      )}
    </div>
  );
}

export default FiltersPanel;
