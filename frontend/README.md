# Woda na działce

Jedna strona: działka ewidencyjna, uprawa, dzień analizy. Niedobór w milimetrach liczy się po pobraniu obrysu, pogody, gleby i wysokości. Stare ekrany sezonu, przyczyny i płodozmianu zostały w kodzie, ale nie są w menu.

## Uruchomienie

```bash
npm install
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

Wpisz numer działki albo puknij w mapę, wybierz uprawę i dzień, potem „Pokaż wodę na działce”. Druk: przycisk „Drukuj”.

Sprawdzenie samego bilansu, bez sieci:

```bash
node scripts/bilans-check.mjs
```

Sprawdzenie obrysów działek (sieć):

```bash
node scripts/dzialka-check.mjs
```
