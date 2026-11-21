# HackNation 2026 · KOWR: kontekst dla zespołu

Nov 21, 2026 · @Jakob

## TL;DR

Budujemy webowego asystenta dla rolnika. Rolnik podaje numer działki ewidencyjnej z dowolnego miejsca w Polsce i datę, a dostaje raport: jaki jest stan wody, z jakiego powodu i co może z tym zrobić. Hackathon trwa 21–22.11.2026 w Bydgoszczy.

Pięć rzeczy, które każdy w zespole musi wiedzieć:

1. **Jury testuje nas działkami, których nie znamy.** Poda numer działki z dowolnego miejsca w Polsce i datę z ostatnich 10 lat, a wynik porówna ze swoimi danymi referencyjnymi. Gotowe wyniki dla kilku działek dyskwalifikują: aplikacja musi liczyć wszystko z danych w chwili zapytania.
2. **Kolejność analizy jest obowiązkowa.** Najpierw ocena sytuacji wodnej, potem jej przyczyny, potem retencja, potem agrotechnika. Nawadnianie jest na końcu i jest opcjonalne. Rekomendacja bez wcześniejszej oceny działki jest błędem.
3. **Liczy się „tu i teraz”.** Mentorzy powtarzają, że najważniejsza jest decyzja na dziś i prosty interfejs. Prognozy i planowanie na lata to dodatki.
4. **Wiarygodność daje 25% punktów.** Każda liczba ma mieć źródło, każdy wynik poziom niepewności, a brak danych mówimy wprost. Mentorzy wolą, gdy wskazujemy, co jest źle, i zostawiamy decyzję rolnikowi, niż gdy wydajemy polecenia.
5. **Trzeba oddać 7 rzeczy:** działający link, prywatne repo, README z 9 punktami, prezentację PDF do 10 slajdów, film do 3 minut, przykładowy raport i opis. Wynik ma się liczyć w mniej niż 30 sekund.

## Zadanie KOWR: co prototyp musi robić

KOWR (Krajowy Ośrodek Wsparcia Rolnictwa) chce sprawdzić, czy otwarte dane da się zamienić w proste narzędzie do decyzji o wodzie na konkretnej działce. Odbiorcą jest rolnik bez znajomości GIS, teledetekcji i hydrologii.

**Obowiązkowy przebieg w prototypie (pkt 3.3):**

1. Rolnik otwiera aplikację w przeglądarce. Musi działać na Windowsie w Chrome, Firefoksie, Edge, Safari i Operze, bez instalowania czegokolwiek. Działanie na telefonie to dodatkowy atut.
2. Wskazuje działkę ewidencyjną: podaje jej identyfikator albo klika na mapie.
3. Wybiera aktualną uprawę.
4. Aplikacja pobiera dane i ocenia dwie rzeczy: bieżącą sytuację wodną oraz podatność działki na niedobory w ostatnich 10 latach. Liczy to z pobranych danych w chwili zapytania. Wyświetlenie wcześniej przygotowanych rekomendacji nie spełnia wymagań.
5. Rolnik dostaje raport. Raport zawiera:
   - stan niedoboru wody i jego przyczyny,
   - rekomendacje uzasadnione danymi: retencyjne, agrotechniczne i opcjonalnie dotyczące nawadniania,
   - datę i źródła danych,
   - ograniczenia: aktualność i dokładność danych, niepewność wyniku, czynniki nieuwzględnione.
6. Raport można zapisać w systemie, pobrać jako PDF albo wydrukować.

**Wymagane kategorie danych:** meteorologiczne, satelitarne, glebowe, hydrologiczne i przestrzenne (lokalizacja działki, użytkowanie terenu, rzeźba terenu). Każde źródło musi być bezpłatne, legalne i opisane razem z licencją. KOWR nie daje gotowych danych.

**Co oddajemy (pkt 4):**

