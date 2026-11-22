import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import proj4 from 'proj4';
import { fromUrl } from 'geotiff';
import { CROPS_DATA } from '../data/crops';
import { METEO_SEED_CELLS } from '../data/meteoSeed/index';
import { SOIL_WATER_GROUPS } from '../data/thresholds';
import { runWaterDiagnosis, type LandUseType, type ParcelDiagnosisInput } from '../engine/waterBrain';
import {
  analyzeMeteoHistory,
  computePolygonGeometry,
  computeDownslopeDirection,
  computeSlopeAndDepression,
  median,
  parseWktOuterRing,
  type DailyMeteoRecord,
  type DownslopeEstimate
} from '../engine/climateStats';
import type {
  AnalysisSourceAttribution,
  AnalyzeApiResponse,
  FieldStatus,
  LoadingStepKey,
  LoadingStepState,
  NdviSeasonPoint,
  ParcelGeometryInfo,
  ProvenanceField
} from '../types/analysis';
import {
  buildUldkByIdUrl,
  buildUldkByXyUrl,
  fetchUldkParcel,
  type UldkParcelRecord
} from './uldk';

const EPSG_2180 =
  '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs';

const UTM_DEFS: Record<number, string> = {
  32633: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
  32634: '+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs',
  32635: '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs'
};

const USER_AGENT = 'WodaPol-KOWR-HackNation2026/1.0';

// Selected IMGW synoptic stations across Poland for nearest-station match on "today"
const IMGW_STATION_COORDS: Record<string, [number, number]> = {
  torun: [53.04, 18.59],
  bydgoszcz: [53.1, 17.98],
  poznan: [52.42, 16.83],
  warszawa: [52.16, 20.96],
  lodz: [51.72, 19.4],
  wroclaw: [51.1, 16.88],
  krakow: [50.08, 19.8],
  gdansk: [54.38, 18.6],
  szczecin: [53.4, 14.62],
  olsztyn: [53.77, 20.42],
  bialystok: [53.11, 23.16],
  lublin: [51.22, 22.4],
  rzeszow: [50.11, 22.04],
  katowice: [50.24, 19.03],
  opole: [50.63, 17.97],
  zielonagora: [51.93, 15.53],
  kielce: [50.81, 20.69],
  plock: [52.59, 19.73],
  kalisz: [51.78, 18.08],
  koszalin: [54.2, 16.15],
  suwalki: [54.13, 22.95],
  kolo: [52.2, 18.66],
  gorzow: [52.74, 15.28],
  elblag: [54.22, 19.54],
  siedlce: [52.18, 22.25],
  tarnow: [50.03, 20.98]
};

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const staticParcelCache = new Map<string, CacheEntry<StaticParcelBundle>>();
const meteoCache = new Map<string, CacheEntry<MeteoFetchResult>>();
const s2Cache = new Map<string, CacheEntry<S2FetchResult>>();
const parcelGeomCache = new Map<string, CacheEntry<ParcelGeometryInfo>>();

function getCached<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function setCached<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  if (map.size > 200) {
    const firstKey = map.keys().next().value;
    if (firstKey) map.delete(firstKey);
  }
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Disk cache for data that practically never changes (parcel outline, terrain, soil, ditches).
// Every reanalysis of a known parcel then skips ~11 GUGiK requests, which throttles per IP.
const DISK_CACHE_ROOT =
  process.env.CACHE_DIR ??
  (process.env.VERCEL
    ? path.join(os.tmpdir(), 'wodapol-cache')
    : path.resolve(process.cwd(), '.cache'));
const STATIC_DISK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function diskCachePath(bucket: string, key: string): string {
  const safe = createHash('sha1').update(key).digest('hex');
  return path.join(DISK_CACHE_ROOT, bucket, `${safe}.json`);
}

async function diskCacheGet<T>(bucket: string, key: string): Promise<T | null> {
  try {
    const raw = JSON.parse(await fs.readFile(diskCachePath(bucket, key), 'utf-8')) as {
      savedAt: number;
      value: T;
    };
    return Date.now() - raw.savedAt < STATIC_DISK_TTL_MS ? raw.value : null;
  } catch {
    return null;
  }
}

async function diskCachePut<T>(bucket: string, key: string, value: T): Promise<void> {
  try {
    const file = diskCachePath(bucket, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Read-only filesystem — the in-memory cache still works
  }
}

export function getTodayPolandIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '06';
  const d = parts.find((p) => p.type === 'day')?.value ?? '20';
  return `${y}-${m}-${d}`;
}

export function sanitizeAnalysisDate(raw: unknown): string {
  const today = getTodayPolandIso();
  if (typeof raw !== 'string') return today;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return today;
  const minYear = Number(today.slice(0, 4)) - 10;
  const minDate = `${minYear}${today.slice(4)}`;
  if (trimmed < minDate) return minDate;
  if (trimmed > today) return today;
  return trimmed;
}

export function sanitizeCropId(raw: unknown): string {
  if (typeof raw === 'string') {
    const found = CROPS_DATA.find((c) => c.id === raw.trim());
    if (found) return found.id;
  }
  return CROPS_DATA[0].id;
}

export function sanitizeParcelIdStrict(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^[0-9A-Za-z_./-]{4,45}$/.test(trimmed)) return null;
  return trimmed;
}

export function parseCoordinatePair(latRaw: unknown, lonRaw: unknown): [number, number] | null {
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < 48.8 || lat > 55.1 || lon < 14.0 || lon > 24.5) return null;
  return [lat, lon];
}

function addDaysIso(isoDate: string, deltaDays: number): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function diffDaysIso(dateA: string, dateB: string): number {
  const ms = new Date(`${dateA}T00:00:00Z`).getTime() - new Date(`${dateB}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

export class ParcelLookupError extends Error {
  code: 'NOT_FOUND' | 'TIMEOUT' | 'INVALID';
  constructor(code: 'NOT_FOUND' | 'TIMEOUT' | 'INVALID', message: string) {
    super(message);
    this.code = code;
  }
}

export async function lookupParcel(params: {
  id?: string | null;
  lat?: number;
  lon?: number;
}): Promise<ParcelGeometryInfo> {
  const cacheKey = params.id
    ? `id:${params.id}`
    : `xy:${params.lat?.toFixed(5)},${params.lon?.toFixed(5)}`;
  const cached = getCached(parcelGeomCache, cacheKey);
  if (cached) return cached;
  const onDisk = await diskCacheGet<ParcelGeometryInfo>('parcels', cacheKey);
  if (onDisk) {
    setCached(parcelGeomCache, cacheKey, onDisk, 60 * 60 * 1000);
    return onDisk;
  }

  let url: string;
  if (params.id) {
    url = buildUldkByIdUrl(params.id);
  } else if (params.lat !== undefined && params.lon !== undefined) {
    url = buildUldkByXyUrl(params.lat, params.lon);
  } else {
    throw new ParcelLookupError('INVALID', 'Podaj numer działki TERYT albo wskaż punkt na mapie.');
  }

  const uldkUnavailableMsg =
    'Serwer GUGiK (ULDK) chwilowo nie odpowiada poprawnie. Spróbuj ponownie za kilka minut.';

  // GUGiK throttling is often momentary — one retry after a short pause, then give up
  let record: UldkParcelRecord | null;
  try {
    record = await fetchUldkParcel(url, { timeoutMs: 7500, userAgent: USER_AGENT });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      record = await fetchUldkParcel(url, { timeoutMs: 6000, userAgent: USER_AGENT });
    } catch {
      throw new ParcelLookupError('TIMEOUT', uldkUnavailableMsg);
    }
  }

  if (!record) {
    throw new ParcelLookupError(
      'NOT_FOUND',
      'Nie znaleziono działki o tym numerze. Sprawdź numer albo wskaż ją na mapie.'
    );
  }

  const { id, voivodeship, county, commune, region, parcelNumber, wkt } = record;

  const ring = parseWktOuterRing(wkt);
  // Bez poprawnego obrysu nie liczymy analizy — inaczej dane pochodziłyby z innego miejsca
  if (ring.length < 3) {
    throw new ParcelLookupError('TIMEOUT', uldkUnavailableMsg);
  }
  const geom = computePolygonGeometry(ring);
  const label = `Działka ${parcelNumber || id}${region ? `, obręb ${region}` : ''}${commune ? `, gm. ${commune}` : ''}`;

  const info: ParcelGeometryInfo = {
    id,
    label,
    voivodeship,
    county,
    commune,
    region,
    parcelNumber,
    wkt,
    polygonLatLngs: ring,
    centroid: geom.centroid,
    bbox: geom.bbox,
    approxAreaHa: geom.approxAreaHa
  };

  setCached(parcelGeomCache, cacheKey, info, 60 * 60 * 1000);
  if (id) setCached(parcelGeomCache, `id:${id}`, info, 60 * 60 * 1000);
  await diskCachePut('parcels', cacheKey, info);
  if (id && cacheKey !== `id:${id}`) await diskCachePut('parcels', `id:${id}`, info);
  return info;
}

// --- Step A: Terrain (GUGiK NMT 1 m) ---
interface TerrainFetchResult {
  slopePct: number;
  hasDepression: boolean;
  centerElevM: number | null;
  downslope: DownslopeEstimate | null;
  status: FieldStatus;
  sampledCount: number;
  durationMs: number;
}

async function fetchNmtElevation(northingX: number, eastingY: number): Promise<number | null> {
  try {
    const url = `https://services.gugik.gov.pl/nmt/?request=GetHByXY&x=${northingX.toFixed(1)}&y=${eastingY.toFixed(1)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      // GUGiK throttling redirects to a ~130 MB junk response (same as ULDK) — never follow it
      redirect: 'manual',
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    if (raw.length > 32) return null;
    const num = Number(raw.replace(',', '.'));
    return Number.isFinite(num) && num > -20 && num < 2600 ? num : null;
  } catch {
    return null;
  }
}

