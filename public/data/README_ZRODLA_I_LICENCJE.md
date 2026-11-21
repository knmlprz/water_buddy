## Źródła danych, tryb pobierania i licencje (HackNation 2026 · KOWR)

Wszystkie źródła poniżej są bezpłatne, legalne i zostały zweryfikowane pod kątem działających zapytań HTTP/OGC.

| Kategoria KOWR | Źródło | Dostawca | Tryb pobierania | Dane 10 lat (na dzień X) | Limity i klucz | Licencja i atrybucja |
| --- | --- | --- | --- | --- | --- | --- |
| Przestrzenne | **ULDK — Usługa Lokalizacji Działek Katastralnych** | GUGiK (Główny Urząd Geodezji i Kartografii) | Na żywo + cache | Nie dotyczy (aktualny stan EGiB) | Bez klucza API; brak sztywnego limitu dokumentowanego, zalecany cache po TERYT i timeout 5–8 s | Otwarte dane PZGIK — bezpłatne, bez ograniczeń (Ustawa Prawo geodezyjne i kartograficzne, art. 40a) |
| Meteorologiczne | **Open-Meteo Historical Weather API (Archive)** | Open-Meteo (ERA5 / ERA5-Land ECMWF) | Na żywo + cache | Tak (od 1940 r. do 5 dni wstecz; uzupełnienie ostatnich 5 dni przez api.open-meteo.com/v1/forecast?past_days=7) | Bez klucza API dla użytku niekomercyjnego (< 10 000 zapytań/dzień); czas odpowiedzi < 300 ms | CC BY 4.0 (wymaga atrybucji Open-Meteo / Copernicus ERA5; komercyjne wdrożenie wymaga planu płatnego lub zamiany na IMGW/ERA5) |
| Satelitarne | **Earth Search STAC v1 — Sentinel-2 L2A (COG)** | Element 84 / ESA Copernicus (AWS Open Data) | Na żywo + cache | Tak (Sentinel-2 L2A od 2017 r. pełna seria dla Polski; archiwum L1C od 2015 r.) | Bez konta i bez klucza API; Cloud-Optimized GeoTIFF (HTTP Range pozwala pobrać tylko kafel działki) | Copernicus Sentinel Data Terms & Conditions (bezpłatne, otwarte, wymagana atrybucja „Contains modified Copernicus Sentinel data [rok]”) |
| Glebowe | **IUNG-PIB SMSR — GeoServer Mapy Kategorii Glebowych (+ SoilGrids fallback)** | IUNG-PIB Puławy (sgeo.iung.pl) / ISRIC SoilGrids v2.0 | Pre-agregacja / WMS na żywo | Kategorie glebowe są stałe w czasie (mapa 2024); raporty 6-dekadowe SMSR publikowane w sezonie 21.03–30.09 | Bez klucza API; SoilGrids ma restrykcyjny rate-limit (~5 req/min) — obowiązkowy cache lub lokalny plik kategorii IUNG | IUNG-PIB: publiczne dane naukowe/państwowe (wymagane źródło IUNG-PIB SMSR); SoilGrids: CC BY 4.0 (ISRIC) |
| Przestrzenne | **Geoportal GUGiK — NMT 1 m (WCS + punktowe GetHByXY)** | GUGiK (PZGIK) | Na żywo + cache | Nie dotyczy (rzeźba terenu stała) | Bez klucza API; uwaga na kolejność osi w EPSG:2180: x = Northing (N), y = Easting (E)! | Otwarte dane PZGIK — bezpłatne, bez ograniczeń (Prawo geodezyjne i kartograficzne, art. 40a) |
| Hydrologiczne | **Hydrografia: BDOT10k WMS (GUGiK) + ISOK Hydroportal (Wody Polskie)** | GUGiK (BDOT10k) / PGW Wody Polskie (ISOK Hydroportal) | Na żywo + cache | Sieć cieków, rowów i zbiorników (stan aktualny, bez szeregu czasowego) | BDOT10k WMS bez klucza; uwaga techniczna: wymaga VERSION=1.3.0, CRS=EPSG:2180 (Northing,Easting) oraz INFO_FORMAT=text/xml (text/plain zwraca 400) | BDOT10k: otwarte dane PZGIK (bezpłatne); ISOK / PGW Wody Polskie: dane publiczne INSPIRE / dane.gov.pl (CC0 / otwarte po podaniu źródła) |
| Tło suszowe | **Copernicus EDO — European Drought Observatory WMS** | Komisja Europejska JRC / Copernicus EMS | Na żywo + cache | Tak — pełne archiwum dekadowe z parametrem TIME=YYYY-MM-DD (np. TIME=2024-06-01) | Bez klucza API; uwaga na poprawny endpoint /api/wms (stary URL edov2/php/wms.php zwraca 302→404!) | Copernicus EMS Open Data — bezpłatne, otwarte z wymogiem atrybucji „European Commission, Joint Research Centre (EDO)” |
| Meteorologiczne | **IMGW-PIB Dane Publiczne — Stacje Synoptyczne (uzupełnienie „tu i teraz”)** | IMGW-PIB (Instytut Meteorologii i Gospodarki Wodnej) | Na żywo + cache | Nie przez API REST (tylko bieżąca godzina); archiwa wieloletnie jako pliki CSV na danepubliczne.imgw.pl/data/dane_pomiarowo_obserwacyjne/ | Bez klucza API; zalecany cache 30–60 min | Otwarte dane publiczne IMGW-PIB (Ustawa o otwartych danych, wymóg podania źródła: „Źródło danych: Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy”) |
| Przestrzenne | **GDOŚ — Obszary chronione Natura 2000 (WMS GetFeatureInfo)** | Generalna Dyrekcja Ochrony Środowiska (sdi.gdos.gov.pl) | Na żywo + cache | Nie dotyczy (aktualne granice form ochrony przyrody) | Bez klucza API; zalecany cache po identyfikatorze działki i timeout 5–6 s | Otwarte dane publiczne GDOŚ / INSPIRE (bezpłatne, wymagane podanie źródła: GDOŚ) |

