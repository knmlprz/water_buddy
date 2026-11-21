'use client'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { Divider } from '@/components/divider'
import { EChart } from '@/components/e-chart'
import { FieldMap } from '@/components/field-map'
import { Heading, Subheading } from '@/components/heading'
import { Panel } from '@/components/panel'
import { Text } from '@/components/text'
import season from '@/data/season.json'
import { longDate, shortDate, vsNorm, weekIndex } from '@/lib/dates'
import { RAMP_CSS } from '@/lib/raster'
import { useChartTheme } from '@/lib/use-chart-theme'
import { PauseIcon, PlayIcon } from '@heroicons/react/16/solid'
import type { EChartsOption } from 'echarts'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Week = (typeof season.weeks)[number]
const weeks = season.weeks as Week[]
const dates = weeks.map((w) => w.date)
const lossStart = season.events.find((e) => e.type === 'loss_start')!.date
const lossEnd = season.events.find((e) => e.type === 'loss_end')!.date
const FONT = 'Inter, system-ui, sans-serif'

const EVENT_ICON: Record<string, string> = {
  frost: '❄',
  sowing: '↧',
  hail: '⛈',
  loss_start: '!',
  loss_end: '×',
}

export function SeasonScreen() {
  const t = useChartTheme()
  const [i, setI] = useState(weekIndex(dates, '2026-07-27'))
  const [playing, setPlaying] = useState(false)

  const play = useCallback(() => {
    setI((cur) => (cur >= weeks.length - 1 ? 0 : cur))
    setPlaying((p) => !p)
  }, [])

  useEffect(() => {
    const on = () => play()
    window.addEventListener('fieldtwin-play', on)
    return () => window.removeEventListener('fieldtwin-play', on)
  }, [play])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setI((cur) => {
        if (cur >= weeks.length - 1) {
          setPlaying(false)
          return cur
        }
        return cur + 1
      })
    }, 260)
    return () => clearInterval(id)
  }, [playing])

  const w = weeks[i]
  let lastNdvi = w.ndvi
  for (let k = i; lastNdvi == null && k >= 0; k--) lastNdvi = weeks[k].ndvi
  const stress = Math.max(0, w.ndvi_norm - (lastNdvi ?? w.ndvi_norm))

  const mapFields = useMemo(
    () => [
      { id: 'A', ndvi: lastNdvi ?? 0.17, stress },
      { id: 'B', ndvi: 0.35, dim: true },
      { id: 'C', ndvi: 0.45, dim: true },
    ],
    [lastNdvi, stress]
  )

  const option = useMemo<EChartsOption>(() => {
    const axisText = { color: t.muted, fontFamily: FONT, fontSize: 12 }
    const grids = [
      { top: 28, height: '18%' },
      { top: '34%', height: '20%' },
      { top: '66%', height: '22%' },
    ].map((g) => ({ ...g, left: 52, right: 12, containLabel: false }))
    const xAxes = grids.map((_, gi) => ({
      type: 'category' as const,
      gridIndex: gi,
      data: dates,
      boundaryGap: true,
      axisLabel: { show: gi === 2, ...axisText, formatter: (v: string) => shortDate(v), interval: 3 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.line } },
    }))
    const yBase = {
      splitLine: { lineStyle: { color: t.line, type: 'dashed' as const } },
      axisLabel: axisText,
      splitNumber: 3,
    }
    const lossArea = (label: boolean) => ({
      silent: true,
      itemStyle: { color: t.loss, opacity: 0.1 },
      label: label
        ? { show: true, position: 'insideTop' as const, color: t.loss, fontWeight: 600, fontSize: 12, formatter: 'okres straty' }
        : { show: false },
      data: [
        [
          { xAxis: weekIndex(dates, lossStart) },
          { xAxis: weekIndex(dates, lossEnd) },
        ] as [{ xAxis: number }, { xAxis: number }],
      ],
    })
    const cursor = {
      silent: true,
      symbol: 'none' as const,
      animation: false,
      lineStyle: { color: t.ink, width: 1.5, type: 'solid' as const },
      label: { show: false },
      data: [
        { xAxis: i },
        ...season.events
          .filter((e) => e.type !== 'loss_end')
          .map((e) => ({ xAxis: weekIndex(dates, e.date), lineStyle: { color: t.muted, width: 1, type: 'dotted' as const } })),
      ],
    }
    const title = (text: string, top: string | number) => ({
      text,
      top,
      left: 52,
      textStyle: { color: t.ink, fontSize: 13, fontWeight: 600 as const, fontFamily: FONT },
      padding: 0,
    })
    return {
      animation: false,
      textStyle: { fontFamily: FONT },
      title: [title('Opady, mm na tydzień', 0), title('Woda w glebie, m³/m³', '28%'), title('Zieloność pola (NDVI)', '60%')],
      grid: grids,
      xAxis: xAxes,
      yAxis: [
        { gridIndex: 0, ...yBase, max: 30, interval: 10 },
        {
          gridIndex: 1,
          ...yBase,
          min: 0.1,
          max: 0.4,
          interval: 0.1,
          axisLabel: { ...axisText, formatter: (v: number) => v.toFixed(1) },
        },
        {
          gridIndex: 2,
          ...yBase,
          min: 0,
          max: 0.8,
          interval: 0.2,
          axisLabel: { ...axisText, formatter: (v: number) => v.toFixed(1) },
        },
      ],
      axisPointer: { link: [{ xAxisIndex: 'all' }], lineStyle: { color: t.muted } },
      tooltip: {
        trigger: 'axis',
        backgroundColor: t.panel,
        borderColor: t.line,
        textStyle: { color: t.ink, fontFamily: FONT },
        valueFormatter: (v) => (v == null ? 'chmury' : typeof v === 'number' ? (v < 1 ? v.toFixed(2) : v.toFixed(1)) : String(v)),
      },
      series: [
        {
          name: 'Opady 2026',
          type: 'bar',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: weeks.map((x) => x.precip_mm),
          itemStyle: { color: t.water, borderRadius: [2, 2, 0, 0] },
          barWidth: '60%',
          markLine: cursor,
          markArea: lossArea(false),
        },
        {
          name: 'Opady, norma',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: weeks.map((x) => x.precip_norm),
          symbol: 'none',
          lineStyle: { color: t.muted, type: 'dashed', width: 1.5 },
        },
        {
          name: 'Woda w glebie 2026',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: weeks.map((x) => x.sm),
          symbol: 'none',
          smooth: 0.3,
          lineStyle: { color: t.water, width: 2.5 },
          areaStyle: { color: t.water, opacity: 0.12 },
          markLine: cursor,
          markArea: lossArea(false),
        },
        {
          name: 'Woda w glebie, norma',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: weeks.map((x) => x.sm_norm),
          symbol: 'none',
          smooth: 0.3,
          lineStyle: { color: t.muted, type: 'dashed', width: 1.5 },
        },
        {
          name: 'Zieloność 2026',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: weeks.map((x) => x.ndvi),
          connectNulls: false,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: t.field, width: 2.5 },
          itemStyle: { color: t.field },
          markLine: cursor,
          markArea: lossArea(true),
        },
        {
          name: 'Zieloność, średnia 2016–2025',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: weeks.map((x) => x.ndvi_norm),
          symbol: 'none',
          smooth: 0.3,
          lineStyle: { color: t.muted, type: 'dashed', width: 1.5 },
        },
      ],
    }
  }, [t, i])

  const onClickX = useCallback((x: number) => {
    setPlaying(false)
    setI(Math.min(weeks.length - 1, Math.max(0, x)))
  }, [])

  const jumpTo = (date: string) => {
    setPlaying(false)
    setI(weekIndex(dates, date))
  }

  const inLoss = w.date >= lossStart && w.date <= lossEnd

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Co się stało z tym polem w sezonie 2026</Heading>
          <Text className="mt-2">
            Pole A · {season.field.place} · {season.field.crop_2026.toLowerCase()} 2026 · {season.field.area_ha} ha
          </Text>
        </div>
        <Badge color="amber">Dane testowe</Badge>
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <Kpi
          title={season.kpi.label}
          value={`${season.kpi.value}${season.kpi.unit}`}
          tone="loss"
          detail={season.kpi.mock ? 'Liczba przykładowa' : undefined}
          mock={season.kpi.mock}
        />
        <Kpi
          title={season.region_kpi.label}
          value={`${season.region_kpi.value} ${season.region_kpi.unit}`}
          tone="water"
          detail={`${season.region_kpi.source} · region, nie pole`}
        />
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-5">
        <Panel className="flex flex-col gap-4 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Subheading>Pole z satelity, tydzień od {longDate(w.date)}</Subheading>
            <Badge color="zinc">pojedyncze pole · 30 m</Badge>
          </div>
          <FieldMap fields={mapFields} highlight={['A']} labels={{ A: 'Pole A' }} dimOthers cloudy={w.ndvi == null} />
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>goła gleba</span>
            <span className="h-2 flex-1 rounded-full" style={{ background: RAMP_CSS }} />
            <span>pełna zieleń</span>
          </div>
          <div
            className={clsx(
              'mt-auto rounded-lg px-4 py-3 ring-1',
              inLoss
                ? 'bg-rose-50 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/20'
                : 'bg-white ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10'
            )}
          >
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">W tym tygodniu</div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <WeekStat label="opad" value={`${w.precip_mm.toFixed(0)} mm`} hint={`norma ${w.precip_norm.toFixed(0)}`} />
              <WeekStat
                label="woda w glebie"
                value={vsNorm(w.sm, w.sm_norm)}
                hint="vs norma"
                loss={w.sm < w.sm_norm * 0.8}
              />
              <WeekStat
                label="zieloność"
                value={w.ndvi == null ? 'chmury' : vsNorm(w.ndvi, w.ndvi_norm)}
                hint="vs średnia"
                loss={w.ndvi != null && w.ndvi < w.ndvi_norm * 0.8}
              />
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Subheading>Tydzień po tygodniu: woda i zieleń</Subheading>
            <div className="flex flex-wrap gap-2">
              <Badge color="sky">opady · ~10 km</Badge>
              <Badge color="blue">woda w glebie · ~9 km</Badge>
              <Badge color="emerald">zieleń · 30 m</Badge>
            </div>
          </div>
          <div className="mt-3 flex gap-5 text-xs text-zinc-500 dark:text-zinc-400">
            <Legend solid label="2026" />
            <Legend label="norma / średnia lat" />
          </div>
          <EChart option={option} className="mt-2 h-[520px] w-full" onClickX={onClickX} />
        </Panel>
      </div>

      <div className="mt-8 grid grid-cols-1 items-center gap-x-4 gap-y-3 lg:grid-cols-[auto_minmax(0,1fr)_9rem]">
        <div className="grid grid-cols-1 gap-2 lg:hidden">
          {season.events.map((e) => (
            <button
              type="button"
              key={e.date}
              onClick={() => jumpTo(e.date)}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold ring-1 ring-zinc-950/10 dark:ring-white/10',
                e.type.startsWith('loss') ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-200'
              )}
            >
              <span className="w-8 text-center text-2xl leading-none" aria-hidden="true">
                {EVENT_ICON[e.type]}
              </span>
              <span className="min-w-0 flex-1">{e.label}</span>
              <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">{longDate(e.date)}</span>
            </button>
          ))}
        </div>
        <div className="relative hidden h-24 lg:col-start-2 lg:row-start-1 lg:block">
          {season.events.map((e, k) => {
            const x = (weekIndex(dates, e.date) / (weeks.length - 1)) * 100
            return (
              <button
                type="button"
                key={e.date}
                onClick={() => jumpTo(e.date)}
                className={clsx(
                  'absolute -translate-x-1/2 rounded px-1.5 text-sm font-semibold whitespace-nowrap hover:underline',
                  k % 2 ? 'top-12' : 'top-0',
                  e.type.startsWith('loss') ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-600 dark:text-zinc-300'
                )}
                style={{ left: `${x}%` }}
              >
                <span className="mr-1.5 text-2xl leading-none" aria-hidden="true">
                  {EVENT_ICON[e.type]}
                </span>
                {e.label}
              </button>
            )
          })}
        </div>
        <Button
          className="lg:col-start-1 lg:row-start-2"
          onClick={play}
          aria-label={playing ? 'Zatrzymaj odtwarzanie sezonu' : 'Odtwórz sezon tydzień po tygodniu'}
        >
          {playing ? <PauseIcon data-slot="icon" /> : <PlayIcon data-slot="icon" />}
          {playing ? 'Pauza' : 'Odtwórz sezon'}
        </Button>
        <div className="lg:col-start-2 lg:row-start-2">
          <label htmlFor="week" className="sr-only">
            Tydzień sezonu
          </label>
          <input
            id="week"
            className="w-full accent-zinc-950 dark:accent-white"
            type="range"
            min={0}
            max={weeks.length - 1}
            value={i}
            onChange={(e) => {
              setPlaying(false)
              setI(+e.target.value)
            }}
          />
        </div>
        <div className="text-right text-base font-medium tabular-nums text-zinc-950 lg:col-start-3 lg:row-start-2 dark:text-white">
          {longDate(w.date)}
        </div>
      </div>
      <Text className="mt-3">Kliknij wykres albo zdarzenie nad suwakiem, żeby skoczyć do tygodnia. Spacja odtwarza sezon.</Text>
    </>
  )
}