async function fetchTerrainFromNmt(centroid: [number, number]): Promise<TerrainFetchResult> {
  const started = Date.now();
  const [lat, lon] = centroid;
  // proj4 returns [Easting, Northing] for EPSG:2180; GUGiK NMT expects x = Northing, y = Easting!
  const [easting, northing] = proj4('EPSG:4326', EPSG_2180, [lon, lat]);

  const innerStep = 35;
  const outerStep = 65;

  const queries: Array<[number, number]> = [
    [northing, easting], // 0: center
    [northing + innerStep, easting],
    [northing - innerStep, easting],
    [northing, easting + innerStep],
    [northing, easting - innerStep],
    [northing + outerStep, easting + outerStep],
    [northing + outerStep, easting - outerStep],
    [northing - outerStep, easting + outerStep],
    [northing - outerStep, easting - outerStep]
  ];

  const results = await Promise.all(queries.map(([nx, ey]) => fetchNmtElevation(nx, ey)));
  const centerElevM = results[0];
  const innerRing = results.slice(1, 5).filter((v): v is number => v !== null);
  const outerRim = results.slice(5, 9).filter((v): v is number => v !== null);
  const sampledCount = results.filter((v) => v !== null).length;

  if (centerElevM === null || innerRing.length < 2) {
    return {
      slopePct: 0,
      hasDepression: false,
      centerElevM: null,
      downslope: null,
      status: 'brak',
      sampledCount,
      durationMs: Date.now() - started
    };
  }

  const computed = computeSlopeAndDepression({
    centerElevM,
    innerRingElevM: innerRing,
    outerRimElevM: outerRim,
    innerStepM: innerStep
  });

  const diagM = Math.round(outerStep * Math.SQRT2);
  const downslope = computeDownslopeDirection(centerElevM, [
    { elevM: results[1], directionPl: 'północ', distanceM: innerStep },
    { elevM: results[2], directionPl: 'południe', distanceM: innerStep },
    { elevM: results[3], directionPl: 'wschód', distanceM: innerStep },
    { elevM: results[4], directionPl: 'zachód', distanceM: innerStep },
    { elevM: results[5], directionPl: 'północny wschód', distanceM: diagM },
    { elevM: results[6], directionPl: 'północny zachód', distanceM: diagM },
    { elevM: results[7], directionPl: 'południowy wschód', distanceM: diagM },
    { elevM: results[8], directionPl: 'południowy zachód', distanceM: diagM }
  ]);

  return {
    slopePct: computed.slopePct,
    hasDepression: computed.hasDepression,
    centerElevM: Number(centerElevM.toFixed(1)),
    downslope,
    status: 'ok',
    sampledCount,
    durationMs: Date.now() - started
  };
}

// --- Step B: Soil (IUNG katgl_landuse2024 + SoilGrids fallback) & Natura 2000 (GDOŚ) ---
interface SoilAndProtectedResult {
  soilId: string;
  soilSource: string;
  soilStatus: FieldStatus;
  iungGrayIndex: number | null;
  iungNonArable: boolean;
  isNatura2000: boolean;
  natura2000Status: FieldStatus;
  natura2000Sites: string[];
  durationMs: number;
}

async function fetchIungSoil(lat: number, lon: number): Promise<{
  grayIndex: number | null;
  soilId: string | null;
  nonArable: boolean;
}> {
  const delta = 0.001;
  const bbox = `${(lon - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lon + delta).toFixed(6)},${(lat + delta).toFixed(6)}`;
  const url = `https://sgeo.iung.pl/geoserver/Susza/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=Susza:katgl_landuse2024&QUERY_LAYERS=Susza:katgl_landuse2024&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=application/json`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5500)
    });
    if (!res.ok) return { grayIndex: null, soilId: null, nonArable: false };
    const data = (await res.json()) as {
      features?: Array<{ properties?: { GRAY_INDEX?: number } }>;
    };
    const val = data.features?.[0]?.properties?.GRAY_INDEX;
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return { grayIndex: null, soilId: null, nonArable: false };
    }
    if (val === 1) return { grayIndex: val, soilId: 'piasek_luzny', nonArable: false };
    if (val === 2) return { grayIndex: val, soilId: 'piasek_gliniasty', nonArable: false };
    if (val === 3) return { grayIndex: val, soilId: 'glina_lekka', nonArable: false };
    if (val === 4) return { grayIndex: val, soilId: 'pyl_zwykly', nonArable: false };
    // Values >= 10 in katgl_landuse2024 denote non-arable land cover (forest, urban, water, etc.)
    if (val >= 10) return { grayIndex: val, soilId: null, nonArable: true };
    return { grayIndex: val, soilId: null, nonArable: false };
  } catch {
    return { grayIndex: null, soilId: null, nonArable: false };
  }
}

async function fetchSoilGridsFallback(lat: number, lon: number): Promise<string | null> {
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&property=sand&property=silt&property=clay&depth=0-30cm&value=mean`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      properties?: {
        layers?: Array<{ name?: string; depths?: Array<{ values?: { mean?: number | null } }> }>;
      };
    };
    const layers = json.properties?.layers ?? [];
    const getVal = (name: string) =>
      layers.find((l) => l.name === name)?.depths?.[0]?.values?.mean ?? null;
    const sand = getVal('sand'); // g/kg (0-1000)
    const silt = getVal('silt');
    const clay = getVal('clay');
    if (sand === null || silt === null || clay === null) return null;
    if (sand >= 820) return 'piasek_luzny';
    if (sand >= 650) return 'piasek_gliniasty';
    if (silt >= 500) return 'pyl_zwykly';
    if (clay >= 270) return 'glina_zwykla';
    return 'glina_lekka';
  } catch {
    return null;
  }
}

async function fetchGdosNatura2000(lat: number, lon: number): Promise<{
  isNatura2000: boolean;
  status: FieldStatus;
  sites: string[];
}> {
  const delta = 0.002;
  const bbox = `${(lon - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lon + delta).toFixed(6)},${(lat + delta).toFixed(6)}`;
  const url = `https://sdi.gdos.gov.pl/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=GDOS:SpecjalneObszaryOchrony,GDOS:ObszarySpecjalnejOchrony&QUERY_LAYERS=GDOS:SpecjalneObszaryOchrony,GDOS:ObszarySpecjalnejOchrony&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=application/json&FEATURE_COUNT=5`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5500)
    });
    if (!res.ok) return { isNatura2000: false, status: 'brak', sites: [] };
    const data = (await res.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    const features = data.features ?? [];
    const sites = features
      .map((f) => {
        const p = f.properties ?? {};
        const name = String(p.nazwa ?? p.NAZWA ?? p.name ?? '').trim();
        const code = String(p.kod ?? p.KOD ?? p.kod_obszaru ?? '').trim();
        return name && code ? `${name} (${code})` : name || code || 'Obszar Natura 2000';
      })
      .filter(Boolean);
    return {
      isNatura2000: sites.length > 0,
      status: 'ok',
      sites: Array.from(new Set(sites))
    };
  } catch {
    return { isNatura2000: false, status: 'brak', sites: [] };
  }
}

async function fetchSoilAndProtected(lat: number, lon: number): Promise<SoilAndProtectedResult> {
  const started = Date.now();
  const [iung, natura] = await Promise.all([fetchIungSoil(lat, lon), fetchGdosNatura2000(lat, lon)]);

  let soilId = iung.soilId;
  let soilSource = 'IUNG-PIB GeoServer (Susza:katgl_landuse2024)';
  let soilStatus: FieldStatus = soilId ? 'ok' : 'szacunek';

  if (!soilId && !iung.nonArable) {
    const sg = await fetchSoilGridsFallback(lat, lon);
    if (sg) {
      soilId = sg;
      soilSource = 'ISRIC SoilGrids v2.0 (0–30 cm, awaryjne)';
      soilStatus = 'ok';
    }
  }

  if (!soilId) {
    soilId = 'glina_lekka';
    soilSource = iung.nonArable
      ? 'IUNG-PIB katgl_landuse2024 (obszar poza gruntami ornymi)'
      : 'Domyślna klasa średnia (brak odczytu z IUNG i SoilGrids)';
    soilStatus = 'szacunek';
  }

  return {
    soilId,
    soilSource,
    soilStatus,
    iungGrayIndex: iung.grayIndex,
    iungNonArable: iung.nonArable,
    isNatura2000: natura.isNatura2000,
    natura2000Status: natura.status,
    natura2000Sites: natura.sites,
    durationMs: Date.now() - started
  };
}

// --- Step C: BDOT10k Hydrography (row / ditches) & LandUse (TLes / RZab) ---
interface HydroAndLandUseResult {
  landUse: LandUseType;
  landUseStatus: FieldStatus;
  bdotConfirmedArable?: boolean;
  ditchDistanceM: number;
  ditchStatus: FieldStatus;
  ditchDetails: string | null;
  durationMs: number;
}

