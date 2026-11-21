import { useMemo, useState } from 'react';
import { Download, Printer, RefreshCw, Check } from 'lucide-react';
import { CROPS_DATA } from '../data/crops';
import { SOIL_WATER_GROUPS } from '../data/thresholds';
import {
  runWaterDiagnosis,
  type LandUseType,
  type ParcelDiagnosisInput
} from '../engine/waterBrain';
import { triggerBrowserDownload } from '../utils/exporters';

interface PresetScenario {
  id: string;
  label: string;
  input: ParcelDiagnosisInput;
}

const PRESETS: PresetScenario[] = [
  {
    id: 'kujawy_slope',
    label: 'Stok >4% bez okrywy (Kujawy)',
    input: {
      parcelLabel: '040701_1.0081.11/74 (Inowrocław)',
      analysisDate: '2024-06-18',
      cropId: 'pszenica_ozima',
      soilId: 'piasek_gliniasty',
      landUse: 'arable',
      isNatura2000: false,
      slopePct: 5.2,
      hasSoilCover: false,
      hasDepression: true,
      ditchDistanceM: 320,
      kbwMm: -85,
      spi1: -1.4,
      spi3: -1.3,
      sma: -1.2,
      ndvi: 0.34,
      ndmi: -0.08,
      ndviAnomaly: -1.4,
      satelliteAgeDays: 4,
      depletionFraction: 0.58,
      dryYearsLast10: 6
    }
  },
  {
    id: 'harvest_guard',
    label: 'Żniwa zbóż (test fałszywego NDVI)',
    input: {
      parcelLabel: '040701_1.0081.11/74 (Inowrocław)',
      analysisDate: '2024-07-28',
      cropId: 'pszenica_ozima',
      soilId: 'glina_lekka',
      landUse: 'arable',
      isNatura2000: false,
      slopePct: 1.8,
      hasSoilCover: true,
      hasDepression: false,
      ditchDistanceM: 850,
      kbwMm: -65,
      spi1: -1.1,
      spi3: -1.2,
      sma: -1.1,
      ndvi: 0.18,
      ndmi: -0.15,
      ndviAnomaly: -1.9,
      satelliteAgeDays: 3,
      depletionFraction: 0.45,
      dryYearsLast10: 4
    }
  },
  {
    id: 'natura2000',
    label: 'Obszar Natura 2000 (piasek)',
    input: {
      parcelLabel: '041502_2.0012.44 (Dolina Noteci)',
      analysisDate: '2024-06-22',
      cropId: 'ziemniak',
      soilId: 'piasek_luzny',
      landUse: 'arable',
      isNatura2000: true,
      slopePct: 2.5,
      hasSoilCover: false,
      hasDepression: true,
      ditchDistanceM: 180,
      kbwMm: -110,
      spi1: -2.2,
      spi3: -1.5,
      sma: -1.6,
      ndvi: 0.46,
      ndmi: -0.05,
      ndviAnomaly: -0.9,
      satelliteAgeDays: 16,
      depletionFraction: 0.52,
      dryYearsLast10: 7
    }
  },
  {
    id: 'non_arable',
    label: 'Działka leśna (brak rekomendacji)',
    input: {
      parcelLabel: '040301_2.0005.102 (Las)',
      analysisDate: '2024-06-20',
      cropId: 'kukurydza',
      soilId: 'piasek_luzny',
      landUse: 'forest',
      isNatura2000: false,
      slopePct: 6.0,
      hasSoilCover: true,
      hasDepression: false,
      ditchDistanceM: 400,
      kbwMm: -90,
      spi1: -1.0,
      spi3: -1.1,
      sma: -0.8,
      ndvi: 0.72,
      ndmi: 0.28,
      ndviAnomaly: 0.1,
      satelliteAgeDays: 5,
      depletionFraction: 0.3,
      dryYearsLast10: 3
    }
  }
];

