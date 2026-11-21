# WodaPol (Water Buddy) — Doradca gospodarki wodnej i retencji dla rolników

**HackNation 2026 · Wyzwanie KOWR**

WodaPol (Water Buddy) to aplikacja webowa dla rolników i doradców rolniczych, która na podstawie numeru działki ewidencyjnej (TERYT) lub kliknięcia na mapie Polski, wybranej uprawy oraz daty analizy (dziś lub dowolny dzień z ostatnich 10 lat) oblicza na żywo stan wody na konkretnej działce, diagnozuje przyczyny niedoboru lub odpływu wody i przedstawia konkretne rekomendacje w kolejności wymaganej przez KOWR: **stan wody → przyczyny → retencja krajobrazowa → agrotechnika glebowa → nawadnianie (opcjonalnie)**.

---

## 1. Instrukcja uruchomienia

Aplikacja korzysta wyłącznie z bezpłatnych, otwartych źródeł danych publicznych bez kluczy API. Do uruchomienia i pełnej analizy działek **nie są wymagane żadne płatne klucze ani rejestracje**.

### Wymagania wstępne
- Node.js `>= 20` (zalecane Node.js `22 LTS`) oraz `npm` (lub `bun`).

### Uruchomienie lokalne (tryb deweloperski)
```bash
# 1. Instalacja zależności
npm install

# 2. (Opcjonalnie) skopiowanie szablonu zmiennych środowiskowych
cp .env.example .env

# 3. Uruchomienie serwera Express + Vite (domyślnie http://localhost:3000)
npm run dev
```

### Budowanie i uruchomienie produkcyjne
```bash
# Weryfikacja typów TypeScript
npm run lint

# Budowanie frontendu Vite do katalogu dist/
npm run build

# Uruchomienie serwera produkcyjnego (Express serwuje API + zbudowany dist/)
NODE_ENV=production npm start
```

### Uruchomienie testów jednostkowych
```bash
npx --yes tsx --test src/engine/waterBrain.test.ts src/engine/climateStats.test.ts src/server/uldk.test.ts
```

### Uruchomienie w kontenerze Docker
```bash
docker build -t wodapol .
docker run -p 3000:3000 wodapol
```

### Wdrożenie w chmurze
- **Render**: gotowa konfiguracja w `render.yaml` (`healthCheckPath: /api/health`).
- **Vercel**: gotowa konfiguracja w `vercel.json` oraz funkcja bezserwerowa `api/index.ts`.

### Zmienne środowiskowe (`.env.example`)
Wszystkie zmienne środowiskowe są opcjonalne — brak kluczy w kodzie źródłowym:
- `PORT` (domyślnie `3000`) — port serwera HTTP,
- `NODE_ENV` (`development` | `production`) — tryb serwera,
- `APP_URL` — opcjonalny publiczny adres URL wdrożenia,
- `OPEN_METEO_API_KEY` — opcjonalny klucz płatnego planu Open-Meteo (bez limitu 10 000 zapytań dziennie); bez klucza archiwum pogody jest pobierane raz na komórkę 0,1° i zapisywane w `.cache/meteo` (katalog można zmienić zmienną `METEO_CACHE_DIR`),
- `GEMINI_API_KEY` — opcjonalny szablon (silnik rekomendacji jest w 100% deterministyczny i nie wymaga LLM).

---

## 2. Opis funkcjonalności

1. **Wskazanie działki ewidencyjnej (`/`)**:
   - wpisanie identyfikatora TERYT (np. `040704_2.0004.70/11`) — pobieranie obrysu i metadanych z **ULDK GUGiK** (`GetParcelById`),
   - albo kliknięcie na interaktywnej mapie Polski (Leaflet z podkładem OSM oraz ortofotomapą GUGiK WMTS) — odczyt działki przez **ULDK GUGiK** (`GetParcelByXY`),
   - podgląd obrysu działki, obrębu, gminy i szacunkowej powierzchni (ha) przed startem analizy.