async function queryBdotXmlCodes(
  northing: number,
  easting: number,
  layers: string,
  halfSpanM: number,
  gridSize: number
): Promise<string[] | null> {
  // WMS 1.3.0 with EPSG:2180 uses axis order Northing, Easting
  const bbox = [
    (northing - halfSpanM).toFixed(1),
    (easting - halfSpanM).toFixed(1),
    (northing + halfSpanM).toFixed(1),
    (easting + halfSpanM).toFixed(1)
  ].join(',');
  const centerIdx = Math.floor(gridSize / 2);
  const url = `https://mapy.geoportal.gov.pl/wss/service/pub/guest/kompozycja_BDOT10k_WMS/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${encodeURIComponent(layers)}&QUERY_LAYERS=${encodeURIComponent(layers)}&CRS=EPSG:2180&BBOX=${bbox}&WIDTH=${gridSize}&HEIGHT=${gridSize}&I=${centerIdx}&J=${centerIdx}&INFO_FORMAT=text/xml&FEATURE_COUNT=15`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6500)
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes('FeatureInfoResponse') || text.includes('ServiceException')) {
      return null;
    }
    const codes = [...text.matchAll(/x_kod="([^"]+)"/g)].map((m) => m[1]);
    return Array.from(new Set(codes));
  } catch {
    return null;
  }
}

function describeHydroCodes(codes: string[]): string[] {
  const labels: string[] = [];
  if (codes.some((c) => c.startsWith('SWRM'))) labels.push('rów melioracyjny');
  if (codes.some((c) => c.startsWith('SWKN'))) labels.push('kanał');
  if (codes.some((c) => c.startsWith('SWRS'))) labels.push('ciek lub strumień');
  if (codes.some((c) => c.startsWith('PTWP'))) labels.push('zbiornik wodny / staw');
  if (codes.some((c) => c.startsWith('OIMK'))) labels.push('mokradło / teren podmokły');
  return labels;
}

async function fetchHydroAndLandUse(
  lat: number,
  lon: number,
  iungNonArableHint: boolean
): Promise<HydroAndLandUseResult> {
  const started = Date.now();
  const [easting, northing] = proj4('EPSG:4326', EPSG_2180, [lon, lat]);

  const landLayers = 'RTr,TLes,ku1,TPrz,BudMJ,BudMW,BudU,BudP1,BudP2,WPow,Mo';
  const hydroLayers = 'row,kan,kanOkr,rz,rzOk,WPow,Mo';

  // Run land-use point check (±25 m) and hydrography buffer checks (±250 m and ±500 m) in parallel
  const [landCodes, hydroCloseCodes, hydroFarCodes] = await Promise.all([
    queryBdotXmlCodes(northing, easting, landLayers, 25, 101),
    queryBdotXmlCodes(northing, easting, hydroLayers, 250, 3),
    queryBdotXmlCodes(northing, easting, hydroLayers, 500, 3)
  ]);

  let landUse: LandUseType = 'arable';
  let landUseStatus: FieldStatus = 'ok';
  let bdotConfirmedArable = false;

  if (landCodes !== null) {
    const isArable = landCodes.some((c) => c.startsWith('PTTR'));
    const isForest = landCodes.some((c) => c.startsWith('PTLZ'));
    const isBuilt = landCodes.some((c) => c.startsWith('PTZB') || c.startsWith('BUBD'));
    const isWater = landCodes.some((c) => c.startsWith('PTWP'));
    bdotConfirmedArable = isArable;

    if (isForest && !isArable) {
      landUse = 'forest';
    } else if (isBuilt && !isArable) {
      landUse = 'urban';
    } else if (isWater && !isArable) {
      landUse = 'water';
    } else if (iungNonArableHint && !isArable) {
      landUse = 'urban';
    } else {
      landUse = 'arable';
    }
  } else if (iungNonArableHint) {
    landUse = 'urban';
    landUseStatus = 'ok';
  } else {
    landUse = 'arable';
    landUseStatus = 'szacunek';
  }

  const hasDrainageChannel = (codes: string[] | null) =>
    Boolean(
      codes &&
        codes.some((c) => c.startsWith('SWRM') || c.startsWith('SWKN') || c.startsWith('SWRS'))
    );

  let ditchDistanceM = 9999;
  let ditchStatus: FieldStatus = 'brak';
  let ditchDetails: string | null = null;

  if (hasDrainageChannel(hydroCloseCodes)) {
    ditchDistanceM = 200;
    ditchStatus = 'ok';
    const found = describeHydroCodes(hydroCloseCodes!);
    ditchDetails = `W promieniu ok. 200–250 m wykryto: ${found.join(', ')} (dane BDOT10k).`;
  } else if (hasDrainageChannel(hydroFarCodes)) {
    ditchDistanceM = 450;
    ditchStatus = 'ok';
    const found = describeHydroCodes(hydroFarCodes!);
    ditchDetails = `W promieniu ok. 450–500 m wykryto: ${found.join(', ')} (dane BDOT10k).`;
  } else if (hydroCloseCodes !== null || hydroFarCodes !== null) {
    ditchDistanceM = 9999;
    ditchStatus = 'ok';
    const nearbyWater = describeHydroCodes([
      ...(hydroCloseCodes ?? []),
      ...(hydroFarCodes ?? [])
    ]);
    ditchDetails =
      nearbyWater.length > 0
        ? `Brak rowów odwadniających w promieniu 500 m; w otoczeniu wykryto: ${nearbyWater.join(', ')} (BDOT10k).`
        : 'Brak zinwentaryzowanych rowów melioracyjnych ani cieków w promieniu 500 m (BDOT10k).';
  }

  return {
    landUse,
    landUseStatus,
    bdotConfirmedArable,
    ditchDistanceM,
    ditchStatus,
    ditchDetails,
    durationMs: Date.now() - started
  };
}

// --- Step D: Weather (Open-Meteo 1991 -> analysisDate + forecast tail if near today) ---
interface MeteoFetchResult {
  records: DailyMeteoRecord[];
  latestDate: string;
  usedForecastSupplement: boolean;
  status: FieldStatus;
  failureReason: string | null;
  durationMs: number;
}

// Open-Meteo liczy 1 wywołanie za każde 2 tygodnie danych, więc archiwum 1991→dziś to ~940
// wywołań z dziennego limitu 10 000. Dlatego archiwum pobieramy raz na komórkę siatki
// (0,1° ≈ rozdzielczość ERA5-Land) i trzymamy w pamięci oraz na dysku; data analizy
// tylko przycina dane. Z kluczem OPEN_METEO_API_KEY używamy płatnego endpointu bez limitu.
interface ArchiveDaily {
  time: string[];
  precipitation_sum?: (number | null)[];
  et0_fao_evapotranspiration?: (number | null)[];
  temperature_2m_mean?: (number | null)[];
  soil_moisture_0_to_7cm_mean?: (number | null)[];
  soil_moisture_7_to_28cm_mean?: (number | null)[];
}

interface ArchiveCell {
  fetchedOn: string;
  endDate: string;
  daily: ArchiveDaily;
}

const OPEN_METEO_API_KEY = process.env.OPEN_METEO_API_KEY?.trim() ?? '';
const METEO_CACHE_DIR =
  process.env.METEO_CACHE_DIR ??
  (process.env.VERCEL
    ? path.join(os.tmpdir(), 'wodapol-meteo')
    : path.resolve(process.cwd(), '.cache', 'meteo'));

const archiveCellMemory = new Map<string, ArchiveCell>();
const archiveCellInflight = new Map<string, Promise<ArchiveCell | { error: string }>>();

function openMeteoUrl(kind: 'archive' | 'forecast', query: string): string {
  const host = kind === 'archive' ? 'archive-api.open-meteo.com' : 'api.open-meteo.com';
  if (OPEN_METEO_API_KEY) {
    return `https://customer-${host}/v1/${kind}?${query}&apikey=${encodeURIComponent(OPEN_METEO_API_KEY)}`;
  }
  return `https://${host}/v1/${kind}?${query}`;
}

function archiveCellPath(cellKey: string): string {
  return path.join(METEO_CACHE_DIR, `${cellKey}.json`);
}

async function readArchiveCellFromDisk(cellKey: string): Promise<ArchiveCell | null> {
  try {
    const raw = await fs.readFile(archiveCellPath(cellKey), 'utf-8');
    const parsed = JSON.parse(raw) as ArchiveCell;
    return parsed?.daily?.time?.length ? parsed : null;
  } catch {
    return null;
  }
}

async function writeArchiveCellToDisk(cellKey: string, cell: ArchiveCell): Promise<void> {
  try {
    await fs.mkdir(METEO_CACHE_DIR, { recursive: true });
    await fs.writeFile(archiveCellPath(cellKey), JSON.stringify(cell));
  } catch {
    // Brak zapisu na dysk (np. system plików tylko do odczytu) — zostaje cache w pamięci
  }
}

async function downloadArchiveCell(
  cellLat: number,
  cellLon: number,
  endDate: string,
  today: string
): Promise<ArchiveCell | { error: string }> {
  const query = `latitude=${cellLat.toFixed(1)}&longitude=${cellLon.toFixed(1)}&start_date=1991-01-01&end_date=${endDate}&daily=precipitation_sum,temperature_2m_mean,et0_fao_evapotranspiration,soil_moisture_0_to_7cm_mean,soil_moisture_7_to_28cm_mean&timezone=Europe%2FWarsaw`;
  try {
    const res = await fetch(openMeteoUrl('archive', query), {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000)
    });
    if (res.status === 429) {
      return { error: 'wyczerpany dzienny limit zapytań Open-Meteo' };
    }
    if (!res.ok) {
      return { error: `Open-Meteo zwróciło błąd ${res.status}` };
    }
    const json = (await res.json()) as { daily?: ArchiveDaily };
    if (!json.daily?.time?.length) {
      return { error: 'Open-Meteo nie zwróciło danych dziennych' };
    }
    return { fetchedOn: today, endDate, daily: json.daily };
  } catch {
    return { error: 'Open-Meteo nie odpowiada' };
  }
}

