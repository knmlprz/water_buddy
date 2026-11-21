import fs from 'node:fs';
import path from 'node:path';
import { CROPS_DATA } from '../src/data/crops';
import {
  EDO_LADDER,
  FLAT_THRESHOLDS_EXPORT,
  KBW_THRESHOLDS,
  NDVI_CLASSES,
  SOIL_WATER_GROUPS
} from '../src/data/thresholds';
import { RECOMMENDATION_RULES } from '../src/data/rules';
import { LIMITATIONS_DATA } from '../src/data/limitations';
import { API_SOURCES_DATA } from '../src/data/apiSources';
import { arrayToCsv, generateReadmeSourcesMarkdown } from '../src/utils/exporters';

const outDir = path.resolve(process.cwd(), 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

// 1. Uprawy
fs.writeFileSync(path.join(outDir, 'crops.json'), JSON.stringify(CROPS_DATA, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'crops.csv'), arrayToCsv(CROPS_DATA, true), 'utf8');

// 2. Progi (unified structured JSON + flat CSV + soil water CSV)
const thresholdsBundle = {
  metadata: {
    tytul: 'Progi suszowe i parametry retencji glebowej (KOWR HackNation 2026)',
    zrodla: ['POLSA 2024', 'CDR 2025', 'Copernicus EDO', 'IUNG-PIB SMSR', 'FAO-56']
  },
  drabina_edo: EDO_LADDER,
  klasy_ndvi: NDVI_CLASSES,
  progi_kbw: KBW_THRESHOLDS,
  woda_w_glebie_0_50cm: SOIL_WATER_GROUPS
};
fs.writeFileSync(
  path.join(outDir, 'thresholds.json'),
  JSON.stringify(thresholdsBundle, null, 2),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'thresholds.csv'),
  arrayToCsv(FLAT_THRESHOLDS_EXPORT, true),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'soil_water_groups.csv'),
  arrayToCsv(SOIL_WATER_GROUPS, true),
  'utf8'
);

// 3. Reguły przyczyna -> rekomendacja
fs.writeFileSync(
  path.join(outDir, 'rules.json'),
  JSON.stringify(RECOMMENDATION_RULES, null, 2),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'rules.csv'),
  arrayToCsv(RECOMMENDATION_RULES, true),
  'utf8'
);

// 4. Zdania do sekcji Ograniczenia
fs.writeFileSync(
  path.join(outDir, 'limitations.json'),
  JSON.stringify(LIMITATIONS_DATA, null, 2),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'limitations.csv'),
  arrayToCsv(LIMITATIONS_DATA, true),
  'utf8'
);

// 5. Źródła API i licencje + gotowa tabela Markdown do README
fs.writeFileSync(
  path.join(outDir, 'api_sources.json'),
  JSON.stringify(API_SOURCES_DATA, null, 2),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'api_sources.csv'),
  arrayToCsv(API_SOURCES_DATA, true),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'README_ZRODLA_I_LICENCJE.md'),
  generateReadmeSourcesMarkdown(API_SOURCES_DATA),
  'utf8'
);

console.log('Generated all static JSON, CSV, and README Markdown tables in public/data/');