function Kpi({
  title,
  value,
  detail,
  tone,
  mock,
}: {
  title: string
  value: string
  detail?: string
  tone?: 'loss' | 'water'
  mock?: boolean
}) {
  return (
    <div>
      <Divider />
      <div className="mt-6 text-lg/6 font-medium sm:text-sm/6">{title}</div>
      <div
        className={clsx(
          'mt-3 text-3xl/8 font-semibold tabular-nums sm:text-2xl/8',
          tone === 'loss' && 'text-rose-600 dark:text-rose-400',
          tone === 'water' && 'text-sky-700 dark:text-sky-300'
        )}
      >
        {value}
        {mock && (
          <Badge color="amber" className="ml-2 align-middle">
            makieta
          </Badge>
        )}
      </div>
      {detail && <div className="mt-3 text-sm/6 text-zinc-500 sm:text-xs/6 dark:text-zinc-400">{detail}</div>}
    </div>
  )
}

function WeekStat({ label, value, hint, loss }: { label: string; value: string; hint: string; loss?: boolean }) {
  return (
    <div>
      <div className={clsx('text-lg font-semibold tabular-nums', loss && 'text-rose-600 dark:text-rose-400')}>{value}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {label} · {hint}
      </div>
    </div>
  )
}

function Legend({ label, solid }: { label: string; solid?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={clsx('inline-block w-6 border-t-2 border-zinc-950 dark:border-white', solid ? 'border-solid' : 'border-dashed')}
      />
      {label}
    </span>
  )
}
