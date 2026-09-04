import React, { useMemo, useState } from "react";
import { Hotspot } from "../types";

export interface HotspotGroupingPageProps {
  hotspots: Hotspot[];
  onSelectHotspot: (hotspot: Hotspot) => void;
  onNavigateToMap: () => void;
}

type GroupingMode = "classification" | "spatial" | "risk";

interface HotspotCluster {
  id: string;
  name: string;
  type: string;
  categoryBadge: string;
  hotspots: Hotspot[];
  centroid: [number, number];
  totalFrp: number;
  maxFrp: number;
  avgBrightness: number;
  avgConfidence: number;
  maxRiskScore: number;
  riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "MINIMAL";
  nearestFacility?: string;
  nearestSettlement?: string;
  isExpanding: boolean;
  acknowledged?: boolean;
  tag?: string;
}

export const HotspotGroupingPage: React.FC<HotspotGroupingPageProps> = ({
  hotspots,
  onSelectHotspot,
  onNavigateToMap,
}) => {
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("classification");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOnlyExpanding, setFilterOnlyExpanding] = useState(false);
  const [filterAbnormalSurge, setFilterAbnormalSurge] = useState(false);
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [clusterTags, setClusterTags] = useState<Record<string, string>>({});
  const [acknowledgedClusters, setAcknowledgedClusters] = useState<Record<string, boolean>>({});

  // 1. Grouping Algorithm
  const clusters: HotspotCluster[] = useMemo(() => {
    if (!hotspots.length) return [];

    const result: HotspotCluster[] = [];

    if (groupingMode === "classification") {
      // Group by canonical classification
      const groups: Record<string, Hotspot[]> = {};
      hotspots.forEach((h) => {
        const cls = h.classification || "Unclassified Hotspot";
        if (!groups[cls]) groups[cls] = [];
        groups[cls].push(h);
      });

      Object.entries(groups).forEach(([clsName, list], idx) => {
        let sumLat = 0;
        let sumLon = 0;
        let sumFrp = 0;
        let maxFrp = 0;
        let sumBri = 0;
        let sumConf = 0;
        let maxRisk = 0;
        let expanding = false;

        list.forEach((h) => {
          sumLat += h.latitude;
          sumLon += h.longitude;
          const frpVal = h.frp ?? 0;
          sumFrp += frpVal;
          if (frpVal > maxFrp) maxFrp = frpVal;
          sumBri += h.brightness;
          sumConf += h.confidence;
          const riskVal = h.risk_score ?? (h.risk?.score ?? 35);
          if (riskVal > maxRisk) maxRisk = riskVal;
          if (h.historicalEvidence?.isExpanding) expanding = true;
        });

        const count = list.length;
        const avgLat = sumLat / count;
        const avgLon = sumLon / count;

        let riskLevel: HotspotCluster["riskLevel"] = "LOW";
        if (maxRisk >= 80) riskLevel = "CRITICAL";
        else if (maxRisk >= 60) riskLevel = "HIGH";
        else if (maxRisk >= 40) riskLevel = "MODERATE";
        else if (maxRisk < 20) riskLevel = "MINIMAL";

        result.push({
          id: `class-${idx}-${clsName.replace(/\s+/g, "_")}`,
          name: `${clsName} Group`,
          type: clsName,
          categoryBadge: clsName.toUpperCase(),
          hotspots: list,
          centroid: [avgLat, avgLon],
          totalFrp: Math.round(sumFrp * 10) / 10,
          maxFrp: Math.round(maxFrp * 10) / 10,
          avgBrightness: Math.round((sumBri / count) * 10) / 10,
          avgConfidence: Math.round((sumConf / count) * 10) / 10,
          maxRiskScore: maxRisk,
          riskLevel,
          nearestFacility: list[0]?.nearest_facility || list[0]?.locationContext?.facilityMatchName || undefined,
          nearestSettlement: list[0]?.nearest_settlement || `${avgLat.toFixed(2)}°N, ${avgLon.toFixed(2)}°E`,
          isExpanding: expanding,
        });
      });
    } else if (groupingMode === "spatial") {
      // Spatial grid clustering (~0.3 degrees ~ 30km radius)
      const GRID_STEP = 0.3;
      const gridMap: Record<string, Hotspot[]> = {};

      hotspots.forEach((h) => {
        const latCell = Math.floor(h.latitude / GRID_STEP) * GRID_STEP;
        const lonCell = Math.floor(h.longitude / GRID_STEP) * GRID_STEP;
        const key = `${latCell.toFixed(2)}_${lonCell.toFixed(2)}`;
        if (!gridMap[key]) gridMap[key] = [];
        gridMap[key].push(h);
      });

      Object.entries(gridMap).forEach(([key, list], idx) => {
        let sumLat = 0;
        let sumLon = 0;
        let sumFrp = 0;
        let maxFrp = 0;
        let sumBri = 0;
        let sumConf = 0;
        let maxRisk = 0;
        let expanding = false;

        list.forEach((h) => {
          sumLat += h.latitude;
          sumLon += h.longitude;
          const frpVal = h.frp ?? 0;
          sumFrp += frpVal;
          if (frpVal > maxFrp) maxFrp = frpVal;
          sumBri += h.brightness;
          sumConf += h.confidence;
          const riskVal = h.risk_score ?? (h.risk?.score ?? 30);
          if (riskVal > maxRisk) maxRisk = riskVal;
          if (h.historicalEvidence?.isExpanding) expanding = true;
        });

        const count = list.length;
        const avgLat = sumLat / count;
        const avgLon = sumLon / count;

        let riskLevel: HotspotCluster["riskLevel"] = "LOW";
        if (maxRisk >= 80) riskLevel = "CRITICAL";
        else if (maxRisk >= 60) riskLevel = "HIGH";
        else if (maxRisk >= 40) riskLevel = "MODERATE";
        else if (maxRisk < 20) riskLevel = "MINIMAL";

        // Give readable name based on settlement or dominant facility
        const settlement = list.find((h) => h.nearest_settlement)?.nearest_settlement;
        const facility = list.find((h) => h.nearest_facility)?.nearest_facility;
        const clusterName = settlement
          ? `${settlement} Regional Cluster`
          : facility
          ? `${facility} Zone Cluster`
          : `Spatial Sector [${key.replace("_", ", ")}]`;

        result.push({
          id: `spatial-${idx}-${key}`,
          name: clusterName,
          type: "Spatial Cluster",
          categoryBadge: `${count} HOTSPOTS IN SECTOR`,
          hotspots: list,
          centroid: [avgLat, avgLon],
          totalFrp: Math.round(sumFrp * 10) / 10,
          maxFrp: Math.round(maxFrp * 10) / 10,
          avgBrightness: Math.round((sumBri / count) * 10) / 10,
          avgConfidence: Math.round((sumConf / count) * 10) / 10,
          maxRiskScore: maxRisk,
          riskLevel,
          nearestFacility: facility,
          nearestSettlement: settlement,
          isExpanding: expanding,
        });
      });
    } else {
      // Group by Risk Tier
      const tiers: Record<HotspotCluster["riskLevel"], Hotspot[]> = {
        CRITICAL: [],
        HIGH: [],
        MODERATE: [],
        LOW: [],
        MINIMAL: [],
      };

      hotspots.forEach((h) => {
        const risk = h.risk_score ?? (h.risk?.score ?? 25);
        if (risk >= 80) tiers.CRITICAL.push(h);
        else if (risk >= 60) tiers.HIGH.push(h);
        else if (risk >= 40) tiers.MODERATE.push(h);
        else if (risk >= 20) tiers.LOW.push(h);
        else tiers.MINIMAL.push(h);
      });

      (Object.keys(tiers) as HotspotCluster["riskLevel"][]).forEach((tierKey, idx) => {
        const list = tiers[tierKey];
        if (!list.length) return;

        let sumLat = 0;
        let sumLon = 0;
        let sumFrp = 0;
        let maxFrp = 0;
        let sumBri = 0;
        let sumConf = 0;
        let maxRisk = 0;
        let expanding = false;

        list.forEach((h) => {
          sumLat += h.latitude;
          sumLon += h.longitude;
          const frpVal = h.frp ?? 0;
          sumFrp += frpVal;
          if (frpVal > maxFrp) maxFrp = frpVal;
          sumBri += h.brightness;
          sumConf += h.confidence;
          const riskVal = h.risk_score ?? (h.risk?.score ?? 25);
          if (riskVal > maxRisk) maxRisk = riskVal;
          if (h.historicalEvidence?.isExpanding) expanding = true;
        });

        const count = list.length;
        const avgLat = sumLat / count;
        const avgLon = sumLon / count;

        result.push({
          id: `risk-tier-${idx}-${tierKey}`,
          name: `${tierKey} Priority Cluster Tier`,
          type: `${tierKey} Risk Tier`,
          categoryBadge: `${tierKey} THREAT LEVEL`,
          hotspots: list,
          centroid: [avgLat, avgLon],
          totalFrp: Math.round(sumFrp * 10) / 10,
          maxFrp: Math.round(maxFrp * 10) / 10,
          avgBrightness: Math.round((sumBri / count) * 10) / 10,
          avgConfidence: Math.round((sumConf / count) * 10) / 10,
          maxRiskScore: maxRisk,
          riskLevel: tierKey,
          nearestFacility: list[0]?.nearest_facility,
          nearestSettlement: list[0]?.nearest_settlement,
          isExpanding: expanding,
        });
      });
    }

    // Sort by risk descending
    return result.sort((a, b) => b.maxRiskScore - a.maxRiskScore);
  }, [hotspots, groupingMode]);

  // Filtered clusters by search and toggles
  const filteredClusters = useMemo(() => {
    return clusters.filter((cluster) => {
      if (filterOnlyExpanding && !cluster.isExpanding) return false;
      if (filterAbnormalSurge) {
        const hasSurge = cluster.hotspots.some(
          (h) => (h.abnormality_ratio && h.abnormality_ratio > 2.0) || (h.frp && h.frp > 50)
        );
        if (!hasSurge) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = cluster.name.toLowerCase().includes(q);
        const inFacility = cluster.nearestFacility?.toLowerCase().includes(q);
        const inSettlement = cluster.nearestSettlement?.toLowerCase().includes(q);
        const inTag = clusterTags[cluster.id]?.toLowerCase().includes(q);
        if (!inName && !inFacility && !inSettlement && !inTag) return false;
      }
      return true;
    });
  }, [clusters, searchQuery, filterOnlyExpanding, filterAbnormalSurge, clusterTags]);

  // Overall Statistics for side panel
  const totalClustersCount = clusters.length;
  const totalHotspotsGrouped = clusters.reduce((acc, c) => acc + c.hotspots.length, 0);
  const totalCumulativeFrp = Math.round(clusters.reduce((acc, c) => acc + c.totalFrp, 0));
  const criticalClustersCount = clusters.filter((c) => c.riskLevel === "CRITICAL" || c.riskLevel === "HIGH").length;

  const handleExportClusterGeoJson = (cluster: HotspotCluster) => {
    const geojson = {
      type: "FeatureCollection",
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      total_frp_mw: cluster.totalFrp,
      features: cluster.hotspots.map((h) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [h.longitude, h.latitude],
        },
        properties: {
          id: h.id,
          classification: h.classification,
          frp: h.frp,
          brightness: h.brightness,
          confidence: h.confidence,
          risk_score: h.risk_score,
          detected_at: h.detected_at,
          nearest_facility: h.nearest_facility,
          nearest_settlement: h.nearest_settlement,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cluster.name.replace(/[^a-zA-Z0-9]/g, "_")}_Cluster.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleAcknowledge = (clusterId: string) => {
    setAcknowledgedClusters((prev) => ({
      ...prev,
      [clusterId]: !prev[clusterId],
    }));
  };

  const handlePromptTag = (clusterId: string) => {
    const currentTag = clusterTags[clusterId] || "";
    const newTag = window.prompt("Assign operational tag to this cluster (e.g. 'Investigating', 'Drift Monitoring', 'Flare Normal'):", currentTag);
    if (newTag !== null) {
      setClusterTags((prev) => ({
        ...prev,
        [clusterId]: newTag.trim(),
      }));
    }
  };

  return (
    <div className="stitch-grouping-page">
      {/* Top Banner & Control Bar */}
      <div className="stitch-sub-header">
        <div className="stitch-sub-header__title-area">
          <div className="stitch-tag">CLUSTERING &amp; PATTERN RECOGNITION</div>
          <h1 className="stitch-title">Hotspot Grouping &amp; Cluster Analysis</h1>
          <p className="stitch-subtitle">
            Group thermal signals by classification type, geographic proximity basin, or threat level. Perform batch actions, review cumulative radiative output, and dispatch coordinated responses.
          </p>
        </div>

        {/* Grouping Mode Tabs */}
        <div className="stitch-pill-tabs">
          <button
            type="button"
            className={`stitch-pill-tab ${groupingMode === "classification" ? "is-active" : ""}`}
            onClick={() => setGroupingMode("classification")}
          >
            <span className="material-symbols-outlined">category</span>
            <span>By Classification</span>
          </button>
          <button
            type="button"
            className={`stitch-pill-tab ${groupingMode === "spatial" ? "is-active" : ""}`}
            onClick={() => setGroupingMode("spatial")}
          >
            <span className="material-symbols-outlined">hub</span>
            <span>By Spatial Cluster</span>
          </button>
          <button
            type="button"
            className={`stitch-pill-tab ${groupingMode === "risk" ? "is-active" : ""}`}
            onClick={() => setGroupingMode("risk")}
          >
            <span className="material-symbols-outlined">warning</span>
            <span>By Risk Tier</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="stitch-filter-bar">
        <div className="stitch-search-box">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search cluster, facility, settlement, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="stitch-search-clear"
              onClick={() => setSearchQuery("")}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div className="stitch-filter-toggles">
          <label className="stitch-checkbox-label">
            <input
              type="checkbox"
              checked={filterOnlyExpanding}
              onChange={(e) => setFilterOnlyExpanding(e.target.checked)}
            />
            <span>Expanding Footprint Only</span>
          </label>
          <label className="stitch-checkbox-label">
            <input
              type="checkbox"
              checked={filterAbnormalSurge}
              onChange={(e) => setFilterAbnormalSurge(e.target.checked)}
            />
            <span>High Abnormality / Surge Only</span>
          </label>
        </div>

        <div className="stitch-filter-count">
          Showing <strong>{filteredClusters.length}</strong> of <strong>{clusters.length}</strong> clusters ({totalHotspotsGrouped} hotspots)
        </div>
      </div>

      {/* Main Body: Grid of Clusters + Side Analytics Panel */}
      <div className="stitch-grouping-body">
        {/* Left Side: Clusters Grid */}
        <div className="stitch-cluster-grid">
          {filteredClusters.length === 0 ? (
            <div className="stitch-empty-state">
              <span className="material-symbols-outlined stitch-empty-icon">filter_alt_off</span>
              <h3>No clusters match the specified filter</h3>
              <p>Try switching the grouping mode or clearing search terms to view all detections.</p>
            </div>
          ) : (
            filteredClusters.map((cluster) => {
              const isExpanded = expandedClusterId === cluster.id;
              const isAck = acknowledgedClusters[cluster.id];
              const tag = clusterTags[cluster.id];

              const riskBadgeClass =
                cluster.riskLevel === "CRITICAL"
                  ? "stitch-risk--critical"
                  : cluster.riskLevel === "HIGH"
                  ? "stitch-risk--high"
                  : cluster.riskLevel === "MODERATE"
                  ? "stitch-risk--moderate"
                  : "stitch-risk--low";

              return (
                <div
                  key={cluster.id}
                  className={`stitch-cluster-card ${isAck ? "is-acknowledged" : ""}`}
                >
                  {/* Card Header */}
                  <div className="stitch-cluster-card__header">
                    <div className="stitch-cluster-card__title-wrap">
                      <div className="stitch-cluster-pills">
                        <span className="stitch-mini-pill stitch-mini-pill--accent">
                          {cluster.categoryBadge}
                        </span>
                        <span className={`stitch-mini-pill ${riskBadgeClass}`}>
                          {cluster.maxRiskScore}/100 {cluster.riskLevel}
                        </span>
                        {cluster.isExpanding && (
                          <span className="stitch-mini-pill stitch-mini-pill--alert">
                            ⚡ EXPANDING
                          </span>
                        )}
                        {tag && (
                          <span className="stitch-mini-pill stitch-mini-pill--tag">
                            🏷️ {tag}
                          </span>
                        )}
                        {isAck && (
                          <span className="stitch-mini-pill stitch-mini-pill--success">
                            ✓ ACKNOWLEDGED
                          </span>
                        )}
                      </div>
                      <h2 className="stitch-cluster-name">{cluster.name}</h2>
                    </div>

                    <div className="stitch-cluster-actions">
                      <button
                        type="button"
                        className="stitch-action-btn"
                        onClick={() => handleToggleAcknowledge(cluster.id)}
                        title={isAck ? "Mark as unacknowledged" : "Acknowledge this cluster"}
                      >
                        <span className="material-symbols-outlined">
                          {isAck ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <span>{isAck ? "Acknowledged" : "Bulk Acknowledge"}</span>
                      </button>

                      <button
                        type="button"
                        className="stitch-action-btn"
                        onClick={() => handlePromptTag(cluster.id)}
                        title="Add/Edit operational tag"
                      >
                        <span className="material-symbols-outlined">label</span>
                        <span>{tag ? "Edit Tag" : "Batch Tag"}</span>
                      </button>

                      <button
                        type="button"
                        className="stitch-action-btn"
                        onClick={() => handleExportClusterGeoJson(cluster)}
                        title="Export this cluster as GeoJSON"
                      >
                        <span className="material-symbols-outlined">download</span>
                        <span>Export GeoJSON</span>
                      </button>
                    </div>
                  </div>

                  {/* Aggregate Telemetry Metrics */}
                  <div className="stitch-cluster-metrics">
                    <div className="stitch-metric-box">
                      <span className="stitch-metric-box__label">DETECTIONS</span>
                      <span className="stitch-metric-box__val data-mono">
                        {cluster.hotspots.length} Hotspots
                      </span>
                    </div>

                    <div className="stitch-metric-box">
                      <span className="stitch-metric-box__label">CUMULATIVE FRP</span>
                      <span className="stitch-metric-box__val data-mono text-warning">
                        {cluster.totalFrp} MW
                      </span>
                    </div>

                    <div className="stitch-metric-box">
                      <span className="stitch-metric-box__label">PEAK FRP</span>
                      <span className="stitch-metric-box__val data-mono">
                        {cluster.maxFrp} MW
                      </span>
                    </div>

                    <div className="stitch-metric-box">
                      <span className="stitch-metric-box__label">AVG CONFIDENCE</span>
                      <span className="stitch-metric-box__val data-mono">
                        {cluster.avgConfidence}%
                      </span>
                    </div>

                    <div className="stitch-metric-box">
                      <span className="stitch-metric-box__label">CENTROID COORDS</span>
                      <span className="stitch-metric-box__val data-mono">
                        {cluster.centroid[0].toFixed(2)}°N, {cluster.centroid[1].toFixed(2)}°E
                      </span>
                    </div>

                    <div className="stitch-metric-box">
                      <span className="stitch-metric-box__label">NEAREST ASSET</span>
                      <span
                        className="stitch-metric-box__val text-truncate"
                        title={cluster.nearestFacility || cluster.nearestSettlement || "Regional Area"}
                      >
                        {cluster.nearestFacility || cluster.nearestSettlement || "Regional Area"}
                      </span>
                    </div>
                  </div>

                  {/* Risk Progress Bar */}
                  <div className="stitch-risk-bar-wrap">
                    <div className="stitch-risk-bar-header">
                      <span>CLUSTER THREAT PROFILE</span>
                      <span className="data-mono">{cluster.maxRiskScore} / 100</span>
                    </div>
                    <div className="stitch-risk-track">
                      <div
                        className={`stitch-risk-fill ${riskBadgeClass}`}
                        style={{ width: `${cluster.maxRiskScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Expand / Collapse Toggle */}
                  <div className="stitch-cluster-card__footer">
                    <button
                      type="button"
                      className="stitch-expand-toggle"
                      onClick={() =>
                        setExpandedClusterId(isExpanded ? null : cluster.id)
                      }
                    >
                      <span className="material-symbols-outlined">
                        {isExpanded ? "expand_less" : "expand_more"}
                      </span>
                      <span>
                        {isExpanded
                          ? "Hide Individual Detections"
                          : `Inspect ${cluster.hotspots.length} Grouped Hotspots`}
                      </span>
                    </button>
                  </div>

                  {/* Collapsible Hotspot Table */}
                  {isExpanded && (
                    <div className="stitch-expanded-table-wrap">
                      <table className="stitch-data-table">
                        <thead>
                          <tr>
                            <th>HOTSPOT ID</th>
                            <th>CLASSIFICATION</th>
                            <th>COORDINATES</th>
                            <th>FRP (MW)</th>
                            <th>BRIGHTNESS</th>
                            <th>CONFIDENCE</th>
                            <th>RISK SCORE</th>
                            <th>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cluster.hotspots.map((h) => {
                            const hRisk = h.risk_score ?? (h.risk?.score ?? 30);
                            return (
                              <tr key={h.id}>
                                <td className="data-mono text-primary font-bold">
                                  {h.id.slice(0, 10)}
                                </td>
                                <td>{h.classification}</td>
                                <td className="data-mono">
                                  {h.latitude.toFixed(3)}°N, {h.longitude.toFixed(3)}°E
                                </td>
                                <td className="data-mono text-warning">
                                  {h.frp ? `${h.frp.toFixed(1)} MW` : "N/A"}
                                </td>
                                <td className="data-mono">{h.brightness.toFixed(1)} K</td>
                                <td className="data-mono">{h.confidence}%</td>
                                <td>
                                  <span
                                    className={`stitch-mini-pill ${
                                      hRisk >= 80
                                        ? "stitch-risk--critical"
                                        : hRisk >= 60
                                        ? "stitch-risk--high"
                                        : hRisk >= 40
                                        ? "stitch-risk--moderate"
                                        : "stitch-risk--low"
                                    }`}
                                  >
                                    {hRisk}/100
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="stitch-mini-action-btn"
                                    onClick={() => {
                                      onSelectHotspot(h);
                                      onNavigateToMap();
                                    }}
                                    title="Switch to GIS Map and center on this detection"
                                  >
                                    <span className="material-symbols-outlined">
                                      travel_explore
                                    </span>
                                    <span>View on Map</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Cluster Summary & Statistics */}
        <aside className="stitch-summary-sidebar">
          <div className="stitch-summary-card">
            <h3 className="stitch-summary-card__title">
              <span className="material-symbols-outlined">analytics</span>
              <span>Cluster Intelligence</span>
            </h3>

            <div className="stitch-stat-item">
              <div className="stitch-stat-item__label">Total Active Clusters</div>
              <div className="stitch-stat-item__value data-mono">{totalClustersCount}</div>
            </div>

            <div className="stitch-stat-item">
              <div className="stitch-stat-item__label">Grouped Hotspots</div>
              <div className="stitch-stat-item__value data-mono">{totalHotspotsGrouped}</div>
            </div>

            <div className="stitch-stat-item">
              <div className="stitch-stat-item__label">Total Radiative Output</div>
              <div className="stitch-stat-item__value data-mono text-warning">
                {totalCumulativeFrp.toLocaleString()} MW
              </div>
            </div>

            <div className="stitch-stat-item">
              <div className="stitch-stat-item__label">High &amp; Critical Clusters</div>
              <div className="stitch-stat-item__value data-mono text-danger">
                {criticalClustersCount}
              </div>
            </div>
          </div>

          <div className="stitch-summary-card">
            <h4 className="stitch-summary-card__title">
              <span className="material-symbols-outlined">pie_chart</span>
              <span>Distribution Breakdown</span>
            </h4>
            <div className="stitch-breakdown-list">
              {clusters.slice(0, 6).map((c) => (
                <div key={c.id} className="stitch-breakdown-row">
                  <span className="stitch-breakdown-name text-truncate" title={c.name}>
                    {c.name}
                  </span>
                  <span className="stitch-breakdown-count data-mono">
                    {c.hotspots.length} ({Math.round((c.hotspots.length / (totalHotspotsGrouped || 1)) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="stitch-summary-card">
            <h4 className="stitch-summary-card__title">
              <span className="material-symbols-outlined">info</span>
              <span>Batch Operations Guide</span>
            </h4>
            <ul className="stitch-guide-list">
              <li>
                <strong>Bulk Acknowledge:</strong> Marks the entire cluster as triaged by operations.
              </li>
              <li>
                <strong>Batch Tag:</strong> Classifies incidents for cross-shift handovers.
              </li>
              <li>
                <strong>Export GeoJSON:</strong> Generates standards-compliant spatial polygons for external GIS workflows.
              </li>
              <li>
                <strong>View on Map:</strong> Jumps directly into the interactive satellite viewer with high-resolution layers.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default HotspotGroupingPage;