### Zweryfikowane działające przykłady zapytań (gotowe dla backendu)

#### ULDK — Usługa Lokalizacji Działek Katastralnych (Przestrzenne)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (GET):** `https://uldk.gugik.gov.pl/?request=GetParcelByXY&xy=18.2500,52.8000,4326&result=id,voivodeship,county,commune,region,parcel,geom_wkt&srid=4326`
- **Przykładowa odpowiedź:** `0
040701_1.0081.11/74|kujawsko-pomorskie|powiat inowrocławski|Inowrocław (miasto)|Inowrocław 81|11/74|SRID=4326;POLYGON((18.250736 52.799921,18.249725 52.800029,...))`
- **Uwaga operacyjna:** Pierwsze wywołanie w przepływie. Obsługuje zarówno GetParcelById&id=<TERYT> (np. 040701_1.0081.11/74) jak i GetParcelByXY&xy=lon,lat,4326. Kod "-1 brak wyników" wymaga komunikatu dla użytkownika.

#### Open-Meteo Historical Weather API (Archive) (Meteorologiczne)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (GET):** `https://archive-api.open-meteo.com/v1/archive?latitude=52.80&longitude=18.25&start_date=2024-06-01&end_date=2024-06-05&daily=precipitation_sum,temperature_2m_mean,et0_fao_evapotranspiration&hourly=soil_moisture_0_to_7cm,soil_moisture_7_to_28cm&timezone=Europe%2FWarsaw`
- **Przykładowa odpowiedź:** `{"latitude":52.829525,"longitude":18.236397,"elevation":101.0,"daily_units":{"precipitation_sum":"mm","et0_fao_evapotranspiration":"mm"},"daily":{"time":["2024-06-01","2024-06-02"],"precipitation_sum":[2.0,19.8],"temperature_2m_mean":[19.6,17.9],"et0_fao_evapotranspiration":[4.42,3.18]}}`
- **Uwaga operacyjna:** Zwraca bezpośrednio et0_fao_evapotranspiration (FAO-56) oraz precipitation_sum — pozwala w jednym zapytaniu policzyć 10-letnie KBW, SPI-1, SPI-3 i wilgotność gleby do dowolnej daty X bez wycieku danych z przyszłości.

#### Earth Search STAC v1 — Sentinel-2 L2A (COG) (Satelitarne)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (POST):** `https://earth-search.aws.element84.com/v1/search`
- **Body JSON:** `{"collections":["sentinel-2-l2a"],"bbox":[18.24,52.79,18.26,52.81],"datetime":"2024-06-01T00:00:00Z/2024-06-30T23:59:59Z","query":{"eo:cloud_cover":{"lt":20}},"limit":1}`
- **Przykładowa odpowiedź:** `{"type":"FeatureCollection","numberMatched":5,"numberReturned":1,"features":[{"id":"S2A_34UCD_20240630_0_L2A","properties":{"datetime":"2024-06-30T09:56:05Z","eo:cloud_cover":19.66,"proj:epsg":32634},"assets":{"red":"...B04.tif","nir":"...B08.tif","nir08":"...B8A.tif","swir16":"...B11.tif","scl":"...SCL.tif"}}]}`
- **Uwaga operacyjna:** Kluczowe klucze w assets: red (B04), nir (B08), nir08 (B8A), swir16 (B11) i scl (maska chmur: akceptować klasy 4=wegetacja, 5=gleba). Zawsze filtrować datetime <= data_analizy.

#### IUNG-PIB SMSR — GeoServer Mapy Kategorii Glebowych (+ SoilGrids fallback) (Glebowe)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (GET):** `https://sgeo.iung.pl/geoserver/common/wms/?SERVICE=WMS&REQUEST=GetCapabilities`
- **Przykładowa odpowiedź:** `WMTS: https://sgeo.iung.pl/geoserver/gwc/service/wmts (layer: Susza:katgl_landuse2024, EPSG:2180v1) | SoilGrids 200 OK: {"layers":[{"name":"clay","depths":[{"label":"0-5cm","values":{"mean":100}}]},{"name":"sand",...}]}`
- **Uwaga operacyjna:** Zweryfikowano kod mapkat.js na susza.iung.pulawy.pl: oficjalna warstwa kategorii podatności gleb na suszę to Susza:katgl_landuse2024 na sgeo.iung.pl. Jako ilościowy fallback uziarnienia (piasek/pył/ił → tab. 12 CDR) działa REST SoilGrids v2.0.

