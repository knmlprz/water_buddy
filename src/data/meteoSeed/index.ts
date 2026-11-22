// Komórki ERA5 (Open-Meteo, CC BY 4.0) pobrane wcześniej dla działek demonstracyjnych.
// Wbudowane w aplikację, żeby przypadki A/B/C działały bez zapytań do Open-Meteo:
// darmowy limit liczony jest per IP, a serwery chmurowe dzielą IP z innymi projektami.
import c50_3_21_4 from './50.3_21.4.json';
import c50_8_23_9 from './50.8_23.9.json';
import c52_5_14_9 from './52.5_14.9.json';
import c52_8_18_2 from './52.8_18.2.json';

export const METEO_SEED_CELLS: Record<string, unknown> = {
  '50.3_21.4': c50_3_21_4,
  '50.8_23.9': c50_8_23_9, // C — Hrubieszów
  '52.5_14.9': c52_5_14_9, // A — Ośno Lubuskie
  '52.8_18.2': c52_8_18_2 // B — Inowrocław
};
