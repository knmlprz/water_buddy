const LATENT_MJ_NA_MM = 2.45

function zCzasem(ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, koniec() { clearTimeout(timer) } }
}

async function pobierzTekst(url, ms, init) {
  const t = zCzasem(ms)
  try {
    const res = await fetch(url, { ...init, signal: t.signal, cache: 'no-store' })
    if (!res.ok) return null
    return res
  } catch {
    return null
  } finally {
    t.koniec()
  }
}

function dniZOpenMeteo(json) {
  const time = json?.daily?.time
  const opad = json?.daily?.precipitation_sum
  const et = json?.daily?.et0_fao_evapotranspiration
  if (!time?.length || !opad || !et) return null
  const dni = []
  for (let i = 0; i < time.length; i++) {
    if (opad[i] == null || et[i] == null) continue
    dni.push({ data: time[i], opad: opad[i], et: et[i] })
  }
  return dni.length ? dni : null
}

function dniZNasa(json) {
  const opad = json?.properties?.parameter?.PRECTOTCORR
  const energia = json?.properties?.parameter?.EVPTRNS
  if (!opad || !energia) return null
  const dni = []
  for (const klucz of Object.keys(opad)) {
    const p = opad[klucz]
    const e = energia[klucz]
    if (p == null || e == null || p < -100 || e < -100) continue
    dni.push({
      data: `${klucz.slice(0, 4)}-${klucz.slice(4, 6)}-${klucz.slice(6, 8)}`,
      opad: p,
      // shortcut: Open-Meteo bywa odcięte limitem dobowym; energia NASA / 2,45 daje milimetry. Wrócić do ET0, gdy limit puści.
      et: e / LATENT_MJ_NA_MM,
    })
  }
  dni.sort((a, b) => a.data.localeCompare(b.data))
  return dni.length ? dni : null
}

export async function pobierzPogode(lat, lon, od, doo) {
  const omUrl = new URL('https://archive-api.open-meteo.com/v1/archive')
  omUrl.searchParams.set('latitude', String(lat))
  omUrl.searchParams.set('longitude', String(lon))
  omUrl.searchParams.set('start_date', od)
  omUrl.searchParams.set('end_date', doo)
  omUrl.searchParams.set('daily', 'precipitation_sum,et0_fao_evapotranspiration')
  omUrl.searchParams.set('timezone', 'Europe/Warsaw')
  const omObietnica = pobierzTekst(omUrl, 4000, {
    headers: { 'User-Agent': 'water-buddy/1.0', Accept: 'application/json' },
  }).then(async (res) => (res ? dniZOpenMeteo(await res.json()) : null))

  const nasaUrl = new URL('https://power.larc.nasa.gov/api/temporal/daily/point')
  nasaUrl.searchParams.set('parameters', 'PRECTOTCORR,EVPTRNS')
  nasaUrl.searchParams.set('community', 'AG')
  nasaUrl.searchParams.set('longitude', String(lon))
  nasaUrl.searchParams.set('latitude', String(lat))
  nasaUrl.searchParams.set('start', od.replaceAll('-', ''))
  nasaUrl.searchParams.set('end', doo.replaceAll('-', ''))
  nasaUrl.searchParams.set('format', 'JSON')
  const nasaObietnica = pobierzTekst(nasaUrl, 15000, {
    headers: { 'User-Agent': 'water-buddy/1.0', Accept: 'application/json' },
  }).then(async (res) => (res ? dniZNasa(await res.json()) : null))

  const om = await omObietnica
  if (om) {
    return {
      zrodlo: 'Open-Meteo',
      opis: 'opad i parowanie odniesienia, środek działki',
      dni: om,
      szacunek: false,
    }
  }
  const nasa = await nasaObietnica
  if (!nasa) throw new Error('Pogoda nie odpowiedziała. Nie liczę niedoboru bez deszczu i parowania.')
  return {
    zrodlo: 'NASA POWER',
    opis: 'opad oraz parowanie oszacowane z energii (megadżule dzielone przez 2,45), środek działki. Open-Meteo nie odpowiedział.',
    dni: nasa,
    szacunek: true,
  }
}

function frakcja(mean) {
  if (mean == null) return null
  return (mean / 10) * 0.01
}

export async function pobierzGlebe(lat, lon) {
  const url = new URL('https://rest.isric.org/soilgrids/v2.0/properties/query')
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('lat', String(lat))
  url.searchParams.append('property', 'wv0033')
  url.searchParams.append('property', 'wv1500')
  for (const depth of ['0-5cm', '5-15cm', '15-30cm']) url.searchParams.append('depth', depth)
  url.searchParams.set('value', 'mean')
  const res = await pobierzTekst(url, 8000, { headers: { Accept: 'application/json' } })
  if (!res) return { mm: null, brak: 'Gleba nie odpowiedziała w kilka sekund. W bilansie nie ma zapasu gleby.' }
  const json = await res.json()
  const layers = json?.properties?.layers ?? []
  const fc = layers.find((l) => l.name === 'wv0033')
  const wp = layers.find((l) => l.name === 'wv1500')
  if (!fc || !wp) return { mm: null, brak: 'Gleba nie podała pojemności wodnej. W bilansie nie ma zapasu gleby.' }
  let mm = 0
  let warstwy = 0
  for (const depth of fc.depths ?? []) {
    const sucha = wp.depths?.find((d) => d.label === depth.label)
    const a = frakcja(depth.values?.mean)
    const b = frakcja(sucha?.values?.mean)
    if (a == null || b == null) continue
    const grubosc = (depth.range.bottom_depth - depth.range.top_depth) * 10
    mm += Math.max(0, a - b) * grubosc
    warstwy += 1
  }
  if (!warstwy) return { mm: null, brak: 'Dla środka tej działki mapa gleb nie ma liczby. W bilansie nie ma zapasu gleby.' }
  return { mm, brak: null }
}

