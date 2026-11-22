import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  Copy,
  Droplets,
  FileDown,
  Info,
  ListChecks,
  Loader2,
  Minus,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Sun,
  Trees
} from 'lucide-react';
import type { AnalyzeApiResponse, LoadingStepKey, LoadingStepState } from '../types/analysis';
import type { RecommendationRule } from '../data/rules';
import { LIMITATIONS_DATA } from '../data/limitations';
import { describeDitchRadius } from '../engine/waterBrain';
import {
  findOdrForVoivodeship,
  RULE_SUPPORT_HINTS,
  SUPPORT_DISCLAIMER_PL
} from '../data/supportPrograms';
import { ParcelMap } from '../components/ParcelMap';
import { MediaImage } from '../components/MediaImage';
import {
  KbwCumulativeChart,
  KbwTenYearBarsChart,
  NdviSeasonChart
} from '../components/ReportCharts';

interface ReportPageProps {
  queryString: string;
  onGoHome: () => void;
}

const GUIDE_RETENTION_IMG = '/src/assets/images/guide_retention_landscape_1795286954147.jpg';
const GUIDE_SOIL_IMG = '/src/assets/images/guide_soil_mulch_1795286930150.jpg';

const INITIAL_STEPS: LoadingStepState[] = [
  {
    key: 'parcel_terrain',
    label: 'Szukamy granic działki i nachylenia terenu',
    sourceHint: 'mapa ewidencyjna i wysokościowa',
    status: 'pending'
  },
  {
    key: 'meteo',
    label: 'Sprawdzamy opady i temperatury z 10 lat',
    sourceHint: 'archiwum pogodowe',
    status: 'pending'
  },
  {
    key: 'satellite',
    label: 'Oglądamy najnowsze zdjęcia satelitarne pola',
    sourceHint: 'satelita Sentinel-2',
    status: 'pending'
  },
  {
    key: 'soil_protected',
    label: 'Sprawdzamy rodzaj gleby i obszary chronione',
    sourceHint: 'mapy glebowe i Natura 2000',
    status: 'pending'
  },
  {
    key: 'hydro',
    label: 'Sprawdzamy pobliskie rowy i rodzaj gruntu',
    sourceHint: 'mapy hydrograficzne',
    status: 'pending'
  }
];

const FRIENDLY_STEP_LABELS: Record<LoadingStepKey, { label: string; hint: string }> = {
  parcel_terrain: {
    label: 'Szukamy granic działki i nachylenia terenu',
    hint: 'mapa ewidencyjna i wysokościowa'
  },
  meteo: {
    label: 'Sprawdzamy opady i temperatury z 10 lat',
    hint: 'archiwum pogodowe'
  },
  satellite: {
    label: 'Oglądamy najnowsze zdjęcia satelitarne pola',
    hint: 'satelita Sentinel-2'
  },
  soil_protected: {
    label: 'Sprawdzamy rodzaj gleby i obszary chronione',
    hint: 'mapy glebowe i Natura 2000'
  },
  hydro: {
    label: 'Sprawdzamy pobliskie rowy i rodzaj gruntu',
    hint: 'mapy hydrograficzne'
  }
};

function getWaterManagementStyle(level: string): {
  bg: string;
  border: string;
  text: string;
  barBg: string;
} {
  switch (level) {
    case 'krytyczna':
      return {
        bg: 'bg-[#FEF2F2]',
        border: 'border-[#FCA5A5]',
        text: 'text-[#991B1B]',
        barBg: 'bg-[#DC2626]'
      };
    case 'podwyzszone_ryzyko':
      return {
        bg: 'bg-[#FFF7ED]',
        border: 'border-[#FDBA74]',
        text: 'text-[#9A3412]',
        barBg: 'bg-[#EA580C]'
      };
    case 'wymaga_uwagi':
      return {
        bg: 'bg-[#FEFCE8]',
        border: 'border-[#FDE047]',
        text: 'text-[#854D0E]',
        barBg: 'bg-[#CA8A04]'
      };
    case 'poza_rolnictwem':
      return {
        bg: 'bg-[#F6F7F5]',
        border: 'border-[#CBD4CE]',
        text: 'text-[#3F4E46]',
        barBg: 'bg-[#64748B]'
      };
    default:
      return {
        bg: 'bg-[#F0FDF4]',
        border: 'border-[#86EFAC]',
        text: 'text-[#166534]',
        barBg: 'bg-[#16A34A]'
      };
  }
}

interface IndicatorTileStyle {
  bg: string;
  border: string;
  accent: string;
  text: string;
}

// Susza rolnicza (IUNG) — ciepła paleta: czerwień = susza, zieleń = brak suszy
function getDroughtTileStyle(drought: boolean | null | undefined): IndicatorTileStyle {
  if (drought === true) {
    return {
      bg: 'bg-[#FEE2E2]',
      border: 'border-[#F87171]',
      accent: 'border-l-[#DC2626]',
      text: 'text-[#991B1B]'
    };
  }
  if (drought === false) {
    return {
      bg: 'bg-[#ECFDF3]',
      border: 'border-[#86D1A6]',
      accent: 'border-l-[#16A34A]',
      text: 'text-[#166534]'
    };
  }
  return {
    bg: 'bg-[#F6F7F5]',
    border: 'border-[#CBD4CE]',
    accent: 'border-l-[#94A3B8]',
    text: 'text-[#3F4E46]'
  };
}

// Anomalia opadów (EDO) — chłodna paleta indygo, coraz ciemniejsza z poziomem anomalii
function getAnomalyTileStyle(level: string | null): IndicatorTileStyle {
  switch (level) {
    case 'alarm':
      return {
        bg: 'bg-[#EDE9FE]',
        border: 'border-[#A78BFA]',
        accent: 'border-l-[#6D28D9]',
        text: 'text-[#4C1D95]'
      };
    case 'ostrzezenie':
      return {
        bg: 'bg-[#E0E7FF]',
        border: 'border-[#A5B4FC]',
        accent: 'border-l-[#4338CA]',
        text: 'text-[#312E81]'
      };
    case 'obserwacja':
      return {
        bg: 'bg-[#EEF2FF]',
        border: 'border-[#C7D2FE]',
        accent: 'border-l-[#6366F1]',
        text: 'text-[#3730A3]'
      };
    case 'brak':
      return {
        bg: 'bg-[#F1F5F9]',
        border: 'border-[#CBD5E1]',
        accent: 'border-l-[#64748B]',
        text: 'text-[#334155]'
      };
    default:
      return {
        bg: 'bg-[#F6F7F5]',
        border: 'border-[#CBD4CE]',
        accent: 'border-l-[#94A3B8]',
        text: 'text-[#3F4E46]'
      };
  }
}

const WM_LEVEL_LABELS: Record<string, string> = {
  krytyczna: 'trudna sytuacja',
  podwyzszone_ryzyko: 'podwyższone ryzyko',
  wymaga_uwagi: 'wymaga uwagi',
  stabilna: 'stabilna',
  poza_rolnictwem: 'poza rolnictwem'
};

