import { CROPS_DATA } from '@/data/crops'
import { LIMITATIONS_DATA } from '@/data/limitations'
import { RECOMMENDATION_RULES } from '@/data/rules'
import { EDO_LADDER, KBW_THRESHOLDS, NDVI_CLASSES, SOIL_WATER_GROUPS } from '@/data/thresholds'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Metodyka' }

const ZRODLA = [
  ['Usługa lokalizacji działek', 'obrys i opis działki', 'GUGiK'],
  ['Open-Meteo, archiwum', 'deszcz i parowanie, do 10 lat wstecz', 'CC BY 4.0'],
  ['NASA POWER', 'zapas, gdy Open-Meteo nie odpowie. Parowanie jest wtedy szacunkiem z energii', 'NASA'],
  ['ISRIC SoilGrids', 'woda dostępna w warstwie 0–30 cm, środek działki', 'SoilGrids'],
  ['Open-Meteo, wysokość', 'pięć punktów co około 150 m, stąd spadek', 'Open-Meteo'],
  ['Earth Search, Sentinel-2', 'podgląd najnowszej czystszej sceny. Bez odczytu pikseli działki', 'Copernicus'],
  ['OpenStreetMap przez Overpass', 'odległość do najbliższego cieku w promieniu 3 km', 'OpenStreetMap'],
]

export default function Page() {
  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-2xl font-semibold">Metodyka</h1>
        <p className="mt-2 text-base/7 text-zinc-600 dark:text-zinc-300">
          Widok dla jury i doradcy: uprawy, progi, reguły, źródła i ograniczenia. Rolnik zostaje na starcie i w raporcie.
          Suwaków do ręcznego podstawiania liczb nie ma. Raport liczy się z danych pobranych dla podanej działki i daty.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">Uprawy</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="py-2 pr-3 font-medium">Uprawa</th>
                <th className="py-2 pr-3 font-medium">Okno krytyczne</th>
                <th className="py-2 pr-3 font-medium">Wrażliwość</th>
                <th className="py-2 font-medium">Próg bilansu, gleba bardzo lekka</th>
              </tr>
            </thead>
            <tbody>
              {CROPS_DATA.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 align-top">
                  <td className="py-2 pr-3 font-medium">{u.nazwa_pl}</td>
                  <td className="py-2 pr-3">{u.okno_krytyczne_opis}</td>
                  <td className="py-2 pr-3">{u.wrazliwosc_na_susze}</td>
                  <td className="py-2">{u.prog_kbw_kat1_mm} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Progi</h2>
        <div>
          <h3 className="font-medium">Drabina suszy</h3>
          <ul className="mt-2 space-y-2 text-sm/6">
            {EDO_LADDER.map((p) => (
              <li key={p.poziom}>
                <span className="font-semibold">{p.nazwa_pl}. </span>
                {p.warunek_logiczny}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-medium">Progi bilansu wodnego</h3>
          <ul className="mt-2 space-y-2 text-sm/6">
            {KBW_THRESHOLDS.map((p) => (
              <li key={p.id}>
                <span className="font-semibold">{p.poziom}. </span>
                {p.zakres_mm}. {p.znaczenie_agronomiczne}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-medium">Zieleń</h3>
          <ul className="mt-2 space-y-2 text-sm/6">
            {NDVI_CLASSES.map((p) => (
              <li key={p.klasa}>
                <span className="font-semibold">{p.etykieta_zakresu}. </span>
                {p.interpretacja}
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <h3 className="font-medium">Woda w glebie, warstwa 0–50 cm</h3>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="py-2 pr-3 font-medium">Grupa</th>
                <th className="py-2 pr-3 font-medium">Kategoria</th>
                <th className="py-2 font-medium">Woda dostępna</th>
              </tr>
            </thead>
            <tbody>
              {SOIL_WATER_GROUPS.map((g) => (
                <tr key={g.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">{g.grupa_uziarnienia}</td>
                  <td className="py-2 pr-3">{g.kategoria_iung}</td>
                  <td className="py-2">{g.woda_dostepna_50cm_mm} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Reguły</h2>
        <p className="text-sm text-zinc-600">
          Kolejność: najpierw weryfikacja, potem retencja w krajobrazie, zabieg na glebie, na końcu nawadnianie.
        </p>
        {RECOMMENDATION_RULES.map((r) => (
          <details key={r.id} className="rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
            <summary className="cursor-pointer font-medium">
              {r.kolejnosc_kowr}. {r.tytul}
            </summary>
            <p className="mt-2 text-sm">Warunek: {r.warunek_czytelny}</p>
            <p className="mt-2 text-sm/6">{r.tekst_dla_rolnika}</p>
            <p className="mt-2 text-xs text-zinc-500">Źródło: {r.zrodlo}</p>
          </details>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Źródła, z których liczy raport</h2>
        <p className="mt-2 text-sm/6 text-zinc-600">
          Obszar Natura 2000 i rowy z państwowej bazy topograficznej nie są jeszcze podłączone. Brak tych warstw widać w
          raporcie jako brak danych, a nie jako zero.
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3 font-medium">Źródło</th>
              <th className="py-2 pr-3 font-medium">Co bierzemy</th>
              <th className="py-2 font-medium">Licencja</th>
            </tr>
          </thead>
          <tbody>
            {ZRODLA.map((z) => (
              <tr key={z[0]} className="border-b border-zinc-100 align-top">
                <td className="py-2 pr-3">{z[0]}</td>
                <td className="py-2 pr-3">{z[1]}</td>
                <td className="py-2">{z[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ograniczenia</h2>
        {LIMITATIONS_DATA.map((l) => (
          <p key={l.id} className="text-sm/6">
            {l.zdanie_do_raportu}
          </p>
        ))}
      </section>
    </div>
  )
}
