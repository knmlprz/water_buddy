// Makieta obrazu satelitarnego w prawdziwej rozdzielczości HLS: 1 piksel = 30 m.
// Docelowo zastąpić PNG-ami NDVI wyciętymi z HLS dla każdego tygodnia (thumbs w season.json).

export const W = 64 // 64 px × 30 m = 1,92 km
export const H = 44 // 44 px × 30 m = 1,32 km

export type Pt = [number, number]

export const POLYS: Record<string, Pt[]> = {
  A: [[6, 5], [30, 3], [31, 27], [7, 28]],
  B: [[34, 3], [58, 5], [57, 26], [33, 27]],
  C: [[8, 32], [56, 30], [57, 42], [9, 42]],
}
export const DITCH: Pt[] = [[4, 0], [4.5, 14], [5, 29], [5.5, 44]]
export const ROAD_Y = 29.5

function inside(x: number, y: number, poly: Pt[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// deterministyczny szum wartości
const GRID = 9
const rnd = (() => {
  let s = 7
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
})()
const NOISE: number[][] = Array.from({ length: GRID + 1 }, () => Array.from({ length: GRID + 1 }, () => rnd() * 2 - 1))
const FINE: number[] = Array.from({ length: W * H }, () => rnd() * 2 - 1)
function noise(x: number, y: number) {
  const gx = (x / W) * (GRID - 1), gy = (y / H) * (GRID - 1)
  const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0
  const a = NOISE[y0][x0], b = NOISE[y0][x0 + 1], c = NOISE[y0 + 1][x0], d = NOISE[y0 + 1][x0 + 1]
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
}

// skala NDVI: goła gleba → zieleń
const STOPS: [number, [number, number, number]][] = [
  [0.1, [122, 82, 45]],
  [0.2, [164, 118, 66]],
  [0.32, [196, 170, 104]],
  [0.45, [150, 175, 88]],
  [0.6, [86, 148, 70]],
  [0.8, [34, 104, 52]],
]
export function ndviColor(v: number): [number, number, number] {
  if (v <= STOPS[0][0]) return STOPS[0][1]
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i]
      const t = (v - a) / (b - a)
      return [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * t)) as [number, number, number]
    }
  }
  return STOPS[STOPS.length - 1][1]
}
export const RAMP_CSS = `linear-gradient(90deg, ${STOPS.map(([v, c]) => `rgb(${c.join(',')}) ${((v - 0.1) / 0.7) * 100}%`).join(', ')})`

export type FieldPaint = { id: string; ndvi: number; stress?: number; dim?: boolean }

/** Rysuje scenę w niskiej rozdzielczości i skaluje ją bez wygładzania. */
export function paintScene(ctx: CanvasRenderingContext2D, fields: FieldPaint[], opts: { dimOthers?: boolean } = {}) {
  const img = ctx.createImageData(W, H)
  const byId = Object.fromEntries(fields.map((f) => [f.id, f]))
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5
      let rgb: [number, number, number]
      const fid = Object.keys(POLYS).find((k) => inside(px, py, POLYS[k]))
      const f = fid ? byId[fid] : undefined
      const n = noise(px, py), fine = FINE[y * W + x]
      if (fid && f) {
        const poly = POLYS[fid]
        const ys = poly.map((p) => p[1])
        const top = Math.min(...ys), bot = Math.max(...ys)
        const up = 1 - (py - top) / (bot - top) // 1 = górna, wyżej położona część pola
        const stress = f.stress ?? 0
        let v = f.ndvi + n * 0.05 + fine * 0.012 - up * stress * 0.35 + (1 - up) * stress * 0.08
        if (f.ndvi > 0.3 && x % 2 === 0) v -= 0.015 // rzędy siewu
        rgb = ndviColor(Math.max(0.1, v))
        if (f.dim) rgb = desat(rgb, 0.65)
      } else if (Math.abs(py - ROAD_Y) < 0.8) {
        rgb = [150, 146, 138]
      } else if (nearDitch(px, py)) {
        rgb = [70, 110, 150]
      } else {
        // łąki i zadrzewienia wokół
        const v = 0.5 + n * 0.12 + fine * 0.03
        rgb = desat(ndviColor(v), opts.dimOthers ? 0.75 : 0.45)
      }
      const i = (y * W + x) * 4
      img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function nearDitch(x: number, y: number) {
  for (let i = 1; i < DITCH.length; i++) {
    const [x0, y0] = DITCH[i - 1], [x1, y1] = DITCH[i]
    if (y >= y0 && y <= y1) {
      const xx = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)
      return Math.abs(x - xx) < 0.7
    }
  }
  return false
}

function desat([r, g, b]: [number, number, number], k: number): [number, number, number] {
  const l = 0.3 * r + 0.59 * g + 0.11 * b
  const grey = 0.5 * l + 0.5 * 205
  return [r + (grey - r) * k, g + (grey - g) * k, b + (grey - b) * k].map(Math.round) as [number, number, number]
}

export function centroid(poly: Pt[]): Pt {
  const x = poly.reduce((s, p) => s + p[0], 0) / poly.length
  const y = poly.reduce((s, p) => s + p[1], 0) / poly.length
  return [x, y]
}