async function getArchiveCell(
  lat: number,
  lon: number,
  neededEnd: string,
  today: string
): Promise<{ cell: ArchiveCell | null; error: string | null }> {
  const cellLat = Math.round(lat * 10) / 10;
  const cellLon = Math.round(lon * 10) / 10;
  const cellKey = `${cellLat.toFixed(1)}_${cellLon.toFixed(1)}`;

  // Dane historyczne się nie zmieniają: komórka jest dobra, jeśli sięga potrzebnej daty
  // albo została pobrana dzisiaj (archiwum i tak ma ~5 dni opóźnienia).
  const isFresh = (c: ArchiveCell) => c.endDate >= neededEnd || c.fetchedOn === today;

  let cell = archiveCellMemory.get(cellKey) ?? null;
  if (!cell) {
    cell = await readArchiveCellFromDisk(cellKey);
    if (!cell) cell = (METEO_SEED_CELLS[cellKey] as ArchiveCell | undefined) ?? null;
    if (cell) archiveCellMemory.set(cellKey, cell);
  }
  if (cell && isFresh(cell)) return { cell, error: null };

  let pending = archiveCellInflight.get(cellKey);
  if (!pending) {
    pending = downloadArchiveCell(cellLat, cellLon, addDaysIso(today, -5), today);
    archiveCellInflight.set(cellKey, pending);
    pending.finally(() => archiveCellInflight.delete(cellKey));
  }
  const downloaded = await pending;

  if ('error' in downloaded) {
    // Starsza kopia jest lepsza niż nic — brakujące ostatnie dni uzupełni prognoza
    return { cell, error: cell ? null : downloaded.error };
  }

  archiveCellMemory.set(cellKey, downloaded);
  await writeArchiveCellToDisk(cellKey, downloaded);
  return { cell: downloaded, error: null };
}

