# Field Twin

Cyfrowy bliźniak gospodarstwa. Trzy ekrany: mój sezon, dlaczego to pole, mój płodozmian.

Aplikacja to Next.js (App Router) i TypeScript. Interfejs jest złożony z komponentów Catalyst: sidebar, nagłówki, odznaki, tabela, lista opisowa i przyciski.

## Uruchomienie

```bash
npm install
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

- `←` / `→` albo `1` `2` `3` zmienia ekran
- spacja na ekranie sezonu odtwarza tydzień po tygodniu
- kliknięcie w wykres albo w zdarzenie nad suwakiem skacze do tygodnia

## Dane

Front czyta statyczne JSON-y z `src/data/`. To dane testowe. Podmień pliki, zachowując klucze, albo wygeneruj je ponownie:

```bash
python3 scripts/make_mock_data.py
```

`src/data/season.json`: jedno pole, tydzień po tygodniu.

| klucz | źródło | skala |
|---|---|---|
| `weeks[].date` | poniedziałek tygodnia, ISO | |
| `precip_mm`, `precip_norm` | GPM IMERG, suma tygodniowa; norma = średnia lat | ~10 km |
| `sm`, `sm_norm` | SMAP, m³/m³, średnia tygodniowa | ~9 km |
| `ndvi`, `ndvi_norm` | HLS, mediana NDVI w poligonie pola; `null` gdy chmury | 30 m |
| `bare_soil` | `ndvi < 0.25` | 30 m |
| `events[]` | `frost`, `sowing`, `hail`, `loss_start`, `loss_end` | |
| `kpi`, `region_kpi` | jedna liczba na scenę; `mock: true` pokazuje znacznik „makieta” | |

`src/data/fields.json`: pola gospodarstwa, `bare` = 52 wartości true/false na tygodnie roku.

`src/data/plan.json`: płodozmian (`rows`) i kroki (`steps`).

## Co jest makietą

- Obraz pola na mapie jest rysowany proceduralnie w siatce 30 m (`src/lib/raster.ts`). Docelowo: PNG z NDVI z HLS dla każdego tygodnia.
- Porównanie trzech pól, dni gołej gleby po zmianie planu, koszt nasion i szacunek zatrzymanej wody.
- Prawdziwe ze źródłem: −226 mm KBW (region), dopłata 437,60 zł/ha (kampania 2025), 250–400 zł/ha mniej na nawozy.