#### Geoportal GUGiK — NMT 1 m (WCS + punktowe GetHByXY) (Przestrzenne)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (GET):** `https://services.gugik.gov.pl/nmt/?request=GetHByXY&x=548000&y=450000`
- **Przykładowa odpowiedź:** `105.6  (dla x=548000, y=450000 w EPSG:2180) | WCS GRID1 GetCapabilities: 200 OK <wcs:Capabilities version="2.0.1">`
- **Uwaga operacyjna:** Do szybkiego wyznaczenia spadku (%) w <1 s wystarczy pobrać wysokość dla 5 punktów (środek + 4 narożniki działki) przez services.gugik.gov.pl/nmt/ lub wycinek GeoTIFF z WCS GRID1.

#### Hydrografia: BDOT10k WMS (GUGiK) + ISOK Hydroportal (Wody Polskie) (Hydrologiczne)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (GET):** `https://mapy.geoportal.gov.pl/wss/service/pub/guest/kompozycja_BDOT10k_WMS/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=row,kan,rz,WPow,Mo&QUERY_LAYERS=row,kan,rz,WPow,Mo&CRS=EPSG:2180&BBOX=547400,448000,548400,449000&WIDTH=3&HEIGHT=3&I=1&J=1&INFO_FORMAT=text/xml&FEATURE_COUNT=10`
- **Przykładowa odpowiedź:** `<FeatureInfoResponse><FIELDS x_kod="SWRM02" .../><FIELDS x_kod="SWRS02" .../><FIELDS x_kod="PTWP03" .../></FeatureInfoResponse>`
- **Uwaga operacyjna:** Zweryfikowano na żywo: kompozycja_BDOT10k_WMS z INFO_FORMAT=text/xml i buforem 3×3 piksele (250 m / 500 m) w EPSG:2180 stabilnie zwraca rowy (SWRM), cieki (SWRS), zbiorniki (PTWP) i mokradła (OIMK) w < 500 ms.

#### Copernicus EDO — European Drought Observatory WMS (Tło suszowe)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (GET):** `https://drought.emergency.copernicus.eu/api/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1`
- **Przykładowa odpowiedź:** `<WMT_MS_Capabilities version="1.1.1"><Service><Name>OGC:WMS</Name><Title>CEMS European (EDO) and Global Drought Observatory</Title>... Warstwy: cdiad (CDI v4.1), smian (SMA), fpanv (FAPAR), spaST (SPI 1/3m)</Service>`
- **Uwaga operacyjna:** Ważna poprawka URL: działający endpoint to drought.emergency.copernicus.eu/api/wms. Warstwy do kontroli spójności z danymi referencyjnymi jury: cdiad (Combined Drought Indicator v4.1), smian (SMI Anomaly), spaST (SPI-1/3).

#### IMGW-PIB Dane Publiczne — Stacje Synoptyczne (uzupełnienie „tu i teraz”) (Meteorologiczne)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (GET):** `https://danepubliczne.imgw.pl/api/data/synop/station/torun`
- **Przykładowa odpowiedź:** `{"id_stacji":"12250","stacja":"Toruń","data_pomiaru":"2026-11-21","godzina_pomiaru":"14","temperatura":"1.7","predkosc_wiatru":"5","wilgotnosc_wzgledna":"82.7","suma_opadu":"0"}`
- **Uwaga operacyjna:** Świetne do pokazania bieżącej obserwacji ze stacji naziemnej dla daty „dziś” i uzupełnienia 5-dniowego opóźnienia ERA5. Dla dat historycznych nie używać endpointu REST.

#### GDOŚ — Obszary chronione Natura 2000 (WMS GetFeatureInfo) (Przestrzenne)
- **Status testu ręcznego:** Zweryfikowane (200 OK)
- **Zapytanie (GET):** `https://sdi.gdos.gov.pl/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=GDOS:SpecjalneObszaryOchrony,GDOS:ObszarySpecjalnejOchrony&QUERY_LAYERS=GDOS:SpecjalneObszaryOchrony,GDOS:ObszarySpecjalnejOchrony&SRS=EPSG:4326&BBOX=18.19,52.76,18.21,52.78&WIDTH=100&HEIGHT=100&X=50&Y=50&INFO_FORMAT=application/json`
- **Przykładowa odpowiedź:** `{"type":"FeatureCollection","features":[]}`
- **Uwaga operacyjna:** Zweryfikowane warstwy Natura 2000: GDOS:SpecjalneObszaryOchrony (siedliskowe) oraz GDOS:ObszarySpecjalnejOchrony (ptasie). Przecięcie aktywuje regułę R02 i wstrzymuje propozycje prac ziemnych (oczka, piętrzenie).