async function fetchOpenMeteoHistory(
  lat: number,
  lon: number,
  analysisDate: string
): Promise<MeteoFetchResult> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}:${analysisDate}`;
  const cached = getCached(meteoCache, cacheKey);
  if (cached) return cached;

  const started = Date.now();
  const today = getTodayPolandIso();
  const daysFromToday = diffDaysIso(today, analysisDate);

  // Archive lags ~5 days behind today; we need data up to min(analysisDate, today-5d)
  const archiveNeededEnd = daysFromToday <= 6 ? addDaysIso(today, -5) : analysisDate;

  const needForecastTail = daysFromToday <= 6;
  const forecastUrl = openMeteoUrl(
    'forecast',
    `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&past_days=7&forecast_days=1&daily=precipitation_sum,temperature_2m_mean,et0_fao_evapotranspiration&timezone=Europe%2FWarsaw`
  );

  const [archRes, fcRes] = await Promise.allSettled([
    getArchiveCell(lat, lon, archiveNeededEnd, today),
    needForecastTail
      ? fetch(forecastUrl, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(6000)
        }).then((r) => (r.ok ? r.json() : null))
      : Promise.resolve(null)
  ]);

  const byDate = new Map<string, DailyMeteoRecord>();
  const archiveError =
    archRes.status === 'fulfilled' ? archRes.value.error : 'Open-Meteo nie odpowiada';

  if (archRes.status === 'fulfilled' && archRes.value.cell) {
    const d = archRes.value.cell.daily;
    for (let i = 0; i < d.time.length; i++) {
      const dt = d.time[i];
      if (dt > analysisDate) continue;
      const p = d.precipitation_sum?.[i];
      const e = d.et0_fao_evapotranspiration?.[i];
      if (typeof p !== 'number' || typeof e !== 'number') continue;
      const sm0 = d.soil_moisture_0_to_7cm_mean?.[i];
      const sm7 = d.soil_moisture_7_to_28cm_mean?.[i];
      let sm: number | null = null;
      if (typeof sm0 === 'number' && typeof sm7 === 'number') {
        sm = sm0 * 0.3 + sm7 * 0.7;
      } else if (typeof sm7 === 'number') {
        sm = sm7;
      } else if (typeof sm0 === 'number') {
        sm = sm0;
      }
      byDate.set(dt, {
        date: dt,
        precipMm: p,
        et0Mm: e,
        tempMeanC: typeof d.temperature_2m_mean?.[i] === 'number' ? d.temperature_2m_mean[i]! : null,
        soilMoistureTop: sm
      });
    }
  }

  let usedForecastSupplement = false;
  if (fcRes.status === 'fulfilled' && fcRes.value?.daily?.time) {
    const d = fcRes.value.daily as {
      time: string[];
      precipitation_sum?: (number | null)[];
      et0_fao_evapotranspiration?: (number | null)[];
      temperature_2m_mean?: (number | null)[];
    };
    for (let i = 0; i < d.time.length; i++) {
      const dt = d.time[i];
      if (dt > analysisDate || byDate.has(dt)) continue;
      const p = d.precipitation_sum?.[i];
      const e = d.et0_fao_evapotranspiration?.[i];
      if (typeof p !== 'number' || typeof e !== 'number') continue;
      byDate.set(dt, {
        date: dt,
        precipMm: p,
        et0Mm: e,
        tempMeanC: typeof d.temperature_2m_mean?.[i] === 'number' ? d.temperature_2m_mean[i]! : null,
        soilMoistureTop: null
      });
      usedForecastSupplement = true;
    }
  }

  const records = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = records[records.length - 1]?.date ?? analysisDate;
  const result: MeteoFetchResult = {
    records,
    latestDate,
    usedForecastSupplement,
    status: records.length >= 60 ? 'ok' : 'brak',
    failureReason:
      records.length >= 60 ? null : (archiveError ?? 'za mało dni z danymi pogodowymi'),
    durationMs: Date.now() - started
  };

  if (records.length >= 60) {
    setCached(meteoCache, cacheKey, result, 15 * 60 * 1000);
  }
  return result;
}

// --- Step E: Sentinel-2 L2A COG (Earth Search STAC + GeoTIFF HTTP Range) ---
interface StacFeature {
  id: string;
  properties: {
    datetime: string;
    'eo:cloud_cover'?: number;
    'proj:epsg'?: number;
  };
  assets?: Record<string, { href?: string }>;
}

interface S2FetchResult {
  ndvi: number | null;
  ndmi: number | null;
  ndviAnomaly: number | null;
  ndviMedianRef: number | null;
  satelliteAgeDays: number | null;
  latestSceneDate: string | null;
  latestSceneId: string | null;
  clearPixelPct: number | null;
  seasonSeries: NdviSeasonPoint[];
  status: FieldStatus;
  failureReason: string | null;
  anomalyStatus: FieldStatus;
  durationMs: number;
}

async function readCogWindowMean(
  href: string,
  utmBbox: [number, number, number, number],
  signal?: AbortSignal
): Promise<Float32Array | Uint16Array | Uint8Array | null> {
  try {
    const tiff = await fromUrl(href, {
      allowFullFile: false
    });
    const image = await tiff.getImage();
    const [originX, originY] = image.getOrigin();
    const [resX, resY] = image.getResolution(); // resY is negative in north-up GeoTIFF
    const width = image.getWidth();
    const height = image.getHeight();

    const [minX, minY, maxX, maxY] = utmBbox;
    let colMin = Math.floor((minX - originX) / resX);
    let colMax = Math.ceil((maxX - originX) / resX);
    let rowMin = Math.floor((maxY - originY) / resY);
    let rowMax = Math.ceil((minY - originY) / resY);

    // Reject if parcel bbox falls outside this Sentinel-2 tile
    if (colMax <= 0 || colMin >= width || rowMax <= 0 || rowMin >= height) {
      return null;
    }

    colMin = Math.max(0, Math.min(colMin, width - 1));
    colMax = Math.max(colMin + 1, Math.min(colMax, width));
    rowMin = Math.max(0, Math.min(rowMin, height - 1));
    rowMax = Math.max(rowMin + 1, Math.min(rowMax, height));

    // Cap window to 16x16 pixels (~160x160 m) so HTTP range read stays ultra-fast
    if (colMax - colMin > 16) {
      const mid = Math.floor((colMin + colMax) / 2);
      colMin = Math.max(0, mid - 8);
      colMax = Math.min(width, mid + 8);
    }
    if (rowMax - rowMin > 16) {
      const mid = Math.floor((rowMin + rowMax) / 2);
      rowMin = Math.max(0, mid - 8);
      rowMax = Math.min(height, mid + 8);
    }

    const rasters = await image.readRasters({
      window: [colMin, rowMin, colMax, rowMax],
      samples: [0],
      signal
    });
    const band = rasters[0];
    if (
      band instanceof Float32Array ||
      band instanceof Uint16Array ||
      band instanceof Uint8Array
    ) {
      return band;
    }
    return null;
  } catch {
    return null;
  }
}

async function evaluateSentinelScene(
  feature: StacFeature,
  parcelBboxWgs84: [number, number, number, number],
  centroid: [number, number],
  timeoutMs: number
): Promise<NdviSeasonPoint | null> {
  const epsg = feature.properties['proj:epsg'] ?? 32634;
  const utmDef = UTM_DEFS[epsg] ?? UTM_DEFS[32634];
  const redHref = feature.assets?.red?.href;
  const nirHref = feature.assets?.nir?.href;
  const swirHref = feature.assets?.swir16?.href;
  const sclHref = feature.assets?.scl?.href;

  if (!redHref || !nirHref || !sclHref) return null;

  const [minLon, minLat, maxLon, maxLat] = parcelBboxWgs84;
  const [cLat, cLon] = centroid;
  // Ensure at least ~60 m span around centroid for tiny parcels
  const padLat = Math.max(0.0003, (maxLat - minLat) * 0.1);
  const padLon = Math.max(0.0004, (maxLon - minLon) * 0.1);
  const pMin = proj4('EPSG:4326', utmDef, [
    Math.min(minLon, cLon - padLon),
    Math.min(minLat, cLat - padLat)
  ]);
  const pMax = proj4('EPSG:4326', utmDef, [
    Math.max(maxLon, cLon + padLon),
    Math.max(maxLat, cLat + padLat)
  ]);
  const utmBbox: [number, number, number, number] = [
    Math.min(pMin[0], pMax[0]),
    Math.min(pMin[1], pMax[1]),
    Math.max(pMin[0], pMax[0]),
    Math.max(pMin[1], pMax[1])
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // All four COGs in parallel: each read costs ~2–5 s of HTTP range requests, so reading SCL
    // first and the bands afterwards (~7–8 s) did not fit the per-scene timeout.
    const [scl, red, nir, swir] = await Promise.all([
      readCogWindowMean(sclHref, utmBbox, controller.signal),
      readCogWindowMean(redHref, utmBbox, controller.signal),
      readCogWindowMean(nirHref, utmBbox, controller.signal),
      swirHref ? readCogWindowMean(swirHref, utmBbox, controller.signal) : Promise.resolve(null)
    ]);
    if (!scl || scl.length === 0) return null;

    let clearCount = 0;
    for (let i = 0; i < scl.length; i++) {
      // SCL classes: 4 = vegetation, 5 = bare soils, 6 = water (4 & 5 are clear land)
      if (scl[i] === 4 || scl[i] === 5) clearCount++;
    }
    const clearPixelPct = Math.round((clearCount / scl.length) * 100);
    if (clearPixelPct < 70) return null;

    if (!red || !nir || red.length === 0 || nir.length === 0) return null;

    // Sentinel-2 L2A PB>=04.00 (since 2022-01-25) adds BOA_ADD_OFFSET +1000 to DN values
    const sceneDateStr = feature.properties.datetime.slice(0, 10);
    const hasBoaOffset = sceneDateStr >= '2022-01-25';
    const toRefl = (dn: number) =>
      hasBoaOffset && dn > 1000 ? (dn - 1000) / 10000 : dn / 10000;

    const len = Math.min(red.length, nir.length);
    const ndviVals: number[] = [];
    for (let i = 0; i < len; i++) {
      const rVal = red[i];
      const nVal = nir[i];
      if (rVal === 0 && nVal === 0) continue;
      const r = Math.max(0.001, toRefl(rVal));
      const n = Math.max(0.001, toRefl(nVal));
      const val = (n - r) / (n + r);
      if (Number.isFinite(val) && val >= -1 && val <= 1) ndviVals.push(val);
    }

    const medNdvi = median(ndviVals);
    if (medNdvi === null) return null;

    let medNdmi: number | null = null;
    if (swir && swir.length > 0) {
      // Compare median NIR with median SWIR16 (resolutions differ: 10m vs 20m)
      const nirClean: number[] = [];
      for (let i = 0; i < nir.length; i++) {
        if (nir[i] > 0) nirClean.push(Math.max(0.001, toRefl(nir[i])));
      }
      const swirClean: number[] = [];
      for (let i = 0; i < swir.length; i++) {
        if (swir[i] > 0) swirClean.push(Math.max(0.001, toRefl(swir[i])));
      }
      const mNir = median(nirClean);
      const mSwir = median(swirClean);
      if (mNir !== null && mSwir !== null && mNir + mSwir > 0) {
        medNdmi = Number(((mNir - mSwir) / (mNir + mSwir)).toFixed(2));
      }
    }

    return {
      date: feature.properties.datetime.slice(0, 10),
      ndvi: Number(medNdvi.toFixed(2)),
      ndmi: medNdmi,
      cloudCoverPct: Number((feature.properties['eo:cloud_cover'] ?? 0).toFixed(1)),
      clearPixelPct
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchStacWindow(
  bbox: [number, number, number, number],
  startDate: string,
  endDate: string,
  maxClouds: number,
  limit: number,
  timeoutMs: number
): Promise<StacFeature[]> {
  try {
    const res = await fetch('https://earth-search.aws.element84.com/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({
        collections: ['sentinel-2-l2a'],
        bbox,
        datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
        query: { 'eo:cloud_cover': { lt: maxClouds } },
        sortby: [{ field: 'properties.datetime', direction: 'desc' }],
        limit
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: StacFeature[] };
    return data.features ?? [];
  } catch {
    return [];
  }
}

async function fetchSentinel2Data(
  parcel: ParcelGeometryInfo,
  analysisDate: string
): Promise<S2FetchResult> {
  const cacheKey = `${parcel.id}:${analysisDate}`;
  const cached = getCached(s2Cache, cacheKey);
  if (cached) return cached;

  const started = Date.now();
  // The other sources finish in ~3 s, so Sentinel-2 may use most of the 30 s KOWR limit;
  // on slow (mobile) links a single scene needs 10+ s of HTTP range reads.
  const HARD_BUDGET_MS = 20000;
  const [lat, lon] = parcel.centroid;
  const searchBbox: [number, number, number, number] = [
    Number((lon - 0.005).toFixed(5)),
    Number((lat - 0.005).toFixed(5)),
    Number((lon + 0.005).toFixed(5)),
    Number((lat + 0.005).toFixed(5))
  ];

  // Search last 95 days strictly <= analysisDate
  const start95 = addDaysIso(analysisDate, -95);
  const features = await searchStacWindow(searchBbox, start95, analysisDate, 60, 14, 4500);

  // Deduplicate by calendar date (keep lowest cloud cover per date)
  const uniqueByDate = new Map<string, StacFeature>();
  for (const f of features) {
    const d = f.properties?.datetime?.slice(0, 10);
    if (!d || d > analysisDate) continue;
    const prev = uniqueByDate.get(d);
    if (
      !prev ||
      (f.properties['eo:cloud_cover'] ?? 100) < (prev.properties['eo:cloud_cover'] ?? 100)
    ) {
      uniqueByDate.set(d, f);
    }
  }

  const sortedDesc = Array.from(uniqueByDate.values()).sort((a, b) =>
    b.properties.datetime.localeCompare(a.properties.datetime)
  );

  // Candidates within 30 days: the 2 latest scenes plus the newest nearly cloud-free one
  // (scene-level cloud cover says little about the parcel, so the newest scenes are often
  // cloudy right over it) + up to 2 earlier in season for the chart
  const withinMonth = sortedDesc.filter(
    (f) => diffDaysIso(analysisDate, f.properties.datetime.slice(0, 10)) <= 30
  );
  const clearest =
    withinMonth.find((f) => (f.properties['eo:cloud_cover'] ?? 100) < 15) ??
    [...withinMonth].sort(
      (a, b) => (a.properties['eo:cloud_cover'] ?? 100) - (b.properties['eo:cloud_cover'] ?? 100)
    )[0];
  const recentCandidates = withinMonth.slice(0, 2);
  if (clearest && !recentCandidates.includes(clearest)) {
    recentCandidates.push(clearest);
  }
  const olderCandidates = sortedDesc
    .filter((f) => diffDaysIso(analysisDate, f.properties.datetime.slice(0, 10)) > 30)
    .slice(0, 2);

  let latestValid: { pt: NdviSeasonPoint; id: string } | null = null;
  const seasonPoints: NdviSeasonPoint[] = [];

  // Step 1: Evaluate the recent scenes in parallel and keep the newest valid (>=70% clear) one
  const recentResults = await Promise.all(
    recentCandidates.map((feat) =>
      evaluateSentinelScene(
        feat,
        parcel.bbox,
        parcel.centroid,
        Math.max(HARD_BUDGET_MS - (Date.now() - started) - 1000, 3000)
      )
    )
  );
  for (let idx = 0; idx < recentResults.length; idx++) {
    const pt = recentResults[idx];
    if (!pt) continue;
    seasonPoints.push(pt);
    if (!latestValid) {
      latestValid = { pt, id: recentCandidates[idx].id };
    }
  }
  // Scenes existed but the COG reads ran out of the time budget — not the same as "only clouds"
  const recentTimedOut =
    !latestValid &&
    recentCandidates.length > 0 &&
    Date.now() - started >= HARD_BUDGET_MS - 1500;

  // Step 2: Evaluate older seasonal scenes in parallel if time budget permits
  const remainingForSeason = HARD_BUDGET_MS - (Date.now() - started);
  if (olderCandidates.length > 0 && remainingForSeason > 4000) {
    const olderResults = await Promise.all(
      olderCandidates.map((f) =>
        evaluateSentinelScene(f, parcel.bbox, parcel.centroid, Math.min(5000, remainingForSeason - 800))
      )
    );
    for (const pt of olderResults) {
      if (pt) seasonPoints.push(pt);
    }
  }

  // Step 3: Optional multi-year NDVI anomaly (same ±14-day window in previous 3 years) if time permits
  let ndviAnomaly: number | null = null;
  let ndviMedianRef: number | null = null;
  let anomalyStatus: FieldStatus = 'brak';

  const remainingForAnomaly = HARD_BUDGET_MS - (Date.now() - started);
  if (latestValid && remainingForAnomaly > 4000) {
    const year = Number(analysisDate.slice(0, 4));
    const histYears = [year - 1, year - 2, year - 3].filter((y) => y >= 2017);
    const histSearches = await Promise.all(
      histYears.map((y) => {
        const anchor = `${y}${analysisDate.slice(4)}`;
        return searchStacWindow(
          searchBbox,
          addDaysIso(anchor, -14),
          addDaysIso(anchor, 14),
          35,
          2,
          2200
        );
      })
    );

    const histCandidates = histSearches
      .map((list) => list[0])
      .filter((f): f is StacFeature => Boolean(f));

    if (histCandidates.length >= 2 && HARD_BUDGET_MS - (Date.now() - started) > 2500) {
      const histPts = await Promise.all(
        histCandidates.map((f) => evaluateSentinelScene(f, parcel.bbox, parcel.centroid, 2400))
      );
      const validNdvis = histPts
        .filter((p): p is NdviSeasonPoint => p !== null)
        .map((p) => p.ndvi);

      if (validNdvis.length >= 2) {
        const med = median(validNdvis);
        if (med !== null) {
          ndviMedianRef = Number(med.toFixed(2));
          const mean = validNdvis.reduce((a, b) => a + b, 0) / validNdvis.length;
          const variance =
            validNdvis.reduce((a, b) => a + (b - mean) ** 2, 0) / validNdvis.length;
          const sd = Math.max(Math.sqrt(variance), 0.08);
          ndviAnomaly = Number(
            Math.min(Math.max((latestValid.pt.ndvi - med) / sd, -3.5), 3.5).toFixed(2)
          );
          anomalyStatus = validNdvis.length >= 3 ? 'ok' : 'szacunek';
        }
      }
    }
  }

  seasonPoints.sort((a, b) => a.date.localeCompare(b.date));

  const satelliteAgeDays = latestValid
    ? Math.max(0, diffDaysIso(analysisDate, latestValid.pt.date))
    : null;

  const result: S2FetchResult = {
    ndvi: latestValid?.pt.ndvi ?? null,
    ndmi: latestValid?.pt.ndmi ?? null,
    ndviAnomaly,
    ndviMedianRef,
    satelliteAgeDays,
    latestSceneDate: latestValid?.pt.date ?? null,
    latestSceneId: latestValid?.id ?? null,
    clearPixelPct: latestValid?.pt.clearPixelPct ?? null,
    seasonSeries: seasonPoints,
    status: latestValid ? 'ok' : 'brak',
    failureReason: latestValid
      ? null
      : recentTimedOut
        ? 'zdjęcia Sentinel-2 są dostępne, ale nie udało się ich pobrać w limicie czasu (wolne łącze lub przeciążony serwer)'
        : features.length === 0
          ? 'katalog Sentinel-2 nie zwrócił scen dla tej daty (lub nie odpowiedział)'
          : // evaluateSentinelScene returns null both for clouds and for failed COG reads
            'nie udało się odczytać bezchmurnej sceny nad działką z ostatnich 30 dni (zachmurzenie albo błąd pobierania plików satelitarnych)',
    anomalyStatus,
    durationMs: Date.now() - started
  };

  // A timeout is transient — do not cache it, so the next request can try again
  if (!recentTimedOut) {
    setCached(s2Cache, cacheKey, result, 15 * 60 * 1000);
  }
  return result;
}

// --- Step F: IMGW Synop (ONLY when analysisDate === today) ---
async function fetchImgwToday(
  lat: number,
  lon: number
): Promise<AnalyzeApiResponse['imgwCurrentObs']> {
  // Find nearest station slug
  let bestSlug = 'torun';
  let bestDist = Infinity;
  for (const [slug, [sLat, sLon]] of Object.entries(IMGW_STATION_COORDS)) {
    const d = (sLat - lat) ** 2 + (sLon - lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestSlug = slug;
    }
  }

  try {
    const res = await fetch(`https://danepubliczne.imgw.pl/api/data/synop/station/${bestSlug}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      stacja?: string;
      data_pomiaru?: string;
      godzina_pomiaru?: string;
      temperatura?: string;
      suma_opadu?: string;
      wilgotnosc_wzgledna?: string;
    };
    if (!d.stacja) return null;
    return {
      available: true,
      station: d.stacja,
      measuredAt: `${d.data_pomiaru ?? ''} ${d.godzina_pomiaru ?? ''}:00`.trim(),
      tempC: d.temperatura ?? '—',
      rainMm: d.suma_opadu ?? '0.0',
      humidityPct: d.wilgotnosc_wzgledna ?? '—'
    };
  } catch {
    return null;
  }
}

