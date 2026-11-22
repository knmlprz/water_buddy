import type { CropParameter } from '../data/crops';
import type { SoilWaterGroup } from '../data/thresholds';
import {
  getIungThreshold,
  iungCategoryFromLabel,
  IUNG_PERIODS,
  type IungPeriod,
  type IungSoilCategory
} from '../data/iungThresholds';
import { isDateInMmDdWindow } from './waterBrain';
import type { CumulativeKbwPoint, YearlyCriticalKbwBar } from '../types/analysis';

export interface DailyMeteoRecord {
  date: string; // YYYY-MM-DD
  precipMm: number;
  et0Mm: number;
  tempMeanC: number | null;
  soilMoistureTop: number | null; // m3/m3 (0-7cm + 7-28cm weighted avg)
}

/**
 * Parses a WKT POLYGON / MULTIPOLYGON string (EPSG:4326 lon lat pairs) into outer ring [lat, lon][].
 */
export function parseWktOuterRing(wkt: string): [number, number][] {
  const cleaned = wkt.replace(/^SRID=\d+;/i, '').trim();
  // Match first polygon outer ring inside (( ... ))
  const ringMatch = /\(\(\s*([^()]+?)\s*\)/.exec(cleaned);
  if (!ringMatch) return [];
  const coords: [number, number][] = [];
  const pairs = ringMatch[1].split(',');
  for (const pair of pairs) {
    const parts = pair.trim().split(/\s+/);
    if (parts.length >= 2) {
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        coords.push([lat, lon]);
      }
    }
  }
  return coords;
}

/**
 * Computes true geometric area-weighted polygon centroid (shoelace formula) in [lat, lon]
 * plus bounding box [minLon, minLat, maxLon, maxLat] and approximate area in hectares.
 */
export function computePolygonGeometry(ringLatLng: [number, number][]): {
  centroid: [number, number];
  bbox: [number, number, number, number];
  approxAreaHa: number | null;
} {
  if (ringLatLng.length === 0) {
    return { centroid: [52.23, 19.0], bbox: [18.99, 52.22, 19.01, 52.24], approxAreaHa: null };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of ringLatLng) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  // Ensure closed ring for shoelace centroid
  const pts =
    ringLatLng.length > 2 &&
    (ringLatLng[0][0] !== ringLatLng[ringLatLng.length - 1][0] ||
      ringLatLng[0][1] !== ringLatLng[ringLatLng.length - 1][1])
      ? [...ringLatLng, ringLatLng[0]]
      : ringLatLng;

  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i][1]; // lon
    const y0 = pts[i][0]; // lat
    const x1 = pts[i + 1][1];
    const y1 = pts[i + 1][0];
    const cross = x0 * y1 - x1 * y0;
    area2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  let centroidLat: number;
  let centroidLon: number;
  if (Math.abs(area2) > 1e-12) {
    centroidLon = cx / (3 * area2);
    centroidLat = cy / (3 * area2);
  } else {
    centroidLat = (minLat + maxLat) / 2;
    centroidLon = (minLon + maxLon) / 2;
  }

  // Approximate planar area in hectares using local meters-per-degree at centroid latitude
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((centroidLat * Math.PI) / 180);
  const areaSqM = Math.abs(area2 / 2) * mPerDegLat * mPerDegLon;
  const approxAreaHa = areaSqM > 10 ? Number((areaSqM / 10000).toFixed(2)) : null;

  return {
    centroid: [Number(centroidLat.toFixed(6)), Number(centroidLon.toFixed(6))],
    bbox: [
      Number(minLon.toFixed(6)),
      Number(minLat.toFixed(6)),
      Number(maxLon.toFixed(6)),
      Number(maxLat.toFixed(6))
    ],
    approxAreaHa
  };
}

// --- Gamma Distribution & Standard Normal Inverse CDF for SPI-1 / SPI-3 ---

function logGamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  let x = p[0];
  const zm = z - 1;
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (zm + i);
  }
  const t = zm + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zm + 0.5) * Math.log(t) - t + Math.log(x);
}

function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Series expansion
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 120; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-10) break;
    }
    return Math.min(Math.max(sum * Math.exp(-x + a * Math.log(x) - logGamma(a)), 0), 1);
  }
  // Continued fraction (Lentz)
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 120; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  return Math.min(Math.max(1 - q, 0), 1);
}

/**
 * Abramowitz & Stegun 26.2.23 rational approximation for standard normal quantile (SPI z-score).
 */
export function inverseNormalCdf(p: number): number {
  const clamped = Math.min(Math.max(p, 1e-5), 1 - 1e-5);
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  if (clamped <= 0.5) {
    const t = Math.sqrt(-2 * Math.log(clamped));
    return -(t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
  }
  const t = Math.sqrt(-2 * Math.log(1 - clamped));
  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

/**
 * Standardized Precipitation Index (SPI) using Thom (1958) gamma MLE over historical reference window totals.
 */
export function computeGammaSpi(referenceTotals: number[], targetTotal: number): number | null {
  if (referenceTotals.length < 5) return null;
  const positives = referenceTotals.filter((v) => v > 0);
  const qZero = (referenceTotals.length - positives.length) / referenceTotals.length;

  if (positives.length < 3) {
    return 0;
  }

  const mean = positives.reduce((a, b) => a + b, 0) / positives.length;
  const meanLog = positives.reduce((a, b) => a + Math.log(b), 0) / positives.length;
  const A = Math.log(mean) - meanLog;

  if (!Number.isFinite(A) || A <= 1e-6) {
    const variance =
      referenceTotals.reduce((a, b) => a + (b - mean) ** 2, 0) / referenceTotals.length;
    const sd = Math.sqrt(variance);
    if (sd < 1e-6) return 0;
    return Number(Math.min(Math.max((targetTotal - mean) / sd, -3.5), 3.5).toFixed(2));
  }

  const alpha = (1 + Math.sqrt(1 + (4 * A) / 3)) / (4 * A);
  const beta = mean / alpha;

  const G = targetTotal <= 0 ? 0 : regularizedGammaP(alpha, targetTotal / beta);
  const H = qZero + (1 - qZero) * G;
  const z = inverseNormalCdf(H);
  return Number(Math.min(Math.max(z, -3.5), 3.5).toFixed(2));
}

function getWindowSumBeforeDate(
  records: DailyMeteoRecord[],
  endIndex: number,
  windowDays: number,
  selector: (r: DailyMeteoRecord) => number
): number | null {
  const start = endIndex - windowDays + 1;
  if (start < 0) return null;
  let sum = 0;
  for (let i = start; i <= endIndex; i++) {
    sum += selector(records[i]);
  }
  return sum;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Computes all meteorological & hydrological metrics strictly up to `analysisDate` (zero future leakage!).
 */
export function analyzeMeteoHistory(
  allRecords: DailyMeteoRecord[],
  crop: CropParameter,
  soil: SoilWaterGroup,
  analysisDate: string
): {
  kbw60dMm: number;
  rain60dMm: number;
  et060dMm: number;
  spi1: number | null;
  spi3: number | null;
  spiReferenceYears: number;
  sma: number | null;
  smaAvailable: boolean;
  depletionFraction: number;
  dryYearsLast10: number;
  tenYearSummaryPl: string;
  medianDeltaMm: number | null;
  kbwCumulative: CumulativeKbwPoint[];
  kbwCriticalWindowByYear: YearlyCriticalKbwBar[];
  kbwDryThresholdMm: number;
  kbwReferenceLabel: string;
  iungCategory: IungSoilCategory | null;
  iungPeriodLabel: string | null;
  iungKbwMm: number | null;
  iungThresholdMm: number | null;
  iungDrought: boolean | null;
} {
  // Enforce hard cutoff <= analysisDate (Rule 2: zero future data!)
  const records = allRecords
    .filter((r) => r.date <= analysisDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const targetIdx = records.length - 1;
  const analysisYear = Number(analysisDate.slice(0, 4));
  const targetMmDd = analysisDate.slice(5, 10);

  // 1. 60-day KBW (6 decades like IUNG SMSR)
  const slice60 = records.slice(Math.max(0, records.length - 60));
  const rain60dMm = Number(slice60.reduce((a, r) => a + r.precipMm, 0).toFixed(1));
  const et060dMm = Number(slice60.reduce((a, r) => a + r.et0Mm, 0).toFixed(1));
  const kbw60dMm = Math.round(rain60dMm - et060dMm);

  // Index dates for fast same-calendar-day lookup across years
  const byDateIdx = new Map<string, number>();
  records.forEach((r, idx) => byDateIdx.set(r.date, idx));

  const findNearestDateIdx = (year: number, mmdd: string): number | null => {
    const exact = byDateIdx.get(`${year}-${mmdd}`);
    if (exact !== undefined) return exact;
    // Handle Feb 29 -> Feb 28
    if (mmdd === '02-29') {
      const alt = byDateIdx.get(`${year}-02-28`);
      if (alt !== undefined) return alt;
    }
    return null;
  };

  // 2. SPI-1 (30d) and SPI-3 (90d) over reference years 1991..2020 (or available years < analysisYear)
  const targetRain30 = targetIdx >= 29 ? getWindowSumBeforeDate(records, targetIdx, 30, (r) => r.precipMm) : null;
  const targetRain90 = targetIdx >= 89 ? getWindowSumBeforeDate(records, targetIdx, 90, (r) => r.precipMm) : null;

  const ref30: number[] = [];
  const ref90: number[] = [];
  const startRefYear = Math.min(1991, analysisYear - 10);
  const endRefYear = Math.min(2020, analysisYear - 1);
  const refEnd = endRefYear - startRefYear >= 9 ? endRefYear : analysisYear - 1;

  for (let y = startRefYear; y <= refEnd; y++) {
    const idx = findNearestDateIdx(y, targetMmDd);
    if (idx === null) continue;
    const r30 = getWindowSumBeforeDate(records, idx, 30, (r) => r.precipMm);
    const r90 = getWindowSumBeforeDate(records, idx, 90, (r) => r.precipMm);
    if (r30 !== null) ref30.push(r30);
    if (r90 !== null) ref90.push(r90);
  }

  const spi1 = targetRain30 !== null ? computeGammaSpi(ref30, targetRain30) : null;
  const spi3 = targetRain90 !== null ? computeGammaSpi(ref90, targetRain90) : null;

  // 3. SMA (10-day Soil Moisture Anomaly z-score vs same 10-day window in previous 10 years)
  const avgSoilMoisture10d = (endIdx: number): number | null => {
    const start = endIdx - 9;
    if (start < 0) return null;
    const vals: number[] = [];
    for (let i = start; i <= endIdx; i++) {
      if (records[i].soilMoistureTop !== null) vals.push(records[i].soilMoistureTop as number);
    }
    if (vals.length < 5) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const currentSm10 = targetIdx >= 9 ? avgSoilMoisture10d(targetIdx) : null;
  const refSm10: number[] = [];
  for (let y = analysisYear - 10; y <= analysisYear - 1; y++) {
    const idx = findNearestDateIdx(y, targetMmDd);
    if (idx === null) continue;
    const avg = avgSoilMoisture10d(idx);
    if (avg !== null) refSm10.push(avg);
  }

  let sma: number | null = null;
  if (currentSm10 !== null && refSm10.length >= 5) {
    const meanSm = refSm10.reduce((a, b) => a + b, 0) / refSm10.length;
    const varianceSm =
      refSm10.reduce((a, b) => a + (b - meanSm) ** 2, 0) / refSm10.length;
    const sdSm = Math.sqrt(varianceSm);
    if (sdSm > 1e-5) {
      sma = Number(Math.min(Math.max((currentSm10 - meanSm) / sdSm, -3.5), 3.5).toFixed(2));
    } else {
      sma = 0;
    }
  }

  // 4. Chart 1: Cumulative KBW from March 21 to analysisDate (step ~5 days) vs 10 previous years
  const seasonStartYear = targetMmDd >= '03-21' ? analysisYear : analysisYear - 1;
  const seasonEndMmDd = targetMmDd >= '03-21' ? targetMmDd : '09-30';

  const getCumulativeSeasonSeries = (year: number, endMmDd: string): Map<string, number> => {
    const map = new Map<string, number>();
    let cum = 0;
    const startStr = `${year}-03-21`;
    const endStr = `${year}-${endMmDd}`;
    for (const r of records) {
      if (r.date < startStr) continue;
      if (r.date > endStr) break;
      cum += r.precipMm - r.et0Mm;
      map.set(r.date.slice(5, 10), Math.round(cum));
    }
    return map;
  };

  const thisYearSeries = getCumulativeSeasonSeries(seasonStartYear, seasonEndMmDd);
  const histSeries: Map<string, number>[] = [];
  for (let y = seasonStartYear - 10; y <= seasonStartYear - 1; y++) {
    const s = getCumulativeSeasonSeries(y, seasonEndMmDd);
    if (s.size > 5) histSeries.push(s);
  }

  const allKeys = Array.from(thisYearSeries.keys()).sort();
  // Downsample to ~35 points max for clean crisp SVG chart
  const stride = Math.max(1, Math.floor(allKeys.length / 32));
  const kbwCumulative: CumulativeKbwPoint[] = [];
  allKeys.forEach((mmdd, idx) => {
    if (idx % stride !== 0 && idx !== allKeys.length - 1) return;
    const histVals = histSeries
      .map((m) => m.get(mmdd))
      .filter((v): v is number => v !== undefined);
    const med = median(histVals);
    const [m, d] = mmdd.split('-');
    kbwCumulative.push({
      mmdd,
      label: `${d}.${m}`,
      thisYear: thisYearSeries.get(mmdd) ?? null,
      median10y: med !== null ? Math.round(med) : null,
      min10y: histVals.length ? Math.min(...histVals) : null,
      max10y: histVals.length ? Math.max(...histVals) : null,
      inCriticalWindow: isDateInMmDdWindow(
        `${seasonStartYear}-${mmdd}`,
        crop.okno_start_mmdd,
        crop.okno_koniec_mmdd
      )
    });
  });

  const lastCum = kbwCumulative[kbwCumulative.length - 1];
  const medianDeltaMm =
    lastCum && lastCum.thisYear !== null && lastCum.median10y !== null
      ? Math.round(lastCum.thisYear - lastCum.median10y)
      : null;

  // 5. Agricultural drought per IUNG SMSR (Rozp. MRiRW 2019): KBW of a 6-decade period vs the
  // threshold for this crop and soil category. Chart 2 / dryYearsLast10 use the same period each year.
  const iung = assessIungDrought(records, crop, soil, analysisDate);

  const kbwSumBetween = (startStr: string, endStr: string): number | null => {
    let sumKbw = 0;
    let count = 0;
    for (const r of records) {
      if (r.date < startStr) continue;
      if (r.date > endStr) break;
      sumKbw += r.precipMm - r.et0Mm;
      count++;
    }
    return count >= 5 ? Math.round(sumKbw) : null;
  };

  // Without an IUNG threshold (e.g. lucerne) fall back to the crop's own critical-window thresholds
  const usesIung = iung.referencePeriod !== null && iung.referenceThresholdMm !== null;
  const kbwDryThresholdMm = usesIung
    ? (iung.referenceThresholdMm as number)
    : soil.id === 'piasek_luzny'
      ? crop.prog_kbw_kat1_mm
      : crop.prog_kbw_kat2_mm;
  const windowStartMmDd = usesIung ? iung.referencePeriod!.startMmDd : crop.okno_start_mmdd;
  const windowEndMmDd = usesIung ? iung.referencePeriod!.endMmDd : crop.okno_koniec_mmdd;

  const kbwCriticalWindowByYear: YearlyCriticalKbwBar[] = [];
  let dryYearsLast10 = 0;

  for (let y = analysisYear - 10; y <= analysisYear; y++) {
    const startStr = `${y}-${windowStartMmDd}`;
    const rawEndStr = `${y}-${windowEndMmDd}`;
    // Strictly never exceed analysisDate!
    const endStr = y === analysisYear && rawEndStr > analysisDate ? analysisDate : rawEndStr;
    if (y === analysisYear && startStr > analysisDate) continue;

    const rounded = kbwSumBetween(startStr, endStr);
    if (rounded === null) continue;

    const isDry = usesIung ? rounded <= kbwDryThresholdMm : rounded < kbwDryThresholdMm;
    if (y < analysisYear && isDry) {
      dryYearsLast10++;
    }
    kbwCriticalWindowByYear.push({
      year: y,
      kbwMm: rounded,
      dry: isDry,
      isCurrent: y === analysisYear
    });
  }

  const kbwReferenceLabel = usesIung
    ? `okres IUNG ${iung.referencePeriod!.label}, gleba kat. ${iung.category}`
    : 'okno krytyczne uprawy';

  const deltaPhrase =
    medianDeltaMm === null
      ? ''
      : medianDeltaMm < -10
        ? ` Bieżący sezon od 21.03 ma bilans o ${Math.abs(medianDeltaMm)} mm gorszy od wieloletniej mediany.`
        : medianDeltaMm > 10
          ? ` Bieżący sezon od 21.03 ma bilans o ${medianDeltaMm} mm lepszy od wieloletniej mediany.`
          : ' Bieżący sezon od 21.03 jest zbliżony do wieloletniej mediany.';

  const tenYearSummaryPl = usesIung
    ? `W ${dryYearsLast10} z ostatnich 10 lat bilans KBW w okresie ${iung.referencePeriod!.label} spadał do progu suszy rolniczej dla uprawy (${crop.nazwa_pl}) na glebie kat. ${iung.category} (${kbwDryThresholdMm} mm wg IUNG / Rozp. MRiRW).${deltaPhrase}`
    : `W ${dryYearsLast10} z ostatnich 10 lat okno krytyczne dla uprawy (${crop.nazwa_pl}) przekraczało próg suszy KBW (${kbwDryThresholdMm} mm).${deltaPhrase}`;

  // 6. FAO-56 / Drupka daily soil water depletion from March 1 to analysisDate
  const depletionFraction = computeFao56DailyDepletion(records, crop, soil, analysisDate);

  return {
    kbw60dMm,
    rain60dMm,
    et060dMm,
    spi1,
    spi3,
    spiReferenceYears: ref90.length,
    sma,
    smaAvailable: sma !== null,
    depletionFraction,
    dryYearsLast10,
    tenYearSummaryPl,
    medianDeltaMm,
    kbwCumulative,
    kbwCriticalWindowByYear,
    kbwDryThresholdMm,
    kbwReferenceLabel,
    iungCategory: iung.category,
    iungPeriodLabel: iung.currentPeriod?.label ?? null,
    iungKbwMm: iung.currentKbwMm,
    iungThresholdMm: iung.currentThresholdMm,
    iungDrought: iung.drought
  };
}

export interface IungDroughtAssessment {
  category: IungSoilCategory | null;
  // Latest completed IUNG period (<= 10 days before analysisDate) where the crop is assessed
  currentPeriod: IungPeriod | null;
  currentKbwMm: number | null;
  currentThresholdMm: number | null;
  drought: boolean | null; // null = brak oceny (poza sezonem, uprawa/gleba nieobjęta rozporządzeniem)
  // Period used for the 10-year comparison (current one, or the one closest to the crop's critical window)
  referencePeriod: IungPeriod | null;
  referenceThresholdMm: number | null;
}

export function assessIungDrought(
  records: DailyMeteoRecord[],
  crop: CropParameter,
  soil: SoilWaterGroup,
  analysisDate: string
): IungDroughtAssessment {
  const category = iungCategoryFromLabel(soil.kategoria_iung);
  const year = analysisDate.slice(0, 4);
  const applicable = IUNG_PERIODS.filter(
    (p) => getIungThreshold(crop.id, category, p.nr) !== null
  );

  const daysBetween = (a: string, b: string) =>
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

  const completed = applicable.filter((p) => `${year}-${p.endMmDd}` <= analysisDate);
  const latest = completed[completed.length - 1] ?? null;
  const currentPeriod =
    latest && daysBetween(`${year}-${latest.endMmDd}`, analysisDate) <= 10 ? latest : null;

  let currentKbwMm: number | null = null;
  let currentThresholdMm: number | null = null;
  let drought: boolean | null = null;
  if (currentPeriod) {
    const startStr = `${year}-${currentPeriod.startMmDd}`;
    const endStr = `${year}-${currentPeriod.endMmDd}`;
    let sum = 0;
    let count = 0;
    for (const r of records) {
      if (r.date < startStr) continue;
      if (r.date > endStr) break;
      sum += r.precipMm - r.et0Mm;
      count++;
    }
    // Require nearly the whole 6-decade period, otherwise the sum is not comparable with IUNG
    if (count >= 55) {
      currentKbwMm = Math.round(sum);
      currentThresholdMm = getIungThreshold(crop.id, category, currentPeriod.nr);
      drought = currentThresholdMm !== null ? currentKbwMm <= currentThresholdMm : null;
    }
  }

  let referencePeriod: IungPeriod | null = currentPeriod;
  if (!referencePeriod && applicable.length > 0) {
    const target = `${year}-${crop.okno_koniec_mmdd}`;
    referencePeriod = applicable.reduce((best, p) =>
      Math.abs(daysBetween(`${year}-${p.endMmDd}`, target)) <
      Math.abs(daysBetween(`${year}-${best.endMmDd}`, target))
        ? p
        : best
    );
  }

  return {
    category,
    currentPeriod,
    currentKbwMm,
    currentThresholdMm,
    drought,
    referencePeriod,
    referenceThresholdMm: referencePeriod
      ? getIungThreshold(crop.id, category, referencePeriod.nr)
      : null
  };
}

/**
 * Daily FAO-56 / Drupka soil water balance in the effective root zone (March 1 -> analysisDate).
 * Starts at field capacity (PPW = TAW) after winter recharge on March 1.
 */
export function computeFao56DailyDepletion(
  records: DailyMeteoRecord[],
  crop: CropParameter,
  soil: SoilWaterGroup,
  analysisDate: string
): number {
  const year = Number(analysisDate.slice(0, 4));
  const startDate = `${year}-03-01`;
  const effectiveDepthM = Math.min(Math.max(crop.glebokosc_efektywna_m, 0.4), 1.0);
  const tawMm = Math.max(soil.woda_dostepna_50cm_mm * 2 * effectiveDepthM, 10);

  let storageMm = tawMm; // Start at field capacity on March 1

  for (const r of records) {
    if (r.date < startDate) continue;
    if (r.date > analysisDate) break;

    const mmdd = r.date.slice(5, 10);
    let kc = crop.kc_ini;
    if (isDateInMmDdWindow(r.date, crop.okno_start_mmdd, crop.okno_koniec_mmdd)) {
      kc = crop.kc_mid;
    } else if (isDateInMmDdWindow(r.date, crop.okno_zbior_start_mmdd, crop.okno_zbior_koniec_mmdd)) {
      kc = crop.kc_end;
    } else if (mmdd > crop.okno_koniec_mmdd && mmdd < crop.okno_zbior_start_mmdd) {
      kc = (crop.kc_mid + crop.kc_end) / 2;
    } else if (mmdd >= '04-01' && mmdd < crop.okno_start_mmdd) {
      kc = (crop.kc_ini + crop.kc_mid) / 2;
    }

    // Effective rainfall (~85% of rain above 2mm avoids light interception/runoff)
    const effectiveRain = r.precipMm > 2 ? r.precipMm * 0.85 : r.precipMm * 0.5;
    // FAO-56 eq. 84: once depletion exceeds RAW (= p * TAW) plants transpire less (Ks < 1),
    // so the root zone empties asymptotically instead of linearly to 0.
    const depletionMm = tawMm - storageMm;
    const rawMm = crop.dopuszczalne_wyczerpanie_p * tawMm;
    const ks =
      depletionMm <= rawMm
        ? 1
        : Math.max((tawMm - depletionMm) / ((1 - crop.dopuszczalne_wyczerpanie_p) * tawMm), 0);
    const etc = r.et0Mm * kc * ks;
    storageMm = Math.min(Math.max(storageMm + effectiveRain - etc, 0), tawMm);
  }

  const deficit = tawMm - storageMm;
  return Number(Math.min(Math.max(deficit / tawMm, 0), 1).toFixed(2));
}

/**
 * Computes terrain median slope (%) and local depression (> 0.5 m lower than surrounding rim)
 * from sampled NMT elevation points.
 */
export function computeSlopeAndDepression(params: {
  centerElevM: number;
  innerRingElevM: number[];
  outerRimElevM: number[];
  innerStepM: number;
}): { slopePct: number; hasDepression: boolean } {
  const slopes: number[] = [];
  const step = Math.max(params.innerStepM, 15);

  for (const h of params.innerRingElevM) {
    if (Number.isFinite(h)) {
      slopes.push((Math.abs(h - params.centerElevM) / step) * 100);
    }
  }
  const medSlope = median(slopes) ?? 0;

  const validRim = params.outerRimElevM.filter((v) => Number.isFinite(v));
  const rimMedian = median(validRim);
  const hasDepression =
    rimMedian !== null &&
    validRim.length >= 3 &&
    rimMedian - params.centerElevM > 0.5 &&
    validRim.filter((h) => h > params.centerElevM + 0.35).length >= Math.ceil(validRim.length * 0.75);

  return {
    slopePct: Number(Math.min(medSlope, 35).toFixed(1)),
    hasDepression
  };
}

export interface DownslopeEstimate {
  directionPl: string | null; // null = teren praktycznie płaski (brak wyraźnego kierunku spływu)
  dropPct: number;
}

/**
 * Direction of steepest descent around the parcel centre from sparse NMT samples:
 * the neighbour with the largest elevation drop per metre. Below 0.5% the terrain is
 * treated as flat (water mostly infiltrates or ponds instead of running off one side).
 */
export function computeDownslopeDirection(
  centerElevM: number,
  neighbours: Array<{ elevM: number | null; directionPl: string; distanceM: number }>
): DownslopeEstimate | null {
  let best: { directionPl: string; dropPct: number } | null = null;
  for (const n of neighbours) {
    if (n.elevM === null) continue;
    const dropPct = ((centerElevM - n.elevM) / n.distanceM) * 100;
    if (!best || dropPct > best.dropPct) best = { directionPl: n.directionPl, dropPct };
  }
  if (!best) return null;
  const dropPct = Number(best.dropPct.toFixed(1));
  return dropPct < 0.5 ? { directionPl: null, dropPct } : { directionPl: best.directionPl, dropPct };
}
