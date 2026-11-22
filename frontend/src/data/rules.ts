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

export const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    id: 'R01_GRUNT_NIEROLNICZY',
    kolejnosc_kowr: 1,
    kategoria_kowr: 'Ograniczenie / weryfikacja',
    przyczyna: 'Ograniczenie prawne / środowiskowe',
    tytul: 'Działka poza gruntami ornymi (las, zabudowa, woda)',
    warunek_czytelny: 'uzytkowanie_gruntu != "grunt_orny"',
    warunek_kod: 'landUse !== "arable"',
    tekst_dla_rolnika:
      'Wskazana działka nie jest sklasyfikowana jako grunt orny. Raport nie wydaje rekomendacji agrotechnicznych ani melioracyjnych — warto zweryfikować numer działki lub użytek ewidencyjny przed podjęciem działań.',
    co_dodac_krotko: 'Weryfikacja numeru działki i użytku',
    uzasadnienie_naukowe:
      'Zasada wiarygodności KOWR: zalecenia polowe (np. orka, międzyplon, nawadnianie) na gruntach leśnych, wodnych lub zurbanizowanych są merytorycznie błędne.',
    zrodlo: 'KOWR pkt 3.3, EGiB / BDOT10k'
  },
  {
    id: 'R02_NATURA_2000_BLOKADA_PRAC_ZIEMNYCH',
    kolejnosc_kowr: 1,
    kategoria_kowr: 'Ograniczenie / weryfikacja',
    przyczyna: 'Ograniczenie prawne / środowiskowe',
    tytul: 'Działka w obszarze Natura 2000 lub formie ochrony przyrody',
    warunek_czytelny: 'natura2000 == true',
    warunek_kod: 'isNatura2000 === true',
    tekst_dla_rolnika:
      'Działka leży w zasięgu obszaru Natura 2000. Przed rozważeniem prac ziemnych (kopanie oczka wodnego, przebudowa rowu, piętrzenie) można rozważyć konsultację z RDOŚ i skupić się w pierwszej kolejności na bezinwazyjnych zabiegach glebowych (mulcz, międzyplony).',
    co_dodac_krotko: 'Konsultacja RDOŚ przed pracami ziemnymi',
    uzasadnienie_naukowe:
      'Prace hydrotechniczne na obszarach chronionych mogą wymagać decyzji środowiskowej i nie mogą pogarszać stanu siedlisk.',
    zrodlo: 'GDOŚ (Natura 2000), Ustawa o ochronie przyrody, CDR 2025'
  },
  {
    id: 'R03_FENOLOGIA_ZNIWA_NDVI',
    kolejnosc_kowr: 1,
    kategoria_kowr: 'Ograniczenie / weryfikacja',
    przyczyna: 'Fenologia / artefakt satelitarny',
    tytul: 'Ochrona przed fałszywym alarmem NDVI w oknie zbiorów',
    warunek_czytelny: 'data w oknie zbioru uprawy ORAZ NDVI < 0,35 ORAZ anomalia_NDVI < -1,0',
    warunek_kod: 'inHarvestWindow && ndvi < 0.35 && ndviAnomaly < -1.0',
    tekst_dla_rolnika:
      'Obserwowany niski wskaźnik zieleni (NDVI) przypada na typowy termin dojrzewania lub zbioru wybranej uprawy. Nie należy interpretować go samodzielnie jako suszy — kluczowe pozostają wskaźniki pogodowe (KBW, SPI-3) oraz wilgotność gleby.',
    co_dodac_krotko: 'Odróżnienie żniw od stresu wodnego',
    uzasadnienie_naukowe:
      'Dojrzewające zboża i rzepak oraz ściernisko po zbiorze dają NDVI w zakresie 0,10–0,30 identycznym jak silny stres suszowy.',
    zrodlo: 'POLSA 2024 (s. 293), CDR 2025 (fenologia upraw)'
  },
  {
    id: 'R04_STOK_BEZ_OKRYWY_KBW',
    kolejnosc_kowr: 2,
    kategoria_kowr: 'Retencja krajobrazowa (NWRM)',
    przyczyna: 'Spływ powierzchniowy',
    tytul: 'Stok > 4% bez okrywy przy ujemnym KBW — pas buforowy, międzyplon lub mulcz',
    warunek_czytelny: 'spadek_terenu > 4% ORAZ gleba_bez_okrywy == true ORAZ KBW < −50 mm',
    warunek_kod: 'slopePct > 4 && !hasSoilCover && kbwMm < -50',
    tekst_dla_rolnika:
      'Na tej działce nachylenie stoku przekracza 4%, a nieosłonięta gleba przy ujemnym bilansie wodnym (< −50 mm) przyspiesza spływ wody opadowej i parowanie. Można rozważyć dodanie trawiastego pasa buforowego u podnóża stoku, siew międzyplonu okrywowego albo pozostawienie mulczu z resztek pożniwnych.',
    co_dodac_krotko: 'Pas buforowy, międzyplon lub mulcz',
    uzasadnienie_naukowe:
      'Na stokach > 4% nawalne deszcze spływają powierzchniowo zamiast wsiąkać; mulcz ogranicza parowanie nawet o blisko 60% i spowalnia spływ, a pasy buforowe (NWRM) zatrzymują wodę i glebę w miejscu opadu.',
    zrodlo: 'CDR 2025 (s. 66, 99–106), UE NWRM (Buffer Strips & Cover Crops)'
  },
  {
    id: 'R05_ROW_MELIORACYJNY_ZASTAWKA',
    kolejnosc_kowr: 2,
    kategoria_kowr: 'Retencja krajobrazowa (NWRM)',
    przyczyna: 'Spływ powierzchniowy',
    tytul: 'Istniejący rów melioracyjny w pobliżu działki — sterowanie odpływem',
    warunek_czytelny: 'odleglosc_do_rowu_m <= 500 ORAZ (KBW < −50 mm LUB SPI-3 < −1,0) ORAZ !natura2000',
    warunek_kod: 'ditchDistanceM <= 500 && (kbwMm < -50 || spi3 < -1.0) && !isNatura2000',
    tekst_dla_rolnika:
      'W promieniu 500 m od działki zidentyfikowano rów lub ciek. Warto sprawdzić, czy urządzenia melioracyjne są sprawne i czy nie odprowadzają wody zbyt szybko wiosną — można rozważyć czasowe przymknięcie istniejących zastawek lub konsultację ze spółką wodną w sprawie retencji korytowej.',
    co_dodac_krotko: 'Przegląd rowu i spowolnienie odpływu zastawką',
    uzasadnienie_naukowe:
      'Systemy melioracyjne w Polsce projektowano głównie pod odwodnienie; zamiana na meliorację dwufunkcyjną (zastawki piętrzące) podnosi poziom wód gruntowych na przyległych polach.',
    zrodlo: 'CDR 2025 (rozdz. Melioracje i retencja korytowa), ISOK / BDOT10k'
  },
  {
    id: 'R06_ZAGLEBIENIE_OCZKO_WODNE',
    kolejnosc_kowr: 2,
    kategoria_kowr: 'Retencja krajobrazowa (NWRM)',
    przyczyna: 'Spływ powierzchniowy',
    tytul: 'Naturalne zagłębienie terenu — małe oczko wodne lub mikroretencja',
    warunek_czytelny: 'ma_zaglebienie_terenu == true ORAZ czestosc_lat_suchych_10l >= 4 ORAZ !natura2000',
    warunek_kod: 'hasDepression && dryYearsLast10 >= 4 && !isNatura2000',
    tekst_dla_rolnika:
      'Rzeźba terenu wskazuje lokalne zagłębienie, a w ostatnich 10 latach niedobory występowały tu często. Można rozważyć zachowanie lub odtworzenie śródpolnego oczka wodnego albo niecki retencyjnej w najniższym punkcie działki, aby zatrzymywać wodę z wiosennych roztopów.',
    co_dodac_krotko: 'Oczko wodne lub niecka retencyjna w zagłębieniu',
    uzasadnienie_naukowe:
      'Zasada UE NWRM „retain water where it falls”: małe zbiorniki śródpolne poprawiają mikroklimat, zasilają wody podpowierzchniowe i redukują odpływ ze zlewni.',
    zrodlo: 'UE NWRM (Small Retention Ponds), CDR 2025, NMT GUGiK'
  },
  {
    id: 'R07_ZADRZEWIENIA_WIATROCHRONNE',
    kolejnosc_kowr: 2,
    kategoria_kowr: 'Retencja krajobrazowa (NWRM)',
    przyczyna: 'Opad i upał',
    tytul: 'Wysoka ewapotranspiracja i powtarzające się susze — pasy zadrzewień',
    warunek_czytelny: 'czestosc_lat_suchych_10l >= 5 ORAZ (KBW < −80 mm LUB SPI-3 < −1,0)',
    warunek_kod: 'dryYearsLast10 >= 5 && (kbwMm < -80 || spi3 < -1.0)',
    tekst_dla_rolnika:
      'Działka leży w strefie częstych niedoborów wody (co najmniej połowa z ostatnich 10 lat była sucha). W perspektywie wieloletniej można rozważyć dodanie na miedzy lub granicy pola pasa zadrzewień lub zakrzewień śródpolnych, które osłabiają wiatr i zmniejszają parowanie z pola.',
    co_dodac_krotko: 'Pas zadrzewień lub zakrzewień na granicy pola',
    uzasadnienie_naukowe:
      'Zadrzewienia śródpolne (NWRM) redukują prędkość wiatru przy powierzchni łanu, obniżając ewapotranspirację potencjalną oraz zatrzymując śnieg zimą.',
    zrodlo: 'UE NWRM (Hedgerows / Shelterbelts), CDR 2025 (retencja krajobrazowa)'
  },
  {
    id: 'R08_GLEBA_LEKKA_MATERIA_ORGANICZNA',
    kolejnosc_kowr: 3,
    kategoria_kowr: 'Retencja glebowa i agrotechnika',
    przyczyna: 'Słaba retencja gleby',
    tytul: 'Gleba bardzo lekka lub lekka (AWC <= 70 mm) — zwiększenie materii organicznej',
    warunek_czytelny: 'woda_dostepna_50cm_mm <= 70 (piasek luźny lub gliniasty) ORAZ KBW < −50 mm',
    warunek_kod: 'soilAwcMm <= 70 && kbwMm < -50',
    tekst_dla_rolnika:
      'Gleba na tej działce magazynuje zaledwie ok. 10–70 mm wody dostępnej w warstwie 0–50 cm, dlatego przesycha wielokrotnie szybciej niż gleby gliniaste i pyłowe. Można rozważyć systematyczne dokładanie materii organicznej (słoma pocięta, obornik, kompost, międzyplony), aby stopniowo zwiększać pojemność wodną gleby.',
    co_dodac_krotko: 'Materia organiczna (słoma, kompost, międzyplon)',
    uzasadnienie_naukowe:
      'Według tabeli van Genuchtena (CDR tab. 12) piasek luźny zatrzymuje ~10 mm, a piasek gliniasty ~70 mm wody wobec 172 mm w lessie. Wzrost zawartości próchnicy bezpośrednio zwiększa retencję warstwy ornej.',
    zrodlo: 'CDR 2025 (tab. 12, s. 99–106), IUNG-PIB'
  },
  {
    id: 'R09_MULCZ_RESZTKI_POZNIWNE',
    kolejnosc_kowr: 3,
    kategoria_kowr: 'Retencja glebowa i agrotechnika',
    przyczyna: 'Opad i upał',
    tytul: 'Ograniczenie parowania z odkrytej gleby — mulczowanie resztkami pożniwnymi',
    warunek_czytelny: 'gleba_bez_okrywy == true ORAZ (KBW < −50 mm LUB SPI-3 < −1,0)',
    warunek_kod: '!hasSoilCover && (kbwMm < -50 || spi3 < -1.0)',
    tekst_dla_rolnika:
      'Odkryta powierzchnia gleby przy wysokim parowaniu traci wilgoć najszybciej. Można rozważyć pozostawienie rozdrobnionych resztek pożniwnych (mulczu) na powierzchni pola lub szybki siew międzyplonu po zbiorze zamiast utrzymywania czarnego ugoru.',
    co_dodac_krotko: 'Pozostawienie mulczu / okrywy pożniwnej',
    uzasadnienie_naukowe:
      'Według poradnika CDR (2025) warstwa mulczu ogranicza parowanie fizyczne z powierzchni gleby nawet o blisko 60% i obniża temperaturę wierzchniej warstwy gleby.',
    zrodlo: 'CDR 2025 (s. 99–103)'
  },
  {
    id: 'R10_UPRAWA_KONSERWUJACA_BEZ_ORKI',
    kolejnosc_kowr: 3,
    kategoria_kowr: 'Retencja glebowa i agrotechnika',
    przyczyna: 'Opad i upał',
    tytul: 'Ograniczenie intensywnej orki w okresie niedoboru wilgoci',
    warunek_czytelny: 'poziom_EDO >= obserwacja (SPI-3 < −1 lub SMA < −1) LUB KBW < −70 mm',
    warunek_kod: '(edoLevel !== "brak" || kbwMm < -70) && landUse === "arable"',
    tekst_dla_rolnika:
      'Przy obecnym deficycie wilgoci każdy głęboki przejazd odwracający glebę dodatkowo ją przesusza. W najbliższych zabiegach można rozważyć ograniczenie liczby przejazdów, płytkie spulchnienie zamiast głębokiej orki lub przejście na uprawę pasową / bezorkową na części pola.',
    co_dodac_krotko: 'Uprawa uproszczona / ograniczenie orki',
    uzasadnienie_naukowe:
      'Odwracanie skiby (orka) przerywa podsiąk kapilarny i wystawia wilgotne warstwy na bezpośrednie parowanie; uprawa konserwująca chroni wilgoć pozimową i pożniwną.',
    zrodlo: 'CDR 2025 (s. 102–106)'
  },
  {
    id: 'R11_GLEBOSZOWANIE_GLEBA_CIEZKA',
    kolejnosc_kowr: 3,
    kategoria_kowr: 'Retencja glebowa i agrotechnika',
    przyczyna: 'Słaba retencja gleby',
    tytul: 'Gleba średnia lub ciężka przy deficycie — sprawdzenie podeszwy płużnej',
    warunek_czytelny: 'grupa_gleby in [glina_lekka, glina_zwykla, pyl_zwykly] ORAZ (SMA < −1,0 LUB spadek > 3%)',
    warunek_kod: '["glina_lekka", "glina_zwykla", "pyl_zwykly"].includes(soilId) && (sma < -1.0 || slopePct > 3)',
    tekst_dla_rolnika:
      'Na glebach gliniastych i pyłowych woda często stoi po deszczu na powierzchni zamiast wsiąkać głębiej z powodu zagęszczonej warstwy podornej. Można rozważyć kontrolę profilu szpadlem (czy występuje podeszwa płużna) i w razie potrzeby punktowe głęboszowanie poza okresem skrajnej suszy lub siew międzyplonu o palowym korzeniu (np. rzodkiew oleista).',
    co_dodac_krotko: 'Kontrola podeszwy płużnej / głęboszowanie',
    uzasadnienie_naukowe:
      'Rozbicie podeszwy płużnej na glebach średnich i ciężkich zwiększa infiltrację i pozwala korzeniom sięgnąć po wodę z głębszych warstw profilu.',
    zrodlo: 'CDR 2025 (s. 104–106)'
  },
  {
    id: 'R12_UPRAWA_OKNO_KRYTYCZNE_OCHRONA',
    kolejnosc_kowr: 3,
    kategoria_kowr: 'Retencja glebowa i agrotechnika',
    przyczyna: 'Wrażliwa uprawa',
    tytul: 'Wybrana uprawa znajduje się w oknie krytycznym zapotrzebowania na wodę',
    warunek_czytelny: 'w_oknie_krytycznym_uprawy == true ORAZ (KBW < −50 mm LUB poziom_EDO >= obserwacja)',
    warunek_kod: 'inCriticalWindow && (kbwMm < -50 || edoLevel !== "brak")',
    tekst_dla_rolnika:
      'Wybrana uprawa jest obecnie w fazie krytycznej zapotrzebowania na wodę, kiedy deficyt wilgoci najsilniej ogranicza rozwój roślin. W tym tygodniu warto unikać zabiegów nasilających stres (np. nawożenia w upale bez prognozy opadu) i dokładnie ocenić wilgotność w strefie korzeniowej.',
    co_dodac_krotko: 'Ochrona łanu w oknie krytycznym (unikanie dodatkowego stresu)',
    uzasadnienie_naukowe:
      'Niedobór wody w oknie krytycznym (kłoszenie zbóż, kwitnienie rzepaku/kukurydzy, tuberyzacja ziemniaka) wywołuje nieodwracalny spadek potencjału rośliny.',
    zrodlo: 'CDR 2025 (s. 225–234), FAO-56'
  },
  {
    id: 'R13_NAWADNIANIE_OPCJONALNE_WYCZERPANIE_RAW',
    kolejnosc_kowr: 4,
    kategoria_kowr: 'Nawadnianie (opcjonalne)',
    przyczyna: 'Wrażliwa uprawa',
    tytul: 'Opcjonalne nawadnianie — wyczerpanie zapasu wody łatwo dostępnej (metoda Drupki / FAO-56)',
    warunek_czytelny: 'w_oknie_krytycznym_uprawy == true ORAZ wyczerpanie_wody >= dopuszczalne_p ORAZ (poziom_EDO >= ostrzezenie LUB KBW < −80 mm)',
    warunek_kod: 'inCriticalWindow && depletionFraction >= crop.dopuszczalne_wyczerpanie_p && (edoLevel === "ostrzezenie" || edoLevel === "alarm" || kbwMm < -80)',
    tekst_dla_rolnika:
      'Zapas wody łatwo dostępnej w strefie korzeni zbliża się do progu dopuszczalnego wyczerpania dla tej uprawy. Jeśli gospodarstwo dysponuje legalnym ujęciem wody i infrastrukturą, można rozważyć nawadnianie interwencyjne w dawce orientacyjnej równej ok. 75% dawki maksymalnej do PPW (wyliczonej w kalkulatorze poniżej), najlepiej wieczorem lub nocą dla ograniczenia strat na parowanie.',
    co_dodac_krotko: 'Opcjonalna dawka 0,75 × dawka max do PPW (noc/wieczór)',
    uzasadnienie_naukowe:
      'Metoda bilansu dziennego Drupki / FAO-56 (stosowana m.in. w systemie „Woda dla Kujaw”): uzupełnienie do ~75% dawki maksymalnej zostawia rezerwę retencyjną na ewentualny opad naturalny i zapobiega przesiąkaniu w głąb profilu.',
    zrodlo: 'CDR 2025 (s. 243–252), FAO-56 (rozdz. 8)'
  },
  {
    id: 'R14_NAWADNIANIE_BRAK_UZASADNIENIA',
    kolejnosc_kowr: 4,
    kategoria_kowr: 'Nawadnianie (opcjonalne)',
    przyczyna: 'Opad i upał',
    tytul: 'Brak uzasadnienia dla nawadniania (zapas wody wystarczający lub poza oknem krytycznym)',
    warunek_czytelny: '(!w_oknie_krytycznym_uprawy LUB wyczerpanie_wody < dopuszczalne_p) ORAZ poziom_EDO != alarm',
    warunek_kod: '(!inCriticalWindow || depletionFraction < crop.dopuszczalne_wyczerpanie_p) && edoLevel !== "alarm"',
    tekst_dla_rolnika:
      'Na wybraną datę dane nie wskazują pilnej potrzeby nawadniania (zapas wody w profilu nie przekroczył progu wyczerpania lub uprawa jest poza oknem krytycznym). Priorytetem pozostaje zatrzymywanie opadu w glebie i krajobrazie.',
    co_dodac_krotko: 'Wstrzymanie nawadniania — priorytet dla retencji',
    uzasadnienie_naukowe:
      'Zgodnie z wytycznymi KOWR nawadnianie jest narzędziem ostatecznym i opcjonalnym; nieuzasadnione deszczowanie zwiększa koszty i obciąża zasoby wód podziemnych.',
    zrodlo: 'KOWR Załącznik nr 1, CDR 2025 (s. 243–246)'
  },
  {
    id: 'R15_NDMI_STRES_UKRYTY',
    kolejnosc_kowr: 3,
    kategoria_kowr: 'Retencja glebowa i agrotechnika',
    przyczyna: 'Opad i upał',
    tytul: 'Wczesny stres wodny w tkankach roślin (NDMI < 0 przy umiarkowanym/dobrym NDVI)',
    warunek_czytelny: 'NDVI >= 0,40 ORAZ NDMI < 0,0 ORAZ !w_oknie_zbioru',
    warunek_kod: 'ndvi >= 0.40 && ndmi < 0.0 && !inHarvestWindow',
    tekst_dla_rolnika:
      'Łan jest jeszcze zielony (NDVI ≥ 0,40), ale wskaźnik wilgotności roślin NDMI spadł poniżej zera — to wczesny sygnał utraty turgoru przed widocznym żółknięciem. Warto przeprowadzić lustrację polową w godzinach popołudniowych i nie opóźniać działań ograniczających parowanie.',
    co_dodac_krotko: 'Lustracja polowa pod kątem wczesnego stresu turgorowego',
    uzasadnienie_naukowe:
      'Pasmo SWIR1 (B11 Sentinel-2) reaguje na zawartość wody w liściach szybciej niż pasma widzialne odpowiedzialne za chlorofil (NDVI).',
    zrodlo: 'POLSA 2024 (s. 293), Sentinel-2 L2A (B08, B11)'
  },
  {
    id: 'R16_CHMURY_BRAK_SATELITY',
    kolejnosc_kowr: 1,
    kategoria_kowr: 'Ograniczenie / weryfikacja',
    przyczyna: 'Fenologia / artefakt satelitarny',
    tytul: 'Brak świeżych bezchmurnych zdjęć satelitarnych (> 14 dni)',
    warunek_czytelny: 'wiek_sceny_satelitarnej_dni > 14 LUB brak_sceny_bezchmurnej',
    warunek_kod: 'satelliteAgeDays === null || satelliteAgeDays > 14',
    tekst_dla_rolnika:
      'Brak bezchmurnych zdjęć Sentinel-2 z ostatnich 14 dni dla tej działki — ocena opiera się głównie na bilansie pogodowym (KBW, SPI) oraz właściwościach gleby i rzeźby terenu, bez potwierdzenia satelitarnego kondycji łanu.',
    co_dodac_krotko: 'Weryfikacja wizualna łanu w terenie',
    uzasadnienie_naukowe:
      'Zasada KOWR: brak aktualnych danych satelitarnych komunikujemy wprost zamiast interpolować lub zgadywać stan roślin.',
    zrodlo: 'KOWR pkt 3.3, Sentinel-2 L2A (maska chmur SCL)'
  }
];