| Element | Wymaganie |
| --- | --- |
| Działający prototyp | Link albo instrukcja uruchomienia w README. To element obowiązkowy. |
| Repozytorium | Prywatne co najmniej do końca wydarzenia, dostęp dla jury według instrukcji z platformy |
| README | 9 punktów: uruchomienie, funkcje, architektura, źródła danych, które dane są pobierane na żywo, a które wcześniej (z datami pobrania), biblioteki i użycie AI, licencje, ograniczenia, sposób weryfikacji wyników |
| Prezentacja | PDF, do 10 slajdów |
| Film | Do 3 minut, pokazuje działanie prototypu |
| Raport | Raport lub raporty wygenerowane przez prototyp |
| Opis | Nazwa zespołu, tytuł, problem, główne funkcje, sposób użycia danych, korzyści dla rolnika |

README musi też opisać skalowanie na całą Polskę: buforowanie, limity API, aktualizację danych i koszty. Jeśli korzystamy z płatnej usługi, podajemy jej koszt i darmową alternatywę. Danych osobowych nie zbieramy, jeśli nie są niezbędne.

## Jak nas ocenią

Połowa punktów to wartość dla rolnika i wiarygodność danych. Technika i prosta obsługa to razem 30%.

| Kryterium | Waga | Co konkretnie sprawdzają |
| --- | --- | --- |
| Wartość praktyczna | 25% | Konkretne decyzje do wykonania w gospodarstwie: retencja, nawadnianie, ograniczanie strat wilgoci, uwzględnienie lokalnych warunków |
| Dane i wiarygodność | 25% | Łączenie źródeł, metody zgodne z nauką, wynik dla tej konkretnej działki, uzasadnienie danymi, jawne ograniczenia i niepewność |
| Innowacyjność i rozwój | 20% | Co dodajemy ponad istniejące systemy (IUNG, IMGW, EDO), integracja z innymi systemami, skalowanie |
| Prostota obsługi | 15% | Zrozumiałe bez przygotowania technicznego, dopasowane do pracy w gospodarstwie |
| Prototyp i jakość techniczna | 15% | Stabilność, analiza dla wskazanej działki i daty, czas poniżej 30 s, architektura, bezpieczeństwo, dokumentacja, licencje |

**Etap 1, ocena wszystkich zgłoszeń.** Jury czyta dokumentację i ogląda film. Potem samo uruchamia prototyp dla tych samych działek u wszystkich zespołów i porównuje wyniki ze swoimi danymi referencyjnymi. Data analizy może być dzisiejsza albo dowolna z ostatnich 10 lat.

**Etap 2, finał dla 3–5 zespołów.** Pitch na żywo, a jury podaje 1–3 działki i datę analizy.

Wnioski dla nas:

- **Wybór daty to funkcja obowiązkowa.** Cała analiza musi działać „na dzień X”. Dane z przyszłości względem tej daty nie mogą trafić do wyniku.
- **Nie znamy danych referencyjnych jury.** Najbezpieczniej liczyć te same wskaźniki co państwowe systemy, czyli KBW według IUNG i mapy EDO, i podawać je obok naszego wyniku.
- **Zawsze zwracamy wynik.** Działka w lesie, w mieście, zachmurzone zdjęcia albo padłe API dostają czytelny komunikat z wyjaśnieniem, a nie błąd.
- **Limit 30 sekund.** Pobieranie z satelity piksel po pikselu dla 10 lat nie zmieści się w tym czasie. Potrzebujemy cache albo gotowych agregatów.

## Podstawy naukowe

Załącznik nr 1 sprowadza się do jednej zasady: **sam opad nic nie mówi**. Liczy się bilans wody, a rekomendacje mają wynikać z przyczyny problemu. Załącznik powołuje się na FAO-56, system monitoringu suszy IUNG i natural water retention measures UE.

**Kolejność analizy wymagana przez KOWR:**

