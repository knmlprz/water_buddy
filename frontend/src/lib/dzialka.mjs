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

/** Środek ciężkości obrysu. Średnia wierzchołków ściąga punkt w gęsty narożnik. */
export function srodek(ring) {
  const zamkniety =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  const n = zamkniety ? ring.length - 1 : ring.length
  let pole = 0
  let lon = 0
  let lat = 0
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[(i + 1) % n]
    const krzyz = x0 * y1 - x1 * y0
    pole += krzyz
    lon += (x0 + x1) * krzyz
    lat += (y0 + y1) * krzyz
  }
  if (Math.abs(pole) < 1e-12) {
    let sx = 0
    let sy = 0
    for (let i = 0; i < n; i++) {
      sx += ring[i][0]
      sy += ring[i][1]
    }
    return { lon: sx / n, lat: sy / n }
  }
  return { lon: lon / (3 * pole), lat: lat / (3 * pole) }
}

function linia(text, poNumerze) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const status = Number(lines[0])
  if (status !== 0 || !lines[1]) {
    throw new Error(
      poNumerze
        ? 'Nie znaleziono działki o tym numerze. Sprawdź numer albo wskaż ją na mapie.'
        : 'W tym miejscu nie ma działki. Wskaż pole w Polsce.',
    )
  }
  return lines[1]
}

export function opisDzialki(row) {
  const parts = String(row).split('|')
  const wktIdx = parts.findIndex((p) => /POLYGON|MULTIPOLYGON/i.test(p))
  if (wktIdx < 1) return null
  const id = parts[0]
  const parcel = wktIdx > 1 ? parts[1] : ''
  const region = wktIdx > 2 ? parts[2] : ''
  const commune = wktIdx > 3 ? parts[3] : ''
  const etykieta =
    parcel && region && commune ? `Działka ${parcel}, obręb ${region}, gm. ${commune}` : `Działka ${id}`
  return { id, wkt: parts.slice(wktIdx).join('|'), etykieta }
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
  url.searchParams.set('result', 'id,parcel,region,commune,geom_wkt')
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
  if (!res.ok) throw new Error('Serwer GUGiK nie odpowiada, spróbuj ponownie.')
  const row = linia(await res.text(), Boolean(id))
  const opis = opisDzialki(row)
  if (!opis) throw new Error('Usługa działek nie podała obrysu')
  const rings = parseWkt(opis.wkt)
  if (!rings.length) throw new Error('Obrys działki jest pusty')
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a))
  const c = srodek(ring)
  return { id: opis.id, lon: c.lon, lat: c.lat, ring: rzadziej(ring), etykieta: opis.etykieta }
}
