'use client'

import { useEffect, useState } from 'react'

export type ChartTheme = {
  ink: string
  muted: string
  line: string
  panel: string
  field: string
  water: string
  loss: string
}

const light: ChartTheme = {
  ink: '#09090b',
  muted: '#71717a',
  line: '#e4e4e7',
  panel: '#ffffff',
  field: '#059669',
  water: '#0284c7',
  loss: '#e11d48',
}

const dark: ChartTheme = {
  ink: '#fafafa',
  muted: '#a1a1aa',
  line: '#3f3f46',
  panel: '#18181b',
  field: '#34d399',
  water: '#38bdf8',
  loss: '#fb7185',
}

/** Kolory wykresu dopasowane do jasnego i ciemnego motywu Catalyst. */
export function useChartTheme() {
  const [theme, setTheme] = useState<ChartTheme>(light)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => setTheme(mq.matches ? dark : light)
    apply()
    mq.addEventListener('change', apply)
    document.fonts?.ready.then(apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return theme
}