1. **Ocena sytuacji wodnej.** Oddzielamy dwie rzeczy: czy susza jest teraz i czy to miejsce jest na nią podatne w długim okresie. Dane satelitarne nigdy nie są interpretowane osobno, tylko razem z pogodą, glebą i hydrologią.
2. **Przyczyny.** Te same objawy na polu mogą mieć różne przyczyny i wymagają wtedy różnych działań:
   - brak opadu przy wysokiej temperaturze,
   - słaba retencja gleby (gleba lekka, piaszczysta, mało materii organicznej),
   - nadmierny spływ powierzchniowy (stok, brak oczek wodnych, mokradeł i zadrzewień),
   - uprawa wrażliwa na brak wody.
3. **Retencja w krajobrazie.** Woda ma zostać tam, gdzie spadła („retain water where it falls”). Narzędzia: małe zbiorniki, oczka wodne, mokradła, strefy buforowe, zadrzewienia śródpolne.
4. **Retencja glebowa i agrotechnika.** Międzyplony, resztki pożniwne, ograniczenie intensywnej uprawy, więcej materii organicznej.
5. **Nawadnianie.** Na końcu i tylko wtedy, gdy ma uzasadnienie.

Rozwiązanie ma łączyć pięć kategorii danych, wskazywać przyczyny, uwzględniać uprawę, podawać niepewność i uzasadniać każdą rekomendację danymi.

**Materiały polecane przez ekspertów (już przeczytane, liczby są w sekcji „Dane i metody”):**

