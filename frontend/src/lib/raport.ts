import { CROPS_DATA } from '@/data/crops'
import { LIMITATIONS_DATA } from '@/data/limitations'
import type { RecommendationRule } from '@/data/rules'
import { SOIL_WATER_GROUPS } from '@/data/thresholds'
import { runWaterDiagnosis, type ParcelDiagnosisInput } from '@/engine/waterBrain'
import { bilans60, seriaNarastajaca, seriaOkna, wskaznikOpadu, policz } from './bilans.mjs'
import { pobierzDzialke } from './dzialka.mjs'
import { pobierzCiek, pobierzGlebe, pobierzPogode, pobierzSpadek, pobierzZdjecie, sprawdzDate } from './pobieranie.mjs'

type Dzien = { data: string; opad: number; et: number }
type Okres = {
  slupki: { rok: number; kbw_mm: number; suchy: boolean }[]
  suche: number
  lat: number
  mediana: number | null
  teraz: number | null
}
type Punkt = { etykieta: string; ten_rok: number; mediana: number | null; min: number | null; max: number | null }

export type Karta = {
  id: string
  tytul: string
  tekst: string
  uzasadnienie: string
  zrodlo: string
  warunek: string
}

export type Raport = {
  dzialka: { id: string; lon: number; lat: number; ring: [number, number][]; etykieta: string }
  uprawa: string
  nazwa_uprawy: string
  data: string
  wygenerowano: string
  czas_ms: number
  blokada: boolean
  szacunek_uzytku: string | null
  stan: {
    kolor: 'szary' | 'zielony' | 'zolty' | 'pomaranczowy' | 'czerwony'
    poziom: string
    szczebel: string
    zdanie: string
  }
  na_tle: string | null
  co_teraz: { id: string; krotko: string; cel: string }[]
  alerty: { id: string; tytul: string; tekst: string }[]
  przyczyny: { domena: string; aktywna: boolean; nasilenie: string; dowod: string; zrodlo: string }[]
  retencja: Karta[]
  agrotechnika: Karta[]
  nawadnianie: {
    uzasadnione: boolean
    zdanie: string
    dawka_mm: number
    taw_mm: number
    raw_mm: number
    deficyt_mm: number
    zrodlo: string
    pozwolenie: string
  }
  kroki: { id: string; nazwa: string; zrodlo: string; stan: 'ok' | 'brak' | 'szacunek'; opis: string }[]
  wskazniki: { nazwa: string; wartosc: string; klasa: string; zrodlo: string; data: string }[]
  ograniczenia: string[]
  zrodla: { nazwa: string; co: string; kiedy: string; licencja: string }[]
  zdjecie: { url: string; data: string } | null
  okno: { start: string; koniec: string }
  prog_okna_mm: number
  serie: { narastajaco: Punkt[]; okno: Okres['slupki'] }
}

const KOLOR = {
  nie_wiemy: 'szary',
  brak: 'zielony',
  obserwacja: 'zolty',
  ostrzezenie: 'pomaranczowy',
  alarm: 'czerwony',
} as const

const POZWOLENIE =
  LIMITATIONS_DATA.find((l) => l.id === 'LIM_08_NAWADNIANIE_POZWOLENIA')?.zdanie_do_raportu ?? ''

function mm(n: number) {
  const v = Math.round(n)
  return `${v < 0 ? '\u2212' : ''}${Math.abs(v)} mm`
}

function liczba(n: number | null | undefined): n is number {
  return n != null && !Number.isNaN(n)
}

function warunekDzialki(
  r: RecommendationRule,
  ctx: { kbw: number | null; spi3: number | null; spadek: number | null; row: number | null; suche: number | null; gleba: string | null },
) {
  const bity: string[] = []
  if (liczba(ctx.kbw) && /kbw/i.test(r.warunek_kod)) bity.push(`KBW ${mm(ctx.kbw)}`)
  if (liczba(ctx.spi3) && /spi3/i.test(r.warunek_kod)) bity.push(`wskaźnik opadu z 3 miesięcy ${ctx.spi3.toFixed(1)}`)
  if (liczba(ctx.spadek) && /slope/i.test(r.warunek_kod)) bity.push(`spadek ${ctx.spadek.toFixed(1).replace('.', ',')}%`)
  if (liczba(ctx.row) && /ditch/i.test(r.warunek_kod)) bity.push(`rów w odległości ${Math.round(ctx.row)} m`)
  if (liczba(ctx.suche) && /dryYears/i.test(r.warunek_kod)) bity.push(`suche lata: ${ctx.suche} z 10`)
  if (ctx.gleba && /soil/i.test(r.warunek_kod)) bity.push(ctx.gleba)
  return bity.length ? bity.join(', ') : r.warunek_czytelny
}

