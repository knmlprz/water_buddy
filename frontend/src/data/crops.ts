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

export const CROPS_DATA: CropParameter[] = [
  {
    id: 'pszenica_ozima',
    nazwa_pl: 'Pszenica ozima',
    nazwa_en: 'Winter wheat',
    grupa: 'Zboża ozime',
    okno_krytyczne_opis: '2. dekada maja – 1. dekada lipca (strzelanie w źdźbło, kłoszenie, nalewanie ziarna)',
    okno_krytyczne_gleba_lekka: 'Od 1. dekady maja – 1. dekada lipca',
    okno_start_mmdd: '05-01',
    okno_koniec_mmdd: '07-10',
    okno_zbior_start_mmdd: '07-15',
    okno_zbior_koniec_mmdd: '08-25',
    dopuszczalne_wyczerpanie_p: 0.50,
    glebokosc_korzeni_min_m: 1.0,
    glebokosc_korzeni_max_m: 1.5,
    glebokosc_efektywna_m: 0.8,
    kc_ini: 0.40,
    kc_mid: 1.15,
    kc_end: 0.30,
    prog_kbw_kat1_mm: -120,
    prog_kbw_kat2_mm: -150,
    wrazliwosc_na_susze: 'Wysoka',
    uwagi_fenologiczne: 'Gwałtowny spadek NDVI w lipcu i sierpniu oznacza dojrzewanie fizjologiczne lub żniwa, nie suszę.',
    zrodlo: 'CDR 2025 (s. 225–227, 246), FAO-56 (Tab. 12 i 22), IUNG SMSR'
  },
  {
    id: 'jeczmien_jary',
    nazwa_pl: 'Jęczmień jary',
    nazwa_en: 'Spring barley',
    grupa: 'Zboża jare',
    okno_krytyczne_opis: '3. dekada maja – 1. dekada lipca (krzewienie końcowe, kłoszenie, kwitnienie)',
    okno_krytyczne_gleba_lekka: 'Od 2. dekady maja – 1. dekada lipca',
    okno_start_mmdd: '05-21',
    okno_koniec_mmdd: '07-10',
    okno_zbior_start_mmdd: '07-20',
    okno_zbior_koniec_mmdd: '08-20',
    dopuszczalne_wyczerpanie_p: 0.50,
    glebokosc_korzeni_min_m: 0.8,
    glebokosc_korzeni_max_m: 1.2,
    glebokosc_efektywna_m: 0.6,
    kc_ini: 0.30,
    kc_mid: 1.15,
    kc_end: 0.25,
    prog_kbw_kat1_mm: -100,
    prog_kbw_kat2_mm: -130,
    wrazliwosc_na_susze: 'Bardzo wysoka',
    uwagi_fenologiczne: 'Płytszy system korzeniowy niż zbóż ozimych; silnie reaguje na wiosenny niedobór opadów na glebach lekkich.',
    zrodlo: 'CDR 2025 (s. 226–228, 246), FAO-56 (Tab. 12 i 22), IUNG SMSR'
  },
  {
    id: 'rzepak_ozimy',
    nazwa_pl: 'Rzepak ozimy',
    nazwa_en: 'Winter oilseed rape',
    grupa: 'Oleiste',
    okno_krytyczne_opis: '2. dekada kwietnia – 2. dekada czerwca (pąkowanie, kwitnienie, zawiązywanie łuszczyn)',
    okno_krytyczne_gleba_lekka: 'Od 1. dekady kwietnia – 2. dekada czerwca',
    okno_start_mmdd: '04-11',
    okno_koniec_mmdd: '06-20',
    okno_zbior_start_mmdd: '07-05',
    okno_zbior_koniec_mmdd: '08-10',
    dopuszczalne_wyczerpanie_p: 0.50,
    glebokosc_korzeni_min_m: 1.0,
    glebokosc_korzeni_max_m: 1.5,
    glebokosc_efektywna_m: 0.9,
    kc_ini: 0.35,
    kc_mid: 1.10,
    kc_end: 0.35,
    prog_kbw_kat1_mm: -120,
    prog_kbw_kat2_mm: -150,
    wrazliwosc_na_susze: 'Wysoka',
    uwagi_fenologiczne: 'W okresie kwitnienia (maj) żółte kwiaty mogą chwilowo obniżać NDVI mimo dobrej kondycji; sprawdzać NDMI.',
    zrodlo: 'CDR 2025 (s. 232–234, 246), FAO-56 (Tab. 12 i 22), IUNG SMSR'
  },
  {
    id: 'kukurydza',
    nazwa_pl: 'Kukurydza na ziarno i kiszonkę',
    nazwa_en: 'Maize (grain / silage)',
    grupa: 'Zboża jare',
    okno_krytyczne_opis: '1. dekada lipca – 3. dekada sierpnia (wiechowanie, kwitnienie, nalewanie ziarna)',
    okno_krytyczne_gleba_lekka: 'Od 3. dekady czerwca – 3. dekada sierpnia',
    okno_start_mmdd: '07-01',
    okno_koniec_mmdd: '08-31',
    okno_zbior_start_mmdd: '09-10',
    okno_zbior_koniec_mmdd: '10-31',
    dopuszczalne_wyczerpanie_p: 0.50,
    glebokosc_korzeni_min_m: 1.0,
    glebokosc_korzeni_max_m: 1.7,
    glebokosc_efektywna_m: 0.9,
    kc_ini: 0.30,
    kc_mid: 1.20,
    kc_end: 0.45,
    prog_kbw_kat1_mm: -130,
    prog_kbw_kat2_mm: -160,
    wrazliwosc_na_susze: 'Bardzo wysoka',
    uwagi_fenologiczne: 'W maju i na początku czerwca rośliny są niskie (niskie NDVI z powodu odsłoniętej międzyrzędziowej gleby).',
    zrodlo: 'CDR 2025 (s. 228–230, 246), FAO-56 (Tab. 12 i 22), IUNG SMSR'
  },
  {
    id: 'ziemniak',
    nazwa_pl: 'Ziemniak średniowczesny',
    nazwa_en: 'Potato (mid-early)',
    grupa: 'Okopowe',
    okno_krytyczne_opis: '2. dekada czerwca – 3. dekada lipca (tuberyzacja, kwitnienie, przyrost bulw)',
    okno_krytyczne_gleba_lekka: 'Od 1. dekady czerwca – koniec lipca',
    okno_start_mmdd: '06-11',
    okno_koniec_mmdd: '07-31',
    okno_zbior_start_mmdd: '08-20',
    okno_zbior_koniec_mmdd: '10-10',
    dopuszczalne_wyczerpanie_p: 0.40,
    glebokosc_korzeni_min_m: 0.4,
    glebokosc_korzeni_max_m: 0.6,
    glebokosc_efektywna_m: 0.5,
    kc_ini: 0.50,
    kc_mid: 1.15,
    kc_end: 0.75,
    prog_kbw_kat1_mm: -120,
    prog_kbw_kat2_mm: -150,
    wrazliwosc_na_susze: 'Bardzo wysoka',
    uwagi_fenologiczne: 'Bardzo płytki system korzeniowy (0,4–0,6 m) i niskie dopuszczalne wyczerpanie (40% wg CDR / 35% FAO-56) wymagają częstszych, mniejszych dawek wody.',
    zrodlo: 'CDR 2025 (s. 230–231, 246), FAO-56 (Tab. 12 i 22)'
  },
  {
    id: 'burak_cukrowy',
    nazwa_pl: 'Burak cukrowy',
    nazwa_en: 'Sugar beet',
    grupa: 'Okopowe',
    okno_krytyczne_opis: '2. dekada czerwca – 3. dekada sierpnia (zakrywanie międzyrzędzi, intensywny przyrost korzenia)',
    okno_krytyczne_gleba_lekka: 'Od 2. dekady czerwca – 2. dekada września',
    okno_start_mmdd: '06-15',
    okno_koniec_mmdd: '08-31',
    okno_zbior_start_mmdd: '09-20',
    okno_zbior_koniec_mmdd: '11-15',
    dopuszczalne_wyczerpanie_p: 0.60,
    glebokosc_korzeni_min_m: 0.7,
    glebokosc_korzeni_max_m: 1.2,
    glebokosc_efektywna_m: 0.9,
    kc_ini: 0.35,
    kc_mid: 1.20,
    kc_end: 0.70,
    prog_kbw_kat1_mm: -140,
    prog_kbw_kat2_mm: -170,
    wrazliwosc_na_susze: 'Wysoka',
    uwagi_fenologiczne: 'Wysoka tolerancja na głębsze wyczerpanie zapasu wody (60% wg CDR), ale długie okno krytyczne w pełni lata.',
    zrodlo: 'CDR 2025 (s. 231–232, 246), FAO-56 (Tab. 12 i 22), IUNG SMSR'
  },
  {
    id: 'zyto_ozime',
    nazwa_pl: 'Żyto ozime / pszenżyto ozime',
    nazwa_en: 'Winter rye / triticale',
    grupa: 'Zboża ozime',
    okno_krytyczne_opis: '2. dekada maja – 3. dekada czerwca (kłoszenie i kwitnienie)',
    okno_krytyczne_gleba_lekka: 'Od 1. dekady maja – 3. dekada czerwca',
    okno_start_mmdd: '05-11',
    okno_koniec_mmdd: '06-30',
    okno_zbior_start_mmdd: '07-15',
    okno_zbior_koniec_mmdd: '08-15',
    dopuszczalne_wyczerpanie_p: 0.50,
    glebokosc_korzeni_min_m: 1.0,
    glebokosc_korzeni_max_m: 1.5,
    glebokosc_efektywna_m: 0.8,
    kc_ini: 0.40,
    kc_mid: 1.10,
    kc_end: 0.30,
    prog_kbw_kat1_mm: -130,
    prog_kbw_kat2_mm: -160,
    wrazliwosc_na_susze: 'Średnia',
    uwagi_fenologiczne: 'Najlepiej wykorzystuje wilgoć pozimową na glebach lekkich; silny spadek NDVI w lipcu to naturalne dojrzewanie.',
    zrodlo: 'CDR 2025 (s. 225–227, 246), FAO-56 (Tab. 12 i 22)'
  },
  {
    id: 'lucerna',
    nazwa_pl: 'Lucerna siewna / motylkowate wieloletnie',
    nazwa_en: 'Alfalfa (lucerne)',
    grupa: 'Pastewne / motylkowate',
    okno_krytyczne_opis: 'Cały sezon wegetacyjny (kwiecień – wrzesień), szczególnie odrastanie po pokosach',
    okno_krytyczne_gleba_lekka: 'Kwiecień – wrzesień (po każdym pokosie)',
    okno_start_mmdd: '04-15',
    okno_koniec_mmdd: '09-15',
    okno_zbior_start_mmdd: '05-20',
    okno_zbior_koniec_mmdd: '09-25',
    dopuszczalne_wyczerpanie_p: 0.60,
    glebokosc_korzeni_min_m: 1.0,
    glebokosc_korzeni_max_m: 2.0,
    glebokosc_efektywna_m: 1.2,
    kc_ini: 0.40,
    kc_mid: 1.15,
    kc_end: 1.05,
    prog_kbw_kat1_mm: -150,
    prog_kbw_kat2_mm: -180,
    wrazliwosc_na_susze: 'Umiarkowana',
    uwagi_fenologiczne: 'Głęboki system korzeniowy (do 2 m) zwiększa odporność; nagłe spadki NDVI w sezonie wynikają z kolejnych pokosów.',
    zrodlo: 'CDR 2025 (s. 246), FAO-56 (Tab. 12 i 22)'
  }
];
