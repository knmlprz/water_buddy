import thresholdsJson from '../../public/data/thresholds.json';

export interface EdoLadderLevel {
  poziom: 'brak' | 'obserwacja' | 'ostrzezenie' | 'alarm';
  nazwa_pl: string;
  nazwa_edo: string;
  warunek_logiczny: string;
  opis_dla_rolnika: string;
  zrodlo: string;
}

export interface NdviClass {
  klasa: string;
  zakres_min: number;
  zakres_max: number;
  etykieta_zakresu: string;
  interpretacja: string;
  uwaga_ndmi_fenologia: string;
  zrodlo: string;
}

export interface KbwThreshold {
  id: string;
  poziom: string;
  zakres_mm: string;
  prog_gorny_mm: number;
  okno_czasowe: string;
  znaczenie_agronomiczne: string;
  zrodlo: string;
}

export interface SoilWaterGroup {
  id: string;
  grupa_uziarnienia: string;
  kategoria_iung: 'I (bardzo lekka)' | 'II (lekka)' | 'III (średnia)' | 'IV (ciężka / pyłowa)';
  ppw_pct_obj: number; // Polowa pojemność wodna (% obj.)
  phw_pct_obj: number; // Punkt hamowania wzrostu (% obj.)
  pw_pct_obj: number; // Punkt więdnięcia (% obj.)
  woda_dostepna_50cm_mm: number; // (PPW - PW) * 500 mm / 100
  woda_latwo_dostepna_50cm_mm: number; // (PPW - PHW) * 500 mm / 100
  tempo_przesychania: string;
  zrodlo: string;
}

export interface FlatThresholdRow {
  tabela: 'Drabina EDO' | 'Klasy NDVI / NDMI' | 'Progi KBW' | 'Woda w glebie (0–50 cm)';
  kod: string;
  nazwa: string;
  wartosc_lub_warunek: string;
  jednostka: string;
  interpretacja: string;
  zrodlo: string;
}

export const EDO_LADDER: EdoLadderLevel[] = thresholdsJson.drabina_edo as EdoLadderLevel[];

export const NDVI_CLASSES: NdviClass[] = thresholdsJson.klasy_ndvi as NdviClass[];

export const KBW_THRESHOLDS: KbwThreshold[] = thresholdsJson.progi_kbw as KbwThreshold[];

export const SOIL_WATER_GROUPS: SoilWaterGroup[] =
  thresholdsJson.woda_w_glebie_0_50cm as SoilWaterGroup[];

export const FLAT_THRESHOLDS_EXPORT: FlatThresholdRow[] = [
  ...EDO_LADDER.map((item) => ({
    tabela: 'Drabina EDO' as const,
    kod: `EDO_${item.poziom.toUpperCase()}`,
    nazwa: `${item.nazwa_pl} (${item.nazwa_edo})`,
    wartosc_lub_warunek: item.warunek_logiczny,
    jednostka: 'indeks standaryzowany',
    interpretacja: item.opis_dla_rolnika,
    zrodlo: item.zrodlo
  })),
  ...NDVI_CLASSES.map((item) => ({
    tabela: 'Klasy NDVI / NDMI' as const,
    kod: `NDVI_${item.klasa.toUpperCase()}`,
    nazwa: item.klasa.replace(/_/g, ' '),
    wartosc_lub_warunek: item.etykieta_zakresu,
    jednostka: 'bezwymiarowy (−1..1)',
    interpretacja: `${item.interpretacja} ${item.uwaga_ndmi_fenologia}`,
    zrodlo: item.zrodlo
  })),
  ...KBW_THRESHOLDS.map((item) => ({
    tabela: 'Progi KBW' as const,
    kod: item.id.toUpperCase(),
    nazwa: item.poziom,
    wartosc_lub_warunek: item.zakres_mm,
    jednostka: 'mm',
    interpretacja: `${item.znaczenie_agronomiczne} (${item.okno_czasowe})`,
    zrodlo: item.zrodlo
  })),
  ...SOIL_WATER_GROUPS.map((item) => ({
    tabela: 'Woda w glebie (0–50 cm)' as const,
    kod: `GLEBA_${item.id.toUpperCase()}`,
    nazwa: `${item.grupa_uziarnienia} [${item.kategoria_iung}]`,
    wartosc_lub_warunek: `PPW ${item.ppw_pct_obj}% | PHW ${item.phw_pct_obj}% | PW ${item.pw_pct_obj}% -> AWC ${item.woda_dostepna_50cm_mm} mm`,
    jednostka: 'mm / 50 cm',
    interpretacja: item.tempo_przesychania,
    zrodlo: item.zrodlo
  }))
];