2. **Obowiązkowy wybór uprawy**:
   - 8 głównych upraw w Polsce wczytywanych z `public/data/crops.json` (pszenica ozima, jęczmień jary, rzepak ozimy, kukurydza, ziemniak średniowczesny, burak cukrowy, żyto/pszenżyto ozime, lucerna),
   - brak domyślnego wyboru — formularz wymusza świadome wskazanie uprawy.
3. **Wybór daty analizy („na dzień X”)**:
   - domyślnie dzisiejsza data (`Europe/Warsaw`),
   - możliwość cofnięcia do dowolnego dnia z ostatnich 10 lat; wszystkie zapytania pogodowe i satelitarne ściśle odcinają dane po dacie analizy (zero wycieku danych z przyszłości).
4. **Analiza na żywo (< 30 s) ze strumieniowaniem postępu (SSE)**:
   - równoległe pobieranie danych z 7+ usług publicznych z raportowaniem postępu w czasie rzeczywistym (`/api/analyze-stream`, fallback JSON `/api/analyze`),
   - brak danych z dowolnego źródła (np. zachmurzenie Sentinel-2 lub brak odpowiedzi WMS) jest komunikowany wprost — bez zgadywania i bez przerywania raportu.
5. **Raport w obowiązkowej kolejności KOWR (`/raport?id=…&uprawa=…&data=…`)**:
   - **Krok 1 · Stan wody**: alerty weryfikacyjne (grunt nierolniczy, Natura 2000, ochrona przed fałszywym alarmem NDVI w żniwa, chmury), łączna ocena gospodarki wodnej, drabina EDO (Obserwacja / Ostrzeżenie / Alarm) oraz 10-letni kontekst podatności na suszę.
   - **Krok 2 · Przyczyny**: 3 kluczowe liczby w prostym języku + 4 karty czynników (`Opad i upał`, `Słaba retencja gleby`, `Spływ powierzchniowy`, `Wrażliwa uprawa`) z dowodem liczbowym i źródłem.
   - **Krok 3 · Retencja krajobrazowa (NWRM)**: propozycje działań wokół pola i przy rowach (pasy buforowe, piętrzenie w rowach, oczka wodne, zadrzewienia) + mini-mapa działki.
   - **Krok 4 · Retencja glebowa i agrotechnika**: mulcz, międzyplony, uprawa konserwująca, głęboszowanie, odbudowa próchnicy.
   - **Krok 5 · Nawadnianie (opcjonalnie)**: kalkulator bilansowy FAO-56 / metoda Drupki (CDR 2025, s. 243–252) z wizualizacją zapasu TAW/RAW, orientacyjną dawką `0,75 × dawka max` oraz uwagą o Prawie wodnym (`LIM_08`).
   - **Szczegóły danych (rozwijane / auto-rozwijane w PDF)**: słowniczek pojęć, mapa ortofoto + NDVI, wykres skumulowanego KBW na tle mediany i rozstępu z 10 lat, wykres słupkowy 10 lat w oknie krytycznym uprawy, krzywa NDVI/NDMI, aktualny pomiar IMGW-PIB (wyłącznie dla daty „dziś”) oraz pełna tabela proweniencji wskaźników.
   - **Ograniczenia i Źródła danych**: dynamicznie dobrane zdania z `public/data/limitations.json` oraz tabela źródeł z datami i licencjami.
   - **Eksport PDF / Wydruk / Udostępnienie linku**: dedykowany arkusz `@media print` (A4, automatyczne rozwinięcie szczegółów i wykresów SVG) oraz link z parametrami URL bez kont użytkowników i bez danych osobowych.
6. **Baza metodyki i weryfikator API (`/metodyka`, `/metodyka/symulator`)**:
   - pełny podgląd i eksport JSON/CSV tabel referencyjnych (`public/data/*`),
   - weryfikator na żywo wszystkich otwartych API (`/api/probe/:sourceId`),
   - wewnętrzny symulator reguł dla doradców i jury.

---

