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
import { arrayToCsv, generateReadmeSourcesMarkdown } from '../utils/exporters';
import { API_SOURCES_DATA } from '../data/apiSources';

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

test('Helper date window, NDVI classification, CSV and README Markdown generators work cleanly', () => {
  assert.equal(isDateInMmDdWindow('2024-06-15', '05-01', '07-10'), true);
  assert.equal(isDateInMmDdWindow('2024-04-01', '05-01', '07-10'), false);
  assert.equal(classifyNdvi(0.05)?.klasa, 'gleba_lub_brak_okrywy');
  assert.equal(classifyNdvi(0.68)?.klasa, 'dobra_kondycja');

  const csv = arrayToCsv([{ a: 'tekst, z "cudzysłowem"', b: 12 }], false);
  assert.equal(csv, 'a,b\r\n"tekst, z ""cudzysłowem""",12');

  const md = generateReadmeSourcesMarkdown(API_SOURCES_DATA);
  assert.match(md, /ULDK/);
  assert.match(md, /Open-Meteo/);
  assert.match(md, /Earth Search/);
  assert.match(md, /IUNG-PIB/);
  assert.match(md, /Copernicus EDO/);
});

test('November positive KBW still diagnoses structural water-management risks (not falsely OK)', () => {
  const novRes = runWaterDiagnosis({
    ...baseInput,
    analysisDate: '2026-11-21',
    kbwMm: 42,
    spi1: 0.2,
    spi3: 0.1,
    sma: 0.0,
    ndvi: 0.22,
    ndviAnomaly: 0.0,
    hasSoilCover: false,
    slopePct: 1.5,
    ditchDistanceM: 200,
    dryYearsLast10: 5,
    depletionFraction: 0.15
  });

  assert.equal(novRes.edoLevel.poziom, 'brak');
  assert.equal(novRes.waterManagement.seasonPhase, 'odbudowa_jesien_zima');
  assert.ok(novRes.waterManagement.seasonNotePl !== null);
  assert.ok(
    novRes.waterManagement.level === 'krytyczna' ||
      novRes.waterManagement.level === 'podwyzszone_ryzyko',
    `Expected realistic elevated/critical risk in November, got ${novRes.waterManagement.level}`
  );
  assert.ok(novRes.landscapeRetention.some((r) => r.id === 'R17_ODPLYW_JESIEN_ZIMA_ROW'));
  assert.ok(novRes.landscapeRetention.some((r) => r.id === 'R07_ZADRZEWIENIA_WIATROCHRONNE'));
  assert.ok(novRes.agrotechnics.some((r) => r.id === 'R19_OKRYWA_ZIMOWA_ODBUDOWA'));
  assert.ok(novRes.agrotechnics.some((r) => r.id === 'R20_RETENCJA_PROCHNICA_WIELOLETNIA'));
});

test('High autumn rainfall on heavy soil / depression triggers R18 excess water / ponding guidance', () => {
  const wetRes = runWaterDiagnosis({
    ...baseInput,
    analysisDate: '2026-11-21',
    soilId: 'glina_zwykla',
    kbwMm: 95,
    spi1: 1.2,
    spi3: 1.1,
    sma: 1.0,
    hasDepression: true,
    ditchDistanceM: 9999,
    dryYearsLast10: 1,
    hasSoilCover: true
  });

  assert.ok(wetRes.landscapeRetention.some((r) => r.id === 'R18_ZASTOINY_NADMIAR_WODY'));
  assert.ok(wetRes.waterManagement.keyRisksPl.some((r) => /zastoin/i.test(r)));
});

test('All public/data reference files exist and match runtime exports loaded by the app', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dataDir = path.resolve(process.cwd(), 'public', 'data');

  const requiredFiles = [
    'crops.json',
    'crops.csv',
    'thresholds.json',
    'thresholds.csv',
    'soil_water_groups.csv',
    'rules.json',
    'rules.csv',
    'limitations.json',
    'limitations.csv',
    'api_sources.json',
    'api_sources.csv',
    'README_ZRODLA_I_LICENCJE.md'
  ];

  for (const file of requiredFiles) {
    assert.ok(fs.existsSync(path.join(dataDir, file)), `Missing public/data/${file}`);
  }

  const cropsJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'crops.json'), 'utf8'));
  const thresholdsJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'thresholds.json'), 'utf8'));
  const rulesJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'rules.json'), 'utf8'));
  const limitationsJson = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'limitations.json'), 'utf8')
  );
  const apiSourcesJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'api_sources.json'), 'utf8'));
  const soilCsvLines = fs
    .readFileSync(path.join(dataDir, 'soil_water_groups.csv'), 'utf8')
    .trim()
    .split(/\r?\n/);

  assert.equal(CROPS_DATA.length, cropsJson.length);
  assert.equal(SOIL_WATER_GROUPS.length, thresholdsJson.woda_w_glebie_0_50cm.length);
  assert.equal(soilCsvLines.length - 1, SOIL_WATER_GROUPS.length);
  assert.equal(API_SOURCES_DATA.length, apiSourcesJson.length);
  assert.ok(rulesJson.length >= 20);
  assert.ok(limitationsJson.length >= 10);
});
