export type EvidenceRow = {
  signal: string;
  status: "evaluated" | "limited" | "unavailable";
  icon: string;
  result: string;
  source: string;
};

export type AnalysisTelemetry = {
  hotspots_analyzed: number;
  location_analysis: string;
  land_use_analysis: string;
  facility_search: string;
  historical_analysis: string;
  spatial_analysis: string;
  industrial_context_detected: number;
  agricultural_context_detected: number;
  vegetation_fire_context_detected: number;
  truly_unresolved: number;
  gis_status: string;
};

export type AnalysisHealth = {
  total: number;
  classified: number;
  low_confidence: number;
  verification_required: number;
  analysis_status: "Complete" | "Partial" | "Pending" | "Failed";
  analysis_completed_count: number;
  breakdown: Record<string, number>;
  unresolved_reasons?: {
    conflicting_hypotheses: number;
    low_sensor_confidence: number;
    insufficient_context: number;
    no_historical_data: number;
    other: number;
  };
  risk_summary?: {
    CRITICAL: number;
    HIGH: number;
    MODERATE: number;
    LOW: number;
    MINIMAL: number;
    UNRESOLVED: number;
  };
  telemetry?: AnalysisTelemetry;
};

export type Facility = {
  name: string;
  type: string;
  type_label: string;
  latitude: number;
  longitude: number;
  distance_m?: number;
};

export type Hotspot = {
  id: string;
  latitude: number;
  longitude: number;
  brightness: number;
  bright_ti4?: number;
  bright_ti5?: number | null;
  frp?: number | null;
  detection_confidence: number;
  confidence: number;
  detected_at: string;
  is_demo_data: boolean;
  classification: string;
  verification_status?: "Not required" | "Recommended" | "Required";
  analysis_status?: "Complete" | "Partial" | "Failed";
  supporting_evidence?: string[];
  contradicting_evidence?: string[];
  why_not_classified?: {
    missing: string[];
    conflicting: string[];
    weak_evidence: string[];
    unresolved_reason: string;
  };

  locationContext?: {
    landCover: string;
    nearbyFacilities: any[];
    industrialAreas: any[];
    roads: any;
    settlements: any;
    agriculture: any;
    mines: any;
    wasteSites: any;
    facilityMatchName?: string | null;
    gisEnrichmentStatus?: string;
  };
  spatialEvidence?: {
    isInsideIndustrialPolygon: boolean;
    distanceToIndustrialBoundaryM: number;
    distanceToIndustrialStructureM: number;
    apparentIndustrialArea: boolean;
    infrastructurePattern: string;
    landUseMatch: boolean;
    matchedFacilityName?: string | null;
  };
  historicalEvidence?: {
    repeatedDetections50m: number;
    repeatedDetections100m: number;
    repeatedDetections250m: number;
    repeatedDetections500m: number;
    isStationary: boolean;
    isExpanding: boolean;
    observationCount: number;
    temporalSpanHours?: number;
  };
  sourceScores?: {
    industrial: number;
    wildfire: number;
    agricultural: number;
    mining_waste: number;
    controlled: number;
    sensor_anomaly: number;
  };

  risk_score?: number;
  risk_level?: "MINIMAL" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  thermal_nature?: string;
  investigation_priority?: number;

  evidence_chain?: EvidenceRow[];
  reasons?: string[];
  explanation?: string;
  nearest_facility?: string | null;
  nearest_settlement?: string | null;
  likely_source?: string | null;
  timestamp?: string;
  temporal_behavior?: string;
  spatial_behavior?: string;
  abnormality_score?: number;
  abnormality_ratio?: number;
  baseline_frp?: number;
  risk?: {
    score: number;
    level: string;
    drivers?: string[];
    reducers?: string[];
  };
};
