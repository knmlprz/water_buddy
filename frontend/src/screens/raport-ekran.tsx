'use client'

import { EChart } from '@/components/e-chart'
import { MapaPolski } from '@/components/mapa-polski'
import { longDate } from '@/lib/dates'
import type { Raport } from '@/lib/raport'
import type { EChartsOption } from 'echarts'
import { useEffect, useMemo, useState } from 'react'

const KROKI = [
  { id: 'dzialka', nazwa: 'Działka i teren', zrodlo: 'usługa lokalizacji działek, wysokość terenu' },
  { id: 'pogoda', nazwa: 'Pogoda z 10 lat', zrodlo: 'Open-Meteo' },
  { id: 'zdjecie', nazwa: 'Zdjęcie satelitarne', zrodlo: 'Sentinel-2, podgląd' },
  { id: 'gleba', nazwa: 'Gleba', zrodlo: 'SoilGrids' },
  { id: 'woda', nazwa: 'Wody i rowy w pobliżu', zrodlo: 'mapa cieków' },
]

const PASEK = {
  szary: 'bg-zinc-400',
  zielony: 'bg-emerald-600',
  zolty: 'bg-amber-400',
  pomaranczowy: 'bg-orange-500',
  czerwony: 'bg-red-600',
} as const

function dataPelna(iso: string) {
  return `${longDate(iso)} ${iso.slice(0, 4)}`
}

function ton(nasilenie: string) {
  if (nasilenie === 'Wysokie') return 'text-red-700 dark:text-red-300'
  if (nasilenie === 'Umiarkowane') return 'text-amber-700 dark:text-amber-300'
  return 'text-zinc-500'
}

function wykresNarastajacy(raport: Raport): EChartsOption | null {
  const s = raport.serie.narastajaco
  if (s.length < 2) return null
  const poczatek = s.findIndex((p) => p.etykieta >= raport.okno.start)
  const last = [...s].reverse().findIndex((p) => p.etykieta <= raport.okno.koniec)
  const koniec = last < 0 ? -1 : s.length - 1 - last
  const okno =
    poczatek >= 0 && koniec >= poczatek
      ? {
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(217,119,6,0.12)' },
            data: [[{ xAxis: s[poczatek].etykieta }, { xAxis: s[koniec].etykieta }]],
          },
        }
      : {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Ten rok', 'Mediana 10 lat', 'Rozstęp'] },
    grid: { left: 48, right: 12, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: s.map((p) => p.etykieta), axisLabel: { interval: Math.ceil(s.length / 6) } },
    yAxis: { type: 'value', name: 'mm' },
    series: [
      {
        name: 'dół',
        type: 'line',
        data: s.map((p) => p.min),
        stack: 'zakres',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        tooltip: { show: false },
      },
      {
        name: 'Rozstęp',
        type: 'line',
        data: s.map((p) => (p.min == null || p.max == null ? null : p.max - p.min)),
        stack: 'zakres',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(161,161,170,0.45)' },
      },
      { name: 'Mediana 10 lat', type: 'line', data: s.map((p) => p.mediana), symbol: 'none', lineStyle: { color: '#57534e' } },
      {
        name: 'Ten rok',
        type: 'line',
        data: s.map((p) => p.ten_rok),
        symbol: 'none',
        lineStyle: { width: 2, color: '#b45309' },
        ...okno,
      },
    ],
  } as EChartsOption
}

function wykresLat(raport: Raport): EChartsOption | null {
  const s = raport.serie.okno
  if (s.length < 2) return null
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 12, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: s.map((p) => String(p.rok)) },
    yAxis: { type: 'value', name: 'mm' },
    series: [
      {
        type: 'bar',
        data: s.map((p) => ({ value: p.kbw_mm, itemStyle: { color: p.suchy ? '#dc2626' : '#0284c7' } })),
        markLine: {
          symbol: 'none',
          data: [{ yAxis: raport.prog_okna_mm, label: { formatter: 'próg suchego roku' } }],
          lineStyle: { color: '#b45309' },
        },
      },
    ],
  }
}

function KartaZabiegu({ karta }: { karta: Raport['retencja'][number] }) {
  return (
    <article id={`k-${karta.id}`} className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
      <h3 className="font-semibold text-zinc-950 dark:text-white">{karta.tytul}</h3>
      <p className="mt-2 text-base/7 text-zinc-800 dark:text-zinc-200">{karta.tekst}</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Warunek na tej działce: {karta.warunek}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-semibold">Dlaczego to proponujemy</summary>
        <p className="mt-2 text-sm/6 text-zinc-700 dark:text-zinc-300">{karta.uzasadnienie}</p>
        <p className="mt-1 text-xs text-zinc-500">Źródło: {karta.zrodlo}</p>
      </details>
    </article>
  )
}

