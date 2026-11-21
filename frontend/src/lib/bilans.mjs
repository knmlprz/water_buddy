/** Współczynnik potrzeby względem parowania, miesiącami od stycznia. Ogólna tabela, nie pomiar na polu. */
export const KC = {
  pszenica: [0, 0.4, 0.8, 1.1, 1.15, 0.9, 0.45, 0, 0, 0.3, 0.5, 0.3],
  kukurydza: [0, 0, 0, 0.3, 0.55, 1.05, 1.2, 1.15, 0.7, 0, 0, 0],
  ziemniak: [0, 0, 0.3, 0.55, 1.0, 1.15, 1.1, 0.75, 0.35, 0, 0, 0],
  rzepak: [0.5, 0.8, 1.05, 1.2, 1.0, 0.4, 0, 0, 0, 0.4, 0.55, 0.5],
  burak: [0, 0, 0.3, 0.5, 0.85, 1.15, 1.2, 1.1, 0.75, 0.3, 0, 0],
  trawa: [0.4, 0.6, 0.85, 1.0, 1.05, 1.05, 1.0, 0.95, 0.8, 0.6, 0.45, 0.35],
}

export const UPRAWY = [
  { id: 'pszenica', nazwa: 'Pszenica' },
  { id: 'kukurydza', nazwa: 'Kukurydza' },
  { id: 'ziemniak', nazwa: 'Ziemniak' },
  { id: 'rzepak', nazwa: 'Rzepak' },
  { id: 'burak', nazwa: 'Burak' },
  { id: 'trawa', nazwa: 'Trawa' },
]

export const MIESIACE = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

const PROG_SUCHO_MM = 20

function czesci(data) {
  const [rok, miesiac, dzien] = data.split('-').map(Number)
  return { rok, miesiac, dzien }
}

function doDnia(dni, rok, miesiac, dzien) {
  const out = []
  for (const d of dni) {
    const c = czesci(d.data)
    if (c.rok !== rok) continue
    if (c.miesiac < miesiac || (c.miesiac === miesiac && c.dzien <= dzien)) out.push(d)
  }
  return out
}

function nrDnia(rok, miesiac, dzien) {
  return Math.round((Date.UTC(rok, miesiac - 1, dzien) - Date.UTC(rok, 0, 1)) / 86400000) + 1
}

/** Niedobór narastająco od 1 stycznia. Gleba null: bez zapasu gleby, tylko deszcz kontra potrzeba. */
export function niedoborDo(dniRoku, kc, glebaMm) {
  const cap = glebaMm == null ? 0 : Math.max(0, glebaMm)
  let zapas = glebaMm == null ? 0 : 0.85 * cap
  let brak = 0
  let potrzeba = 0
  let opad = 0
  const miesiecznie = MIESIACE.map(() => ({ opad: 0, potrzeba: 0 }))
  for (const d of dniRoku) {
    const m = czesci(d.data).miesiac - 1
    const n = Math.max(0, d.et) * kc[m]
    const p = Math.max(0, d.opad)
    potrzeba += n
    opad += p
    miesiecznie[m].opad += p
    miesiecznie[m].potrzeba += n
    const dostepne = zapas + p
    if (n > dostepne) {
      brak += n - dostepne
      zapas = 0
    } else {
      zapas = Math.min(cap, dostepne - n)
    }
  }
  return { brak, potrzeba, opad, miesiecznie }
}

