'use client'

import { Badge } from '@/components/badge'
import { FieldMap } from '@/components/field-map'
import { Heading, Subheading } from '@/components/heading'
import { Panel } from '@/components/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table'
import { Strong, Text } from '@/components/text'
import fields from '@/data/fields.json'
import clsx from 'clsx'
import { useState } from 'react'

type F = (typeof fields.fields)[number]
const MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
// Kadr zdjęcia: lon 23.5175–23.5465, lat 50.4105–50.4315.
const CENTERS: Record<string, [number, number]> = {
  A: [50.42518, 23.53259],
  B: [50.42192, 23.53221],
  C: [50.41679, 23.536],
}

function pinAt(lat: number, lon: number) {
  return { left: ((lon - 23.5175) / 0.029) * 100, top: ((50.4315 - lat) / 0.021) * 100 }
}

export function WhyScreen() {
  const [sel, setSel] = useState('A')
  const list = fields.fields as F[]
  const worst = [...list].sort((a, b) => b.loss_pct - a.loss_pct)
  const pins = list.flatMap((f) => {
    const center = CENTERS[f.id]
    if (!center) return []
    const [lat, lon] = center
    return [{ key: f.id, text: `${f.name} · strata ${f.loss_pct}%`, ...pinAt(lat, lon) }]
  })

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Dlaczego straciło akurat to pole</Heading>
          <Text className="mt-2">
            Gospodarstwo · trzy pola · sezon 2026
            <Badge color="amber" className="ml-2 align-middle">
              makieta
            </Badge>
          </Text>
        </div>
        <Text>Porównanie pól B i C jest przykładowe. Prawdziwe jest pole A.</Text>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-5">
        <Panel className="flex flex-col gap-4 xl:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <Subheading>Pola gospodarstwa w lipcu</Subheading>
            <Badge color="zinc">30 m</Badge>
          </div>
          <FieldMap
            imageSrc="/sat/s2_2026-07-26_fields.png"
            imageAlt="Pola gospodarstwa w lipcu"
            pins={pins}
          />
          <div className="rounded-lg bg-orange-50 px-4 py-3 ring-1 ring-orange-200 dark:bg-orange-500/10 dark:ring-orange-500/20">
            <div className="text-sm font-semibold text-orange-800 dark:text-orange-300">Co łączy pola ze stratą</div>
            <p className="mt-1 text-sm/6 text-zinc-700 dark:text-zinc-300">
              Pola A i B stały gołe ponad 200 dni w roku i nie miały międzyplonu. Woda z roztopów i burzy spłynęła rowem,
              zanim weszła w glebę. Pole C było okryte prawie cały rok i straciło najmniej.
            </p>
          </div>
        </Panel>

        <Panel className="xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Subheading>Ile dni w 2026 gleba stała goła</Subheading>
            <div className="flex flex-wrap gap-2">
              <Badge color="orange">goła gleba</Badge>
              <Badge color="emerald">okryta: uprawa lub międzyplon</Badge>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-[88px_minmax(0,1fr)_72px] items-center gap-x-4 gap-y-4">
            <div />
            <div className="grid grid-cols-12 text-xs text-zinc-500 dark:text-zinc-400">
              {MONTHS.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">dni</div>
            {worst.map((f) => (
              <BareRow key={f.id} f={f} active={sel === f.id} onSelect={() => setSel(f.id)} />
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-8">
        <Subheading>Porównanie pól</Subheading>
        <Table className="mt-4 [--gutter:--spacing(6)]" striped>
          <TableHead>
            <TableRow>
              <TableHeader>Pole</TableHeader>
              <TableHeader>Strata</TableHeader>
              <TableHeader>Międzyplon</TableHeader>
              <TableHeader>Spadek terenu</TableHeader>
              <TableHeader>Odpływ</TableHeader>
              <TableHeader>Gleba</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {worst.map((f) => (
              <TableRow
                key={f.id}
                onClick={() => setSel(f.id)}
                className={clsx('cursor-pointer', sel === f.id && 'bg-zinc-950/5 dark:bg-white/10')}
                title={f.name}
              >
                <TableCell>
                  <Strong>{f.name}</Strong>
                  <div className="text-zinc-500 dark:text-zinc-400">{f.crop_2026}</div>
                </TableCell>
                <TableCell className={clsx('tabular-nums', f.loss_pct > 50 && 'font-medium text-rose-600 dark:text-rose-400')}>
                  {f.loss_pct}%
                </TableCell>
                <TableCell>
                  {f.cover_crop ? <Badge color="emerald">tak</Badge> : <Badge color="orange">nie</Badge>}
                </TableCell>
                <TableCell className="tabular-nums">{f.slope_pct.toLocaleString('pl-PL')}%</TableCell>
                <TableCell>{f.runoff}</TableCell>
                <TableCell className="text-zinc-500 dark:text-zinc-400">{f.soil}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Panel className="mt-8 flex flex-wrap items-center gap-3">
        <Badge color="sky">region, nie pole</Badge>
        <Strong>{fields.region.label}.</Strong>
        <Text>{fields.region.detail}</Text>
      </Panel>
    </>
  )
}

function BareRow({ f, active, onSelect }: { f: F; active: boolean; onSelect: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        className={clsx('text-left text-sm font-medium', active ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white')}
      >
        {f.name}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className={clsx('flex h-10 overflow-hidden rounded-md', active && 'ring-2 ring-zinc-950 ring-offset-2 ring-offset-zinc-50 dark:ring-white dark:ring-offset-zinc-900')}
        aria-label={`${f.name}: ${f.bare_days} dni gołej gleby`}
      >
        {f.bare.map((b, k) => (
          <span key={k} className={clsx('h-full flex-1', b ? 'bg-orange-700 dark:bg-orange-500' : 'bg-emerald-600 dark:bg-emerald-500', k % 4 === 3 && 'mr-px')} />
        ))}
      </button>
      <div className={clsx('text-right text-lg font-semibold tabular-nums', f.bare_days > 150 && 'text-orange-700 dark:text-orange-400')}>
        {f.bare_days}
      </div>
    </>
  )
}