interface StaticParcelBundle {
  terrain: TerrainFetchResult;
  soilAndProtected: SoilAndProtectedResult;
  hydroAndLandUse: HydroAndLandUseResult;
}

export interface RunAnalysisParams {
  id?: string | null;
  lat?: number;
  lon?: number;
  cropId: string;
  date: string;
  onStepUpdate?: (step: LoadingStepState) => void;
}

export async function runFullParcelAnalysis(
  params: RunAnalysisParams
): Promise<AnalyzeApiResponse> {
  const totalStart = Date.now();
  const analysisDate = sanitizeAnalysisDate(params.date);
  const cropId = sanitizeCropId(params.cropId);
  const crop = CROPS_DATA.find((c) => c.id === cropId) ?? CROPS_DATA[0];
  const todayIso = getTodayPolandIso();
  const isToday = analysisDate === todayIso;
  const generatedAt = new Date().toISOString();

  const emit = (
    key: LoadingStepKey,
    label: string,
    sourceHint: string,
    status: LoadingStepState['status'],
    detail?: string,
    durationMs?: number
  ) => {
    params.onStepUpdate?.({ key, label, sourceHint, status, detail, durationMs });
  };

  // Step 1: Parcel lookup via ULDK (required before parallel fetches)
  emit('parcel_terrain', 'Działka i teren', 'ULDK, NMT 1 m', 'running');
  const uldkStart = Date.now();
  const parcel = await lookupParcel({ id: params.id, lat: params.lat, lon: params.lon });
  const uldkMs = Date.now() - uldkStart;

  const [lat, lon] = parcel.centroid;
  const cachedStatic =
    getCached(staticParcelCache, parcel.id) ??
    (await diskCacheGet<StaticParcelBundle>('static', parcel.id));

  // Mark all parallel branches as running
  emit('meteo', 'Pogoda z 10 lat', 'Open-Meteo ERA5', 'running');
  emit('satellite', 'Zdjęcia satelitarne', 'Sentinel-2 L2A', 'running');
  emit('soil_protected', 'Gleba i obszary chronione', 'IUNG / GDOŚ', 'running');
  emit('hydro', 'Wody i użytkowanie', 'BDOT10k', 'running');

  // Parallel execution of all independent data sources
  const terrainPromise = cachedStatic
    ? Promise.resolve(cachedStatic.terrain)
    : fetchTerrainFromNmt(parcel.centroid);

  const soilProtectedPromise = cachedStatic
    ? Promise.resolve(cachedStatic.soilAndProtected)
    : fetchSoilAndProtected(lat, lon);

  const hydroRawPromise = cachedStatic
    ? Promise.resolve(cachedStatic.hydroAndLandUse)
    : fetchHydroAndLandUse(lat, lon, false);

  const meteoPromise = fetchOpenMeteoHistory(lat, lon, analysisDate);
  const s2Promise = fetchSentinel2Data(parcel, analysisDate);
  const imgwPromise = isToday ? fetchImgwToday(lat, lon) : Promise.resolve(null);

  // Wire live progress emissions as each promise resolves
  terrainPromise.then((t) => {
    emit(
      'parcel_terrain',
      'Działka i teren',
      'ULDK, NMT 1 m',
      t.status === 'ok' ? 'ok' : 'fallback',
      t.status === 'ok'
        ? `Spadek ${t.slopePct.toFixed(1)}%, wys. ${t.centerElevM} m n.p.m.`
        : 'Obrys pobrany, brak odczytu NMT',
      uldkMs + t.durationMs
    );
  });

  meteoPromise.then((m) => {
    emit(
      'meteo',
      'Pogoda z 10 lat',
      'Open-Meteo ERA5',
      m.status === 'ok' ? 'ok' : 'fallback',
      m.status === 'ok'
        ? `${m.records.length} dni danych do ${m.latestDate}`
        : `Brak danych pogodowych (${m.failureReason ?? 'nieznany błąd'})`,
      m.durationMs
    );
  });

  s2Promise.then((s) => {
    emit(
      'satellite',
      'Zdjęcia satelitarne',
      'Sentinel-2 L2A',
      s.status === 'ok' ? 'ok' : 'fallback',
      s.status === 'ok' && s.ndvi !== null
        ? `NDVI ${s.ndvi.toFixed(2)} (${s.latestSceneDate})`
        : 'Brak bezchmurnej sceny (chmury >30%)',
      s.durationMs
    );
  });

  soilProtectedPromise.then((sp) => {
    emit(
      'soil_protected',
      'Gleba i obszary chronione',
      'IUNG / GDOŚ',
      sp.soilStatus === 'ok' ? 'ok' : 'fallback',
      `${SOIL_WATER_GROUPS.find((g) => g.id === sp.soilId)?.grupa_uziarnienia ?? 'Glina lekka'}${sp.isNatura2000 ? ' · Natura 2000' : ''}`,
      sp.durationMs
    );
  });

  hydroRawPromise.then((h) => {
    emit(
      'hydro',
      'Wody i użytkowanie',
      'BDOT10k',
      h.ditchStatus === 'ok' ? 'ok' : 'fallback',
      h.ditchDistanceM <= 500
        ? `Wykryto rów/ciek w promieniu ok. ${h.ditchDistanceM} m`
        : h.landUse === 'arable'
          ? 'Grunt orny, brak rowu w promieniu 500 m'
          : 'Obszar poza gruntami ornymi',
      h.durationMs
    );
  });

  const [terrain, soilProtected, hydroRaw, meteo, s2, imgwCurrentObs] = await Promise.all([
    terrainPromise,
    soilProtectedPromise,
    hydroRawPromise,
    meteoPromise,
    s2Promise,
    imgwPromise
  ]);

  // Reconcile IUNG non-arable hint if BDOT10k did not confirm arable land directly
  const hydroAndLandUse: HydroAndLandUseResult =
    !cachedStatic &&
    soilProtected.iungNonArable &&
    hydroRaw.landUse === 'arable' &&
    !hydroRaw.bdotConfirmedArable
      ? { ...hydroRaw, landUse: 'urban', landUseStatus: 'ok' }
      : hydroRaw;

  if (!cachedStatic) {
    const bundle: StaticParcelBundle = { terrain, soilAndProtected: soilProtected, hydroAndLandUse };
    setCached(staticParcelCache, parcel.id, bundle, 30 * 60 * 1000);
    // On disk only complete reads — a failed NMT/soil request should be retried next time
    if (terrain.status === 'ok' && soilProtected.soilStatus === 'ok') {
      await diskCachePut('static', parcel.id, bundle);
    }
  }

  const soil =
    SOIL_WATER_GROUPS.find((s) => s.id === soilProtected.soilId) ?? SOIL_WATER_GROUPS[2];

  // Compute all hydrological indicators strictly <= analysisDate
  const meteoStats =
    meteo.status === 'ok'
      ? analyzeMeteoHistory(meteo.records, crop, soil, analysisDate)
      : {
          kbw60dMm: 0,
          rain60dMm: 0,
          et060dMm: 0,
          spi1: null,
          spi3: null,
          spiReferenceYears: 0,
          sma: null,
          smaAvailable: false,
          depletionFraction: 0,
          dryYearsLast10: 0,
          tenYearSummaryPl:
            'Brak wystarczających danych pogodowych z 10 lat do wyliczenia częstości susz.',
          medianDeltaMm: null,
          kbwCumulative: [],
          kbwCriticalWindowByYear: [],
          kbwDryThresholdMm: crop.prog_kbw_kat2_mm,
          kbwReferenceLabel: 'okno krytyczne uprawy',
          iungCategory: null,
          iungPeriodLabel: null,
          iungKbwMm: null,
          iungThresholdMm: null,
          iungDrought: null
        };

  // Determine soil cover: NDVI >= 0.3 on fresh satellite scene, else seasonal phenology estimate
  const s2Fresh = s2.ndvi !== null && s2.satelliteAgeDays !== null && s2.satelliteAgeDays <= 14;
  const mmdd = analysisDate.slice(5, 10);
  const seasonalCoverEstimate = mmdd >= '04-15' && mmdd <= '07-20';
  const hasSoilCover = s2Fresh ? (s2.ndvi as number) >= 0.3 : seasonalCoverEstimate;
  const soilCoverStatus: FieldStatus = s2Fresh ? 'ok' : 'szacunek';

  const rawInput: ParcelDiagnosisInput = {
    parcelLabel: parcel.label,
    analysisDate,
    cropId: crop.id,
    soilId: soil.id,
    landUse: hydroAndLandUse.landUse,
    isNatura2000: soilProtected.isNatura2000,
    slopePct: terrain.slopePct,
    slopeAvailable: terrain.status === 'ok',
    hasSoilCover,
    soilCoverEstimated: !s2Fresh,
    hasDepression: terrain.hasDepression,
    ditchDistanceM: hydroAndLandUse.ditchDistanceM,
    kbwMm: meteoStats.kbw60dMm,
    spi1: meteoStats.spi1 ?? 0,
    spi3: meteoStats.spi3 ?? 0,
    sma: meteoStats.sma ?? 0,
    ndvi: s2.ndvi,
    ndmi: s2.ndmi,
    ndviAnomaly: s2.ndviAnomaly,
    satelliteAgeDays: s2.satelliteAgeDays,
    depletionFraction: meteoStats.depletionFraction,
    dryYearsLast10: meteoStats.dryYearsLast10,
    meteoAvailable: meteo.status === 'ok',
    iungDrought: meteoStats.iungDrought,
    iungKbwMm: meteoStats.iungKbwMm,
    iungThresholdMm: meteoStats.iungThresholdMm,
    iungPeriodLabel: meteoStats.iungPeriodLabel,
    iungCategory: meteoStats.iungCategory
  };

  const result = runWaterDiagnosis(rawInput);

  // Build provenance dictionary for every input
  const landUseLabel: Record<LandUseType, string> = {
    arable: 'Grunt orny / użytkowanie rolnicze',
    forest: 'Las / grunt leśny',
    urban: 'Zabudowa / grunt nierolniczy',
    water: 'Wody powierzchniowe'
  };

  const inputs: Record<string, ProvenanceField> = {
    kbwMm: {
      key: 'kbwMm',
      label: 'KBW (60 dni / 6 dekad)',
      value: meteoStats.kbw60dMm,
      displayValue:
        meteo.status === 'ok'
          ? `${meteoStats.kbw60dMm} mm`
          : `brak danych (${meteo.failureReason ?? 'nieznany błąd'})`,
      unit: 'mm',
      source: meteo.usedForecastSupplement
        ? 'Open-Meteo ERA5 + Forecast (ostatnie dni)'
        : 'Open-Meteo Archive (ERA5 / FAO ET0)',
      dataDate: meteo.latestDate,
      status: meteo.status
    },
    spi3: {
      key: 'spi3',
      label: 'SPI-3 (opad 90 dni vs 1991–2020)',
      value: meteoStats.spi3,
      displayValue: meteoStats.spi3 !== null ? meteoStats.spi3.toFixed(2) : 'brak danych',
      source: `Open-Meteo Archive (rozkład gamma, n=${meteoStats.spiReferenceYears} lat)`,
      dataDate: meteo.latestDate,
      status:
        meteoStats.spi3 === null
          ? 'brak'
          : meteoStats.spiReferenceYears >= 20
            ? 'ok'
            : 'szacunek'
    },
    spi1: {
      key: 'spi1',
      label: 'SPI-1 (opad 30 dni vs 1991–2020)',
      value: meteoStats.spi1,
      displayValue: meteoStats.spi1 !== null ? meteoStats.spi1.toFixed(2) : 'brak danych',
      source: 'Open-Meteo Archive (rozkład gamma)',
      dataDate: meteo.latestDate,
      status: meteoStats.spi1 === null ? 'brak' : 'ok'
    },
    sma: {
      key: 'sma',
      label: 'SMA (anomalia wilgotności gleby 0–28 cm)',
      value: meteoStats.sma,
      displayValue: meteoStats.sma !== null ? meteoStats.sma.toFixed(2) : 'brak danych',
      source: 'Open-Meteo ERA5-Land (warstwa 0–7 i 7–28 cm)',
      dataDate: meteo.latestDate,
      status: meteoStats.smaAvailable ? 'ok' : 'brak'
    },
    ndvi: {
      key: 'ndvi',
      label: 'NDVI (kondycja zieleni łanu)',
      value: s2.ndvi,
      displayValue:
        s2.ndvi !== null
          ? `${s2.ndvi.toFixed(2)} (czystość ${s2.clearPixelPct ?? 100}%)`
          : (s2.failureReason ?? 'brak bezchmurnej sceny'),
      source: 'Sentinel-2 L2A COG (Earth Search STAC)',
      dataDate: s2.latestSceneDate ?? 'brak',
      status: s2.status
    },
    ndmi: {
      key: 'ndmi',
      label: 'NDMI (uwodnienie tkanek roślin)',
      value: s2.ndmi,
      displayValue: s2.ndmi !== null ? s2.ndmi.toFixed(2) : 'brak danych',
      source: 'Sentinel-2 L2A COG (B08 / B11)',
      dataDate: s2.latestSceneDate ?? 'brak',
      status: s2.ndmi !== null ? 'ok' : 'brak'
    },
    ndviAnomaly: {
      key: 'ndviAnomaly',
      label: 'Anomalia NDVI (wieloletnia)',
      value: s2.ndviAnomaly,
      displayValue:
        s2.ndviAnomaly !== null
          ? `${s2.ndviAnomaly > 0 ? '+' : ''}${s2.ndviAnomaly.toFixed(2)} σ`
          : 'brak danych',
      source: 'Sentinel-2 L2A (porównanie tej samej dekady z lat poprzednich)',
      dataDate: s2.latestSceneDate ?? 'brak',
      status: s2.anomalyStatus
    },
    soilId: {
      key: 'soilId',
      label: 'Kategoria i retencja gleby (0–50 cm)',
      value: soil.id,
      displayValue: `${soil.grupa_uziarnienia} (${soil.woda_dostepna_50cm_mm} mm)`,
      source: soilProtected.soilSource,
      dataDate: '2024',
      status: soilProtected.soilStatus
    },
    slopePct: {
      key: 'slopePct',
      label: 'Spadek terenu (mediana)',
      value: terrain.slopePct,
      displayValue:
        terrain.status === 'ok'
          ? `${terrain.slopePct.toFixed(1)}% (${terrain.centerElevM} m n.p.m.)`
          : 'brak danych',
      unit: '%',
      source: `GUGiK NMT 1 m (siatka ${terrain.sampledCount} pkt, EPSG:2180)`,
      dataDate: 'NMT 1 m',
      status: terrain.status
    },
    downslope: {
      key: 'downslope',
      label: 'Kierunek spływu wody (wokół środka działki)',
      value: terrain.downslope?.directionPl ?? null,
      displayValue: !terrain.downslope
        ? 'brak danych'
        : terrain.downslope.directionPl
          ? `teren opada na ${terrain.downslope.directionPl} (ok. ${terrain.downslope.dropPct}% na pierwszych ~35–90 m)`
          : 'teren praktycznie płaski — brak wyraźnego kierunku spływu',
      source: 'GUGiK NMT 1 m (największy spadek wśród 8 punktów wokół środka działki)',
      dataDate: 'NMT 1 m',
      status: terrain.downslope ? 'ok' : 'brak'
    },
    hasSoilCover: {
      key: 'hasSoilCover',
      label: 'Okrywa roślinna gleby',
      value: hasSoilCover,
      displayValue: s2Fresh
        ? hasSoilCover
          ? 'Obecna (NDVI ≥ 0,30)'
          : 'Brak okrywy (gleba odkryta)'
        : `Nieznana — szacunek z kalendarza: ${hasSoilCover ? 'prawdopodobnie obecna' : 'prawdopodobnie odkryta'} (nie liczony do ryzyka)`,
      source: s2Fresh
        ? `Sentinel-2 L2A (${s2.latestSceneDate})`
        : 'Szacunek fenologiczny (brak świeżej sceny satelitarnej)',
      dataDate: s2.latestSceneDate ?? analysisDate,
      status: soilCoverStatus
    },
    ditchDistanceM: {
      key: 'ditchDistanceM',
      label: 'Odległość do rowu melioracyjnego',
      value: hydroAndLandUse.ditchDistanceM,
      displayValue:
        hydroAndLandUse.ditchDistanceM <= 500
          ? `≤ ${hydroAndLandUse.ditchDistanceM} m`
          : hydroAndLandUse.ditchStatus === 'ok'
            ? '> 500 m (brak w buforze)'
            : 'brak danych',
      source: 'GUGiK BDOT10k WMS (warstwa row)',
      dataDate: 'BDOT10k',
      status: hydroAndLandUse.ditchStatus
    },
    isNatura2000: {
      key: 'isNatura2000',
      label: 'Obszary Natura 2000',
      value: soilProtected.isNatura2000,
      displayValue: soilProtected.isNatura2000
        ? `TAK (${soilProtected.natura2000Sites.join(', ')})`
        : soilProtected.natura2000Status === 'ok'
          ? 'NIE (poza Natura 2000)'
          : 'brak weryfikacji GDOŚ',
      source: 'GDOŚ WMS (SOO / OSO Natura 2000)',
      dataDate: todayIso,
      status: soilProtected.natura2000Status
    },
    landUse: {
      key: 'landUse',
      label: 'Pokrycie terenu / użytek',
      value: hydroAndLandUse.landUse,
      displayValue: landUseLabel[hydroAndLandUse.landUse],
      source: 'IUNG katgl_landuse2024 + GUGiK BDOT10k (TLes, RZab)',
      dataDate: '2024',
      status: hydroAndLandUse.landUseStatus
    },
    depletionFraction: {
      key: 'depletionFraction',
      label: 'Wyczerpanie zapasu wody w strefie korzeni',
      value: meteoStats.depletionFraction,
      displayValue:
        meteo.status === 'ok'
          ? `${Math.round(meteoStats.depletionFraction * 100)}% (próg ${Math.round(crop.dopuszczalne_wyczerpanie_p * 100)}%)`
          : 'brak danych',
      source: 'Bilans dzienny FAO-56 / metoda Drupki od 1.03 (ze współczynnikiem stresu Ks)',
      dataDate: meteo.latestDate,
      status: meteo.status
    },
    iungDrought: {
      key: 'iungDrought',
      label: 'Susza rolnicza wg progów IUNG (Rozp. MRiRW 2019)',
      value: meteoStats.iungDrought,
      displayValue:
        meteoStats.iungDrought === null
          ? meteo.status !== 'ok'
            ? 'brak danych'
            : 'nie oceniono (poza okresem raportowania IUNG lub uprawa/gleba nieobjęta progami)'
          : `${meteoStats.iungDrought ? 'TAK' : 'NIE'} — KBW ${meteoStats.iungKbwMm} mm vs próg ${meteoStats.iungThresholdMm} mm (okres ${meteoStats.iungPeriodLabel}, gleba kat. ${meteoStats.iungCategory})`,
      source: 'Open-Meteo ERA5 (KBW) + progi IUNG-PIB SMSR',
      dataDate: meteo.latestDate,
      status: meteoStats.iungDrought === null ? 'brak' : 'ok'
    }
  };

  const sources: AnalysisSourceAttribution[] = [
    {
      name: 'ULDK GUGiK (Usługa Lokalizacji Działek Katastralnych)',
      category: 'Geometria działki',
      usedFor: `Identyfikator ${parcel.id}, obrys WKT, obręb i gmina`,
      dataDate: todayIso,
      fetchedAt: generatedAt,
      status: 'ok',
      license: 'Dane publiczne GUGiK (bez opłat i ograniczeń, Ustawa PGiK)'
    },
    {
      name: 'Open-Meteo Archive (ERA5 / ERA5-Land)',
      category: 'Pogoda i bilans wodny',
      usedFor: 'Opad, temperatura, ET0 FAO-56, wilgotność gleby 1991–X (KBW, SPI-1/3, SMA, 10 lat)',
      dataDate: meteo.latestDate,
      fetchedAt: generatedAt,
      status: meteo.status,
      license: 'CC BY 4.0 (Open-Meteo / Copernicus Climate Data Store ERA5)'
    },
    {
      name: 'Copernicus Sentinel-2 L2A (Earth Search STAC / AWS Open Data)',
      category: 'Teledetekcja satelitarna',
      usedFor: 'Pasma B04, B08, B11 i maska chmur SCL → NDVI, NDMI, okrywa gleby',
      dataDate: s2.latestSceneDate ?? (s2.failureReason ?? 'brak bezchmurnej sceny'),
      fetchedAt: generatedAt,
      status: s2.status,
      license: `Contains modified Copernicus Sentinel data${s2.latestSceneDate ? ` ${s2.latestSceneDate.slice(0, 4)}` : ''} (bezpłatne i otwarte)`
    },
    {
      name: 'GUGiK NMT 1 m (Numeryczny Model Terenu)',
      category: 'Rzeźba terenu',
      usedFor: 'Siatka wysokościowa EPSG:2180 → spadek terenu (%) i lokalne zagłębienia',
      dataDate: 'NMT 1 m (GUGiK)',
      fetchedAt: generatedAt,
      status: terrain.status,
      license: 'Otwarte dane PZGIK / GUGiK (art. 40a Ustawy PGiK)'
    },
    {
      name: 'IUNG-PIB GeoServer (SMSR — Susza:katgl_landuse2024)',
      category: 'Gleba i kategoria podatności',
      usedFor: 'Kategoria agronomiczna gleby (I–IV) mapowana do tabeli retencji CDR tab. 12',
      dataDate: '2024',
      fetchedAt: generatedAt,
      status: soilProtected.soilStatus,
      license: 'Dane publiczne IUNG-PIB Puławy (wymagana atrybucja źródła)'
    },
    {
      name: 'GDOŚ WMS (Generalna Dyrekcja Ochrony Środowiska)',
      category: 'Obszary chronione',
      usedFor: 'Weryfikacja przecięcia z obszarami Natura 2000 (SOO i OSO)',
      dataDate: todayIso,
      fetchedAt: generatedAt,
      status: soilProtected.natura2000Status,
      license: 'Otwarte dane publiczne GDOŚ (INSPIRE / Ustawa o ochronie przyrody)'
    },
    {
      name: 'GUGiK BDOT10k WMS & Ortofotomapa StandardResolution',
      category: 'Hydrografia, pokrycie i mapa',
      usedFor: 'Rowy melioracyjne (row), lasy (TLes), zabudowa (RZab), podkład ortofotomapy',
      dataDate: 'BDOT10k / ORTO',
      fetchedAt: generatedAt,
      status: hydroAndLandUse.ditchStatus,
      license: 'Otwarte dane PZGIK / GUGiK (wymagana atrybucja GUGiK)'
    }
  ];

  if (imgwCurrentObs?.available) {
    sources.push({
      name: `IMGW-PIB Dane Publiczne Synop (stacja ${imgwCurrentObs.station})`,
      category: 'Obserwacja naziemna (dziś)',
      usedFor: 'Bieżąca temperatura, opad dobowy i wilgotność z najbliższej stacji synoptycznej',
      dataDate: imgwCurrentObs.measuredAt,
      fetchedAt: generatedAt,
      status: 'ok',
      license: 'Dane publiczne IMGW-PIB (wymagana informacja: Źródłem pochodzenia danych jest IMGW-PIB)'
    });
  }

  return {
    ok: true,
    parcel,
    analysisDate,
    generatedAt,
    cropId: crop.id,
    rawInput,
    inputs,
    result,
    tenYearSummaryPl: meteoStats.tenYearSummaryPl,
    medianDeltaMm: meteoStats.medianDeltaMm,
    edoRegionalContext: {
      available: false,
      label: 'Klasyfikacja wg metodologii Copernicus EDO (drabina CDI: SPI → SMA → fAPAR/NDVI)',
      source: 'Copernicus European Drought Observatory (metodyka CDI)'
    },
    imgwCurrentObs,
    natura2000Sites: soilProtected.natura2000Sites,
    ditchDetails: hydroAndLandUse.ditchDetails,
    series: {
      kbwCumulative: meteoStats.kbwCumulative,
      kbwCriticalWindowByYear: meteoStats.kbwCriticalWindowByYear,
      kbwDryThresholdMm: meteoStats.kbwDryThresholdMm,
      kbwReferenceLabel: meteoStats.kbwReferenceLabel,
      ndvi: s2.seasonSeries,
      ndviMedianRef: s2.ndviMedianRef
    },
    sources,
    timingMs: {
      uldk: uldkMs,
      meteo: meteo.durationMs,
      terrain: terrain.durationMs,
      soilAndProtected: soilProtected.durationMs,
      hydroAndLandUse: hydroAndLandUse.durationMs,
      s2: s2.durationMs,
      total: Date.now() - totalStart
    },
    cached: Boolean(cachedStatic)
  };
}
