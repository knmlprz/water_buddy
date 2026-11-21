# Pola A, B, C: zdjęcia satelitarne, teren i gleba

Trzy sąsiednie pola ok. 5 km na południowy wschód od Tomaszowa Lubelskiego. Środek pola A leży w punkcie 50.424 N, 23.535 E.
Granice pól są odrysowane z ortofotomapy GUGiK, wzdłuż dróg, miedz i ścieżek technologicznych, i sprawdzone na zdjęciach Sentinel-2 z 2026 roku.
Nie są to granice działek ewidencyjnych. Nie wiadomo, co rosło na polach. Uprawy w scenariuszu aplikacji, np. fasola, to założenie.

## Zdjęcia

### Sentinel-2, 10 m, sezon 2026 (`img_s2/`): główny materiał

9 bezchmurnych dat. Chmury i ich cienie nad polami sprawdzono maską SCL z Sentinela-2, więc każde z tych zdjęć jest czyste nad polami.

`2026-04-17, 04-27, 05-05, 05-30, 06-24, 07-26, 08-05, 08-15, 09-02`

- `s2_<data>.png`: bez obrysów, 1120×1120 px (ok. 2 m/px, interpolacja z 10 m)
- `s2_<data>_fields.png`: z obrysami: **A czerwony, B żółty, C niebieski**
- `s2_sezon_2026_fields.png`: wszystkie 9 dat w siatce 5×2, w kolejności jak wyżej
- `dates.json`: lista dat

Co widać: od kwietnia do czerwca wszystkie pola są zielone. Pole A brązowieje pierwsze, już 24 czerwca. 26 lipca A jest gołe, B brązowe, a C wciąż zielone. Od sierpnia wszystkie trzy są zebrane.

### Ortofotomapa GUGiK (`img_orto/`): najostrzejsze tło

- `orto_4096.jpg`: bez obrysów, 4096×4096 px (ok. 0,5 m/px)
- `orto_2240_fields.png`: z obrysami, 2240×2240 px (ok. 1 m/px)

To **zdjęcie lotnicze, nie satelitarne**, sprzed 2026 roku. Geoportal nie podaje pewnej daty nalotu dla tego miejsca. Uprawy na nim nie odpowiadają sezonowi 2026, ale granice pól, drogi i wiatraki są wyraźne.

### HLS, 30 m (`img_hls_30m/`): dane NASA

4 daty (25.05, 18.06, 26.07, 05.08.2026), 560×560 px, z obrysami i bez. Są mniej ostre niż Sentinel-2, ale to zbiór NASA (HLS). Warto go pokazać na stronie zgłoszenia jako źródło danych NASA.

Wszystkie zdjęcia mają ten sam kadr: lat 50.4105–50.4315, lon 23.5175–23.5465 (`fields.json` → `image_bbox`). Obrysy z `fields.geojson` można więc nakładać na każde z nich.

## Teren i gleba

| Pole | Powierzchnia | Wysokość | Spadek śr. / max | Spływ | Gleba (piasek / pył / ił) | Odpływ (szacunek) |
|---|---|---|---|---|---|---|
| A | 18,3 ha | 293–311 m | 4,3% / 9,6% | E | 16 / 61 / 23%, pyłowa (lessowa) | średni |
| B | 26,6 ha | 290–312 m | 4,2% / 8,8% | S | 17 / 61 / 22%, pyłowa (lessowa) | średni |
| C | 38,0 ha | 268–293 m | 5,2% / 13,3% | E | 17 / 63 / 20%, pyłowa (lessowa) | średni |

**Wniosek:** gleba i spadek są na wszystkich polach praktycznie takie same: lessy, które dobrze trzymają wodę, ale łatwo ulegają erozji. Pola różnią się położeniem na stoku. A i B leżą u góry, ok. 290–312 m, a C niżej, ok. 268–293 m. Pole A wcześniej traci zieleń niż C.

## Pliki z danymi

- `fields.json`: liczby z tabeli, środki pól, kadr zdjęć i źródła
- `fields.geojson`: obrysy pól (EPSG:4326), do mapy np. w Leaflet albo QGIS

## Źródła

| Dane | Źródło | Rozdzielczość | NASA / partner |
|---|---|---|---|
| Zdjęcia sezonu 2026 | Sentinel-2 L2A (ESA Copernicus), AWS Open Data / Element 84 Earth Search | 10 m | partner |
| Zdjęcia sezonu 2026 | HLS v2.0 S30/L30, NASA GIBS | 30 m | NASA |
| Tło | Ortofotomapa GUGiK, Geoportal WMS | 0,25 m | partner |
| Teren | SRTM 1 arc-second (NASA), OpenTopoData | 30 m | NASA |
| Gleba | SoilGrids 2.0 (ISRIC), warstwa 0–30 cm | 250 m | partner |
| Odpływ | szacunek z grupy hydrologicznej gleby i klasy spadku | – | – |

Przy rozdzielczości SoilGrids (250 m) nie widać różnic gleby między tak bliskimi polami.

## Jak odtworzyć

Wystarczy Python 3, bez dodatkowych bibliotek i bez logowania:

```
python3 prepare_fields.py   # obrysy, teren, gleba, HLS (~3 min, SoilGrids: 5 zapytań/min)
python3 sentinel2_10m.py    # Sentinel-2 10 m, pobiera tylko fragment sceny (~5-10 min)
python3 orthophoto.py       # ortofotomapa
```
