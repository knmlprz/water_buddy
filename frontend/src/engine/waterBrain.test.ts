import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIrrigationDose,
  classifyNdvi,
  evaluateEdoLadder,
  isDateInMmDdWindow,
  runWaterDiagnosis,
  type ParcelDiagnosisInput
} from './waterBrain';
import { CROPS_DATA } from '../data/crops';
import { SOIL_WATER_GROUPS } from '../data/thresholds';

const baseInput: ParcelDiagnosisInput = {
  parcelLabel: '040701_1.0081.11/74',
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
};

test('EDO ladder progresses through brak -> obserwacja -> ostrzezenie -> alarm', () => {
  assert.equal(
    evaluateEdoLadder({
      spi1: 0.1,
      spi3: -0.4,
      sma: -0.2,
      ndviAnomaly: 0.0,
      inHarvestWindow: false,
      satelliteAvailable: true
    }).level.poziom,
    'brak'
  );

  assert.equal(
    evaluateEdoLadder({
      spi1: -0.5,
      spi3: -1.2,
      sma: -0.4,
      ndviAnomaly: -0.3,
      inHarvestWindow: false,
      satelliteAvailable: true
    }).level.poziom,
    'obserwacja'
  );

  assert.equal(
    evaluateEdoLadder({
      spi1: -2.1,
      spi3: -0.6,
      sma: -1.3,
      ndviAnomaly: -0.5,
      inHarvestWindow: false,
      satelliteAvailable: true
    }).level.poziom,
    'ostrzezenie'
  );

  assert.equal(
    evaluateEdoLadder({
      spi1: -1.1,
      spi3: -1.5,
      sma: -1.4,
      ndviAnomaly: -1.3,
      inHarvestWindow: false,
      satelliteAvailable: true
    }).level.poziom,
    'alarm'
  );
});

test('Harvest window prevents NDVI drop from triggering false EDO Alarm', () => {
  const res = runWaterDiagnosis({
    ...baseInput,
    analysisDate: '2024-07-28', // Pszenica ozima harvest window (07-15..08-25)
    ndvi: 0.18,
    ndviAnomaly: -1.8
  });

  assert.equal(res.inHarvestWindow, true);
  assert.equal(res.harvestFalseAlarmGuarded, true);
  assert.equal(res.edoLevel.poziom, 'ostrzezenie');
  assert.ok(res.verificationAlerts.some((r) => r.id === 'R03_FENOLOGIA_ZNIWA_NDVI'));
});

test('Prompt example rule fires when slope > 4%, bare soil, and KBW < -50 mm', () => {
  const res = runWaterDiagnosis(baseInput);
  assert.ok(res.landscapeRetention.some((r) => r.id === 'R04_STOK_BEZ_OKRYWY_KBW'));
  const rule = res.landscapeRetention.find((r) => r.id === 'R04_STOK_BEZ_OKRYWY_KBW')!;
  assert.match(rule.tekst_dla_rolnika, /można rozważyć/i);
  assert.match(rule.tekst_dla_rolnika, /pasa buforowego|międzyplonu|mulczu/i);
});

test('Non-arable parcel halts field recommendations and returns R01 alert', () => {
  const res = runWaterDiagnosis({
    ...baseInput,
    landUse: 'forest'
  });

  assert.ok(res.verificationAlerts.some((r) => r.id === 'R01_GRUNT_NIEROLNICZY'));
  assert.equal(res.landscapeRetention.length, 0);
  assert.equal(res.agrotechnics.length, 0);
  assert.equal(res.irrigationCalc.uzasadnione, false);
});