## 3. Skrócona architektura i skalowanie na całą Polskę

### Architektura systemu
```text
Przeglądarka (React 19 + Vite 8 + Tailwind CSS 4 + Leaflet)
 ├── /                     -> StartPage (TERYT / klik na mapie, wybór uprawy, data 10 lat)
 ├── /raport?...           -> ReportPage (SSE postęp + raport KOWR + SVG wykresy + PDF/druk)
 └── /metodyka             -> MethodologyPage (tabele z public/data/*, weryfikator API, symulator)
         │
         ▼ HTTP / SSE
Serwer Express (server.ts / api/index.ts -> src/server/app.ts)
 ├── GET /api/health
 ├── GET /api/reference-data      -> dane z public/data/*.json (wczytywane przez src/data/*.ts)
 ├── GET /api/parcel              -> ULDK GUGiK (GetParcelById / GetParcelByXY)
 ├── GET /api/analyze-stream      -> strumień SSE (postęp + pełny wynik analizy)
 ├── GET /api/analyze             -> pełny wynik analizy w JSON
 └── GET /api/probe/:sourceId     -> diagnostyka białej listy 9 publicznych API
         │
         ▼ równoległe Promise.all (src/server/analyzeService.ts)
 ├── ULDK GUGiK -> geometria WKT, centroid geometryczny (shoelace), powierzchnia
 ├── GUGiK NMT 1 m -> siatka 9 punktów (EPSG:2180) -> spadek (%) i zagłębienia
 ├── Open-Meteo Archive (1991–X) + Forecast tail -> KBW 60d, SPI-1, SPI-3 (gamma), SMA, bilans FAO-56, 10 lat
 ├── Earth Search STAC + GeoTIFF HTTP Range -> pasma B04, B08, B11, SCL -> NDVI, NDMI, anomalia
 ├── IUNG-PIB GeoServer (+ SoilGrids fallback) + GDOŚ WMS -> kategoria gleby + Natura 2000
 ├── GUGiK BDOT10k WMS 1.3.0 XML -> użytkowanie terenu (PTTR/PTLZ/PTZB/PTWP) i rowy/cieki w 250/500 m
 └── IMGW-PIB Synop (tylko dla daty „dziś”) -> bieżący pomiar z najbliższej stacji
         │
         ▼ deterministyczny silnik (src/engine/climateStats.ts + src/engine/waterBrain.ts)
 └── Ocena EDO + ocena gospodarki wodnej + 4 przyczyny + 20 reguł KOWR + kalkulator FAO-56 + ograniczenia
```

### Skalowanie na całą Polskę (wdrożenie produkcyjne)
1. **Wielopoziomowe buforowanie (Cache)**:
   - Już w prototypie zastosowano rozdzielny cache TTL: geometria działki (60 min), warstwy niezmienne w czasie — NMT 1 m, kategoria gleby IUNG, BDOT10k, Natura 2000 (30 min, bez daty w kluczu), serie meteo i Sentinel-2 (15 min po kluczu `(siatka/działka, data)`).
   - Przy skali ogólnopolskiej: warstwa Redis / PostgreSQL + PostGIS z klastrowaniem po siatce ~9 km dla ERA5 (ok. 4 000 oczek na całą Polskę) i po identyfikatorze TERYT dla warstw statycznych (TTL 30–90 dni).
2. **Limity API i niezawodność**:
   - Open-Meteo (darmowy plan niekomercyjny: `< 10 000 req/dzień`) przy skalowaniu komercyjnym/państwowym można zastąpić darmowym lokalnym magazynem danych **IMGW-PIB** (`danepubliczne.imgw.pl` — archiwa CSV + synop) i/lub reanalizą **Copernicus CDS ERA5-Land** (bezpłatna, własny mirror Zarr/NetCDF) albo planem komercyjnym Open-Meteo (od ~29 EUR/mies.).
   - BDOT10k i MPHP (rowy/cieki) oraz granice Natura 2000 (GDOŚ) i mapa kategorii gleb IUNG najlepiej utrzymywać w lokalnej bazie **PostGIS** (paczki GPKG/SHP z GUGiK/GDOŚ/Wód Polskich, łącznie < 15 GB dla całej Polski) — skraca czas zapytań przestrzennych z ~1–3 s do `< 20 ms` i eliminuje zależność od chwilowych przeciążeń WMS.
   - Sentinel-2 COG (AWS Open Data / Earth Search) skaluje się bez limitu klucza dzięki odczytowi wyłącznie okna pikseli działki przez HTTP Range (`geotiff`).
