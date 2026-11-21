'use client'

import * as echarts from 'echarts'
import { useEffect, useRef } from 'react'

export function EChart({
  option,
  className,
  onClickX,
}: {
  option: echarts.EChartsOption
  className?: string
  onClickX?: (i: number) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!el.current) return
    chart.current = echarts.init(el.current, undefined, { renderer: 'canvas' })
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      chart.current?.dispose()
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: false, lazyUpdate: true })
  }, [option])

  useEffect(() => {
    const c = chart.current
    if (!c || !onClickX) return
    const zr = c.getZr()
    const h = (e: { offsetX: number; offsetY: number }) => {
      const p = c.convertFromPixel({ gridIndex: 0 }, [e.offsetX, e.offsetY])
      if (p && Number.isFinite(p[0])) onClickX(Math.round(p[0]))
    }
    zr.on('click', h)
    return () => {
      zr.off('click', h)
    }
  }, [onClickX])

  return <div ref={el} className={className} />
}
