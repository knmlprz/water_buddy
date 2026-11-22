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
  soilId: string | null;
  landUse: LandUseType | null;
  isNatura2000: boolean | null;
  slopePct: number | null;
  hasSoilCover: boolean | null;
  hasDepression: boolean | null;
  ditchDistanceM: number | null;
  kbwMm: number | null; // bilans wodny z około 60 dni, w milimetrach
  spi1: number | null;
  spi3: number | null;
  sma: number | null; // anomalia wilgotności gleby; null gdy jej nie mamy
  ndvi: number | null;
  ndmi: number | null;
  ndviAnomaly: number | null;
  satelliteAgeDays: number | null;
  depletionFraction: number | null; // 0–1; null gdy nie ma zapasu gleby
  dryYearsLast10: number | null;
}

export interface DiagnosedCause {
  domena: 'Opad i upał' | 'Słaba retencja gleby' | 'Spływ powierzchniowy' | 'Wrażliwa uprawa';
  aktywna: boolean;
  nasilenie: 'Wysokie' | 'Umiarkowane' | 'Brak';
  dowod: string;
  zrodlo: string;
}

export interface IrrigationCalculation {
  uzasadnione: boolean;
  powod_decyzji: string;
  taw_mm: number; // Całkowita woda dostępna w efektywnej strefie korzeni
  raw_mm: number; // Woda łatwo dostępna (p * TAW)
  aktualny_deficyt_mm: number; // Brakująca woda do PPW
  dawka_maksymalna_mm: number;
  dawka_zalecana_mm: number; // 0,75 * dawka maksymalna (metoda Drupki / CDR / Woda dla Kujaw)
  dopuszczalne_wyczerpanie_pct: number;
  zrodlo: string;
}

