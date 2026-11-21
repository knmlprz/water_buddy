const MONTHS = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
]

export function shortDate(d: string) {
  const [, m, dd] = d.split('-')
  return `${dd}.${m}`
}

export function longDate(d: string) {
  const [, m, dd] = d.split('-')
  return `${+dd} ${MONTHS[+m - 1]}`
}

export function weekIndex(dates: string[], d: string) {
  let k = 0
  dates.forEach((x, j) => {
    if (x <= d) k = j
  })
  return k
}

export function vsNorm(v: number, n: number) {
  const d = Math.round((v / n - 1) * 100)
  return `${d > 0 ? '+' : ''}${d}%`
}

export function zl(v: number) {
  return Math.round(v).toLocaleString('pl-PL')
}
