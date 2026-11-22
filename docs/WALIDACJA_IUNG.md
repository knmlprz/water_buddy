# Walidacja Water Buddy — działki referencyjne

Punkt odniesienia: **IUNG-PIB SMSR** (System Monitoringu Suszy Rolniczej, oficjalny wg Rozp. MRiRW z 11.04.2019) — tabele dla gmin 2025 i progi KBW.
SMSR liczy KBW za okres 6 dekad na poziomie gminy i kategorii gleby; Water Buddy liczy KBW z 60 dni z ERA5 w punkcie działki. Różnice rzędu kilkunastu–kilkudziesięciu mm są możliwe; kierunek i rząd wielkości muszą się zgadzać.

## Przypadek A — SUSZA (test główny)

| Pole na stronie | Wartość |
|---|---|
| Numer działki | **080503_5.0006.74/4** |
| Uprawa | **Jęczmień jary** (zboża jare) |
| Data analizy | **2025-06-30** |

Działka: obręb Trześniów, gm. Ośno Lubuskie, pow. słubicki, woj. lubuskie; ok. 4,2 ha; środek ok. 52,4598 N, 14,8999 E.
Gleba: IUNG `katgl_landuse2024` = kategoria **I** we wszystkich 5 punktach próbnych w obrysie (najbardziej podatna na suszę, piaski).

Co mówi IUNG (raport 05, okres 1.V–30.VI.2025):
- zboża jare, kat. I: **zagrożenie suszą (+)** w raportach 01–06 (21.III–10.VII),
- zboża jare, kat. II: **+** w raportach 04–05; kat. III i IV: brak suszy,
- udział powierzchni gminy zagrożonej suszą dla zbóż jarych w raporcie 05: **96,2%** (najwyższy w woj. lubuskim),
- próg suszy zboża jare 1.V–30.VI: kat. I **−142 mm**, kat. II −161 mm, kat. III −191 mm,
- ⇒ KBW gminy 1.V–30.VI.2025 mieścił się w przedziale **(−191, −161] mm**.

Czego oczekujemy w raporcie Water Buddy:
- gleba lekka / piaszczysta, mały zapas wody (~10–70 mm w 0–50 cm),
- KBW 60 dni wyraźnie ujemny, orientacyjnie **−130 … −200 mm**,
- przyczyna „Opad i upał” aktywna (umiarkowana lub wysoka), uprawa **w oknie krytycznym** jęczmienia jarego,
- status co najmniej „podwyższone ryzyko” / poziom EDO ≥ obserwacja,
- historia 10 lat: kilka suchych sezonów (rejon chronicznie suchy),
- nawadnianie: TAK albo uzasadnione „blisko progu” — nie „gleba pełna wody”,
- grunt orny (nie las), brak Natura 2000 do sprawdzenia w raporcie.

## Przypadek B — BRAK SUSZY (kontrola)

| Pole na stronie | Wartość |
|---|---|
| Numer działki | **040704_2.0004.70/11** |
| Uprawa | **Pszenica ozima** (zboża ozime) |
| Data analizy | **2025-07-10** |

Działka: obręb Batkowo, gm. Inowrocław (wiejska), woj. kujawsko-pomorskie (przykład z ekranu startowego).

Co mówi IUNG (raport 06, 11.V–10.VII.2025):
- zboża ozime: **brak suszy (−)** na wszystkich kategoriach gleby; udział powierzchni zagrożonej 0,0%,
- jedyne zagrożenie w 2025 w tej gminie: raport 01 (do 20.V), kat. I, zboża ozime 2,9% / jare 8,9% pow.,
- próg zboża ozime 11.V–10.VII: kat. I −165 mm ⇒ KBW gminy był **wyższy niż −165 mm**.

Czego oczekujemy: brak alarmu/ostrzeżenia suszy, KBW > −165 mm, nawadnianie „nie teraz”. Wskazówki retencyjne z gleby/rowów mogą się pojawić — to nie jest błąd.

## Jak ocenić PDF
1. Czy działka, gmina i obrys się zgadzają (nie inna lokalizacja).
2. KBW i status vs oczekiwania powyżej (A: susza, B: brak suszy).
3. Gleba (kategoria) vs IUNG.
4. Czy przy brakach danych raport pisze „brak danych / nie oceniono”, a nie zera.
5. Czas analizy < 30 s.

Źródła:
- https://susza.iung.pulawy.pl/wykazy/2025,0805033/ (Ośno Lubuskie)
- https://susza.iung.pulawy.pl/wykazy/2025,0407042/ (Inowrocław, gm. wiejska)
- https://susza.iung.pulawy.pl/progi/ (progi KBW)
- https://susza.iung.pulawy.pl/komentarz/2025/ (komunikat: lubuskie 26,4% pow. zagrożonej dla zbóż jarych)

## Wyniki — 21.11.2026, wersja z gałęzi fix/p0-dane-i-uldk (testA.pdf, testB.pdf)

| | IUNG (referencja) | Water Buddy | Ocena |
|---|---|---|---|
| A: KBW 60 dni | (−191, −161] mm, próg kat. I −142 | −150 mm | ✅ ta sama strona progu (11–41 mm płycej) |
| A: gleba | kat. I | Piasek luźny, kat. I, ~10 mm | ✅ |
| A: werdykt | susza (+), 96% pow. gminy | Ostrzeżenie, „trudna gospodarka wodna”, nawadnianie ~10 mm | ✅ |
| B: KBW 60 dni | > −165 mm (brak suszy) | −165 mm | ✅ wartość zgodna |
| B: gleba | — | Pył zwykły (less), kat. IV, 275 mm TAW | — |
| B: werdykt | **brak suszy** na każdej kat. (próg kat. IV −251 mm) | **Ostrzeżenie, ryzyko 71/100, 7/10 lat suchych, TAK nawadniać 104 mm** | ❌ fałszywy alarm |

