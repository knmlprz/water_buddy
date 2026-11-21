'use client'

import { Badge } from '@/components/badge'
import { DescriptionDetails, DescriptionList, DescriptionTerm } from '@/components/description-list'
import { Heading, Subheading } from '@/components/heading'
import { Panel } from '@/components/panel'
import { Text } from '@/components/text'
import fields from '@/data/fields.json'
import plan from '@/data/plan.json'
import { zl } from '@/lib/dates'
import clsx from 'clsx'
import { useState } from 'react'

type Step = (typeof plan.steps)[number] & {
  water_mm?: number
  water_mock?: boolean
  cost_zl_ha?: number
  cost_mock?: boolean
  cost_label?: string
  subsidy_zl_ha?: number
  subsidy_note?: string
  subsidy_label?: string
  saving_zl_ha?: number[]
  caveat?: string
}

const steps = plan.steps as Step[]
const area = Object.fromEntries(fields.fields.map((f) => [f.id, f.area_ha]))
const bareNow = Object.fromEntries(fields.fields.map((f) => [f.id, f.bare_days]))

const KIND: Record<string, { label: string; className: string }> = {
  loss: { label: 'strata', className: 'bg-rose-50 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/30' },
  dry: { label: 'mniej wody', className: 'bg-white ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10' },
  cereal: { label: 'zboże', className: 'bg-white ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10' },
  legume: { label: 'bobowata', className: 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30' },
  oilseed: { label: 'oleista', className: 'bg-white ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10' },
}

const cover = steps.find((s) => s.id === 'cover')!
const netLo = cover.subsidy_zl_ha! + cover.saving_zl_ha![0] - cover.cost_zl_ha!
const netHi = cover.subsidy_zl_ha! + cover.saving_zl_ha![1] - cover.cost_zl_ha!
const coverHa = plan.rows.reduce((s, r) => s + r.winters.filter(Boolean).length * area[r.field], 0)

export function PlanScreen() {
  const [sel, setSel] = useState('cover')
  const current = steps.find((x) => x.id === sel)!

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Mój płodozmian: co siać, żeby pole trzymało wodę</Heading>
          <Text className="mt-2">Plan na trzy sezony · pole po polu</Text>
        </div>
        <Badge color="amber">Dni gołej gleby po zmianie to makieta</Badge>
      </div>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-3">
        <Panel className="overflow-x-auto xl:col-span-2">
          <Subheading>Płodozmian</Subheading>
          <div className="mt-4 grid min-w-[760px] grid-cols-[112px_repeat(3,minmax(0,1fr)_28px)_minmax(0,1fr)_148px] items-stretch gap-y-3">
            <div />
            {plan.years.map((y, k) => (
              <div key={y} className="contents">
                <div className="px-1 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {y}
                  {k === 0 && ' · co było'}
                </div>
                {k < 3 && <div className="pb-1 text-center text-[11px] text-zinc-500 dark:text-zinc-400">zima</div>}
              </div>
            ))}
            <div className="pb-1 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">dni gołej gleby</div>

            {plan.rows.map((r) => (
              <div key={r.field} className="contents">
                <div className="pr-2">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-white">{r.label}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{r.note}</div>
                </div>
                {r.crops.map((c, k) => (
                  <div key={k} className="contents">
                    <div
                      className={clsx(
                        'mx-1 flex min-h-32 flex-col justify-between rounded-lg px-3 py-2 ring-1',
                        KIND[r.crop_kind[k]].className,
                        k === 0 && 'opacity-80'
                      )}
                    >
                      <div className="text-sm/5 font-medium text-zinc-950 dark:text-white">{c}</div>
                      <div
                        className={clsx(
                          'text-xs',
                          r.crop_kind[k] === 'loss' && 'text-rose-600 dark:text-rose-400',
                          r.crop_kind[k] === 'legume' && 'text-emerald-700 dark:text-emerald-400',
                          r.crop_kind[k] !== 'loss' && r.crop_kind[k] !== 'legume' && 'text-zinc-500 dark:text-zinc-400'
                        )}
                      >
                        {KIND[r.crop_kind[k]].label}
                      </div>
                    </div>
                    {k < 3 && (
                      <button
                        type="button"
                        onClick={() => setSel(r.winters[k] ? 'cover' : 'notill')}
                        title={r.winters[k] ? 'Międzyplon ozimy: gleba okryta' : 'Goła gleba przez zimę'}
                        aria-label={`${r.label}, zima ${plan.years[k]}/${plan.years[k + 1]}: ${r.winters[k] ? 'międzyplon' : 'goła gleba'}`}
                        className={clsx(
                          'mx-auto my-2 w-3 rounded-sm hover:ring-2 hover:ring-zinc-950 dark:hover:ring-white',
                          r.winters[k] ? 'bg-emerald-600' : 'bg-orange-600'
                        )}
                      />
                    )}
                  </div>
                ))}
                <div className="flex flex-col items-end justify-center text-right">
                  <div className="text-sm font-semibold tabular-nums">
                    <span className="text-orange-700 dark:text-orange-400">{bareNow[r.field]}</span>
                    <span className="mx-1 text-zinc-400">→</span>
                    <span className="text-emerald-700 dark:text-emerald-400">{r.bare_days_plan}</span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{r.effect}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-3 w-2 rounded-sm bg-emerald-600" /> zima z międzyplonem
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-3 w-2 rounded-sm bg-orange-600" /> zima z gołą glebą
            </span>
            <span>Na międzyplon ozimy w 2026 jest już za późno, więc plan zaczyna się od sezonu 2027.</span>
            <span>Uprawy opisane typami: gatunki potwierdza agronom.</span>
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          <Subheading>Kroki</Subheading>
          {steps.map((x) => (
            <div
              key={x.id}
              className={clsx(
                'rounded-xl ring-1',
                sel === x.id
                  ? 'bg-white ring-zinc-950 dark:bg-zinc-900 dark:ring-white'
                  : 'bg-zinc-50 ring-zinc-950/10 dark:bg-white/5 dark:ring-white/10'
              )}
            >
              <button
                type="button"
                onClick={() => setSel(x.id)}
                aria-expanded={sel === x.id}
                className="w-full px-4 py-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-zinc-950 dark:text-white">{x.title}</span>
                  {x.bio && <Badge color="emerald">bioróżnorodność</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{x.when}</div>
              </button>
              {sel === x.id && (
                <div className="px-4 pb-3">
                  <StepDetail s={current} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-zinc-950 px-6 py-5 text-white dark:bg-white dark:text-zinc-950">
        <div>
          <div className="text-sm text-white/70 dark:text-zinc-500">
            Międzyplony na {coverHa} ha w trzech sezonach: dopłata + mniej nawozów − nasiona i siew
          </div>
          <div className="mt-1 text-2xl font-semibold">
            Plan zwraca{' '}
            <span className="tabular-nums">
              {zl((netLo * coverHa) / 1000)}–{zl((netHi * coverHa) / 1000)} tys. zł
            </span>
            <span className="ml-3 text-base font-normal text-white/70 tabular-nums dark:text-zinc-500">
              ({zl(netLo)}–{zl(netHi)} zł/ha)
            </span>
            <Badge color="amber" className="ml-2 align-middle">
              makieta
            </Badge>
          </div>
        </div>
        <p className="max-w-md text-sm/6 text-white/70 dark:text-zinc-500">
          Szacunki wody i plonu to model, nie gwarancja. Każdy krok warto skonsultować z doradcą.
        </p>
      </div>
    </>
  )
}

function StepDetail({ s }: { s: Step }) {
  return (
    <DescriptionList className="mt-3">
      <DescriptionTerm>Woda</DescriptionTerm>
      <DescriptionDetails>
        {s.water}
        {s.water_mm != null && (
          <>
            {' '}
            · <span className="tabular-nums">ok. {s.water_mm} mm</span>
          </>
        )}
        {s.water_mock && (
          <Badge color="amber" className="ml-2">
            makieta
          </Badge>
        )}
      </DescriptionDetails>
      <DescriptionTerm>Koszt</DescriptionTerm>
      <DescriptionDetails>
        {s.cost_zl_ha != null ? <span className="tabular-nums">{s.cost_zl_ha} zł/ha</span> : s.cost_label}
        {s.cost_mock && (
          <Badge color="amber" className="ml-2">
            makieta
          </Badge>
        )}
      </DescriptionDetails>
      <DescriptionTerm>Pieniądze</DescriptionTerm>
      <DescriptionDetails>
        {s.subsidy_zl_ha != null ? (
          <>
            <span className="tabular-nums">{s.subsidy_zl_ha.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł/ha</span>{' '}
            dopłaty ({s.subsidy_note})
            {s.saving_zl_ha && (
              <>
                , <span className="tabular-nums">{s.saving_zl_ha[0]}–{s.saving_zl_ha[1]} zł/ha</span> mniej na nawozy
              </>
            )}
          </>
        ) : (
          s.subsidy_label
        )}
      </DescriptionDetails>
      {s.caveat && (
        <>
          <DescriptionTerm>Uwaga</DescriptionTerm>
          <DescriptionDetails>
            <span className="text-orange-700 dark:text-orange-400">{s.caveat}</span>
          </DescriptionDetails>
        </>
      )}
    </DescriptionList>
  )
}
