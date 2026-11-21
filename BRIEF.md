# Field Twin: co zostało zrobione (14–15.11.2026)

## 1. Klient Meteomatics dla zespołu

- `meteomatics_client.py` i notebook do Colaba `meteomatics_colab.ipynb`. Pobierają dane dla dowolnego czasu i wielu punktów naraz.
- Zwracają dane w tym samym układzie co funkcja kolegi (`lat, lon, validdate, <parametry>`), więc wyniki obu łączy jeden `merge`.
- Konto jest ważne do **22.11.2026**. Limit to 1000 zapytań na dobę i 10 naraz. Dane logowania są w `.env`, którego nie wolno wrzucać do repo.

## 2. Plik plonów skorygowany według pogody

- `df_poland_harvest_adjusted.csv` ma ten sam format co oryginał. Plon w każdym punkcie jest przesunięty między miesiącami według zdarzeń pogodowych, a **sumy roczne w punktach się nie zmieniły**. Kontrola potwierdziła to dla wszystkich 79 167 kombinacji.
- Zdarzenia pochodzą z Meteomatics (`events_monthly.csv`): susza, upał, przymrozki, ulewy, wichury, grad, wilgotność gleby, ewapotranspiracja. Obejmują 2376 punktów, lata 2015–2025, miesiące kwiecień–grudzień.
- Skrypty: `fetch_events.py` (pobieranie) i `adjust_harvest.py` (przeliczenie, ok. 15 s).

**Otwarte:**
- Siła efektów to założenie, bez kalibracji na danych o rzeczywistych terminach żniw.
- W 26 punktach (ok. 1%) brakujące dane (−666) zawyżają przesunięcia. Poprawka: pomijać −666 przy agregacji.
- Lata w pliku są prawdopodobnie przesunięte o 5 lat. Szczegóły: `RESEARCH_przesuniecie_5_lat.md`. Jeśli tak jest, trzeba pobrać pogodę dla lat 2010–2020 i przeliczyć.

## 3. Analizy

- `RAPORT_porownanie_GUS.md`: kierunek przesunięć terminów zbiorów się zgadza (susza daje wcześniejsze żniwa, deszcz późniejsze), ale siła jest za mała. W sumach rocznych w pliku nie widać suszy.
- `RESEARCH_przesuniecie_5_lat.md`: z pogodą z roku −5 korelacje mają sensowne znaki. Pasują konkretne lata: 2012 (wymarznięcie pszenicy) i 2015 (susza). Rok 2013 nie był rokiem suszy.

## 4. Pola A, B, C pod Tomaszowem Lubelskim: dane do strony

Trzy sąsiednie, prawdziwe pola ok. 5 km na południowy wschód od Tomaszowa, z granicami odrysowanymi z ortofotomapy.

| Pole | ha | Wysokość | Spadek | Gleba |
|---|---|---|---|---|
| A | 18,3 | 293–311 m | 4,3% | less |
| B | 26,6 | 290–312 m | 4,2% | less |
| C | 38,0 | 268–293 m | 5,2% | less |

- **Zdjęcia:**
  - Sentinel-2 w 10 m z 9 bezchmurnych dat sezonu 2026 (kwiecień–wrzesień), sprawdzonych maską chmur.
  - Ortofotomapa GUGiK ok. 0,5 m/px jako tło.
  - HLS w 30 m (NASA).
- **Historia z prawdziwych zdjęć:** pole A brązowieje pierwsze, już 24.06. 26.07 A jest gołe, a C wciąż zielone.
- **Różnice z makietą:** gleba i spadek są na wszystkich polach prawie takie same. Prawdziwa różnica to położenie na stoku: C leży najniżej. Uprawy na polach nie są znane.
- **Paczka do wysłania:** `pola_teren_gleba.zip` (58,9 MB), z README i skryptami. Źródła nie wymagają logowania.

## 5. Strona na Vercelu: czym możemy ją wypełnić

- **Ekran 1 (Mój sezon):**
  - pogoda dla pola, czyli opady, woda w glebie i zdarzenia: z Meteomatics, do pobrania przed 22.11,
  - zdjęcia: gotowe z Sentinela i HLS.
- **Ekran 2 (Dlaczego to pole):**
  - spadek, gleba i zdjęcia: gotowe,
  - dni gołej gleby i krzywa zieleni: wymagają NDVI z HLS lub Sentinela, jeszcze niepoliczone.
- **Ekran 3 (Mój płodozmian):** model z podanymi źródłami. Brakuje źródła kosztu międzyplonu (260 zł/ha).

## Do zrobienia / decyzje

1. **Przed 22.11:** pobrać z Meteomatics pogodę sezonu 2026 dla pól A, B i C.
2. **Podpisy źródeł na stronie.** Dane NASA to HLS i SRTM. Sentinel-2, ortofotomapa, SoilGrids i Meteomatics to dane partnerów.
3. **Krzywa zieleni i dni gołej gleby dla pól.** Następny najcenniejszy krok, bo da prawdziwe liczby zamiast makiety.
4. **Decyzja o przesunięciu lat w pliku plonów.** Rozstrzygnie ją porównanie z tabelą GUS.