function karty(reguly: RecommendationRule[], ctx: Parameters<typeof warunekDzialki>[1]): Karta[] {
  return reguly.map((r) => ({
    id: r.id,
    tytul: r.tytul,
    tekst: r.tekst_dla_rolnika,
    uzasadnienie: r.uzasadnienie_naukowe,
    zrodlo: r.zrodlo,
    warunek: warunekDzialki(r, ctx),
  }))
}

function zdanieNaTle(okres: Okres) {
  if (okres.lat < 6) return null
  let t = `W ${okres.suche} z ostatnich ${okres.lat} lat ten okres był tu suchy.`
  if (okres.teraz != null && okres.mediana != null) {
    const roznica = okres.teraz - okres.mediana
    if (roznica <= -5) t += ` Ten rok jest o ${Math.abs(roznica)} mm gorszy od mediany.`
    else if (roznica >= 5) t += ` Ten rok jest o ${roznica} mm lepszy od mediany.`
    else t += ' Ten rok jest blisko mediany tego okresu.'
  }
  return t
}

function grupaGleby(mm30: number | null): string | null {
  if (mm30 == null) return null
  const mm50 = mm30 * (50 / 30)
  return SOIL_WATER_GROUPS.reduce((naj, grupa) =>
    Math.abs(grupa.woda_dostepna_50cm_mm - mm50) < Math.abs(naj.woda_dostepna_50cm_mm - mm50) ? grupa : naj,
  ).id
}

