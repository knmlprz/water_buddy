import { pobierzDzialke } from '../src/lib/dzialka.mjs'

const poNumerze = [
  ['mazowieckie', '146510_8.0502.1/3'],
  ['kujawsko-pomorskie', '046101_1.0147.66'],
  ['malopolskie', '126105_9.0120.107/1'],
  ['pomorskie', '226101_1.0090.102/7'],
  ['dolnoslaskie', '026401_1.0001.2664'],
  ['lubelskie', '066301_1.0034.AR_2.130'],
  ['zachodniopomorskie', '326201_1.1036.13'],
  ['podkarpackie', '186301_1.0207.505/16'],
]

for (const [woj, id] of poNumerze) {
  const d = await pobierzDzialke({ id })
  if (!d.ring || d.ring.length < 3) throw new Error(`${woj}: brak obrysu`)
  if (!Number.isFinite(d.lon) || !Number.isFinite(d.lat)) throw new Error(`${woj}: brak środka`)
  console.log(woj, d.id, d.ring.length, d.lat.toFixed(3), d.lon.toFixed(3))
}

const klik = await pobierzDzialke({ lon: 16.9252, lat: 52.4064 })
if (!klik.id || klik.ring.length < 3) throw new Error('puknięcie nie zwróciło obrysu')
console.log('pukniecie', klik.id, klik.ring.length)
