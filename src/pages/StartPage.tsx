import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Flower2,
  HelpCircle,
  Leaf,
  Loader2,
  MapPin,
  Search,
  Sprout,
  Sun,
  Wheat
} from 'lucide-react';
import { CROPS_DATA } from '../data/crops';
import { ParcelMap } from '../components/ParcelMap';
import { MediaImage } from '../components/MediaImage';
import type { ParcelGeometryInfo } from '../types/analysis';

interface StartPageProps {
  onStartReport: (params: { parcelId: string; cropId: string; date: string }) => void;
}

const HERO_IMG = '/src/assets/images/hero_polish_farmland_1795286929676.jpg';
const GUIDE_AERIAL_IMG = '/src/assets/images/guide_satellite_fields_1795286930885.jpg';
const GUIDE_RETENTION_IMG = '/src/assets/images/guide_retention_landscape_1795286954147.jpg';
const GUIDE_SOIL_IMG = '/src/assets/images/guide_soil_mulch_1795286930150.jpg';

const CROP_PLAIN_WINDOW: Record<string, string> = {
  pszenica_ozima: 'Najwrażliwsza na suszę: maj – początek lipca',
  jeczmien_jary: 'Najwrażliwszy na suszę: druga połowa maja – początek lipca',
  rzepak_ozimy: 'Najwrażliwszy na suszę: kwiecień – połowa czerwca',
  kukurydza: 'Najwrażliwsza na suszę: lipiec – sierpień',
  ziemniak: 'Najwrażliwszy na suszę: połowa czerwca – koniec lipca',
  burak_cukrowy: 'Najwrażliwszy na suszę: połowa czerwca – koniec sierpnia',
  zyto_ozime: 'Najwrażliwsze na suszę: maj – koniec czerwca',
  lucerna: 'Ważna wilgoć przez cały sezon (kwiecień – wrzesień)'
};

function getTodayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTenYearsAgoIso(): string {
  const now = new Date();
  const y = now.getFullYear() - 10;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function CropIcon({ id }: { id: string }) {
  const cls = 'w-5 h-5 shrink-0';
  switch (id) {
    case 'pszenica_ozima':
    case 'jeczmien_jary':
    case 'zyto_ozime':
      return <Wheat className={cls} />;
    case 'rzepak_ozimy':
      return <Flower2 className={cls} />;
    case 'kukurydza':
      return <Sun className={cls} />;
    case 'ziemniak':
    case 'burak_cukrowy':
      return <Sprout className={cls} />;
    default:
      return <Leaf className={cls} />;
  }
}

export function StartPage({ onStartReport }: StartPageProps) {
  const todayIso = getTodayIsoLocal();
  const minDateIso = getTenYearsAgoIso();

  const [parcelMode, setParcelMode] = useState<'map' | 'id'>('map');
  const [terytInput, setTerytInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [foundParcel, setFoundParcel] = useState<ParcelGeometryInfo | null>(null);
  const [showNumberHelp, setShowNumberHelp] = useState(false);

  // Rule: no crop selected by default
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);

  const [analysisDate, setAnalysisDate] = useState(todayIso);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  async function lookupByTeryt(rawId: string) {
    const cleaned = rawId.trim();
    if (!cleaned) {
      setParcelError('Wpisz numer działki albo przełącz na zakładkę „Wskażę na mapie”.');
      return;
    }
    setLookingUp(true);
    setParcelError(null);
    try {
      const res = await fetch(`/api/parcel?id=${encodeURIComponent(cleaned)}`);
      const data = (await res.json()) as {
        ok: boolean;
        parcel?: ParcelGeometryInfo;
        error?: string;
      };
      if (!data.ok || !data.parcel) {
        setFoundParcel(null);
        setParcelError(
          data.error ||
            'Nie znaleziono działki o tym numerze. Sprawdź numer albo wskaż ją na mapie.'
        );
      } else {
        setFoundParcel(data.parcel);
        setTerytInput(data.parcel.id);
      }
    } catch {
      setParcelError('Serwer map nie odpowiada, spróbuj ponownie za chwilę.');
    } finally {
      setLookingUp(false);
    }
  }

  async function lookupByCoords(lat: number, lon: number) {
    setLookingUp(true);
    setParcelError(null);
    try {
      const res = await fetch(
        `/api/parcel?lat=${encodeURIComponent(lat.toFixed(6))}&lon=${encodeURIComponent(lon.toFixed(6))}`
      );
      const data = (await res.json()) as {
        ok: boolean;
        parcel?: ParcelGeometryInfo;
        error?: string;
      };
      if (!data.ok || !data.parcel) {
        setFoundParcel(null);
        setParcelError(
          data.error ||
            'Nie znaleziono działki w tym miejscu. Przybliż mapę i kliknij bezpośrednio w pole.'
        );
      } else {
        setFoundParcel(data.parcel);
        setTerytInput(data.parcel.id);
      }
    } catch {
      setParcelError('Serwer map nie odpowiada, spróbuj ponownie za chwilę.');
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setCropError(null);

    if (!selectedCropId) {
      setCropError('Wybierz uprawę z listy powyżej — dzięki temu dopasujemy wynik do Twoich roślin.');
      return;
    }

    if (foundParcel) {
      onStartReport({
        parcelId: foundParcel.id,
        cropId: selectedCropId,
        date: analysisDate
      });
      return;
    }

    const cleaned = terytInput.trim();
    if (!cleaned) {
      setParcelError('Najpierw wskaż swoje pole — wpisz numer działki albo kliknij ją na mapie.');
      return;
    }

    setLookingUp(true);
    setParcelError(null);
    try {
      const res = await fetch(`/api/parcel?id=${encodeURIComponent(cleaned)}`);
      const data = (await res.json()) as {
        ok: boolean;
        parcel?: ParcelGeometryInfo;
        error?: string;
      };
      if (!data.ok || !data.parcel) {
        setParcelError(
          data.error ||
            'Nie znaleziono działki o tym numerze. Sprawdź numer albo wskaż ją na mapie.'
        );
        return;
      }
      setFoundParcel(data.parcel);
      onStartReport({
        parcelId: data.parcel.id,
        cropId: selectedCropId,
        date: analysisDate
      });
    } catch {
      setParcelError('Serwer map nie odpowiada, spróbuj ponownie za chwilę.');
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Editorial Hero Banner */}
      <section className="relative rounded-2xl overflow-hidden border border-[#DCE2DD] bg-[#132A21]">
        <MediaImage
          src={HERO_IMG}
          alt="Polskie pola uprawne z pasem zadrzewień i małym oczkiem wodnym o poranku"
          fallbackLabel="Polski krajobraz rolniczy"
          className="w-full h-[290px] sm:h-[320px] lg:h-[360px] object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0D221A]/92 via-[#0D221A]/68 to-[#0D221A]/35"
        />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-10 text-white">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight text-balance">
              Sprawdź, czy na Twoim polu brakuje wody
            </h1>
            <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-xl">
              Wskaż działkę i uprawę. W kilkanaście sekund przygotujemy prosty raport z
              podpowiedziami, jak zatrzymać wodę w glebie i czy warto teraz podlewać.
            </p>
            <p className="text-xs text-white/75 pt-0.5">
              Bezpłatnie · Bez logowania · Zawsze aktualne dane pogodowe i satelitarne
            </p>
          </div>
        </div>
      </section>

      {/* Main 3-Step Farmer Form */}
      <form onSubmit={handleSubmit} className="max-w-[780px] mx-auto space-y-5">
        {/* STEP 1: Działka */}
        <section className="bg-white border border-[#DCE2DD] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#1B5E4A]">Krok 1 z 3</p>
              <h2 className="text-lg sm:text-xl font-bold text-[#141D19]">
                Gdzie znajduje się Twoje pole?
              </h2>
              <p className="text-xs sm:text-sm text-[#55665D]">
                Kliknij swoje pole bezpośrednio na mapie — albo wpisz numer działki, jeśli masz go pod ręką.
              </p>
            </div>

            <div className="inline-flex border border-[#DCE2DD] rounded-lg p-1 bg-[#F6F7F5] text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setParcelMode('map')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  parcelMode === 'map'
                    ? 'bg-white text-[#141D19] shadow-2xs'
                    : 'text-[#55665D] hover:text-[#141D19]'
                }`}
              >
                Wskaż na mapie
              </button>
              <button
                type="button"
                onClick={() => setParcelMode('id')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  parcelMode === 'id'
                    ? 'bg-white text-[#141D19] shadow-2xs'
                    : 'text-[#55665D] hover:text-[#141D19]'
                }`}
              >
                Mam numer
              </button>
            </div>
          </div>

          {parcelMode === 'id' ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1">
                  <label htmlFor="teryt-input" className="sr-only">
                    Numer działki
                  </label>
                  <input
                    id="teryt-input"
                    type="text"
                    value={terytInput}
                    onChange={(e) => {
                      setTerytInput(e.target.value);
                      if (foundParcel && e.target.value.trim() !== foundParcel.id) {
                        setFoundParcel(null);
                      }
                    }}
                    placeholder="np. 040704_2.0004.70/11"
                    className="w-full h-11 px-3.5 text-sm font-mono bg-[#FAFBFA] border border-[#CBD4CE] rounded-lg text-[#141D19] placeholder:font-sans placeholder:text-[#829189] focus:outline-none focus:border-[#1B5E4A] focus:bg-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={lookingUp}
                  onClick={() => lookupByTeryt(terytInput)}
                  className="h-11 px-5 rounded-lg bg-[#EDF2EE] hover:bg-[#DFE8E1] text-[#144B3A] font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {lookingUp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Znajdź działkę
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#55665D]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Chcesz tylko przetestować? Wybierz przykład:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTerytInput('040704_2.0004.70/11');
                      lookupByTeryt('040704_2.0004.70/11');
                    }}
                    className="font-semibold text-[#1B5E4A] hover:underline cursor-pointer"
                  >
                    Pole na Kujawach (Batkowo)
                  </button>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTerytInput('040701_1.0081.11/74');
                      lookupByTeryt('040701_1.0081.11/74');
                    }}
                    className="font-semibold text-[#1B5E4A] hover:underline cursor-pointer"
                  >
                    Działka miejska (Inowrocław)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNumberHelp((v) => !v)}
                  className="inline-flex items-center gap-1 text-[#55665D] hover:text-[#141D19] cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Gdzie znaleźć numer?
                </button>
              </div>

              {showNumberHelp && (
                <p className="text-xs text-[#3F4E46] bg-[#F6F7F5] border border-[#E2E7E3] rounded-lg p-3 leading-relaxed">
                  Pełny numer działki (np. <span className="font-mono">040704_2.0004.70/11</span>)
                  znajdziesz w e-Wniosku o dopłaty ARiMR, nakazie podatkowym z gminy lub na
                  Geoportalu. Jeśli nie masz go pod ręką, kliknij wyżej{' '}
                  <strong>„Wskażę na mapie”</strong> — wtedy wystarczy kliknąć swoje pole.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <ParcelMap
                parcel={foundParcel}
                interactive
                onSelectPoint={lookupByCoords}
                heightClass="h-[360px] sm:h-[400px]"
              />
              {lookingUp && (
                <p className="text-xs text-[#1B5E4A] inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Szukamy granic tej działki na mapie ewidencyjnej…
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#55665D]">
                <span>Szybki przykład na mapie:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTerytInput('040704_2.0004.70/11');
                    lookupByTeryt('040704_2.0004.70/11');
                  }}
                  className="font-semibold text-[#1B5E4A] hover:underline cursor-pointer"
                >
                  Pole na Kujawach (Batkowo)
                </button>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setTerytInput('040701_1.0081.11/74');
                    lookupByTeryt('040701_1.0081.11/74');
                  }}
                  className="font-semibold text-[#1B5E4A] hover:underline cursor-pointer"
                >
                  Działka miejska (Inowrocław)
                </button>
              </div>
            </div>
          )}

          {parcelError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#991B1B] flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{parcelError}</span>
            </div>
          )}

          {foundParcel && (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-lg bg-[#F0F7F3] border border-[#BFE0CE] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#1B5E4A] shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-[#141D19]">{foundParcel.label}</p>
                    <p className="text-xs text-[#4A5A52] tabular-nums">
                      Numer: <span className="font-mono">{foundParcel.id}</span>
                      {foundParcel.voivodeship ? ` · woj. ${foundParcel.voivodeship}` : ''}
                      {foundParcel.approxAreaHa !== null
                        ? ` · powierzchnia ok. ${foundParcel.approxAreaHa.toFixed(2)} ha`
                        : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#1B5E4A] inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Znaleziono działkę
                </span>
              </div>

              {parcelMode === 'id' && (
                <ParcelMap
                  parcel={foundParcel}
                  interactive={false}
                  initialBaseLayer="ortho"
                  heightClass="h-[220px]"
                />
              )}
            </div>
          )}
        </section>

        {/* STEP 2: Uprawa */}
        <section className="bg-white border border-[#DCE2DD] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-[#1B5E4A]">Krok 2 z 3</p>
            <h2 className="text-lg sm:text-xl font-bold text-[#141D19]">
              Co rośnie na tym polu?
            </h2>
            <p className="text-xs sm:text-sm text-[#55665D]">
              Każda roślina ma inną głębokość korzeni i w innym miesiącu najbardziej potrzebuje
              deszczu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CROPS_DATA.map((crop) => {
              const selected = selectedCropId === crop.id;
              return (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => {
                    setSelectedCropId(crop.id);
                    setCropError(null);
                  }}
                  aria-pressed={selected}
                  className={`text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5E4A] ${
                    selected
                      ? 'border-[#1B5E4A] bg-[#F0F7F3] text-[#141D19]'
                      : 'border-[#DCE2DD] bg-[#FAFBFA] hover:border-[#B5C4BB] hover:bg-white text-[#141D19]'
                  }`}
                >
                  <span
                    className={`mt-0.5 ${selected ? 'text-[#1B5E4A]' : 'text-[#5A6961]'}`}
                    aria-hidden="true"
                  >
                    <CropIcon id={crop.id} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug">
                      {crop.nazwa_pl}
                    </span>
                    <span className="block text-xs text-[#55665D] mt-0.5 leading-snug">
                      {CROP_PLAIN_WINDOW[crop.id] ?? crop.okno_krytyczne_opis}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {cropError && (
            <p role="alert" className="text-sm text-[#991B1B] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {cropError}
            </p>
          )}
        </section>

        {/* STEP 3: Data analizy */}
        <section className="bg-white border border-[#DCE2DD] rounded-xl p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#1B5E4A]">Krok 3 z 3</p>
              <h2 className="text-lg sm:text-xl font-bold text-[#141D19]">
                Na jaki dzień sprawdzić pole?
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setDatePickerOpen((v) => !v)}
              className="text-sm font-semibold text-[#1B5E4A] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              {datePickerOpen ? 'Ukryj kalendarz' : 'Zmień datę'}
            </button>
          </div>

          <p className="text-sm text-[#3F4E46] tabular-nums">
            Sprawdzamy na dzień:{' '}
            <strong className="font-semibold text-[#141D19]">
              {analysisDate === todayIso ? `Dziś (${analysisDate})` : analysisDate}
            </strong>
            <span className="block text-xs text-[#5E6D65] mt-1">
              Domyślnie sprawdzamy stan na dziś. Możesz też cofnąć się do dowolnego dnia z ostatnich
              10 lat, aby zobaczyć, jak pole radziło sobie w suchsze lata.
            </span>
          </p>

          {datePickerOpen && (
            <div className="pt-3 space-y-3 border-t border-[#E6EBE7]">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="analysis-date-input" className="text-xs font-medium text-[#4A5A52]">
                  Wybierz datę (ostatnie 10 lat):
                </label>
                <input
                  id="analysis-date-input"
                  type="date"
                  min={minDateIso}
                  max={todayIso}
                  value={analysisDate}
                  onChange={(e) => {
                    if (e.target.value) setAnalysisDate(e.target.value);
                  }}
                  className="h-10 px-3 text-sm font-mono bg-[#FAFBFA] border border-[#CBD4CE] rounded-lg text-[#141D19] focus:outline-none focus:border-[#1B5E4A]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#5E6D65]">
                <span>Szybki wybór (szczyt sezonu):</span>
                {[
                  { date: '2024-06-20', label: 'Lato 2024 (20.06)' },
                  { date: '2022-06-15', label: 'Suche lato 2022 (15.06)' },
                  { date: '2019-06-25', label: 'Susza 2019 (25.06)' },
                  { date: todayIso, label: 'Dzisiaj' }
                ].map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    onClick={() => setAnalysisDate(item.date)}
                    className={`hover:underline cursor-pointer ${
                      analysisDate === item.date
                        ? 'font-bold text-[#141D19]'
                        : 'font-medium text-[#1B5E4A]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Submit CTA */}
        <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-[#55665D]">
            Przygotowanie pełnego raportu trwa zwykle kilkanaście sekund.
          </p>
          <button
            type="submit"
            disabled={lookingUp}
            className="w-full sm:w-auto h-12 px-7 rounded-xl bg-[#1B5E4A] hover:bg-[#144B3A] text-white font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5E4A]"
          >
            Sprawdź moją wodę
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Plain-Language Visual Guide: How Water Buddy Works */}
      <section className="max-w-[1040px] mx-auto pt-4 space-y-5">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#141D19]">
            Co dokładnie sprawdzamy i dlaczego w takiej kolejności?
          </h2>
          <p className="text-sm text-[#55665D] leading-relaxed">
            Zamiast zasypywać Cię trudnymi wykresami, pokazujemy prosto: czy brakuje wody, skąd ten
            problem wynika i co daje najlepszy efekt na Twoim polu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <article className="bg-white border border-[#DCE2DD] rounded-xl overflow-hidden flex flex-col">
            <MediaImage
              src={GUIDE_AERIAL_IMG}
              alt="Widok z góry na polskie pola uprawne, granice działek i ciek wodny"
              fallbackLabel="Analiza działki z map i satelity"
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="p-5 space-y-1.5 flex-1">
              <h3 className="text-base font-bold text-[#141D19]">
                01. Sprawdzamy Twoje pole i 10 lat pogody
              </h3>
              <p className="text-sm text-[#4A5A52] leading-relaxed">
                Porównujemy opady i parowanie z ostatnich tygodni z poprzednimi 10 latami. Patrzymy
                też na zdjęcia satelitarne, nachylenie terenu oraz rodzaj gleby.
              </p>
            </div>
          </article>

          <article className="bg-white border border-[#DCE2DD] rounded-xl overflow-hidden flex flex-col">
            <MediaImage
              src={GUIDE_RETENTION_IMG}
              alt="Pas zieleni z krzewami, drzewami i małym oczkiem wodnym przy skraju pola"
              fallbackLabel="Retencja wody w krajobrazie"
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="p-5 space-y-1.5 flex-1">
              <h3 className="text-base font-bold text-[#141D19]">
                02. Najpierw zatrzymujemy wodę wokół pola
              </h3>
              <p className="text-sm text-[#4A5A52] leading-relaxed">
                Podpowiadamy naturalne sposoby na spowolnienie odpływu deszczu: pasy trawiaste na
                skłonach, zadrzewienia chroniące przed wiatrem, zastawki na rowach czy oczka wodne.
              </p>
            </div>
          </article>

          <article className="bg-white border border-[#DCE2DD] rounded-xl overflow-hidden flex flex-col">
            <MediaImage
              src={GUIDE_SOIL_IMG}
              alt="Żyzna wilgotna gleba osłonięta mulczem ze słomy z młodymi wschodami zboża"
              fallbackLabel="Ochrona wilgoci w glebie"
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="p-5 space-y-1.5 flex-1">
              <h3 className="text-base font-bold text-[#141D19]">
                03. Ochrona wilgoci w glebie i podlewanie
              </h3>
              <p className="text-sm text-[#4A5A52] leading-relaxed">
                Pokazujemy proste zabiegi ograniczające wysychanie (mulcz, międzyplony, mniej orki),
                a dopiero na końcu odpowiadamy wprost: czy podlewanie ma teraz sens i jaką dawką.
              </p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
