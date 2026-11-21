import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeMeteoHistory,
  computeFao56DailyDepletion,
  computeGammaSpi,
  computePolygonGeometry,
  computeSlopeAndDepression,
  parseWktOuterRing,
  type DailyMeteoRecord
} from './climateStats';
import { CROPS_DATA } from '../data/crops';
import { SOIL_WATER_GROUPS } from '../data/thresholds';

test('parseWktOuterRing and computePolygonGeometry compute true centroid and positive area', () => {
  const wkt =
    'SRID=4326;POLYGON((18.200 52.770, 18.202 52.770, 18.202 52.772, 18.200 52.772, 18.200 52.770))';
  const ring = parseWktOuterRing(wkt);
  assert.equal(ring.length, 5);

  const geom = computePolygonGeometry(ring);
  assert.ok(Math.abs(geom.centroid[0] - 52.771) < 1e-4);
  assert.ok(Math.abs(geom.centroid[1] - 18.201) < 1e-4);
  assert.ok(geom.approxAreaHa !== null && geom.approxAreaHa > 2.5 && geom.approxAreaHa < 3.5);
});

test('computeGammaSpi produces negative SPI for dry anomaly and positive SPI for wet anomaly', () => {
  const historical = [65, 72, 80, 58, 90, 74, 62, 85, 70, 68, 77, 81, 64, 73, 79];
  const drySpi = computeGammaSpi(historical, 25);
  const wetSpi = computeGammaSpi(historical, 130);
  const normalSpi = computeGammaSpi(historical, 73);

  assert.ok(drySpi !== null && drySpi < -1.5, `Expected dry SPI < -1.5, got ${drySpi}`);
  assert.ok(wetSpi !== null && wetSpi > 1.5, `Expected wet SPI > 1.5, got ${wetSpi}`);
  assert.ok(normalSpi !== null && Math.abs(normalSpi) < 0.5, `Expected normal SPI near 0, got ${normalSpi}`);
});

test('analyzeMeteoHistory strictly ignores future dates and computes 10-year dry count', () => {
  const records: DailyMeteoRecord[] = [];
  // Generate synthetic 12-year daily data (2013..2024)
  for (let y = 2013; y <= 2024; y++) {
    const isDryYear = y % 2 === 0; // even years are dry
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        records.push({
          date: `${y}-${mm}-${dd}`,
          precipMm: isDryYear ? 0.6 : 2.8,
          et0Mm: m >= 5 && m <= 8 ? 4.2 : 1.0,
          tempMeanC: m >= 5 && m <= 8 ? 20 : 6,
          soilMoistureTop: isDryYear ? 0.14 : 0.28
        });
      }
    }
  }
  // Inject extreme rainfall AFTER analysis date (2024-06-25) to prove zero future leakage
  const futureRec = records.find((r) => r.date === '2024-06-25');
  if (futureRec) futureRec.precipMm = 9999;

  const wheat = CROPS_DATA.find((c) => c.id === 'pszenica_ozima')!;
  const soil = SOIL_WATER_GROUPS.find((s) => s.id === 'piasek_gliniasty')!;

  const res = analyzeMeteoHistory(records, wheat, soil, '2024-06-20');
  assert.ok(res.kbw60dMm < -100, `Expected dry KBW < -100 without future rain, got ${res.kbw60dMm}`);
  assert.ok(res.rain60dMm < 100, 'Future 9999 mm rain must not leak into 60-day sum');
  assert.ok(res.dryYearsLast10 >= 4, `Expected >=4 dry years out of 10, got ${res.dryYearsLast10}`);
  assert.ok(res.sma !== null && res.sma < -0.5, `Expected negative SMA in dry year, got ${res.sma}`);
  assert.ok(res.kbwCumulative.length > 5);
  assert.ok(res.kbwCriticalWindowByYear.length >= 10);
});

