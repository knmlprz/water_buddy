'use client'

import { useEffect, useRef } from 'react'
import { H, POLYS, W, centroid, paintScene, type FieldPaint } from '@/lib/raster'

export type MapPin = { key: string; text: string; left: number; top: number }

type Props = {
  fields?: FieldPaint[]
  highlight?: string[]
  labels?: Record<string, string>
  pins?: MapPin[]
  imageSrc?: string
  imageAlt?: string
  dimOthers?: boolean
  cloudy?: boolean
  className?: string
}

const pill =
  'absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-zinc-950/75 px-2 py-0.5 text-center text-xs font-medium whitespace-nowrap text-white'

/** Mapa gospodarstwa. Bez zdjęcia: raster 30 m. Ze zdjęciem: plik i piny. */
export function FieldMap({
  fields = [],
  highlight = [],
  labels = {},
  pins = [],
  imageSrc,
  imageAlt = '',
  dimOthers,
  cloudy,
  className,
}: Props) {
  const low = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = low.current
    if (!c || imageSrc) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    paintScene(ctx, fields, { dimOthers })
  }, [fields, dimOthers, imageSrc])

  return (
    <div
      className={`relative overflow-hidden rounded-lg ring-1 ring-zinc-950/10 dark:ring-white/10 ${className ?? ''}`}
      style={{ aspectRatio: imageSrc ? '1 / 1' : `${W} / ${H}` }}
    >
      {imageSrc ? (
        <img src={imageSrc} alt={imageAlt} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <canvas ref={low} width={W} height={H} className="absolute inset-0 h-full w-full [image-rendering:pixelated]" aria-hidden="true" />
      )}
      {!imageSrc && (
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          {Object.entries(POLYS).map(([id, poly]) => (
            <polygon
              key={id}
              points={poly.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={highlight.includes(id) ? '#ffffff' : 'rgba(255,255,255,0.55)'}
              strokeDasharray={highlight.includes(id) ? undefined : '0.8 0.5'}
              vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: highlight.includes(id) ? 3 : 1.5 }}
            />
          ))}
        </svg>
      )}
      {imageSrc
        ? pins.map((pin) => (
            <div key={pin.key} className={pill} style={{ left: `${pin.left}%`, top: `${pin.top}%` }}>
              {pin.text}
            </div>
          ))
        : Object.entries(labels).map(([id, text]) => {
            const [x, y] = centroid(POLYS[id])
            return (
              <div key={id} className={pill} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}>
                {text}
              </div>
            )
          })}
      {cloudy && (
        <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[2px] dark:bg-zinc-950/70">
          <span className="rounded-md bg-white px-3 py-1 text-sm text-zinc-600 ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10">
            Chmury: brak pomiaru w tym tygodniu
          </span>
        </div>
      )}
      <div className="absolute right-2 bottom-2 rounded-md bg-zinc-950/70 px-2 py-1 text-xs text-white">
        <div className="tabular-nums">{imageSrc ? 'Sentinel-2' : '300 m · piksel 30 m'}</div>
        {!imageSrc && <div className="mt-1 h-0.5 w-10 bg-white" />}
      </div>
      {!imageSrc && (
        <div className="absolute bottom-2 left-2 rounded-md bg-zinc-950/70 px-2 py-1 text-xs text-white">Rów odwadniający ↓</div>
      )}
    </div>
  )
}