Przyczyny błędu B (kod):
1. `climateStats.ts:414` — próg suchego roku to tylko `prog_kbw_kat1/kat2` uprawy; less (kat. IV) oceniany progiem kat. II. IUNG ma progi per uprawa × kat. I–IV × 14 okresów (`/progi/`).
2. `computeFao56DailyDepletion` — brak współczynnika stresu Ks z FAO-56 (ETa = Ks·ETc po przekroczeniu RAW), więc wyczerpanie dochodzi do 100% nawet przy 275 mm zapasu.
3. Nagłówek łączy anomalię klimatyczną (SPI-3 −1,4) z oceną suszy rolniczej, bez progu glebowego.

Inne uwagi: spadek terenu A = 0,0% (podejrzane — NMT mógł nie odpowiedzieć, a pokazano 0 zamiast „brak”), brak zdjęcia Sentinel-2 w obu testach, cyfry w PDF nie dają się skopiować (fonty Type 3).

## Wyniki — powtórka po poprawkach IUNG/Ks (nowytestA.pdf, nowytestB.pdf, 21.11.2026 23:21)

| | IUNG (referencja) | Water Buddy | Ocena |
|---|---|---|---|
| A: werdykt | susza (+), próg kat. I −142 mm | **Susza rolnicza TAK** — KBW okresu 1.V–30.VI −154 mm vs −142 mm; ryzyko 98/100; nawadnianie TAK ~10 mm | ✅ |
| A: KBW okresu | (−191, −161] mm | −154 mm | ✅ ta sama strona progu (7–37 mm płycej) |
| B: werdykt | brak suszy (−), próg kat. IV −251 mm | **Susza rolnicza NIE** — KBW okresu 11.V–10.VII −168 mm vs −251 mm; „wymaga uwagi” 22/100; NIE TERAZ; 0/10 suchych lat | ✅ (wcześniej ❌) |
| B: KBW okresu | > −165 mm | −168 mm | ✅ w granicach różnicy ERA5 punkt vs gmina (3 mm) |

Pozostało: brak zdjęcia Sentinel-2 w obu PDF — przyczyną jest przepustowość hotspotu (~45 kB/s, scena ≈ 4 MB kafli COG), nie kod; na łączu sali te same sceny wczytały się w 12–13 s (A: NDVI 0,67 z 21.06, B: 0,61 z 05.07). Raport podaje teraz prawdziwą przyczynę zamiast „brak bezchmurnych zdjęć”.

## Przypadek C — WSZYSTKO W PORZĄDKU (kontrola „stabilna”)

| Pole na stronie | Wartość |
|---|---|
| Numer działki | **060404_2.0177.13/4** |
| Uprawa | **Burak cukrowy** |
| Data analizy | **2025-07-31** |

Działka: obręb Kozodawy, gm. Hrubieszów (wiejska), woj. lubelskie. Gleba IUNG kat. IV (less, 172 mm wody dostępnej w 0–50 cm), spadek ~1,7%.

Referencja IUNG 2025 (https://susza.iung.pulawy.pl/wykazy/2025,0604042/): **0,0% powierzchni zagrożonej suszą dla wszystkich upraw we wszystkich 14 okresach**. Open-Meteo: opad z 90 dni do 31.07.2025 wyższy niż w 9 z 10 lat 2015–2024.

Wynik silnika (z danymi z cache ERA5, 22.11.2026): „**Korzystne warunki wodne — stabilna gospodarka wodna**”, ryzyko 14/100; susza rolnicza IUNG **NIE** (KBW −57 mm vs próg −266 mm, okres 1.VI–31.VII); EDO „opady w normie” (SPI-3 +0,42, wilgotność gleby +2,1); 0/10 suchych lat; nawadnianie NIE (wyczerpanie 52% < próg 60%). Jedyne uwagi: rów ≤200 m (BDOT10k) i burak w oknie krytycznym — informacyjne, nie podnoszą oceny.

Poprawka przy okazji: okrywa gleby zgadnięta z kalendarza (gdy brak zdjęcia) nie jest już liczona do ryzyka; ogólne „warto obserwować” przy KBW < −50 mm nie pojawia się, gdy IUNG potwierdza brak suszy.

## Przypadek C — wynik ze strony (testc.pdf, komputer zespołu, Windows, 22.11.2026 00:11)

Zgodny z oczekiwaniem: „Korzystne warunki wodne — stabilna gospodarka wodna” 14/100; susza IUNG NIE (−57 vs −266 mm, kat. IV); EDO „Opady w normie” (SPI-3 0,4, wilgotność gleby 2,1); 0/10 suchych lat; NIE TERAZ (wyczerpanie 52% < 60%); okrywa „nieznana (brak świeżego zdjęcia)”. ✅

Satelita: dwie najnowsze sceny (31.07 częściowo, 21.07 całkowicie) są zachmurzone nad działką — komunikat był prawdziwy, ale 14.07 było w 100% czyste i nie było sprawdzane. Poprawka: kandydaci = 2 najnowsze sceny + najnowsza z zachmurzeniem < 15%. Po poprawce: C → NDVI 0,70 (14.07), A → NDVI 0,67 (21.06).
