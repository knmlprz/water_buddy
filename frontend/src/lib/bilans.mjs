/** Współczynnik potrzeby względem parowania, miesiącami od stycznia. Ogólna tabela, nie pomiar na polu. */
export const KC = {
  pszenica_ozima: [0, 0.4, 0.8, 1.1, 1.15, 0.9, 0.45, 0, 0, 0.3, 0.5, 0.3],
  zyto_ozime: [0, 0.4, 0.75, 1.05, 1.15, 0.85, 0.4, 0, 0, 0.3, 0.5, 0.3],
  jeczmien_jary: [0, 0, 0, 0.3, 0.55, 1.15, 0.9, 0.35, 0, 0, 0, 0],
  rzepak_ozimy: [0.5, 0.8, 1.05, 1.2, 1.0, 0.4, 0, 0, 0, 0.4, 0.55, 0.5],
  kukurydza: [0, 0, 0, 0.3, 0.55, 1.05, 1.2, 1.15, 0.7, 0, 0, 0],
  ziemniak: [0, 0, 0.3, 0.55, 1.0, 1.15, 1.1, 0.75, 0.35, 0, 0, 0],
  burak_cukrowy: [0, 0, 0.3, 0.5, 0.85, 1.15, 1.2, 1.1, 0.75, 0.3, 0, 0],
  lucerna: [0.4, 0.45, 0.55, 0.75, 0.95, 1.15, 1.15, 1.1, 1.0, 0.85, 0.6, 0.45],
}

export const MIESIACE = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

const PROG_SUCHO_MM = 20

function czesci(data) {
  const [rok, miesiac, dzien] = data.split('-').map(Number)
  return { rok, miesiac, dzien }
}

function doDnia(dni, rok, miesiac, dzien) {
  const out = []
  for (const d of dni) {
    const c = czesci(d.data)
    if (c.rok !== rok) continue
    if (c.miesiac < miesiac || (c.miesiac === miesiac && c.dzien <= dzien)) out.push(d)
  }
  return out
}

function nrDnia(rok, miesiac, dzien) {
  return Math.round((Date.UTC(rok, miesiac - 1, dzien) - Date.UTC(rok, 0, 1)) / 86400000) + 1
}

/** Niedobór narastająco od 1 stycznia. Gleba null: bez zapasu gleby, tylko deszcz kontra potrzeba. */
export function niedoborDo(dniRoku, kc, glebaMm) {
  const cap = glebaMm == null ? 0 : Math.max(0, glebaMm)
  let zapas = glebaMm == null ? 0 : 0.85 * cap
  let brak = 0
  let potrzeba = 0
  let opad = 0
  const miesiecznie = MIESIACE.map(() => ({ opad: 0, potrzeba: 0 }))
  for (const d of dniRoku) {
    const m = czesci(d.data).miesiac - 1
    const n = Math.max(0, d.et) * kc[m]
    const p = Math.max(0, d.opad)
    potrzeba += n
    opad += p
    miesiecznie[m].opad += p
    miesiecznie[m].potrzeba += n
    const dostepne = zapas + p
    if (n > dostepne) {
      brak += n - dostepne
      zapas = 0
    } else {
      zapas = Math.min(cap, dostepne - n)
    }
  }
  return { brak, potrzeba, opad, miesiecznie, zapas }
}

