# Water Buddy: plan strony (notatka dla dewelopera)

Ta notatka opisuje układ ekranów i to, skąd bierze się każda liczba w raporcie. Wiedza merytoryczna jest już w `public/data/*.json` (uprawy, progi, reguły, ograniczenia, API), a silnik w `src/engine/waterBrain.ts`. Brakuje głównie jednego: **policzenia wejść silnika z prawdziwych danych dla dowolnej działki i daty**, oraz ekranu raportu dla rolnika.

## 0. Zasady, których nie łamiemy

1. **Wszystko liczone na żywo.** Żadnych gotowych wyników dla przykładowych działek, bo to wymóg KOWR (pkt 3.3.4). Cache jest dozwolony, gotowe odpowiedzi nie.
2. **Data analizy obowiązuje wszędzie.** Każde zapytanie odcina dane po dacie X: pogodę, sceny Sentinel-2 i historię. Jury testuje daty z ostatnich 10 lat.
3. **Kolejność w raporcie:** stan → przyczyny → retencja → agrotechnika → nawadnianie. Kolejność bierzemy z pola `kolejnosc_kowr` w `rules.json`.
4. **Tu i teraz na górze**, szczegóły do rozwinięcia. Rolnik ma zrozumieć pierwszy ekran bez przewijania.
5. **Ton sugestii, nie poleceń.** Teksty bierzemy z `tekst_dla_rolnika` i nie przepisujemy ich w kodzie.
6. **Brak danych pokazujemy wprost.** Zamiast „null” albo zgadywania wyświetlamy komunikat i zdanie z `limitations.json`.
7. **Do 30 s na działkę.** Źródła pobieramy równolegle, a na ekranie widać postęp.
8. **LLM (Gemini) nie wydaje rekomendacji.** Rekomendacje wynikają z reguł. Jeśli w ogóle użyjemy AI, to tylko do opcjonalnego uproszczenia języka, z opisem w README.

## 1. Mapa stron

| Ścieżka | Dla kogo | Zawartość |
| --- | --- | --- |
| `/` | rolnik | Start: działka, uprawa, data |
| `/raport?id=…&uprawa=…&data=…` | rolnik, jury | Raport. URL zawiera wszystkie parametry, więc link można udostępnić i odtworzyć wynik |
| `/metodyka` | jury, doradca | Obecne widoki: Uprawy, Progi, Reguły, Źródła API, Ograniczenia. Przenosimy je tu z głównego menu |

Obecny `SimulatorView` z suwakami zostaje jako narzędzie wewnętrzne do testów (`/metodyka/symulator`). Rolnik go nie widzi.

## 2. Ekran startowy `/`

Jedna kolumna, maksymalnie 3 pola, duże przyciski (działa też na telefonie).

1. **Działka.** Dwie zakładki:
   - „Mam numer”: pole na identyfikator TERYT, na przykład `040701_1.0081.11/74`, z podpowiedzią formatu.
   - „Wskażę na mapie”: mapa Polski (Leaflet + podkład OSM lub ortofotomapa GUGiK WMTS). Kliknięcie wywołuje ULDK `GetParcelByXY`, a obrys działki od razu rysuje się na mapie.
   - Po znalezieniu działki pokazujemy: „Działka 11/74, obręb Inowrocław 81, gm. Inowrocław” i obrys na mapie. Rolnik potwierdza, że to ta działka.
2. **Uprawa.** 8 kafelków z ikoną i nazwą z `crops.json`. Domyślnie bez wyboru.
3. **Data analizy.** Domyślnie dziś. Pod „Zmień datę” zakres od dziś minus 10 lat do dziś.
4. Przycisk **„Sprawdź moją wodę”**.

Komunikaty błędów:
- ULDK zwraca `-1`: „Nie znaleziono działki o tym numerze. Sprawdź numer albo wskaż ją na mapie.”
- Timeout: „Serwer GUGiK nie odpowiada, spróbuj ponownie.”