test('Natura 2000 suppresses earthwork retention rules (ponds, ditch dams) and adds R02 notice', () => {
  const res = runWaterDiagnosis({
    ...baseInput,
    isNatura2000: true
  });

  assert.ok(res.verificationAlerts.some((r) => r.id === 'R02_NATURA_2000_BLOKADA_PRAC_ZIEMNYCH'));
  assert.equal(res.landscapeRetention.some((r) => r.id === 'R06_ZAGLEBIENIE_OCZKO_WODNE'), false);
  assert.equal(res.landscapeRetention.some((r) => r.id === 'R05_ROW_MELIORACYJNY_ZASTAWKA'), false);
});

test('FAO-56 / CDR irrigation dose computes 0.75 * max dose in critical window', () => {
  const wheat = CROPS_DATA.find((c) => c.id === 'pszenica_ozima')!;
  const sandyLoam = SOIL_WATER_GROUPS.find((s) => s.id === 'piasek_gliniasty')!;
  const calc = calculateIrrigationDose(wheat, sandyLoam, baseInput, true, 'alarm');

  // 70 mm in 0-50cm => 140 mm/m * 0.8 m = 112 mm TAW; RAW = 56 mm; deficit 58% = 65 mm -> capped by RAW 56 mm -> 0.75 * 56 = 42 mm
  assert.equal(calc.uzasadnione, true);
  assert.equal(calc.taw_mm, 112);
  assert.equal(calc.raw_mm, 56);
  assert.equal(calc.dawka_maksymalna_mm, 56);
  assert.equal(calc.dawka_zalecana_mm, 42);
});

test('Okno daty i klasy zieleni', () => {
  assert.equal(isDateInMmDdWindow('2024-06-15', '05-01', '07-10'), true);
  assert.equal(isDateInMmDdWindow('2024-04-01', '05-01', '07-10'), false);
  assert.equal(classifyNdvi(0.05)?.klasa, 'gleba_lub_brak_okrywy');
  assert.equal(classifyNdvi(0.68)?.klasa, 'dobra_kondycja');
});

test('Brak wskaźnika opadu nie podnosi drabiny, nawet przy suchej glebie i słabej zieleni', () => {
  const res = evaluateEdoLadder({
    spi1: null,
    spi3: null,
    sma: -2,
    ndviAnomaly: -2,
    inHarvestWindow: false,
    satelliteAvailable: true
  });
  assert.equal(res.level.poziom, 'nie_wiemy');
});

test('Sam niedobór bilansu nie maluje obserwacji, gdy nie ma wskaźnika opadu', () => {
  const res = runWaterDiagnosis({
    ...baseInput,
    spi1: null,
    spi3: null,
    sma: null,
    ndvi: null,
    ndmi: null,
    ndviAnomaly: null,
    kbwMm: -160
  });
  assert.equal(res.edoLevel.poziom, 'nie_wiemy');
  assert.match(res.statusSummaryPl, /nie stawiam szczebla/);
});

test('Wskaźnik opadu bez wilgotności gleby staje na obserwacji', () => {
  const res = evaluateEdoLadder({
    spi1: -0.4,
    spi3: -1.3,
    sma: null,
    ndviAnomaly: -2,
    inHarvestWindow: false,
    satelliteAvailable: true
  });
  assert.equal(res.level.poziom, 'obserwacja');
});

test('Bez anomalii zieleni nie ma alarmu', () => {
  const res = evaluateEdoLadder({
    spi1: -0.2,
    spi3: -1.4,
    sma: -1.5,
    ndviAnomaly: null,
    inHarvestWindow: false,
    satelliteAvailable: false
  });
  assert.equal(res.level.poziom, 'ostrzezenie');
});

test('Brak gleby nie wymyśla grupy i nie liczy dawki', () => {
  const res = runWaterDiagnosis({
    ...baseInput,
    soilId: null,
    depletionFraction: null
  });
  assert.equal(res.soil, null);
  assert.equal(res.causes.find((c) => c.domena === 'Słaba retencja gleby')?.aktywna, false);
  assert.equal(res.irrigationCalc.uzasadnione, false);
  assert.match(res.irrigationCalc.powod_decyzji, /Nie liczę dawki/);
});