3. **Aktualizacja danych**:
   - Warstwy statyczne (NMT, gleby IUNG, BDOT10k, Natura 2000): aktualizacja kwartalna/roczna.
   - Meteo (ERA5 / IMGW): przyrostowy import dobowy w nocy (cron) dla siatki Polski.
   - Sentinel-2: odczyt na żądanie z cache po `(działka, data_sceny)`.
4. **Koszty i prywatność**:
   - Wariant 100% darmowy / samorządowy (KOWR): pojedynczy serwer VPS/VM (4–8 vCPU, 16 GB RAM, 100 GB NVMe + PostGIS + Redis): ok. 150–400 PLN/mies. przy darmowych danych publicznych (GUGiK, IMGW, Copernicus, IUNG, GDOŚ).
   - Aplikacja nie wymaga kont, nie loguje użytkowników i nie zbiera żadnych danych osobowych (RODO-safe z założenia).

---

## 4. Źródła i zakresy danych

Wszystkie źródła spełniają wymogi 5 kategorii KOWR (przestrzenne, meteorologiczne, satelitarne, glebowe, hydrologiczne + tło suszowe) i są bezpłatne oraz legalne:

| Kategoria KOWR | Źródło | Dostawca | Zakres historyczny (10 lat) | Rozdzielczość | Rola w obliczeniach |
| --- | --- | --- | --- | --- | --- |
| Przestrzenne | **ULDK** (`GetParcelById` / `GetParcelByXY`) | GUGiK | Aktualny stan EGiB | Wektor ewidencyjny | Identyfikator TERYT, gmina/obręb, obrys WKT, centroid, powierzchnia |
| Przestrzenne | **NMT 1 m** (`GetHByXY`, EPSG:2180) | GUGiK (PZGIK) | Rzeźba terenu stała | 1 m × 1 m (~0,15 m wys.) | Siatka 9 punktów wokół środka działki → spadek (%) i zagłębienia |
| Przestrzenne | **GDOŚ WMS Natura 2000** (`SOO` / `OSO`) | GDOŚ | Aktualne granice | Wektor form ochrony | Weryfikacja kolizji z Naturą 2000 (reguła R02 blokuje prace ziemne) |
| Meteorologiczne | **Open-Meteo Archive** (ERA5 / ERA5-Land) + Forecast tail | Open-Meteo / ECMWF | **Tak** (1940 – dziś − 5 dni + ostatnie dni) | ~9–25 km, krok dobowy | Opad, temp., ET0 FAO-56, wilgotność gleby → KBW 60d, SPI-1/3 (1991–2020), SMA, 10 lat, bilans FAO-56 |
| Meteorologiczne | **IMGW-PIB Synop** (`/api/data/synop/station/...`) | IMGW-PIB | Tylko bieżąca godzina (używane wyłącznie dla „dziś”) | ~60 stacji synoptycznych | Bieżąca obserwacja naziemna z najbliższej stacji |
| Satelitarne | **Earth Search STAC v1 — Sentinel-2 L2A (COG)** | Element 84 / ESA Copernicus | **Tak** (2017–dziś pełne L2A) | 10 m (`B04`, `B08`), 20 m (`B11`, `SCL`) | Maska chmur `SCL` (klasy 4 i 5), mediana NDVI, NDMI, okrywa gleby, wieloletnia anomalia NDVI |
| Glebowe | **IUNG-PIB GeoServer** (`Susza:katgl_landuse2024`) + **SoilGrids v2.0** (fallback) | IUNG-PIB Puławy / ISRIC | Mapa kategorii gleb 2024 (stała) | Skala 1:25 000 (IUNG) / 250 m (SoilGrids) | Kategoria podatności gleby (I–IV) mapowana na retencję 0–50 cm (CDR tab. 12) |
| Hydrologiczne | **BDOT10k WMS 1.3.0** (`kompozycja_BDOT10k_WMS`) | GUGiK (PZGIK) | Stan aktualny | Skala 1:10 000 | Rowy melioracyjne (`SWRM`), kanały (`SWKN`), cieki (`SWRS`), zbiorniki (`PTWP`), mokradła (`OIMK`) w 250/500 m oraz pokrycie terenu |
| Tło suszowe | **Copernicus EDO WMS** (`cdiad`, `smian`, `spaST`) | Komisja Europejska JRC | **Tak** (archiwum dekadowe z `TIME=`) | 5 km / 0,1° | Metodyka drabiny CDI (Obserwacja → Ostrzeżenie → Alarm) i weryfikacja spójności |