## 3. Ekran ładowania (10–30 s)

Zamiast spinnera pokazujemy listę kroków, które odhaczają się na żywo. Dla jury to także dowód, że wynik jest liczony, a nie gotowy.

```
✓ Działka i teren       (ULDK, NMT)
✓ Pogoda z 10 lat       (Open-Meteo)
… Zdjęcia satelitarne   (Sentinel-2)
✓ Gleba                 (IUNG / SoilGrids)
✓ Wody i rowy w pobliżu (BDOT10k)
```

Krok, który się nie uda, zmienia się w „brak danych” (szary), a analiza idzie dalej. Raport pokaże wtedy odpowiednie ograniczenie.

## 4. Raport `/raport`

Kolejność bloków od góry do dołu. Na desktopie jedna kolumna o szerokości około 760 px, a mapa i wykresy w kartach.

### 4.1. Nagłówek (zawsze widoczny w całości bez przewijania)

- Działka, uprawa, data analizy, data wygenerowania.
- **Status wody**: duży kolorowy pasek z drabiny EDO (`edoLevel`):
  - zielony: w normie,
  - żółty: obserwacja,
  - pomarańczowy: ostrzeżenie,
  - czerwony: alarm.
- **Jedno zdanie**: `statusSummaryPl`, na przykład „Od 6 tygodni opad nie pokrywa parowania (KBW −92 mm), a pszenica jest w okresie krytycznym.”
- **Na tle 10 lat**: jedno zdanie, na przykład „W 6 z ostatnich 10 lat ten okres był tu suchy. Ten rok jest o 40 mm gorszy od mediany.”
- **„Co możesz zrobić teraz”**: maksymalnie 3 pozycje z pola `co_dodac_krotko`, pierwsze w kolejności KOWR. Każda pozycja jest linkiem do pełnej karty niżej.
- Alerty weryfikacyjne (`verificationAlerts`: grunt nierolniczy, Natura 2000, żniwa, chmury) jako żółta ramka nad statusem. Grunt nierolniczy blokuje resztę raportu.

### 4.2. „Dlaczego?”: przyczyny

Cztery karty w siatce 2×2 z `causes[]`: Opad i upał, Słaba retencja gleby, Spływ powierzchniowy, Wrażliwa uprawa.

Każda karta zawiera:
- nasilenie (Wysokie, Umiarkowane, Brak) jako kolor,
- dowód w jednym zdaniu z liczbą (`dowod`), na przykład „Spadek 6,2%, brak okrywy roślinnej na zdjęciu z 14.06”,
- źródło.

Nieaktywne przyczyny są wyszarzone, ale widoczne. Pokazujemy w ten sposób, co sprawdziliśmy i wykluczyliśmy.

### 4.3. „Co możesz dodać na działce”: retencja krajobrazowa

Karty z `landscapeRetention`. Każda karta zawiera:
- tytuł,
- `tekst_dla_rolnika`,
- rozwijane „Dlaczego to proponujemy” z `uzasadnienie_naukowe` i źródłem,
- warunek, który się spełnił, w czytelnej postaci z liczbami tej działki, na przykład „rów w odległości 230 m, KBW −92 mm”.

Na mini mapie działki zaznaczamy elementy, których dotyczy rekomendacja: rów lub ciek z BDOT10k, zagłębienie terenu.

### 4.4. „Zabiegi na glebie”: agrotechnika

Karty z `agrotechnics` w takim samym układzie jak w 4.3.

### 4.5. „Czy podlewać?”: nawadnianie (opcjonalne)

Dane z `irrigationCalc`:
- Odpowiedź w jednym zdaniu: TAK (dawka około `dawka_zalecana_mm` mm) albo NIE TERAZ, z uzasadnieniem z `powod_decyzji`.
- Wskaźnik zapasu wody w strefie korzeni: pasek od 0 do TAW z zaznaczonym RAW i aktualnym deficytem.
- Pod spodem zdanie `LIM_08` o pozwoleniach wodnoprawnych.

