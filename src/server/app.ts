import express from 'express';
import { CROPS_DATA } from '../data/crops';
import {
  EDO_LADDER,
  KBW_THRESHOLDS,
  NDVI_CLASSES,
  SOIL_WATER_GROUPS
} from '../data/thresholds';
import { RECOMMENDATION_RULES } from '../data/rules';
import { LIMITATIONS_DATA } from '../data/limitations';
import { API_SOURCES_DATA } from '../data/apiSources';
import {
  lookupParcel,
  ParcelLookupError,
  parseCoordinatePair,
  runFullParcelAnalysis,
  sanitizeAnalysisDate,
  sanitizeCropId,
  sanitizeParcelIdStrict
} from './analyzeService';
import {
  buildUldkByIdUrl,
  buildUldkByXyUrl,
  fetchUldkParcel,
  parseUldkResponse,
  type UldkParcelRecord
} from './uldk';

interface ProbeConfig {
  id: string;
  label: string;
  method: 'GET' | 'POST';
  buildRequest: (params: { lat: number; lon: number; date: string; parcelId: string }) => {
    url: string;
    headers?: Record<string, string>;
    body?: string;
  };
  summarize: (text: string, status: number) => string;
}

function clampCoord(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

function sanitizeDate(val: unknown, fallback = '2024-06-20'): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return fallback;
  const year = Number(trimmed.slice(0, 4));
  if (year < 2015 || year > 2026) return fallback;
  return trimmed;
}

function sanitizeParcelId(val: unknown, fallback = '040701_1.0081.11/74'): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!/^[0-9A-Za-z_./-]{4,40}$/.test(trimmed)) return fallback;
  return trimmed;
}

