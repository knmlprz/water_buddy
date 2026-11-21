import { CROPS_DATA, type CropParameter } from '../data/crops';
import {
  EDO_LADDER,
  NDVI_CLASSES,
  SOIL_WATER_GROUPS,
  type EdoLadderLevel,
  type NdviClass,
  type SoilWaterGroup
} from '../data/thresholds';
import { RECOMMENDATION_RULES, type RecommendationRule } from '../data/rules';
import { LIMITATIONS_DATA, type LimitationSentence } from '../data/limitations';

export type LandUseType = 'arable' | 'forest' | 'urban' | 'water';

export interface ParcelDiagnosisInput {
  parcelLabel: string;
  analysisDate: string; // YYYY-MM-DD
  cropId: string;
  soilId: string;
  landUse: LandUseType;
  isNatura2000: boolean;
  slopePct: number;
  hasSoilCover: boolean;
  hasDepression: boolean;
  ditchDistanceM: number;
  kbwMm: number; // 6-dekadowy / 30-60d KBW (mm)
  spi1: number;
  spi3: number;
  sma: number; // soil moisture anomaly (standaryzowana)
  ndvi: number | null;
  ndmi: number | null;
  ndviAnomaly: number | null;
  satelliteAgeDays: number | null;
  depletionFraction: number; // 0.0 - 1.0 aktualny stopień wyczerpania zapasu wody w strefie korzeni
  dryYearsLast10: number; // ile lat z ostatnich 10 było suchych
  // false = nie udało się pobrać pogody; wskaźniki pogodowe są wtedy nieznane, a nie zerowe
  meteoAvailable?: boolean;
}

export interface DiagnosedCause {
  domena: 'Opad i upał' | 'Słaba retencja gleby' | 'Spływ powierzchniowy' | 'Wrażliwa uprawa';
  aktywna: boolean;
  nasilenie: 'Wysokie' | 'Umiarkowane' | 'Brak';
  nieoceniono?: boolean; // brak danych do oceny czynnika (nie mylić z "bez problemu")
  dowod: string;
  zrodlo: string;
}

export interface IrrigationCalculation {
  uzasadnione: boolean;
  ocena_mozliwa?: boolean; // false = brak danych pogodowych, potrzeby nawadniania nie oceniono
  powod_decyzji: string;
  taw_mm: number; // Całkowita woda dostępna w efektywnej strefie korzeni
  raw_mm: number; // Woda łatwo dostępna (p * TAW)
  aktualny_deficyt_mm: number; // Brakująca woda do PPW
  dawka_maksymalna_mm: number;
  dawka_zalecana_mm: number; // 0,75 * dawka maksymalna (metoda Drupki / CDR / Woda dla Kujaw)
  dopuszczalne_wyczerpanie_pct: number;
  zrodlo: string;
}

export type WaterManagementLevel =
  | 'krytyczna'
  | 'podwyzszone_ryzyko'
  | 'wymaga_uwagi'
  | 'stabilna'
  | 'poza_rolnictwem';

export type SeasonPhase = 'wegetacja' | 'odbudowa_jesien_zima';

export interface WaterManagementAssessment {
  level: WaterManagementLevel;
  score: number; // 0..100 wyższy = trudniejsza sytuacja / większe ryzyko strat wody
  headlinePl: string;
  summaryPl: string;
  seasonPhase: SeasonPhase;
  seasonNotePl: string | null;
  keyRisksPl: string[];
}

export interface ParcelDiagnosisResult {
  crop: CropParameter;
  soil: SoilWaterGroup;
  edoLevel: EdoLadderLevel;
  meteoAvailable: boolean;
  waterManagement: WaterManagementAssessment;
  ndviClass: NdviClass | null;
  inCriticalWindow: boolean;
  inHarvestWindow: boolean;
  harvestFalseAlarmGuarded: boolean;
  isHistoricalDate: boolean;
  statusSummaryPl: string;
  causes: DiagnosedCause[];
  verificationAlerts: RecommendationRule[];
  landscapeRetention: RecommendationRule[];
  agrotechnics: RecommendationRule[];
  irrigationRules: RecommendationRule[];
  irrigationCalc: IrrigationCalculation;
  limitations: LimitationSentence[];
}

export function isDateInMmDdWindow(isoDate: string, startMmDd: string, endMmDd: string): boolean {
  const match = /^\d{4}-(\d{2}-\d{2})$/.exec(isoDate.trim());
  if (!match) return false;
  const mmdd = match[1];
  if (startMmDd <= endMmDd) {
    return mmdd >= startMmDd && mmdd <= endMmDd;
  }
  return mmdd >= startMmDd || mmdd <= endMmDd;
}

