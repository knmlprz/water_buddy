const ULDK = 'https://uldk.gugik.gov.pl/'

/** Pierścienie [długość, szerokość] z odpowiedzi usługi działek. */
export function parseWkt(raw) {
  const body = String(raw).replace(/^SRID=\d+;/i, '')
  const rings = []
  const re = /\(([^()]+)\)/g
  let match
  while ((match = re.exec(body))) {
    const pts = []
    for (const part of match[1].split(',')) {
      const [lon, lat] = part.trim().split(/\s+/).map(Number)
      if (Number.isFinite(lon) && Number.isFinite(lat)) pts.push([lon, lat])
    }
    if (pts.length >= 3) rings.push(pts)
  }
  return rings
}

export function srodek(ring) {
  let lon = 0
  let lat = 0
  for (const [x, y] of ring) {
    lon += x
    lat += y
  }
  return { lon: lon / ring.length, lat: lat / ring.length }
}

function linia(text) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const status = Number(lines[0])
  if (status !== 0) {
    throw new Error('W tym miejscu nie ma polskiej działki. Puknij w ląd w Polsce.')
  }
  return lines[1] || ''
}

/** Mniej punktów tylko do rysunku. Środek liczony jest wcześniej, z pełnego obrysu. */
export function rzadziej(ring, max = 280) {
  if (ring.length <= max) return ring
  const step = Math.ceil(ring.length / max)
  const out = []
  for (let i = 0; i < ring.length; i += step) out.push(ring[i])
  out.push(ring[ring.length - 1])
  return out
}

export async function pobierzDzialke({ id, lon, lat, signal }) {
  const url = new URL(ULDK)
  url.searchParams.set('result', 'id,geom_wkt')
  url.searchParams.set('srid', '4326')
  if (id) {
    url.searchParams.set('request', 'GetParcelById')
    url.searchParams.set('id', String(id).trim())
  } else {
    url.searchParams.set('request', 'GetParcelByXY')
    url.searchParams.set('xy', `${lon},${lat},4326`)
  }
  const res = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: { 'User-Agent': 'water-buddy/1.0', Accept: 'text/plain' },
  })
  if (!res.ok) throw new Error(`Usługa działek zwróciła status ${res.status}`)
  const row = linia(await res.text())
  const pipe = row.indexOf('|')
  if (pipe < 0) throw new Error('Usługa działek nie podała obrysu')
  const rings = parseWkt(row.slice(pipe + 1))
  if (!rings.length) throw new Error('Obrys działki jest pusty')
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a))
  const c = srodek(ring)
  return { id: row.slice(0, pipe), lon: c.lon, lat: c.lat, ring: rzadziej(ring) }
}
