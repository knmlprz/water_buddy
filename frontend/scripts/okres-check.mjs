import { seriaOkna } from '../src/lib/bilans.mjs'
import { opisDzialki, srodek } from '../src/lib/dzialka.mjs'

const trojkat = [
  [0, 0],
  [4, 0],
  [0, 4],
  [0, 0],
]
const c = srodek(trojkat)
if (Math.abs(c.lon - 4 / 3) > 0.01 || Math.abs(c.lat - 4 / 3) > 0.01) {
  throw new Error(`środek trójkąta: ${c.lon} ${c.lat}`)
}

const opis = opisDzialki('040701_1.0081.11/74|11/74|Inowrocław 81|Inowrocław|POLYGON((18 52, 18.01 52, 18 52.01, 18 52))')
if (!opis || opis.etykieta !== 'Działka 11/74, obręb Inowrocław 81, gm. Inowrocław') {
  throw new Error(`etykieta: ${opis && opis.etykieta}`)
}

function dniRoku(rok, opad, et) {
  const out = []
  for (let dzien = 1; dzien <= 20; dzien++) {
    out.push({ data: `${rok}-05-${String(dzien).padStart(2, '0')}`, opad, et })
  }
  for (let dzien = 1; dzien <= 20; dzien++) {
    out.push({ data: `${rok}-06-${String(dzien).padStart(2, '0')}`, opad, et })
  }
  return out
}

const dni = []
for (let rok = 2014; rok <= 2023; rok++) dni.push(...dniRoku(rok, rok === 2023 ? 0 : 1, rok === 2023 ? 4 : 2))
dni.push(...dniRoku(2024, 1, 2))

const okres = seriaOkna(dni, '2024-06-20', '05-01', '07-10', -80)
if (okres.lat !== 10) throw new Error(`lat: ${okres.lat}`)
if (okres.suche !== 1) throw new Error(`suche: ${okres.suche}`)
if (okres.teraz !== -40) throw new Error(`ten rok: ${okres.teraz}`)
const suchy = okres.slupki.find((s) => s.rok === 2023)
if (!suchy?.suchy) throw new Error('rok 2023 ma być suchy')

console.log('okres ok', okres.suche, okres.teraz, okres.mediana)