export interface ParcelDiagnosisResult {
  crop: CropParameter;
  soil: SoilWaterGroup | null;
  edoLevel: EdoLadderLevel;
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

function liczba(wartosc: number | null): wartosc is number {
  return wartosc != null && !Number.isNaN(wartosc);
}

export function evaluateEdoLadder(params: {
  spi1: number | null;
  spi3: number | null;
  sma: number | null;
  ndviAnomaly: number | null;
  inHarvestWindow: boolean;
  satelliteAvailable: boolean;
}): { level: EdoLadderLevel; harvestFalseAlarmGuarded: boolean } {
  const spi1 = params.spi1;
  const spi3 = params.spi3;
  if (!liczba(spi1) || !liczba(spi3)) {
    const brakWskaznika = EDO_LADDER.find((l) => l.poziom === 'nie_wiemy') ?? EDO_LADDER[0];
    return { level: brakWskaznika, harvestFalseAlarmGuarded: false };
  }

  const precipitationDeficit = spi3 < -1.0 || spi1 < -2.0;
  const soilMoistureDeficit = liczba(params.sma) && params.sma < -1.0;
  const rawVegAnomaly =
    params.satelliteAvailable && liczba(params.ndviAnomaly) && params.ndviAnomaly < -1.0;

  // Spadek zieleni w oknie żniw nie podnosi poziomu do alarmu.
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
  soil: SoilWaterGroup | null,
  input: ParcelDiagnosisInput,
  inCriticalWindow: boolean,
  edoLevelCode: EdoLadderLevel['poziom']
): IrrigationCalculation {
  const pusty = (powod: string): IrrigationCalculation => ({
    uzasadnione: false,
    powod_decyzji: powod,
    taw_mm: 0,
    raw_mm: 0,
    aktualny_deficyt_mm: 0,
    dawka_maksymalna_mm: 0,
    dawka_zalecana_mm: 0,
    dopuszczalne_wyczerpanie_pct: Math.round(crop.dopuszczalne_wyczerpanie_p * 100),
    zrodlo: 'CDR 2025 (s. 243–252), FAO-56'
  });

  if (!soil || !liczba(input.depletionFraction)) {
    return pusty(
      'Nie liczę dawki. Brakuje pojemności gleby albo stopnia wyczerpania zapasu. To nie jest pomiar czujnikiem.'
    );
  }

  // Woda dostępna z warstwy 0–50 cm, przeliczona na strefę korzeni uprawy.
  const effectiveDepthM = Math.min(Math.max(crop.glebokosc_efektywna_m, 0.4), 1.0);
  const awcPerMeterMm = soil.woda_dostepna_50cm_mm * 2;
  const tawMm = Math.round(awcPerMeterMm * effectiveDepthM);
  const rawMm = Math.round(tawMm * crop.dopuszczalne_wyczerpanie_p);

  const clampedDepletion = Math.min(Math.max(input.depletionFraction, 0), 1);
  const currentDeficitMm = Math.round(tawMm * clampedDepletion);

  const dawkaMaxMm = Math.min(currentDeficitMm, rawMm);
  // Metoda Drupki / CDR / "Woda dla Kujaw": praktyczna dawka to ok. 0,75 dawki maksymalnej (zostawia rezerwę na opad)
  const dawkaZalecanaMm = Math.round(dawkaMaxMm * 0.75);

  if (input.landUse != null && input.landUse !== 'arable') {
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

  const triggered =
    inCriticalWindow &&
    clampedDepletion >= crop.dopuszczalne_wyczerpanie_p &&
    (edoLevelCode === 'ostrzezenie' || edoLevelCode === 'alarm' || (liczba(input.kbwMm) && input.kbwMm < -80));

  if (!triggered) {
    const reason = !inCriticalWindow
      ? `Uprawa (${crop.nazwa_pl}) jest poza oknem krytycznym (${crop.okno_krytyczne_opis}).`
      : clampedDepletion < crop.dopuszczalne_wyczerpanie_p
        ? `Wyczerpanie zapasu wody (${Math.round(clampedDepletion * 100)}%) nie osiągnęło progu dopuszczalnego (${Math.round(crop.dopuszczalne_wyczerpanie_p * 100)}%).`
        : 'Nie ma ostrzeżenia ani alarmu, a bilans wodny z 60 dni nie jest niższy niż −80 mm.';

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

function opisOpadu(input: ParcelDiagnosisInput): string {
  const czesci: string[] = [];
  if (liczba(input.kbwMm)) czesci.push(`bilans wodny z 60 dni = ${Math.round(input.kbwMm)} mm`);
  if (liczba(input.spi3)) czesci.push(`wskaźnik opadu z 3 miesięcy = ${input.spi3.toFixed(1)}`);
  if (liczba(input.spi1)) czesci.push(`wskaźnik opadu z 1 miesiąca = ${input.spi1.toFixed(1)}`);
  return czesci.length ? czesci.join(', ') : 'Brak bilansu wodnego i wskaźnika opadu.';
}

function szczebelSuszy(poziom: EdoLadderLevel['poziom']): boolean {
  return poziom === 'obserwacja' || poziom === 'ostrzezenie' || poziom === 'alarm';
}

export function runWaterDiagnosis(input: ParcelDiagnosisInput): ParcelDiagnosisResult {
  const crop = CROPS_DATA.find((c) => c.id === input.cropId) ?? CROPS_DATA[0];
  const soil = input.soilId ? (SOIL_WATER_GROUPS.find((s) => s.id === input.soilId) ?? null) : null;

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

  const { level: edoLevel, harvestFalseAlarmGuarded } = evaluateEdoLadder({
    spi1: input.spi1,
    spi3: input.spi3,
    sma: input.sma,
    ndviAnomaly: input.ndviAnomaly,
    inHarvestWindow,
    satelliteAvailable
  });

  const ndviClass = satelliteAvailable ? classifyNdvi(input.ndvi) : null;

  const dzis = new Date().toISOString().slice(0, 10);
  const isHistoricalDate = input.analysisDate < dzis;

  const kbwNisko = liczba(input.kbwMm) && input.kbwMm < -50;
  const kbwGleboko = liczba(input.kbwMm) && input.kbwMm < -120;
  const spi3Nisko = liczba(input.spi3) && input.spi3 < -1;
  const spi3Gleboko = liczba(input.spi3) && input.spi3 < -1.5;
  const spi1Nisko = liczba(input.spi1) && input.spi1 < -2;
  const opadAktywny = kbwNisko || spi3Nisko || spi1Nisko;
  const stokStromy = liczba(input.slopePct) && input.slopePct > 4;
  const stokUmiarkowany = liczba(input.slopePct) && input.slopePct > 2 && input.hasSoilCover === false;
  const golaGleba = input.hasSoilCover === false;

  const causes: DiagnosedCause[] = [
    {
      domena: 'Opad i upał',
      aktywna: opadAktywny,
      nasilenie: kbwGleboko || spi3Gleboko ? 'Wysokie' : opadAktywny ? 'Umiarkowane' : 'Brak',
      dowod: opisOpadu(input),
      zrodlo: 'Open-Meteo (archiwum, parowanie według FAO), CDR 2025 s. 66, POLSA tab. 6.4'
    },
    {
      domena: 'Słaba retencja gleby',
      aktywna: soil != null && soil.woda_dostepna_50cm_mm <= 70,
      nasilenie:
        soil != null && soil.woda_dostepna_50cm_mm <= 20
          ? 'Wysokie'
          : soil != null && soil.woda_dostepna_50cm_mm <= 70
            ? 'Umiarkowane'
            : 'Brak',
      dowod: soil
        ? `${soil.grupa_uziarnienia} (${soil.kategoria_iung}): woda dostępna w 0–50 cm około ${soil.woda_dostepna_50cm_mm} mm, wobec około 172 mm w lessie.`
        : 'Brak grupy glebowej.',
      zrodlo: 'CDR 2025 (tab. 12), mapa gleb'
    },
    {
      domena: 'Spływ powierzchniowy',
      aktywna: stokStromy || stokUmiarkowany,
      nasilenie: stokStromy && golaGleba ? 'Wysokie' : stokStromy || stokUmiarkowany ? 'Umiarkowane' : 'Brak',
      dowod: liczba(input.slopePct)
        ? `Spadek terenu ${input.slopePct.toFixed(1).replace('.', ',')} procent.${input.hasSoilCover == null ? ' Okrywy gleby nie sprawdzono.' : input.hasSoilCover ? ' Okrywa gleby jest.' : ' Gleba bez okrywy.'}${liczba(input.ditchDistanceM) ? ` Najbliższy ciek około ${Math.round(input.ditchDistanceM)} m.` : ''}`
        : 'Brak spadku terenu.',
      zrodlo: 'Wysokość terenu (pięć punktów), CDR 2025 s. 99–106'
    },
    {
      domena: 'Wrażliwa uprawa',
      aktywna: inCriticalWindow && (kbwNisko || szczebelSuszy(edoLevel.poziom)),
      nasilenie:
        inCriticalWindow &&
        (crop.wrazliwosc_na_susze === 'Bardzo wysoka' ||
          (liczba(input.depletionFraction) && input.depletionFraction >= crop.dopuszczalne_wyczerpanie_p))
          ? 'Wysokie'
          : inCriticalWindow
            ? 'Umiarkowane'
            : 'Brak',
      dowod: `${crop.nazwa_pl} — ${inCriticalWindow ? 'w oknie, w którym brak wody najbardziej szkodzi' : 'poza tym oknem'} (${crop.okno_krytyczne_opis}).`,
      zrodlo: crop.zrodlo
    }
  ];

  // Ewaluacja reguł ze zbioru RECOMMENDATION_RULES
  const matchedIds = new Set<string>();

  const pole = input.landUse == null || input.landUse === 'arable';

  if (input.landUse != null && input.landUse !== 'arable') {
    matchedIds.add('R01_GRUNT_NIEROLNICZY');
  }
  if (input.isNatura2000 === true) {
    matchedIds.add('R02_NATURA_2000_BLOKADA_PRAC_ZIEMNYCH');
  }
  if (harvestFalseAlarmGuarded) {
    matchedIds.add('R03_FENOLOGIA_ZNIWA_NDVI');
  }
  if (input.satelliteAgeDays === null || input.satelliteAgeDays > 14) {
    matchedIds.add('R16_CHMURY_BRAK_SATELITY');
  }

  if (pole) {
    if (liczba(input.slopePct) && input.slopePct > 4 && input.hasSoilCover === false && liczba(input.kbwMm) && input.kbwMm < -50) {
      matchedIds.add('R04_STOK_BEZ_OKRYWY_KBW');
    }
    if (
      input.isNatura2000 === false &&
      liczba(input.ditchDistanceM) &&
      input.ditchDistanceM <= 500 &&
      ((liczba(input.kbwMm) && input.kbwMm < -50) || (liczba(input.spi3) && input.spi3 < -1))
    ) {
      matchedIds.add('R05_ROW_MELIORACYJNY_ZASTAWKA');
    }
    if (input.isNatura2000 === false && input.hasDepression === true && liczba(input.dryYearsLast10) && input.dryYearsLast10 >= 4) {
      matchedIds.add('R06_ZAGLEBIENIE_OCZKO_WODNE');
    }
    if (
      liczba(input.dryYearsLast10) &&
      input.dryYearsLast10 >= 5 &&
      ((liczba(input.kbwMm) && input.kbwMm < -80) || (liczba(input.spi3) && input.spi3 < -1))
    ) {
      matchedIds.add('R07_ZADRZEWIENIA_WIATROCHRONNE');
    }
    if (soil != null && soil.woda_dostepna_50cm_mm <= 70 && liczba(input.kbwMm) && input.kbwMm < -50) {
      matchedIds.add('R08_GLEBA_LEKKA_MATERIA_ORGANICZNA');
    }
    if (input.hasSoilCover === false && ((liczba(input.kbwMm) && input.kbwMm < -50) || (liczba(input.spi3) && input.spi3 < -1))) {
      matchedIds.add('R09_MULCZ_RESZTKI_POZNIWNE');
    }
    if (szczebelSuszy(edoLevel.poziom) || (liczba(input.kbwMm) && input.kbwMm < -70)) {
      matchedIds.add('R10_UPRAWA_KONSERWUJACA_BEZ_ORKI');
    }
    if (
      soil != null &&
      ['glina_lekka', 'glina_zwykla', 'pyl_zwykly'].includes(soil.id) &&
      ((liczba(input.sma) && input.sma < -1) || (liczba(input.slopePct) && input.slopePct > 3))
    ) {
      matchedIds.add('R11_GLEBOSZOWANIE_GLEBA_CIEZKA');
    }
    if (inCriticalWindow && (kbwNisko || szczebelSuszy(edoLevel.poziom))) {
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

  const irrigationCalc = calculateIrrigationDose(crop, soil, input, inCriticalWindow, edoLevel.poziom);

  if (pole) {
    if (irrigationCalc.uzasadnione) matchedIds.add('R13_NAWADNIANIE_OPCJONALNE_WYCZERPANIE_RAW');
    else matchedIds.add('R14_NAWADNIANIE_BRAK_UZASADNIENIA');
  }

  const matchedRules = RECOMMENDATION_RULES.filter((r) => matchedIds.has(r.id));
  const verificationAlerts = matchedRules.filter((r) => r.kolejnosc_kowr === 1);
  const landscapeRetention = matchedRules.filter((r) => r.kolejnosc_kowr === 2);
  const agrotechnics = matchedRules.filter((r) => r.kolejnosc_kowr === 3);
  const irrigationRules = matchedRules.filter((r) => r.kolejnosc_kowr === 4);

  // Dobór zdań do sekcji "Ograniczenia"
  const limitations = LIMITATIONS_DATA.filter((lim) => {
    if (lim.id === 'LIM_04_GLEBA_BEZ_BADAN_LAB') return soil != null;
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

  const dzien = input.analysisDate;
  let statusSummaryPl = '';
  if (input.landUse != null && input.landUse !== 'arable') {
    statusSummaryPl = `Działka ${input.parcelLabel} nie jest gruntem ornym. Nie podaję zabiegów polowych.`;
  } else if (edoLevel.poziom === 'alarm') {
    statusSummaryPl = `Na dzień ${dzien} jest alarm: brakuje deszczu, gleba jest suchsza niż w ostatnich latach, a zieleń na zdjęciu jest słabsza.`;
  } else if (edoLevel.poziom === 'ostrzezenie') {
    statusSummaryPl = `Na dzień ${dzien} jest ostrzeżenie: brakuje deszczu i gleba jest suchsza niż w ostatnich latach.${harvestFalseAlarmGuarded ? ' Spadek zieleni pomijam, bo to okno zbioru.' : ''}`;
  } else if (edoLevel.poziom === 'obserwacja') {
    statusSummaryPl = `Na dzień ${dzien} jest obserwacja: w tym okresie deszczu było wyraźnie mniej niż w ostatnich latach.`;
  } else if (edoLevel.poziom === 'nie_wiemy') {
    statusSummaryPl = `Na dzień ${dzien} nie stawiam szczebla suszy, bo nie mam wskaźnika opadu. Sam niedobór w milimetrach nie jest alarmem.`;
  } else {
    statusSummaryPl = `Na dzień ${dzien} deszcz w tym okresie nie odstaje w dół od ostatnich lat.`;
  }

  return {
    crop,
    soil,
    edoLevel,
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