### 4.6. „Szczegóły danych” (zwinięte domyślnie)

- **Mapa**: obrys działki na ortofotomapie oraz przełącznik warstwy NDVI z ostatniej bezchmurnej sceny.
- **Wykres 1, sezon na tle 10 lat**: skumulowany KBW od 21.03 do daty X dla bieżącego roku, na tle mediany i rozstępu (min–max) z poprzednich 10 lat. Okno krytyczne uprawy zaznaczone pasem.
- **Wykres 2, 10 lat**: słupki KBW w oknie krytycznym uprawy dla każdego roku z progiem suszy. Lata suche wyróżnione kolorem, liczba lat suchych daje `dryYearsLast10`.
- **Wykres 3, zieleń**: NDVI i NDMI działki w sezonie na tle mediany z lat poprzednich, z zaznaczonym oknem zbioru.
- **Tabela wskaźników**: wskaźnik, wartość, klasa, źródło, data danych.

### 4.7. „Ograniczenia tego raportu”

Lista zdań z `limitations`. Zdania „always” zawsze, warunkowe według `warunek_kod`. Zamyka ją `LIM_10`.

### 4.8. „Źródła danych”

Tabela: źródło, co z niego wzięliśmy, data pobrania lub data sceny, licencja i atrybucja. Atrybucje są wymagane, na przykład „Contains modified Copernicus Sentinel data 2026”, Open-Meteo CC BY 4.0, IMGW-PIB, GUGiK, IUNG-PIB.

### 4.9. Akcje

- **„Pobierz PDF”**: `window.print()` z osobnym arkuszem `@media print`. Wszystkie sekcje rozwinięte, wykresy jako SVG.
- **„Drukuj”**.
- **„Kopiuj link”**: URL z parametrami.

Konta i dane osobowe nie są potrzebne.

## 5. Skąd bierze się każde wejście silnika

Backend: rozbudować `/api/live-parcel` do `/api/analyze?id|lat,lon&crop&date`. Zwraca `ParcelDiagnosisInput` wypełniony danymi, a dla każdego pola także `{wartosc, zrodlo, data_danych, status: ok|brak|szacunek}`. Potem wywołuje `runWaterDiagnosis()` i zwraca wynik razem z surowymi seriami do wykresów.