Dodatkowo jako podkład kartograficzny w przeglądarce używane są: **OpenStreetMap** oraz **GUGiK Ortofotomapa StandardResolution (WMTS)**.

---

## 5. Dane pobierane na bieżąco vs przygotowane wcześniej

### Dane pobierane na bieżąco (na żywo w chwili zapytania użytkownika)
Wszystkie wyniki dla konkretnej działki są wyliczane w momencie zapytania w `src/server/analyzeService.ts`:
- granice działki i lokalizacja (ULDK GUGiK),
- rzeźba terenu, spadek i lokalne zagłębienia (GUGiK NMT 1 m),
- dzienne szeregi opadów, temperatury, parowania ET0 i wilgotności gleby od `1991-01-01` do wybranej `daty analizy` (Open-Meteo Archive + uzupełnienie ostatnich dni dla dat bieżących),
- sceny satelitarne Sentinel-2 L2A z okresu `<= data analizy` wraz z odczytem pikseli pasm `B04`, `B08`, `B11`, `SCL` (Earth Search STAC + COG HTTP Range),
- kategoria gleby i pokrycie gruntów ornych (IUNG-PIB GeoServer WMS, awaryjnie ISRIC SoilGrids v2.0),
- obecność rowów melioracyjnych, cieków i użytkowania terenu (GUGiK BDOT10k WMS),
- przecięcie z obszarami Natura 2000 (GDOŚ WMS),
- bieżący pomiar synoptyczny z najbliższej stacji (IMGW-PIB — wyłącznie gdy data analizy to „dziś”).

### Dane referencyjne przygotowane wcześniej (statyczne tabele wiedzy w `public/data/`)
W katalogu `public/data/` znajdują się deterministyczne tabele agronomiczne i progi naukowe, bezpośrednio wczytywane przez moduły `src/data/*.ts` oraz dostępne publicznie pod `/data/*` i `/api/reference-data`:

| Plik w `public/data/` | Zawartość | Podstawa merytoryczna | Data przygotowania / weryfikacji |
| --- | --- | --- | --- |
| `crops.json` / `crops.csv` | 8 upraw: okna krytyczne, okna zbiorów, `p`, głębokość korzeni, `Kc`, progi KBW | CDR 2025 (s. 225–234, 246), FAO-56 (Tab. 12 i 22), IUNG SMSR | `2026-11-21` |
| `thresholds.json` / `thresholds.csv` | Drabina EDO (4 poziomy), klasy NDVI/NDMI (4 klasy), progi KBW (4 poziomy) | POLSA 2024 (tab. 6.4, s. 288, 293), CDR 2025 (s. 66), WMO, EDO | `2026-11-21` |
| `soil_water_groups.csv` (oraz sekcja w `thresholds.json`) | 5 grup uziarnienia gleby: PPW, PHW, PW, woda dostępna 0–50 cm (10–172 mm) | CDR 2025 (tab. 12, model van Genuchtena) | `2026-11-21` |
| `rules.json` / `rules.csv` | 20 reguł `przyczyna → rekomendacja` w kolejności KOWR (`kolejnosc_kowr` 1–4) | CDR 2025, UE NWRM, POLSA 2024, GDOŚ, KOWR | `2026-11-21` |
| `limitations.json` / `limitations.csv` | 10 warunkowych i stałych zdań do sekcji „Ograniczenia” raportu | KOWR pkt 3.3, POLSA 2024, CDR 2025, Prawo wodne | `2026-11-21` |
| `api_sources.json` / `api_sources.csv` / `README_ZRODLA_I_LICENCJE.md` | Specyfikacja, zweryfikowane zapytania i licencje 9 otwartych źródeł API | Ręczna i automatyczna weryfikacja HTTP/OGC | `2026-11-21` |