test('computeFao56DailyDepletion stays bounded in [0, 1] and increases under drought', () => {
  const dryDays: DailyMeteoRecord[] = [];
  for (let d = 1; d <= 31; d++) {
    dryDays.push({
      date: `2024-05-${String(d).padStart(2, '0')}`,
      precipMm: 0.2,
      et0Mm: 4.5,
      tempMeanC: 21,
      soilMoistureTop: 0.15
    });
  }
  const potato = CROPS_DATA.find((c) => c.id === 'ziemniak')!;
  const sandy = SOIL_WATER_GROUPS.find((s) => s.id === 'piasek_gliniasty')!;
  const dep = computeFao56DailyDepletion(dryDays, potato, sandy, '2024-05-31');
  assert.ok(dep > 0.7 && dep <= 1.0, `Expected high depletion >0.7, got ${dep}`);
});

test('computeSlopeAndDepression detects >4% slope and local depression >0.5m', () => {
  const sloped = computeSlopeAndDepression({
    centerElevM: 100.0,
    innerRingElevM: [102.5, 97.5, 102.0, 98.0],
    outerRimElevM: [104.0, 96.0, 103.5, 96.5],
    innerStepM: 40
  });
  assert.ok(sloped.slopePct > 4.5);
  assert.equal(sloped.hasDepression, false);

  const bowl = computeSlopeAndDepression({
    centerElevM: 98.0,
    innerRingElevM: [98.6, 98.7, 98.8, 98.5],
    outerRimElevM: [99.2, 99.1, 99.3, 99.0],
    innerStepM: 40
  });
  assert.equal(bowl.hasDepression, true);
});

// Synthetic season: constant daily rain/ET0 from 2015-01-01 to the given end date
function syntheticSeason(endDate: string, rainMm: number, et0Mm: number): DailyMeteoRecord[] {
  const out: DailyMeteoRecord[] = [];
  const d = new Date('2015-01-01T00:00:00Z');
  const end = new Date(`${endDate}T00:00:00Z`);
  while (d <= end) {
    out.push({
      date: d.toISOString().slice(0, 10),
      precipMm: rainMm,
      et0Mm: et0Mm,
      tempMeanC: 15,
      soilMoistureTop: 0.2
    });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

test('IUNG thresholds depend on soil category: same KBW is drought on sand (I) but not on loess (IV)', () => {
  const crop = CROPS_DATA.find((c) => c.id === 'pszenica_ozima')!;
  const sand = SOIL_WATER_GROUPS.find((s) => s.id === 'piasek_luzny')!;
  const loess = SOIL_WATER_GROUPS.find((s) => s.id === 'pyl_zwykly')!;
  // 61 days x (1.0 - 3.75) mm ≈ -168 mm for period 11.V–10.VII (thresholds: kat. I -165, kat. IV -251)
  const records = syntheticSeason('2025-07-10', 1.0, 3.75);

  const onSand = analyzeMeteoHistory(records, crop, sand, '2025-07-10');
  const onLoess = analyzeMeteoHistory(records, crop, loess, '2025-07-10');

  assert.equal(onSand.iungPeriodLabel, '11.V–10.VII');
  assert.equal(onSand.iungThresholdMm, -165);
  assert.equal(onSand.iungDrought, true);
  assert.equal(onLoess.iungThresholdMm, -251);
  assert.equal(onLoess.iungDrought, false);
});

test('IUNG assessment is null outside the reporting season', () => {
  const crop = CROPS_DATA.find((c) => c.id === 'pszenica_ozima')!;
  const soil = SOIL_WATER_GROUPS.find((s) => s.id === 'piasek_gliniasty')!;
  const res = analyzeMeteoHistory(syntheticSeason('2025-11-20', 1.5, 1.0), crop, soil, '2025-11-20');
  assert.equal(res.iungDrought, null);
});

test('FAO-56 bucket with Ks does not empty a deep loess profile to 100% in one dry season', () => {
  const crop = CROPS_DATA.find((c) => c.id === 'pszenica_ozima')!;
  const loess = SOIL_WATER_GROUPS.find((s) => s.id === 'pyl_zwykly')!;
  const records = syntheticSeason('2025-07-10', 1.0, 3.75);
  const depletion = computeFao56DailyDepletion(records, crop, loess, '2025-07-10');
  assert.ok(depletion < 0.95, `Expected depletion < 95% with Ks, got ${depletion}`);
});
