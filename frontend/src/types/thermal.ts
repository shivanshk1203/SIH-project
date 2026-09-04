export type EventClassification =
  | "Industrial Heat"
  | "Wildfire"
  | "Agricultural Burning"
  | "Mining / Waste Heat"
  | "Controlled Burning"
  | "Gas Flare"
  | "Other Thermal Source"
  | "Needs Verification"
  | "Industrial Fire"; // backwards compatibility

export type EventSeverity = "CRITICAL" | "HIGH" | "WARNING" | "MODERATE" | "LOW" | "NORMAL";

export type EventStatus = "Active" | "Investigating" | "Under Observation" | "Resolved" | "False Positive";

export interface ThermalEvent {
  id: string;
  name: string;
  classification: EventClassification;
  confidence: number; // general confidence
  classificationConfidence: number; // analytical classification confidence % (e.g. 87)
  firmsConfidence: number | string; // raw NASA FIRMS sensor confidence (e.g. 50 or "nominal")
  classificationReason?: string; // transparent explanation
  evidenceList?: string[]; // concrete evidence signals
  severity: EventSeverity;
  status: EventStatus;
  detectedTime: string; // e.g. "18:42 IST"
  detectedDate: string; // e.g. "03 Sep 2026"
  coordinates: [number, number]; // [lat, lon]
  locationName: string; // e.g. "Jamnagar, Gujarat"
  state: string;
  frpMw: number; // Fire Radiative Power in MW
  brightnessK: number;
  baselineFrpMw: number;
  peakFrpMw: number;
  durationHours: number;
  isPersistent: boolean;
  persistenceDays?: number; // 7, 30, 90
  nearestFacility: {
    name: string;
    type: string; // "Oil Refinery", "Thermal Power Plant", etc.
    distanceKm: number;
    status: "Operational" | "Maintenance" | "Emergency Shutdown" | "Under Review";
  };
  satellite?: string; // e.g. "VIIRS Suomi-NPP" or "MODIS"
  instrument?: string; // e.g. "VIIRS"
  daynight?: string; // "D" | "N"
  scan?: number;
  track?: number;
  confidenceBreakdown: {
    industrialFire: number;
    gasFlare: number;
    wildfire: number;
    agriculturalBurning: number;
    miningSource?: number;
    unknown?: number;
  };
  supportingEvidence: string[];
  satelliteImages: {
    beforeUrl: string;
    duringUrl: string;
    latestUrl: string;
  };
  evidenceQuality?: "Strong" | "Mixed" | "Weak" | "Verification Required";
  landCover?: string;
  analystOverride?: {
    newClassification: EventClassification;
    reason: string;
    timestamp: string;
    analystName?: string;
  } | null;
  auditTrail?: ClassificationAuditEntry[];
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface ClassificationAuditEntry {
  action: "INITIAL_CLASSIFICATION" | "ANALYST_CONFIRMED" | "ANALYST_OVERRIDE" | "MARKED_FOR_VERIFICATION" | "MARKED_FALSE_POSITIVE";
  classification: EventClassification;
  timestamp: string;
  analyst: string;
  notes?: string;
  confidence?: number;
}

export type AlertStatus = "NEW" | "ACKNOWLEDGED" | "INVESTIGATING" | "ESCALATED" | "RESOLVED" | "DISMISSED" | "Active" | "Dispatched";

export interface OperationalAlert {
  id: string;
  eventId: string;
  location: string;
  facility: string;
  trigger: string;
  severity: EventSeverity;
  detectedTime: string;
  status: AlertStatus | string;
  notes?: string;
  classification?: EventClassification;
  frpMw?: number;
  confidence?: number;
  isAutomated?: boolean;
  relativeTime?: string;
  baselineDeviation?: string;
  distanceKm?: number;
  recommendedAction?: string;
}

export interface FacilityProfile {
  id: string;
  name: string;
  type: string;
  state: string;
  coordinates: [number, number];
  totalThermalEvents: number;
  abnormalEvents: number;
  highSeverityEvents: number;
  persistentThermalSources: number;
  avgThermalIntensityMw: number;
  nominalBaselineMw: number;
  criticalThresholdMw: number;
  contactChannel: string;
}

export interface StateThreatRanking {
  state: string;
  totalEvents: number;
  industrialFires: number;
  wildfires: number;
  flares: number;
  highSeverity: number;
  riskScore: number;
}