export async function pobierzSpadek(lat, lon) {
  const punkty = [
    [lat, lon],
    [lat + 150 / 111320, lon],
    [lat - 150 / 111320, lon],
    [lat, lon + 150 / (111320 * Math.cos((lat * Math.PI) / 180))],
    [lat, lon - 150 / (111320 * Math.cos((lat * Math.PI) / 180))],
  ]
  const url = new URL('https://api.open-meteo.com/v1/elevation')
  url.searchParams.set('latitude', punkty.map((p) => p[0]).join(','))
  url.searchParams.set('longitude', punkty.map((p) => p[1]).join(','))
  const res = await pobierzTekst(url, 6000, { headers: { Accept: 'application/json' } })
  if (!res) return { procent: null, brak: 'Wysokość terenu nie odpowiedziała. W raporcie nie ma spadku.' }
  const json = await res.json()
  const h = json?.elevation
  if (!h || h.length < 5 || h.some((n) => n == null)) {
    return { procent: null, brak: 'Wysokość terenu nie podała pięciu punktów. W raporcie nie ma spadku.' }
  }
  let max = 0
  for (let i = 1; i < 5; i++) max = Math.max(max, Math.abs(h[i] - h[0]) / 150)
  return { procent: max * 100, brak: null }
}

function dzienPrzed(data, dni) {
  const [y, m, d] = data.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() - dni)
  return t.toISOString().slice(0, 10)
}

export async function pobierzZdjecie(lat, lon, data) {
  const res = await pobierzTekst('https://earth-search.aws.element84.com/v1/search', 4000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      intersects: { type: 'Point', coordinates: [lon, lat] },
      datetime: `${dzienPrzed(data, 45)}T00:00:00Z/${data}T23:59:59Z`,
      limit: 1,
      query: { 'eo:cloud_cover': { lt: 40 } },
      sortby: [{ field: 'properties.datetime', direction: 'desc' }],
    }),
  })
  if (!res) return { zdjecie: null, brak: 'Zdjęcie satelitarne nie wróciło w kilka sekund. W raporcie go nie ma.' }
  const json = await res.json()
  const feat = json?.features?.[0]
  const url = feat?.assets?.thumbnail?.href
  if (!url) return { zdjecie: null, brak: 'W oknie 45 dni przed analizą nie ma dostatecznie czystego zdjęcia.' }
  return {
    zdjecie: { url, data: String(feat.properties?.datetime ?? '').slice(0, 10) },
    brak: null,
  }
}

function metry(aLat, aLon, bLat, bLon) {
  const R = 6371000
  const p = Math.PI / 180
  const dLat = (bLat - aLat) * p
  const dLon = (bLon - aLon) * p
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export async function pobierzCiek(lat, lon) {
  const zapytanie = `[out:json][timeout:4];way(around:3000,${lat},${lon})["waterway"];out center 5;`
  for (const host of ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter']) {
    const res = await pobierzTekst(host, 4000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'water-buddy/1.0' },
      body: `data=${encodeURIComponent(zapytanie)}`,
    })
    if (!res) continue
    const json = await res.json().catch(() => null)
    const elementy = json?.elements ?? []
    let naj = null
    for (const el of elementy) {
      const c = el.center
      if (!c) continue
      const d = metry(lat, lon, c.lat, c.lon)
      if (naj == null || d < naj) naj = d
    }
    if (naj == null) return { metry: null, brak: 'W promieniu 3 km usługa wodna nie wskazała cieku.' }
    return { metry: naj, brak: null }
  }
  return { metry: null, brak: 'Usługa wodna nie zdążyła. W tym raporcie nie ma rowów ani cieków.' }
}

export function sprawdzDate(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Podaj dzień analizy w formacie rok-miesiąc-dzień')
  const dzien = new Date(`${data}T00:00:00Z`)
  if (Number.isNaN(dzien.getTime())) throw new Error('Ten dzień analizy jest niepoprawny')
  const dzis = new Date()
  const koniec = new Date(Date.UTC(dzis.getUTCFullYear(), dzis.getUTCMonth(), dzis.getUTCDate()))
  const start = new Date(koniec)
  start.setUTCFullYear(start.getUTCFullYear() - 10)
  if (dzien > koniec || dzien < start) throw new Error('Dzień analizy ma być z ostatnich 10 lat, nie z przyszłości')
  return data
}