export function policz({ dni, uprawa, data, glebaMm }) {
  const kc = KC[uprawa]
  if (!kc) throw new Error('Wybierz uprawę z listy')
  const { rok, miesiac, dzien } = czesci(data)
  const lata = []
  const oczekiwane = nrDnia(rok, miesiac, dzien)
  for (let y = rok - 9; y <= rok; y++) {
    const wRoku = doDnia(dni, y, miesiac, dzien)
    if (y === rok) {
      if (!wRoku.length) throw new Error('Brak pogody dla tego dnia. Nie liczę niedoboru z pustych dni.')
      const ostatni = wRoku[wRoku.length - 1].data
      const koniec = czesci(ostatni)
      if (ostatni < data && oczekiwane - nrDnia(koniec.rok, koniec.miesiac, koniec.dzien) > 7) {
        throw new Error(`Pogoda urywa się ${ostatni}. Nie domykam bilansu do ${data}.`)
      }
    } else if (wRoku.length < oczekiwane * 0.5) {
      continue
    }
    lata.push({ rok: y, ...niedoborDo(wRoku, kc, glebaMm) })
  }
  const teraz = lata.find((r) => r.rok === rok)
  if (!teraz) throw new Error('Brak pogody dla tego dnia. Nie liczę niedoboru z pustych dni.')
  const suche = lata.filter((r) => r.brak >= PROG_SUCHO_MM).length
  return {
    niedobor_mm: teraz.brak,
    potrzeba_mm: teraz.potrzeba,
    opad_mm: teraz.opad,
    miesiecznie: teraz.miesiecznie.slice(0, miesiac),
    zapas_mm: teraz.zapas,
    pojemnosc_mm: glebaMm,
    suche,
    lat: lata.length,
    prog_mm: PROG_SUCHO_MM,
  }
}

function dzienIso(rok, mmdd) {
  const iso = `${rok}-${mmdd}`
  const t = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso) return `${rok}-02-28`
  return iso
}

function sumaWOknie(dni, koniec, dlugosc, pole) {
  const start = dzienPrzed(koniec, dlugosc - 1)
  let suma = 0
  let n = 0
  for (const d of dni) {
    if (d.data < start || d.data > koniec) continue
    suma += pole(d)
    n += 1
  }
  if (n < dlugosc * 0.7) return null
  return suma
}

function dzienPrzed(data, dni) {
  const [y, m, d] = data.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() - dni)
  return t.toISOString().slice(0, 10)
}

/** Bilans wodny: deszcz minus parowanie, około 60 dni kończących się w dniu analizy. */
export function bilans60(dni, data) {
  const obciete = dni.filter((d) => d.data <= data)
  const suma = sumaWOknie(obciete, data, 60, (d) => d.opad - d.et)
  return suma == null ? null : Math.round(suma)
}

/** Wskaźnik opadu jako odchylenie sumy deszczu od średniej z lat, które mamy. Nie jest to pełny rozkład gamma. */
export function wskaznikOpadu(dni, data, dlugosc) {
  const rok = Number(data.slice(0, 4))
  const mmdd = data.slice(5)
  const obciete = dni.filter((d) => d.data <= data)
  const probki = []
  for (let y = rok - 9; y <= rok; y++) {
    const koniec = dzienIso(y, mmdd)
    if (koniec > data) continue
    const suma = sumaWOknie(obciete, koniec, dlugosc, (d) => d.opad)
    if (suma == null) continue
    probki.push({ rok: y, suma })
  }
  const teraz = probki.find((p) => p.rok === rok)
  if (!teraz || probki.length < 8) return null
  const srednia = probki.reduce((s, p) => s + p.suma, 0) / probki.length
  const wariancja = probki.reduce((s, p) => s + (p.suma - srednia) ** 2, 0) / probki.length
  const odchylenie = Math.sqrt(wariancja)
  if (odchylenie < 1) return null
  return (teraz.suma - srednia) / odchylenie
}

/** Ile lat z dostępnej serii miało bilans 60 dni poniżej −50 mm. */
export function lataSuche(dni, data) {
  const rok = Number(data.slice(0, 4))
  const mmdd = data.slice(5)
  const obciete = dni.filter((d) => d.data <= data)
  let lata = 0
  let suche = 0
  for (let y = rok - 9; y <= rok; y++) {
    const koniec = dzienIso(y, mmdd)
    if (koniec > data) continue
    const suma = sumaWOknie(obciete, koniec, 60, (d) => d.opad - d.et)
    if (suma == null) continue
    lata += 1
    if (suma < -50) suche += 1
  }
  if (lata < 6) return null
  return { suche, lata }
}