---

## 6. Wykaz bibliotek, usług zewnętrznych i narzędzi AI

### Biblioteki i zależności (`package.json`)
- **Frontend**: `react` (`19.0.1`), `react-dom` (`19.0.1`), `leaflet` (`1.9.4`), `lucide-react` (`0.546.0`), `motion` (`12.23.24`), `tailwindcss` (`4.3.3`), `@tailwindcss/vite` (`4.3.3`).
- **Backend i przetwarzanie geoprzestrzenne**: `express` (`4.21.2`), `proj4` (`2.23.0` — transformacje WGS84 ↔ EPSG:2180 i UTM 32633/32634/32635), `geotiff` (`3.0.5` — odczyt okien pikseli Sentinel-2 COG przez HTTP Range), `dotenv` (`17.2.3`).
- **Narzędzia budowania i uruchomienia**: `vite` (`8.3.0`), `@vitejs/plugin-react` (`6.1.1`), `tsx` (`4.21.0`), `typescript` (`7.0.2`), `esbuild` (`0.25.0`), `autoprefixer` (`10.4.21`), `@types/*`.
- **SDK opcjonalne**: `@google/genai` (`2.4.0`) — obecne w szablonie środowiska, **niewywoływane w ścieżce analizy ani rekomendacji**.

### Usługi zewnętrzne
- `uldk.gugik.gov.pl` (ULDK GUGiK),
- `services.gugik.gov.pl/nmt/` (GUGiK NMT 1 m),
- `mapy.geoportal.gov.pl` (BDOT10k WMS 1.3.0 oraz Ortofotomapa WMTS),
- `archive-api.open-meteo.com` i `api.open-meteo.com` (Open-Meteo ERA5 / Forecast),
- `earth-search.aws.element84.com` + AWS Open Data Sentinel-2 L2A COG,
- `sgeo.iung.pl` (IUNG-PIB GeoServer) oraz `rest.isric.org` (ISRIC SoilGrids v2.0),
- `sdi.gdos.gov.pl` (GDOŚ WMS Natura 2000),
- `danepubliczne.imgw.pl` (IMGW-PIB Synop),
- `drought.emergency.copernicus.eu/api/wms` (Copernicus EDO),
- `tile.openstreetmap.org` (podkład mapowy OSM).

### Użycie narzędzi AI
- **W czasie działania aplikacji (runtime)**: **brak LLM w generowaniu diagnozy i rekomendacji**. Wszystkie wskaźniki, klasyfikacja EDO, diagnoza 4 przyczyn, dobór reguł KOWR oraz kalkulator nawadniania są w 100% deterministyczne i powtarzalne (zgodne z CDR 2025, FAO-56, POLSA 2024).
- **W procesie tworzenia projektu**: narzędzia AI (Google AI Studio / Gemini) zostały wykorzystane jako wsparcie programistyczne (implementacja kodu TypeScript/React/Express, testów jednostkowych, stylów i grafik poglądowych sekcji przewodnika w `src/assets/images/`). Wszystkie wzory, progi liczbowe i zapytania API zostały zweryfikowane względem źródeł naukowych (CDR 2025, POLSA 2024, FAO-56) oraz żywych odpowiedzi serwerów.

