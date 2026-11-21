import { opisz, policz } from '../src/lib/bilans.mjs'
import { project, unproject } from '../src/lib/mercator.mjs'

const srodek = project(19.4, 52.05, 6)
const zPowrotem = unproject(srodek.x, srodek.y, 6)
if (Math.abs(zPowrotem.lat - 52.05) > 0.01 || Math.abs(zPowrotem.lon - 19.4) > 0.01) {
  throw new Error(`środek Polski nie wraca na mapę: ${zPowrotem.lat} ${zPowrotem.lon}`)
}
if (srodek.y < 18 || srodek.y > 24) throw new Error(`kafel Polski jest za wysoko albo za nisko: ${srodek.y}`)

function rok(year, lipiecDeszcz, lipiecEt) {
  const dni = []
  for (let m = 1; m <= 12; m++) {
    const dim = new Date(year, m, 0).getDate()
    for (let d = 1; d <= dim; d++) {
      dni.push({
        data: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        opad: m === 7 ? lipiecDeszcz : 2,
        et: m === 7 ? lipiecEt : 2,
      })
    }
  }
  return dni
}

const dni = [...rok(2017, 0, 6), ...rok(2018, 0, 6)]
const kukurydza = policz({ dni, uprawa: 'kukurydza', data: '2018-08-01', glebaMm: 40 })
const pszenica = policz({ dni, uprawa: 'pszenica', data: '2018-08-01', glebaMm: 40 })
if (!(kukurydza.niedobor_mm > pszenica.niedobor_mm)) {
  throw new Error(`uprawa nie zmienia milimetrów: ${kukurydza.niedobor_mm} vs ${pszenica.niedobor_mm}`)
}

const kwiecien = policz({ dni, uprawa: 'kukurydza', data: '2018-04-15', glebaMm: 40 })
if (!(kukurydza.niedobor_mm > kwiecien.niedobor_mm)) {
  throw new Error(`data nie zmienia milimetrów: ${kwiecien.niedobor_mm} vs ${kukurydza.niedobor_mm}`)
}

const mokro = []
for (let m = 1; m <= 8; m++) {
  for (let d = 1; d <= 28; d++) {
    mokro.push({
      data: `2018-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      opad: 20,
      et: 1,
    })
  }
}
const wynik = policz({ dni: mokro, uprawa: 'kukurydza', data: '2018-08-01', glebaMm: 100 })
const zdania = opisz({
  wynik,
  uprawa: 'kukurydza',
  data: '2018-08-01',
  glebaMm: 100,
  spadek: 1,
  ciekM: null,
})
if (Math.round(wynik.niedobor_mm) !== 0) throw new Error('mokry rok ma mieć zero')
if (!zdania.nawadnianie.includes('nie trzeba')) throw new Error('dodatni bilans ma odmówić nawadniania')

console.log(
  'bilans ok',
  Math.round(kukurydza.niedobor_mm),
  Math.round(pszenica.niedobor_mm),
  Math.round(kwiecien.niedobor_mm)
)