function mediana(wartosci) {
  if (!wartosci.length) return null
  const s = [...wartosci].sort((a, b) => a - b)
  const i = Math.floor(s.length / 2)
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2
}

function dniOkna(startMmdd, koniecMmdd) {
  const [ms, ds] = startMmdd.split('-').map(Number)
  const [mk, dk] = koniecMmdd.split('-').map(Number)
  return Math.round((Date.UTC(2024, mk - 1, dk) - Date.UTC(2024, ms - 1, ds)) / 86400000) + 1
}

function sumaKalendarz(dni, rok, startMmdd, koniecMmdd) {
  const start = `${rok}-${startMmdd}`
  const end = `${rok}-${koniecMmdd}`
  if (end < start) return null
  let suma = 0
  let n = 0
  for (const d of dni) {
    if (d.data < start || d.data > end) continue
    suma += d.opad - d.et
    n += 1
  }
  if (n < dniOkna(startMmdd, koniecMmdd) * 0.6) return null
  return suma
}

/** KBW w oknie uprawy, ucięte do tego samego dnia roku. Suche lata: tylko lata poprzednie. */
export function seriaOkna(dni, data, startMmdd, koniecMmdd, progMm) {
  const rok = Number(data.slice(0, 4))
  const mmdd = data.slice(5)
  const poStarcie = mmdd >= startMmdd
  const koniec = poStarcie && mmdd < koniecMmdd ? mmdd : koniecMmdd
  const slupki = []
  for (let y = rok - 10; y < rok; y++) {
    const suma = sumaKalendarz(dni, y, startMmdd, koniec)
    if (suma == null) continue
    slupki.push({ rok: y, kbw_mm: Math.round(suma), suchy: suma < progMm })
  }
  const terazSuma = poStarcie ? sumaKalendarz(dni, rok, startMmdd, koniec) : null
  const teraz = terazSuma == null ? null : Math.round(terazSuma)
  const med = mediana(slupki.map((s) => s.kbw_mm))
  return {
    slupki: teraz == null ? slupki : [...slupki, { rok, kbw_mm: teraz, suchy: teraz < progMm }],
    suche: slupki.filter((s) => s.suchy).length,
    lat: slupki.length,
    mediana: med == null ? null : Math.round(med),
    teraz,
  }
}

function kumulacja(dni, rok, koniecMmdd) {
  const start = `${rok}-03-21`
  const end = `${rok}-${koniecMmdd}`
  let s = 0
  const mapa = new Map()
  for (const d of dni) {
    if (!d.data.startsWith(String(rok))) continue
    if (d.data < start || d.data > end) continue
    s += d.opad - d.et
    mapa.set(d.data.slice(5), s)
  }
  return mapa
}

/** Skumulowany bilans od 21 marca do dnia analizy, na tle poprzednich lat. */
export function seriaNarastajaca(dni, data) {
  const rok = Number(data.slice(0, 4))
  const mmdd = data.slice(5)
  if (mmdd < '03-21') return []
  const teraz = kumulacja(dni, rok, mmdd)
  if (teraz.size < 10) return []
  const historia = []
  for (let y = rok - 10; y < rok; y++) historia.push(kumulacja(dni, y, mmdd))
  const out = []
  for (const [etykieta, v] of teraz) {
    const inne = []
    for (const h of historia) {
      const x = h.get(etykieta)
      if (x != null) inne.push(x)
    }
    const med = mediana(inne)
    out.push({
      etykieta,
      ten_rok: Math.round(v),
      mediana: med == null ? null : Math.round(med),
      min: inne.length ? Math.round(Math.min(...inne)) : null,
      max: inne.length ? Math.round(Math.max(...inne)) : null,
    })
  }
  return out
}
