'use client'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { EChart } from '@/components/e-chart'
import { Heading, Subheading } from '@/components/heading'
import { Input } from '@/components/input'
import { MapaPolski } from '@/components/mapa-polski'
import { Panel } from '@/components/panel'
import { Select } from '@/components/select'
import { Text } from '@/components/text'
import { MIESIACE, UPRAWY } from '@/lib/bilans.mjs'
import type { EChartsOption } from 'echarts'
import { useMemo, useState } from 'react'

type Dzialka = { id: string; lon: number; lat: number; ring: [number, number][] }

type Raport = {
  dzialka: Dzialka
  uprawa: string
  data: string
  niedobor_mm: number
  potrzeba_mm: number
  opad_mm: number
  gleba_mm: number | null
  spadek_procent: number | null
  ciek_m: number | null
  suche: number
  lat: number
  miesiecznie: { opad: number; potrzeba: number }[]
  zdania: { woda: string; przyczyna: string; retencja: string; zabieg: string; nawadnianie: string }
  brak: string[]
  zrodla: { nazwa: string; opis: string; kiedy: string }[]
  niepewnosc: string[]
  ograniczenia: string[]
  zdjecie: { url: string; data: string } | null
  pobrano: string
}

function dzis() {
  const t = new Date()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${t.getFullYear()}-${m}-${d}`
}

function mm(n: number) {
  return Math.round(n)
}

const KOLEJNOSC = [
  ['woda', 'Woda'],
  ['przyczyna', 'Przyczyna'],
  ['retencja', 'Retencja'],
  ['zabieg', 'Zabieg'],
  ['nawadnianie', 'Nawadnianie'],
] as const

export function WodaScreen() {
  const [id, setId] = useState('')
  const [uprawa, setUprawa] = useState('kukurydza')
  const [data, setData] = useState(dzis)
  const [dzialka, setDzialka] = useState<Dzialka | null>(null)
  const [raport, setRaport] = useState<Raport | null>(null)
  const [blad, setBlad] = useState('')
  const [szukam, setSzukam] = useState(false)
  const [licze, setLicze] = useState(false)

  async function pokazDzialke(params: URLSearchParams) {
    setSzukam(true)
    setBlad('')
    try {
      const res = await fetch(`/api/dzialka?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.blad || 'Nie znaleziono działki')
      setDzialka(json)
      setId(json.id)
      setRaport(null)
    } catch (e) {
      setDzialka(null)
      setBlad(e instanceof Error ? e.message : 'Nie znaleziono działki')
    } finally {
      setSzukam(false)
    }
  }

  async function ocen() {
    setLicze(true)
    setBlad('')
    setRaport(null)
    const body: { uprawa: string; data: string; id?: string; lon?: number; lat?: number } = { uprawa, data }
    if (id.trim()) body.id = id.trim()
    else if (dzialka) {
      body.lon = dzialka.lon
      body.lat = dzialka.lat
    } else {
      setLicze(false)
      setBlad('Wpisz numer działki albo puknij w mapę.')
      return
    }
    try {
      const res = await fetch('/api/raport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.blad || 'Nie udało się policzyć')
      setRaport(json)
      setDzialka(json.dzialka)
      setId(json.dzialka.id)
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się policzyć')
    } finally {
      setLicze(false)
    }
  }

  const option = useMemo<EChartsOption | null>(() => {
    if (!raport) return null
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Deszcz', 'Potrzeba uprawy'] },
      grid: { left: 48, right: 12, top: 36, bottom: 28 },
      xAxis: { type: 'category', data: MIESIACE.slice(0, raport.miesiecznie.length) },
      yAxis: { type: 'value', name: 'mm' },
      series: [
        {
          name: 'Deszcz',
          type: 'bar',
          data: raport.miesiecznie.map((m) => Math.round(m.opad)),
          itemStyle: { color: '#0284c7' },
        },
        {
          name: 'Potrzeba uprawy',
          type: 'bar',
          data: raport.miesiecznie.map((m) => Math.round(m.potrzeba)),
          itemStyle: { color: '#d97706' },
        },
      ],
    }
  }, [raport])

  const nazwa = UPRAWY.find((u) => u.id === raport?.uprawa)?.nazwa

  return (
    <div>
      <Heading>Woda na działce</Heading>
      <Text className="mt-2">
        Wpisz numer działki albo puknij w mapę, wybierz uprawę i dzień. Liczba powstaje po pobraniu danych.
      </Text>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-5 print:hidden">
        <Panel className="flex flex-col gap-4 xl:col-span-2">
          <label className="block text-sm font-medium">
            Numer działki
            <Input
              className="mt-1"
              value={id}
              placeholder="np. 146510_8.0502.1/3"
              onChange={(e) => setId(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Uprawa
            <Select className="mt-1" value={uprawa} onChange={(e) => setUprawa(e.target.value)}>
              {UPRAWY.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nazwa}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-medium">
            Dzień analizy
            <Input className="mt-1" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <Button color="emerald" disabled={licze || szukam} onClick={ocen}>
            {licze ? 'Liczę…' : 'Pokaż wodę na działce'}
          </Button>
          {szukam && <Text>Szukam obrysu działki.</Text>}
          {dzialka && !szukam && <Text>Działka {dzialka.id}</Text>}
          {blad && <p className="text-sm text-red-700">{blad}</p>}
        </Panel>
        <Panel className="xl:col-span-3">
          <Subheading>Mapa</Subheading>
          <Text className="mt-1 mb-3">Puknięcie szuka działki w tym miejscu. Przeciągnij, żeby przesunąć.</Text>
          <MapaPolski
            ring={dzialka?.ring ?? null}
            onPick={(lon, lat) => pokazDzialke(new URLSearchParams({ lon: String(lon), lat: String(lat) }))}
          />
        </Panel>
      </div>

      {raport && (
        <div className="mt-8" id="raport">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Heading level={2}>
                {mm(raport.niedobor_mm)} mm niedoboru
              </Heading>
              <Text className="mt-1">
                {nazwa} · działka {raport.dzialka.id} · do {raport.data}
              </Text>
            </div>
            <Button outline className="print:hidden" onClick={() => window.print()}>
              Drukuj
            </Button>
          </div>

          <div className="mt-6 grid gap-4">
            {KOLEJNOSC.map(([klucz, tytul]) => (
              <Panel key={klucz}>
                <Subheading>{tytul}</Subheading>
                <p className="mt-2 text-base/7 text-zinc-800 dark:text-zinc-200">{raport.zdania[klucz]}</p>
              </Panel>
            ))}
          </div>

          {option && (
            <Panel className="mt-4">
              <Subheading>Deszcz i potrzeba do tego dnia</Subheading>
              <EChart option={option} className="mt-2 h-64" />
            </Panel>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel>
              <Subheading>Czego brakuje</Subheading>
              {raport.brak.length === 0 ? (
                <Text className="mt-2">Wszystkie warstwy, o które pytaliśmy, wróciły.</Text>
              ) : (
                <ul className="mt-2 list-disc pl-5 text-sm/6 text-zinc-700 dark:text-zinc-300">
                  {raport.brak.map((linia) => (
                    <li key={linia}>{linia}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {raport.gleba_mm != null && <Badge color="zinc">gleba {mm(raport.gleba_mm)} mm</Badge>}
                {raport.spadek_procent != null && (
                  <Badge color="zinc">spadek {raport.spadek_procent.toFixed(1).replace('.', ',')}%</Badge>
                )}
                {raport.ciek_m != null && <Badge color="zinc">ciek {Math.round(raport.ciek_m)} m</Badge>}
              </div>
            </Panel>
            <Panel>
              {raport.zdjecie ? (
                <>
                  <Subheading>Zdjęcie z {raport.zdjecie.data}</Subheading>
                  <Text className="mt-1">Podgląd sceny satelitarnej wokół działki, nie sam wycinek pola.</Text>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={raport.zdjecie.url}
                    alt="Podgląd zdjęcia satelitarnego wokół działki"
                    className="mt-3 max-h-64 w-full rounded-lg object-cover"
                  />
                </>
              ) : (
                <>
                  <Subheading>Zdjęcie</Subheading>
                  <Text className="mt-2">Brak zdjęcia w tym raporcie.</Text>
                </>
              )}
            </Panel>
          </div>

          <Panel className="mt-4">
            <Subheading>Niepewność i ograniczenia</Subheading>
            <ul className="mt-2 list-disc pl-5 text-sm/6 text-zinc-700 dark:text-zinc-300">
              {raport.niepewnosc.map((linia) => (
                <li key={linia}>{linia}</li>
              ))}
              {raport.ograniczenia.map((linia) => (
                <li key={linia}>{linia}</li>
              ))}
            </ul>
          </Panel>

          <Panel className="mt-4">
            <Subheading>Źródła</Subheading>
            <ul className="mt-2 text-sm/6 text-zinc-700 dark:text-zinc-300">
              {raport.zrodla.map((z) => (
                <li key={z.nazwa}>
                  <span className="font-medium">{z.nazwa}.</span> {z.opis}. Pobrano {z.kiedy.slice(0, 16).replace('T', ' ')}.
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  )
}