- [POLSA 2024, „Dane satelitarne dla administracji publicznej”](https://polsa.gov.pl/aktywnosci/obserwacja-ziemi/dane-satelitarne/), rozdz. 6.3.3 i 6.3.4.
- [CDR 2025, „Melioracje, retencja i gospodarka wodna w rolnictwie”](https://woda.cdr.gov.pl/images/publikacje/Publikacje/Melioracje_retencja_wodna_e-poradnik_2025.pdf).

Warto wiedzieć: mentor **dr inż. Tymoteusz Bolewski** jest współautorem rozdziałów CDR o agrotechnice, retencji i systemach wspomagania decyzji. Jeśli metody z tego poradnika będą w naszym kodzie, łatwo je obronić przed jury.

## Co mówią mentorzy

Mentorzy chcą przede wszystkim jasnej odpowiedzi na pytanie „co z wodą na mojej działce teraz”, z podanym źródłem danych. Poniżej notatki z rozmów, pogrupowane. Tam, gdzie notatka była niejasna, w nawiasie jest moja interpretacja.

**Priorytet: tu i teraz**

- Najważniejsze jest to, co rolnik ma zrobić teraz, w krótkim horyzoncie bieżącego sezonu wegetacyjnego. Wybieganie w przyszłość to dodatek.
- Decyzja na dziś dla obszaru z problemem wody: kiedy ostatnio padało, gdzie i kiedy najczęściej występują okresy suche, co robić i kiedy.
- Krótka analiza ostatnich lat. Porównanie z przeszłością typu „kiedyś było tak, a teraz jest gorzej” dobrze trafia do rolnika.
- Kontekst: postępujące pustynnienie kraju.

**Rekomendacje: sugestie, nie polecenia**

- Raczej sugestie niż gotowe rozwiązania. Rolnik ma sam dojść do decyzji.
- Mniej rekomendacji, więcej pokazywania, co jest błędne (co na tej działce działa źle i dlaczego).
- Lepiej pytać „co dodać?” niż „co zmienić?”. Rolnik chętniej coś dodaje, niż przebudowuje gospodarstwo.
- Przykłady dobrych rekomendacji:
  - **oczka wodne**,
  - **uprawa konserwująca** (sposoby niemechaniczne),
  - **melioracja**: czy na działce są rowy lub drenowanie, czy są używane, a jeśli nie, to czy je uruchomić. Decyzja należy do właściciela.
- **Nawadnianie: ile wody na podstawie dostępnych danych.** W notatkach oznaczone jako „mega ważne”, choć KOWR traktuje je jako opcjonalne.
- UE ma ogólne rozwiązania dla lepszych plonów (zapewne natural water retention measures, NWRM). Warto je przywołać w rekomendacjach.

**Dane, które mają znaczenie**

- Rodzaje upraw w Polsce i ich podstawowe parametry. Na tym rolnik opiera decyzję. Najważniejsze jest to, co znaczące dla kogoś, kto sieje na polskiej ziemi.
- Wyniki publikacji: do predykcji i do wyboru statystyk na dashboard. Bierzemy tylko to, co relevantne.
- Badania poletkowe: jak rośliny zachowują się w konkretnych warunkach. Też tylko to, co relevantne dla dashboardu.
- Jasno pokazujemy, skąd mamy dane, na jakich zasadach z nich korzystamy i jak je przetwarzamy.

**Interfejs**

- Prosta, intuicyjna aplikacja z przejrzystym interfejsem. Sposób przekazania informacji ma znaczenie.
- Prosty odczyt na pierwszym planie. Dodatkowe wykresy i dane dostępne do rozwinięcia.
- Kluczowa jest personalizacja (działka, uprawa, własne dane rolnika).

**Na później (perspektywa planowania, nie MVP)**

- Dopłaty dla rolników na danym terenie. Jeśli jest ich dużo, można je dodać do rekomendacji.
- Źródła doradztwa rolniczego (CDR): zmiana profilu produkcji, warunki środowiskowe, poradniki.
- Obszary Natura 2000 (zapewne jako ograniczenie przy kopaniu oczek i melioracji).
- Wzrost wartości rynkowej ziemi. Przydatne, ale bez znaczenia dla jury.

## Fuzja: zasady projektowe

Regulamin, mentorzy i załącznik naukowy w większości mówią to samo. Daje to 8 zasad dla produktu i 5 napięć, które musimy rozstrzygnąć świadomie.

| # | Zasada | Skąd | Co to znaczy w produkcie |
| --- | --- | --- | --- |
| 1 | Najpierw diagnoza, potem rada | KOWR 3.2, załącznik | Raport zawsze w kolejności: stan → przyczyna → retencja → agrotechnika → nawadnianie. Każda rada wskazuje, który wynik diagnozy ją uzasadnia. |
| 2 | Tu i teraz na górze | Mentorzy | Pierwszy ekran raportu to jedno zdanie o stanie na wybraną datę, kolor i „co zrobić w tym tygodniu”. Historia i wykresy są poniżej, do rozwinięcia. |
| 3 | Przyczyna, nie tylko objaw | Załącznik | Rozróżniamy cztery przyczyny: opad i upał, słaba gleba, spływ ze stoku, wrażliwa uprawa. Rekomendacje dobieramy do przyczyny. |
| 4 | Pokazuj, co jest źle, a decyzję zostaw rolnikowi | Mentorzy | Ton: „na tej działce woda szybko ucieka ze stoku; można rozważyć X, Y”. Bez „musisz”. Opcje do dodania, nie przebudowa. |
| 5 | Historia w krótkiej formie | KOWR (10 lat), mentorzy | „W 7 z ostatnich 10 lat maj–lipiec był tu suchy” oraz porównanie tego roku z normą. |
| 6 | Źródło przy każdej liczbie | KOWR 3.3, kryterium 2, mentorzy | Ikona źródła, data pobrania i poziom pewności przy każdym wskaźniku. Sekcja „Ograniczenia” w raporcie. |
| 7 | Brak danych mówimy wprost | KOWR 3.3 | „Brak bezchmurnych zdjęć od 12 dni” zamiast zgadywania. Żadnej pozornej precyzji, czyli żadnego „23,7% straty plonu”. |
| 8 | Prosto dla laika | KOWR 3.1, kryterium 4, mentorzy | Numer działki albo klik na mapie, wybór uprawy, raport. Zero słownictwa GIS na pierwszym ekranie. |

**Napięcia do rozstrzygnięcia:**

1. **Nawadnianie.** KOWR traktuje je jako opcjonalne, w notatkach jest „mega ważne”. Propozycja: robimy prosty kalkulator dawki z bilansu wodnego (FAO-56 lub metoda CDR) jako ostatni krok raportu. Jest tani w implementacji i odpowiada na uwagę mentora.
2. **Tu i teraz kontra 10 lat.** Oba są wymagane. Rozwiązanie: historia jest kontekstem dla stanu bieżącego, a nie osobnym ekranem.
3. **Sugestie kontra wymagane rekomendacje.** KOWR wymaga rekomendacji, mentorzy chcą sugestii. Rozwiązanie: rekomendacje formułujemy jako „można rozważyć”, z uzasadnieniem, i zostawiamy wybór rolnikowi.
4. **Personalizacja kontra brak danych osobowych.** Personalizujemy po działce i uprawie, bez kont i bez imion. Raport zapisujemy lokalnie albo pod losowym linkiem.
5. **Wybrana data kontra dane „na dziś”.** Wiele API daje tylko stan bieżący (na przykład SMSR i hydrologia). Dla dat historycznych potrzebne są archiwa albo uczciwe oznaczenie „niedostępne dla tej daty”.

## Dane i metody

Wszystko, czego potrzebujemy, jest dostępne za darmo. Najtrudniejsze będzie zmieszczenie 10 lat danych w limicie 30 sekund.

### Źródła według kategorii KOWR

| Kategoria | Źródło | Do czego | Uwagi |
| --- | --- | --- | --- |
| Przestrzenne | [ULDK GUGiK](https://uldk.gugik.gov.pl/opis.html) | Numer działki → jej obrys | To pierwsze wywołanie w całym przepływie. Bez niego nie ma niczego dalej. |
| Przestrzenne | [Geoportal NMT (WCS)](https://www.geoportal.gov.pl) | Spadek, ekspozycja, kierunek spływu, zagłębienia | NMT jest dokładniejszy niż SRTM. |
| Satelitarne | [Earth Search, Sentinel-2](https://earth-search.aws.element84.com/v1) | NDVI, NDMI dla działki | Bez konta. Trzeba pobierać pasma B04, B08, B8A, B11 i SCL, bo obraz „visual” nie wystarczy. |
| Meteo | [Open-Meteo](https://open-meteo.com/en/terms), [IMGW](https://danepubliczne.imgw.pl/apiinfo) | Opad, temperatura, ET0, wilgotność gleby, 10 lat archiwum | Open-Meteo jest najprostsze. Warunki licencji trzeba sprawdzić. |
| Glebowe | [IUNG SMSR](https://susza.iung.pulawy.pl/), [mapa kategorii](https://susza.iung.pulawy.pl/mapa-kategorii/), [SoilGrids](https://docs.isric.org/globaldata/soilgrids/) | Kategoria gleby, podatność na suszę, uziarnienie | Kategorie IUNG pasują do państwowej definicji suszy. Dostęp maszynowy trzeba sprawdzić. |
| Hydrologiczne | [ISOK Hydroportal](https://isok.gov.pl/hydroportal.html), PGW Wody Polskie | Cieki, rowy, zbiorniki w pobliżu, mapa hydrograficzna | Podstawa rekomendacji typu „spowolnij odpływ rowem”. |
| Tło suszowe | [EDO WMS](https://drought.emergency.copernicus.eu/data/wms-service) | Wskaźniki CDI, SPI, SMA dla regionu | Rozdzielczość 5 km i 0,1°, więc tylko jako kontekst i kontrola spójności. |

### Wskaźniki i progi (cytowane, z podanym źródłem)

**Klimatyczny bilans wodny, KBW = opad − ewapotranspiracja (mm).** Wartości poniżej −50 mm mogą sygnalizować początek suszy. Ustawowa susza rolnicza to KBW poniżej progu dla danej uprawy i kategorii gleby w dowolnym okresie 6 dekad między 21.03 a 30.09 (CDR, s. 66). Progi dla upraw podaje IUNG.

**SPI, standaryzowany wskaźnik opadu.** Najlepiej do suszy rolniczej pasuje SPI-3. WMO uznało SPI za wskaźnik referencyjny w 2010 r. (POLSA, s. 288). Wymaga wieloletniej serii danych.

**Drabina alarmowa EDO (CDI, POLSA tab. 6.4):**

1. **Obserwacja:** SPI-3 < −1 lub SPI-1 < −2 (brakuje opadu).
2. **Ostrzeżenie:** do tego anomalia wilgotności gleby SMA < −1.
3. **Alarm:** do tego anomalia zieleni ΔFAPAR < −1. U nas można ją zastąpić anomalią NDVI działki.

Ta drabina to gotowy, uznany szkielet naszej oceny „stanu”.

**Klasy NDVI (POLSA, s. 293):** gleba od −0,1 do 0,1, słaba kondycja 0,2–0,4, umiarkowana 0,4–0,6, dobra powyżej 0,6. Do wody w roślinach służą **NDMI/NDII = (NIR − SWIR1) / (NIR + SWIR1)** i MSI = SWIR1 / NIR. Każdy wynik z satelity zestawiamy z typową krzywą dla wybranej uprawy, bo żniwa też dają „brązowe pole”.

**Woda w glebie według uziarnienia (CDR tab. 12, van Genuchten, % obj.):**

| Grupa | PPW | Punkt hamowania wzrostu | Punkt więdnięcia | Woda dostępna w 0–50 cm |
| --- | --- | --- | --- | --- |
| Piasek luźny | 7,0 | 5,0 | 5,0 | ok. 10 mm |
| Piasek gliniasty | 19,4 | 8,1 | 5,5 | ok. 70 mm |
| Glina lekka | 24,5 | 11,9 | 7,2 | ok. 87 mm |
| Glina zwykła | 33,0 | 17,8 | 11,1 | ok. 110 mm |
| Pył zwykły (less) | 41,9 | 16,3 | 7,5 | ok. 172 mm |

Woda dostępna to (PPW − punkt więdnięcia) × 500 mm. Policzyłem to z tabeli. Właśnie ta różnica, od 10 do 172 mm, najlepiej wyjaśnia rolnikowi, dlaczego jego pole schnie szybciej.

**Okna krytyczne upraw (CDR, s. 225–234):**

- zboża ozime na glebie średniej: 2. dekada maja – 1. dekada lipca, na lekkiej od 1. dekady maja;
- zboża jare: 3. dekada maja – 1. dekada lipca;
- kukurydza: lipiec–sierpień;
- ziemniak średniowczesny: 2. dekada czerwca – koniec lipca;
- burak cukrowy: od połowy czerwca;
- rzepak: pąkowanie, kwitnienie, zawiązywanie łuszczyn.

**Nawadnianie (CDR, s. 243–252):** bilans dzienny zapasu wody łatwo dostępnej w strefie korzeni według metody Drupki, czyli to samo co FAO-56. Dopuszczalne wyczerpanie zapasu: zboża i rzepak 50%, buraki i lucerna 60%, uprawy krótkie 40%. Dawka to brakująca woda do PPW, w praktyce około 0,75 dawki maksymalnej. System „Woda dla Kujaw” działa dokładnie tak.

**Agrotechnika (CDR, s. 99–106):**

- mulcz zmniejsza parowanie „nawet o blisko 60%” i spowalnia spływ na stokach;
- międzyplony i poplony dają okrywę gleby;
- uprawa uproszczona: orka przesusza glebę;
- głęboszowanie pomaga na glebach średnich i ciężkich z podeszwą płużną.

Te liczby można cytować, ale nie wolno ich przekładać na plon.

## Nasz koncept

**Do uzupełnienia przez zespół:** nazwa, jednozdaniowy opis, czym różnimy się od SMSR IUNG, „Woda dla Kujaw” i EDO, wybrany stos technologiczny i hosting.

Poniżej minimalny przepływ, który wynika z regulaminu, niezależnie od konceptu. Cztery źródła pobieramy równolegle, żeby zmieścić się w 30 sekundach, a analiza idzie ściśle w kolejności wymaganej przez KOWR.

&#91;embedded content: przepływ analizy · 4 źródła, 4 kroki\]

Po kolei: rolnik podaje działkę, uprawę i datę, cztery źródła pobierają się naraz, a raport powstaje dopiero po ocenie i diagnozie przyczyn. Przewaga, którą można pokazać jury: państwowe systemy działają w skali 5 km, gminy albo powiatu. My mówimy o jednej działce, z Sentinel-2 w 10 m i z rzeźbą terenu z NMT.

## Pułapki i ryzyka

Największe ryzyko to prototyp, który działa tylko na naszych przykładowych działkach i tylko dziś.

| Ryzyko | Skutek | Co robimy |
| --- | --- | --- |
| Wyniki z góry zamiast liczenia | Niezgodność z pkt 3.3.4, wynik nie przejdzie | Każda liczba w raporcie powstaje w kodzie z pobranych danych. Do README dopisujemy, co jest liczone na żywo, a co pobrane wcześniej. |
| Konto Meteomatics wygasa 22.11 | Jury testuje po tej dacie, więc aplikacja przestanie działać | Na produkcji nie używamy Meteomatics. Bierzemy Open-Meteo albo IMGW. |
| Ponad 30 s na działkę | Utrata punktów za jakość techniczną | Zapytania wysyłamy równolegle, cache’ujemy wyniki, czytamy tylko wycinek zdjęcia z pasma (HTTP Range), statystyki 10 lat liczymy na agregatach dekadowych. |
| Chmury na zdjęciach w wybranym dniu | Brak NDVI | Bierzemy najbliższą bezchmurną scenę (maska SCL) i podajemy jej datę oraz „wiek” danych. |
| Żniwa wyglądają jak susza | Fałszywy alarm, łatwy do wyłapania przez jury | Interpretujemy wynik względem fenologii wybranej uprawy. Gwałtowny spadek NDVI po szczycie w lipcu przy zbożach to zbiór, nie susza. |
| Data historyczna, a API zna tylko „dziś” | Raport miesza daty | Każde źródło ma oznaczenie „dostępne dla daty X: tak/nie”. Odcinamy wszystkie dane po dacie analizy. |
| Działka nierolnicza, wodna albo w Naturze 2000 | Absurdalna rekomendacja, na przykład „wykop oczko” w rezerwacie | Sprawdzamy użytkowanie terenu i ograniczenia przed rekomendacjami. W raporcie dajemy wprost komunikat „to nie jest grunt orny”. |
| Pozorna precyzja | Strata punktów za wiarygodność | Podajemy klasy i zakresy zamiast ułamków. Nie liczymy strat plonu w procentach bez modelu plonu. |
| Licencje danych | Wymóg formalny z pkt 5.3 | Każde źródło idzie do tabeli w README z licencją od pierwszego dnia, a nie na koniec. |
| Klucze API w repo | Problem bezpieczeństwa, który jury może zauważyć | Klucze trzymamy w `.env` dopisanym do `.gitignore`. Najlepiej korzystać z źródeł bez kluczy. |

## Otwarte pytania

Czterech pierwszych nie da się rozstrzygnąć kodem, a od nich zależy architektura. Warto je zadać mentorom dziś.

**Do mentorów:**

- [ ] Jakie dane referencyjne ma jury: KBW według IUNG, mapy EDO, pomiary in situ? Od tego zależy, co liczymy „jak oni”. (Bolewski)
- [ ] Czy ocenę „historycznej podatności” można oprzeć na KBW i SPI z Open-Meteo, czy jury oczekuje kategorii suszy IUNG? (Bolewski, Gozdowski)
- [ ] Jak głęboki ma być kalkulator nawadniania, skoro jest „opcjonalny”, a w notatkach „mega ważny”? (Bolewski)
- [ ] Czy jury użyje formatu TERYT, na przykład `061802_2.0001.123`, czy też adresu albo numeru obrębu? Czy ULDK wystarczy? (Rychlicki)
- [ ] Które uprawy ważą najwięcej dla polskiego rolnika i ile ich dać na liście? (Gozdowski)
- [ ] Jak pokazać dopłaty i Naturę 2000, żeby nie odciągały od „tu i teraz”? (Czerniejewski, mentorzy instytucjonalni)

**Do zespołu:**

- [ ] Opis konceptu w sekcji „Nasz koncept”: nazwa, przewaga nad SMSR i „Woda dla Kujaw”, stos technologiczny.
- [ ] Gdzie hostujemy działającą wersję, żeby link działał dla jury po wydarzeniu?
- [ ] Jaki jest dokładny termin oddania zgłoszenia na platformie?
- [ ] Raport generujemy przez wydruk do PDF z przeglądarki czy własnym generatorem?

## Propozycja podziału zadań

Proponuję 6 obszarów, które mogą ruszyć równolegle. Warunek: w pierwszej godzinie ustalamy jeden kontrakt JSON wyniku analizy. Bez niego front i silnik będą się rozjeżdżać. Przypisanie osób zostawiam zespołowi.

| # | Obszar | Zadania | Gotowe, gdy |
| --- | --- | --- | --- |
| 0 | Kontrakt (wszyscy, 1 h) | Schemat JSON: działka, data, stan, przyczyny, rekomendacje, źródła, ograniczenia. Na początek mock z jednym przykładem. | Front renderuje mock, silnik zwraca ten sam kształt. |
| 1 | Działka i teren | ULDK: numer → obrys. Klik na mapie → numer. NMT: spadek i zagłębienia. Użytkowanie terenu, cieki i rowy w promieniu około 500 m, Natura 2000. | Dla 5 losowych działek z różnych woj. dostajemy obrys i atrybuty terenu w mniej niż 5 s. |
| 2 | Pogoda i historia | Opad, temperatura, ET0 i wilgotność gleby za 10 lat do daty X. KBW, SPI-1 i SPI-3, długość okresów bezopadowych. Sezon na tle normy i „ile lat było suchych”. | Wynik dla dowolnej daty z 10 lat, bez danych z przyszłości. |
| 3 | Satelita | Sentinel-2: NDVI i NDMI w obrysie, mediana, maska chmur. Najbliższa dobra scena do daty X. Anomalia względem tej samej pory w poprzednich latach, interpretacja według uprawy. | Krzywa sezonu i anomalia dla działki w mniej niż 15 s albo z cache. |
| 4 | Silnik oceny i rekomendacji | Drabina EDO (obserwacja, ostrzeżenie, alarm). Diagnoza przyczyny (opad, gleba, spływ, uprawa). Reguły rekomendacji z uzasadnieniem i źródłem: retencja, agrotechnika, nawadnianie według FAO-56 i CDR. Niepewność. | Każda rekomendacja wskazuje, który wynik ją wywołał. Przy brakujących danych zwraca „brak” zamiast zgadywania. |
| 5 | Front i raport | Ekran: numer albo mapa, uprawa, data. Raport „tu i teraz” na górze, szczegóły do rozwinięcia. Eksport PDF i wydruk. Wersja mobilna. Test w 5 przeglądarkach. | Laik przechodzi od numeru działki do PDF bez instrukcji. |
| 6 | Dokumentacja i pitch | README z 9 punktami i tabelą licencji prowadzone od początku. Opis skalowania. 10 slajdów, film do 3 min, przykładowe raporty, test na „działkach jury” z kilku regionów. | Wszystkie 7 elementów zgłoszenia oddane przed terminem. |

Kolejność: najpierw 0, potem równolegle 1, 2, 3 i 5 na mocku. Obszar 4 zaczyna się, gdy 1–3 zwracają pierwsze prawdziwe liczby. Obszar 6 idzie cały czas w tle. Obszar 1 jest wejściem dla wszystkich pozostałych, więc powinien go wziąć najszybszy backendowiec.