export function RaportEkran({ id, uprawa, data }: { id: string; uprawa: string; data: string }) {
  const [raport, setRaport] = useState<Raport | null>(null)
  const [blad, setBlad] = useState('')
  const [licze, setLicze] = useState(true)
  const [szczegoly, setSzczegoly] = useState(false)
  const [skopiowano, setSkopiowano] = useState(false)

  useEffect(() => {
    if (!id || !uprawa || !data) {
      setLicze(false)
      setBlad('W adresie brakuje działki, uprawy albo daty.')
      return
    }
    let zyje = true
    setLicze(true)
    setBlad('')
    setRaport(null)
    const q = new URLSearchParams({ id, uprawa, data })
    fetch(`/api/analyze?${q}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.blad || 'Nie udało się policzyć')
        if (zyje) setRaport(json)
      })
      .catch((e) => {
        if (zyje) setBlad(e instanceof Error ? e.message : 'Nie udało się policzyć')
      })
      .finally(() => {
        if (zyje) setLicze(false)
      })
    return () => {
      zyje = false
    }
  }, [id, uprawa, data])

  const narastajacy = useMemo(() => (raport ? wykresNarastajacy(raport) : null), [raport])
  const lata = useMemo(() => (raport ? wykresLat(raport) : null), [raport])
  const kroki = raport?.kroki ?? KROKI.map((k) => ({ ...k, stan: 'trwa' as const, opis: 'Pobieram równolegle z pozostałymi.' }))

  async function kopiuj() {
    await navigator.clipboard.writeText(window.location.href)
    setSkopiowano(true)
  }

  if (!licze && blad) {
    return (
      <div>
        <p className="text-base text-red-700">{blad}</p>
        <a href="/" className="mt-4 inline-block font-semibold text-emerald-800 underline">
          Wróć do startu
        </a>
      </div>
    )
  }

  return (
    <div>
      <style>{`@media print { .zwiniete { height: auto !important; overflow: visible !important; } details > *:not(summary) { display: block !important; } }`}</style>
      {licze && !raport && (
        <div>
          <h1 className="text-2xl font-semibold">Liczę wodę na tej działce</h1>
          <p className="mt-2 text-base/7 text-zinc-600 dark:text-zinc-300">
            Źródła idą równolegle. To może potrwać do pół minuty. Odhaczenie pojawia się, gdy źródło naprawdę wróci.
          </p>
          <ul className="mt-4 space-y-2">
            {kroki.map((k) => (
              <li key={k.id} className="flex gap-3 text-base">
                <span className="w-6 font-semibold">{k.stan === 'ok' ? '✓' : k.stan === 'brak' ? '–' : '…'}</span>
                <span className={k.stan === 'brak' ? 'text-zinc-400' : ''}>
                  {k.nazwa} <span className="text-sm text-zinc-500">({k.zrodlo})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {raport && (
        <div className="flex flex-col gap-6">
          <header>
            <p className="text-sm text-zinc-500">
              {raport.dzialka.etykieta} · {raport.nazwa_uprawy} · analiza {dataPelna(raport.data)} · wygenerowano{' '}
              {raport.wygenerowano}
            </p>
            {(raport.alerty.length > 0 || raport.szacunek_uzytku) && (
              <div className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm/6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                {raport.szacunek_uzytku && <p>{raport.szacunek_uzytku}</p>}
                {raport.alerty.map((a) => (
                  <p key={a.id} className="mt-2">
                    <span className="font-semibold">{a.tytul}. </span>
                    {a.tekst}
                  </p>
                ))}
              </div>
            )}
            <p className="mt-4 text-sm font-semibold tracking-wide text-zinc-500 uppercase">Status wody</p>
            <div className={`mt-2 h-3 rounded-full ${PASEK[raport.stan.kolor]}`} />
            <p className="mt-2 text-xl font-semibold">{raport.stan.szczebel}</p>
            <p className="mt-3 text-lg/8 text-zinc-950 dark:text-white">{raport.stan.zdanie}</p>
            <p className="mt-3 text-base/7 text-zinc-700 dark:text-zinc-200">
              {raport.na_tle ?? 'Brak porównania z poprzednimi latami dla tego okresu.'}
            </p>
            <ul className="mt-4 space-y-1 text-sm">
              {raport.kroki.map((k) => (
                <li key={k.id} className={k.stan === 'brak' ? 'text-zinc-400' : ''}>
                  {k.stan === 'ok' ? '✓' : k.stan === 'szacunek' ? '~' : '–'} {k.nazwa}: {k.opis}
                </li>
              ))}
            </ul>
            {!raport.blokada && raport.co_teraz.length > 0 && (
              <div className="mt-4">
                <h2 className="text-base font-semibold">Co możesz zrobić teraz</h2>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  {raport.co_teraz.map((p) => (
                    <li key={p.id}>
                      <a className="font-medium text-emerald-800 underline dark:text-emerald-300" href={`#${p.cel}`}>
                        {p.krotko}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </header>

          {raport.blokada ? (
            <p className="text-base/7">Reszta raportu jest wstrzymana, bo działka nie jest gruntem ornym.</p>
          ) : (
            <>
              <section>
                <h2 className="text-lg font-semibold">Dlaczego?</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {raport.przyczyny.map((p) => (
                    <article
                      key={p.domena}
                      className={`rounded-xl p-4 ring-1 ring-zinc-950/10 dark:ring-white/10 ${p.aktywna ? 'bg-white dark:bg-white/5' : 'bg-zinc-100 text-zinc-500 dark:bg-white/5'}`}
                    >
                      <p className={`text-sm font-semibold ${ton(p.nasilenie)}`}>{p.nasilenie}</p>
                      <h3 className="mt-1 font-semibold text-zinc-950 dark:text-white">{p.domena}</h3>
                      <p className="mt-2 text-sm/6">{p.dowod}</p>
                      <p className="mt-2 text-xs text-zinc-500">Źródło: {p.zrodlo}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">Co możesz dodać na działce</h2>
                {raport.retencja.length === 0 ? (
                  <p className="text-base/7 text-zinc-600">Nie mam liczby, która uzasadniałaby zatrzymanie wody w krajobrazie.</p>
                ) : (
                  raport.retencja.map((k) => <KartaZabiegu key={k.id} karta={k} />)
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">Zabiegi na glebie</h2>
                {raport.agrotechnika.length === 0 ? (
                  <p className="text-base/7 text-zinc-600">Nie mam liczby, która uzasadniałaby zabieg na glebie.</p>
                ) : (
                  raport.agrotechnika.map((k) => <KartaZabiegu key={k.id} karta={k} />)
                )}
              </section>

              <section id="nawadnianie" className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
                <h2 className="text-lg font-semibold">Czy podlewać?</h2>
                <p className="mt-2 text-base/7 font-medium">
                  {raport.nawadnianie.uzasadnione
                    ? `TAK. Dawka około ${Math.round(raport.nawadnianie.dawka_mm)} mm.`
                    : 'NIE TERAZ.'}{' '}
                  {raport.nawadnianie.zdanie}
                </p>
                {raport.nawadnianie.taw_mm > 0 ? (
                  <div className="mt-4">
                    <p className="text-sm text-zinc-600">
                      Zapas w strefie korzeni. Pasek to pełna woda dostępna ({Math.round(raport.nawadnianie.taw_mm)} mm).
                      Kreska to woda łatwo dostępna ({Math.round(raport.nawadnianie.raw_mm)} mm).
                    </p>
                    <div className="relative mt-2 h-4 rounded bg-zinc-200">
                      <div
                        className="h-full rounded bg-sky-600"
                        style={{
                          width: `${Math.max(0, Math.min(100, (1 - raport.nawadnianie.deficyt_mm / raport.nawadnianie.taw_mm) * 100))}%`,
                        }}
                      />
                      <div
                        className="absolute top-0 h-full w-0.5 bg-amber-600"
                        style={{
                          left: `${Math.max(0, Math.min(100, (raport.nawadnianie.raw_mm / raport.nawadnianie.taw_mm) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-sm">Brakuje około {Math.round(raport.nawadnianie.deficyt_mm)} mm do pełnego zapasu.</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-600">Brak pojemności gleby. Nie rysuję zapasu wody.</p>
                )}
                <p className="mt-3 text-sm/6 text-zinc-700 dark:text-zinc-300">{raport.nawadnianie.pozwolenie}</p>
                <p className="mt-1 text-xs text-zinc-500">Źródło: {raport.nawadnianie.zrodlo}</p>
              </section>
            </>
          )}

          <section>
            <button type="button" className="text-lg font-semibold underline print:hidden" onClick={() => setSzczegoly((v) => !v)}>
              {szczegoly ? 'Zwiń szczegóły danych' : 'Szczegóły danych'}
            </button>
            <div
              aria-hidden={szczegoly ? undefined : true}
              className={szczegoly ? 'mt-4 space-y-4' : 'zwiniete mt-4 h-0 space-y-4 overflow-hidden print:h-auto print:overflow-visible'}
            >
              <div>
                <h3 className="font-semibold">Mapa działki</h3>
                <div className="mt-2">
                  <MapaPolski ring={raport.dzialka.ring} />
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Warstwy zieleni z pikseli działki nie ma. Zdjęcie, jeśli jest, to podgląd okolicy.
                </p>
                {raport.zdjecie ? (
                  <>
                    <p className="mt-2 text-sm">Scena z {dataPelna(raport.zdjecie.data)}.</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={raport.zdjecie.url} alt="Podgląd zdjęcia satelitarnego wokół działki" className="mt-2 max-h-64 w-full rounded-lg object-cover" />
                  </>
                ) : (
                  <p className="mt-2 text-sm">Brak zdjęcia dla tej daty.</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold">Sezon na tle poprzednich lat</h3>
                <p className="mt-1 text-sm text-zinc-600">Skumulowany bilans deszczu i parowania od 21 marca. Pas to okno krytyczne uprawy.</p>
                {narastajacy ? <EChart option={narastajacy} className="mt-2 h-64" /> : <p className="mt-2 text-sm">Brak serii od 21 marca.</p>}
              </div>
              <div>
                <h3 className="font-semibold">Okno krytyczne w kolejnych latach</h3>
                <p className="mt-1 text-sm text-zinc-600">Czerwony słupek to rok suchszy niż próg tej uprawy.</p>
                {lata ? <EChart option={lata} className="mt-2 h-64" /> : <p className="mt-2 text-sm">Brak lat do porównania.</p>}
              </div>
              <div>
                <h3 className="font-semibold">Zieleń</h3>
                <p className="mt-2 text-sm">
                  Brak serii zieleni i wilgotności roślin. Nie liczę ich z pikseli działki, więc nie rysuję trzeciego wykresu.
                </p>
              </div>
              <div className="overflow-x-auto">
                <h3 className="font-semibold">Wskaźniki</h3>
                <table className="mt-2 w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500">
                      <th className="py-2 pr-3 font-medium">Wskaźnik</th>
                      <th className="py-2 pr-3 font-medium">Wartość</th>
                      <th className="py-2 pr-3 font-medium">Klasa</th>
                      <th className="py-2 pr-3 font-medium">Źródło</th>
                      <th className="py-2 font-medium">Data danych</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raport.wskazniki.map((w) => (
                      <tr key={w.nazwa} className="border-b border-zinc-100">
                        <td className="py-2 pr-3">{w.nazwa}</td>
                        <td className="py-2 pr-3">{w.wartosc}</td>
                        <td className="py-2 pr-3">{w.klasa}</td>
                        <td className="py-2 pr-3">{w.zrodlo}</td>
                        <td className="py-2">{w.data}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Ograniczenia tego raportu</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm/6 text-zinc-700 dark:text-zinc-300">
              {raport.ograniczenia.map((linia) => (
                <li key={linia}>{linia}</li>
              ))}
            </ul>
          </section>

          <section className="overflow-x-auto">
            <h2 className="text-lg font-semibold">Źródła danych</h2>
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Źródło</th>
                  <th className="py-2 pr-3 font-medium">Co wzięliśmy</th>
                  <th className="py-2 pr-3 font-medium">Kiedy</th>
                  <th className="py-2 font-medium">Licencja</th>
                </tr>
              </thead>
              <tbody>
                {raport.zrodla.map((z) => (
                  <tr key={z.nazwa} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{z.nazwa}</td>
                    <td className="py-2 pr-3">{z.co}</td>
                    <td className="py-2 pr-3">{z.kiedy}</td>
                    <td className="py-2">{z.licencja}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" className="min-h-12 rounded-lg bg-zinc-900 px-4 font-semibold text-white dark:bg-white dark:text-zinc-900" onClick={() => window.print()}>
              Pobierz PDF
            </button>
            <button type="button" className="min-h-12 rounded-lg border border-zinc-300 px-4 font-semibold" onClick={() => window.print()}>
              Drukuj
            </button>
            <button type="button" className="min-h-12 rounded-lg border border-zinc-300 px-4 font-semibold" onClick={kopiuj}>
              {skopiowano ? 'Link skopiowany' : 'Kopiuj link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
