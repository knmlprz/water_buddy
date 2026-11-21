import type { ParcelDiagnosisInput, ParcelDiagnosisResult } from '../engine/waterBrain';

export type FieldStatus = 'ok' | 'szacunek' | 'brak';

export interface ProvenanceField<T = unknown> {
  key: string;
  label: string;
  value: T;
  displayValue: string;
  unit?: string;
  source: string;
  dataDate: string;
  status: FieldStatus;
}

export interface ParcelGeometryInfo {
  id: string;
  label: string;
  voivodeship: string;
  county: string;
  commune: string;
  region: string;
  parcelNumber: string;
  wkt: string;
  polygonLatLngs: [number, number][]; // [lat, lon]
  centroid: [number, number]; // [lat, lon]
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  approxAreaHa: number | null;
}

export interface CumulativeKbwPoint {
  mmdd: string;
  label: string;
  thisYear: number | null;
  median10y: number | null;
  min10y: number | null;
  max10y: number | null;
  inCriticalWindow: boolean;
}

export interface YearlyCriticalKbwBar {
  year: number;
  kbwMm: number;
  dry: boolean;
  isCurrent: boolean;
}

export interface NdviSeasonPoint {
  date: string;
  ndvi: number;
  ndmi: number | null;
  cloudCoverPct: number;
  clearPixelPct: number;
}

export interface AnalysisSourceAttribution {
  name: string;
  category: string;
  usedFor: string;
  dataDate: string;
  fetchedAt: string;
  status: FieldStatus;
  license: string;
}

export interface AnalyzeApiResponse {
  ok: true;
  parcel: ParcelGeometryInfo;
  analysisDate: string;
  generatedAt: string;
  cropId: string;
  rawInput: ParcelDiagnosisInput;
  inputs: Record<string, ProvenanceField>;
  result: ParcelDiagnosisResult;
  tenYearSummaryPl: string;
  medianDeltaMm: number | null;
  edoRegionalContext: {
    available: boolean;
    label: string;
    source: string;
  };
  imgwCurrentObs: {
    available: boolean;
    station: string;
    measuredAt: string;
    tempC: string;
    rainMm: string;
    humidityPct: string;
  } | null;
  natura2000Sites: string[];
  ditchDetails: string | null;
  series: {
    kbwCumulative: CumulativeKbwPoint[];
    kbwCriticalWindowByYear: YearlyCriticalKbwBar[];
    kbwDryThresholdMm: number;
    ndvi: NdviSeasonPoint[];
    ndviMedianRef: number | null;
  };
  sources: AnalysisSourceAttribution[];
  timingMs: {
    uldk: number;
    meteo: number;
    terrain: number;
    soilAndProtected: number;
    hydroAndLandUse: number;
    s2: number;
    total: number;
  };
  cached: boolean;
}

export type LoadingStepKey = 'parcel_terrain' | 'meteo' | 'satellite' | 'soil_protected' | 'hydro';

export interface LoadingStepState {
  key: LoadingStepKey;
  label: string;
  sourceHint: string;
  status: 'pending' | 'running' | 'ok' | 'fallback' | 'error';
  detail?: string;
  durationMs?: number;
}
