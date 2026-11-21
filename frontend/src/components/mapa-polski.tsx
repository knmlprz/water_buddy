'use client'

import { project, unproject } from '@/lib/mercator.mjs'
import { useEffect, useRef, useState } from 'react'

type Ring = [number, number][]

export function kadr(ring: Ring) {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  const span = Math.max(maxLon - minLon, (maxLat - minLat) * 1.3, 0.002)
  let z = 17
  while (z > 5 && (span / (360 / 2 ** z)) * 256 > 480) z -= 1
  return { lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2, z }
}

export function MapaPolski({
  ring,
  onPick,
}: {
  ring: Ring | null
  onPick: (lon: number, lat: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 420 })
  const [view, setView] = useState({ lon: 19.4, lat: 52.05, z: 6 })
  const drag = useRef<{ x: number; y: number; lon: number; lat: number } | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (ring && ring.length > 2) setView(kadr(ring))
  }, [ring])

  const p = project(view.lon, view.lat, view.z)
  const left = p.x - size.w / 2 / 256
  const top = p.y - size.h / 2 / 256
  const n = 2 ** view.z
  const x0 = Math.floor(left)
  const y0 = Math.floor(top)
  const x1 = Math.floor(left + size.w / 256)
  const y1 = Math.floor(top + size.h / 256)
  const tiles = []
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue
      const xx = ((x % n) + n) % n
      tiles.push({
        key: `${view.z}-${x}-${y}`,
        href: `https://tile.openstreetmap.org/${view.z}/${xx}/${y}.png`,
        left: (x - left) * 256,
        top: (y - top) * 256,
      })
    }
  }

  const poly =
    ring && ring.length > 2
      ? ring
          .map(([lon, lat]) => {
            const q = project(lon, lat, view.z)
            return `${(q.x - left) * 256},${(q.y - top) * 256}`
          })
          .join(' ')
      : ''

  function przesun(dx: number, dy: number, baza: { lon: number; lat: number }) {
    const b = project(baza.lon, baza.lat, view.z)
    return unproject(b.x - dx / 256, b.y - dy / 256, view.z)
  }

  return (
    <div className="relative">
      <div
        ref={box}
        className="relative h-[420px] cursor-crosshair overflow-hidden rounded-lg bg-zinc-200 select-none"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const next = przesun(e.clientX - d.x, e.clientY - d.y, d)
          setView((v) => ({ ...v, lon: next.lon, lat: next.lat }))
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          if (!d) return
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
          const rect = e.currentTarget.getBoundingClientRect()
          const px = e.clientX - rect.left
          const py = e.clientY - rect.top
          const hit = unproject(left + px / 256, top + py / 256, view.z)
          onPick(hit.lon, hit.lat)
        }}
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            alt=""
            src={tile.href}
            draggable={false}
            className="absolute size-64 max-w-none"
            style={{ left: tile.left, top: tile.top }}
          />
        ))}
        {poly && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <polygon points={poly} fill="rgba(5,150,105,0.35)" stroke="#047857" strokeWidth="2" />
          </svg>
        )}
      </div>
      <div className="absolute top-2 right-2 flex flex-col gap-1 print:hidden">
        <button
          type="button"
          className="size-8 rounded bg-white text-lg font-semibold shadow"
          onClick={() => setView((v) => ({ ...v, z: Math.min(17, v.z + 1) }))}
        >
          +
        </button>
        <button
          type="button"
          className="size-8 rounded bg-white text-lg font-semibold shadow"
          onClick={() => setView((v) => ({ ...v, z: Math.max(5, v.z - 1) }))}
        >
          −
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">Polska jest na środku. Mapa: OpenStreetMap</p>
    </div>
  )
}
