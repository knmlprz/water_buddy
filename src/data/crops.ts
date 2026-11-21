import cropsJson from '../../public/data/crops.json';

export interface CropParameter {
  id: string;
  nazwa_pl: string;
  nazwa_en: string;
  grupa: 'Zboża ozime' | 'Zboża jare' | 'Oleiste' | 'Okopowe' | 'Pastewne / motylkowate';
  okno_krytyczne_opis: string;
  okno_krytyczne_gleba_lekka: string;
  okno_start_mmdd: string; // MM-DD
  okno_koniec_mmdd: string; // MM-DD
  okno_zbior_start_mmdd: string; // MM-DD (ochrona przed fałszywym alarmem NDVI po żniwach)
  okno_zbior_koniec_mmdd: string; // MM-DD
  dopuszczalne_wyczerpanie_p: number; // ułamek FAO-56 / CDR (np. 0.50 = 50%)
  glebokosc_korzeni_min_m: number;
  glebokosc_korzeni_max_m: number;
  glebokosc_efektywna_m: number;
  kc_ini: number;
  kc_mid: number;
  kc_end: number;
  prog_kbw_kat1_mm: number; // orientacyjny próg 6-dekadowy IUNG dla gleb bardzo lekkich (kat. I)
  prog_kbw_kat2_mm: number; // dla gleb lekkich (kat. II)
  wrazliwosc_na_susze: 'Bardzo wysoka' | 'Wysoka' | 'Średnia' | 'Umiarkowana';
  uwagi_fenologiczne: string;
  zrodlo: string;
}

export const CROPS_DATA: CropParameter[] = cropsJson as CropParameter[];