---

## 7. Licencje danych i komponentów

### Licencje danych publicznych i wymagane atrybucje
- **GUGiK (ULDK, NMT 1 m, BDOT10k, Ortofotomapa)**: otwarte dane PZGIK — bezpłatne, bez ograniczeń (Ustawa Prawo geodezyjne i kartograficzne, art. 40a). Atrybucja: *Główny Urząd Geodezji i Kartografii (GUGiK)*.
- **Open-Meteo / ECMWF ERA5 & ERA5-Land**: `CC BY 4.0` (użytek niekomercyjny bez klucza; wdrożenie komercyjne wymaga planu płatnego lub zamiany na IMGW/Copernicus CDS). Atrybucja: *Weather data by Open-Meteo.com / Copernicus Climate Data Store (ERA5)*.
- **Copernicus Sentinel-2 L2A (Earth Search / AWS Open Data)**: Copernicus Sentinel Data Terms & Conditions (bezpłatne, otwarte). Atrybucja: *Contains modified Copernicus Sentinel data 2026*.
- **Copernicus EDO (European Drought Observatory)**: Copernicus EMS Open Data. Atrybucja: *European Commission, Joint Research Centre (EDO)*.
- **IUNG-PIB SMSR (`sgeo.iung.pl`)**: publiczne dane naukowe/państwowe. Atrybucja: *IUNG-PIB Puławy (SMSR)*.
- **ISRIC SoilGrids v2.0**: `CC BY 4.0`. Atrybucja: *ISRIC — World Soil Information (SoilGrids v2.0)*.
- **IMGW-PIB Dane Publiczne**: otwarte dane publiczne (Ustawa o otwartych danych). Atrybucja: *Źródło danych: Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy*.
- **GDOŚ (Natura 2000)**: otwarte dane publiczne GDOŚ / INSPIRE. Atrybucja: *Generalna Dyrekcja Ochrony Środowiska (GDOŚ)*.
- **OpenStreetMap**: `ODbL 1.0` (*© OpenStreetMap contributors*).

### Licencje komponentów oprogramowania
- React, Vite, Express, Tailwind CSS, Proj4js, GeoTIFF.js, Motion, TypeScript: **MIT** / **Apache-2.0**.
- Leaflet: **BSD-2-Clause**.
- Lucide React: **ISC**.
- Kod źródłowy projektu WodaPol: udostępniony na potrzeby oceny konkursowej HackNation 2026 (KOWR).

---

## 8. Znane ograniczenia

Każdy raport zawiera dynamiczną sekcję „O czym warto pamiętać (ograniczenia)” generowaną z `public/data/limitations.json`. Najważniejsze ograniczenia techniczne i merytoryczne:

1. **Różna rozdzielczość przestrzenna źródeł**: granice działki (ULDK) i NMT (1 m) są łączone z Sentinel-2 (10–20 m), reanalizą ERA5 (~9–25 km) i tłem EDO (5 km). Lokalne opady burzowe oraz mikrozmienność glebowa wewnątrz działki mogą odbiegać od średniej siatki.
2. **Zachmurzenie i częstotliwość przelotów Sentinel-2**: przy zachmurzeniu > 30% nad działką (maska `SCL`) odczyt pochodzi z najbliższej starszej czystej sceny lub raport wprost komunikuje brak zdjęcia satelitarnego i regułę `R16`.
3. **Opóźnienie reanalizy ERA5 (~5 dni)**: dla ostatnich kilku dni przed „dziś” dane Archive są uzupełniane z Open-Meteo Forecast oraz bieżącym pomiarem ze stacji IMGW-PIB (dla dat historycznych endpoint synop IMGW nie jest używany).
4. **Brak indywidualnych badań glebowych i danych o drożności melioracji**: pojemność wodna gleby (`TAW`/`RAW`) szacowana jest z map kategorii IUNG / SoilGrids (CDR tab. 12, model van Genuchtena) — nie uwzględnia lokalnej zawartości próchnicy, pH, zagęszczenia podglebia ani rzeczywistej drożności drenów.
5. **Fenologia i zabiegi agrotechniczne**: kwitnienie rzepaku, pokosy lucerny lub żniwa zbóż obniżają NDVI niezależnie od suszy (wprowadzono strażnika okien zbioru `R03`, który blokuje fałszywy Alarm EDO).
6. **Brak prognozy procentowej straty plonu**: celowo podajemy klasy ryzyka i przedziały fizyczne (mm), bez pozornej precyzji typu „−23,7% plonu”.
7. **Warstwy statyczne dla dat historycznych**: granice EGiB (ULDK), BDOT10k (rowy) i Natura 2000 (GDOŚ) odzwierciedlają stan aktualny, co raport wprost zaznacza przy dacie historycznej (`LIM_03`).
8. **Kwestie formalnoprawne**: budowa oczek, piętrzenie w rowach i pobór wody do nawadniania mogą wymagać zgłoszenia/pozwolenia wodnoprawnego lub uzgodnień z RDOŚ / spółką wodną (`LIM_08`, `LIM_09`).