export function classifyNdvi(ndvi: number | null): NdviClass | null {
  if (ndvi === null || Number.isNaN(ndvi)) return null;
  if (ndvi < 0.2) return NDVI_CLASSES[0];
  if (ndvi < 0.4) return NDVI_CLASSES[1];
  if (ndvi < 0.6) return NDVI_CLASSES[2];
  return NDVI_CLASSES[3];
}

export function evaluateEdoLadder(params: {
  spi1: number;
  spi3: number;
  sma: number;
  ndviAnomaly: number | null;
  inHarvestWindow: boolean;
  satelliteAvailable: boolean;
}): { level: EdoLadderLevel; harvestFalseAlarmGuarded: boolean } {
  const precipitationDeficit = params.spi3 < -1.0 || params.spi1 < -2.0;
  const soilMoistureDeficit = params.sma < -1.0;
  const rawVegAnomaly =
    params.satelliteAvailable && params.ndviAnomaly !== null && params.ndviAnomaly < -1.0;

  // Ochrona przed fałszywym alarmem: spadek NDVI w oknie żniw nie podnosi poziomu do Alarmu!
  const harvestFalseAlarmGuarded = Boolean(rawVegAnomaly && params.inHarvestWindow);
  const confirmedVegAnomaly = Boolean(rawVegAnomaly && !params.inHarvestWindow);

  let code: EdoLadderLevel['poziom'] = 'brak';
  if (precipitationDeficit && soilMoistureDeficit && confirmedVegAnomaly) {
    code = 'alarm';
  } else if (precipitationDeficit && soilMoistureDeficit) {
    code = 'ostrzezenie';
  } else if (precipitationDeficit) {
    code = 'obserwacja';
  }

  const level = EDO_LADDER.find((l) => l.poziom === code) ?? EDO_LADDER[0];
  return { level, harvestFalseAlarmGuarded };
}

export function calculateIrrigationDose(
  crop: CropParameter,
  soil: SoilWaterGroup,
  input: ParcelDiagnosisInput,
  inCriticalWindow: boolean,
  edoLevelCode: EdoLadderLevel['poziom']
): IrrigationCalculation {
  // Skalowanie wody dostępnej z 0-50 cm (tab. 12 CDR) do efektywnej strefy korzeniowej uprawy (ograniczonej do 0,5-1,0 m dla deszczowania)
  const effectiveDepthM = Math.min(Math.max(crop.glebokosc_efektywna_m, 0.4), 1.0);
  const awcPerMeterMm = soil.woda_dostepna_50cm_mm * 2; // 0-50 cm -> 0-100 cm
  const tawMm = Math.round(awcPerMeterMm * effectiveDepthM);
  const rawMm = Math.round(tawMm * crop.dopuszczalne_wyczerpanie_p);

  const clampedDepletion = Math.min(Math.max(input.depletionFraction, 0), 1);
  const currentDeficitMm = Math.round(tawMm * clampedDepletion);

  const dawkaMaxMm = Math.min(currentDeficitMm, rawMm);
  // Metoda Drupki / CDR / "Woda dla Kujaw": praktyczna dawka to ok. 0,75 dawki maksymalnej (zostawia rezerwę na opad)
  const dawkaZalecanaMm = Math.round(dawkaMaxMm * 0.75);

  if (input.landUse !== 'arable') {
    return {
      uzasadnione: false,
      powod_decyzji: 'Działka nie jest gruntem ornym — kalkulator nawadniania nie ma zastosowania.',
      taw_mm: tawMm,
      raw_mm: rawMm,
      aktualny_deficyt_mm: currentDeficitMm,
      dawka_maksymalna_mm: 0,
      dawka_zalecana_mm: 0,
      dopuszczalne_wyczerpanie_pct: Math.round(crop.dopuszczalne_wyczerpanie_p * 100),
      zrodlo: 'CDR 2025 (s. 243–252), FAO-56'
    };
  }

  if (input.meteoAvailable === false) {
    return {
      uzasadnione: false,
      ocena_mozliwa: false,
      powod_decyzji:
        'Nie można ocenić potrzeby nawadniania: brak danych pogodowych do policzenia bilansu wody w glebie.',
      taw_mm: tawMm,
      raw_mm: rawMm,
      aktualny_deficyt_mm: 0,
      dawka_maksymalna_mm: 0,
      dawka_zalecana_mm: 0,
      dopuszczalne_wyczerpanie_pct: Math.round(crop.dopuszczalne_wyczerpanie_p * 100),
      zrodlo: 'CDR 2025 (s. 243–252), FAO-56'
    };
  }

  const triggered =
    inCriticalWindow &&
    clampedDepletion >= crop.dopuszczalne_wyczerpanie_p &&
    (edoLevelCode === 'ostrzezenie' || edoLevelCode === 'alarm' || input.kbwMm < -80);

  if (!triggered) {
    const reason = !inCriticalWindow
      ? `Uprawa (${crop.nazwa_pl}) jest poza oknem krytycznym (${crop.okno_krytyczne_opis}).`
      : clampedDepletion < crop.dopuszczalne_wyczerpanie_p
        ? `Wyczerpanie zapasu wody (${Math.round(clampedDepletion * 100)}%) nie osiągnęło progu dopuszczalnego (${Math.round(crop.dopuszczalne_wyczerpanie_p * 100)}%).`
        : 'Brak potwierdzonego deficytu w glebie (poziom EDO poniżej Ostrzeżenia oraz KBW >= −80 mm).';

    return {
      uzasadnione: false,
      powod_decyzji: reason,
      taw_mm: tawMm,
      raw_mm: rawMm,
      aktualny_deficyt_mm: currentDeficitMm,
      dawka_maksymalna_mm: dawkaMaxMm,
      dawka_zalecana_mm: 0,
      dopuszczalne_wyczerpanie_pct: Math.round(crop.dopuszczalne_wyczerpanie_p * 100),
      zrodlo: 'CDR 2025 (s. 243–252, metoda Drupki), FAO-56'
    };
  }

  return {
    uzasadnione: true,
    powod_decyzji: `Uprawa jest w oknie krytycznym, a wyczerpanie (${Math.round(clampedDepletion * 100)}%) przekroczyło próg ${Math.round(crop.dopuszczalne_wyczerpanie_p * 100)}%. Dawka orientacyjna to 0,75 × dawka max do PPW.`,
    taw_mm: tawMm,
    raw_mm: rawMm,
    aktualny_deficyt_mm: currentDeficitMm,
    dawka_maksymalna_mm: dawkaMaxMm,
    dawka_zalecana_mm: Math.max(dawkaZalecanaMm, 10),
    dopuszczalne_wyczerpanie_pct: Math.round(crop.dopuszczalne_wyczerpanie_p * 100),
    zrodlo: 'CDR 2025 (s. 243–252, metoda Drupki / „Woda dla Kujaw”), FAO-56'
  };
}

