# Czy lata w pliku plonów są przesunięte o 5 lat?

Analiza bez zmian w kodzie. Pogoda pochodzi z Meteomatics: 10 punktów w całej Polsce, dane dzienne 2010–2025, kwiecień–sierpień. Zużyło to 2 zapytania.

## Pogoda w rzeczywistych latach (średnia z 10 punktów)

| Rok | Indeks suszy V–VIII* | Wilgotność gleby 15 cm* | Opad IV–VIII [mm] | Dni ≥30°C |
|---|---|---|---|---|
| 2010 | 0.62 | 0.78 | 486 | 12.8 |
| 2011 | −2.18 | 0.58 | 417 | 3.0 |
| 2012 | −2.11 | 0.57 | 342 | 12.2 |
| **2013** | **0.75** | **0.69** | **345** | **7.9** |
| 2014 | 0.27 | 0.79 | 401 | 3.0 |
| 2015 | −2.20 | 0.46 | 216 | 16.8 |
| 2018 | −2.29 | 0.47 | 287 | 7.3 |
| 2019 | −2.38 | 0.47 | 332 | 13.0 |

\* Przed 2015 rokiem indeks suszy, a przed 2014 wilgotność gleby są dostępne tylko w części punktów (API zwraca −666, czyli brak danych). W tych latach liczy się więc opad i upał.

## Susza 2013 (w pliku rok 2018)

- Rok 2013 **nie był rokiem dużej suszy**. Opad był niższy niż przeciętnie (345 mm), upał umiarkowany (8 dni ≥30°C), a indeks suszy i wilgotność gleby wychodzą normalne albo lekko wilgotne.
- Plik dla roku „2018” jest z tym zgodny. Pszenica (15 183) i kukurydza (4879) leżą mniej więcej na linii trendu, bez wyraźnego spadku.
- To samo widać w danych GUS (z pamięci): rok 2013 przyniósł przeciętne zbiory, a późna i zimna wiosna przesunęła je trochę na później.

## Czy przesunięcie o 5 lat pasuje do danych?

Policzyłem korelację plonów z pliku, po odjęciu trendu, z pogodą z tego samego roku i z roku o 5 lat wcześniejszego:

| | Pogoda z tego samego roku | Pogoda z roku −5 |
|---|---|---|
| Pszenica a indeks suszy | −0.51 (susza = wyższy plon ❌) | +0.42 (susza = niższy plon ✅) |
| Pszenica a upał | +0.21 ❌ | −0.30 ✅ |
| Kukurydza a upał | −0.29 ✅ | −0.48 ✅ |
| Kukurydza a opad | 0.02 | +0.28 ✅ |

Przy przesunięciu o 5 lat znaki korelacji są fizycznie sensowne: susza i upał obniżają plon, a deszcz go podnosi. Bez przesunięcia wychodzi odwrotnie. Jest tylko 11 lat, więc to poszlaka, nie dowód.

Konkretne lata przy przesunięciu:

- **2012 (w pliku 2017):** pszenica spada wyraźnie (13 245). W 2012 roku oziminy masowo wymarzły zimą.
- **2012 (w pliku 2017):** kukurydza skacze (5011). Wymarznięte pola obsiewano wtedy kukurydzą.
- **2015 (w pliku 2020):** kukurydza wyraźnie spada (3762). To była silna susza, a kukurydza ucierpiała najbardziej.
- **2018 (w pliku 2023):** pszenica spada (15 193). Susza 2018.

**Moje zdanie:** hipoteza o przesunięciu o 5 lat jest mocno prawdopodobna. Plon kukurydzy w 2015 roku i wymarznięcie pszenicy w 2012 roku pasują za dobrze, żeby to był przypadek.

## Co to oznacza dla tego, co już zrobiliśmy

1. **Korekta miesięcy w `df_poland_harvest_adjusted.csv` użyła pogody z niewłaściwych lat**, czyli 2015–2025 zamiast 2010–2020. Wymaga to ponownego pobrania zdarzeń dla lat 2010–2020: ok. 230 zapytań, mieści się w dobowym limicie. W `fetch_events.py` zmienia się tylko `YEARS`, a w `adjust_harvest.py` mapowanie roku.
2. **Błąd przy okazji:** `fetch_events.py` nie odfiltrowuje wartości −666, czyli braku danych. Dotyczy to ok. 1% miesięcy w 26 punktach siatki, tylko indeksu suszy i wilgotności gleby. W tych punktach przesunięcia są przez to zawyżone. Wystarczy pomijać −666 przy agregacji.
3. **Przed 2015 rokiem indeks suszy i wilgotność gleby są niepełne.** W latach 2010–2014 korekta musiałaby opierać się głównie na opadzie, temperaturze, ET i burzach.
