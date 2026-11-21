import rulesJson from '../../public/data/rules.json';

export type KowrCategory =
  | 'Ograniczenie / weryfikacja'
  | 'Retencja krajobrazowa (NWRM)'
  | 'Retencja glebowa i agrotechnika'
  | 'Nawadnianie (opcjonalne)';

export type CauseDomain =
  | 'Opad i upał'
  | 'Słaba retencja gleby'
  | 'Spływ powierzchniowy'
  | 'Wrażliwa uprawa'
  | 'Ograniczenie prawne / środowiskowe'
  | 'Fenologia / artefakt satelitarny';

export interface RecommendationRule {
  id: string;
  kolejnosc_kowr: 1 | 2 | 3 | 4; // 1: weryfikacja/ochrona, 2: retencja krajobrazowa, 3: agrotechnika, 4: nawadnianie
  kategoria_kowr: KowrCategory;
  przyczyna: CauseDomain;
  tytul: string;
  warunek_czytelny: string;
  warunek_kod: string;
  tekst_dla_rolnika: string;
  co_dodac_krotko: string;
  uzasadnienie_naukowe: string;
  zrodlo: string;
}

export const RECOMMENDATION_RULES: RecommendationRule[] = rulesJson as RecommendationRule[];