export async function zbudujRaport(body: {
  uprawa?: string
  data?: string
  id?: string
  lon?: number
  lat?: number
}): Promise<Raport> {
  const start = Date.now()
  const uprawa = String(body?.uprawa ?? '')
  const crop = CROPS_DATA.find((c) => c.id === uprawa)
  if (!crop) throw new Error('Wybierz uprawę z listy')
  const data = sprawdzDate(String(body?.data ?? '')) as string

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  let dzialka: { id: string; lon: number; lat: number; ring: [number, number][]; etykieta?: string }
  try {
    dzialka = await pobierzDzialke({
      id: body?.id ? String(body.id) : undefined,
      lon: body?.lon,
      lat: body?.lat,
      signal: ctrl.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Serwer GUGiK nie odpowiada, spróbuj ponownie.')
    throw e
  } finally {
    clearTimeout(timer)
  }

  const od = `${Number(data.slice(0, 4)) - 10}-01-01`
  const [pogoda, gleba, spadek, satelita, ciek] = await Promise.all([
    pobierzPogode(dzialka.lat, dzialka.lon, od, data),
    pobierzGlebe(dzialka.lat, dzialka.lon),
    pobierzSpadek(dzialka.lat, dzialka.lon),
    pobierzZdjecie(dzialka.lat, dzialka.lon, data),
    pobierzCiek(dzialka.lat, dzialka.lon),
  ])

  const dni = (pogoda.dni as Dzien[]).filter((d) => d.data <= data)
  const wynik = policz({ dni, uprawa, data, glebaMm: gleba.mm })
  const kbw = bilans60(dni, data) as number | null
  const spi1 = wskaznikOpadu(dni, data, 30) as number | null
  const spi3 = wskaznikOpadu(dni, data, 90) as number | null
  const okres = seriaOkna(dni, data, crop.okno_start_mmdd, crop.okno_koniec_mmdd, crop.prog_kbw_kat1_mm) as Okres
  const narastajaco = seriaNarastajaca(dni, data) as Punkt[]
  const soilId = grupaGleby(gleba.mm)
  const soil = soilId ? (SOIL_WATER_GROUPS.find((s) => s.id === soilId) ?? null) : null
  const wyczerpanie =
    gleba.mm != null && gleba.mm > 0 ? Math.min(1, Math.max(0, 1 - wynik.zapas_mm / gleba.mm)) : null
  const suche = okres.lat >= 6 ? okres.suche : null

  const wejscie: ParcelDiagnosisInput = {
    parcelLabel: dzialka.etykieta || dzialka.id,
    analysisDate: data,
    cropId: uprawa,
    soilId,
    landUse: null,
    isNatura2000: null,
    slopePct: spadek.procent,
    hasSoilCover: null,
    hasDepression: null,
    ditchDistanceM: ciek.metry,
    kbwMm: kbw,
    spi1,
    spi3,
    sma: null,
    // shortcut: brak pikseli Sentinel-2, Natury 2000 i rowów z bazy topograficznej. Wykres zieleni i te warstwy dochodzą, gdy pobieranie je zwróci.
    ndvi: null,
    ndmi: null,
    ndviAnomaly: null,
    satelliteAgeDays: null,
    depletionFraction: wyczerpanie,
    dryYearsLast10: suche,
  }
  const diag = runWaterDiagnosis(wejscie)
  const poziom = diag.edoLevel.poziom
  const blokada = diag.verificationAlerts.some((r) => r.id === 'R01_GRUNT_NIEROLNICZY')
  const ctx = {
    kbw,
    spi3,
    spadek: spadek.procent as number | null,
    row: ciek.metry as number | null,
    suche,
    gleba: soil ? `${soil.grupa_uziarnienia}, woda dostępna około ${soil.woda_dostepna_50cm_mm} mm` : null,
  }
  const dzialania = [...diag.landscapeRetention, ...diag.agrotechnics, ...diag.irrigationRules]
  const wygenerowano = new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(new Date())

  const zrodla: Raport['zrodla'] = [
    {
      nazwa: 'Usługa lokalizacji działek',
      co: 'obrys i opis działki',
      kiedy: wygenerowano,
      licencja: 'GUGiK',
    },
    {
      nazwa: pogoda.zrodlo,
      co: pogoda.opis,
      kiedy: wygenerowano,
      licencja: pogoda.szacunek ? 'NASA POWER' : 'Open-Meteo, CC BY 4.0',
    },
  ]
  if (gleba.mm != null) {
    zrodla.push({
      nazwa: 'Mapa gleb',
      co: 'woda dostępna w wierzchnich 30 cm, środek działki',
      kiedy: wygenerowano,
      licencja: 'ISRIC SoilGrids',
    })
  }
  if (spadek.procent != null) {
    zrodla.push({
      nazwa: 'Wysokość terenu',
      co: 'pięć punktów co około 150 metrów',
      kiedy: wygenerowano,
      licencja: 'Open-Meteo, model wysokości',
    })
  }
  if (satelita.zdjecie) {
    zrodla.push({
      nazwa: 'Zdjęcie satelitarne',
      co: 'podgląd sceny, nie wycinek samej działki',
      kiedy: satelita.zdjecie.data,
      licencja: 'Contains modified Copernicus Sentinel data',
    })
  }
  if (ciek.metry != null) {
    zrodla.push({
      nazwa: 'Mapa cieków',
      co: 'odległość do najbliższego cieku w promieniu 3 km',
      kiedy: wygenerowano,
      licencja: 'OpenStreetMap, przez usługę Overpass',
    })
  }

  const klasaKbw = kbw == null ? 'brak' : kbw < -50 ? 'niedobór' : 'bez progu niedoboru'
  const wskazniki: Raport['wskazniki'] = [
    { nazwa: 'Bilans wodny z 60 dni', wartosc: kbw == null ? 'brak' : mm(kbw), klasa: klasaKbw, zrodlo: pogoda.zrodlo, data: data },
    {
      nazwa: 'Wskaźnik opadu z 1 miesiąca',
      wartosc: spi1 == null ? 'brak' : spi1.toFixed(1),
      klasa: spi1 == null ? 'brak' : spi1 < -2 ? 'silny niedobór' : 'poza progiem alarmu opadu',
      zrodlo: pogoda.zrodlo,
      data: data,
    },
    {
      nazwa: 'Wskaźnik opadu z 3 miesięcy',
      wartosc: spi3 == null ? 'brak' : spi3.toFixed(1),
      klasa: spi3 == null ? 'brak' : spi3 < -1 ? 'niedobór' : 'poza progiem obserwacji',
      zrodlo: pogoda.zrodlo,
      data: data,
    },
    {
      nazwa: 'Szczebel suszy',
      wartosc: diag.edoLevel.nazwa_pl,
      klasa: diag.edoLevel.nazwa_pl,
      zrodlo: diag.edoLevel.zrodlo,
      data: data,
    },
    {
      nazwa: 'Grupa gleby',
      wartosc: soil ? soil.grupa_uziarnienia : 'brak',
      klasa: soil ? soil.kategoria_iung : 'brak',
      zrodlo: gleba.mm == null ? 'brak mapy gleb' : 'ISRIC SoilGrids, dopasowanie do tabeli',
      data: wygenerowano,
    },
    {
      nazwa: 'Spadek terenu',
      wartosc: spadek.procent == null ? 'brak' : `${Number(spadek.procent).toFixed(1).replace('.', ',')}%`,
      klasa: spadek.procent == null ? 'brak' : spadek.procent > 4 ? 'stromy' : 'łagodny',
      zrodlo: 'Wysokość terenu',
      data: wygenerowano,
    },
    {
      nazwa: 'Najbliższy ciek',
      wartosc: ciek.metry == null ? 'brak' : `${Math.round(ciek.metry)} m`,
      klasa: ciek.metry == null ? 'brak' : ciek.metry <= 500 ? 'w promieniu 500 m' : 'dalej niż 500 m',
      zrodlo: 'Mapa cieków',
      data: wygenerowano,
    },
    {
      nazwa: 'Suche lata w oknie uprawy',
      wartosc: suche == null ? 'brak' : `${suche} z ${okres.lat}`,
      klasa: suche == null ? 'brak' : suche >= 5 ? 'często' : 'rzadziej niż w połowie lat',
      zrodlo: pogoda.zrodlo,
      data: data,
    },
  ]

  return {
    dzialka: {
      id: dzialka.id,
      lon: dzialka.lon,
      lat: dzialka.lat,
      ring: dzialka.ring,
      etykieta: dzialka.etykieta || `Działka ${dzialka.id}`,
    },
    uprawa,
    nazwa_uprawy: crop.nazwa_pl,
    data,
    wygenerowano,
    czas_ms: Date.now() - start,
    blokada,
    szacunek_uzytku:
      'Użytku gruntowego nie sprawdzono. Działkę liczę jako grunt orny. To szacunek, nie odczyt z ewidencji.',
    stan: {
      kolor: KOLOR[poziom],
      poziom,
      szczebel: diag.edoLevel.nazwa_pl,
      zdanie: diag.statusSummaryPl,
    },
    na_tle: zdanieNaTle(okres),
    co_teraz: blokada
      ? []
      : dzialania.slice(0, 3).map((r) => ({
          id: r.id,
          krotko: r.co_dodac_krotko,
          cel: r.kolejnosc_kowr === 4 ? 'nawadnianie' : `k-${r.id}`,
        })),
    alerty: diag.verificationAlerts.map((r) => ({ id: r.id, tytul: r.tytul, tekst: r.tekst_dla_rolnika })),
    przyczyny: diag.causes.map((c) => ({
      domena: c.domena,
      aktywna: c.aktywna,
      nasilenie: c.nasilenie,
      dowod: c.dowod,
      zrodlo: c.zrodlo,
    })),
    retencja: karty(diag.landscapeRetention, ctx),
    agrotechnika: karty(diag.agrotechnics, ctx),
    nawadnianie: {
      uzasadnione: diag.irrigationCalc.uzasadnione,
      zdanie: diag.irrigationCalc.powod_decyzji,
      dawka_mm: diag.irrigationCalc.dawka_zalecana_mm,
      taw_mm: diag.irrigationCalc.taw_mm,
      raw_mm: diag.irrigationCalc.raw_mm,
      deficyt_mm: diag.irrigationCalc.aktualny_deficyt_mm,
      zrodlo: diag.irrigationCalc.zrodlo,
      pozwolenie: POZWOLENIE,
    },
    kroki: [
      {
        id: 'dzialka',
        nazwa: 'Działka i teren',
        zrodlo: 'usługa lokalizacji działek, wysokość terenu',
        stan: spadek.procent == null ? 'szacunek' : 'ok',
        opis: spadek.brak ? `Obrys jest. ${spadek.brak}` : 'Obrys i spadek.',
      },
      {
        id: 'pogoda',
        nazwa: 'Pogoda z 10 lat',
        zrodlo: pogoda.zrodlo,
        stan: pogoda.szacunek ? 'szacunek' : 'ok',
        opis: pogoda.opis,
      },
      {
        id: 'zdjecie',
        nazwa: 'Zdjęcie satelitarne',
        zrodlo: 'Sentinel-2, podgląd',
        stan: satelita.zdjecie ? 'ok' : 'brak',
        opis: satelita.brak || `Scena z ${satelita.zdjecie?.data}.`,
      },
      {
        id: 'gleba',
        nazwa: 'Gleba',
        zrodlo: 'SoilGrids',
        stan: gleba.mm == null ? 'brak' : 'szacunek',
        opis: gleba.brak || 'Woda dostępna z mapy, dopasowana do najbliższej grupy.',
      },
      {
        id: 'woda',
        nazwa: 'Wody i rowy w pobliżu',
        zrodlo: 'mapa cieków',
        stan: ciek.metry == null ? 'brak' : 'ok',
        opis: ciek.metry == null ? ciek.brak || 'Brak cieku.' : `Najbliższy ciek około ${Math.round(ciek.metry)} m.`,
      },
    ],
    wskazniki,
    ograniczenia: diag.limitations.map((lim) => lim.zdanie_do_raportu),
    zrodla,
    zdjecie: satelita.zdjecie,
    okno: { start: crop.okno_start_mmdd, koniec: crop.okno_koniec_mmdd },
    prog_okna_mm: crop.prog_kbw_kat1_mm,
    serie: { narastajaco, okno: okres.slupki },
  }
}