function subtractDaysIso(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return '2024-04-21';
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

// Strict allowlist of public Polish & European geospatial API endpoints (zero user-controlled hosts)
const PROBE_CONFIGS: Record<string, ProbeConfig> = {
  uldk: {
    id: 'uldk',
    label: 'ULDK GUGiK',
    method: 'GET',
    buildRequest: ({ lon, lat }) => ({
      url: `https://uldk.gugik.gov.pl/?request=GetParcelByXY&xy=${lon.toFixed(4)},${lat.toFixed(4)},4326&result=id,voivodeship,county,commune,region,parcel,geom_wkt&srid=4326`
    }),
    summarize: (text) => {
      try {
        const record = parseUldkResponse(text);
        if (!record) return 'Odpowiedź ULDK: brak działki w tym punkcie';
        return `Znaleziono działkę ${record.id} (${record.voivodeship}, ${record.commune})`;
      } catch {
        return 'Odpowiedź ULDK niepoprawna (możliwe ograniczenie ruchu GUGiK)';
      }
    }
  },
  open_meteo: {
    id: 'open_meteo',
    label: 'Open-Meteo Archive',
    method: 'GET',
    buildRequest: ({ lat, lon, date }) => {
      const start = subtractDaysIso(date, 59);
      return {
        url: `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${start}&end_date=${date}&daily=precipitation_sum,temperature_2m_mean,et0_fao_evapotranspiration&timezone=Europe%2FWarsaw`
      };
    },
    summarize: (text) => {
      try {
        const data = JSON.parse(text) as {
          daily?: {
            time?: string[];
            precipitation_sum?: (number | null)[];
            et0_fao_evapotranspiration?: (number | null)[];
          };
        };
        const days = data.daily?.time?.length ?? 0;
        const rain = (data.daily?.precipitation_sum ?? []).reduce<number>((a, b) => a + (b ?? 0), 0);
        const et0 = (data.daily?.et0_fao_evapotranspiration ?? []).reduce<number>(
          (a, b) => a + (b ?? 0),
          0
        );
        const kbw = Math.round(rain - et0);
        return `${days} dni danych | Opad: ${rain.toFixed(1)} mm | ET0: ${et0.toFixed(1)} mm | KBW (60 dni): ${kbw} mm`;
      } catch {
        return 'Otrzymano odpowiedź Open-Meteo';
      }
    }
  },
  earth_search: {
    id: 'earth_search',
    label: 'Earth Search Sentinel-2 L2A',
    method: 'POST',
    buildRequest: ({ lat, lon, date }) => {
      const start = subtractDaysIso(date, 30);
      const bbox = [
        Number((lon - 0.01).toFixed(4)),
        Number((lat - 0.01).toFixed(4)),
        Number((lon + 0.01).toFixed(4)),
        Number((lat + 0.01).toFixed(4))
      ];
      return {
        url: 'https://earth-search.aws.element84.com/v1/search',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collections: ['sentinel-2-l2a'],
          bbox,
          datetime: `${start}T00:00:00Z/${date}T23:59:59Z`,
          query: { 'eo:cloud_cover': { lt: 25 } },
          limit: 1
        })
      };
    },
    summarize: (text) => {
      try {
        const data = JSON.parse(text) as {
          numberMatched?: number;
          features?: Array<{
            id?: string;
            properties?: { datetime?: string; 'eo:cloud_cover'?: number };
            assets?: Record<string, unknown>;
          }>;
        };
        const first = data.features?.[0];
        if (!first) return 'Brak scen bezchmurnych (<25%) w oknie 30 dni';
        const bands = ['red', 'nir', 'nir08', 'swir16', 'scl'].filter(
          (k) => first.assets && k in first.assets
        );
        return `Scena ${first.id} (${first.properties?.datetime?.slice(0, 10)}), chmury ${first.properties?.['eo:cloud_cover']?.toFixed(1)}%, pasma: ${bands.join(', ')}`;
      } catch {
        return 'Otrzymano odpowiedź STAC';
      }
    }
  },
  iung_smsr: {
    id: 'iung_smsr',
    label: 'IUNG GeoServer WMS (sgeo.iung.pl)',
    method: 'GET',
    buildRequest: () => ({
      url: 'https://sgeo.iung.pl/geoserver/common/wms/?SERVICE=WMS&REQUEST=GetCapabilities'
    }),
    summarize: (text, status) =>
      status === 200 && text.includes('WMS_Capabilities')
        ? 'WMS_Capabilities 1.3.0 aktywne (warstwa kategorii gleb: Susza:katgl_landuse2024)'
        : `HTTP ${status}`
  },
  geoportal_nmt: {
    id: 'geoportal_nmt',
    label: 'GUGiK NMT 1 m (GetHByXY)',
    method: 'GET',
    buildRequest: () => ({
      url: 'https://services.gugik.gov.pl/nmt/?request=GetHByXY&x=548000&y=450000'
    }),
    summarize: (text) => `Wysokość NMT (EPSG:2180 x=548000, y=450000): ${text.trim()} m n.p.m.`
  },
  hydroportal_bdot: {
    id: 'hydroportal_bdot',
    label: 'GUGiK BDOT10k Hydrografia WMS (XML 1.3.0)',
    method: 'GET',
    buildRequest: () => ({
      url: 'https://mapy.geoportal.gov.pl/wss/service/pub/guest/kompozycja_BDOT10k_WMS/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=row,kan,rz,WPow,Mo&QUERY_LAYERS=row,kan,rz,WPow,Mo&CRS=EPSG:2180&BBOX=547400,448000,548400,449000&WIDTH=3&HEIGHT=3&I=1&J=1&INFO_FORMAT=text/xml&FEATURE_COUNT=10'
    }),
    summarize: (text, status) => {
      if (status !== 200 || !text.includes('FeatureInfoResponse')) return `HTTP ${status}`;
      const codes = Array.from(new Set([...text.matchAll(/x_kod="([^"]+)"/g)].map((m) => m[1])));
      return codes.length > 0
        ? `BDOT10k WMS 1.3.0 XML aktywne — wykryto obiekty hydrograficzne: ${codes.join(', ')}`
        : 'BDOT10k WMS 1.3.0 XML aktywne (200 OK)';
    }
  },
  edo_wms: {
    id: 'edo_wms',
    label: 'Copernicus EDO WMS',
    method: 'GET',
    buildRequest: () => ({
      url: 'https://drought.emergency.copernicus.eu/api/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1'
    }),
    summarize: (text, status) =>
      status === 200 && text.includes('WMT_MS_Capabilities')
        ? 'EDO WMS 1.1.1 aktywne (warstwy: cdiad, smian, fpanv, spaST z parametrem TIME)'
        : `HTTP ${status}`
  },
  imgw_synop: {
    id: 'imgw_synop',
    label: 'IMGW-PIB Synop (Toruń)',
    method: 'GET',
    buildRequest: () => ({
      url: 'https://danepubliczne.imgw.pl/api/data/synop/station/torun'
    }),
    summarize: (text) => {
      try {
        const d = JSON.parse(text) as {
          stacja?: string;
          data_pomiaru?: string;
          godzina_pomiaru?: string;
          temperatura?: string;
          suma_opadu?: string;
        };
        return `Stacja ${d.stacja} (${d.data_pomiaru} ${d.godzina_pomiaru}:00) | Temp: ${d.temperatura}°C | Opad: ${d.suma_opadu} mm`;
      } catch {
        return 'Otrzymano dane IMGW';
      }
    }
  },
  gdos_natura2000: {
    id: 'gdos_natura2000',
    label: 'GDOŚ WMS (Natura 2000 SOO/OSO)',
    method: 'GET',
    buildRequest: ({ lat, lon }) => {
      const d = 0.002;
      const bbox = `${(lon - d).toFixed(5)},${(lat - d).toFixed(5)},${(lon + d).toFixed(5)},${(lat + d).toFixed(5)}`;
      return {
        url: `https://sdi.gdos.gov.pl/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=GDOS:SpecjalneObszaryOchrony,GDOS:ObszarySpecjalnejOchrony&QUERY_LAYERS=GDOS:SpecjalneObszaryOchrony,GDOS:ObszarySpecjalnejOchrony&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=application/json&FEATURE_COUNT=5`
      };
    },
    summarize: (text, status) => {
      if (status !== 200) return `HTTP ${status}`;
      try {
        const parsed = JSON.parse(text) as { features?: Array<{ properties?: { nazwa?: string } }> };
        const count = parsed.features?.length ?? 0;
        if (count === 0) return 'Brak kolizji z obszarami Natura 2000 w badanym punkcie (0 obiektów)';
        const names = parsed.features?.map((f) => f.properties?.nazwa).filter(Boolean).join(', ');
        return `Znaleziono ${count} obszar(y) Natura 2000: ${names || 'obiekt GDOŚ'}`;
      } catch {
        return 'Otrzymano odpowiedź GDOŚ WMS';
      }
    }
  }
};

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'WodaPol', timestamp: new Date().toISOString() });
  });

  app.get('/api/reference-data', (_req, res) => {
    res.json({
      ok: true,
      crops: CROPS_DATA,
      thresholds: {
        edoLadder: EDO_LADDER,
        ndviClasses: NDVI_CLASSES,
        kbwThresholds: KBW_THRESHOLDS
      },
      soilWaterGroups: SOIL_WATER_GROUPS,
      rules: RECOMMENDATION_RULES,
      limitations: LIMITATIONS_DATA,
      apiSources: API_SOURCES_DATA
    });
  });

  // Endpoint: Live probe of an allowlisted external API source
  app.get('/api/probe/:sourceId', async (req, res) => {
    const sourceId = req.params.sourceId;
    const config = PROBE_CONFIGS[sourceId];
    if (!config) {
      res.status(400).json({ ok: false, error: 'Nieznane źródło API (spoza białej listy).' });
      return;
    }

    const lat = clampCoord(req.query.lat, 48.8, 55.0, 52.8);
    const lon = clampCoord(req.query.lon, 14.0, 24.5, 18.25);
    const date = sanitizeDate(req.query.date, '2024-06-20');
    const parcelId = sanitizeParcelId(req.query.parcelId);

    const built = config.buildRequest({ lat, lon, date, parcelId });
    const started = Date.now();

    try {
      const response = await fetch(built.url, {
        method: config.method,
        headers: {
          'User-Agent': 'WodaPol-KOWR-HackNation2026/1.0',
          ...(built.headers ?? {})
        },
        body: built.body,
        // ULDK przy ograniczeniu ruchu przekierowuje na ~130 MB śmieci — nie podążamy za tym
        redirect: config.id === 'uldk' ? 'manual' : 'follow',
        signal: AbortSignal.timeout(8500)
      });

      const latencyMs = Date.now() - started;
      const rawText = await response.text();
      const snippet = rawText.slice(0, 900);

      res.json({
        ok: response.ok,
        sourceId: config.id,
        status: response.status,
        latencyMs,
        method: config.method,
        url: built.url,
        contentType: response.headers.get('content-type') ?? 'unknown',
        summary: config.summarize(rawText, response.status),
        snippet
      });
    } catch (err) {
      const latencyMs = Date.now() - started;
      res.status(502).json({
        ok: false,
        sourceId: config.id,
        status: 0,
        latencyMs,
        method: config.method,
        url: built.url,
        summary: 'Błąd połączenia lub przekroczony limit czasu (8,5 s)',
        error: err instanceof Error ? err.message : 'Nieznany błąd sieci'
      });
    }
  });

  // Endpoint: Parallel live parcel fetch (ULDK + Open-Meteo Archive 60-day KBW + Earth Search S2)
  app.get('/api/live-parcel', async (req, res) => {
    const mode = req.query.mode === 'id' ? 'id' : 'xy';
    const parcelId = sanitizeParcelId(req.query.parcelId, '040701_1.0081.11/74');
    let lat = clampCoord(req.query.lat, 48.8, 55.0, 52.8);
    let lon = clampCoord(req.query.lon, 14.0, 24.5, 18.25);
    const date = sanitizeDate(req.query.date, '2024-06-20');
    const totalStart = Date.now();

    try {
      const uldkUrl = mode === 'id' ? buildUldkByIdUrl(parcelId) : buildUldkByXyUrl(lat, lon);

      let uldkRecord: UldkParcelRecord | null = null;
      try {
        uldkRecord = await fetchUldkParcel(uldkUrl, { timeoutMs: 7000 });
      } catch {
        uldkRecord = null;
      }

      let parcelInfo = {
        found: false,
        id: parcelId,
        voivodeship: '',
        county: '',
        commune: '',
        region: '',
        parcelNumber: '',
        centroidLat: lat,
        centroidLon: lon
      };

      if (uldkRecord) {
        parcelInfo = {
          found: true,
          id: uldkRecord.id,
          voivodeship: uldkRecord.voivodeship,
          county: uldkRecord.county,
          commune: uldkRecord.commune,
          region: uldkRecord.region,
          parcelNumber: uldkRecord.parcelNumber,
          centroidLat: lat,
          centroidLon: lon
        };

        const wkt = uldkRecord.wkt;
        const coordMatches = [...wkt.matchAll(/(\d+\.\d+)\s+(\d+\.\d+)/g)];
        if (coordMatches.length > 0) {
          let sumLon = 0;
          let sumLat = 0;
          for (const m of coordMatches) {
            sumLon += Number(m[1]);
            sumLat += Number(m[2]);
          }
          lon = sumLon / coordMatches.length;
          lat = sumLat / coordMatches.length;
          parcelInfo.centroidLat = Number(lat.toFixed(5));
          parcelInfo.centroidLon = Number(lon.toFixed(5));
        }
      }

      const start60 = subtractDaysIso(date, 59);
      const start30 = subtractDaysIso(date, 30);
      const meteoUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${start60}&end_date=${date}&daily=precipitation_sum,temperature_2m_mean,et0_fao_evapotranspiration&timezone=Europe%2FWarsaw`;

      const bbox = [
        Number((lon - 0.01).toFixed(4)),
        Number((lat - 0.01).toFixed(4)),
        Number((lon + 0.01).toFixed(4)),
        Number((lat + 0.01).toFixed(4))
      ];

      const [meteoResult, stacResult] = await Promise.allSettled([
        fetch(meteoUrl, { signal: AbortSignal.timeout(8000) }).then((r) => r.json()),
        fetch('https://earth-search.aws.element84.com/v1/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collections: ['sentinel-2-l2a'],
            bbox,
            datetime: `${start30}T00:00:00Z/${date}T23:59:59Z`,
            query: { 'eo:cloud_cover': { lt: 25 } },
            limit: 1
          }),
          signal: AbortSignal.timeout(8000)
        }).then((r) => r.json())
      ]);

      let meteoSummary: {
        ok: boolean;
        rain60dMm: number | null;
        et060dMm: number | null;
        kbw60dMm: number | null;
        meanTempC: number | null;
      } = { ok: false, rain60dMm: null, et060dMm: null, kbw60dMm: null, meanTempC: null };

      if (meteoResult.status === 'fulfilled' && meteoResult.value?.daily) {
        const d = meteoResult.value.daily as {
          precipitation_sum?: (number | null)[];
          et0_fao_evapotranspiration?: (number | null)[];
          temperature_2m_mean?: (number | null)[];
        };
        const rain = (d.precipitation_sum ?? []).reduce<number>((a, b) => a + (b ?? 0), 0);
        const et0 = (d.et0_fao_evapotranspiration ?? []).reduce<number>((a, b) => a + (b ?? 0), 0);
        const temps = (d.temperature_2m_mean ?? []).filter((t): t is number => typeof t === 'number');
        const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
        meteoSummary = {
          ok: true,
          rain60dMm: Number(rain.toFixed(1)),
          et060dMm: Number(et0.toFixed(1)),
          kbw60dMm: Math.round(rain - et0),
          meanTempC: avgTemp !== null ? Number(avgTemp.toFixed(1)) : null
        };
      }

      let satelliteSummary: {
        ok: boolean;
        sceneId: string | null;
        sceneDate: string | null;
        cloudCoverPct: number | null;
        ageDays: number | null;
      } = { ok: false, sceneId: null, sceneDate: null, cloudCoverPct: null, ageDays: null };

      if (stacResult.status === 'fulfilled' && Array.isArray(stacResult.value?.features)) {
        const feat = stacResult.value.features[0] as
          | { id?: string; properties?: { datetime?: string; 'eo:cloud_cover'?: number } }
          | undefined;
        if (feat?.properties?.datetime) {
          const sceneDate = feat.properties.datetime.slice(0, 10);
          const diffMs =
            new Date(`${date}T00:00:00Z`).getTime() - new Date(`${sceneDate}T00:00:00Z`).getTime();
          const ageDays = Math.max(0, Math.round(diffMs / 86400000));
          satelliteSummary = {
            ok: true,
            sceneId: feat.id ?? null,
            sceneDate,
            cloudCoverPct:
              typeof feat.properties['eo:cloud_cover'] === 'number'
                ? Number(feat.properties['eo:cloud_cover'].toFixed(1))
                : null,
            ageDays
          };
        } else {
          satelliteSummary = { ok: true, sceneId: null, sceneDate: null, cloudCoverPct: null, ageDays: null };
        }
      }

      res.json({
        ok: true,
        analysisDate: date,
        totalLatencyMs: Date.now() - totalStart,
        parcel: parcelInfo,
        meteo: meteoSummary,
        satellite: satelliteSummary
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        totalLatencyMs: Date.now() - totalStart,
        error: err instanceof Error ? err.message : 'Błąd pobierania danych działki'
      });
    }
  });

  // Endpoint: Parcel lookup by TERYT ID or WGS84 coordinates (ULDK GUGiK)
  app.get('/api/parcel', async (req, res) => {
    const id = sanitizeParcelIdStrict(req.query.id);
    const coords = parseCoordinatePair(req.query.lat, req.query.lon);

    if (!id && !coords) {
      res.status(400).json({
        ok: false,
        code: 'INVALID',
        error: 'Podaj poprawny numer działki (np. 040704_2.0004.70/11) albo kliknij punkt na mapie Polski.'
      });
      return;
    }

    try {
      const parcel = await lookupParcel(
        id ? { id } : { lat: coords![0], lon: coords![1] }
      );
      res.json({ ok: true, parcel });
    } catch (err) {
      if (err instanceof ParcelLookupError) {
        const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'TIMEOUT' ? 504 : 400;
        res.status(status).json({ ok: false, code: err.code, error: err.message });
        return;
      }
      res.status(502).json({
        ok: false,
        code: 'TIMEOUT',
        error: 'Serwer map nie odpowiada, spróbuj ponownie.'
      });
    }
  });

  // Endpoint: Full live parcel water diagnosis (JSON)
  app.get('/api/analyze', async (req, res) => {
    const id = sanitizeParcelIdStrict(req.query.id);
    const coords = parseCoordinatePair(req.query.lat, req.query.lon);
    const cropId = sanitizeCropId(req.query.crop ?? req.query.uprawa);
    const date = sanitizeAnalysisDate(req.query.date ?? req.query.data);

    if (!id && !coords) {
      res.status(400).json({
        ok: false,
        error: 'Brak identyfikatora działki (id) lub współrzędnych (lat, lon).'
      });
      return;
    }

    try {
      const report = await runFullParcelAnalysis({
        id,
        lat: coords?.[0],
        lon: coords?.[1],
        cropId,
        date
      });
      res.json(report);
    } catch (err) {
      if (err instanceof ParcelLookupError) {
        const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'TIMEOUT' ? 504 : 400;
        res.status(status).json({ ok: false, code: err.code, error: err.message });
        return;
      }
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Nie udało się przeprowadzić analizy działki.'
      });
    }
  });

  // Endpoint: Live SSE stream emitting real progress steps + final diagnosis JSON
  app.get('/api/analyze-stream', async (req, res) => {
    const id = sanitizeParcelIdStrict(req.query.id);
    const coords = parseCoordinatePair(req.query.lat, req.query.lon);
    const cropId = sanitizeCropId(req.query.crop ?? req.query.uprawa);
    const date = sanitizeAnalysisDate(req.query.date ?? req.query.data);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const sendEvent = (event: string, payload: unknown) => {
      if (closed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    if (!id && !coords) {
      sendEvent('analysis_error', {
        code: 'INVALID',
        error: 'Brak identyfikatora działki (id) lub współrzędnych (lat, lon).'
      });
      res.end();
      return;
    }

    try {
      const report = await runFullParcelAnalysis({
        id,
        lat: coords?.[0],
        lon: coords?.[1],
        cropId,
        date,
        onStepUpdate: (step) => sendEvent('step', step)
      });
      sendEvent('result', report);
    } catch (err) {
      if (err instanceof ParcelLookupError) {
        sendEvent('analysis_error', { code: err.code, error: err.message });
      } else {
        sendEvent('analysis_error', {
          code: 'UNKNOWN',
          error: err instanceof Error ? err.message : 'Błąd podczas analizy działki.'
        });
      }
    } finally {
      if (!closed) res.end();
    }
  });

  return app;
}
