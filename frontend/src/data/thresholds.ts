export interface EdoLadderLevel {
  poziom: 'nie_wiemy' | 'brak' | 'obserwacja' | 'ostrzezenie' | 'alarm';
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

export const EDO_LADDER: EdoLadderLevel[] = [
  {
    poziom: 'nie_wiemy',
    nazwa_pl: 'Brak wskaźnika opadu',
    nazwa_edo: 'poza drabiną',
    warunek_logiczny: 'Brak SPI-1 albo SPI-3 dla wybranego dnia',
    opis_dla_rolnika:
      'Bez wskaźnika opadu nie stawiam obserwacji, ostrzeżenia ani alarmu. Sam niedobór w milimetrach nie jest szczeblem.',
    zrodlo: 'POLSA 2024 (tab. 6.4)'
  },
  {
    poziom: 'brak',
    nazwa_pl: 'Sytuacja w normie',
    nazwa_edo: 'Normal / No Drought',
    warunek_logiczny: 'SPI-3 >= -1,0 oraz SPI-1 >= -2,0 (i brak anomalii wilgotności gleby)',
    opis_dla_rolnika: 'Warunki opadowe i wilgotnościowe mieszczą się w wieloletniej normie dla tego okresu.',
    zrodlo: 'POLSA 2024 (tab. 6.4), Copernicus EDO CDI v4.1'
  },
  {
    poziom: 'obserwacja',
    nazwa_pl: 'Obserwacja (niedobór opadów)',
    nazwa_edo: 'Watch',
    warunek_logiczny: 'SPI-3 < -1,0 LUB SPI-1 < -2,0',
    opis_dla_rolnika: 'Występuje istotny niedobór opadów. Warto monitorować wilgotność warstwy ornej i unikać zabiegów przesuszających glebę.',
    zrodlo: 'POLSA 2024 (tab. 6.4, s. 288), WMO (2010), Copernicus EDO'
  },
  {
    poziom: 'ostrzezenie',
    nazwa_pl: 'Ostrzeżenie (deficyt wilgoci w glebie)',
    nazwa_edo: 'Warning',
    warunek_logiczny: '(SPI-3 < -1,0 LUB SPI-1 < -2,0) ORAZ SMA < -1,0',
    opis_dla_rolnika: 'Niedobór opadów przełożył się na wyraźny spadek wilgotności gleby (anomalia SMA poniżej −1). Rośliny w oknie krytycznym są zagrożone stresem.',
    zrodlo: 'POLSA 2024 (tab. 6.4), Copernicus EDO CDI v4.1'
  },
  {
    poziom: 'alarm',
    nazwa_pl: 'Alarm (stres wegetacji potwierdzony satelitarnie)',
    nazwa_edo: 'Alert',
    warunek_logiczny: '(SPI-3 < -1,0 LUB SPI-1 < -2,0) ORAZ SMA < -1,0 ORAZ anomalia NDVI/ΔFAPAR < -1,0 (poza oknem żniw)',
    opis_dla_rolnika: 'Potwierdzono łączny niedobór opadu, spadek wilgotności gleby oraz osłabienie kondycji łanu w danych satelitarnych.',
    zrodlo: 'POLSA 2024 (tab. 6.4), Copernicus EDO CDI v4.1'
  }
];

export const NDVI_CLASSES: NdviClass[] = [
  {
    klasa: 'gleba_lub_brak_okrywy',
    zakres_min: -0.1,
    zakres_max: 0.2,
    etykieta_zakresu: '−0,10 do 0,20 (gleba: −0,10 do 0,10)',
    interpretacja: 'Gleba odkryta, wczesne wschody lub pole po zbiorze / orce.',
    uwaga_ndmi_fenologia: 'Zawsze zestawić z fazą uprawy (wiosną w kukurydzy lub w lipcu po żniwach zbóż niskie NDVI jest normalne).',
    zrodlo: 'POLSA 2024 (s. 293), Sentinel-2 L2A (B08, B04)'
  },
  {
    klasa: 'slaba_kondycja',
    zakres_min: 0.2,
    zakres_max: 0.4,
    etykieta_zakresu: '0,20 – 0,40',
    interpretacja: 'Słaba kondycja roślinności lub rzadki, niezwierający międzyrzędzi łan.',
    uwaga_ndmi_fenologia: 'Sprawdzić NDMI = (B08−B11)/(B08+B11); wartości NDMI < 0,0 wskazują na deficyt wody w tkankach roślin.',
    zrodlo: 'POLSA 2024 (s. 293), Sentinel-2 L2A (B08, B04, B11)'
  },
  {
    klasa: 'umiarkowana_kondycja',
    zakres_min: 0.4,
    zakres_max: 0.6,
    etykieta_zakresu: '0,40 – 0,60',
    interpretacja: 'Umiarkowana kondycja roślinności — możliwy narastający stres lub faza przejściowa rozwoju.',
    uwaga_ndmi_fenologia: 'Porównać z wieloletnią medianą działki dla tej samej dekady (anomalia NDVI) oraz z MSI = B11 / B08.',
    zrodlo: 'POLSA 2024 (s. 293), Sentinel-2 L2A'
  },
  {
    klasa: 'dobra_kondycja',
    zakres_min: 0.6,
    zakres_max: 1.0,
    etykieta_zakresu: '> 0,60',
    interpretacja: 'Dobra kondycja i zwarty, intensywnie fotosyntetyzujący łan.',
    uwaga_ndmi_fenologia: 'W pełni sezonu przy wysokim NDVI warto kontrolować NDMI (> 0,20 optymalne), aby wychwycić wczesny stres przed żółknięciem.',
    zrodlo: 'POLSA 2024 (s. 293), Sentinel-2 L2A'
  }
];

export const KBW_THRESHOLDS: KbwThreshold[] = [
  {
    id: 'kbw_norma',
    poziom: 'Bilans dodatni lub zrównoważony',
    zakres_mm: '>= −50 mm',
    prog_gorny_mm: 0,
    okno_czasowe: '30 dni / 6 dekad',
    znaczenie_agronomiczne: 'Brak sygnału istotnego niedoboru klimatycznego; opad równoważy ewapotranspirację potencjalną.',
    zrodlo: 'CDR 2025 (s. 66), IUNG-PIB SMSR'
  },
  {
    id: 'kbw_poczatek',
    poziom: 'Sygnał początku suszy',
    zakres_mm: '−50 do −100 mm',
    prog_gorny_mm: -50,
    okno_czasowe: 'okres 6 dekad (21.03–30.09)',
    znaczenie_agronomiczne: 'Wartości poniżej −50 mm mogą sygnalizować początek suszy — szczególnie na glebach piaszczystych (kat. I) i stokach bez okrywy.',
    zrodlo: 'CDR 2025 (s. 66)'
  },
  {
    id: 'kbw_susza_kat1',
    poziom: 'Próg suszy rolniczej na glebach bardzo lekkich (kat. I)',
    zakres_mm: '< −100 do −130 mm (zależnie od uprawy)',
    prog_gorny_mm: -100,
    okno_czasowe: '6 dekad między 21.03 a 30.09',
    znaczenie_agronomiczne: 'Ustawowa definicja suszy rolniczej IUNG dla zbóż jarych (−100 mm), ozimych i rzepaku (−120 mm) oraz kukurydzy (−130 mm) na glebach kategorii I.',
    zrodlo: 'CDR 2025 (s. 66), IUNG-PIB SMSR (Dz.U. próg suszy rolniczej)'
  },
  {
    id: 'kbw_susza_kat2_3',
    poziom: 'Próg głębokiej suszy (gleby lekkie kat. II i średnie kat. III)',
    zakres_mm: '< −150 do −210 mm',
    prog_gorny_mm: -150,
    okno_czasowe: '6 dekad między 21.03 a 30.09',
    znaczenie_agronomiczne: 'Deficyt obejmuje już gleby lekkie (kat. II, od ok. −130/−150 mm) oraz średnie (kat. III, od ok. −180/−210 mm).',
    zrodlo: 'IUNG-PIB SMSR, CDR 2025 (s. 66)'
  }
];

export const SOIL_WATER_GROUPS: SoilWaterGroup[] = [
  {
    id: 'piasek_luzny',
    grupa_uziarnienia: 'Piasek luźny',
    kategoria_iung: 'I (bardzo lekka)',
    ppw_pct_obj: 7.0,
    phw_pct_obj: 5.0,
    pw_pct_obj: 5.0,
    woda_dostepna_50cm_mm: 10,
    woda_latwo_dostepna_50cm_mm: 10,
    tempo_przesychania: 'Ekstremalnie szybkie (2–4 dni bez opadu w upale wyczerpują zapas)',
    zrodlo: 'CDR 2025 (tab. 12, model van Genuchtena); (7,0−5,0)% × 500 mm = 10 mm'
  },
  {
    id: 'piasek_gliniasty',
    grupa_uziarnienia: 'Piasek gliniasty',
    kategoria_iung: 'II (lekka)',
    ppw_pct_obj: 19.4,
    phw_pct_obj: 8.1,
    pw_pct_obj: 5.5,
    woda_dostepna_50cm_mm: 70,
    woda_latwo_dostepna_50cm_mm: 57,
    tempo_przesychania: 'Szybkie (ok. 10–14 dni bez opadu latem przy ET0 ~4–5 mm/d)',
    zrodlo: 'CDR 2025 (tab. 12, model van Genuchtena); (19,4−5,5)% × 500 mm = 69,5 ≈ 70 mm'
  },
  {
    id: 'glina_lekka',
    grupa_uziarnienia: 'Glina lekka',
    kategoria_iung: 'III (średnia)',
    ppw_pct_obj: 24.5,
    phw_pct_obj: 11.9,
    pw_pct_obj: 7.2,
    woda_dostepna_50cm_mm: 87,
    woda_latwo_dostepna_50cm_mm: 63,
    tempo_przesychania: 'Umiarkowane (ok. 15–18 dni buforowania w warstwie 0–50 cm)',
    zrodlo: 'CDR 2025 (tab. 12, model van Genuchtena); (24,5−7,2)% × 500 mm = 86,5 ≈ 87 mm'
  },
  {
    id: 'glina_zwykla',
    grupa_uziarnienia: 'Glina zwykła',
    kategoria_iung: 'III (średnia)',
    ppw_pct_obj: 33.0,
    phw_pct_obj: 17.8,
    pw_pct_obj: 11.1,
    woda_dostepna_50cm_mm: 110,
    woda_latwo_dostepna_50cm_mm: 76,
    tempo_przesychania: 'Powolne, ale podatna na zaskorupianie i podeszwę płużną',
    zrodlo: 'CDR 2025 (tab. 12, model van Genuchtena); (33,0−11,1)% × 500 mm = 109,5 ≈ 110 mm'
  },
  {
    id: 'pyl_zwykly',
    grupa_uziarnienia: 'Pył zwykły (less)',
    kategoria_iung: 'IV (ciężka / pyłowa)',
    ppw_pct_obj: 41.9,
    phw_pct_obj: 16.3,
    pw_pct_obj: 7.5,
    woda_dostepna_50cm_mm: 172,
    woda_latwo_dostepna_50cm_mm: 128,
    tempo_przesychania: 'Bardzo duża pojemność retencyjna (17× większa niż na piasku luźnym), wrażliwa na erozję wodną na stokach',
    zrodlo: 'CDR 2025 (tab. 12, model van Genuchtena); (41,9−7,5)% × 500 mm = 172 mm'
  }
];

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