| Pole wejścia | Źródło | Jak policzyć | Gdy brak |
| --- | --- | --- | --- |
| `parcelLabel`, obrys | ULDK `GetParcelById` / `GetParcelByXY` | Pełny WKT, centroid liczony z geometrii (nie średnia wierzchołków) | Błąd na starcie, bez raportu |
| `landUse` | BDOT10k WMS `GetFeatureInfo` (pokrycie terenu) w centroidzie i 4 punktach | Większość punktów: grunt orny lub łąka → `arable`, las, zabudowa, woda | Domyślnie `arable` ze statusem `szacunek` i ostrzeżeniem w raporcie |
| `isNatura2000` | GDOŚ WMS/WFS obszarów Natura 2000 (**do weryfikacji, nie ma w api_sources**) | Przecięcie obrysu z obszarem | `false` ze statusem `brak` i zdaniem w ograniczeniach |
| `slopePct` | NMT `GetHByXY` (EPSG:2180, uwaga: x = N, y = E) | Wysokości w siatce około 5×5 punktów w obrysie, spadek = różnica wysokości / odległość, mediana | Brak reguł stokowych |
| `hasDepression` | jw. | Punkt centralny lub fragment obrysu niżej niż otoczenie w buforze około 50 m o więcej niż 0,5 m | `false` |
| `ditchDistanceM` | BDOT10k (cieki, rowy), WMS `GetFeatureInfo` w promieniu albo lokalna paczka MPHP | Najbliższy obiekt w promieniu 500 m | `9999` ze statusem `brak`, reguła R05 się nie uruchamia |
| `soilId` | IUNG `Susza:katgl_landuse2024` (kategoria), awaryjnie SoilGrids (uziarnienie 0–30 cm) | Mapowanie na 5 grup z `soil_water_groups.csv`: kategoria I → piasek luźny, II → piasek gliniasty, III → glina lekka albo zwykła, IV → pył albo glina zwykła. Dla SoilGrids według udziału piasku i pyłu | Glina lekka ze statusem `szacunek` |
| `kbwMm` | Open-Meteo Archive: `precipitation_sum`, `et0_fao_evapotranspiration` | Suma (P − ET0) z ostatnich 60 dni do daty X (6 dekad, jak IUNG). Do wykresu 1 także suma narastająca od 21.03 | Ostatnie 5 dni z `forecast?past_days=7` |
| `spi1`, `spi3` | Open-Meteo Archive, opad dzienny **1991 → data X** (jedno zapytanie) | Sumy 30 i 90 dni, dopasowanie rozkładu gamma do tych samych okien z lat 1991–2020, przeliczenie na z-score | Przy krótszej serii oznaczenie `szacunek` |
| `sma` | Open-Meteo Archive, `soil_moisture_0_to_7cm` + `7_to_28cm` (średnia dobowa) | Średnia z ostatniej dekady do X, z-score względem tej samej dekady w 10 poprzednich latach | `0` ze statusem `brak`, drabina zatrzymuje się na „obserwacji” |
| `ndvi`, `ndmi` | Earth Search STAC: `red` (B04), `nir` (B08), `swir16` (B11), `scl`; `datetime ≤ X`, ostatnie 30 dni, `eo:cloud_cover < 60` | Tylko kafle obejmujące działkę (HTTP Range, COG). Piksele SCL 4 i 5 wewnątrz obrysu. Mediana NDVI = (B08−B04)/(B08+B04), NDMI = (B08−B11)/(B08+B11). Scena ważna, gdy ma co najmniej 70% czystych pikseli | `null`, reguła R16 i ograniczenie LIM_01 |
| `satelliteAgeDays` | jw. | X minus data najnowszej ważnej sceny | `null` |
| `ndviAnomaly` | jw. dla tej samej dekady w poprzednich latach (minimum 3 lata) | (NDVI − mediana) / odchylenie, z sufitem na liczbę zapytań. Jeśli nie zmieści się w czasie, pomijamy ze statusem `brak` | `null`, drabina bez poziomu „alarm” |
| `hasSoilCover` | wynik NDVI | NDVI ≥ 0,3 na ostatniej ważnej scenie | Przy braku sceny: według okna wegetacji uprawy, status `szacunek` |
| `depletionFraction` | Open-Meteo + uprawa + gleba | Dzienny bilans FAO-56 i metoda Drupki od 1.03 (albo od siewu ozimin): zapas wody pod koniec dnia = zapas z poprzedniego dnia + opad efektywny − ET0 × Kc, obcięty do [0, TAW]. TAW = AWC gleby przeliczone na `glebokosc_efektywna_m`. Kc interpolowane z `kc_ini`, `kc_mid` i `kc_end` po oknie uprawy. Wynik: deficyt / TAW | Silnik dostaje `0` i R13 się nie uruchamia |
| `dryYearsLast10` | Open-Meteo, 10 poprzednich lat | Dla każdego roku KBW w oknie krytycznym uprawy (`okno_start_mmdd`–`okno_koniec_mmdd`), suchy rok to ten, w którym KBW jest poniżej `prog_kbw_kat1_mm` | `0` ze statusem `brak` |
| EDO (kontrola) | EDO WMS `GetFeatureInfo`, warstwa `cdiad`, `TIME=` dekada X | Tylko do wyświetlenia obok naszego wyniku: „Europejskie Obserwatorium Suszy dla tego rejonu: ostrzeżenie” | Pomijamy |
| IMGW (tylko dla „dziś”) | `synop/station/{najbliższa}` | Bieżąca obserwacja w szczegółach. Dla dat historycznych tego bloku nie ma | Pomijamy |

