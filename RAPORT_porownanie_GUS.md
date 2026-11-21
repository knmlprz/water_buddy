# Skorygowane plony a rzeczywistość: szybka ocena

Ocena orientacyjna: nie liczyłem jej na danych GUS, tylko porównałem z tym, co wiadomo o sezonach z mediów rolniczych i ogólnej wiedzy. Liczby GUS podaję z pamięci, są przybliżone i trzeba je sprawdzić przed użyciem na scenie.

## 1. Terminy zbiorów (to, co zmieniliśmy)

GUS nie publikuje miesięcznego kalendarza zbiorów, więc twardego porównania nie ma. Kierunki przesunięć zgadzają się jednak z tym, jak opisywano poszczególne sezony:

| Rok | Model (pszenica / kukurydza) | Co wiadomo o sezonie | Zgodność |
|---|---|---|---|
| 2015 | −2 / −5 dni | susza, wczesne i szybkie żniwa | ✅ |
| 2017 | +2 / +6 dni | deszczowe żniwa, mokra jesień, kukurydza zbierana do zimy | ✅ |
| 2018 | −4 / −1 dni | susza i upał, żniwa zaczęły się ok. 2 tygodnie wcześniej | ✅, ale słabiej niż w rzeczywistości |
| 2019 | −3 / −1 dni | susza, wcześniejsze żniwa | ✅ |
| 2021 | +5 / +2 dni | ulewy w lipcu i sierpniu, przerywane żniwa | ✅ |
| 2025 | +2 / +2 dni | deszczowy lipiec, opóźnienia | ✅ prawdopodobnie |

**Moje zdanie:** kierunek jest dobry, ale siła jest raczej za mała. W 2018 roku żniwa były wcześniej o ok. 2 tygodnie, a u nas średnio o 4 dni. Współczynniki można spokojnie podnieść mniej więcej dwukrotnie. Dopiero dane o rzeczywistych terminach, np. raporty IUNG albo ARiMR, pozwoliłyby to skalibrować.

## 2. Sumy roczne (których nie ruszaliśmy)

Umówiliśmy się, że sumy w pliku są prawidłowe. Zauważyłem jednak przy okazji, że **nie pokazują suchych lat**, a w danych GUS te lata wyraźnie odstają:

- **Pszenica:** w pliku 2018 (15,2 tys.) jest wyżej niż 2017 (13,2 tys.). W GUS 2018 to wyraźny spadek przez suszę.
- **Kukurydza:** w pliku 2018 (4,9 tys.) jest prawie na poziomie 2017 (5,0 tys.), a w 2020 jest dołek (3,8 tys.). W GUS 2018 to spadek, a od 2020 roku produkcja szybko rośnie.
- **Soja:** rząd wielkości 50–100 pasuje, jeśli jednostką są tysiące ton. Uprawa w Polsce jest mała i rośnie.

Jednostki w pliku nie są opisane. Jeśli to tysiące ton, poziom pszenicy (14–19 mln t) jest wyraźnie wyższy niż w GUS (ok. 10–14 mln t), więc może to być inna miara.

**Moje zdanie:** jeśli sumy pochodzą z „reverse engineeringu”, a nie bezpośrednio z GUS, to one są najsłabszym ogniwem, a nie terminy zbiorów. Warto raz zestawić je z tablicą GUS „Produkcja upraw rolnych” za lata 2015–2025.

## 3. Rozkład przestrzenny

W oryginale udział każdego punktu w sumie krajowej jest prawie identyczny co roku. U nas też, bo tak się umówiliśmy. W rzeczywistości susza 2018 uderzyła głównie w centrum i zachód kraju, a mniej w południowy wschód. Nasze zdarzenia z API pozwalają to odtworzyć jednym przełącznikiem w `adjust_harvest.py`: przerzucanie plonu między punktami przy zachowaniu sumy krajowej, czyli wcześniejszy wariant planu.

## Podsumowanie

- Terminy zbiorów są wiarygodne co do kierunku, ale przesunięcia są raczej za słabe.
- Sumy roczne bym sprawdził z GUS, bo nie widać w nich suszy 2015 i 2018.
- Do pitchu wystarczy zdanie: „termin zbioru reaguje na suszę i deszcz zgodnie z obserwowanymi sezonami; siłę efektu kalibrujemy w pilotażu”.
