'use client'

import { MapaPolski } from '@/components/mapa-polski'
import { CROPS_DATA } from '@/data/crops'
import { longDate } from '@/lib/dates'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Dzialka = { id: string; lon: number; lat: number; ring: [number, number][]; etykieta?: string }

function znaczek(nazwa: string) {
  return (nazwa.trim().split(/\s+/)[0] ?? '').slice(0, 2)
}

function iso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function StartScreen() {
  const router = useRouter()
  const dzisiaj = iso(new Date())
  const dawno = iso(new Date(new Date().getFullYear() - 10, new Date().getMonth(), new Date().getDate()))
  const [zakladka, setZakladka] = useState<'numer' | 'mapa'>('numer')
  const [id, setId] = useState('')
  const [uprawa, setUprawa] = useState('')
  const [data, setData] = useState(dzisiaj)
  const [zmienDate, setZmienDate] = useState(false)
  const [dzialka, setDzialka] = useState<Dzialka | null>(null)
  const [blad, setBlad] = useState('')
  const [szukam, setSzukam] = useState(false)

  async function szukaj(params: URLSearchParams) {
    setSzukam(true)
    setBlad('')
    try {
      const res = await fetch(`/api/dzialka?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.blad || 'Nie znaleziono działki')
      setDzialka(json)
      setId(json.id)
    } catch (e) {
      setDzialka(null)
      setBlad(e instanceof Error ? e.message : 'Nie znaleziono działki')
    } finally {
      setSzukam(false)
    }
  }

  function sprawdz() {
    if (!dzialka || !uprawa) return
    const q = new URLSearchParams({ id: dzialka.id, uprawa, data })
    router.push(`/raport?${q}`)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Czy na tej działce brakuje wody?</h1>
        <p className="mt-2 text-base/7 text-zinc-600 dark:text-zinc-300">
          Wskaż teren i uprawę. Raport powstaje po pobraniu danych, nie z gotowej odpowiedzi.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Twoja działka</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={zakladka === 'numer'}
            className={`min-h-12 rounded-lg text-base font-semibold ${zakladka === 'numer' ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-800 dark:bg-white/10 dark:text-white'}`}
            onClick={() => setZakladka('numer')}
          >
            Mam numer
          </button>
          <button
            type="button"
            aria-pressed={zakladka === 'mapa'}
            className={`min-h-12 rounded-lg text-base font-semibold ${zakladka === 'mapa' ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-800 dark:bg-white/10 dark:text-white'}`}
            onClick={() => setZakladka('mapa')}
          >
            Wskażę na mapie
          </button>
        </div>
        {zakladka === 'numer' && (
          <label className="block text-sm font-medium">
            Identyfikator działki
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base dark:border-white/15 dark:bg-white/5"
              value={id}
              placeholder="040701_1.0081.11/74"
              onChange={(e) => {
                setId(e.target.value)
                setDzialka(null)
              }}
            />
            <span className="mt-1 block text-sm font-normal text-zinc-500">
              Numer z ewidencji, na przykład 040701_1.0081.11/74.
            </span>
          </label>
        )}
        {zakladka === 'numer' && (
          <button
            type="button"
            className="min-h-12 rounded-lg bg-zinc-900 text-base font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            disabled={szukam || !id.trim()}
            onClick={() => szukaj(new URLSearchParams({ id: id.trim() }))}
          >
            {szukam ? 'Szukam działki…' : 'Znajdź działkę'}
          </button>
        )}
        {(zakladka === 'mapa' || dzialka) && (
          <div>
            {zakladka === 'mapa' && (
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
                Puknij w pole. Przeciągnij, żeby przesunąć mapę.
              </p>
            )}
            <MapaPolski
              ring={dzialka?.ring ?? null}
              onPick={
                zakladka === 'mapa'
                  ? (lon, lat) => szukaj(new URLSearchParams({ lon: String(lon), lat: String(lat) }))
                  : undefined
              }
            />
          </div>
        )}
        {szukam && zakladka === 'mapa' && <p className="text-sm">Szukam działki w tym miejscu.</p>}
        {dzialka && !szukam && (
          <p className="rounded-lg bg-emerald-50 px-3 py-3 text-base font-medium text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
            {dzialka.etykieta || `Działka ${dzialka.id}`}. To ta działka, jeśli obrys się zgadza.
          </p>
        )}
        {blad && <p className="text-sm text-red-700">{blad}</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Uprawa</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CROPS_DATA.map((u) => {
            const wybrana = uprawa === u.id
            return (
              <button
                key={u.id}
                type="button"
                aria-pressed={wybrana}
                className={`flex min-h-24 flex-col items-start justify-between rounded-xl border px-3 py-3 text-left ${wybrana ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40' : 'border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5'}`}
                onClick={() => setUprawa(u.id)}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white">
                  {znaczek(u.nazwa_pl)}
                </span>
                <span className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">{u.nazwa_pl}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Dzień, na który liczymy</h2>
        <p className="mt-2 text-sm/6 text-zinc-600 dark:text-zinc-300">
          Domyślnie liczymy na dziś. Wcześniejszy dzień pozwala sprawdzić, czy raport oddaje stan z tamtej chwili.
        </p>
        <p className="mt-2 text-base">
          {longDate(data)} {data.slice(0, 4)}
        </p>
        <button
          type="button"
          className="mt-2 text-base font-semibold text-emerald-800 underline dark:text-emerald-300"
          onClick={() => setZmienDate((v) => !v)}
        >
          {zmienDate ? 'Zostaw ten dzień' : 'Podaj wcześniejszy dzień'}
        </button>
        {zmienDate && (
          <input
            className="mt-2 block rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base dark:border-white/15 dark:bg-white/5"
            type="date"
            min={dawno}
            max={dzisiaj}
            value={data}
            onChange={(e) => setData(e.target.value || dzisiaj)}
          />
        )}
      </section>

      <button
        type="button"
        className="min-h-14 rounded-xl bg-emerald-700 text-lg font-semibold text-white disabled:opacity-50"
        disabled={!dzialka || !uprawa || szukam}
        onClick={sprawdz}
      >
        Generuj raport
      </button>
    </div>
  )
}