export function runWaterDiagnosis(input: ParcelDiagnosisInput): ParcelDiagnosisResult {
  const crop = CROPS_DATA.find((c) => c.id === input.cropId) ?? CROPS_DATA[0];
  const soil = SOIL_WATER_GROUPS.find((s) => s.id === input.soilId) ?? SOIL_WATER_GROUPS[1];

  const inCriticalWindow = isDateInMmDdWindow(
    input.analysisDate,
    crop.okno_start_mmdd,
    crop.okno_koniec_mmdd
  );
  const inHarvestWindow = isDateInMmDdWindow(
    input.analysisDate,
    crop.okno_zbior_start_mmdd,
    crop.okno_zbior_koniec_mmdd
  );

  const satelliteAvailable =
    input.ndvi !== null && input.satelliteAgeDays !== null && input.satelliteAgeDays <= 14;
  const meteoAvailable = input.meteoAvailable !== false;

  const { level: edoLevel, harvestFalseAlarmGuarded } = evaluateEdoLadder({
    spi1: input.spi1,
    spi3: input.spi3,
    sma: input.sma,
    ndviAnomaly: input.ndviAnomaly,
    inHarvestWindow,
    satelliteAvailable
  });

  const ndviClass = satelliteAvailable ? classifyNdvi(input.ndvi) : null;

  // Czy data analizy jest historyczna względem dzisiejszego roku (2026)
  const analysisYear = Number(input.analysisDate.slice(0, 4));
  const isHistoricalDate = Number.isFinite(analysisYear) && analysisYear < 2026;

  const mmdd = input.analysisDate.slice(5, 10);
  const seasonPhase: SeasonPhase =
    mmdd >= '03-21' && mmdd <= '10-15' ? 'wegetacja' : 'odbudowa_jesien_zima';
  const isHeavyOrMediumSoil = ['glina_lekka', 'glina_zwykla', 'pyl_zwykly'].includes(soil.id);
  const hasExcessWaterRisk =
    input.kbwMm > 60 && (input.hasDepression || isHeavyOrMediumSoil);

  // 2. Diagnoza 4 czynników gospodarki wodnej (nie tylko bieżącej suszy letniej!)
  const weatherHigh =
    input.kbwMm < -120 ||
    input.spi3 < -1.5 ||
    input.dryYearsLast10 >= 6 ||
    (input.kbwMm > 90 && hasExcessWaterRisk);
  const weatherMod =
    !weatherHigh &&
    (input.kbwMm < -50 ||
      input.spi3 < -1.0 ||
      input.spi1 < -2.0 ||
      input.dryYearsLast10 >= 4 ||
      hasExcessWaterRisk);

  const runoffHigh =
    (input.slopePct > 4 && !input.hasSoilCover) ||
    (input.ditchDistanceM <= 250 && input.dryYearsLast10 >= 4);
  const runoffMod =
    !runoffHigh &&
    (input.slopePct > 3 ||
      (input.slopePct > 2 && !input.hasSoilCover) ||
      input.ditchDistanceM <= 500 ||
      !input.hasSoilCover ||
      hasExcessWaterRisk);

  const cropHigh =
    inCriticalWindow &&
    (crop.wrazliwosc_na_susze === 'Bardzo wysoka' ||
      input.depletionFraction >= crop.dopuszczalne_wyczerpanie_p);
  const cropMod =
    !cropHigh &&
    (inCriticalWindow ||
      (seasonPhase === 'odbudowa_jesien_zima' && (input.dryYearsLast10 >= 4 || !input.hasSoilCover)));

  const weatherCause: DiagnosedCause = meteoAvailable
    ? {
        domena: 'Opad i upał',
        aktywna: weatherHigh || weatherMod,
        nasilenie: weatherHigh ? 'Wysokie' : weatherMod ? 'Umiarkowane' : 'Brak',
        dowod: hasExcessWaterRisk
          ? `Przewaga opadów (KBW +${input.kbwMm} mm) przy glebie zwięzłej lub zagłębieniu (ryzyko zastoin), a w ${input.dryYearsLast10}/10 ostatnich lat w sezonie było sucho.`
          : `KBW 60 dni = ${input.kbwMm > 0 ? `+${input.kbwMm}` : input.kbwMm} mm, SPI-3 = ${input.spi3.toFixed(1)}, suche sezony w 10-leciu: ${input.dryYearsLast10}/10.`,
        zrodlo: 'Open-Meteo Archive (ERA5 / FAO ET0), CDR 2025 s. 66, POLSA tab. 6.4'
      }
    : {
        domena: 'Opad i upał',
        aktywna: false,
        nasilenie: 'Brak',
        nieoceniono: true,
        dowod:
          'Nie udało się pobrać danych pogodowych, więc nie oceniamy opadów, parowania ani historii susz z 10 lat.',
        zrodlo: 'Open-Meteo Archive (ERA5 / FAO ET0) — niedostępne'
      };

  const causes: DiagnosedCause[] = [
    weatherCause,
    {
      domena: 'Słaba retencja gleby',
      aktywna: soil.woda_dostepna_50cm_mm <= 90,
      nasilenie:
        soil.woda_dostepna_50cm_mm <= 20
          ? 'Wysokie'
          : soil.woda_dostepna_50cm_mm <= 70
            ? 'Umiarkowane'
            : soil.woda_dostepna_50cm_mm <= 90 && input.dryYearsLast10 >= 4
              ? 'Umiarkowane'
              : 'Brak',
      dowod: `${soil.grupa_uziarnienia} (${soil.kategoria_iung}): mieści ok. ${soil.woda_dostepna_50cm_mm} mm wody dostępnej w warstwie 0–50 cm (dla porównania: less zatrzymuje 172 mm).`,
      zrodlo: 'CDR 2025 (tab. 12, van Genuchten), IUNG-PIB'
    },
    {
      domena: 'Spływ powierzchniowy',
      aktywna: runoffHigh || runoffMod,
      nasilenie: runoffHigh ? 'Wysokie' : runoffMod ? 'Umiarkowane' : 'Brak',
      dowod: `Spadek terenu ${input.slopePct.toFixed(1)}%, okrywa gleby: ${input.hasSoilCover ? 'obecna' : 'brak okrywy (ryzyko spływu i erozji)'}, ${input.ditchDistanceM <= 500 ? `rów/ciek w odległości ok. ${input.ditchDistanceM} m (może przyspieszać odpływ)` : 'brak rowu w promieniu 500 m'}.`,
      zrodlo: 'GUGiK NMT 1 m, BDOT10k, CDR 2025 s. 99–106'
    },
    {
      domena: 'Wrażliwa uprawa',
      aktywna: cropHigh || cropMod,
      nasilenie: cropHigh ? 'Wysokie' : cropMod ? 'Umiarkowane' : 'Brak',
      dowod:
        seasonPhase === 'odbudowa_jesien_zima'
          ? `${crop.nazwa_pl} — okres jesienno-zimowej odbudowy zapasu wody przed wiosną (największa wrażliwość na suszę: ${crop.okno_krytyczne_opis}).`
          : `${crop.nazwa_pl} — ${inCriticalWindow ? 'W OKNIE KRYTYCZNYM' : 'poza oknem krytycznym'} (${crop.okno_krytyczne_opis}), próg wyczerpania p = ${Math.round(crop.dopuszczalne_wyczerpanie_p * 100)}%.`,
      zrodlo: crop.zrodlo
    }
  ];

  // Ewaluacja reguł ze zbioru RECOMMENDATION_RULES
  const matchedIds = new Set<string>();

  if (input.landUse !== 'arable') {
    matchedIds.add('R01_GRUNT_NIEROLNICZY');
  }
  if (input.isNatura2000) {
    matchedIds.add('R02_NATURA_2000_BLOKADA_PRAC_ZIEMNYCH');
  }
  if (harvestFalseAlarmGuarded) {
    matchedIds.add('R03_FENOLOGIA_ZNIWA_NDVI');
  }
  if (input.satelliteAgeDays === null || input.satelliteAgeDays > 14) {
    matchedIds.add('R16_CHMURY_BRAK_SATELITY');
  }

  // Rekomendacje polowe tylko dla gruntów ornych!
  if (input.landUse === 'arable') {
    if (input.slopePct > 4 && !input.hasSoilCover && input.kbwMm < -50) {
      matchedIds.add('R04_STOK_BEZ_OKRYWY_KBW');
    }
    if (input.ditchDistanceM <= 500 && (input.kbwMm < -50 || input.spi3 < -1.0) && !input.isNatura2000) {
      matchedIds.add('R05_ROW_MELIORACYJNY_ZASTAWKA');
    } else if (
      input.ditchDistanceM <= 500 &&
      !input.isNatura2000 &&
      (seasonPhase === 'odbudowa_jesien_zima' || input.dryYearsLast10 >= 3 || input.kbwMm > 40)
    ) {
      matchedIds.add('R17_ODPLYW_JESIEN_ZIMA_ROW');
    }

    if (input.hasDepression && input.dryYearsLast10 >= 4 && !input.isNatura2000) {
      matchedIds.add('R06_ZAGLEBIENIE_OCZKO_WODNE');
    }
    if (hasExcessWaterRisk) {
      matchedIds.add('R18_ZASTOINY_NADMIAR_WODY');
    }
    if (
      (input.dryYearsLast10 >= 5 && (input.kbwMm < -80 || input.spi3 < -1.0)) ||
      (input.dryYearsLast10 >= 5 && seasonPhase === 'odbudowa_jesien_zima')
    ) {
      matchedIds.add('R07_ZADRZEWIENIA_WIATROCHRONNE');
    }
    if (soil.woda_dostepna_50cm_mm <= 70 && input.kbwMm < -50) {
      matchedIds.add('R08_GLEBA_LEKKA_MATERIA_ORGANICZNA');
    } else if (soil.woda_dostepna_50cm_mm <= 70 || input.dryYearsLast10 >= 4) {
      matchedIds.add('R20_RETENCJA_PROCHNICA_WIELOLETNIA');
    }
    if (!input.hasSoilCover && (input.kbwMm < -50 || input.spi3 < -1.0)) {
      matchedIds.add('R09_MULCZ_RESZTKI_POZNIWNE');
    } else if (!input.hasSoilCover) {
      matchedIds.add('R19_OKRYWA_ZIMOWA_ODBUDOWA');
    }
    if (edoLevel.poziom !== 'brak' || input.kbwMm < -70) {
      matchedIds.add('R10_UPRAWA_KONSERWUJACA_BEZ_ORKI');
    }
    if (
      isHeavyOrMediumSoil &&
      (input.sma < -1.0 || input.slopePct > 3 || hasExcessWaterRisk)
    ) {
      matchedIds.add('R11_GLEBOSZOWANIE_GLEBA_CIEZKA');
    }
    if (inCriticalWindow && (input.kbwMm < -50 || edoLevel.poziom !== 'brak')) {
      matchedIds.add('R12_UPRAWA_OKNO_KRYTYCZNE_OCHRONA');
    }
    if (
      satelliteAvailable &&
      input.ndvi !== null &&
      input.ndmi !== null &&
      input.ndvi >= 0.4 &&
      input.ndmi < 0.0 &&
      !inHarvestWindow
    ) {
      matchedIds.add('R15_NDMI_STRES_UKRYTY');
    }
  }

  const irrigationCalc = calculateIrrigationDose(
    crop,
    soil,
    input,
    inCriticalWindow,
    edoLevel.poziom
  );

  if (input.landUse === 'arable' && meteoAvailable) {
    if (irrigationCalc.uzasadnione) {
      matchedIds.add('R13_NAWADNIANIE_OPCJONALNE_WYCZERPANIE_RAW');
    } else {
      matchedIds.add('R14_NAWADNIANIE_BRAK_UZASADNIENIA');
    }
  }

  const matchedRules = RECOMMENDATION_RULES.filter((r) => matchedIds.has(r.id));
  const verificationAlerts = matchedRules.filter((r) => r.kolejnosc_kowr === 1);
  const landscapeRetention = matchedRules.filter((r) => r.kolejnosc_kowr === 2);
  const agrotechnics = matchedRules.filter((r) => r.kolejnosc_kowr === 3);
  const irrigationRules = matchedRules.filter((r) => r.kolejnosc_kowr === 4);

  // Dobór zdań do sekcji "Ograniczenia"
  const limitations = LIMITATIONS_DATA.filter((lim) => {
    if (lim.warunek_kod === 'always') return true;
    if (lim.id === 'LIM_01_SATELITA_CHMURY') {
      return input.satelliteAgeDays === null || input.satelliteAgeDays > 7;
    }
    if (lim.id === 'LIM_03_DATA_HISTORYCZNA_API') {
      return isHistoricalDate;
    }
    if (lim.id === 'LIM_07_FENOLOGIA_I_ZNIWA') {
      return inHarvestWindow || crop.id === 'rzepak_ozimy' || crop.id === 'lucerna';
    }
    if (lim.id === 'LIM_08_NAWADNIANIE_POZWOLENIA') {
      return irrigationCalc.uzasadnione;
    }
    if (lim.id === 'LIM_09_OBS_CHRONIONE_MELIORACJA') {
      return landscapeRetention.length > 0 || input.isNatura2000;
    }
    return false;
  });

  // Całościowa, realistyczna ocena gospodarki wodnej działki (nie tylko letnia susza!)
  const keyRisksPl: string[] = [];
  let riskScore = 0;

  if (input.landUse === 'arable') {
    if (edoLevel.poziom === 'alarm') {
      riskScore += 45;
      keyRisksPl.push('Trwa silny stres suszowy potwierdzony pogodowo, glebowo i satelitarnie.');
    } else if (edoLevel.poziom === 'ostrzezenie') {
      riskScore += 32;
      keyRisksPl.push(`Niedobór opadów (KBW ${input.kbwMm} mm) wyraźnie przesuszył warstwę korzeniową.`);
    } else if (edoLevel.poziom === 'obserwacja') {
      riskScore += 18;
      keyRisksPl.push(`Ostatnie 3 miesiące były wyraźnie suchsze niż norma wieloletnia (SPI-3 ${input.spi3.toFixed(1)}).`);
    } else if (input.kbwMm < -50) {
      riskScore += 14;
      keyRisksPl.push(`Parowanie przewyższa opady z ostatnich 60 dni (KBW ${input.kbwMm} mm).`);
    }

    if (soil.woda_dostepna_50cm_mm <= 20) {
      riskScore += 28;
      keyRisksPl.push(`Bardzo lekka gleba (${soil.grupa_uziarnienia}) zatrzymuje zaledwie ~${soil.woda_dostepna_50cm_mm} mm wody — wysycha w kilka dni bez deszczu.`);
    } else if (soil.woda_dostepna_50cm_mm <= 70) {
      riskScore += 18;
      keyRisksPl.push(`Gleba lekka (${soil.grupa_uziarnienia}) ma mały zapas wodny (~${soil.woda_dostepna_50cm_mm} mm w 0–50 cm) i wymaga stałej odbudowy próchnicy.`);
    } else if (soil.woda_dostepna_50cm_mm <= 90) {
      riskScore += 6;
    }

    if (input.dryYearsLast10 >= 6) {
      riskScore += 25;
      keyRisksPl.push(`Rejon o chronicznym deficycie wody: aż ${input.dryYearsLast10} z ostatnich 10 sezonów było tu suchych.`);
    } else if (input.dryYearsLast10 >= 4) {
      riskScore += 16;
      keyRisksPl.push(`Powtarzające się susze: w ${input.dryYearsLast10} z ostatnich 10 lat brakowało wody w kluczowej fazie uprawy.`);
    } else if (input.dryYearsLast10 >= 2) {
      riskScore += 8;
    }

    if (input.slopePct > 4 && !input.hasSoilCover) {
      riskScore += 22;
      keyRisksPl.push(`Duży spadek terenu (${input.slopePct.toFixed(1)}%) przy odkrytej glebie powoduje spływ deszczu i erozję zamiast wsiąkania.`);
    } else if (input.slopePct > 4) {
      riskScore += 14;
      keyRisksPl.push(`Nachylenie działki (${input.slopePct.toFixed(1)}%) sprzyja szybkiemu spływowi opadów ze stoku.`);
    } else if (input.slopePct > 2 && !input.hasSoilCover) {
      riskScore += 10;
      keyRisksPl.push(`Odkryta gleba na lekkim skłonie (${input.slopePct.toFixed(1)}%) traci wodę przez spływ i parowanie.`);
    } else if (!input.hasSoilCover) {
      riskScore += 8;
      keyRisksPl.push('Brak okrywy roślinnej lub mulczu — odkryta gleba słabiej przyjmuje opad i szybciej wysycha.');
    }

    if (input.ditchDistanceM <= 250) {
      riskScore += 14;
      keyRisksPl.push(`W odległości ok. ${input.ditchDistanceM} m biegnie rów/ciek, który bez piętrzenia może zbyt szybko odwadniać pole.`);
    } else if (input.ditchDistanceM <= 500) {
      riskScore += 8;
      keyRisksPl.push(`W promieniu ${input.ditchDistanceM} m znajduje się sieć rowów/cieków — warto kontrolować tempo odpływu wody.`);
    }

    if (hasExcessWaterRisk) {
      riskScore += 14;
      keyRisksPl.push(`Przewaga opadów (KBW +${input.kbwMm} mm) przy glebie zwięzłej lub zagłębieniu stwarza ryzyko lokalnych zastoin wodnych.`);
    } else if (input.hasDepression) {
      riskScore += 6;
    }
  }

  riskScore = Math.min(100, riskScore);

  const seasonNotePl =
    input.landUse === 'arable' && seasonPhase === 'odbudowa_jesien_zima'
      ? `Uwaga sezonowa (${input.analysisDate}): jesienią i zimą parowanie jest bardzo niskie, więc brak bieżącej suszy (KBW ${input.kbwMm > 0 ? `+${input.kbwMm}` : input.kbwMm} mm) nie oznacza, że działka ma bezpieczną gospodarkę wodną. To kluczowy moment na zatrzymanie opadów jesienno-zimowych w glebie i rowach, zanim wiosną ruszy wegetacja.`
      : null;

  let wmLevel: WaterManagementLevel = 'stabilna';
  let wmHeadline = 'Korzystne warunki wodne — utrzymuj dobre praktyki';
  let wmSummary = '';

  if (input.landUse !== 'arable') {
    wmLevel = 'poza_rolnictwem';
    wmHeadline = 'Działka poza gruntami rolnymi';
    wmSummary = `Wskazana działka (${input.parcelLabel}) nie jest polem uprawnym, dlatego nie wydajemy zaleceń polowych.`;
  } else if (!meteoAvailable) {
    wmLevel = riskScore >= 34 ? 'podwyzszone_ryzyko' : 'wymaga_uwagi';
    wmHeadline = 'Ocena niepełna — brak danych pogodowych';
    wmSummary = `Na dzień ${input.analysisDate} nie udało się pobrać danych pogodowych, więc nie oceniamy bieżącej suszy ani potrzeby nawadniania. Poniższe wskazówki wynikają wyłącznie z gleby, ukształtowania terenu, sieci rowów i zdjęć satelitarnych. Spróbuj ponownie później, aby otrzymać pełny raport.`;
  } else if (riskScore >= 55 || edoLevel.poziom === 'alarm') {
    wmLevel = 'krytyczna';
    wmHeadline =
      edoLevel.poziom === 'alarm'
        ? 'Trudna sytuacja wodna — silny deficyt i pilna potrzeba retencji'
        : 'Trudna gospodarka wodna — wysokie ryzyko utraty wody na tej działce';
    wmSummary =
      seasonPhase === 'odbudowa_jesien_zima'
        ? `Mimo chłodnej pory roku działka ma poważne słabości gospodarki wodnej (m.in. historia suchych lat, podatna gleba lub szybki odpływ wody). Bez poprawy retencji przed wiosną uprawy będą silnie narażone na deficyt.`
        : `Na działce nakłada się kilka poważnych problemów wodnych jednocześnie. Priorytetem jest ograniczenie ucieczki wody z pola i ochrona wilgoci w strefie korzeni.`;
  } else if (riskScore >= 34 || edoLevel.poziom === 'ostrzezenie') {
    wmLevel = 'podwyzszone_ryzyko';
    wmHeadline =
      edoLevel.poziom === 'ostrzezenie'
        ? 'Podwyższone ryzyko — gleba przesycha i wymaga działań ochronnych'
        : 'Podwyższone ryzyko w gospodarce wodnej — warto zadbać o retencję';
    wmSummary =
      seasonPhase === 'odbudowa_jesien_zima'
        ? `Obecnie nie ma letniej suszy, ale parametry działki (gleba, odpływ lub historia suchych sezonów) pokazują, że łatwo traci ona wodę. Teraz jest najlepszy moment na zatrzymanie jesienno-zimowych opadów.`
        : `Działka wykazuje wyraźne ryzyko niedoboru lub ucieczki wody. Wdrożenie zabiegów retencyjnych i okrywy gleby wyraźnie poprawi bezpieczeństwo plonów.`;
  } else if (riskScore >= 16 || edoLevel.poziom === 'obserwacja') {
    wmLevel = 'wymaga_uwagi';
    wmHeadline = 'Gospodarka wodna wymaga uwagi — warto zabezpieczyć wilgoć';
    wmSummary =
      seasonPhase === 'odbudowa_jesien_zima'
        ? `Bieżący bilans opadów jest dodatni (typowo dla chłodnej pory roku), ale działka ma czynniki wymagające uwagi przed startem wiosny — sprawdź poniższe zalecenia retencyjne i glebowe.`
        : `Nie ma jeszcze silnej suszy, ale pojedyncze czynniki (gleba, brak okrywy, rów lub niższe opady) osłabiają zapas wody na polu. Warto działać zawczasu.`;
  } else {
    wmLevel = 'stabilna';
    wmHeadline = 'Korzystne warunki wodne — stabilna gospodarka wodna';
    wmSummary = `Na dzień ${input.analysisDate} bilans opadów, parametry gleby i rzeźba terenu nie wskazują istotnych strat wody ani ryzyka suszy. Wystarczy utrzymywać dobrą strukturę i okrywę gleby.`;
  }

  const waterManagement: WaterManagementAssessment = {
    level: wmLevel,
    score: riskScore,
    headlinePl: wmHeadline,
    summaryPl: wmSummary,
    seasonPhase,
    seasonNotePl,
    keyRisksPl
  };

  // Jedno zdanie "tu i teraz"
  let statusSummaryPl = '';
  if (input.landUse !== 'arable') {
    statusSummaryPl = `Działka ${input.parcelLabel} nie jest gruntem ornym — przerwano generowanie rekomendacji polowych.`;
  } else if (!meteoAvailable) {
    statusSummaryPl = wmSummary;
  } else if (edoLevel.poziom === 'alarm') {
    statusSummaryPl = `Na dzień ${input.analysisDate} stwierdzono poziom ALARM: łączny niedobór opadu, spadek wilgotności gleby (SMA ${input.sma.toFixed(1)}) i stres roślin potwierdzony satelitarnie.`;
  } else if (edoLevel.poziom === 'ostrzezenie') {
    statusSummaryPl = `Na dzień ${input.analysisDate} obowiązuje OSTRZEŻENIE: deficyt opadów (KBW ${input.kbwMm} mm) obniżył wilgotność gleby (SMA ${input.sma.toFixed(1)}).${harvestFalseAlarmGuarded ? ' Spadek NDVI zignorowano jako okres żniw.' : ''}`;
  } else if (edoLevel.poziom === 'obserwacja') {
    statusSummaryPl = `Na dzień ${input.analysisDate} obowiązuje OBSERWACJA: narasta niedobór opadów (SPI-3 ${input.spi3.toFixed(1)}, KBW ${input.kbwMm} mm).`;
  } else if (input.kbwMm < -50) {
    statusSummaryPl = `Na dzień ${input.analysisDate} drabina EDO (SPI/SMA) jest w normie, ale 60-dniowy bilans opad–parowanie jest ujemny (KBW ${input.kbwMm} mm) — warto obserwować wilgotność gleby.`;
  } else {
    statusSummaryPl = wmSummary;
  }

  return {
    crop,
    soil,
    edoLevel,
    meteoAvailable,
    waterManagement,
    ndviClass,
    inCriticalWindow,
    inHarvestWindow,
    harvestFalseAlarmGuarded,
    isHistoricalDate,
    statusSummaryPl,
    causes,
    verificationAlerts,
    landscapeRetention,
    agrotechnics,
    irrigationRules,
    irrigationCalc,
    limitations
  };
}