## 6. Wydajność (cel: 30 s)

- Wywołanie ULDK, potem **równolegle** `Promise.allSettled`: Open-Meteo (jedno zapytanie dzienne 1991 → X, wszystkie zmienne), NMT (siatka punktów w jednej paczce zapytań), gleba, BDOT10k, Natura 2000, EDO, Sentinel-2.
- Sentinel-2 to najwolniejszy krok. Ograniczenia: najpierw tylko bieżąca scena, anomalia NDVI w drugiej kolejności, z twardym limitem czasu (na przykład 15 s). Jeśli się nie zmieści, raport idzie dalej bez anomalii.
- Cache w pamięci lub na dysku: klucz to identyfikator działki, a dla meteo i S2 dodatkowo data. Dane stałe (NMT, gleba, BDOT, Natura 2000) cache’ujemy bez daty.
- Timeout każdego źródła: 5–8 s, z wyjątkiem Sentinel-2.

## 7. Kontrakt odpowiedzi `/api/analyze` (skrót)

```json
{
  "parcel": { "id": "040701_1.0081.11/74", "label": "...", "wkt": "...", "centroid": [52.8, 18.25] },
  "analysisDate": "2024-06-20",
  "inputs": { "kbwMm": { "value": -92, "source": "Open-Meteo ERA5", "dataDate": "2024-06-15", "status": "ok" }, "...": {} },
  "result": { "...": "ParcelDiagnosisResult z waterBrain.ts" },
  "series": {
    "kbwCumulative": { "thisYear": [], "median10y": [], "min10y": [], "max10y": [] },
    "kbwCriticalWindowByYear": [{ "year": 2015, "kbwMm": -180, "dry": true }],
    "ndvi": [{ "date": "2024-06-14", "ndvi": 0.62, "ndmi": 0.08 }]
  },
  "sources": [{ "name": "...", "license": "...", "fetchedAt": "..." }],
  "timingMs": { "uldk": 800, "meteo": 1200, "s2": 9000, "total": 14000 }
}
```

## 8. Kolejność budowy

1. `/api/analyze` z ULDK i Open-Meteo: `kbwMm`, `spi1`, `spi3`, `sma`, `dryYearsLast10`, `depletionFraction`. Gleba na razie jako `szacunek`.
2. Ekran startowy z mapą, wybór uprawy i daty, ekran ładowania.
3. Raport bloki 4.1–4.5 oraz 4.7–4.9. **To minimalna wersja do oddania.**
4. Gleba (IUNG albo SoilGrids), NMT, BDOT10k, Natura 2000.
5. Sentinel-2: NDVI, NDMI, wiek sceny, potem anomalia.
6. Wykresy w „Szczegółach” i mapa NDVI.
7. Arkusz wydruku, wersja mobilna, test 5 przeglądarek, pomiar czasu.
8. Przeniesienie obecnych widoków do `/metodyka`, README z 9 punktami KOWR.

## 9. Do rozstrzygnięcia

- Źródło Natura 2000 (GDOŚ) nie jest jeszcze w `api_sources.json`, więc trzeba je zweryfikować tak jak pozostałe źródła.
- `landUse` z BDOT10k przez `GetFeatureInfo` też nie jest zweryfikowany. Alternatywa to użytek gruntowy z EGiB, jeśli ULDK lub EGiB go udostępnia.
- Mapowanie kategorii IUNG na 5 grup gleb jest uproszczeniem (kategoria III obejmuje dwie grupy). Opisujemy to w ograniczeniach (LIM_04).
- Progi KBW w `crops.json` (`prog_kbw_kat1_mm`, `prog_kbw_kat2_mm`) przed finałem warto porównać z tabelą IUNG.