export function policz({ dni, uprawa, data, glebaMm }) {
  const kc = KC[uprawa]
  if (!kc) throw new Error('Wybierz uprawę z listy')
  const { rok, miesiac, dzien } = czesci(data)
  const lata = []
  const oczekiwane = nrDnia(rok, miesiac, dzien)
  for (let y = rok - 9; y <= rok; y++) {
    const wRoku = doDnia(dni, y, miesiac, dzien)
    if (y === rok) {
      if (!wRoku.length) throw new Error('Brak pogody dla tego dnia. Nie liczę niedoboru z pustych dni.')
      const ostatni = wRoku[wRoku.length - 1].data
      const koniec = czesci(ostatni)
      if (ostatni < data && oczekiwane - nrDnia(koniec.rok, koniec.miesiac, koniec.dzien) > 7) {
        throw new Error(`Pogoda urywa się ${ostatni}. Nie domykam bilansu do ${data}.`)
      }
    } else if (wRoku.length < oczekiwane * 0.5) {
      continue
    }
    lata.push({ rok: y, ...niedoborDo(wRoku, kc, glebaMm) })
  }
  const teraz = lata.find((r) => r.rok === rok)
  if (!teraz) throw new Error('Brak pogody dla tego dnia. Nie liczę niedoboru z pustych dni.')
  const suche = lata.filter((r) => r.brak >= PROG_SUCHO_MM).length
  return {
    niedobor_mm: teraz.brak,
    potrzeba_mm: teraz.potrzeba,
    opad_mm: teraz.opad,
    miesiecznie: teraz.miesiecznie.slice(0, miesiac),
    suche,
    lat: lata.length,
    prog_mm: PROG_SUCHO_MM,
  }
}

function mm(n) {
  return Math.round(n)
}

export function opisz({ wynik, uprawa, data, glebaMm, spadek, ciekM }) {
  const nazwa = UPRAWY.find((u) => u.id === uprawa)?.nazwa ?? uprawa
  const niedobor = mm(wynik.niedobor_mm)
  const woda = `Do ${data} na tej działce zabrakło ${niedobor} mm wody dla uprawy „${nazwa}”. Potrzeba od początku roku to ${mm(wynik.potrzeba_mm)} mm, deszcz ${mm(wynik.opad_mm)} mm. W ${wynik.suche} z ${wynik.lat} lat do tego dnia brakowało co najmniej ${wynik.prog_mm} mm.`

  let przyczyna
  if (niedobor <= 0) {
    przyczyna = 'Do tego dnia deszcz i zapas wody pokryły potrzebę tej uprawy.'
  } else if (wynik.opad_mm < 0.7 * wynik.potrzeba_mm) {
    przyczyna = 'Deszcz nie pokrył potrzeby tej uprawy.'
  } else if (glebaMm != null && glebaMm < 60) {
    przyczyna = `Gleba w wierzchnich 30 cm trzyma około ${mm(glebaMm)} mm wody, więc zapas szybko się kończy.`
  } else if (spadek != null && spadek > 6) {
    przyczyna = `Spadek terenu to około ${spadek.toFixed(1).replace('.', ',')} procent, więc część deszczu spływa, zanim wsiąknie.`
  } else {
    przyczyna = 'Potrzeba uprawy w tym okresie była wyższa niż woda, którą gleba zdążyła zatrzymać.'
  }

  let retencja
  if (spadek != null && spadek > 6) {
    retencja = 'Zatrzymaj deszcz na polu: okrywa gleby i uprawa w poprzek stoku, żeby woda nie spływała od razu.'
  } else if (glebaMm != null && glebaMm < 80) {
    retencja = 'Zostaw resztki po zbiorze albo międzyplon. Gleba, która trzyma mało wody, potrzebuje okrywy.'
  } else if (ciekM != null && ciekM < 400) {
    retencja = `Ciek jest około ${Math.round(ciekM)} m od środka działki. Spowolnij odpływ, zanim woda z niego ucieknie.`
  } else {
    retencja = 'Po zbiorze nie zostawiaj gołej gleby. Okrywa zatrzymuje deszcz tam, gdzie spadł.'
  }

  const zabieg =
    spadek != null && spadek > 6
      ? 'Prowadź zabiegi w poprzek spadku. Nie zostawiaj bruzd w dół stoku.'
      : 'Ogranicz gołą glebę: międzyplon albo ściernisko zamiast czarnego pola.'

  const nawadnianie =
    niedobor <= 0
      ? 'Nawadniać nie trzeba. Bilans do tego dnia nie jest ujemny.'
      : `Nawadnianie dopiero po okrywie gleby. Do tego dnia zabrakło około ${niedobor} mm. Podawaj wodę w czasie największej potrzeby tej uprawy.`

  return { woda, przyczyna, retencja, zabieg, nawadnianie }
}