// Neutralne tytuły kart przyczyn: "Słaba retencja gleby — bez problemu" brzmiało sprzecznie
const CAUSE_CARD_TITLES: Record<string, string> = {
  'Opad i upał': 'Opady i parowanie',
  'Słaba retencja gleby': 'Retencja gleby',
  'Spływ powierzchniowy': 'Odpływ wody z pola',
  'Wrażliwa uprawa': 'Wrażliwość uprawy'
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getEdoAnomalyLabel(level: string): string {
  switch (level) {
    case 'alarm':
      return 'Silna anomalia: opady, gleba i rośliny';
    case 'ostrzezenie':
      return 'Wyraźnie mniej deszczu niż zwykle';
    case 'obserwacja':
      return 'Mniej deszczu niż zwykle';
    default:
      return 'Opady w normie';
  }
}


function buildMatchedConditionPl(rule: RecommendationRule, data: AnalyzeApiResponse): string {
  const inp = data.rawInput;
  switch (rule.id) {
    case 'R04_STOK_BEZ_OKRYWY_KBW':
      return `Nachylenie terenu wynosi ${inp.slopePct.toFixed(1)}%, gleba nie jest osłonięta roślinnością, a parowanie przewyższa opady (${inp.kbwMm} mm).`;
    case 'R05_ROW_MELIORACYJNY_ZASTAWKA':
      return `${capitalize(describeDitchRadius(inp.ditchDistanceM))} znajduje się rów melioracyjny lub ciek (BDOT10k), a bilans wody jest ujemny (${inp.kbwMm} mm).`;
    case 'R06_ZAGLEBIENIE_OCZKO_WODNE':
      return `Na działce widać naturalne zagłębienie terenu, a w ${inp.dryYearsLast10} z ostatnich 10 lat było tu sucho.`;
    case 'R07_ZADRZEWIENIA_WIATROCHRONNE':
      return `W ${inp.dryYearsLast10} z ostatnich 10 lat w tym miejscu występowały susze — to obszar szczególnie narażony na wysuszający wiatr.`;
    case 'R08_GLEBA_LEKKA_MATERIA_ORGANICZNA':
      return `Gleba jest lekka (${data.result.soil.grupa_uziarnienia} — zatrzymuje ok. ${data.result.soil.woda_dostepna_50cm_mm} mm wody) przy ujemnym bilansie opadów (${inp.kbwMm} mm).`;
    case 'R09_MULCZ_RESZTKI_POZNIWNE':
      return `Gleba na polu jest w większości odkryta, a parowanie wyraźnie przewyższa opady (${inp.kbwMm} mm).`;
    case 'R10_UPRAWA_KONSERWUJACA_BEZ_ORKI':
      return `Parowanie z pola przewyższa opady z ostatnich 60 dni (${inp.kbwMm} mm) — każda głęboka orka dodatkowo przesusza glebę.`;
    case 'R11_GLEBOSZOWANIE_GLEBA_CIEZKA':
      return `Gleba gliniasta lub pyłowa (${data.result.soil.grupa_uziarnienia}) przy obniżonej wilgotności, spadku ${inp.slopePct.toFixed(1)}% lub ryzyku zastoin.`;
    case 'R12_UPRAWA_OKNO_KRYTYCZNE_OCHRONA':
      return `${data.result.crop.nazwa_pl} znajduje się teraz w okresie największego zapotrzebowania na wodę, przy ujemnym bilansie (${inp.kbwMm} mm).`;
    case 'R15_NDMI_STRES_UKRYTY':
      return `Rośliny z satelity są jeszcze zielone, ale wskaźnik uwodnienia liści spadł poniżej zera (wczesny sygnał stresu).`;
    case 'R17_ODPLYW_JESIEN_ZIMA_ROW':
      return `${capitalize(describeDitchRadius(inp.ditchDistanceM))} wykryto rów melioracyjny lub ciek (BDOT10k) — w okresie odbudowy wilgoci warto pilnować, by nie odwadniał pola zbyt szybko.`;
    case 'R18_ZASTOINY_NADMIAR_WODY':
      return `Bilans opadów jest mocno dodatni (+${inp.kbwMm} mm), a gleba (${data.result.soil.grupa_uziarnienia}) lub zagłębienie terenu sprzyjają okresowemu podmoknięciu.`;
    case 'R19_OKRYWA_ZIMOWA_ODBUDOWA':
      return `Brak gęstej okrywy roślinnej (lub goła gleba po sezonie) — bez okrywy deszcz częściej spływa po powierzchni zamiast wsiąkać w profil.`;
    case 'R20_RETENCJA_PROCHNICA_WIELOLETNIA':
      return `Gleba (${data.result.soil.grupa_uziarnienia}, ok. ${data.result.soil.woda_dostepna_50cm_mm} mm wody dostępnej) lub ${inp.dryYearsLast10} suchych lat w ostatnim 10-leciu wymagają stałego wzmacniania próchnicy.`;
    default:
      return rule.warunek_czytelny;
  }
}

function getCardBorderClass(rule: RecommendationRule): string {
  // Subtle, calm 1px tinted borders to distinguish urgent runoff/melioration warnings from general practices
  if (
    ['R04_STOK_BEZ_OKRYWY_KBW', 'R05_ROW_MELIORACYJNY_ZASTAWKA', 'R17_ODPLYW_JESIEN_ZIMA_ROW', 'R18_ZASTOINY_NADMIAR_WODY', 'R12_UPRAWA_OKNO_KRYTYCZNE_OCHRONA', 'R15_NDMI_STRES_UKRYTY'].includes(
      rule.id
    )
  ) {
    return 'border-[#E8C98F] bg-[#FFFEFA]';
  }
  if (rule.kolejnosc_kowr === 2) {
    return 'border-[#C6DDD0] bg-white';
  }
  return 'border-[#D5E1DA] bg-white';
}

function RecommendationCard({
  rule,
  data
}: {
  rule: RecommendationRule;
  data: AnalyzeApiResponse;
}) {
  return (
    <article
      id={`rec-${rule.id}`}
      className={`border rounded-xl p-4 sm:p-5 space-y-3 scroll-mt-20 ${getCardBorderClass(rule)}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-[#141D19] leading-snug">{rule.tytul}</h3>
        <span className="text-xs font-medium text-[#5A6961]">{rule.przyczyna}</span>
      </div>

      <p className="text-sm text-[#24322B] leading-relaxed">{rule.tekst_dla_rolnika}</p>

      <p className="text-xs text-[#4A5A52] bg-[#F6F7F5] px-3.5 py-2.5 rounded-lg leading-relaxed tabular-nums">
        <span className="font-semibold text-[#141D19]">Dlaczego widzisz tę podpowiedź:</span>{' '}
        {buildMatchedConditionPl(rule, data)}
      </p>

      {RULE_SUPPORT_HINTS[rule.id] && (
        <p className="text-xs text-[#4A3B0B] bg-[#FFFBEB] border border-[#F2DFA7] px-3.5 py-2.5 rounded-lg leading-relaxed">
          <span className="font-semibold">Wsparcie finansowe / formalności:</span>{' '}
          {RULE_SUPPORT_HINTS[rule.id].programPl} {SUPPORT_DISCLAIMER_PL}
        </p>
      )}

      <details className="report-details group text-xs text-[#4A5A52]">
        <summary className="list-none inline-flex items-center gap-1.5 font-semibold text-[#1B5E4A] hover:underline cursor-pointer select-none">
          <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
          Więcej informacji (uzasadnienie naukowe i źródło)
        </summary>
        <div className="mt-2 pl-5 space-y-1 text-[#3F4E46] leading-relaxed">
          <p>{rule.uzasadnienie_naukowe}</p>
          <p className="text-[#617068]">
            <span className="font-medium">Źródło:</span> {rule.zrodlo}
          </p>
        </div>
      </details>
    </article>
  );
}

export function ReportPage({ queryString, onGoHome }: ReportPageProps) {
  const [steps, setSteps] = useState<LoadingStepState[]>(INITIAL_STEPS);
  const [report, setReport] = useState<AnalyzeApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [copied, setCopied] = useState(false);

  // Zwinięte <details> (wykresy z 10 lat, uzasadnienia) nie drukują się, a CSS nie umie ich
  // otworzyć — rozwijamy je na czas druku / zapisu PDF i przywracamy stan po wydruku.
  useEffect(() => {
    let reopened: HTMLDetailsElement[] = [];
    const openAll = () => {
      reopened = Array.from(document.querySelectorAll('details')).filter((d) => !d.open);
      reopened.forEach((d) => (d.open = true));
    };
    const restore = () => {
      reopened.forEach((d) => (d.open = false));
      reopened = [];
    };
    window.addEventListener('beforeprint', openAll);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', openAll);
      window.removeEventListener('afterprint', restore);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const id = params.get('id');
    const lat = params.get('lat');
    const lon = params.get('lon');
    const crop = params.get('uprawa') || params.get('crop') || 'pszenica_ozima';
    const date = params.get('data') || params.get('date') || '';

    if (!id && (!lat || !lon)) {
      setErrorMsg('Brak wybranej działki. Wróć na stronę główną i wskaż swoje pole.');
      return;
    }

    setReport(null);
    setErrorMsg(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', detail: undefined })));
    setElapsedSec(0);

    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    const apiParams = new URLSearchParams();
    if (id) apiParams.set('id', id);
    if (lat && lon) {
      apiParams.set('lat', lat);
      apiParams.set('lon', lon);
    }
    apiParams.set('crop', crop);
    if (date) apiParams.set('date', date);

    let finished = false;
    let fallbackStarted = false;
    const es = new EventSource(`/api/analyze-stream?${apiParams.toString()}`);

    const updateStep = (incoming: LoadingStepState) => {
      const key = incoming.key as LoadingStepKey;
      const friendly = FRIENDLY_STEP_LABELS[key];
      setSteps((prev) =>
        prev.map((s) =>
          s.key === key
            ? {
                ...s,
                status: incoming.status,
                label: friendly?.label ?? incoming.label,
                sourceHint: friendly?.hint ?? incoming.sourceHint,
                detail: incoming.detail,
                durationMs: incoming.durationMs
              }
            : s
        )
      );
    };

    es.addEventListener('step', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as LoadingStepState;
        updateStep(parsed);
      } catch {
        // Ignore malformed frame
      }
    });

    es.addEventListener('result', (ev) => {
      finished = true;
      es.close();
      clearInterval(timer);
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as AnalyzeApiResponse;
        setReport(parsed);
      } catch {
        setErrorMsg('Nie udało się odczytać wyników analizy. Spróbuj ponownie.');
      }
    });

    es.addEventListener('analysis_error', (ev) => {
      finished = true;
      es.close();
      clearInterval(timer);
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as { error?: string };
        setErrorMsg(parsed.error || 'Nie udało się pobrać danych dla tej działki.');
      } catch {
        setErrorMsg('Nie udało się pobrać danych dla tej działki.');
      }
    });

    es.onerror = () => {
      if (finished || fallbackStarted) return;
      fallbackStarted = true;
      es.close();
      fetch(`/api/analyze?${apiParams.toString()}`)
        .then((r) => r.json())
        .then((data: AnalyzeApiResponse & { ok: boolean; error?: string }) => {
          finished = true;
          clearInterval(timer);
          if (data.ok) {
            setReport(data);
          } else {
            setErrorMsg(data.error || 'Nie udało się przygotować raportu dla tej działki.');
          }
        })
        .catch(() => {
          finished = true;
          clearInterval(timer);
          setErrorMsg('Serwer chwilowo nie odpowiada. Spróbuj ponownie za moment.');
        });
    };

    return () => {
      finished = true;
      es.close();
      clearInterval(timer);
    };
  }, [queryString]);

  function handleCopyLink() {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  // Error view
  if (errorMsg) {
    return (
      <div className="max-w-[760px] mx-auto bg-white border border-[#FECACA] rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3 text-[#991B1B]">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Nie udało się przygotować raportu</h1>
            <p className="text-sm">{errorMsg}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoHome}
          className="px-4 py-2 rounded-lg bg-[#1B5E4A] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#144B3A] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Wróć do wyboru działki
        </button>
      </div>
    );
  }

  // Friendly live loading screen
  if (!report) {
    return (
      <div className="max-w-[760px] mx-auto bg-white border border-[#DCE2DD] rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[#141D19]">
              Przygotowujemy raport dla Twojego pola…
            </h1>
            <p className="text-sm text-[#55665D] mt-1">
              Sprawdzamy na żywo aktualną pogodę, zdjęcia satelitarne i mapy gleby. Zwykle trwa to
              10–15 sekund.
            </p>
          </div>
          <span className="font-mono text-sm font-semibold text-[#1B5E4A] tabular-nums">
            {elapsedSec} s
          </span>
        </div>

        <ol className="divide-y divide-[#E6EBE7] border border-[#E6EBE7] rounded-lg overflow-hidden">
          {steps.map((step) => (
            <li
              key={step.key}
              className="px-4 py-3.5 flex items-center justify-between gap-4 bg-white"
            >
              <div className="flex items-center gap-3 min-w-0">
                {step.status === 'ok' && (
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                )}
                {step.status === 'running' && (
                  <Loader2 className="w-4 h-4 text-[#1B5E4A] animate-spin shrink-0" />
                )}
                {step.status === 'pending' && (
                  <Minus className="w-4 h-4 text-[#94A19A] shrink-0" />
                )}
                {(step.status === 'fallback' || step.status === 'error') && (
                  <Info className="w-4 h-4 text-[#78716C] shrink-0" />
                )}

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#141D19]">{step.label}</p>
                  <p className="text-xs text-[#617068] truncate">
                    {step.detail ? step.detail : step.sourceHint}
                  </p>
                </div>
              </div>

              <span className="text-xs font-medium shrink-0 text-[#55665D]">
                {step.status === 'ok'
                  ? 'Gotowe'
                  : step.status === 'running'
                    ? 'Sprawdzanie…'
                    : step.status === 'fallback'
                      ? 'Brak danych'
                      : 'Za chwilę'}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // --- Full Farmer & Jury Report (4.1 - 4.9) ---
  const { result, parcel, inputs, series, sources } = report;
  const wm = result.waterManagement;
  const wmStyle = getWaterManagementStyle(wm.level);
  const raw = report.rawInput;
  const odrName = findOdrForVoivodeship(parcel.voivodeship);
  const analysisMmDd = report.analysisDate.slice(5, 10);
  const outsideIungSeason = analysisMmDd < '05-20' || analysisMmDd > '10-10';
  const droughtStyle = getDroughtTileStyle(
    result.meteoAvailable === false ? null : raw.iungDrought
  );
  const anomalyStyle = getAnomalyTileStyle(
    result.meteoAvailable === false ? null : result.edoLevel.poziom
  );
  const isNonArable = report.rawInput.landUse !== 'arable';
  const generatedFormatted = new Date(report.generatedAt).toLocaleString('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  const quickActions: RecommendationRule[] = [
    ...result.landscapeRetention,
    ...result.agrotechnics,
    ...(result.irrigationCalc.uzasadnione ? result.irrigationRules : [])
  ].slice(0, 3);

  const lim08 = LIMITATIONS_DATA.find((l) => l.id === 'LIM_08_NAWADNIANIE_POZWOLENIA');

  const { taw_mm, raw_mm, aktualny_deficyt_mm } = result.irrigationCalc;
  const irrigationAssessed = result.irrigationCalc.ocena_mozliwa !== false;
  const rawPct = taw_mm > 0 ? Math.min(100, Math.round((raw_mm / taw_mm) * 100)) : 50;
  const deficitPct =
    taw_mm > 0 ? Math.min(100, Math.round((aktualny_deficyt_mm / taw_mm) * 100)) : 0;

  // Plain-language 3-tile overview metrics
  // Jedna główna liczba KBW: okres IUNG (porównywalny z progiem suszy), a gdy go brak — 60 dni
  const kbwFromIung = typeof report.rawInput.iungKbwMm === 'number';
  const kbwVal = kbwFromIung ? (report.rawInput.iungKbwMm as number) : report.rawInput.kbwMm;
  const kbwExplain =
    kbwVal < -100
      ? 'Duża przewaga parowania nad deszczem'
      : kbwVal < -40
        ? 'Parowanie przewyższa opady'
        : kbwVal <= 30
          ? 'Opady równoważą parowanie'
          : 'Przewaga opadów nad parowaniem';

  const smaAvailable = inputs.sma?.status === 'ok';
  const smaVal = report.rawInput.sma;
  const soilMoistureText = !smaAvailable
    ? 'Brak odczytu'
    : smaVal < -1.0
      ? 'Suchsza niż zwykle'
      : smaVal < -0.3
        ? 'Lekko poniżej normy'
        : smaVal > 1.0
          ? 'Wilgotniejsza niż zwykle'
          : 'W normie';

  const ndviVal = report.rawInput.ndvi;
  const ndviCrop = result.ndviCropAssessment;
  const ndviSummaryText =
    ndviVal === null
      ? 'Brak zdjęcia'
      : ndviCrop?.status === 'typowa'
        ? `Typowa dla uprawy (${ndviVal.toFixed(2)})`
        : ndviCrop?.status === 'ponizej'
          ? `Nieco poniżej typowej (${ndviVal.toFixed(2)})`
          : ndviCrop?.status === 'wyraznie_ponizej'
            ? `Wyraźnie poniżej typowej (${ndviVal.toFixed(2)})`
            : ndviVal >= 0.6
        ? `Gęsta zieleń (${ndviVal.toFixed(2)})`
        : ndviVal >= 0.4
          ? `Umiarkowana (${ndviVal.toFixed(2)})`
          : ndviVal >= 0.2
            ? `Słaba okrywa (${ndviVal.toFixed(2)})`
            : `Gleba odkryta (${ndviVal.toFixed(2)})`;

  return (
    <div className="max-w-[780px] mx-auto space-y-7">
      {/* Top return button */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#55665D] print:hidden">
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-1.5 font-semibold text-[#1B5E4A] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Zmień działkę, uprawę lub datę
        </button>
        <span className="text-[#617068]">Dane obliczone na żywo</span>
      </div>

      {/* 4.1 NAGŁÓWEK — prosty i czytelny od pierwszego spojrzenia */}
      <section className="bg-white border border-[#DCE2DD] rounded-xl p-5 sm:p-6 space-y-5">
        {/* Verification alerts ABOVE status */}
        {result.verificationAlerts.length > 0 && (
          <div className="space-y-2">
            {result.verificationAlerts.map((alert) => (
              <div
                key={alert.id}
                role="status"
                className="p-3.5 rounded-lg bg-[#FFFBEB] border border-[#E6C36A] text-[#713F12] text-sm flex items-start gap-2.5"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#B45309]" />
                <div className="space-y-0.5">
                  <p className="font-bold">{alert.tytul}</p>
                  <p className="text-xs leading-relaxed text-[#713F12]">{alert.tekst_dla_rolnika}</p>
                  {alert.id === 'R16_CHMURY_BRAK_SATELITY' && inputs.ndvi?.status !== 'ok' && (
                    <p className="text-xs leading-relaxed text-[#713F12]">
                      Przyczyna: {inputs.ndvi?.displayValue}.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parcel + Crop + Dates */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#141D19]">
            {parcel.label}
          </h1>
          <p className="text-xs sm:text-sm text-[#4A5A52] tabular-nums">
            <span className="font-semibold text-[#141D19]">{result.crop.nazwa_pl}</span>
            {' · '}Stan na dzień: <strong className="font-mono">{report.analysisDate}</strong>
            {parcel.approxAreaHa !== null ? ` · ok. ${parcel.approxAreaHa.toFixed(2)} ha` : ''}
            {' · '}Przygotowano: {generatedFormatted}
          </p>
        </div>

        {/* Holistic Water Management Status Card */}
        <div className={`rounded-xl border ${wmStyle.border} ${wmStyle.bg} overflow-hidden`}>
          <div className={`h-2 w-full ${wmStyle.barBg}`} aria-hidden="true" />
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={`text-sm sm:text-base font-bold ${wmStyle.text}`}>
                {wm.headlinePl}
              </p>
              {/* Klasa oceny + liczba czynników zamiast punktów 0–100 (suma wag ustalonych
                  ręcznie dawałaby pozorną precyzję) */}
              {!isNonArable && (
                <span className="text-xs font-medium text-[#4A5A52]">
                  Ocena: <strong className="text-[#141D19]">{WM_LEVEL_LABELS[wm.level] ?? wm.level}</strong>
                  {' · '}
                  {wm.keyRisksPl.length === 0
                    ? 'bez istotnych czynników ryzyka'
                    : `${wm.keyRisksPl.length} ${wm.keyRisksPl.length === 1 ? 'czynnik' : wm.keyRisksPl.length < 5 ? 'czynniki' : 'czynników'} ryzyka`}
                </span>
              )}
            </div>

            <p className="text-sm sm:text-base font-medium text-[#141D19] leading-relaxed">
              {wm.summaryPl}
            </p>

            {!isNonArable && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  className={`rounded-lg border border-l-4 px-3.5 py-3 ${droughtStyle.bg} ${droughtStyle.border} ${droughtStyle.accent}`}
                >
                  <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${droughtStyle.text}`}>
                    {raw.iungDrought === true ? (
                      <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    Susza rolnicza (progi IUNG)
                  </p>
                  <p className={`text-base font-bold mt-0.5 ${droughtStyle.text}`}>
                    {result.meteoAvailable === false
                      ? 'Nie oceniono — brak danych pogodowych'
                      : raw.iungDrought === true
                        ? 'TAK — zagrożenie suszą'
                        : raw.iungDrought === false
                          ? 'NIE — brak suszy rolniczej'
                          : outsideIungSeason
                            ? 'Poza sezonem — nie oceniamy'
                            : 'Nie oceniono'}
                  </p>
                  <p className="text-xs text-[#3F4E46] mt-0.5 leading-relaxed tabular-nums">
                    {raw.iungDrought === true || raw.iungDrought === false
                      ? `KBW ${raw.iungKbwMm} mm przy progu ${raw.iungThresholdMm} mm · okres ${raw.iungPeriodLabel} · gleba kat. ${raw.iungCategory}`
                      : result.meteoAvailable === false
                        ? 'Bez pogody nie da się porównać bilansu z progiem.'
                        : outsideIungSeason
                          ? 'IUNG ocenia suszę rolniczą od 20 maja (koniec pierwszego okresu 21.III–20.V) do 30 września. Poza sezonem liczą się retencja i przygotowanie pola.'
                          : 'Ta uprawa lub kategoria gleby nie jest objęta progami IUNG w tym okresie.'}
                  </p>
                </div>

                <div
                  className={`rounded-lg border border-l-4 px-3.5 py-3 ${anomalyStyle.bg} ${anomalyStyle.border} ${anomalyStyle.accent}`}
                >
                  <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${anomalyStyle.text}`}>
                    <CloudRain className="w-3.5 h-3.5" aria-hidden="true" />
                    Anomalia opadów (EDO)
                  </p>
                  <p className={`text-base font-bold mt-0.5 ${anomalyStyle.text}`}>
                    {result.meteoAvailable === false
                      ? 'Nie oceniono — brak danych pogodowych'
                      : getEdoAnomalyLabel(result.edoLevel.poziom)}
                  </p>
                  <p className="text-xs text-[#3F4E46] mt-0.5 leading-relaxed tabular-nums">
                    {result.meteoAvailable === false
                      ? 'Bez pogody nie da się porównać opadów z normą.'
                      : `SPI-3 ${raw.spi3.toFixed(1)}${inputs.sma?.status === 'ok' ? ` · wilgotność gleby ${raw.sma.toFixed(1)}` : ''} — porównanie z normą wieloletnią, nie ocena suszy rolniczej.`}
                  </p>
                </div>
              </div>
            )}

            {wm.seasonNotePl && (
              <p className="text-xs sm:text-sm text-[#3F4E46] bg-white/80 border border-[#E7CFA2] rounded-lg px-3.5 py-2.5 leading-relaxed">
                {wm.seasonNotePl}
              </p>
            )}

            {!isNonArable && wm.keyRisksPl.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-semibold text-[#141D19]">
                  Z czego wynika ta ocena:
                </p>
                <ul className="space-y-1 text-xs sm:text-sm text-[#24322B] list-disc pl-5 leading-relaxed">
                  {wm.keyRisksPl.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs sm:text-sm text-[#3F4E46] leading-relaxed pt-2 border-t border-black/8 space-y-1">
              <p>
                <strong className="font-semibold text-[#141D19]">Jak było tu w ostatnich 10 latach?</strong>{' '}
                {report.tenYearSummaryPl}
              </p>
            </div>
          </div>
        </div>

        {/* End of status summary card */}
      </section>

      {/* 4.2 DLACZEGO? PRZYCZYNY I KLUCZOWE WSKAŹNIKI (obowiązkowo przed rekomendacjami wg KOWR) */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-[#1B5E4A]">Krok 2 raportu · Przyczyny</p>
          <h2 className="text-lg sm:text-xl font-bold text-[#141D19]">
            Dlaczego na tej działce występuje taki stan wody?
          </h2>
          <p className="text-xs sm:text-sm text-[#55665D]">
            Zanim przejdziemy do propozycji działań, sprawdziliśmy cztery czynniki: pogodę,
            zdolność gleby do zatrzymywania wody, ukształtowanie terenu oraz wrażliwość wybranej
            uprawy.
          </p>
        </div>

        {/* 3 plain-language key figures */}
        {!isNonArable && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-[#DCE2DD]">
              <p className="text-xs text-[#55665D]">
                {kbwFromIung
                  ? `Deszcz a parowanie (okres IUNG ${raw.iungPeriodLabel})`
                  : 'Deszcz a parowanie (60 dni)'}
              </p>
              <p className="text-lg font-bold font-mono tabular-nums text-[#141D19] mt-0.5">
                {inputs.kbwMm?.status === 'ok'
                  ? `${kbwVal > 0 ? `+${kbwVal}` : kbwVal} mm`
                  : 'Brak danych'}
              </p>
              <p className="text-xs text-[#55665D] mt-0.5">
                {inputs.kbwMm?.status === 'ok'
                  ? kbwFromIung
                    ? `${kbwExplain} · ostatnie 60 dni: ${raw.kbwMm} mm`
                    : kbwExplain
                  : 'Brak pełnych danych pogodowych z 60 dni'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#DCE2DD]">
              <p className="text-xs text-[#55665D]">Wilgotność gleby (względem normy)</p>
              <p className="text-lg font-bold text-[#141D19] mt-0.5">{soilMoistureText}</p>
              <p className="text-xs text-[#55665D] mt-0.5">
                Gleba: {result.soil.grupa_uziarnienia}
                {inputs.soilId?.status === 'szacunek' ? ' (szacunek)' : ''}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#DCE2DD]">
              <p className="text-xs text-[#55665D]">Zieleń roślin z satelity</p>
              <p className="text-lg font-bold text-[#141D19] mt-0.5 tabular-nums">
                {ndviSummaryText}
              </p>
              <p className="text-xs text-[#55665D] mt-0.5">
                {inputs.ndvi?.dataDate && inputs.ndvi.dataDate !== 'brak'
                  ? `Zdjęcie z dnia ${inputs.ndvi.dataDate}`
                  : 'Brak bezchmurnego zdjęcia satelitarnego'}
              </p>
              {ndviVal !== null && ndviCrop && (
                <p className="text-[11px] text-[#55665D] mt-1 leading-snug">{ndviCrop.textPl}</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.causes.map((cause) => {
            const severityStyle =
              cause.nasilenie === 'Wysokie'
                ? 'text-[#B91C1C]'
                : cause.nasilenie === 'Umiarkowane'
                  ? 'text-[#B45309]'
                  : 'text-[#6B7A72]';

            const severityLabel = cause.nieoceniono
              ? 'Nie oceniono (brak danych)'
              : cause.nasilenie === 'Wysokie'
                ? 'Silny wpływ'
                : cause.nasilenie === 'Umiarkowane'
                  ? 'Umiarkowany wpływ'
                  : 'Bez problemu';

            const cardBorder =
              cause.nasilenie === 'Wysokie'
                ? 'bg-[#FFF9F7] border-[#F0B8AA]'
                : cause.nasilenie === 'Umiarkowane'
                  ? 'bg-[#FFFDF5] border-[#EBD094]'
                  : 'bg-[#F8F9F8] border-[#E6EBE7] opacity-80';

            return (
              <div
                key={cause.domena}
                className={`rounded-xl border p-4 space-y-1.5 ${cardBorder}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className={`text-sm font-bold ${
                      cause.aktywna ? 'text-[#141D19]' : 'text-[#5F6E66]'
                    }`}
                  >
                    {CAUSE_CARD_TITLES[cause.domena] ?? cause.domena}
                  </h3>
                  <span className={`text-xs font-semibold ${severityStyle}`}>{severityLabel}</span>
                </div>
                <p className="text-xs text-[#2E3C35] leading-relaxed tabular-nums">{cause.dowod}</p>
                <p className="text-[11px] text-[#6B7A72]">Na podstawie: {cause.zrodlo}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* SKRÓT PROPOZYCJI DZIAŁAŃ (ODNOŚNIKI DO KROKÓW RETENCJI -> AGROTECHNIKI -> NAWADNIANIA) */}
      {!isNonArable && (
        <section className="bg-[#FAFDFB] border border-[#BFD9CB] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <ListChecks className="w-5 h-5 text-[#1B5E4A] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h2 className="text-lg font-bold text-[#141D19]">
                  Co warto rozważyć na tej działce (skrót)
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5A52]">
                  Najważniejsze opcje ułożone w kolejności KOWR: najpierw zatrzymanie wody w
                  krajobrazie i glebie, a nawadnianie dopiero jako opcja na końcu.
                </p>
              </div>
            </div>
          </div>

          {quickActions.length > 0 && (
            <ol className="space-y-2.5">
              {quickActions.map((act, idx) => {
                const isUrgent = [
                  'R04_STOK_BEZ_OKRYWY_KBW',
                  'R05_ROW_MELIORACYJNY_ZASTAWKA',
                  'R17_ODPLYW_JESIEN_ZIMA_ROW',
                  'R18_ZASTOINY_NADMIAR_WODY',
                  'R12_UPRAWA_OKNO_KRYTYCZNE_OCHRONA',
                  'R15_NDMI_STRES_UKRYTY'
                ].includes(act.id);

                return (
                  <li key={act.id}>
                    <a
                      href={`#rec-${act.id}`}
                      className={`group flex items-start justify-between gap-3 p-3.5 rounded-lg border transition-colors ${
                        isUrgent
                          ? 'bg-[#FFFEFA] border-[#E8C98F] hover:border-[#C99A49]'
                          : 'bg-white border-[#D3E3DA] hover:border-[#1B5E4A]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-md text-xs font-bold tabular-nums flex items-center justify-center shrink-0 mt-0.5 ${
                            isUrgent
                              ? 'bg-[#FEF3C7] text-[#92400E]'
                              : 'bg-[#E8F3EC] text-[#1B5E4A]'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-bold text-[#141D19] leading-snug">
                            {act.co_dodac_krotko}
                          </p>
                          <p className="text-xs text-[#4A5A52] leading-relaxed">
                            <span className="font-medium text-[#1B5E4A]">{act.kategoria_kowr}</span>
                            {' · '}
                            {act.przyczyna}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#1B5E4A] inline-flex items-center gap-1 shrink-0 mt-1 group-hover:underline">
                        Zobacz szczegóły
                        <ArrowDown className="w-3.5 h-3.5" />
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Concise irrigation recommendation right inside Zalecenia */}
          <a
            href={`#rec-${result.irrigationRules[0]?.id ?? 'irrigation'}`}
            className={`group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3.5 rounded-lg border transition-colors ${
              result.irrigationCalc.uzasadnione
                ? 'bg-[#EFF6FF] border-[#93C5FD] hover:border-[#3B82F6]'
                : 'bg-white border-[#C8DCE9] hover:border-[#0369A1]'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Droplets className="w-4 h-4 text-[#0369A1] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0369A1]">
                  Nawadnianie (opcjonalnie — krok końcowy)
                </p>
                <p className="text-sm font-bold text-[#141D19] tabular-nums">
                  {result.irrigationCalc.uzasadnione
                    ? `Można rozważyć podlewanie (ok. ${result.irrigationCalc.dawka_zalecana_mm} mm)`
                    : irrigationAssessed
                      ? 'Nie podlewać teraz — brak pilnej potrzeby nawadniania'
                      : 'Nie oceniono — brak danych pogodowych'}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#0369A1] inline-flex items-center gap-1 shrink-0 group-hover:underline">
              Szczegóły
              <ArrowDown className="w-3.5 h-3.5" />
            </span>
          </a>
        </section>
      )}

      {/* SZCZEGÓŁOWE RADY PRAKTYCZNE: 4.3 Retencja -> 4.4 Agrotechnika -> 4.5 Nawadnianie */}
      {!isNonArable && (
        <div className="space-y-6">
          <div className="space-y-0.5 pt-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#141D19]">
              Szczegółowe rekomendacje dla działki
            </h2>
            <p className="text-xs sm:text-sm text-[#55665D]">
              Konkretne podpowiedzi wynikające z powyższej diagnozy przyczyn: najpierw retencja
              krajobrazowa, potem agrotechnika glebowa, na końcu ocena nawadniania.
            </p>
            {odrName && (
              <p className="text-xs sm:text-sm text-[#24322B] pt-1">
                <strong className="font-semibold text-[#1B5E4A]">Doradztwo:</strong> {odrName} —
                doradcy pomogą dobrać zabiegi do gospodarstwa i przygotować wnioski o ekoschematy.
              </p>
            )}
          </div>

          {/* 4.3 CO MOŻESZ DODAĆ NA DZIAŁCE: RETENCJA KRAJOBRAZOWA I MELIORACJA */}
          <section className="space-y-3.5">
            <div className="bg-white border border-[#C6DDD0] rounded-xl overflow-hidden flex flex-col sm:flex-row">
              <MediaImage
                src={GUIDE_RETENTION_IMG}
                alt="Naturalny pas zieleni, zadrzewienia i oczko wodne na skraju pola"
                fallbackLabel="Retencja krajobrazowa"
                className="w-full sm:w-44 h-36 sm:h-auto object-cover shrink-0 print:hidden"
              />
              <div className="p-4 sm:p-5 flex flex-col justify-center space-y-1">
                <div className="flex items-center gap-2 text-[#1B5E4A]">
                  <Trees className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">
                    Krok 3 raportu · Retencja krajobrazowa i melioracja
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#141D19]">
                  Co możesz dodać na działce i przy rowach?
                </h3>
                <p className="text-xs sm:text-sm text-[#55665D] leading-relaxed">
                  Najtaniej i najtrwalej jest zatrzymać wodę tam, gdzie spadła — zanim odpłynie
                  rowem, spłynie ze stoku albo wywieje ją wiatr.
                </p>
              </div>
            </div>

            {result.landscapeRetention.length > 0 ? (
              <div className="space-y-3">
                {result.landscapeRetention.map((rule) => (
                  <RecommendationCard key={rule.id} rule={rule} data={report} />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-[#DCE2DD] rounded-xl p-4 text-sm text-[#4A5A52]">
                Na tej działce nie widać obecnie potrzeby dodatkowych prac ziemnych ani melioracji
                (teren jest płaski, brak rowu w najbliższej okolicy lub teren jest chroniony).
              </div>
            )}

            {/* Mini-map of parcel */}
            <div className="space-y-1.5">
              <ParcelMap
                parcel={parcel}
                interactive={false}
                initialBaseLayer="ortho"
                heightClass="h-[220px]"
                hasDepression={report.rawInput.hasDepression}
                ditchDistanceM={report.rawInput.ditchDistanceM}
              />
              <p className="text-xs text-[#55665D]">
                {report.ditchDetails || 'Sprawdzono obecność rowów melioracyjnych w promieniu 500 m.'}
                {report.rawInput.hasDepression
                  ? ' W środku działki widać lokalne zagłębienie terenu, w którym może zbierać się woda.'
                  : ' Teren działki nie ma głębokich zagłębień bezodpływowych.'}
              </p>
              {inputs.downslope?.status === 'ok' && (
                <p className="text-xs sm:text-sm text-[#24322B] bg-[#F0F7F3] border border-[#B7D7C4] rounded-lg px-3.5 py-2.5 leading-relaxed">
                  <strong className="font-semibold text-[#1B5E4A]">Gdzie zatrzymać wodę: </strong>
                  {inputs.downslope.value
                    ? `${capitalize(inputs.downslope.displayValue)}. Najniższy skraj pola od tej strony to naturalne miejsce na pas trawy lub zadrzewień, płytkie zagłębienie retencyjne albo zastawkę na rowie — tam woda zbiera się i odpływa najszybciej.`
                    : `${capitalize(inputs.downslope.displayValue)}. Woda raczej wsiąka lub stoi na miejscu, więc ważniejsze od barier na skraju pola są struktura gleby i okrywa, które pozwalają jej wsiąkać.`}
                </p>
              )}
            </div>
          </section>

          {/* 4.4 ZABIEGI NA GLEBIE: AGROTECHNIKA */}
          <section className="space-y-3.5">
            <div className="bg-white border border-[#D2DFD7] rounded-xl overflow-hidden flex flex-col sm:flex-row">
              <MediaImage
                src={GUIDE_SOIL_IMG}
                alt="Wilgotna gleba chroniona warstwą mulczu ze słomy"
                fallbackLabel="Ochrona wilgoci w glebie"
                className="w-full sm:w-44 h-36 sm:h-auto object-cover shrink-0 print:hidden"
              />
              <div className="p-4 sm:p-5 flex flex-col justify-center space-y-1">
                <div className="flex items-center gap-2 text-[#1B5E4A]">
                  <Sprout className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">
                    Krok 4 raportu · Retencja glebowa i agrotechnika
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#141D19]">
                  Zabiegi na glebie (ochrona wilgoci w warstwie korzeni)
                </h3>
                <p className="text-xs sm:text-sm text-[#55665D] leading-relaxed">
                  Proste praktyki polowe, które działają jak gąbka i ograniczają parowanie oraz
                  spływ deszczu.
                </p>
              </div>
            </div>

            {result.agrotechnics.length > 0 ? (
              <div className="space-y-3">
                {result.agrotechnics.map((rule) => (
                  <RecommendationCard key={rule.id} rule={rule} data={report} />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-[#DCE2DD] rounded-xl p-4 text-sm text-[#4A5A52]">
                Przy obecnej wilgotności wystarczą standardowe zabiegi dbające o okrywę gleby i
                próchnicę.
              </div>
            )}
          </section>

          {/* 4.5 CZY PODLEWAĆ? NAWADNIANIE (OPCJONALNE) */}
          <section
            id={`rec-${result.irrigationRules[0]?.id ?? 'irrigation'}`}
            className="bg-white border border-[#C3DBEC] rounded-xl p-5 sm:p-6 space-y-4 scroll-mt-20"
          >
            <div className="flex items-center gap-2.5">
              <Droplets className="w-5 h-5 text-[#0369A1] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#0369A1]">
                  Krok 5 raportu · Nawadnianie (opcjonalnie)
                </p>
                <h3 className="text-lg font-bold text-[#141D19]">
                  Czy warto teraz podlewać?
                </h3>
                <p className="text-xs sm:text-sm text-[#55665D]">
                  Nawadnianie traktujemy jako ostateczność — tylko wtedy, gdy rośliny są w kluczowej
                  fazie wzrostu, a w glebie wyczerpał się zapas łatwo dostępnej wody.
                </p>
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border ${
                result.irrigationCalc.uzasadnione
                  ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#1E3A8A]'
                  : 'bg-[#F8FAF9] border-[#D5E1DA] text-[#141D19]'
              }`}
            >
              <p className="text-base font-bold tabular-nums">
                {result.irrigationCalc.uzasadnione
                  ? `TAK — jeśli masz deszczownię, można rozważyć ok. ${result.irrigationCalc.dawka_zalecana_mm} mm wody`
                  : irrigationAssessed
                    ? 'NIE TERAZ — nie ma pilnej potrzeby nawadniania'
                    : 'NIE OCENIONO — brak danych pogodowych'}
              </p>
              <p className="text-sm mt-1 leading-relaxed">{result.irrigationCalc.powod_decyzji}</p>
            </div>

            {/* Reserve bar with plain-Polish explanation (only when the soil water balance was computed) */}
            {irrigationAssessed && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[#4A5A52] tabular-nums">
                <span>
                  Ile wody brakuje w strefie korzeni:{' '}
                  <strong className="text-[#141D19]">{aktualny_deficyt_mm} mm</strong> ({deficitPct}%
                  zapasu)
                </span>
                <span>
                  Próg podlewania ({result.irrigationCalc.dopuszczalne_wyczerpanie_pct}%):{' '}
                  <strong className="text-[#141D19]">{raw_mm} mm</strong> · Pełny zapas gleby:{' '}
                  <strong className="text-[#141D19]">{taw_mm} mm</strong>
                </span>
              </div>

              <div className="relative h-5 w-full rounded-md bg-[#E6EBE7] overflow-hidden border border-[#CBD4CE]">
                <div
                  className={`h-full transition-all ${
                    aktualny_deficyt_mm >= raw_mm ? 'bg-[#EA580C]' : 'bg-[#1B5E4A]'
                  }`}
                  style={{ width: `${deficitPct}%` }}
                />
                <div
                  title={`Próg podlewania (RAW): ${raw_mm} mm`}
                  className="absolute top-0 bottom-0 w-0.5 bg-[#141D19]"
                  style={{ left: `${rawPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#617068] tabular-nums">
                <span>0 mm (gleba pełna wody)</span>
                <span>Próg podlewania: {raw_mm} mm</span>
                <span>Cały zapas: {taw_mm} mm</span>
              </div>
            </div>
            )}

            {result.irrigationRules[0] && (
              <p className="text-xs sm:text-sm text-[#4A5A52] leading-relaxed">
                {result.irrigationRules[0].tekst_dla_rolnika}
              </p>
            )}

            {lim08 && (
              <p className="text-xs text-[#5A6961] border-t border-[#E6EBE7] pt-3 leading-relaxed">
                <strong className="font-semibold text-[#141D19]">Ważna uwaga prawna:</strong>{' '}
                {lim08.zdanie_do_raportu}
              </p>
            )}
          </section>
        </div>
      )}

      {/* 4.6 SZCZEGÓŁY DANYCH (zwinięte domyślnie, auto-rozwijane w druku) */}
      <details className="report-details bg-white border border-[#DCE2DD] rounded-xl overflow-hidden">
        <summary className="px-5 py-4 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-[#FAFBFA]">
          <div>
            <h2 className="text-base font-bold text-[#141D19]">
              Szczegóły danych: mapa satelitarna, wykresy z 10 lat i tabela liczb
            </h2>
            <p className="text-xs text-[#55665D]">
              Rozwiń, jeśli chcesz zobaczyć dokładne wykresy pogody, zieleni z satelity oraz
              objaśnienie skrótów.
            </p>
          </div>
          <ChevronDown className="w-5 h-5 text-[#55665D] shrink-0" />
        </summary>

        <div className="px-5 pb-6 pt-3 space-y-6 border-t border-[#E6EBE7]">
          {/* Short plain-language glossary so no abbreviation is ever mysterious */}
          <div className="p-4 rounded-lg bg-[#F6F7F5] border border-[#E2E7E3] space-y-2 text-xs text-[#3F4E46]">
            <p className="font-semibold text-[#141D19]">
              Krótki słowniczek — co oznaczają skróty na wykresach?
            </p>
            <ul className="space-y-1 leading-relaxed">
              <li>
                <strong>KBW (Klimatyczny Bilans Wodny)</strong> — różnica między deszczem a
                parowaniem z pola. Liczba na minusie (np. −120 mm) oznacza, że wyparowało więcej
                wody, niż spadło z deszczem.
              </li>
              <li>
                <strong>NDVI i NDMI</strong> — wskaźniki ze zdjęć satelitarnych. NDVI pokazuje, jak
                gęsta i zielona jest uprawa (0,6+ to zdrowy łan), a NDMI informuje o uwodnieniu
                liści.
              </li>
              <li>
                <strong>SPI i SMA</strong> — porównanie ostatnich opadów (SPI) i wilgotności gleby
                (SMA) do średniej z wielu lat. Wartość poniżej −1,0 oznacza wyraźny niedobór.
              </li>
            </ul>
          </div>

          {/* Ortho + NDVI Map */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[#141D19]">
              Mapa działki na zdjęciu lotniczym (możesz włączyć widok zieleni NDVI)
            </h3>
            <ParcelMap
              parcel={parcel}
              interactive={false}
              initialBaseLayer="ortho"
              heightClass="h-[300px]"
              ndviValue={report.rawInput.ndvi}
              ndviDate={inputs.ndvi?.dataDate}
              showNdviToggle
              hasDepression={report.rawInput.hasDepression}
              ditchDistanceM={report.rawInput.ditchDistanceM}
            />
          </div>

          <KbwCumulativeChart
            points={series.kbwCumulative}
            crop={result.crop}
            analysisDate={report.analysisDate}
          />

          <KbwTenYearBarsChart
            bars={series.kbwCriticalWindowByYear}
            thresholdMm={series.kbwDryThresholdMm}
            referenceLabel={series.kbwReferenceLabel}
            crop={result.crop}
          />

          <NdviSeasonChart
            points={series.ndvi}
            ndviMedianRef={series.ndviMedianRef}
            crop={result.crop}
          />

          {report.imgwCurrentObs?.available && (
            <div className="p-4 rounded-lg bg-[#F6F7F5] border border-[#DCE2DD] text-xs space-y-1">
              <p className="font-semibold text-[#141D19]">
                Dzisiejszy pomiar ze stacji IMGW-PIB — {report.imgwCurrentObs.station} (
                {report.imgwCurrentObs.measuredAt})
              </p>
              <p className="text-[#3F4E46] tabular-nums">
                Temperatura: <strong>{report.imgwCurrentObs.tempC} °C</strong> · Opad dobowy:{' '}
                <strong>{report.imgwCurrentObs.rainMm} mm</strong> · Wilgotność powietrza:{' '}
                <strong>{report.imgwCurrentObs.humidityPct}%</strong>
              </p>
            </div>
          )}

          {/* Provenance Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[#141D19]">
              Wszystkie użyte wskaźniki i ich źródła
            </h3>
            <div className="overflow-x-auto border border-[#DCE2DD] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6F7F5] border-b border-[#DCE2DD] text-[#4A5A52]">
                    <th className="py-2.5 px-3 font-semibold">Wskaźnik</th>
                    <th className="py-2.5 px-3 font-semibold">Wartość</th>
                    <th className="py-2.5 px-3 font-semibold">Pewność</th>
                    <th className="py-2.5 px-3 font-semibold">Źródło</th>
                    <th className="py-2.5 px-3 font-semibold">Data danych</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EBE7]">
                  {Object.values(inputs).map((field) => (
                    <tr key={field.key} className="hover:bg-[#FAFBFA]">
                      <td className="py-2.5 px-3 font-medium text-[#141D19]">{field.label}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#141D19]">
                        {field.displayValue}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {field.status === 'ok' ? (
                          <span className="text-[#166534]">Dokładne</span>
                        ) : field.status === 'szacunek' ? (
                          <span className="text-[#B45309]">Szacunek</span>
                        ) : (
                          <span className="text-[#6B7A72]">Brak danych</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#4A5A52]">{field.source}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#55665D]">
                        {field.dataDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </details>

      {/* 4.7 OGRANICZENIA TEGO RAPORTU */}
      <section className="bg-[#FFFDF8] border border-[#E5D7B8] rounded-xl p-5 sm:p-6 space-y-3">
        <h2 className="text-base font-bold text-[#141D19]">O czym warto pamiętać (ograniczenia)</h2>
        <ul className="space-y-2.5 text-xs sm:text-sm text-[#3F4E46] leading-relaxed list-disc pl-5">
          {result.limitations.map((lim) => (
            <li key={lim.id}>
              <strong className="font-semibold text-[#141D19]">{lim.kategoria}:</strong>{' '}
              {lim.zdanie_do_raportu}
            </li>
          ))}
        </ul>
      </section>

      {/* 4.8 ŹRÓDŁA DANYCH I ATRYBUCJE */}
      <section className="bg-white border border-[#DCE2DD] rounded-xl p-5 sm:p-6 space-y-3">
        <h2 className="text-base font-bold text-[#141D19]">Skąd pochodzą dane w tym raporcie?</h2>
        <div className="overflow-x-auto border border-[#E6EBE7] rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F7F5] border-b border-[#DCE2DD] text-[#4A5A52]">
                <th className="py-2 px-3 font-semibold">Źródło</th>
                <th className="py-2 px-3 font-semibold">Co pobrano</th>
                <th className="py-2 px-3 font-semibold">Data danych</th>
                <th className="py-2 px-3 font-semibold">Licencja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE7]">
              {sources.map((src) => (
                <tr key={src.name}>
                  <td className="py-2 px-3 font-semibold text-[#141D19]">{src.name}</td>
                  <td className="py-2 px-3 text-[#3F4E46]">{src.usedFor}</td>
                  <td className="py-2 px-3 font-mono tabular-nums text-[#55665D]">
                    {src.dataDate}
                  </td>
                  <td className="py-2 px-3 text-[#4A5A52]">{src.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4.9 AKCJE */}
      <section className="flex flex-wrap items-center justify-between gap-3 pt-1 print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-4 rounded-lg bg-[#1B5E4A] hover:bg-[#144B3A] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            Zapisz jako PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-4 rounded-lg bg-white border border-[#CBD4CE] hover:bg-[#F6F7F5] text-[#141D19] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Drukuj
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="h-10 px-4 rounded-lg bg-white border border-[#CBD4CE] hover:bg-[#F6F7F5] text-[#141D19] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Skopiowano link' : 'Kopiuj link do raportu'}
          </button>
        </div>

        <button
          type="button"
          onClick={onGoHome}
          className="text-sm font-semibold text-[#1B5E4A] hover:underline cursor-pointer"
        >
          Sprawdź inne pole →
        </button>
      </section>
    </div>
  );
}