interface LiveParcelApiResponse {
  ok: boolean;
  analysisDate: string;
  totalLatencyMs: number;
  parcel?: {
    found: boolean;
    id: string;
    voivodeship: string;
    county: string;
    commune: string;
    centroidLat: number;
    centroidLon: number;
  };
  meteo?: {
    ok: boolean;
    rain60dMm: number | null;
    et060dMm: number | null;
    kbw60dMm: number | null;
    meanTempC: number | null;
  };
  satellite?: {
    ok: boolean;
    sceneId: string | null;
    sceneDate: string | null;
    cloudCoverPct: number | null;
    ageDays: number | null;
  };
  error?: string;
}

export function SimulatorView() {
  const [input, setInput] = useState<ParcelDiagnosisInput>(PRESETS[0].input);
  const [activePreset, setActivePreset] = useState<string>(PRESETS[0].id);

  // Live parcel fetch controls
  const [liveParcelId, setLiveParcelId] = useState('040701_1.0081.11/74');
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const result = useMemo(() => runWaterDiagnosis(input), [input]);

  const updateField = <K extends keyof ParcelDiagnosisInput>(
    key: K,
    value: ParcelDiagnosisInput[K]
  ) => {
    setActivePreset('custom');
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: PresetScenario) => {
    setActivePreset(preset.id);
    setInput(preset.input);
    setLiveStatus(null);
    setLiveError(null);
  };

  const handleLiveFetch = async () => {
    const trimmed = liveParcelId.trim();
    if (!trimmed) {
      setLiveError('Podaj identyfikator TERYT działki (np. 040701_1.0081.11/74).');
      return;
    }
    setLiveLoading(true);
    setLiveError(null);
    setLiveStatus(null);

    try {
      const qs = new URLSearchParams({
        mode: 'id',
        parcelId: trimmed,
        date: input.analysisDate
      });
      const res = await fetch(`/api/live-parcel?${qs.toString()}`);
      const data = (await res.json()) as LiveParcelApiResponse;
      if (!data.ok) {
        setLiveError(data.error ?? 'Nie udało się pobrać danych dla działki.');
        return;
      }

      setActivePreset('live');
      setInput((prev) => ({
        ...prev,
        parcelLabel: data.parcel?.found
          ? `${data.parcel.id} (${data.parcel.commune}, ${data.parcel.voivodeship})`
          : `${trimmed} (poza ULDK — współrzędne domyślne)`,
        kbwMm:
          data.meteo?.ok && data.meteo.kbw60dMm !== null ? data.meteo.kbw60dMm : prev.kbwMm,
        satelliteAgeDays: data.satellite?.ok ? data.satellite.ageDays : prev.satelliteAgeDays
      }));

      const parts = [
        `Czas zapytań równoległych: ${data.totalLatencyMs} ms`,
        data.parcel?.found
          ? `ULDK OK (${data.parcel.commune})`
          : 'ULDK: brak działki dla podanego ID',
        data.meteo?.ok
          ? `Open-Meteo 60d: opad ${data.meteo.rain60dMm} mm, ET0 ${data.meteo.et060dMm} mm, KBW ${data.meteo.kbw60dMm} mm`
          : 'Open-Meteo: błąd',
        data.satellite?.ok && data.satellite.sceneDate
          ? `Sentinel-2: scena ${data.satellite.sceneDate} (wiek ${data.satellite.ageDays} dni, chmury ${data.satellite.cloudCoverPct}%)`
          : 'Sentinel-2: brak bezchmurnej sceny <25% w oknie 30 dni'
      ];
      setLiveStatus(parts.join(' · '));
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Błąd sieci przy pobieraniu działki');
    } finally {
      setLiveLoading(false);
    }
  };

  const edoTone =
    result.edoLevel.poziom === 'brak'
      ? { text: 'text-[#15803D]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', symbol: '●' }
      : result.edoLevel.poziom === 'obserwacja'
        ? { text: 'text-[#A16207]', bg: 'bg-[#FEFCE8]', border: 'border-[#FEF08A]', symbol: '▲' }
        : result.edoLevel.poziom === 'ostrzezenie'
          ? { text: 'text-[#C2410C]', bg: 'bg-[#FFF7ED]', border: 'border-[#FED7AA]', symbol: '▲' }
          : { text: 'text-[#B91C1C]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', symbol: '✖' };

  return (
    <section aria-labelledby="simulator-heading" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#DCE2DD]">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-[#506057]">
            Test silnika reguł KOWR · Kolejność: stan → przyczyny → retencja → agrotechnika →
            nawadnianie
          </p>
          <h1
            id="simulator-heading"
            className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#141D19]"
          >
            Symulator reguł i pobór działki na żywo
          </h1>
          <p className="text-sm text-[#43524A] leading-relaxed">
            Sprawdź, jak tabele JSON (uprawy, progi, reguły, ograniczenia) działają na konkretnej
            działce — użyj gotowych scenariuszy testowych albo pobierz prawdziwe dane ULDK,
            Open-Meteo Archive i Sentinel-2 na wybraną datę.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() =>
              triggerBrowserDownload(
                `raport_wodny_${input.analysisDate}.json`,
                JSON.stringify({ input, result }, null, 2),
                'application/json;charset=utf-8'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Pobierz JSON raportu
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#141D19] text-white hover:bg-[#25332C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            Drukuj / Zapisz PDF
          </button>
        </div>
      </div>

      {/* Presets bar */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-xs font-semibold text-[#506057] mr-1">Scenariusze testowe:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activePreset === preset.id
                ? 'bg-[#1B5E4A] text-white border-[#1B5E4A]'
                : 'bg-white text-[#23322B] border-[#CED7D1] hover:bg-[#F1F4F2]'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Live Parcel Fetch Strip */}
      <div className="bg-white border border-[#DCE2DD] rounded-lg p-4 space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label
              htmlFor="live-parcel-id"
              className="block text-xs font-semibold text-[#2B3A32] mb-1"
            >
              Identyfikator działki TERYT (ULDK GUGiK na żywo)
            </label>
            <input
              id="live-parcel-id"
              type="text"
              value={liveParcelId}
              onChange={(e) => setLiveParcelId(e.target.value)}
              placeholder="np. 040701_1.0081.11/74"
              className="w-full px-3 py-2 text-sm font-mono bg-[#FAFBF9] border border-[#CED7D1] rounded-md text-[#141D19] focus:outline-none focus:border-[#1B5E4A]"
            />
          </div>
          <div className="w-full md:w-44">
            <label
              htmlFor="live-analysis-date"
              className="block text-xs font-semibold text-[#2B3A32] mb-1"
            >
              Data analizy „na dzień X”
            </label>
            <input
              id="live-analysis-date"
              type="date"
              value={input.analysisDate}
              min="2016-01-01"
              max="2026-11-21"
              onChange={(e) => updateField('analysisDate', e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-[#FAFBF9] border border-[#CED7D1] rounded-md text-[#141D19] focus:outline-none focus:border-[#1B5E4A]"
            />
          </div>
          <button
            type="button"
            disabled={liveLoading}
            onClick={handleLiveFetch}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-[#1B5E4A] text-white hover:bg-[#144B3A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${liveLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {liveLoading ? 'Pobieranie...' : 'Pobierz dane na żywo'}
          </button>
        </div>

        {liveStatus && (
          <div
            role="status"
            className="flex items-start gap-2 text-xs text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-2 rounded-md"
          >
            <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="font-mono">{liveStatus}</span>
          </div>
        )}
        {liveError && (
          <div
            role="alert"
            className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded-md"
          >
            {liveError}
          </div>
        )}
      </div>

      {/* Main Split Console: Left Parameter Controls (340px) + Right KOWR Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Column */}
        <div className="lg:col-span-4 bg-white border border-[#DCE2DD] rounded-lg p-5 space-y-5 print:hidden">
          <h2 className="text-sm font-bold text-[#141D19] pb-2 border-b border-[#E7ECE8]">
            Parametry wejściowe działki
          </h2>

          <div className="space-y-3.5 text-xs">
            <div>
              <label htmlFor="sim-crop" className="block font-semibold text-[#2B3A32] mb-1">
                Uprawa
              </label>
              <select
                id="sim-crop"
                value={input.cropId}
                onChange={(e) => updateField('cropId', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAFBF9] border border-[#CED7D1] rounded-md text-[#141D19]"
              >
                {CROPS_DATA.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nazwa_pl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-soil" className="block font-semibold text-[#2B3A32] mb-1">
                Grupa glebowa (CDR tab. 12)
              </label>
              <select
                id="sim-soil"
                value={input.soilId}
                onChange={(e) => updateField('soilId', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAFBF9] border border-[#CED7D1] rounded-md text-[#141D19]"
              >
                {SOIL_WATER_GROUPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.grupa_uziarnienia} ({s.woda_dostepna_50cm_mm} mm / 50 cm)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-landuse" className="block font-semibold text-[#2B3A32] mb-1">
                Użytkowanie terenu
              </label>
              <select
                id="sim-landuse"
                value={input.landUse}
                onChange={(e) => updateField('landUse', e.target.value as LandUseType)}
                className="w-full px-3 py-2 text-sm bg-[#FAFBF9] border border-[#CED7D1] rounded-md text-[#141D19]"
              >
                <option value="arable">Grunt orny (rolniczy)</option>
                <option value="forest">Las (nierolniczy)</option>
                <option value="urban">Teren zabudowany</option>
                <option value="water">Wody powierzchniowe</option>
              </select>
            </div>

            {/* Numeric sliders with tabular readouts */}
            <div className="pt-2 border-t border-[#EDF1EE] space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="sim-kbw" className="font-semibold text-[#2B3A32]">
                    KBW (60 dni)
                  </label>
                  <span className="font-mono tabular-nums font-bold text-[#141D19]">
                    {input.kbwMm} mm
                  </span>
                </div>
                <input
                  id="sim-kbw"
                  type="range"
                  min={-220}
                  max={80}
                  step={5}
                  value={input.kbwMm}
                  onChange={(e) => updateField('kbwMm', Number(e.target.value))}
                  className="w-full accent-[#1B5E4A]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="sim-slope" className="font-semibold text-[#2B3A32]">
                    Spadek terenu (NMT)
                  </label>
                  <span className="font-mono tabular-nums font-bold text-[#141D19]">
                    {input.slopePct.toFixed(1)}%
                  </span>
                </div>
                <input
                  id="sim-slope"
                  type="range"
                  min={0}
                  max={12}
                  step={0.2}
                  value={input.slopePct}
                  onChange={(e) => updateField('slopePct', Number(e.target.value))}
                  className="w-full accent-[#1B5E4A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sim-spi3" className="block font-semibold text-[#2B3A32] mb-1">
                    SPI-3
                  </label>
                  <input
                    id="sim-spi3"
                    type="number"
                    step={0.1}
                    min={-3.5}
                    max={3.5}
                    value={input.spi3}
                    onChange={(e) => updateField('spi3', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#FAFBF9] border border-[#CED7D1] rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="sim-sma" className="block font-semibold text-[#2B3A32] mb-1">
                    SMA (wilg. gleby)
                  </label>
                  <input
                    id="sim-sma"
                    type="number"
                    step={0.1}
                    min={-3.5}
                    max={3.5}
                    value={input.sma}
                    onChange={(e) => updateField('sma', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#FAFBF9] border border-[#CED7D1] rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sim-ndvi" className="block font-semibold text-[#2B3A32] mb-1">
                    NDVI (Sentinel-2)
                  </label>
                  <input
                    id="sim-ndvi"
                    type="number"
                    step={0.02}
                    min={-0.1}
                    max={0.95}
                    value={input.ndvi ?? 0}
                    onChange={(e) => updateField('ndvi', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#FAFBF9] border border-[#CED7D1] rounded-md"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-ndvianom"
                    className="block font-semibold text-[#2B3A32] mb-1"
                  >
                    Anomalia NDVI
                  </label>
                  <input
                    id="sim-ndvianom"
                    type="number"
                    step={0.1}
                    min={-3.0}
                    max={3.0}
                    value={input.ndviAnomaly ?? 0}
                    onChange={(e) => updateField('ndviAnomaly', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#FAFBF9] border border-[#CED7D1] rounded-md"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="sim-depletion" className="font-semibold text-[#2B3A32]">
                    Wyczerpanie zapasu wody
                  </label>
                  <span className="font-mono tabular-nums font-bold text-[#141D19]">
                    {Math.round(input.depletionFraction * 100)}%
                  </span>
                </div>
                <input
                  id="sim-depletion"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={input.depletionFraction}
                  onChange={(e) => updateField('depletionFraction', Number(e.target.value))}
                  className="w-full accent-[#1B5E4A]"
                />
              </div>
            </div>

            {/* Boolean Field Conditions */}
            <div className="pt-2 border-t border-[#EDF1EE] space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!input.hasSoilCover}
                  onChange={(e) => updateField('hasSoilCover', !e.target.checked)}
                  className="w-4 h-4 accent-[#1B5E4A]"
                />
                <span className="text-[#1D2923]">Gleba bez okrywy (brak mulczu / międzyplonu)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={input.isNatura2000}
                  onChange={(e) => updateField('isNatura2000', e.target.checked)}
                  className="w-4 h-4 accent-[#1B5E4A]"
                />
                <span className="text-[#1D2923]">Obszar chroniony Natura 2000</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={input.hasDepression}
                  onChange={(e) => updateField('hasDepression', e.target.checked)}
                  className="w-4 h-4 accent-[#1B5E4A]"
                />
                <span className="text-[#1D2923]">Lokalne zagłębienie terenu (NMT)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right KOWR Structured Report Output */}
        <div className="lg:col-span-8 space-y-6">
          {/* Krok 1: Ocena sytuacji wodnej „tu i teraz” */}
          <div className="bg-white border border-[#DCE2DD] rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#55665D]">
              <span>
                Krok 1 z 4 · Ocena sytuacji wodnej · Działka {input.parcelLabel}
              </span>
              <span className="font-mono tabular-nums">
                Data: {input.analysisDate} · Suchych lat w dekadzie: {input.dryYearsLast10}/10
              </span>
            </div>

            <div className={`rounded-md border p-4 ${edoTone.bg} ${edoTone.border} space-y-1.5`}>
              <div className={`text-sm font-bold ${edoTone.text}`}>
                {edoTone.symbol} Poziom EDO: {result.edoLevel.nazwa_pl} ({result.edoLevel.nazwa_edo})
              </div>
              <p className="text-sm text-[#141D19] leading-relaxed">{result.statusSummaryPl}</p>
            </div>

            {/* Key Tabular Readout Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-[#E7ECE8]">
              <div>
                <span className="text-[11px] text-[#5E6E65] block">KBW (60 dni)</span>
                <span className="text-xl font-mono tabular-nums font-bold text-[#141D19]">
                  {input.kbwMm}
                </span>
                <span className="text-xs font-mono text-[#64746B] ml-1">mm</span>
              </div>
              <div>
                <span className="text-[11px] text-[#5E6E65] block">Woda w glebie (0–50 cm)</span>
                <span className="text-xl font-mono tabular-nums font-bold text-[#141D19]">
                  {result.soil.woda_dostepna_50cm_mm}
                </span>
                <span className="text-xs font-mono text-[#64746B] ml-1">mm</span>
              </div>
              <div>
                <span className="text-[11px] text-[#5E6E65] block">NDVI (Sentinel-2)</span>
                <span className="text-xl font-mono tabular-nums font-bold text-[#141D19]">
                  {input.ndvi !== null ? input.ndvi.toFixed(2) : 'Brak'}
                </span>
                <span className="text-[11px] text-[#64746B] block">
                  {input.satelliteAgeDays !== null
                    ? `wiek sceny: ${input.satelliteAgeDays} dni`
                    : 'brak sceny'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#5E6E65] block">Okno uprawy</span>
                <span className="text-sm font-semibold text-[#141D19] block mt-1">
                  {result.inHarvestWindow
                    ? 'Okno zbiorów'
                    : result.inCriticalWindow
                      ? 'Okno krytyczne'
                      : 'Poza oknem krytycznym'}
                </span>
              </div>
            </div>
          </div>

          {/* Weryfikacja / Ograniczenia specjalne (np. żniwa, Natura 2000, las) */}
          {result.verificationAlerts.length > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-bold text-[#92400E]">
                Ważne zastrzeżenia weryfikacyjne (przed rekomendacjami)
              </h2>
              <div className="space-y-3">
                {result.verificationAlerts.map((rule) => (
                  <div key={rule.id} className="space-y-1 text-xs">
                    <div className="font-semibold text-[#141D19]">
                      <span className="font-mono text-[#92400E] mr-2">{rule.id}</span>
                      {rule.tytul}
                    </div>
                    <p className="text-[#374151] leading-relaxed">{rule.tekst_dla_rolnika}</p>
                    <p className="text-[11px] text-[#6B7280]">Źródło: {rule.zrodlo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Krok 2: Diagnoza 4 przyczyn */}
          <div className="bg-white border border-[#DCE2DD] rounded-lg p-6 space-y-4">
            <h2 className="text-base font-bold text-[#141D19]">
              Krok 2 z 4 · Diagnoza przyczyn niedoboru wody
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.causes.map((cause) => (
                <div
                  key={cause.domena}
                  className="p-3.5 rounded-md border border-[#E4EAE6] bg-[#FAFBF9] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#141D19]">{cause.domena}</span>
                    <span
                      className={`font-semibold ${
                        cause.nasilenie === 'Wysokie'
                          ? 'text-[#B91C1C]'
                          : cause.nasilenie === 'Umiarkowane'
                            ? 'text-[#B45309]'
                            : 'text-[#15803D]'
                      }`}
                    >
                      {cause.nasilenie === 'Wysokie'
                        ? '✖ Wysokie'
                        : cause.nasilenie === 'Umiarkowane'
                          ? '▲ Umiarkowane'
                          : '● Brak'}
                    </span>
                  </div>
                  <p className="text-xs text-[#2E3C35] leading-relaxed">{cause.dowod}</p>
                  <p className="text-[11px] text-[#697870]">{cause.zrodlo}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Krok 3: Rekomendacje w kolejności KOWR (Retencja krajobrazowa -> Agrotechnika -> Nawadnianie) */}
          <div className="bg-white border border-[#DCE2DD] rounded-lg p-6 space-y-5">
            <h2 className="text-base font-bold text-[#141D19]">
              Krok 3 z 4 · Opcje do rozważenia (kolejność obowiązkowa KOWR)
            </h2>

            {/* 3a. Retencja krajobrazowa */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-[#1B5E4A]">
                3A. Retencja w krajobrazie (NWRM — zatrzymaj wodę tam, gdzie spadła)
              </h3>
              {result.landscapeRetention.length === 0 ? (
                <p className="text-xs text-[#5E6E65]">
                  Brak aktywnych reguł retencji krajobrazowej dla obecnych parametrów (lub wyłączono
                  prace ziemne z uwagi na ograniczenia).
                </p>
              ) : (
                <div className="divide-y divide-[#E7ECE8] border border-[#E4EAE6] rounded-md">
                  {result.landscapeRetention.map((rule) => (
                    <div key={rule.id} className="p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#141D19]">{rule.tytul}</span>
                        <span className="font-mono text-[#1B5E4A]">{rule.id}</span>
                      </div>
                      <p className="text-sm text-[#1E2A24] leading-relaxed">
                        {rule.tekst_dla_rolnika}
                      </p>
                      <p className="text-[11px] text-[#5E6E65]">
                        Uzasadnienie: {rule.uzasadnienie_naukowe} · Źródło: {rule.zrodlo}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3b. Retencja glebowa i agrotechnika */}
            <div className="space-y-2.5 pt-2 border-t border-[#E7ECE8]">
              <h3 className="text-xs font-bold text-[#1B5E4A]">
                3B. Retencja glebowa i agrotechnika
              </h3>
              {result.agrotechnics.length === 0 ? (
                <p className="text-xs text-[#5E6E65]">
                  Brak dodatkowych zaleceń agrotechnicznych dla obecnych parametrów.
                </p>
              ) : (
                <div className="divide-y divide-[#E7ECE8] border border-[#E4EAE6] rounded-md">
                  {result.agrotechnics.map((rule) => (
                    <div key={rule.id} className="p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#141D19]">{rule.tytul}</span>
                        <span className="font-mono text-[#1B5E4A]">{rule.id}</span>
                      </div>
                      <p className="text-sm text-[#1E2A24] leading-relaxed">
                        {rule.tekst_dla_rolnika}
                      </p>
                      <p className="text-[11px] text-[#5E6E65]">
                        Uzasadnienie: {rule.uzasadnienie_naukowe} · Źródło: {rule.zrodlo}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3c. Nawadnianie opcjonalne + kalkulator FAO-56 / CDR */}
            <div className="space-y-3 pt-2 border-t border-[#E7ECE8]">
              <h3 className="text-xs font-bold text-[#1B5E4A]">
                3C. Nawadnianie (opcjonalne — kalkulator dawki wg metody Drupki / FAO-56)
              </h3>
              <div className="bg-[#FAFBF9] border border-[#E4EAE6] rounded-md p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                  <div>
                    <span className="text-[#5E6E65] font-sans block">TAW (strefa korzeni)</span>
                    <span className="text-base font-bold text-[#141D19]">
                      {result.irrigationCalc.taw_mm} mm
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5E6E65] font-sans block">
                      RAW (próg {result.irrigationCalc.dopuszczalne_wyczerpanie_pct}%)
                    </span>
                    <span className="text-base font-bold text-[#141D19]">
                      {result.irrigationCalc.raw_mm} mm
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5E6E65] font-sans block">Dawka max do PPW</span>
                    <span className="text-base font-bold text-[#141D19]">
                      {result.irrigationCalc.dawka_maksymalna_mm} mm
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5E6E65] font-sans block">Dawka zalecana (0,75×)</span>
                    <span
                      className={`text-base font-bold ${
                        result.irrigationCalc.uzasadnione ? 'text-[#1B5E4A]' : 'text-[#64746B]'
                      }`}
                    >
                      {result.irrigationCalc.uzasadnione
                        ? `${result.irrigationCalc.dawka_zalecana_mm} mm`
                        : '0 mm (nie zalec.)'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[#2E3C35] leading-relaxed">
                  {result.irrigationCalc.powod_decyzji}
                </p>
                {result.irrigationRules.map((rule) => (
                  <p key={rule.id} className="text-xs text-[#1E2A24] pt-2 border-t border-[#E7ECE8]">
                    <span className="font-mono font-semibold text-[#1B5E4A] mr-1.5">
                      {rule.id}
                    </span>
                    {rule.tekst_dla_rolnika}
                  </p>
                ))}
                <p className="text-[11px] text-[#64746B]">
                  Metoda: {result.irrigationCalc.zrodlo}
                </p>
              </div>
            </div>
          </div>

          {/* Krok 4: Sekcja Ograniczenia dobrana automatycznie */}
          <div className="bg-white border border-[#DCE2DD] rounded-lg p-6 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-[#141D19]">
                Krok 4 z 4 · Ograniczenia analizy i niepewność wyników
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#5E6E65]">
                {result.limitations.length} aktywnych zdań
              </span>
            </div>
            <ul className="space-y-2.5 text-xs text-[#2B3A32] leading-relaxed list-disc pl-5">
              {result.limitations.map((lim) => (
                <li key={lim.id}>
                  <span className="font-semibold text-[#141D19]">{lim.kategoria}:</span>{' '}
                  {lim.zdanie_do_raportu}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