---

## 9. Sposób weryfikacji wyników

1. **Automatyczne testy jednostkowe silnika i spójności danych** (`node:test` + `tsx`):
   ```bash
   npx --yes tsx --test src/engine/waterBrain.test.ts src/engine/climateStats.test.ts src/server/uldk.test.ts
   ```
   Testy weryfikują:
   - obliczenia geometrii poligonu WKT (centroid i powierzchnia),
   - dopasowanie rozkładu gamma i z-score dla `SPI-1` / `SPI-3`,
   - **ścisły brak wycieku danych z przyszłości** (rekordy pogodowe po `analysisDate` są ignorowane),
   - dzienny bilans wodny FAO-56 i obliczenie dawki `0,75 × dawka max`,
   - wykrywanie spadku > 4% i zagłębień > 0,5 m,
   - progresję drabiny EDO (`brak → obserwacja → ostrzezenie → alarm`) oraz ochronę przed fałszywym alarmem w oknie żniw (`R03`),
   - blokowanie rekomendacji polowych dla gruntów nierolniczych (`R01`) i blokowanie prac ziemnych w Naturze 2000 (`R02`),
   - pełną spójność plików `public/data/*` z modułami wczytywanymi przez aplikację.
2. **Weryfikacja typów i kompilacji produkcyjnej**:
   ```bash
   npm run lint && npm run build
   ```
3. **Weryfikacja na żywo zewnętrznych źródeł API**:
   - w interfejsie: zakładka `/metodyka?tab=apis` (przycisk „Testuj na żywo” dla każdego z 9 źródeł) lub bezpośrednio przez `GET /api/probe/<sourceId>`,
   - sprawdzenie pełnego potoku analizy i czasu wykonania (`timingMs.total < 30 000 ms`):
     ```bash
     curl "http://localhost:3000/api/analyze?id=040704_2.0004.70/11&crop=pszenica_ozima&date=2024-06-20"
     ```
4. **Weryfikacja merytoryczna na działkach referencyjnych**:
   - porównanie obliczonego `KBW` (60 dni / 6 dekad) z komunikatami SMSR IUNG-PIB oraz `SPI-3` / `SMA` / drabiny `EDO` z mapami historycznymi Copernicus EDO dla wybranych dat z ostatnich 10 lat (np. susza `2019-06-25`, `2022-06-15`, `2024-06-20`, okres odbudowy jesienno-zimowej),
   - test przypadków brzegowych: działka miejska (`040701_1.0081.11/74`), działka leśna (alert `R01`), działka w obszarze Natura 2000 (alert `R02`), zachmurzona data (komunikat o braku satelity `R16`),
   - weryfikacja wydruku / zapisu do PDF w przeglądarce (rozwinięcie sekcji „Szczegóły danych”, kompletność tabeli źródeł i ograniczeń).
